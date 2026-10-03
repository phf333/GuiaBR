import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { comFallbackLocal } from '../core/offline';
import { TipoRefeicao, Refeicao } from '../shared/models';


@Injectable({ providedIn: 'root' })
export class PratoService {
  constructor(private api: ApiService, private localDb: LocalDbService) {}

  listar(): Observable<Refeicao[]> {
    return comFallbackLocal(
      navigator.onLine,
      () => this.api.get<Refeicao[]>('/api/refeicoes').pipe(tap(refeicoes => this.localDb.saveRefeicoes(refeicoes))),
      () => this.localDb.getRefeicoes(),
      'Falha ao obter refeições da rede, lendo cache local:'
    );
  }

  obter(id: number): Observable<Refeicao> {
    return comFallbackLocal(
      navigator.onLine && id > 0,
      () => this.api.get<Refeicao>(`/api/refeicoes/${id}`).pipe(tap(ref => this.localDb.saveRefeicao(ref))),
      () => this.obterLocal(id),
      `Falha ao obter refeição ${id} da rede, lendo cache local:`
    );
  }

  private async obterLocal(id: number): Promise<Refeicao> {
    const ref = await this.localDb.getRefeicao(id);
    if (!ref) throw new Error('Refeição não encontrada no cache local');
    return ref;
  }

  criar(nome: string, tipo: TipoRefeicao): Observable<Refeicao> {
    return comFallbackLocal(
      navigator.onLine,
      () => this.api.post<Refeicao>('/api/refeicoes', { nome_refeicao: nome, tipo_refeicao: tipo })
        .pipe(tap(ref => this.localDb.saveRefeicao(ref))),
      () => this.criarLocal(nome, tipo),
      'Falha ao criar refeição online, salvando localmente:'
    );
  }

  private async criarLocal(nome: string, tipo: TipoRefeicao): Promise<Refeicao> {
    const tempId = -Date.now();
    const tempRefeicao: Refeicao = {
      id: tempId,
      nome_refeicao: nome,
      tipo_refeicao: tipo,
      data_criacao: new Date().toISOString(),
      total_itens: 0,
      itens: []
    };
    await this.localDb.saveRefeicao(tempRefeicao);
    await this.localDb.addToSyncQueue('criar_refeicao', { nome_refeicao: nome, tipo_refeicao: tipo, tempId });
    return tempRefeicao;
  }

  deletar(id: number): Observable<unknown> {
    return comFallbackLocal<unknown>(
      navigator.onLine && id > 0,
      () => this.api.delete(`/api/refeicoes/${id}`).pipe(tap(() => this.localDb.deleteRefeicao(id))),
      () => this.deletarLocal(id),
      'Falha ao deletar refeição online, salvando localmente:'
    );
  }

  private async deletarLocal(id: number): Promise<void> {
    await this.localDb.deleteRefeicao(id);
    await this.localDb.addToSyncQueue('deletar_refeicao', { id });
  }

  adicionarItem(refeicaoId: number, alimentoId: number): Observable<Refeicao> {
    return comFallbackLocal(
      navigator.onLine && refeicaoId > 0,
      () => this.api.post<Refeicao>(`/api/refeicoes/${refeicaoId}/itens`, { alimento_id: alimentoId })
        .pipe(tap(ref => this.localDb.saveRefeicao(ref))),
      () => this.adicionarItemLocal(refeicaoId, alimentoId),
      'Falha ao adicionar item online, salvando localmente:'
    );
  }

  private async adicionarItemLocal(refeicaoId: number, alimentoId: number): Promise<Refeicao> {
    const [ref, al] = await Promise.all([
      this.localDb.getRefeicao(refeicaoId),
      this.localDb.getAlimento(alimentoId)
    ]);
    if (!ref) throw new Error('Refeição não encontrada');
    if (!al) throw new Error('Alimento não encontrado no cache local');

    ref.itens = ref.itens || [];
    if (!ref.itens.some(i => i.alimento_id === alimentoId)) {
      ref.itens.push({
        alimento_id: al.id,
        nome: al.nome,
        grupo: al.grupo,
        classificacao_guia: al.classificacao_guia,
        categoria_guia: al.categoria_guia ?? '',
        sazonalidade_atual: al.sazonalidade_atual
      });
      ref.total_itens = ref.itens.length;
    }

    await this.localDb.saveRefeicao(ref);
    await this.localDb.addToSyncQueue('adicionar_item', { refeicaoId, alimentoId });
    return ref;
  }

  removerItem(refeicaoId: number, alimentoId: number): Observable<Refeicao> {
    return comFallbackLocal(
      navigator.onLine && refeicaoId > 0,
      () => this.api.delete<Refeicao>(`/api/refeicoes/${refeicaoId}/itens/${alimentoId}`)
        .pipe(tap(ref => this.localDb.saveRefeicao(ref))),
      () => this.removerItemLocal(refeicaoId, alimentoId),
      'Falha ao remover item online, salvando localmente:'
    );
  }

  private async removerItemLocal(refeicaoId: number, alimentoId: number): Promise<Refeicao> {
    const ref = await this.localDb.getRefeicao(refeicaoId);
    if (!ref) throw new Error('Refeição não encontrada');
    ref.itens = (ref.itens || []).filter(i => i.alimento_id !== alimentoId);
    ref.total_itens = ref.itens.length;

    await this.localDb.saveRefeicao(ref);
    await this.localDb.addToSyncQueue('remover_item', { refeicaoId, alimentoId });
    return ref;
  }
}
