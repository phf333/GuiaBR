import { Router } from '@angular/router';
import { ResultadoComponent } from './resultado-escaneamento';
import { ProdutoEscaneado } from '../shared/models';

describe('ResultadoComponent', () => {
  let routerSpy: jasmine.SpyObj<Router>;

  function produto(over: Partial<ProdutoEscaneado> = {}): ProdutoEscaneado {
    return {
      codigo_barras: '789',
      nome: 'Produto',
      marca: null,
      quantidade: null,
      nova_group: null,
      classificacao_guia: 'indisponivel',
      imagem_url: null,
      ...over,
    };
  }

  /** Cria o componente injetando um produto via getCurrentNavigation. */
  function criar(produto: ProdutoEscaneado | null): ResultadoComponent {
    routerSpy = jasmine.createSpyObj('Router', ['navigate', 'getCurrentNavigation']);
    routerSpy.getCurrentNavigation.and.returnValue({
      extras: { state: { produto } },
    } as any);
    return new ResultadoComponent(routerSpy);
  }

  describe('montarDados', () => {
    it('deve montar os dados de um produto ultraprocessado (grupo 4) com alerta vermelho', () => {
      const component = criar(produto({ nome: 'Bolacha', marca: 'Marca', quantidade: '100g', nova_group: 4 }));
      component.ngOnInit();

      expect(component.nomeProduto).toBe('Bolacha');
      expect(component.marcaQuantidade).toBe('Marca – 100g');
      expect(component.alertaClass).toBe('alerta--vermelho');
      expect(component.alertaTitulo).toBe('ALIMENTO ULTRAPROCESSADO');
    });

    it('deve montar um produto saudavel (grupo 1) com alerta verde', () => {
      const component = criar(produto({ nome: 'Maçã', nova_group: 1 }));
      component.ngOnInit();

      expect(component.alertaClass).toBe('alerta--verde');
    });

    it('deve usar textos padrao quando a classificacao esta indisponivel', () => {
      const component = criar(produto({ nome: 'Desconhecido' }));
      component.ngOnInit();

      expect(component.alertaTitulo).toBe('CLASSIFICAÇÃO INDISPONÍVEL');
      expect(component.alertaClass).toBe('alerta--cinza');
    });

    it('deve omitir o separador quando so ha marca', () => {
      const component = criar(produto({ marca: 'Marca' }));
      component.ngOnInit();

      expect(component.marcaQuantidade).toBe('Marca');
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
