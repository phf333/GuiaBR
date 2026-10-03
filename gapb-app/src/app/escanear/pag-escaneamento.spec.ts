import { BehaviorSubject, of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { EscanearComponent } from './pag-escaneamento';
import { HistoricoService } from './historico.service';
import { DialogService } from '../core/dialog.service';
import { ProdutoEscaneado } from '../shared/models';

describe('EscanearComponent', () => {
  let component: EscanearComponent;
  let historicoSpy: jasmine.SpyObj<HistoricoService>;
  let routerSpy: jasmine.SpyObj<Router>;
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
    historicoSpy = jasmine.createSpyObj('HistoricoService', ['carregar', 'buscar', 'excluir'], {
      historico$: new BehaviorSubject<ProdutoEscaneado[]>([]),
    });
    historicoSpy.carregar.and.resolveTo();
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    dialogSpy = jasmine.createSpyObj('DialogService', ['alert', 'confirm']);
    component = new EscanearComponent(historicoSpy, routerSpy, dialogSpy);
  });

  describe('ngOnInit', () => {
    it('deve carregar o historico', () => {
      component.ngOnInit();

      expect(historicoSpy.carregar).toHaveBeenCalled();
    });
  });

  describe('ultimosEscaneados', () => {
    it('deve refletir o historico publicado pelo servico', () => {
      const historico = [produto({ nome: 'Refri' })];

      historicoSpy.historico$.next(historico);

      expect(component.ultimosEscaneados).toEqual(historico);
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

  describe('handleScanSuccess', () => {
    it('deve ignorar codigos invalidos', () => {
      component.handleScanSuccess('0000');
      expect(historicoSpy.buscar).not.toHaveBeenCalled();
    });

    it('deve buscar o produto e navegar para /resultado em caso de sucesso', () => {
      const res = produto({ codigo_barras: BARCODE_VALIDO, nome: 'Bolacha', nova_group: 4 });
      historicoSpy.buscar.and.returnValue(of(res));

      component.handleScanSuccess(BARCODE_VALIDO);

      expect(component.showScanner).toBeFalse();
      expect(component.carregandoDetalhes).toBeFalse();
      expect(historicoSpy.buscar).toHaveBeenCalledWith(BARCODE_VALIDO);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/resultado'], { state: { produto: res } });
    });

    it('deve alertar sobre erro de conexao quando status 0', () => {
      historicoSpy.buscar.and.returnValue(throwError(() => ({ status: 0 })));
      spyOn(console, 'error');

      component.handleScanSuccess(BARCODE_VALIDO);

      expect(component.carregandoDetalhes).toBeFalse();
      expect(dialogSpy.alert).toHaveBeenCalled();
    });

    it('deve alertar produto nao encontrado para outros erros', () => {
      historicoSpy.buscar.and.returnValue(throwError(() => ({ status: 404 })));
      spyOn(console, 'error');

      component.handleScanSuccess(BARCODE_VALIDO);

      expect(dialogSpy.alert).toHaveBeenCalledWith(
        'Produto não encontrado ou não cadastrado na base de dados.',
      );
    });
  });

  describe('verResultado', () => {
    it('deve navegar para /resultado com o produto, sem consultar o backend', () => {
      const item = produto();

      component.verResultado(item);

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/resultado'], { state: { produto: item } });
      expect(historicoSpy.buscar).not.toHaveBeenCalled();
    });
  });

  describe('excluirHistorico', () => {
    it('nao deve remover nada quando o usuario cancela', async () => {
      dialogSpy.confirm.and.resolveTo(false);

      await component.excluirHistorico(new Event('click'), produto());

      expect(historicoSpy.excluir).not.toHaveBeenCalled();
    });

    it('deve excluir o item quando o usuario confirma', async () => {
      dialogSpy.confirm.and.resolveTo(true);
      historicoSpy.excluir.and.returnValue(of({}));

      await component.excluirHistorico(new Event('click'), produto({ codigo_barras: '789' }));

      expect(historicoSpy.excluir).toHaveBeenCalledWith('789');
    });

    it('nao deve propagar o clique para a linha do historico', async () => {
      dialogSpy.confirm.and.resolveTo(false);
      const evento = new Event('click');
      spyOn(evento, 'stopPropagation');

      await component.excluirHistorico(evento, produto());

      expect(evento.stopPropagation).toHaveBeenCalled();
    });

    it('deve logar erro quando a exclusao falha', async () => {
      dialogSpy.confirm.and.resolveTo(true);
      historicoSpy.excluir.and.returnValue(throwError(() => new Error('falha')));
      spyOn(console, 'error');

      await component.excluirHistorico(new Event('click'), produto());

      expect(console.error).toHaveBeenCalledWith('Erro ao excluir item do histórico:', jasmine.any(Error));
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
