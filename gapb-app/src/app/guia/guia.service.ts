import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CAPITULOS_DEFAULT } from './data/capitulos.data';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';

export interface Capitulo {
  numero: number;
  titulo: string;
  status: 'done' | 'active' | 'locked';
  cards: CardConteudo[];
}

export interface CardConteudo {
  tipo: 'fundamento' | 'sabia_que';
  texto: string;
}

/** Formato retornado pelo backend: apenas progresso, sem conteúdo. */
interface ProgressoCapitulo {
  numero: number;
  status: 'done' | 'active' | 'locked';
}

@Injectable({ providedIn: 'root' })
export class GuiaService {
  private readonly STORAGE_KEY = 'guiabr_guia_progresso';
  private readonly ULTIMO_CARD_KEY = 'guiabr_guia_ultimo_card';

  private capitulosSubject = new BehaviorSubject<Capitulo[]>([]);
  capitulos$ = this.capitulosSubject.asObservable();

  constructor(private api: ApiService, private localDb: LocalDbService) {
    this.carregarProgresso();
  }

  get capitulosAtuais(): Capitulo[] {
    return this.capitulosSubject.value;
  }

  private async carregarProgresso() {
    // Capítulos concluídos offline que ainda não foram sincronizados com o backend
    // não podem ser perdidos quando o progresso do servidor for recarregado.
    const pendentes = await this.getCapitulosPendentesDeSync();

    this.api.get<ProgressoCapitulo[]>('/api/capitulos').subscribe({
      next: (progresso) => {
        const mesclado = this.aplicarPendentes(progresso, pendentes);
        const capitulos = this.mergearComProgresso(mesclado);
        this.capitulosSubject.next(capitulos);
        this.salvarLocalmente(mesclado);
      },
      error: (err) => {
        console.warn('Erro ao carregar progresso do backend, usando backup local:', err);
        // Fallback: usa progresso salvo localmente e mescla com conteúdo local
        const savedRaw = localStorage.getItem(this.STORAGE_KEY);
        if (savedRaw) {
          try {
            const progresso: ProgressoCapitulo[] = JSON.parse(savedRaw);
            const mesclado = this.aplicarPendentes(progresso, pendentes);
            this.capitulosSubject.next(this.mergearComProgresso(mesclado));
            return;
          } catch (e) {
            console.error('Erro ao ler progresso salvo. Resetando...', e);
          }
        }
        // Último recurso: usa os defaults completos
        this.capitulosSubject.next(JSON.parse(JSON.stringify(CAPITULOS_DEFAULT)));
      }
    });
  }

  /** Números dos capítulos com uma tarefa 'concluir_capitulo' ainda pendente na fila de sincronização. */
  private async getCapitulosPendentesDeSync(): Promise<Set<number>> {
    const queue = await this.localDb.getSyncQueue();
    return new Set(
      queue.filter(t => t.action === 'concluir_capitulo').map(t => t.payload.numero)
    );
  }

  /** Garante que capítulos com conclusão pendente de sincronização apareçam como concluídos. */
  private aplicarPendentes(progresso: ProgressoCapitulo[], pendentes: Set<number>): ProgressoCapitulo[] {
    if (pendentes.size === 0) return progresso;
    const mapa = new Map(progresso.map(p => [p.numero, p]));
    pendentes.forEach(numero => mapa.set(numero, { numero, status: 'done' }));
    return Array.from(mapa.values());
  }

  /** Remove da fila as tarefas 'concluir_capitulo' pendentes (usado ao resetar o progresso). */
  private async limparCapitulosPendentes(): Promise<void> {
    const queue = await this.localDb.getSyncQueue();
    for (const task of queue) {
      if (task.action === 'concluir_capitulo' && task.id !== undefined) {
        await this.localDb.removeFromSyncQueue(task.id);
      }
    }
  }

  /**
   * Mescla o conteúdo local (CAPITULOS_DEFAULT) com o status vindo do backend.
   * Capítulos presentes no local mas sem status no backend ficam com o default.
   */
  private mergearComProgresso(progresso: ProgressoCapitulo[]): Capitulo[] {
    const statusMap = new Map(progresso.map(p => [p.numero, p.status]));
    return CAPITULOS_DEFAULT.map(cap => ({
      ...cap,
      status: statusMap.get(cap.numero) ?? cap.status,
    }));
  }

  private salvarLocalmente(progresso: ProgressoCapitulo[]) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(progresso));
  }

  concluirCapitulo(numero: number) {
    if (!navigator.onLine) {
      this.concluirLocalmente(numero);
      return;
    }

    this.api.post<ProgressoCapitulo[]>(`/api/capitulos/${numero}/concluir`, {}).subscribe({
      next: (progresso) => {
        const capitulos = this.mergearComProgresso(progresso);
        this.capitulosSubject.next(capitulos);
        this.salvarLocalmente(progresso);
      },
      error: (err) => {
        console.warn('Erro ao salvar progresso no backend. Enfileirando para sincronizar depois:', err);
        this.concluirLocalmente(numero);
      }
    });
  }

  private concluirLocalmente(numero: number) {
    let alterado = false;
    const listaAtualizada = this.capitulosAtuais.map(cap => {
      if (cap.numero === numero && cap.status !== 'done') {
        alterado = true;
        return { ...cap, status: 'done' as const };
      }
      return cap;
    });

    if (!alterado) return;

    this.capitulosSubject.next(listaAtualizada);
    // Salva apenas o progresso (sem conteúdo) no localStorage
    const progresso = listaAtualizada.map(c => ({ numero: c.numero, status: c.status }));
    this.salvarLocalmente(progresso);
    this.localDb.addToSyncQueue('concluir_capitulo', { numero });
  }

  resetarProgresso() {
    // Limpa o registro do último card lido em cada capítulo para voltar ao card 0
    localStorage.removeItem(this.ULTIMO_CARD_KEY);

    if (!navigator.onLine) {
      this.resetarLocalmente();
      return;
    }

    this.api.post<ProgressoCapitulo[]>('/api/capitulos/reset', {}).subscribe({
      next: (progresso) => {
        const capitulos = this.mergearComProgresso(progresso);
        this.capitulosSubject.next(capitulos);
        this.salvarLocalmente(progresso);
        this.limparCapitulosPendentes();
      },
      error: (err) => {
        console.warn('Erro ao resetar progresso no backend. Enfileirando para sincronizar depois:', err);
        this.resetarLocalmente();
      }
    });
  }

  private resetarLocalmente() {
    const defaults = JSON.parse(JSON.stringify(CAPITULOS_DEFAULT));
    this.capitulosSubject.next(defaults);
    const progresso = defaults.map((c: Capitulo) => ({ numero: c.numero, status: c.status }));
    this.salvarLocalmente(progresso);
    this.limparCapitulosPendentes();
    this.localDb.addToSyncQueue('resetar_progresso', {});
  }


  /** Salva o índice do último card visualizado num capítulo. */
  salvarUltimoCard(capitulo_numero: number, cardIndex: number) {
    const raw = localStorage.getItem(this.ULTIMO_CARD_KEY);
    const mapa: Record<number, number> = raw ? JSON.parse(raw) : {};
    mapa[capitulo_numero] = cardIndex;
    localStorage.setItem(this.ULTIMO_CARD_KEY, JSON.stringify(mapa));
  }

  /** Retorna o índice do último card visualizado num capítulo (0 se nunca visitado). */
  obterUltimoCard(capitulo_numero: number): number {
    const raw = localStorage.getItem(this.ULTIMO_CARD_KEY);
    if (!raw) return 0;
    const mapa: Record<number, number> = JSON.parse(raw);
    return mapa[capitulo_numero] ?? 0;
  }
}
