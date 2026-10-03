import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { EscanearComponent } from './pag-escaneamento';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { DialogService } from '../core/dialog.service';
import { ProdutoEscaneado } from '../shared/models';

describe('EscanearComponent', () => {
  let component: EscanearComponent;
  let apiSpy: jasmine.SpyObj<ApiService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let localDbSpy: jasmine.SpyObj<LocalDbService>;
  let dialogSpy: jasmine.SpyObj<DialogService>;

  // 1234567890128 é um EAN-13 com dígito verificador válido (8).
  const BARCODE_VALIDO = '1234567890128';

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

  beforeEach(() => {
    localStorage.clear();
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    localDbSpy = jasmine.createSpyObj('LocalDbService', ['addToSyncQueue']);
    dialogSpy = jasmine.createSpyObj('DialogService', ['alert', 'confirm']);
    component = new EscanearComponent(apiSpy, routerSpy, localDbSpy, dialogSpy);
  });

  afterEach(() => localStorage.clear());

  describe('ngOnInit', () => {
    it('deve carregar do cache local e depois atualizar via carregarHistorico', () => {
      const cache = [produto({ nome: 'Cache' })];
      localStorage.setItem('guiabr_historico_scanner', JSON.stringify(cache));
      apiSpy.get.and.returnValue(of([]));

      component.ngOnInit();

      expect(component.ultimosEscaneados).toEqual([]); // sobrescrito pela resposta vazia do backend
      expect(apiSpy.get).toHaveBeenCalledWith('/api/alimentos/historico');
    });

    it('deve ignorar cache corrompido e seguir chamando carregarHistorico', () => {
      localStorage.setItem('guiabr_historico_scanner', '{invalido');
      apiSpy.get.and.returnValue(of([]));

      expect(() => component.ngOnInit()).not.toThrow();
      expect(apiSpy.get).toHaveBeenCalledWith('/api/alimentos/historico');
    });

    it('deve chamar carregarHistorico mesmo sem cache previo', () => {
      apiSpy.get.and.returnValue(of([]));

      component.ngOnInit();

      expect(apiSpy.get).toHaveBeenCalledWith('/api/alimentos/historico');
    });
  });

  describe('isValidBarcode', () => {
    it('deve aceitar um EAN-13 com digito verificador correto', () => {
      expect(component.isValidBarcode(BARCODE_VALIDO)).toBeTrue();
    });

    it('deve rejeitar quando o digito verificador esta errado', () => {
      expect(component.isValidBarcode('1234567890127')).toBeFalse();
    });

    it('deve rejeitar codigos com caracteres nao numericos', () => {
      expect(component.isValidBarcode('12345abc90128')).toBeFalse();
    });

    it('deve rejeitar codigos com comprimento invalido', () => {
      expect(component.isValidBarcode('12345')).toBeFalse();
    });

    it('deve rejeitar string vazia', () => {
      expect(component.isValidBarcode('')).toBeFalse();
    });
  });

  describe('onClick', () => {
    it('deve exibir o scanner', () => {
      component.onClick();
      expect(component.showScanner).toBeTrue();
    });
  });

  describe('carregarHistorico', () => {
    it('deve usar o historico do backend e cachear localmente', () => {
      const historico = [produto({ nome: 'Refri', nova_group: 4, classificacao_guia: 'ultraprocessado' })];
      apiSpy.get.and.returnValue(of(historico));

      component.carregarHistorico();

      expect(component.ultimosEscaneados).toEqual(historico);
      expect(JSON.parse(localStorage.getItem('guiabr_historico_scanner')!)).toEqual(historico);
    });

    it('deve zerar a lista quando o backend retorna vazio', () => {
      apiSpy.get.and.returnValue(of([]));

      component.carregarHistorico();

      expect(component.ultimosEscaneados).toEqual([]);
    });

    it('deve ler do cache local quando o backend falha', () => {
      const cache = [produto({ nome: 'Cache' })];
      localStorage.setItem('guiabr_historico_scanner', JSON.stringify(cache));
      apiSpy.get.and.returnValue(throwError(() => new Error('offline')));

      component.carregarHistorico();

      expect(component.ultimosEscaneados[0].nome).toBe('Cache');
    });

    it('deve logar erro quando o cache local estiver corrompido e o backend falhar', () => {
      localStorage.setItem('guiabr_historico_scanner', '{invalido');
      apiSpy.get.and.returnValue(throwError(() => new Error('offline')));
      spyOn(console, 'error');

      component.carregarHistorico();

      expect(console.error).toHaveBeenCalledWith(
        'Erro ao fazer parse do histórico cacheado:',
        jasmine.any(Error),
      );
    });
  });

  describe('handleScanSuccess', () => {
    it('deve ignorar codigos invalidos', () => {
      component.handleScanSuccess('0000');
      expect(apiSpy.get).not.toHaveBeenCalled();
    });

    it('deve buscar o produto e navegar para /resultado em caso de sucesso', () => {
      const res = produto({ codigo_barras: BARCODE_VALIDO, nome: 'Bolacha', nova_group: 4 });
      apiSpy.get.and.returnValue(of(res));

      component.handleScanSuccess(BARCODE_VALIDO);

      expect(component.showScanner).toBeFalse();
      expect(component.carregandoDetalhes).toBeFalse();
      expect(apiSpy.get).toHaveBeenCalledWith('/api/alimentos/busca', { codigo: BARCODE_VALIDO });
      expect(component.ultimosEscaneados[0]).toEqual(res);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/resultado'], { state: { produto: res } });
    });

    it('deve alertar sobre erro de conexao quando status 0', () => {
      apiSpy.get.and.returnValue(throwError(() => ({ status: 0 })));

      component.handleScanSuccess(BARCODE_VALIDO);

      expect(component.carregandoDetalhes).toBeFalse();
      expect(dialogSpy.alert).toHaveBeenCalled();
    });

    it('deve alertar produto nao encontrado para outros erros', () => {
      apiSpy.get.and.returnValue(throwError(() => ({ status: 404 })));

      component.handleScanSuccess(BARCODE_VALIDO);

      expect(dialogSpy.alert).toHaveBeenCalledWith(
        'Produto não encontrado ou não cadastrado na base de dados.',
      );
    });

    it('deve manter no maximo 20 itens no historico', () => {
      component.ultimosEscaneados = Array.from({ length: 20 }, (_, i) => produto({ codigo_barras: `c${i}` }));
      apiSpy.get.and.returnValue(of(produto({ codigo_barras: BARCODE_VALIDO })));

      component.handleScanSuccess(BARCODE_VALIDO);

      expect(component.ultimosEscaneados.length).toBe(20);
      expect(component.ultimosEscaneados[0].codigo_barras).toBe(BARCODE_VALIDO);
    });

    it('deve substituir uma entrada existente do mesmo barcode no historico', () => {
      component.ultimosEscaneados = [produto({ codigo_barras: BARCODE_VALIDO, nome: 'Antigo' })];
      apiSpy.get.and.returnValue(of(produto({ codigo_barras: BARCODE_VALIDO, nome: 'Novo' })));

      component.handleScanSuccess(BARCODE_VALIDO);

      expect(component.ultimosEscaneados.length).toBe(1);
      expect(component.ultimosEscaneados[0].nome).toBe('Novo');
    });
  });

  describe('verResultado', () => {
    it('deve navegar para /resultado com o produto, sem consultar o backend', () => {
      const item = produto();

      component.verResultado(item);

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/resultado'], { state: { produto: item } });
      expect(apiSpy.get).not.toHaveBeenCalled();
    });
  });

  describe('excluirHistorico', () => {
    it('nao deve remover nada quando o usuario cancela', async () => {
      dialogSpy.confirm.and.resolveTo(false);
      component.ultimosEscaneados = [produto()];

      await component.excluirHistorico(new Event('click'), component.ultimosEscaneados[0]);

      expect(component.ultimosEscaneados.length).toBe(1);
    });

    it('deve remover o item e chamar a API quando online e confirmado', async () => {
      spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
      dialogSpy.confirm.and.resolveTo(true);
      apiSpy.delete.and.returnValue(of({}));
      const item = produto();
      component.ultimosEscaneados = [item];

      await component.excluirHistorico(new Event('click'), item);

      expect(component.ultimosEscaneados.length).toBe(0);
      expect(apiSpy.delete).toHaveBeenCalledWith('/api/alimentos/historico/789');
    });

    it('deve enfileirar a exclusao quando offline', async () => {
      spyOnProperty(navigator, 'onLine', 'get').and.returnValue(false);
      dialogSpy.confirm.and.resolveTo(true);
      localDbSpy.addToSyncQueue.and.resolveTo();
      const item = produto();
      component.ultimosEscaneados = [item];

      await component.excluirHistorico(new Event('click'), item);

      expect(localDbSpy.addToSyncQueue).toHaveBeenCalledWith('deletar_historico', { barcode: '789' });
      expect(apiSpy.delete).not.toHaveBeenCalled();
    });

    it('deve logar erro quando a exclusao falha no backend', async () => {
      spyOnProperty(navigator, 'onLine', 'get').and.returnValue(true);
      dialogSpy.confirm.and.resolveTo(true);
      apiSpy.delete.and.returnValue(throwError(() => new Error('falha')));
      spyOn(console, 'error');
      const item = produto();
      component.ultimosEscaneados = [item];

      await component.excluirHistorico(new Event('click'), item);

      expect(console.error).toHaveBeenCalledWith(
        'Erro ao excluir item do histórico no backend:',
        jasmine.any(Error),
      );
    });
  });

  describe('navegacao', () => {
    it('voltar deve navegar para a raiz', () => {
      component.voltar();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });

    it('navegarHome deve navegar para a raiz', () => {
      component.navegarHome();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
