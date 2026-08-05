import { Injectable } from '@angular/core';
import { Observable, from, tap, catchError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { TipoRefeicao, ItemRefeicao, Refeicao } from '../shared/models';


@Injectable({ providedIn: 'root' })
export class PratoService {
  constructor(private api: ApiService, private localDb: LocalDbService) {}

  /** Tenta a chamada online (se aplicável) e cai para o fallback local quando offline ou em caso de erro. */
  private comFallbackLocal<T>(
    online: boolean,
    chamarApi: () => Observable<T>,
    aoSucesso: (resultado: T) => void,
    fallbackLocal: () => Observable<T>,
    mensagemErro: string
  ): Observable<T> {
    if (!online) return fallbackLocal();
    return chamarApi().pipe(
      tap(aoSucesso),
      catchError((err) => {
        console.warn(mensagemErro, err);
        return fallbackLocal();
      })
    );
  }

  listar(): Observable<Refeicao[]> {
    if (navigator.onLine) {
      return this.api.get<Refeicao[]>('/api/refeicoes').pipe(
        tap(refeicoes => this.localDb.saveRefeicoes(refeicoes)),
        catchError((err) => {
          console.warn('Falha ao obter refeições da rede, lendo cache local:', err);
          return from(this.localDb.getRefeicoes());
        })
      );
    } else {
      return from(this.localDb.getRefeicoes());
    }
  }

  obter(id: number): Observable<Refeicao> {
    if (navigator.onLine && id > 0) {
      return this.api.get<Refeicao>(`/api/refeicoes/${id}`).pipe(
        tap(ref => this.localDb.saveRefeicao(ref)),
        catchError((err) => {
          console.warn(`Falha ao obter refeição ${id} da rede, lendo cache local:`, err);
          return from(this.localDb.getRefeicao(id).then(ref => {
            if (!ref) throw new Error('Refeição não encontrada no cache');
            return ref;
          }));
        })
      );
    } else {
      return from(this.localDb.getRefeicao(id).then(ref => {
        if (!ref) throw new Error('Refeição não encontrada offline');
        return ref;
      }));
    }
  }

  criar(nome: string, tipo: TipoRefeicao): Observable<Refeicao> {
    return this.comFallbackLocal(
      navigator.onLine,
      () => this.api.post<Refeicao>('/api/refeicoes', { nome_refeicao: nome, tipo_refeicao: tipo }),
      (ref) => this.localDb.saveRefeicao(ref),
      () => this.criarLocal(nome, tipo),
      'Falha ao criar refeição online, salvando localmente:'
    );
  }

  private criarLocal(nome: string, tipo: TipoRefeicao): Observable<Refeicao> {
    const tempId = -Date.now();
    const tempRefeicao: Refeicao = {
      id: tempId,
      nome_refeicao: nome,
      tipo_refeicao: tipo,
      data_criacao: new Date().toISOString(),
      total_itens: 0,
      itens: []
    };
    return from(
      this.localDb.saveRefeicao(tempRefeicao)
        .then(() => this.localDb.addToSyncQueue('criar_refeicao', { nome_refeicao: nome, tipo_refeicao: tipo, tempId }))
        .then(() => tempRefeicao)
    );
  }

  deletar(id: number): Observable<any> {
    return this.comFallbackLocal(
      navigator.onLine && id > 0,
      () => this.api.delete(`/api/refeicoes/${id}`),
      () => this.localDb.deleteRefeicao(id),
      () => this.deletarLocal(id),
      'Falha ao deletar refeição online, salvando localmente:'
    );
  }

  private deletarLocal(id: number): Observable<any> {
    return from(
      this.localDb.deleteRefeicao(id)
        .then(() => this.localDb.addToSyncQueue('deletar_refeicao', { id }))
    );
  }

  adicionarItem(refeicaoId: number, alimentoId: number): Observable<Refeicao> {
    return this.comFallbackLocal(
      navigator.onLine && refeicaoId > 0,
      () => this.api.post<Refeicao>(`/api/refeicoes/${refeicaoId}/itens`, { alimento_id: alimentoId }),
      (ref) => this.localDb.saveRefeicao(ref),
      () => this.adicionarItemLocal(refeicaoId, alimentoId),
      'Falha ao adicionar item online, salvando localmente:'
    );
  }

  private adicionarItemLocal(refeicaoId: number, alimentoId: number): Observable<Refeicao> {
    return from(
      Promise.all([
        this.localDb.getRefeicao(refeicaoId),
        this.localDb.getAlimento(alimentoId)
      ]).then(async ([ref, al]) => {
        if (!ref) throw new Error('Refeição não encontrada');
        if (!al) throw new Error('Alimento não encontrado no cache local');

        const novoItem: ItemRefeicao = {
          alimento_id: al.id,
          nome: al.nome,
          grupo: al.grupo,
          classificacao_guia: al.classificacao_guia,
          categoria_guia: al.categoria_guia ?? '',
          sazonalidade_atual: al.sazonalidade_atual
        };

        ref.itens = ref.itens || [];
        if (!ref.itens.some((i: ItemRefeicao) => i.alimento_id === alimentoId)) {
          ref.itens.push(novoItem);
          ref.total_itens = ref.itens.length;
        }

        await this.localDb.saveRefeicao(ref);
        await this.localDb.addToSyncQueue('adicionar_item', { refeicaoId, alimentoId });

        return ref;
      })
    );
  }

  removerItem(refeicaoId: number, alimentoId: number): Observable<Refeicao> {
    return this.comFallbackLocal(
      navigator.onLine && refeicaoId > 0,
      () => this.api.delete<Refeicao>(`/api/refeicoes/${refeicaoId}/itens/${alimentoId}`),
      (ref) => this.localDb.saveRefeicao(ref),
      () => this.removerItemLocal(refeicaoId, alimentoId),
      'Falha ao remover item online, salvando localmente:'
    );
  }

  private removerItemLocal(refeicaoId: number, alimentoId: number): Observable<Refeicao> {
    return from(
      this.localDb.getRefeicao(refeicaoId).then(async (ref) => {
        if (!ref) throw new Error('Refeição não encontrada');
        ref.itens = ref.itens || [];
        ref.itens = ref.itens.filter((i: ItemRefeicao) => i.alimento_id !== alimentoId);
        ref.total_itens = ref.itens.length;

        await this.localDb.saveRefeicao(ref);
        await this.localDb.addToSyncQueue('remover_item', { refeicaoId, alimentoId });

        return ref;
      })
    );
  }
}
