import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { CAPITULOS_DEFAULT } from './data/capitulos.data';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { LocalDbService, SyncTask } from '../core/local-db.service';
import { comFallbackLocal } from '../core/offline';

export interface Capitulo {
  numero: number;
  titulo: string;
  status: 'done' | 'active' | 'locked';
  /** Índice do card em que o usuário parou (0 se nunca abriu). */
  ultimo_card?: number;
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
  ultimo_card?: number;
}

@Injectable({ providedIn: 'root' })
export class GuiaService {
  private readonly CHAVE_CACHE = 'progresso_guia';
  /** Espera sem trocar de card antes de mandar a posição ao servidor, para não enviar a cada rolagem. */
  private readonly ESPERA_ENVIO_POSICAO_MS = 2000;

  private capitulosSubject = new BehaviorSubject<Capitulo[]>([]);
  capitulos$ = this.capitulosSubject.asObservable();

  /** Capítulos cuja posição mudou no aparelho e ainda não foi mandada ao servidor nem enfileirada. */
  private posicoesAEnviar = new Set<number>();
  private agendarEnvio$ = new Subject<void>();

  constructor(private api: ApiService, private localDb: LocalDbService, private auth: AuthService) {
    // Recarrega a cada troca de usuário: o serviço é singleton e sobrevive ao logout.
    this.auth.usuarioAtual$
      .pipe(map(usuario => usuario?.id ?? null), distinctUntilChanged())
      .subscribe(usuarioId => {
        this.posicoesAEnviar.clear();
        if (usuarioId === null) {
          this.capitulosSubject.next([]);
        } else {
          this.carregarProgresso();
        }
      });

    this.agendarEnvio$
      .pipe(debounceTime(this.ESPERA_ENVIO_POSICAO_MS))
      .subscribe(() => [...this.posicoesAEnviar].forEach(numero => this.enviarPosicao(numero)));
  }

  get capitulosAtuais(): Capitulo[] {
    return this.capitulosSubject.value;
  }

  private get progressoAtual(): ProgressoCapitulo[] {
    return this.capitulosAtuais.map(cap => ({
      numero: cap.numero,
      status: cap.status,
      ultimo_card: cap.ultimo_card ?? 0,
    }));
  }

  private async carregarProgresso() {
    await this.auth.limpezaLocal;
    // O que foi feito offline e ainda está na fila não pode ser perdido
    // quando o progresso do servidor for recarregado.
    const fila = await this.localDb.getSyncQueue();

    comFallbackLocal(
      true,
      () => this.api.get<ProgressoCapitulo[]>('/api/capitulos'),
      // Sem progresso salvo, a lista vazia faz os capítulos assumirem o status padrão.
      async () => (await this.localDb.getCache<ProgressoCapitulo[]>(this.CHAVE_CACHE)) ?? [],
      'Erro ao carregar progresso do backend, usando backup local:'
    ).subscribe(progresso => this.aplicar(this.aplicarPendentes(progresso, fila)));
  }

  /** Publica o progresso vindo do servidor, mantendo as posições que este aparelho ainda não enviou. */
  private aplicar(progresso: ProgressoCapitulo[]) {
    const naoEnviadas = new Map(
      this.capitulosAtuais
        .filter(cap => this.posicoesAEnviar.has(cap.numero))
        .map(cap => [cap.numero, cap.ultimo_card])
    );
    this.publicar(progresso.map(p =>
      naoEnviadas.has(p.numero) ? { ...p, ultimo_card: naoEnviadas.get(p.numero) } : p
    ));
  }

  /** Publica o progresso e o guarda para uso offline. */
  private publicar(progresso: ProgressoCapitulo[]) {
    this.capitulosSubject.next(this.mergearComProgresso(progresso));
    this.localDb.setCache(this.CHAVE_CACHE, progresso);
  }

  /** Aplica sobre o progresso as conclusões e posições que ainda estão na fila de sincronização. */
  private aplicarPendentes(progresso: ProgressoCapitulo[], fila: SyncTask[]): ProgressoCapitulo[] {
    const mapa = new Map(progresso.map(p => [p.numero, p]));
    const alterar = (numero: number, campos: Partial<ProgressoCapitulo>) =>
      mapa.set(numero, { numero, status: 'active', ...mapa.get(numero), ...campos });

    for (const tarefa of fila) {
      if (tarefa.action === 'concluir_capitulo') {
        alterar(tarefa.payload.numero, { status: 'done' });
      } else if (tarefa.action === 'salvar_posicao') {
        alterar(tarefa.payload.numero, { ultimo_card: tarefa.payload.ultimo_card });
      }
    }
    return Array.from(mapa.values());
  }

  /** Remove da fila as tarefas pendentes de capítulos que atendem ao filtro. */
  private async removerDaFila(filtro: (tarefa: SyncTask) => boolean): Promise<void> {
    const fila = await this.localDb.getSyncQueue();
    for (const tarefa of fila) {
      if (tarefa.id !== undefined && filtro(tarefa)) {
        await this.localDb.removeFromSyncQueue(tarefa.id);
      }
    }
  }

  /**
   * Mescla o conteúdo local (CAPITULOS_DEFAULT) com o progresso vindo do backend.
   * Capítulos presentes no local mas sem progresso no backend ficam com o default.
   */
  private mergearComProgresso(progresso: ProgressoCapitulo[]): Capitulo[] {
    const porNumero = new Map(progresso.map(p => [p.numero, p]));
    return CAPITULOS_DEFAULT.map(cap => ({
      ...cap,
      status: porNumero.get(cap.numero)?.status ?? cap.status,
      ultimo_card: porNumero.get(cap.numero)?.ultimo_card ?? 0,
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
    return this.progressoAtual.map(p => p.numero === numero ? { ...p, status: 'done' } : p);
  }

  resetarProgresso() {
    this.posicoesAEnviar.clear();

    comFallbackLocal(
      navigator.onLine,
      () => this.api.post<ProgressoCapitulo[]>('/api/capitulos/reset', {}),
      () => this.resetarLocalmente(),
      'Erro ao resetar progresso no backend. Enfileirando para sincronizar depois:'
    ).subscribe(async progresso => {
      // O reset desfaz o que estava pendente; reenviar depois traria o progresso de volta.
      await this.removerDaFila(t => t.action === 'concluir_capitulo' || t.action === 'salvar_posicao');
      this.aplicar(progresso);
    });
  }

  private async resetarLocalmente(): Promise<ProgressoCapitulo[]> {
    await this.localDb.addToSyncQueue('resetar_progresso', {});
    return CAPITULOS_DEFAULT.map(cap => ({ numero: cap.numero, status: cap.status, ultimo_card: 0 }));
  }

  /** Registra no aparelho o card em que o usuário está; o envio ao servidor é agendado. */
  salvarUltimoCard(numero: number, cardIndex: number) {
    if (this.obterUltimoCard(numero) === cardIndex) return;

    this.posicoesAEnviar.add(numero);
    this.publicar(this.progressoAtual.map(p => p.numero === numero ? { ...p, ultimo_card: cardIndex } : p));
    this.agendarEnvio$.next();
  }

  /** Retorna o índice do último card visualizado num capítulo (0 se nunca visitado). */
  obterUltimoCard(numero: number): number {
    return this.capitulosAtuais.find(cap => cap.numero === numero)?.ultimo_card ?? 0;
  }

  /** Manda ao servidor a posição do capítulo, se ela mudou desde o último envio. Chamado ao sair do capítulo. */
  enviarPosicao(numero: number) {
    if (!this.posicoesAEnviar.delete(numero)) return;

    const ultimo_card = this.obterUltimoCard(numero);
    comFallbackLocal<unknown>(
      navigator.onLine,
      () => this.api.post(`/api/capitulos/${numero}/posicao`, { ultimo_card }),
      () => this.enfileirarPosicao(numero, ultimo_card),
      'Erro ao salvar a posição de leitura no backend. Enfileirando para sincronizar depois:'
    ).subscribe();
  }

  /** Só a posição mais recente de cada capítulo interessa: substitui a que já estiver na fila. */
  private async enfileirarPosicao(numero: number, ultimo_card: number): Promise<void> {
    await this.removerDaFila(t => t.action === 'salvar_posicao' && t.payload.numero === numero);
    await this.localDb.addToSyncQueue('salvar_posicao', { numero, ultimo_card });
  }
}
