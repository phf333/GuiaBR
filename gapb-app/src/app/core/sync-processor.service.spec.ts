import { of, throwError, BehaviorSubject } from 'rxjs';
import { SyncProcessorService } from './sync-processor.service';
import { LocalDbService } from './local-db.service';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

describe('SyncProcessorService', () => {
  let localDbSpy: jasmine.SpyObj<LocalDbService>;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let authMock: { usuarioAtual$: BehaviorSubject<any> };
  let instanciasCriadas: SyncProcessorService[];

  function setOnline(valor: boolean) {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(valor);
  }

  /** Instancia o serviço; o construtor assina usuarioAtual$ (emite null inicialmente). */
  function criar(): SyncProcessorService {
    const service = new SyncProcessorService(
      localDbSpy as unknown as LocalDbService,
      apiSpy as unknown as ApiService,
      authMock as unknown as AuthService,
    );
    instanciasCriadas.push(service);
    return service;
  }

  beforeEach(() => {
    localStorage.clear();
    instanciasCriadas = [];
    localDbSpy = jasmine.createSpyObj('LocalDbService', [
      'getSyncQueue',
      'removeFromSyncQueue',
      'deleteRefeicao',
      'saveRefeicao',
      'saveRefeicoes',
      'saveAlimentos',
      'searchAlimentos',
    ]);
    localDbSpy.removeFromSyncQueue.and.resolveTo();
    localDbSpy.deleteRefeicao.and.resolveTo();
    localDbSpy.saveRefeicao.and.resolveTo();
    localDbSpy.saveRefeicoes.and.resolveTo();

    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    authMock = { usuarioAtual$: new BehaviorSubject<any>(null) };
  });

  afterEach(() => {
    instanciasCriadas.forEach(s => s.ngOnDestroy());
    localStorage.clear();
  });

  describe('processQueue', () => {
    it('deve retornar cedo quando a fila esta vazia', async () => {
      setOnline(true);
      localDbSpy.getSyncQueue.and.resolveTo([]);
      const service = criar();

      await service.processQueue();

      expect(apiSpy.post).not.toHaveBeenCalled();
    });

    it('nao deve reprocessar quando ja esta sincronizando', async () => {
      const service = criar();
      (service as any).syncing = true;

      await service.processQueue();

      expect(localDbSpy.getSyncQueue).not.toHaveBeenCalled();
    });

    it('deve sincronizar uma tarefa criar_refeicao e removê-la da fila', async () => {
      setOnline(true);
      const queue = [
        { id: 1, action: 'criar_refeicao', payload: { nome_refeicao: 'X', tipo_refeicao: 'almoco', tempId: -5 }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve([]));
      apiSpy.post.and.returnValue(of({ id: 100 }));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(apiSpy.post).toHaveBeenCalledWith('/api/refeicoes', {
        nome_refeicao: 'X',
        tipo_refeicao: 'almoco',
      });
      expect(localDbSpy.deleteRefeicao).toHaveBeenCalledWith(-5);
      expect(localDbSpy.saveRefeicao).toHaveBeenCalledWith({ id: 100 } as any);
      expect(localDbSpy.removeFromSyncQueue).toHaveBeenCalledWith(1);
    });

    it('deve interromper a fila em erro de servidor (5xx) sem remover a tarefa', async () => {
      setOnline(true);
      const queue = [
        { id: 1, action: 'deletar_historico', payload: { barcode: '789' }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve(queue));
      apiSpy.delete.and.returnValue(throwError(() => ({ status: 500 })));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(localDbSpy.removeFromSyncQueue).not.toHaveBeenCalled();
    });

    it('deve descartar a tarefa em erro permanente do cliente (4xx)', async () => {
      setOnline(true);
      const queue = [
        { id: 1, action: 'deletar_historico', payload: { barcode: '789' }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve([]));
      apiSpy.delete.and.returnValue(throwError(() => ({ status: 400 })));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(localDbSpy.removeFromSyncQueue).toHaveBeenCalledWith(1);
    });

    it('deve manter a tarefa na fila (sem descartar) em erro 401', async () => {
      setOnline(true);
      const queue = [
        { id: 1, action: 'deletar_historico', payload: { barcode: '789' }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve(queue));
      apiSpy.delete.and.returnValue(throwError(() => ({ status: 401 })));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(localDbSpy.removeFromSyncQueue).not.toHaveBeenCalled();
    });

    it('deve sincronizar a acao concluir_capitulo', async () => {
      setOnline(true);
      const queue = [
        { id: 7, action: 'concluir_capitulo', payload: { numero: 3 }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve([]));
      apiSpy.post.and.returnValue(of([{ numero: 3, status: 'done' }]));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(apiSpy.post).toHaveBeenCalledWith('/api/capitulos/3/concluir', {});
      expect(localDbSpy.removeFromSyncQueue).toHaveBeenCalledWith(7);
    });

    it('deve sincronizar a acao resetar_progresso', async () => {
      setOnline(true);
      const queue = [
        { id: 8, action: 'resetar_progresso', payload: {}, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve([]));
      apiSpy.post.and.returnValue(of([]));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(apiSpy.post).toHaveBeenCalledWith('/api/capitulos/reset', {});
      expect(localDbSpy.removeFromSyncQueue).toHaveBeenCalledWith(8);
    });

    it('deve resolver ids temporarios pelo tempIdMap salvo ao deletar uma refeicao', async () => {
      setOnline(true);
      localStorage.setItem('guiabr_temp_id_map', JSON.stringify({ '-5': 100 }));
      const queue = [
        { id: 2, action: 'deletar_refeicao', payload: { id: -5 }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve([]));
      apiSpy.delete.and.returnValue(of({}));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(apiSpy.delete).toHaveBeenCalledWith('/api/refeicoes/100');
      expect(localDbSpy.deleteRefeicao).toHaveBeenCalledWith(-5);
      expect(localDbSpy.removeFromSyncQueue).toHaveBeenCalledWith(2);
    });

    it('deve sincronizar a acao adicionar_item', async () => {
      setOnline(true);
      const queue = [
        { id: 3, action: 'adicionar_item', payload: { refeicaoId: 1, alimentoId: 10 }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve([]));
      apiSpy.post.and.returnValue(of({ id: 1, itens: [] }));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(apiSpy.post).toHaveBeenCalledWith('/api/refeicoes/1/itens', { alimento_id: 10 });
      expect(localDbSpy.saveRefeicao).toHaveBeenCalledWith({ id: 1, itens: [] } as any);
    });

    it('deve sincronizar a acao remover_item', async () => {
      setOnline(true);
      const queue = [
        { id: 4, action: 'remover_item', payload: { refeicaoId: 1, alimentoId: 10 }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve([]));
      apiSpy.delete.and.returnValue(of({ id: 1, itens: [] }));
      apiSpy.get.and.returnValue(of([]));
      const service = criar();

      await service.processQueue();

      expect(apiSpy.delete).toHaveBeenCalledWith('/api/refeicoes/1/itens/10');
      expect(localDbSpy.saveRefeicao).toHaveBeenCalledWith({ id: 1, itens: [] } as any);
    });

    it('deve ignorar erro ao atualizar a lista de refeicoes ao final do processamento', async () => {
      setOnline(true);
      const queue = [
        { id: 1, action: 'criar_refeicao', payload: { nome_refeicao: 'X', tipo_refeicao: 'almoco', tempId: -5 }, timestamp: 1 },
      ];
      localDbSpy.getSyncQueue.and.returnValues(Promise.resolve(queue), Promise.resolve([]));
      apiSpy.post.and.returnValue(of({ id: 100 }));
      apiSpy.get.and.returnValue(throwError(() => new Error('falha ao atualizar')));
      const service = criar();

      await expectAsync(service.processQueue()).toBeResolved();

      expect(localDbSpy.saveRefeicoes).not.toHaveBeenCalled();
    });
  });

  describe('constructor - assinatura de usuarioAtual$', () => {
    it('deve processar a fila e carregar alimentos quando um usuario loga online', () => {
      setOnline(true);
      const service = criar();
      spyOn(service, 'processQueue');
      spyOn(service, 'carregarAlimentosNoCache');

      authMock.usuarioAtual$.next({ id: 1, nome: 'Ana', email: 'a@x.com' });

      expect(service.processQueue).toHaveBeenCalled();
      expect(service.carregarAlimentosNoCache).toHaveBeenCalled();
    });

    it('nao deve fazer nada quando nao ha usuario logado', () => {
      setOnline(true);
      const service = criar();
      spyOn(service, 'processQueue');

      authMock.usuarioAtual$.next(null);

      expect(service.processQueue).not.toHaveBeenCalled();
    });
  });

  describe('carregarAlimentosNoCache', () => {
    it('deve baixar a base sempre que estiver online', async () => {
      setOnline(true);
      apiSpy.get.and.returnValue(of([{ id: 1 }, { id: 2 }]));
      const service = criar();

      await service.carregarAlimentosNoCache();

      expect(apiSpy.get).toHaveBeenCalledWith('/api/alimentos/todos');
      expect(localDbSpy.saveAlimentos).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }] as any);
    });

    it('nao deve baixar quando esta offline', async () => {
      setOnline(false);
      const service = criar();

      await service.carregarAlimentosNoCache();

      expect(apiSpy.get).not.toHaveBeenCalled();
    });

    it('deve logar erro quando o download da base falhar', async () => {
      setOnline(true);
      apiSpy.get.and.returnValue(throwError(() => new Error('falha de rede')));
      const service = criar();
      spyOn(console, 'error');

      await service.carregarAlimentosNoCache();

      expect(console.error).toHaveBeenCalledWith('Erro ao baixar base de alimentos:', jasmine.any(Error));
    });
  });
});
