import { Injectable, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { LocalDbService } from './local-db.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SyncProcessorService implements OnDestroy {
  private syncing = false;

  private readonly handleOnline = () => {
    console.log('Navegador ficou online. Iniciando sincronização...');
    this.processQueue();
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

    console.log('Atualizando base de alimentos...');
    this.api.get<any[]>('/api/alimentos/todos').subscribe({
      next: (todos) => {
        this.localDb.saveAlimentos(todos);
        console.log(`Base de alimentos populada com sucesso: ${todos.length} itens.`);
      },
      error: (err) => console.error('Erro ao baixar base de alimentos:', err)
    });
  }

  async processQueue(): Promise<void> {
    if (this.syncing) return;
    // Se outro usuário acabou de logar, espera a fila do anterior ser apagada antes de ler.
    await this.auth.limpezaLocal;
    const queue = await this.localDb.getSyncQueue();
    if (queue.length === 0) return;

    this.syncing = true;
    console.log(`Processando fila de sincronização: ${queue.length} tarefas pendentes...`);

    const tempIdMapRaw = localStorage.getItem('guiabr_temp_id_map');
    const tempIdMap: Record<number, number> = tempIdMapRaw ? JSON.parse(tempIdMapRaw) : {};

    try {
      for (const item of queue) {
        const { id, action, payload } = item;

        try {
          if (action === 'criar_refeicao') {
            const res = await firstValueFrom(this.api.post<any>('/api/refeicoes', {
              nome_refeicao: payload.nome_refeicao,
              tipo_refeicao: payload.tipo_refeicao
            }));

            tempIdMap[payload.tempId] = res.id;
            localStorage.setItem('guiabr_temp_id_map', JSON.stringify(tempIdMap));

            await this.localDb.deleteRefeicao(payload.tempId);
            await this.localDb.saveRefeicao(res);
          } 
          
          else if (action === 'deletar_refeicao') {
            const refeicaoId = tempIdMap[payload.id] || payload.id;
            await firstValueFrom(this.api.delete(`/api/refeicoes/${refeicaoId}`));
            await this.localDb.deleteRefeicao(payload.id);
          } 
          
          else if (action === 'adicionar_item') {
            const refeicaoId = tempIdMap[payload.refeicaoId] || payload.refeicaoId;
            const res = await firstValueFrom(this.api.post<any>(`/api/refeicoes/${refeicaoId}/itens`, {
              alimento_id: payload.alimentoId
            }));
            
            await this.localDb.saveRefeicao(res);
          } 
          
          else if (action === 'remover_item') {
            const refeicaoId = tempIdMap[payload.refeicaoId] || payload.refeicaoId;
            const res = await firstValueFrom(this.api.delete<any>(`/api/refeicoes/${refeicaoId}/itens/${payload.alimentoId}`));
            
            await this.localDb.saveRefeicao(res);
          }
          
          else if (action === 'deletar_historico') {
            await firstValueFrom(this.api.delete(`/api/alimentos/historico/${payload.barcode}`));
          }

          else if (action === 'concluir_capitulo') {
            await firstValueFrom(this.api.post<any>(`/api/capitulos/${payload.numero}/concluir`, {}));
          }

          else if (action === 'resetar_progresso') {
            await firstValueFrom(this.api.post<any>('/api/capitulos/reset', {}));
          }

          await this.localDb.removeFromSyncQueue(id);
          console.log(`Tarefa ${id} (${action}) sincronizada com sucesso.`);

        } catch (err: any) {
          console.error(`Erro ao sincronizar tarefa ${id} (${action}):`, err);
          const status = err?.status;
          if (!navigator.onLine || status === 0 || !status || status >= 500) {
            console.warn(`Erro temporário/rede (status: ${status}). Interrompendo fila para tentar mais tarde.`);
            break;
          }
          if (status === 401 || status === 403) {
            console.warn(`Sessão inválida/expirada (status: ${status}). Mantendo tarefa na fila até novo login.`);
            break;
          }
          console.error(`Erro permanente do cliente (status: ${status}). Removendo tarefa inválida da fila.`);
          await this.localDb.removeFromSyncQueue(id);
        }
      }

      const remainingQueue = await this.localDb.getSyncQueue();
      if (remainingQueue.length === 0) {
        localStorage.removeItem('guiabr_temp_id_map');
      }

      console.log('Processamento da fila de sincronização finalizado.');
      
      if (navigator.onLine) {
        const refeicoes = await firstValueFrom(this.api.get<any[]>('/api/refeicoes')).catch(() => null);
        if (refeicoes) await this.localDb.saveRefeicoes(refeicoes);
      }

    } finally {
      this.syncing = false;
    }
  }
}
