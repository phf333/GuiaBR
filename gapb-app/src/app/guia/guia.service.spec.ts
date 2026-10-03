import { BehaviorSubject, of, throwError } from 'rxjs';
import { GuiaService, Capitulo } from './guia.service';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { AuthService } from '../core/auth.service';
import { CAPITULOS_DEFAULT } from './data/capitulos.data';

describe('GuiaService', () => {
  let apiSpy: jasmine.SpyObj<ApiService>;
  let localDbSpy: jasmine.SpyObj<LocalDbService>;
  let authMock: { usuarioAtual$: BehaviorSubject<any>; limpezaLocal: Promise<void> };

  const CHAVE_CACHE = 'progresso_guia';

  beforeEach(() => {
    localStorage.clear();
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    localDbSpy = jasmine.createSpyObj('LocalDbService', ['getSyncQueue', 'addToSyncQueue', 'removeFromSyncQueue', 'getCache', 'setCache']);
    localDbSpy.getSyncQueue.and.resolveTo([]);
    localDbSpy.addToSyncQueue.and.resolveTo();
    localDbSpy.removeFromSyncQueue.and.resolveTo();
    localDbSpy.getCache.and.resolveTo(null);
    localDbSpy.setCache.and.resolveTo();
    // Padrão para envios que os testes não inspecionam (ex.: posição agendada).
    apiSpy.post.and.returnValue(of([]));
    authMock = {
      usuarioAtual$: new BehaviorSubject<any>({ id: 1, nome: 'Ana', email: 'ana@x.com' }),
      limpezaLocal: Promise.resolve(),
    };
  });

  afterEach(() => localStorage.clear());

  /** Aguarda os microtasks disparados pelo carregamento assíncrono de pendentes de sincronização. */
  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** Cria o serviço já com o retorno de /api/capitulos configurado no construtor. */
  async function criar(getProgresso = of([] as any[])): Promise<GuiaService> {
    apiSpy.get.and.returnValue(getProgresso);
    const service = new GuiaService(apiSpy, localDbSpy, authMock as unknown as AuthService);
    await flush();
    return service;
  }

  describe('carregarProgresso (construtor)', () => {
    it('deve mesclar o progresso do backend e salvar localmente', async () => {
      const service = await criar(of([{ numero: 1, status: 'done' }]));

      const capitulos = service.capitulosAtuais;
      expect(capitulos.length).toBe(CAPITULOS_DEFAULT.length);
      expect(capitulos.find((c) => c.numero === 1)!.status).toBe('done');
      expect(localDbSpy.setCache).toHaveBeenCalledWith(CHAVE_CACHE, [{ numero: 1, status: 'done' }]);
    });

    it('deve usar o backup local quando o backend falha', async () => {
      localDbSpy.getCache.and.resolveTo([{ numero: 2, status: 'done' }]);
      const service = await criar(throwError(() => new Error('offline')));

      expect(service.capitulosAtuais.find((c) => c.numero === 2)!.status).toBe('done');
    });

    it('deve cair para os defaults quando o backend falha e nao ha backup', async () => {
      const service = await criar(throwError(() => new Error('offline')));

      expect(service.capitulosAtuais.length).toBe(CAPITULOS_DEFAULT.length);
      expect(service.capitulosAtuais.map((c) => c.numero)).toEqual(
        CAPITULOS_DEFAULT.map((c) => c.numero),
      );
    });

    it('deve manter como done um capitulo com sincronizacao pendente mesmo que o backend diga outra coisa', async () => {
      localDbSpy.getSyncQueue.and.resolveTo([
        { id: 1, action: 'concluir_capitulo', payload: { numero: 1 }, timestamp: 1 },
      ]);
      const service = await criar(of([{ numero: 1, status: 'active' }]));

      expect(service.capitulosAtuais.find((c) => c.numero === 1)!.status).toBe('done');
    });
  });

  describe('troca de usuario', () => {
    it('deve esvaziar os capitulos no logout e recarregar quando outro usuario loga', async () => {
      const service = await criar(of([{ numero: 1, status: 'done' }]));
      expect(service.capitulosAtuais.find((c) => c.numero === 1)!.status).toBe('done');

      authMock.usuarioAtual$.next(null);
      expect(service.capitulosAtuais).toEqual([]);

      apiSpy.get.and.returnValue(of([{ numero: 1, status: 'active' }]));
      authMock.usuarioAtual$.next({ id: 2, nome: 'Bia', email: 'bia@x.com' });
      await flush();

      expect(service.capitulosAtuais.find((c) => c.numero === 1)!.status).toBe('active');
    });

    it('nao deve carregar o progresso sem usuario logado', async () => {
      authMock.usuarioAtual$.next(null);
      const service = await criar();

      expect(apiSpy.get).not.toHaveBeenCalled();
      expect(service.capitulosAtuais).toEqual([]);
    });
  });

  describe('concluirCapitulo', () => {
    it('deve atualizar a partir da resposta do backend em caso de sucesso', async () => {
      const service = await criar();
      apiSpy.post.and.returnValue(of([{ numero: 1, status: 'done' }]));

      service.concluirCapitulo(1);

      expect(apiSpy.post).toHaveBeenCalledWith('/api/capitulos/1/concluir', {});
      expect(service.capitulosAtuais.find((c) => c.numero === 1)!.status).toBe('done');
      expect(localDbSpy.addToSyncQueue).not.toHaveBeenCalled();
    });

    it('deve marcar como done localmente e enfileirar para sincronizar quando o backend falha', async () => {
      const service = await criar();
      apiSpy.post.and.returnValue(throwError(() => new Error('offline')));

      service.concluirCapitulo(1);
      await flush();

      expect(service.capitulosAtuais.find((c) => c.numero === 1)!.status).toBe('done');
      const [chave, salvo] = localDbSpy.setCache.calls.mostRecent().args as [string, Capitulo[]];
      expect(chave).toBe(CHAVE_CACHE);
      expect(salvo.find((c) => c.numero === 1)!.status).toBe('done');
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('concluir_capitulo', { numero: 1 });
    });

    it('deve marcar como done localmente e enfileirar quando ja esta offline (sem tentar a rede)', async () => {
      spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
      const service = await criar();

      service.concluirCapitulo(1);
      await flush();

      expect(apiSpy.post).not.toHaveBeenCalled();
      expect(service.capitulosAtuais.find((c) => c.numero === 1)!.status).toBe('done');
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('concluir_capitulo', { numero: 1 });
    });

    it('nao deve enfileirar novamente um capitulo que ja esta done', async () => {
      const service = await criar(of([{ numero: 1, status: 'done' }]));
      apiSpy.post.and.returnValue(throwError(() => new Error('offline')));

      service.concluirCapitulo(1);
      await flush();

      expect(localDbSpy.addToSyncQueue).not.toHaveBeenCalled();
    });
  });

  describe('resetarProgresso', () => {
    it('deve zerar as posicoes de leitura e nao reenviar as que estavam agendadas', async () => {
      const service = await criar();
      service.salvarUltimoCard(1, 3);
      apiSpy.post.calls.reset();
      apiSpy.post.and.returnValue(of([]));

      service.resetarProgresso();
      await flush();
      service.enviarPosicao(1);

      expect(service.obterUltimoCard(1)).toBe(0);
      expect(apiSpy.post).toHaveBeenCalledOnceWith('/api/capitulos/reset', {});
    });

    it('deve remover posicoes pendentes da fila ao resetar', async () => {
      const service = await criar();
      localDbSpy.getSyncQueue.and.resolveTo([
        { id: 7, action: 'salvar_posicao', payload: { numero: 1, ultimo_card: 2 }, timestamp: 1 },
      ]);

      service.resetarProgresso();
      await flush();

      expect(localDbSpy.removeFromSyncQueue).toHaveBeenCalledWith(7);
    });

    it('deve resetar para os defaults e enfileirar quando o backend falha', async () => {
      const service = await criar();
      apiSpy.post.and.returnValue(throwError(() => new Error('offline')));

      service.resetarProgresso();
      await flush();

      expect(service.capitulosAtuais.every((c) => c.status === 'active')).toBeTrue();
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('resetar_progresso', {});
    });

    it('deve remover tarefas concluir_capitulo pendentes ao resetar', async () => {
      const service = await criar();
      apiSpy.post.and.returnValue(throwError(() => new Error('offline')));
      localDbSpy.getSyncQueue.and.resolveTo([
        { id: 5, action: 'concluir_capitulo', payload: { numero: 1 }, timestamp: 1 },
        { id: 6, action: 'adicionar_item', payload: { refeicaoId: 1, alimentoId: 2 }, timestamp: 1 },
      ]);

      service.resetarProgresso();
      await flush();

      expect(localDbSpy.removeFromSyncQueue).toHaveBeenCalledWith(5);
      expect(localDbSpy.removeFromSyncQueue).not.toHaveBeenCalledWith(6);
    });
  });

  describe('salvarUltimoCard / obterUltimoCard', () => {
    it('deve salvar e recuperar o indice do ultimo card por capitulo', async () => {
      const service = await criar();

      service.salvarUltimoCard(2, 4);

      expect(service.obterUltimoCard(2)).toBe(4);
    });

    it('deve retornar 0 quando o capitulo nunca foi visitado', async () => {
      const service = await criar();
      expect(service.obterUltimoCard(99)).toBe(0);
    });

    it('deve preservar os indices ja salvos ao registrar um novo', async () => {
      const service = await criar();
      service.salvarUltimoCard(1, 2);
      service.salvarUltimoCard(3, 5);

      expect(service.obterUltimoCard(1)).toBe(2);
      expect(service.obterUltimoCard(3)).toBe(5);
    });

    it('deve usar a posicao vinda do servidor', async () => {
      const service = await criar(of([{ numero: 2, status: 'active', ultimo_card: 3 }]));

      expect(service.obterUltimoCard(2)).toBe(3);
    });

    it('deve guardar a posicao na copia local para uso offline', async () => {
      const service = await criar();

      service.salvarUltimoCard(2, 4);

      const [chave, salvo] = localDbSpy.setCache.calls.mostRecent().args as [string, Capitulo[]];
      expect(chave).toBe(CHAVE_CACHE);
      expect(salvo.find((c) => c.numero === 2)!.ultimo_card).toBe(4);
    });

    it('deve manter a posicao pendente na fila mesmo que o servidor diga outra', async () => {
      localDbSpy.getSyncQueue.and.resolveTo([
        { id: 1, action: 'salvar_posicao', payload: { numero: 2, ultimo_card: 4 }, timestamp: 1 },
      ]);
      const service = await criar(of([{ numero: 2, status: 'active', ultimo_card: 1 }]));

      expect(service.obterUltimoCard(2)).toBe(4);
    });
  });

  describe('enviarPosicao', () => {
    it('online: deve mandar a posicao do capitulo ao servidor', async () => {
      const service = await criar();
      service.salvarUltimoCard(2, 4);

      service.enviarPosicao(2);

      expect(apiSpy.post).toHaveBeenCalledWith('/api/capitulos/2/posicao', { ultimo_card: 4 });
      expect(localDbSpy.addToSyncQueue).not.toHaveBeenCalled();
    });

    it('nao deve mandar nada quando a posicao nao mudou', async () => {
      const service = await criar(of([{ numero: 2, status: 'active', ultimo_card: 4 }]));
      service.salvarUltimoCard(2, 4);

      service.enviarPosicao(2);

      expect(apiSpy.post).not.toHaveBeenCalled();
    });

    it('nao deve mandar duas vezes a mesma mudanca', async () => {
      const service = await criar();
      service.salvarUltimoCard(2, 4);

      service.enviarPosicao(2);
      service.enviarPosicao(2);

      expect(apiSpy.post).toHaveBeenCalledTimes(1);
    });

    it('offline: deve enfileirar a posicao, substituindo a que ja estava na fila', async () => {
      spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
      const service = await criar();
      localDbSpy.getSyncQueue.and.resolveTo([
        { id: 3, action: 'salvar_posicao', payload: { numero: 2, ultimo_card: 1 }, timestamp: 1 },
        { id: 4, action: 'salvar_posicao', payload: { numero: 5, ultimo_card: 1 }, timestamp: 1 },
      ]);
      service.salvarUltimoCard(2, 4);

      service.enviarPosicao(2);
      await flush();

      expect(apiSpy.post).not.toHaveBeenCalled();
      expect(localDbSpy.removeFromSyncQueue).toHaveBeenCalledOnceWith(3);
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('salvar_posicao', { numero: 2, ultimo_card: 4 });
    });

    it('online com erro: deve enfileirar a posicao para tentar depois', async () => {
      const service = await criar();
      service.salvarUltimoCard(2, 4);
      apiSpy.post.and.returnValue(throwError(() => new Error('falha')));
      spyOn(console, 'warn');

      service.enviarPosicao(2);
      await flush();

      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('salvar_posicao', { numero: 2, ultimo_card: 4 });
    });

    it('deve mandar sozinho apos um tempo sem trocar de card', async () => {
      jasmine.clock().install();
      // O debounce do RxJS compara horarios: o relogio falso precisa avancar a data tambem.
      jasmine.clock().mockDate();
      try {
        apiSpy.get.and.returnValue(of([]));
        const service = new GuiaService(apiSpy, localDbSpy, authMock as unknown as AuthService);
        // Carrega os capitulos sem depender do relogio falso.
        (service as any).publicar([]);
        service.salvarUltimoCard(2, 1);
        service.salvarUltimoCard(2, 2);

        jasmine.clock().tick(1999);
        expect(apiSpy.post).not.toHaveBeenCalled();

        jasmine.clock().tick(1);
        expect(apiSpy.post).toHaveBeenCalledOnceWith('/api/capitulos/2/posicao', { ultimo_card: 2 });
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('a resposta de concluir nao deve desfazer uma posicao ainda nao enviada', async () => {
      const service = await criar();
      service.salvarUltimoCard(2, 4);
      apiSpy.post.and.returnValue(of([{ numero: 2, status: 'done', ultimo_card: 0 }]));

      service.concluirCapitulo(2);

      expect(service.capitulosAtuais.find((c) => c.numero === 2)!.status).toBe('done');
      expect(service.obterUltimoCard(2)).toBe(4);
    });
  });
});
