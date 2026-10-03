import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map } from 'rxjs';
import { CAPITULOS_DEFAULT } from './data/capitulos.data';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { LocalDbService } from '../core/local-db.service';
import { comFallbackLocal } from '../core/offline';

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
  private readonly CHAVE_CACHE = 'progresso_guia';
  private readonly ULTIMO_CARD_KEY = 'guiabr_guia_ultimo_card';

  private capitulosSubject = new BehaviorSubject<Capitulo[]>([]);
  capitulos$ = this.capitulosSubject.asObservable();

  constructor(private api: ApiService, private localDb: LocalDbService, private auth: AuthService) {
    // Recarrega a cada troca de usuário: o serviço é singleton e sobrevive ao logout.
    this.auth.usuarioAtual$
      .pipe(map(usuario => usuario?.id ?? null), distinctUntilChanged())
      .subscribe(usuarioId => {
        if (usuarioId === null) {
          this.capitulosSubject.next([]);
        } else {
          this.carregarProgresso();
        }
      });
  }

  get capitulosAtuais(): Capitulo[] {
    return this.capitulosSubject.value;
  }

  private async carregarProgresso() {
    await this.auth.limpezaLocal;
    // Capítulos concluídos offline que ainda não foram sincronizados com o backend
    // não podem ser perdidos quando o progresso do servidor for recarregado.
    const pendentes = await this.getCapitulosPendentesDeSync();

    comFallbackLocal(
      true,
      () => this.api.get<ProgressoCapitulo[]>('/api/capitulos'),
      // Sem progresso salvo, a lista vazia faz os capítulos assumirem o status padrão.
      async () => (await this.localDb.getCache<ProgressoCapitulo[]>(this.CHAVE_CACHE)) ?? [],
      'Erro ao carregar progresso do backend, usando backup local:'
    ).subscribe(progresso => this.aplicar(this.aplicarPendentes(progresso, pendentes)));
  }

  /** Publica o progresso e o guarda para uso offline. */
  private aplicar(progresso: ProgressoCapitulo[]) {
    this.capitulosSubject.next(this.mergearComProgresso(progresso));
    this.localDb.setCache(this.CHAVE_CACHE, progresso);
  }

  /** Números dos capítulos com uma tarefa 'concluir_capitulo' ainda pendente na fila de sincronização. */
  private async getCapitulosPendentesDeSync(): Promise<Set<number>> {
    const queue = await this.localDb.getSyncQueue();
    return new Set(
      queue.flatMap(t => t.action === 'concluir_capitulo' ? [t.payload.numero] : [])
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

  concluirCapitulo(numero: number) {
    comFallbackLocal(
      navigator.onLine,
      () => this.api.post<ProgressoCapitulo[]>(`/api/capitulos/${numero}/concluir`, {}),
      () => this.concluirLocalmente(numero),
      'Erro ao salvar progresso no backend. Enfileirando para sincronizar depois:'
    ).subscribe(progresso => this.aplicar(progresso));
  }

  private async concluirLocalmente(numero: number): Promise<ProgressoCapitulo[]> {
    const jaConcluido = this.capitulosAtuais.some(cap => cap.numero === numero && cap.status === 'done');
    if (!jaConcluido) {
      await this.localDb.addToSyncQueue('concluir_capitulo', { numero });
    }
    return this.capitulosAtuais.map(cap => ({
      numero: cap.numero,
      status: cap.numero === numero ? 'done' : cap.status,
    }));
  }

  resetarProgresso() {
    // Limpa o registro do último card lido em cada capítulo para voltar ao card 0
    localStorage.removeItem(this.ULTIMO_CARD_KEY);

    comFallbackLocal(
      navigator.onLine,
      () => this.api.post<ProgressoCapitulo[]>('/api/capitulos/reset', {}),
      () => this.resetarLocalmente(),
      'Erro ao resetar progresso no backend. Enfileirando para sincronizar depois:'
    ).subscribe(async progresso => {
      await this.limparCapitulosPendentes();
      this.aplicar(progresso);
    });
  }

  private async resetarLocalmente(): Promise<ProgressoCapitulo[]> {
    await this.localDb.addToSyncQueue('resetar_progresso', {});
    return CAPITULOS_DEFAULT.map(cap => ({ numero: cap.numero, status: cap.status }));
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
