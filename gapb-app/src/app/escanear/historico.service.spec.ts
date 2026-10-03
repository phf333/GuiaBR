import { firstValueFrom, of, throwError } from 'rxjs';
import { HistoricoService } from './historico.service';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { ProdutoEscaneado } from '../shared/models';

describe('HistoricoService', () => {
  let service: HistoricoService;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let localDbSpy: jasmine.SpyObj<LocalDbService>;

  const CHAVE_CACHE = 'historico_scanner';

  function produto(over: Partial<ProdutoEscaneado> = {}): ProdutoEscaneado {
    return {
      codigo_barras: '789',
      nome: 'Produto',
      marca: null,
      quantidade: null,
      nova_group: 1,
      classificacao_guia: 'in natura',
      imagem_url: null,
      ...over,
    };
  }

  function setOnline(valor: boolean) {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(valor);
  }

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'delete']);
    localDbSpy = jasmine.createSpyObj('LocalDbService', ['getCache', 'setCache', 'addToSyncQueue']);
    localDbSpy.getCache.and.resolveTo(null);
    localDbSpy.setCache.and.resolveTo();
    localDbSpy.addToSyncQueue.and.resolveTo();
    service = new HistoricoService(apiSpy, localDbSpy);
  });

  describe('carregar', () => {
    it('online: deve publicar a lista do servidor e guarda-la localmente', async () => {
      setOnline(true);
      const doServidor = [produto({ nome: 'Servidor' })];
      localDbSpy.getCache.and.resolveTo([produto({ nome: 'Local' })]);
      apiSpy.get.and.returnValue(of(doServidor));

      await service.carregar();

      expect(apiSpy.get).toHaveBeenCalledWith('/api/alimentos/historico');
      expect(service.historico$.value).toEqual(doServidor);
      expect(localDbSpy.setCache).toHaveBeenCalledWith(CHAVE_CACHE, doServidor);
    });

    it('online com erro: deve manter a copia local', async () => {
      setOnline(true);
      const local = [produto({ nome: 'Local' })];
      localDbSpy.getCache.and.resolveTo(local);
      apiSpy.get.and.returnValue(throwError(() => new Error('falha')));
      spyOn(console, 'warn');

      await service.carregar();

      expect(service.historico$.value).toEqual(local);
    });

    it('offline: deve publicar a copia local sem chamar a API', async () => {
      setOnline(false);
      const local = [produto({ nome: 'Local' })];
      localDbSpy.getCache.and.resolveTo(local);

      await service.carregar();

      expect(apiSpy.get).not.toHaveBeenCalled();
      expect(service.historico$.value).toEqual(local);
    });

    it('sem copia local: deve publicar lista vazia', async () => {
      setOnline(false);

      await service.carregar();

      expect(service.historico$.value).toEqual([]);
    });
  });

  describe('buscar', () => {
    it('deve consultar o backend e colocar o produto no topo do historico', async () => {
      service.historico$.next([produto({ codigo_barras: '111' })]);
      const novo = produto({ codigo_barras: '222', nome: 'Novo' });
      apiSpy.get.and.returnValue(of(novo));

      const res = await firstValueFrom(service.buscar('222'));

      expect(apiSpy.get).toHaveBeenCalledWith('/api/alimentos/busca', { codigo: '222' });
      expect(res).toEqual(novo);
      expect(service.historico$.value.map((p) => p.codigo_barras)).toEqual(['222', '111']);
      expect(localDbSpy.setCache).toHaveBeenCalledWith(CHAVE_CACHE, service.historico$.value);
    });

    it('deve substituir a entrada existente do mesmo codigo de barras', async () => {
      service.historico$.next([produto({ codigo_barras: '222', nome: 'Antigo' })]);
      apiSpy.get.and.returnValue(of(produto({ codigo_barras: '222', nome: 'Novo' })));

      await firstValueFrom(service.buscar('222'));

      expect(service.historico$.value.map((p) => p.nome)).toEqual(['Novo']);
    });

    it('deve manter no maximo 20 itens', async () => {
      service.historico$.next(Array.from({ length: 20 }, (_, i) => produto({ codigo_barras: `c${i}` })));
      apiSpy.get.and.returnValue(of(produto({ codigo_barras: '222' })));

      await firstValueFrom(service.buscar('222'));

      expect(service.historico$.value.length).toBe(20);
      expect(service.historico$.value[0].codigo_barras).toBe('222');
    });

    it('nao deve alterar o historico quando a busca falha', async () => {
      const antes = [produto({ codigo_barras: '111' })];
      service.historico$.next(antes);
      apiSpy.get.and.returnValue(throwError(() => ({ status: 404 })));

      await expectAsync(firstValueFrom(service.buscar('222'))).toBeRejected();

      expect(service.historico$.value).toEqual(antes);
    });
  });

  describe('excluir', () => {
    beforeEach(() => {
      service.historico$.next([produto({ codigo_barras: '111' }), produto({ codigo_barras: '222' })]);
    });

    it('online: deve remover da lista e chamar a API', async () => {
      setOnline(true);
      apiSpy.delete.and.returnValue(of({}));

      await firstValueFrom(service.excluir('111'));

      expect(service.historico$.value.map((p) => p.codigo_barras)).toEqual(['222']);
      expect(apiSpy.delete).toHaveBeenCalledWith('/api/alimentos/historico/111');
      expect(localDbSpy.addToSyncQueue).not.toHaveBeenCalled();
    });

    it('offline: deve remover da lista e enfileirar a exclusao', async () => {
      setOnline(false);

      await firstValueFrom(service.excluir('111'), { defaultValue: undefined });

      expect(service.historico$.value.map((p) => p.codigo_barras)).toEqual(['222']);
      expect(apiSpy.delete).not.toHaveBeenCalled();
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('deletar_historico', { barcode: '111' });
    });

    it('online com erro: deve enfileirar a exclusao para tentar depois', async () => {
      setOnline(true);
      apiSpy.delete.and.returnValue(throwError(() => new Error('falha')));
      spyOn(console, 'warn');

      await firstValueFrom(service.excluir('111'), { defaultValue: undefined });

      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('deletar_historico', { barcode: '111' });
    });
  });
});
