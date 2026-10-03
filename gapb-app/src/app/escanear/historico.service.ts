import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, firstValueFrom, tap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { comFallbackLocal } from '../core/offline';
import { ProdutoEscaneado } from '../shared/models';

/** Histórico de produtos escaneados do usuário, com cópia local para uso offline. */
@Injectable({ providedIn: 'root' })
export class HistoricoService {
  private readonly CHAVE_CACHE = 'historico_scanner';
  private readonly LIMITE = 20;

  historico$ = new BehaviorSubject<ProdutoEscaneado[]>([]);

  constructor(private api: ApiService, private localDb: LocalDbService) {}

  /** Publica a cópia local de imediato e, estando online, troca pela lista do servidor. */
  async carregar(): Promise<void> {
    this.historico$.next((await this.localDb.getCache<ProdutoEscaneado[]>(this.CHAVE_CACHE)) ?? []);
    if (!navigator.onLine) return;

    try {
      this.definir(await firstValueFrom(this.api.get<ProdutoEscaneado[]>('/api/alimentos/historico')));
    } catch (err) {
      console.warn('Erro ao carregar histórico do backend, mantendo a cópia local:', err);
    }
  }

  /** Busca o produto pelo código de barras; o backend já o registra no histórico. */
  buscar(codigoBarras: string): Observable<ProdutoEscaneado> {
    return this.api.get<ProdutoEscaneado>('/api/alimentos/busca', { codigo: codigoBarras }).pipe(
      tap(produto => this.definir([produto, ...this.sem(produto.codigo_barras)].slice(0, this.LIMITE)))
    );
  }

  excluir(codigoBarras: string): Observable<unknown> {
    this.definir(this.sem(codigoBarras));
    return comFallbackLocal<unknown>(
      navigator.onLine,
      () => this.api.delete(`/api/alimentos/historico/${codigoBarras}`),
      () => this.localDb.addToSyncQueue('deletar_historico', { barcode: codigoBarras }),
      'Erro ao excluir item do histórico no backend. Enfileirando para sincronizar depois:'
    );
  }

  private sem(codigoBarras: string): ProdutoEscaneado[] {
    return this.historico$.value.filter(produto => produto.codigo_barras !== codigoBarras);
  }

  private definir(historico: ProdutoEscaneado[]) {
    this.historico$.next(historico);
    this.localDb.setCache(this.CHAVE_CACHE, historico);
  }
}
