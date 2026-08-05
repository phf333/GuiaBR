import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { fakeAsync, tick } from '@angular/core/testing';
import { PratoDetalheComponent } from './prato-detalhe';
import { PratoService } from '../prato.service';
import { LocalDbService } from '../../core/local-db.service';
import { Alimento, Refeicao } from '../../shared/models';

describe('PratoDetalheComponent', () => {
  let component: PratoDetalheComponent;
  let pratoSpy: jasmine.SpyObj<PratoService>;
  let localDbSpy: jasmine.SpyObj<LocalDbService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const alimento: Alimento = {
    id: 10,
    nome: 'Arroz',
    grupo: 'Cereais',
    classificacao_guia: 'in natura',
    sazonalidade_atual: null,
  };

  const refeicao: Refeicao = {
    id: 1,
    nome_refeicao: 'Almoço',
    tipo_refeicao: 'almoco',
    data_criacao: '2024-01-01',
    total_itens: 1,
    itens: [
      { alimento_id: 10, nome: 'Arroz', grupo: 'Cereais', classificacao_guia: 'in natura', categoria_guia: '', sazonalidade_atual: null },
    ],
  };

  const routeMock = { snapshot: { paramMap: { get: () => '1' } } } as unknown as ActivatedRoute;

  beforeEach(() => {
    pratoSpy = jasmine.createSpyObj('PratoService', ['obter', 'adicionarItem', 'removerItem']);
    localDbSpy = jasmine.createSpyObj('LocalDbService', ['searchAlimentos']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    localDbSpy.searchAlimentos.and.resolveTo([]);
    component = new PratoDetalheComponent(routeMock, routerSpy, pratoSpy, localDbSpy);
  });

  describe('carregarRefeicao', () => {
    it('deve carregar a refeicao e marcar confirmado quando ha itens', () => {
      pratoSpy.obter.and.returnValue(of(refeicao));

      component.carregarRefeicao(1);

      expect(component.refeicao).toEqual(refeicao);
      expect(component.carregando).toBeFalse();
      expect(component.confirmado).toBeTrue();
      expect(component.jaAdicionado(10)).toBeTrue();
    });

    it('deve encerrar o carregamento em caso de erro', () => {
      pratoSpy.obter.and.returnValue(throwError(() => new Error('x')));

      component.carregarRefeicao(1);

      expect(component.carregando).toBeFalse();
    });

    it('deve considerar confirmado=false quando itens for undefined', () => {
      pratoSpy.obter.and.returnValue(of({ ...refeicao, itens: undefined }));

      component.carregarRefeicao(1);

      expect(component.confirmado).toBeFalse();
      expect(component.jaAdicionado(10)).toBeFalse();
    });
  });

  describe('ngOnInit', () => {
    it('deve carregar a refeicao do id da rota, buscar resultados e configurar o debounce da busca', fakeAsync(() => {
      pratoSpy.obter.and.returnValue(of(refeicao));
      spyOn(component, 'atualizarResultados');

      component.ngOnInit();

      expect(pratoSpy.obter).toHaveBeenCalledWith(1);
      expect(component.atualizarResultados).toHaveBeenCalledTimes(1);

      (component as any).buscaSubject.next('arroz');
      tick(300);

      expect(component.atualizarResultados).toHaveBeenCalledTimes(2);
    }));
  });

  describe('ngOnDestroy', () => {
    it('deve completar o destroy$ sem lancar erro', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });

  describe('atualizarResultados', () => {
    it('deve buscar alimentos no cache local com os filtros atuais', async () => {
      component.buscaQuery = 'arroz';
      component.soSafra = true;
      component.filtroProcessamento = 'in natura';
      localDbSpy.searchAlimentos.and.resolveTo([alimento]);

      component.atualizarResultados();
      // from(Promise) emite de forma assíncrona; aguarda o microtask resolver.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(localDbSpy.searchAlimentos).toHaveBeenCalledWith('arroz', true, 'in natura');
      expect(component.resultadosBusca).toEqual([alimento]);
      expect(component.buscando).toBeFalse();
    });

    it('deve encerrar o carregamento mesmo se a busca falhar', async () => {
      localDbSpy.searchAlimentos.and.rejectWith(new Error('falha'));

      component.atualizarResultados();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.buscando).toBeFalse();
    });
  });

  describe('onFiltroProcessamentoChange', () => {
    it('deve reatualizar os resultados', () => {
      spyOn(component, 'atualizarResultados');

      component.onFiltroProcessamentoChange();

      expect(component.atualizarResultados).toHaveBeenCalled();
    });
  });

  describe('toggleSafra', () => {
    it('deve inverter o filtro de safra e reatualizar', () => {
      spyOn(component, 'atualizarResultados');
      component.soSafra = false;

      component.toggleSafra();

      expect(component.soSafra).toBeTrue();
      expect(component.atualizarResultados).toHaveBeenCalled();
    });
  });

  describe('adicionarAlimento', () => {
    it('deve adicionar o item e atualizar o estado da refeicao', () => {
      component.refeicao = { ...refeicao, itens: [] };
      pratoSpy.adicionarItem.and.returnValue(of(refeicao));
      spyOn(component, 'atualizarResultados');

      component.adicionarAlimento(alimento);

      expect(pratoSpy.adicionarItem).toHaveBeenCalledWith(1, 10);
      expect(component.refeicao).toEqual(refeicao);
      expect(component.jaAdicionado(10)).toBeTrue();
      expect(component.buscaQuery).toBe('');
    });

    it('nao deve fazer nada quando nao ha refeicao carregada', () => {
      component.refeicao = null;

      component.adicionarAlimento(alimento);

      expect(pratoSpy.adicionarItem).not.toHaveBeenCalled();
    });
  });

  describe('removerItem', () => {
    it('deve remover o item e atualizar a refeicao', () => {
      component.refeicao = refeicao;
      const semItens = { ...refeicao, itens: [], total_itens: 0 };
      pratoSpy.removerItem.and.returnValue(of(semItens));

      component.removerItem(10);

      expect(pratoSpy.removerItem).toHaveBeenCalledWith(1, 10);
      expect(component.refeicao).toEqual(semItens);
      expect(component.jaAdicionado(10)).toBeFalse();
    });

    it('nao deve fazer nada quando nao ha refeicao carregada', () => {
      component.refeicao = null;

      component.removerItem(10);

      expect(pratoSpy.removerItem).not.toHaveBeenCalled();
    });
  });

  describe('confirmarEscolha', () => {
    it('deve marcar como confirmado', () => {
      component.confirmado = false;
      component.confirmarEscolha();
      expect(component.confirmado).toBeTrue();
    });
  });

  describe('onBusca', () => {
    it('deve reatualizar diretamente quando a query esta vazia', () => {
      spyOn(component, 'atualizarResultados');

      component.onBusca('   ');

      expect(component.atualizarResultados).toHaveBeenCalled();
    });

    it('deve emitir no buscaSubject quando a query nao esta vazia', () => {
      const spy = spyOn((component as any).buscaSubject, 'next');

      component.onBusca('arroz');

      expect(spy).toHaveBeenCalledWith('arroz');
    });
  });

  describe('voltar', () => {
    it('deve navegar para /prato', () => {
      component.voltar();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/prato']);
    });
  });
});
