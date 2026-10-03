import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Alimento, Refeicao, TipoRefeicao } from '../shared/models';

/** Payload de cada ação que pode ficar na fila de sincronização. */
export interface PayloadsSync {
  criar_refeicao: { tempId: number; nome_refeicao: string; tipo_refeicao: TipoRefeicao };
  deletar_refeicao: { id: number };
  adicionar_item: { refeicaoId: number; alimentoId: number };
  remover_item: { refeicaoId: number; alimentoId: number };
  deletar_historico: { barcode: string };
  concluir_capitulo: { numero: number };
  salvar_posicao: { numero: number; ultimo_card: number };
  resetar_progresso: Record<string, never>;
}

export type AcaoSync = keyof PayloadsSync;

export type SyncTask = {
  [A in AcaoSync]: { id?: number; action: A; payload: PayloadsSync[A]; timestamp: number };
}[AcaoSync];

/** Entrada da tabela `cache`: dados do usuário espelhados do servidor, guardados inteiros por chave. */
interface EntradaCache {
  chave: string;
  valor: unknown;
}

/**
 * Troca, numa tarefa da fila, a referência a uma refeição criada offline (id temporário)
 * pelo id que o servidor atribuiu. Devolve true se a tarefa foi alterada.
 */
export function trocarRefeicaoId(task: SyncTask, de: number, para: number): boolean {
  if (task.action === 'deletar_refeicao' && task.payload.id === de) {
    task.payload.id = para;
    return true;
  }
  if ((task.action === 'adicionar_item' || task.action === 'remover_item') && task.payload.refeicaoId === de) {
    task.payload.refeicaoId = para;
    return true;
  }
  return false;
}

export class GuiaBRDB extends Dexie {
  alimentos!: Table<Alimento, number>;
  refeicoes!: Table<Refeicao, number>;
  sync_queue!: Table<SyncTask, number>;
  cache!: Table<EntradaCache, string>;

  constructor() {
    super('GuiaBRDB');
    this.version(1).stores({
      alimentos: 'id, nome, classificacao_guia',
      refeicoes: 'id',
      sync_queue: '++id, action, timestamp'
    });
    // v2: histórico do scanner e progresso do Guia saem do localStorage para a tabela `cache`,
    // e o mapa de ids temporários deixa de existir (os ids são trocados direto na fila).
    this.version(2).stores({ cache: 'chave' }).upgrade(async (tx) => {
      let mapa: Record<string, number> = {};
      try {
        mapa = JSON.parse(localStorage.getItem('guiabr_temp_id_map') ?? '{}');
      } catch {
        // mapa corrompido: as tarefas seguem com o id temporário
      }
      await tx.table<SyncTask, number>('sync_queue').toCollection().modify((task) => {
        Object.entries(mapa).forEach(([tempId, id]) => trocarRefeicaoId(task, Number(tempId), id));
      });
      ['guiabr_temp_id_map', 'guiabr_historico_scanner', 'guiabr_guia_progresso']
        .forEach((chave) => localStorage.removeItem(chave));
    });
  }
}

@Injectable({ providedIn: 'root' })
export class LocalDbService {
  private db = new GuiaBRDB();

  // --- ALIMENTOS ---
  async saveAlimentos(alimentos: Alimento[]): Promise<void> {
    await this.db.transaction('rw', this.db.alimentos, async () => {
      await this.db.alimentos.clear();
      await this.db.alimentos.bulkPut(alimentos);
    });
  }

  async searchAlimentos(query: string, soSafra: boolean, grauProcessamento?: string): Promise<Alimento[]> {
    const normalizedQuery = query.toLowerCase().trim();
    let collection = this.db.alimentos.toCollection();

    if (normalizedQuery !== '') {
      collection = this.db.alimentos.filter((item) =>
        item.nome.toLowerCase().includes(normalizedQuery)
      );
    }

    let results = await collection.toArray();

    if (soSafra) {
      results = results.filter((item) => {
        const safra = item.sazonalidade_atual;
        return safra && safra.valor >= 3;
      });
    }

    if (grauProcessamento && grauProcessamento !== '') {
      const normalizedGrau = grauProcessamento.toLowerCase();
      results = results.filter((item) =>
        item.classificacao_guia?.toLowerCase() === normalizedGrau
      );
    }

    return results;
  }

  async getAlimento(id: number): Promise<Alimento | null> {
    const res = await this.db.alimentos.get(id);
    return res || null;
  }

  // --- REFEICOES ---
  async saveRefeicoes(refeicoes: Refeicao[]): Promise<void> {
    await this.db.transaction('rw', this.db.refeicoes, async () => {
      const existing = await this.db.refeicoes.toArray();
      const existingMap = new Map(existing.map(r => [r.id, r]));
      const newIds = new Set(refeicoes.map(r => r.id));

      const toDelete = existing.filter(r => !newIds.has(r.id)).map(r => r.id);
      const toSave = refeicoes.map(r => {
        const cached = existingMap.get(r.id);
        if (cached?.itens?.length && !r.itens?.length) {
          return { ...r, itens: cached.itens, total_itens: cached.total_itens ?? r.total_itens };
        }
        return r;
      });

      if (toDelete.length > 0) {
        await this.db.refeicoes.bulkDelete(toDelete);
      }
      await this.db.refeicoes.bulkPut(toSave);
    });
  }

  async getRefeicoes(): Promise<Refeicao[]> {
    return this.db.refeicoes.toArray();
  }

  async getRefeicao(id: number): Promise<Refeicao | null> {
    const res = await this.db.refeicoes.get(id);
    return res || null;
  }

  async saveRefeicao(ref: Refeicao): Promise<void> {
    await this.db.refeicoes.put(ref);
  }

  async deleteRefeicao(id: number): Promise<void> {
    await this.db.refeicoes.delete(id);
  }

  // --- SYNC QUEUE ---
  async addToSyncQueue<A extends AcaoSync>(action: A, payload: PayloadsSync[A]): Promise<void> {
    await this.db.sync_queue.add({ action, payload, timestamp: Date.now() } as SyncTask);
  }

  async getSyncQueue(): Promise<SyncTask[]> {
    return this.db.sync_queue.toArray();
  }

  async removeFromSyncQueue(id: number): Promise<void> {
    await this.db.sync_queue.delete(id);
  }

  /** Aponta para o id real as tarefas pendentes que ainda citam o id temporário de uma refeição. */
  async trocarRefeicaoIdNaFila(de: number, para: number): Promise<void> {
    await this.db.sync_queue.toCollection().modify((task) => {
      trocarRefeicaoId(task, de, para);
    });
  }

  // --- CACHE ---
  async getCache<T>(chave: string): Promise<T | null> {
    const entrada = await this.db.cache.get(chave);
    return (entrada?.valor as T) ?? null;
  }

  async setCache<T>(chave: string, valor: T): Promise<void> {
    await this.db.cache.put({ chave, valor });
  }

  // --- DADOS DO USUÁRIO ---
  /** Apaga o que pertence ao usuário; a base de alimentos é comum a todos e fica. */
  async clearUserData(): Promise<void> {
    await Promise.all([this.db.refeicoes.clear(), this.db.sync_queue.clear(), this.db.cache.clear()]);
  }
}
