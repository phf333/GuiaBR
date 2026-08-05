import { Router } from '@angular/router';
import { ResultadoComponent } from './resultado-escaneamento';

describe('ResultadoComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;

  /** Cria o componente injetando um produto via getCurrentNavigation. */
  function criar(produto: any): ResultadoComponent {
    routerSpy = jasmine.createSpyObj('Router', ['navigate', 'getCurrentNavigation']);
    routerSpy.getCurrentNavigation.and.returnValue({
      extras: { state: { produto } },
    } as any);
    return new ResultadoComponent(routerSpy);
  }

  describe('montarDados', () => {
    it('deve montar os dados de um produto ultraprocessado (grupo 4) com alerta vermelho', () => {
      const produto = {
        product: { product_name: 'Bolacha', brands: 'Marca', quantity: '100g', nova_group: 4 },
      };
      const component = criar(produto);
      component.ngOnInit();

      expect(component.nomeProduto).toBe('Bolacha');
      expect(component.marcaQuantidade).toBe('Marca – 100g');
      expect(component.alertaClass).toBe('alerta--vermelho');
      expect(component.alertaTitulo).toBe('ALIMENTO ULTRAPROCESSADO');
    });

    it('deve montar um produto saudavel (grupo 1) com alerta verde', () => {
      const produto = { product: { product_name: 'Maçã', nova_group: 1 } };
      const component = criar(produto);
      component.ngOnInit();

      expect(component.alertaClass).toBe('alerta--verde');
    });

    it('deve usar textos padrao quando a classificacao esta indisponivel', () => {
      const produto = { product: { product_name: 'Desconhecido' } };
      const component = criar(produto);
      component.ngOnInit();

      expect(component.alertaTitulo).toBe('CLASSIFICAÇÃO INDISPONÍVEL');
      expect(component.alertaClass).toBe('alerta--cinza');
    });

    it('deve usar nome padrao quando product_name estiver ausente', () => {
      const produto = { product: { nova_group: 1 } };
      const component = criar(produto);
      component.ngOnInit();

      expect(component.nomeProduto).toBe('Produto desconhecido');
    });
  });

  describe('navegacao', () => {
    it('voltar deve navegar para /escanear', () => {
      const component = criar(null);
      component.voltar();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/escanear']);
    });

    it('navegarHome deve navegar para a raiz', () => {
      const component = criar(null);
      component.navegarHome();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
