import { LocalDbService, SyncTask, trocarRefeicaoId } from './local-db.service';
import { Alimento, Refeicao } from '../shared/models';

/**
 * Testes de lógica do LocalDbService com as tabelas do Dexie mockadas
 * (abordagem A). Substituímos `(service as any).db` por um duplo de teste
 * que aplica os predicados em memória, sem tocar o IndexedDB real.
 */
describe('LocalDbService', () => {
  let service: LocalDbService;

  function alimento(over: Partial<Alimento>): Alimento {
    return {
      id: 1,
      nome: 'Arroz',
      grupo: 'Cereais',
      classificacao_guia: 'in natura',
      sazonalidade_atual: null,
      ...over,
    };
  }

  /** Cria um mock da tabela `alimentos` com um dataset fixo. */
  function mockAlimentosTable(dados: Alimento[]) {
    return {
      toCollection: () => ({ toArray: async () => [...dados] }),
      filter: (pred: (a: Alimento) => boolean) => ({
        toArray: async () => dados.filter(pred),
      }),
      get: async (id: number) => dados.find((a) => a.id === id),
    };
  }

  beforeEach(() => {
    service = new LocalDbService();
  });

  describe('searchAlimentos', () => {
    const dataset = [
      alimento({ id: 1, nome: 'Arroz integral', classificacao_guia: 'in natura' }),
      alimento({ id: 2, nome: 'Refrigerante', classificacao_guia: 'ultraprocessado' }),
      alimento({
        id: 3,
        nome: 'Tomate',
        classificacao_guia: 'in natura',
        sazonalidade_atual: { valor: 4, texto: 'Alta', nivel: 'alta' },
      }),
      alimento({
        id: 4,
        nome: 'Manga',
        classificacao_guia: 'in natura',
        sazonalidade_atual: { valor: 1, texto: 'Baixa', nivel: 'baixa' },
      }),
    ];

    beforeEach(() => {
      (service as any).db = { alimentos: mockAlimentosTable(dataset) };
    });

    it('deve retornar todos quando a query for vazia e sem filtros', async () => {
      const res = await service.searchAlimentos('', false);
      expect(res.length).toBe(4);
    });

    it('deve filtrar por nome de forma case-insensitive', async () => {
      const res = await service.searchAlimentos('ARROZ', false);
      expect(res.map((a) => a.id)).toEqual([1]);
    });

    it('deve filtrar apenas itens de safra (valor >= 3) quando soSafra', async () => {
      const res = await service.searchAlimentos('', true);
      expect(res.map((a) => a.id)).toEqual([3]);
    });

    it('deve filtrar por grau de processamento', async () => {
      const res = await service.searchAlimentos('', false, 'ultraprocessado');
      expect(res.map((a) => a.id)).toEqual([2]);
    });

    it('deve combinar filtro de nome e grau de processamento', async () => {
      const res = await service.searchAlimentos('tomate', false, 'in natura');
      expect(res.map((a) => a.id)).toEqual([3]);
    });
  });

  describe('getAlimento', () => {
    beforeEach(() => {
      (service as any).db = {
        alimentos: mockAlimentosTable([alimento({ id: 7, nome: 'Feijão' })]),
      };
    });

    it('deve retornar o alimento existente', async () => {
      expect((await service.getAlimento(7))!.nome).toBe('Feijão');
    });

    it('deve retornar null quando nao existe', async () => {
      expect(await service.getAlimento(999)).toBeNull();
    });
  });

  describe('saveAlimentos', () => {
    it('deve limpar e reinserir todos os alimentos em transacao', async () => {
      const clear = jasmine.createSpy('clear').and.resolveTo();
      const bulkPut = jasmine.createSpy('bulkPut').and.resolveTo();
      const alimentosTable = { clear, bulkPut };
      (service as any).db = {
        alimentos: alimentosTable,
        transaction: (_mode: string, _tbl: any, cb: () => Promise<void>) => cb(),
      };

      const dados = [alimento({ id: 1 }), alimento({ id: 2 })];
      await service.saveAlimentos(dados);

      expect(clear).toHaveBeenCalled();
      expect(bulkPut).toHaveBeenCalledWith(dados);
    });
  });

  describe('saveRefeicoes', () => {
    function refeicao(over: Partial<Refeicao>): Refeicao {
      return {
        id: 1,
        nome_refeicao: 'Almoço',
        tipo_refeicao: 'almoco',
        data_criacao: '2024-01-01',
        total_itens: 0,
        itens: [],
        ...over,
      };
    }

    let bulkPut: jasmine.Spy;
    let bulkDelete: jasmine.Spy;
    let existentes: Refeicao[];

    function montarDb() {
      bulkPut = jasmine.createSpy('bulkPut').and.resolveTo();
      bulkDelete = jasmine.createSpy('bulkDelete').and.resolveTo();
      (service as any).db = {
        refeicoes: {
          toArray: async () => existentes,
          bulkPut,
          bulkDelete,
        },
        transaction: (_mode: string, _tbl: any, cb: () => Promise<void>) => cb(),
      };
    }

    it('deve deletar refeicoes que nao estao mais na lista nova', async () => {
      existentes = [refeicao({ id: 1 }), refeicao({ id: 2 })];
      montarDb();

      await service.saveRefeicoes([refeicao({ id: 1 })]);

      expect(bulkDelete).toHaveBeenCalledWith([2]);
    });

    it('deve preservar itens cacheados quando a nova refeicao vem sem itens', async () => {
      const item = {
        alimento_id: 10,
        nome: 'Arroz',
        grupo: 'Cereais',
        classificacao_guia: 'in natura',
        categoria_guia: '',
        sazonalidade_atual: null,
      };
      existentes = [refeicao({ id: 1, itens: [item], total_itens: 1 })];
      montarDb();

      await service.saveRefeicoes([refeicao({ id: 1, itens: [], total_itens: 0 })]);

      const salvos: Refeicao[] = bulkPut.calls.mostRecent().args[0];
      expect(salvos[0].itens).toEqual([item]);
      expect(salvos[0].total_itens).toBe(1);
    });

    it('nao deve chamar bulkDelete quando nada foi removido', async () => {
      existentes = [refeicao({ id: 1 })];
      montarDb();

      await service.saveRefeicoes([refeicao({ id: 1 })]);

      expect(bulkDelete).not.toHaveBeenCalled();
    });

    it('deve usar o total_itens da nova refeicao quando o cache nao tiver total_itens', async () => {
      const item = {
        alimento_id: 10,
        nome: 'Arroz',
        grupo: 'Cereais',
        classificacao_guia: 'in natura',
        categoria_guia: '',
        sazonalidade_atual: null,
      };
      existentes = [refeicao({ id: 1, itens: [item], total_itens: undefined as any })];
      montarDb();

      await service.saveRefeicoes([refeicao({ id: 1, itens: [], total_itens: 5 })]);

      const salvos: Refeicao[] = bulkPut.calls.mostRecent().args[0];
      expect(salvos[0].total_itens).toBe(5);
    });
  });

  describe('getRefeicoes', () => {
    it('deve retornar todas as refeicoes da tabela', async () => {
      const toArray = jasmine.createSpy('toArray').and.resolveTo([{ id: 1 }]);
      (service as any).db = { refeicoes: { toArray } };

      expect(await service.getRefeicoes()).toEqual([{ id: 1 }] as any);
    });
  });

  describe('getRefeicao', () => {
    it('deve retornar a refeicao quando existe', async () => {
      const get = jasmine.createSpy('get').and.resolveTo({ id: 1 });
      (service as any).db = { refeicoes: { get } };

      expect(await service.getRefeicao(1)).toEqual({ id: 1 } as any);
      expect(get).toHaveBeenCalledWith(1);
    });

    it('deve retornar null quando nao existe', async () => {
      const get = jasmine.createSpy('get').and.resolveTo(undefined);
      (service as any).db = { refeicoes: { get } };

      expect(await service.getRefeicao(1)).toBeNull();
    });
  });

  describe('saveRefeicao', () => {
    it('deve persistir a refeicao na tabela', async () => {
      const put = jasmine.createSpy('put').and.resolveTo();
      (service as any).db = { refeicoes: { put } };
      const ref = { id: 1 } as Refeicao;

      await service.saveRefeicao(ref);

      expect(put).toHaveBeenCalledWith(ref);
    });
  });

  describe('deleteRefeicao', () => {
    it('deve remover a refeicao pelo id', async () => {
      const del = jasmine.createSpy('delete').and.resolveTo();
      (service as any).db = { refeicoes: { delete: del } };

      await service.deleteRefeicao(1);

      expect(del).toHaveBeenCalledWith(1);
    });
  });

  describe('fila de sincronizacao', () => {
    it('addToSyncQueue deve adicionar uma tarefa com timestamp', async () => {
      const add = jasmine.createSpy('add').and.resolveTo();
      (service as any).db = { sync_queue: { add } };

      await service.addToSyncQueue('deletar_refeicao', { id: 1 });

      expect(add).toHaveBeenCalledWith(
        jasmine.objectContaining({ action: 'deletar_refeicao', payload: { id: 1 }, timestamp: jasmine.any(Number) }),
      );
    });

    it('getSyncQueue deve retornar as tarefas pendentes', async () => {
      const fila: SyncTask[] = [{ id: 1, action: 'deletar_refeicao', payload: { id: 2 }, timestamp: 1 }];
      const toArray = jasmine.createSpy('toArray').and.resolveTo(fila);
      (service as any).db = { sync_queue: { toArray } };

      expect(await service.getSyncQueue()).toEqual(fila);
    });

    it('removeFromSyncQueue deve remover a tarefa pelo id', async () => {
      const del = jasmine.createSpy('delete').and.resolveTo();
      (service as any).db = { sync_queue: { delete: del } };

      await service.removeFromSyncQueue(1);

      expect(del).toHaveBeenCalledWith(1);
    });
  });

  describe('trocarRefeicaoId', () => {
    it('deve trocar o id nas tarefas que citam a refeicao temporaria', () => {
      const item: SyncTask = { action: 'adicionar_item', payload: { refeicaoId: -5, alimentoId: 1 }, timestamp: 1 };
      const exclusao: SyncTask = { action: 'deletar_refeicao', payload: { id: -5 }, timestamp: 1 };

      expect(trocarRefeicaoId(item, -5, 100)).toBeTrue();
      expect(trocarRefeicaoId(exclusao, -5, 100)).toBeTrue();

      expect(item.payload).toEqual({ refeicaoId: 100, alimentoId: 1 });
      expect(exclusao.payload).toEqual({ id: 100 });
    });

    it('nao deve alterar tarefas de outra refeicao ou de outro tipo', () => {
      const outra: SyncTask = { action: 'remover_item', payload: { refeicaoId: -9, alimentoId: 1 }, timestamp: 1 };
      const capitulo: SyncTask = { action: 'concluir_capitulo', payload: { numero: -5 }, timestamp: 1 };

      expect(trocarRefeicaoId(outra, -5, 100)).toBeFalse();
      expect(trocarRefeicaoId(capitulo, -5, 100)).toBeFalse();
      expect(capitulo.payload).toEqual({ numero: -5 });
    });

    it('trocarRefeicaoIdNaFila deve aplicar a troca a todas as tarefas salvas', async () => {
      const fila: SyncTask[] = [
        { id: 1, action: 'adicionar_item', payload: { refeicaoId: -5, alimentoId: 1 }, timestamp: 1 },
        { id: 2, action: 'adicionar_item', payload: { refeicaoId: 7, alimentoId: 1 }, timestamp: 1 },
      ];
      (service as any).db = {
        sync_queue: { toCollection: () => ({ modify: async (fn: (t: SyncTask) => void) => fila.forEach(fn) }) },
      };

      await service.trocarRefeicaoIdNaFila(-5, 100);

      expect(fila.map((t) => (t.payload as { refeicaoId: number }).refeicaoId)).toEqual([100, 7]);
    });
  });

  describe('cache', () => {
    it('getCache deve devolver o valor guardado para a chave', async () => {
      (service as any).db = { cache: { get: async (chave: string) => ({ chave, valor: [1, 2] }) } };

      expect(await service.getCache<number[]>('x')).toEqual([1, 2]);
    });

    it('getCache deve devolver null quando a chave nao existe', async () => {
      (service as any).db = { cache: { get: async () => undefined } };

      expect(await service.getCache('x')).toBeNull();
    });

    it('setCache deve gravar o valor sob a chave', async () => {
      const put = jasmine.createSpy('put').and.resolveTo();
      (service as any).db = { cache: { put } };

      await service.setCache('x', [1]);

      expect(put).toHaveBeenCalledWith({ chave: 'x', valor: [1] });
    });
  });

  describe('clearUserData', () => {
    it('deve apagar refeicoes, fila e cache, preservando a base de alimentos', async () => {
      const clearRefeicoes = jasmine.createSpy('clearRefeicoes').and.resolveTo();
      const clearFila = jasmine.createSpy('clearFila').and.resolveTo();
      const clearCache = jasmine.createSpy('clearCache').and.resolveTo();
      const clearAlimentos = jasmine.createSpy('clearAlimentos').and.resolveTo();
      (service as any).db = {
        refeicoes: { clear: clearRefeicoes },
        sync_queue: { clear: clearFila },
        cache: { clear: clearCache },
        alimentos: { clear: clearAlimentos },
      };

      await service.clearUserData();

      expect(clearRefeicoes).toHaveBeenCalled();
      expect(clearFila).toHaveBeenCalled();
      expect(clearCache).toHaveBeenCalled();
      expect(clearAlimentos).not.toHaveBeenCalled();
    });
  });
});
