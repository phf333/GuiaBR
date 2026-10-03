import { Injectable, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AcaoSync, LocalDbService, PayloadsSync, SyncTask, trocarRefeicaoId } from './local-db.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Alimento, Refeicao } from '../shared/models';

type Handlers = { [A in AcaoSync]: (payload: PayloadsSync[A], fila: SyncTask[]) => Promise<void> };

@Injectable({ providedIn: 'root' })
export class SyncProcessorService implements OnDestroy {
  private syncing = false;

  private readonly handleOnline = () => {
    this.processQueue();
  };

  /** Como reenviar ao servidor cada ação feita offline. */
  private readonly handlers: Handlers = {
    criar_refeicao: async (payload, fila) => {
      const refeicao = await firstValueFrom(this.api.post<Refeicao>('/api/refeicoes', {
        nome_refeicao: payload.nome_refeicao,
        tipo_refeicao: payload.tipo_refeicao
      }));

      // As tarefas seguintes ainda citam o id temporário: troca na fila salva e na que está em memória.
      await this.localDb.trocarRefeicaoIdNaFila(payload.tempId, refeicao.id);
      fila.forEach(tarefa => trocarRefeicaoId(tarefa, payload.tempId, refeicao.id));

      await this.localDb.deleteRefeicao(payload.tempId);
      await this.localDb.saveRefeicao(refeicao);
    },

    deletar_refeicao: async (payload) => {
      await firstValueFrom(this.api.delete(`/api/refeicoes/${payload.id}`));
      await this.localDb.deleteRefeicao(payload.id);
    },

    adicionar_item: async (payload) => {
      const refeicao = await firstValueFrom(this.api.post<Refeicao>(
        `/api/refeicoes/${payload.refeicaoId}/itens`, { alimento_id: payload.alimentoId }
      ));
      await this.localDb.saveRefeicao(refeicao);
    },

    remover_item: async (payload) => {
      const refeicao = await firstValueFrom(this.api.delete<Refeicao>(
        `/api/refeicoes/${payload.refeicaoId}/itens/${payload.alimentoId}`
      ));
      await this.localDb.saveRefeicao(refeicao);
    },

    deletar_historico: async (payload) => {
      await firstValueFrom(this.api.delete(`/api/alimentos/historico/${payload.barcode}`));
    },

    concluir_capitulo: async (payload) => {
      await firstValueFrom(this.api.post(`/api/capitulos/${payload.numero}/concluir`, {}));
    },

    resetar_progresso: async () => {
      await firstValueFrom(this.api.post('/api/capitulos/reset', {}));
    },
  };

  constructor(
    private localDb: LocalDbService,
    private api: ApiService,
    private auth: AuthService
  ) {
    window.addEventListener('online', this.handleOnline);

    this.auth.usuarioAtual$.subscribe((user) => {
      if (user && navigator.onLine) {
        this.processQueue();
        this.carregarAlimentosNoCache();
      }
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.handleOnline);
  }

  async carregarAlimentosNoCache(): Promise<void> {
    if (!navigator.onLine) return;

    this.api.get<Alimento[]>('/api/alimentos/todos').subscribe({
      next: (todos) => this.localDb.saveAlimentos(todos),
      error: (err) => console.error('Erro ao baixar base de alimentos:', err)
    });
  }

  async processQueue(): Promise<void> {
    if (this.syncing) return;
    // Se outro usuário acabou de logar, espera a fila do anterior ser apagada antes de ler.
    await this.auth.limpezaLocal;
    const fila = await this.localDb.getSyncQueue();
    if (fila.length === 0) return;

    this.syncing = true;
    try {
      for (const tarefa of fila) {
        const sincronizada = await this.sincronizar(tarefa, fila);
        if (!sincronizada) break;
      }

      if (navigator.onLine) {
        const refeicoes = await firstValueFrom(this.api.get<Refeicao[]>('/api/refeicoes')).catch(() => null);
        if (refeicoes) await this.localDb.saveRefeicoes(refeicoes);
      }
    } finally {
      this.syncing = false;
    }
  }

  /** Reenvia uma tarefa. Devolve false quando a fila deve parar e ser retomada depois. */
  private async sincronizar(tarefa: SyncTask, fila: SyncTask[]): Promise<boolean> {
    const handler = this.handlers[tarefa.action] as
      ((payload: unknown, fila: SyncTask[]) => Promise<void>) | undefined;
    try {
      // Ação desconhecida (versão antiga do app) não tem como ser reenviada: sai da fila.
      await handler?.(tarefa.payload, fila);
    } catch (err: any) {
      console.error(`Erro ao sincronizar tarefa ${tarefa.id} (${tarefa.action}):`, err);
      const status = err?.status;
      if (!navigator.onLine || !status || status >= 500) {
        console.warn(`Erro temporário/rede (status: ${status}). Interrompendo fila para tentar mais tarde.`);
        return false;
      }
      if (status === 401 || status === 403) {
        console.warn(`Sessão inválida/expirada (status: ${status}). Mantendo tarefa na fila até novo login.`);
        return false;
      }
      console.error(`Erro permanente do cliente (status: ${status}). Removendo tarefa inválida da fila.`);
    }
    await this.localDb.removeFromSyncQueue(tarefa.id!);
    return true;
  }
}
