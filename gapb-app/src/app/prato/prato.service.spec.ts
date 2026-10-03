import { firstValueFrom, of, throwError } from 'rxjs';
import { PratoService } from './prato.service';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { Alimento, Refeicao } from '../shared/models';

describe('PratoService', () => {
  let service: PratoService;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let localDbSpy: jasmine.SpyObj<LocalDbService>;

  const refeicao: Refeicao = {
    id: 1,
    nome_refeicao: 'Almoço',
    tipo_refeicao: 'almoco',
    data_criacao: '2024-01-01T00:00:00Z',
    total_itens: 0,
    itens: [],
  };

  const alimento: Alimento = {
    id: 10,
    nome: 'Arroz',
    grupo: 'Cereais',
    classificacao_guia: 'in natura',
    categoria_guia: 'base',
    sazonalidade_atual: null,
  };

  function setOnline(valor: boolean) {
    spyOnProperty(navigator, 'onLine', 'get').and.returnValue(valor);
  }

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    localDbSpy = jasmine.createSpyObj('LocalDbService', [
      'saveRefeicoes',
      'getRefeicoes',
      'getRefeicao',
      'saveRefeicao',
      'deleteRefeicao',
      'getAlimento',
      'addToSyncQueue',
    ]);
    // Defaults resolvidos para os métodos usados nas ramificações locais
    localDbSpy.saveRefeicao.and.resolveTo();
    localDbSpy.deleteRefeicao.and.resolveTo();
    localDbSpy.addToSyncQueue.and.resolveTo();
    localDbSpy.saveRefeicoes.and.resolveTo();

    service = new PratoService(apiSpy, localDbSpy);
  });

  describe('listar', () => {
    it('online: deve buscar da API e cachear localmente', async () => {
      setOnline(true);
      apiSpy.get.and.returnValue(of([refeicao]));

      const res = await firstValueFrom(service.listar());

      expect(apiSpy.get).toHaveBeenCalledWith('/api/refeicoes');
      expect(localDbSpy.saveRefeicoes).toHaveBeenCalledWith([refeicao]);
      expect(res).toEqual([refeicao]);
    });

    it('online com erro: deve cair para o cache local', async () => {
      setOnline(true);
      apiSpy.get.and.returnValue(throwError(() => new Error('falha')));
      localDbSpy.getRefeicoes.and.resolveTo([refeicao]);

      const res = await firstValueFrom(service.listar());

      expect(res).toEqual([refeicao]);
    });

    it('offline: deve ler diretamente do cache local', async () => {
      setOnline(false);
      localDbSpy.getRefeicoes.and.resolveTo([refeicao]);

      const res = await firstValueFrom(service.listar());

      expect(apiSpy.get).not.toHaveBeenCalled();
      expect(res).toEqual([refeicao]);
    });
  });

  describe('obter', () => {
    it('online com id valido: deve buscar da API e cachear', async () => {
      setOnline(true);
      apiSpy.get.and.returnValue(of(refeicao));

      const res = await firstValueFrom(service.obter(1));

      expect(apiSpy.get).toHaveBeenCalledWith('/api/refeicoes/1');
      expect(localDbSpy.saveRefeicao).toHaveBeenCalledWith(refeicao);
      expect(res).toEqual(refeicao);
    });

    it('online com erro: deve ler do cache local', async () => {
      setOnline(true);
      apiSpy.get.and.returnValue(throwError(() => new Error('falha')));
      localDbSpy.getRefeicao.and.resolveTo(refeicao);

      const res = await firstValueFrom(service.obter(1));
      expect(res).toEqual(refeicao);
    });

    it('offline: deve ler do cache local', async () => {
      setOnline(false);
      localDbSpy.getRefeicao.and.resolveTo(refeicao);

      const res = await firstValueFrom(service.obter(1));
      expect(apiSpy.get).not.toHaveBeenCalled();
      expect(res).toEqual(refeicao);
    });

    it('offline sem cache: deve lançar erro', async () => {
      setOnline(false);
      localDbSpy.getRefeicao.and.resolveTo(null);

      await expectAsync(firstValueFrom(service.obter(1))).toBeRejectedWithError(
        'Refeição não encontrada no cache local',
      );
    });
  });

  describe('criar', () => {
    it('online: deve postar na API e cachear', async () => {
      setOnline(true);
      apiSpy.post.and.returnValue(of(refeicao));

      const res = await firstValueFrom(service.criar('Almoço', 'almoco'));

      expect(apiSpy.post).toHaveBeenCalledWith('/api/refeicoes', {
        nome_refeicao: 'Almoço',
        tipo_refeicao: 'almoco',
      });
      expect(res).toEqual(refeicao);
    });

    it('offline: deve criar refeicao local com id temporario negativo e enfileirar sync', async () => {
      setOnline(false);

      const res = await firstValueFrom(service.criar('Janta', 'jantar'));

      expect(res.id).toBeLessThan(0);
      expect(res.nome_refeicao).toBe('Janta');
      expect(localDbSpy.saveRefeicao).toHaveBeenCalled();
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith(
        'criar_refeicao',
        jasmine.objectContaining({ nome_refeicao: 'Janta', tipo_refeicao: 'jantar' }),
      );
    });

    it('online com erro: deve criar localmente como fallback', async () => {
      setOnline(true);
      apiSpy.post.and.returnValue(throwError(() => new Error('falha')));

      const res = await firstValueFrom(service.criar('Janta', 'jantar'));

      expect(res.id).toBeLessThan(0);
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalled();
    });
  });

  describe('deletar', () => {
    it('online com id valido: deve deletar na API e no cache', async () => {
      setOnline(true);
      apiSpy.delete.and.returnValue(of({}));

      await firstValueFrom(service.deletar(1));

      expect(apiSpy.delete).toHaveBeenCalledWith('/api/refeicoes/1');
      expect(localDbSpy.deleteRefeicao).toHaveBeenCalledWith(1);
    });

    it('offline (id temporario): deve deletar local e enfileirar sync', async () => {
      setOnline(false);

      await firstValueFrom(service.deletar(-123));

      expect(apiSpy.delete).not.toHaveBeenCalled();
      expect(localDbSpy.deleteRefeicao).toHaveBeenCalledWith(-123);
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('deletar_refeicao', { id: -123 });
    });
  });

  describe('adicionarItem', () => {
    it('online: deve postar o item e cachear a refeicao retornada', async () => {
      setOnline(true);
      apiSpy.post.and.returnValue(of(refeicao));

      const res = await firstValueFrom(service.adicionarItem(1, 10));

      expect(apiSpy.post).toHaveBeenCalledWith('/api/refeicoes/1/itens', { alimento_id: 10 });
      expect(res).toEqual(refeicao);
    });

    it('offline: deve montar o item a partir do cache local e enfileirar sync', async () => {
      setOnline(false);
      localDbSpy.getRefeicao.and.resolveTo({ ...refeicao, itens: [] });
      localDbSpy.getAlimento.and.resolveTo(alimento);

      const res = await firstValueFrom(service.adicionarItem(1, 10));

      expect(res.itens!.length).toBe(1);
      expect(res.itens![0].alimento_id).toBe(10);
      expect(res.total_itens).toBe(1);
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('adicionar_item', {
        refeicaoId: 1,
        alimentoId: 10,
      });
    });

    it('offline: nao deve duplicar item ja existente', async () => {
      setOnline(false);
      localDbSpy.getRefeicao.and.resolveTo({
        ...refeicao,
        itens: [{ alimento_id: 10, nome: 'Arroz', grupo: 'Cereais', classificacao_guia: 'in natura', categoria_guia: '', sazonalidade_atual: null }],
      });
      localDbSpy.getAlimento.and.resolveTo(alimento);

      const res = await firstValueFrom(service.adicionarItem(1, 10));

      expect(res.itens!.length).toBe(1);
    });

    it('offline: deve lançar erro quando o alimento nao esta no cache', async () => {
      setOnline(false);
      localDbSpy.getRefeicao.and.resolveTo({ ...refeicao, itens: [] });
      localDbSpy.getAlimento.and.resolveTo(null);

      await expectAsync(firstValueFrom(service.adicionarItem(1, 10))).toBeRejectedWithError(
        'Alimento não encontrado no cache local',
      );
    });
  });

  describe('removerItem', () => {
    it('online: deve deletar o item via API', async () => {
      setOnline(true);
      apiSpy.delete.and.returnValue(of(refeicao));

      const res = await firstValueFrom(service.removerItem(1, 10));

      expect(apiSpy.delete).toHaveBeenCalledWith('/api/refeicoes/1/itens/10');
      expect(res).toEqual(refeicao);
    });

    it('offline: deve remover o item do cache e enfileirar sync', async () => {
      setOnline(false);
      localDbSpy.getRefeicao.and.resolveTo({
        ...refeicao,
        itens: [{ alimento_id: 10, nome: 'Arroz', grupo: 'Cereais', classificacao_guia: 'in natura', categoria_guia: '', sazonalidade_atual: null }],
        total_itens: 1,
      });

      const res = await firstValueFrom(service.removerItem(1, 10));

      expect(res.itens!.length).toBe(0);
      expect(res.total_itens).toBe(0);
      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('remover_item', {
        refeicaoId: 1,
        alimentoId: 10,
      });
    });
  });
});
