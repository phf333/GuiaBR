import { Injectable } from '@angular/core';
import Dexie, { Table } from 'dexie';
import { Alimento, Refeicao } from '../shared/models';

export interface SyncTask {
  id?: number;
  action: string;
  payload: any;
  timestamp: number;
}

export class GuiaBRDB extends Dexie {
  alimentos!: Table<Alimento, number>;
  refeicoes!: Table<Refeicao, number>;
  sync_queue!: Table<SyncTask, number>;

  constructor() {
    super('GuiaBRDB');
    this.version(1).stores({
      alimentos: 'id, nome, classificacao_guia',
      refeicoes: 'id',
      sync_queue: '++id, action, timestamp'
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
  async addToSyncQueue(action: string, payload: any): Promise<void> {
    await this.db.sync_queue.add({ action, payload, timestamp: Date.now() });
  }

  async getSyncQueue(): Promise<any[]> {
    return this.db.sync_queue.toArray();
  }

  async removeFromSyncQueue(id: number): Promise<void> {
    await this.db.sync_queue.delete(id);
  }

  // --- DADOS DO USUÁRIO ---
  /** Apaga o que pertence ao usuário (refeições e fila); a base de alimentos é comum a todos e fica. */
  async clearUserData(): Promise<void> {
    await Promise.all([this.db.refeicoes.clear(), this.db.sync_queue.clear()]);
  }
}
