import { of, throwError } from 'rxjs';
import { GuiaService, Capitulo } from './guia.service';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { CAPITULOS_DEFAULT } from './data/capitulos.data';

describe('GuiaService', () => {
  let apiSpy: jasmine.SpyObj<ApiService>;
  let localDbSpy: jasmine.SpyObj<LocalDbService>;

  const STORAGE_KEY = 'guiabr_guia_progresso';
  const ULTIMO_CARD_KEY = 'guiabr_guia_ultimo_card';

  beforeEach(() => {
    localStorage.clear();
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    localDbSpy = jasmine.createSpyObj('LocalDbService', ['getSyncQueue', 'addToSyncQueue', 'removeFromSyncQueue']);
    localDbSpy.getSyncQueue.and.resolveTo([]);
    localDbSpy.addToSyncQueue.and.resolveTo();
    localDbSpy.removeFromSyncQueue.and.resolveTo();
  });

  afterEach(() => localStorage.clear());

  /** Aguarda os microtasks disparados pelo carregamento assíncrono de pendentes de sincronização. */
  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  /** Cria o serviço já com o retorno de /api/capitulos configurado no construtor. */
  async function criar(getProgresso = of([] as any[])): Promise<GuiaService> {
    apiSpy.get.and.returnValue(getProgresso);
    const service = new GuiaService(apiSpy, localDbSpy);
    await flush();
    return service;
  }

  describe('carregarProgresso (construtor)', () => {
    it('deve mesclar o progresso do backend e salvar localmente', async () => {
      const service = await criar(of([{ numero: 1, status: 'done' }]));

      const capitulos = service.capitulosAtuais;
      expect(capitulos.length).toBe(CAPITULOS_DEFAULT.length);
      expect(capitulos.find((c) => c.numero === 1)!.status).toBe('done');
      expect(localStorage.getItem(STORAGE_KEY)).toBe(
        JSON.stringify([{ numero: 1, status: 'done' }]),
      );
    });

    it('deve usar o backup local quando o backend falha', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ numero: 2, status: 'done' }]));
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

      expect(service.capitulosAtuais.find((c) => c.numero === 1)!.status).toBe('done');
      const salvo = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(salvo.find((c: Capitulo) => c.numero === 1).status).toBe('done');
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('concluir_capitulo', { numero: 1 });
    });

    it('deve marcar como done localmente e enfileirar quando ja esta offline (sem tentar a rede)', async () => {
      spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
      const service = await criar();

      service.concluirCapitulo(1);

      expect(apiSpy.post).not.toHaveBeenCalled();
      expect(service.capitulosAtuais.find((c) => c.numero === 1)!.status).toBe('done');
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('concluir_capitulo', { numero: 1 });
    });

    it('nao deve enfileirar novamente um capitulo que ja esta done', async () => {
      const service = await criar(of([{ numero: 1, status: 'done' }]));
      apiSpy.post.and.returnValue(throwError(() => new Error('offline')));

      service.concluirCapitulo(1);

      expect(localDbSpy.addToSyncQueue).not.toHaveBeenCalled();
    });
  });

  describe('resetarProgresso', () => {
    it('deve limpar o registro do ultimo card lido', async () => {
      localStorage.setItem(ULTIMO_CARD_KEY, JSON.stringify({ 1: 3 }));
      const service = await criar();
      apiSpy.post.and.returnValue(of([]));

      service.resetarProgresso();

      expect(localStorage.getItem(ULTIMO_CARD_KEY)).toBeNull();
    });

    it('deve resetar para os defaults e enfileirar quando o backend falha', async () => {
      const service = await criar();
      apiSpy.post.and.returnValue(throwError(() => new Error('offline')));

      service.resetarProgresso();

      expect(service.capitulosAtuais.every((c) => c.status === 'active')).toBeTrue();
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('resetar_progresso', {});
    });

    it('deve remover tarefas concluir_capitulo pendentes ao resetar', async () => {
      const service = await criar();
      apiSpy.post.and.returnValue(throwError(() => new Error('offline')));
      localDbSpy.getSyncQueue.and.resolveTo([
        { id: 5, action: 'concluir_capitulo', payload: { numero: 1 }, timestamp: 1 },
        { id: 6, action: 'adicionar_item', payload: {}, timestamp: 1 },
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
  });
});
