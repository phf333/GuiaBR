import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { PratoComponent } from './prato';
import { PratoService } from './prato.service';
import { DialogService } from '../core/dialog.service';
import { Refeicao } from '../shared/models';

describe('PratoComponent', () => {
  let component: PratoComponent;
  let pratoSpy: jasmine.SpyObj<PratoService>;
  let routerSpy: jasmine.SpyObj<Router>;
  let dialogSpy: jasmine.SpyObj<DialogService>;

  const refeicao: Refeicao = {
    id: 1,
    nome_refeicao: 'Almoço',
    tipo_refeicao: 'almoco',
    data_criacao: '2024-01-01',
    total_itens: 0,
    itens: [],
  };

  beforeEach(() => {
    pratoSpy = jasmine.createSpyObj('PratoService', ['listar', 'criar', 'deletar']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    dialogSpy = jasmine.createSpyObj('DialogService', ['confirm']);
    component = new PratoComponent(pratoSpy, routerSpy, dialogSpy);
  });

  describe('carregar', () => {
    it('deve preencher as refeicoes e encerrar o carregamento em sucesso', () => {
      pratoSpy.listar.and.returnValue(of([refeicao]));

      component.carregar();

      expect(component.refeicoes).toEqual([refeicao]);
      expect(component.carregando).toBeFalse();
    });

    it('deve encerrar o carregamento mesmo em caso de erro', () => {
      pratoSpy.listar.and.returnValue(throwError(() => new Error('x')));

      component.carregar();

      expect(component.carregando).toBeFalse();
    });
  });

  describe('abrirModal', () => {
    it('deve resetar o formulario e abrir o modal', () => {
      component.novoNome = 'antigo';
      component.erro = 'erro anterior';

      component.abrirModal();

      expect(component.novoNome).toBe('');
      expect(component.novoTipo).toBe('almoco');
      expect(component.erro).toBeNull();
      expect(component.mostrarModal).toBeTrue();
    });
  });

  describe('fecharModal', () => {
    it('deve fechar o modal', () => {
      component.mostrarModal = true;
      component.fecharModal();
      expect(component.mostrarModal).toBeFalse();
    });
  });

  describe('criarRefeicao', () => {
    it('deve exibir erro quando o nome esta vazio', () => {
      component.novoNome = '   ';

      component.criarRefeicao();

      expect(component.erro).toBe('Dê um nome para a refeição.');
      expect(pratoSpy.criar).not.toHaveBeenCalled();
    });

    it('deve criar a refeicao e navegar para o detalhe em sucesso', () => {
      component.novoNome = '  Janta  ';
      component.novoTipo = 'jantar';
      pratoSpy.criar.and.returnValue(of({ ...refeicao, id: 9 }));

      component.criarRefeicao();

      expect(pratoSpy.criar).toHaveBeenCalledWith('Janta', 'jantar');
      expect(component.mostrarModal).toBeFalse();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/prato', 9]);
    });

    it('deve exibir erro em caso de falha', () => {
      component.novoNome = 'Janta';
      pratoSpy.criar.and.returnValue(throwError(() => new Error('x')));

      component.criarRefeicao();

      expect(component.erro).toBe('Erro ao criar refeição.');
      expect(component.criando).toBeFalse();
    });
  });

  describe('deletarRefeicao', () => {
    it('nao deve deletar quando o usuario cancela', async () => {
      dialogSpy.confirm.and.resolveTo(false);

      await component.deletarRefeicao(new Event('click'), 1);

      expect(pratoSpy.deletar).not.toHaveBeenCalled();
    });

    it('deve remover a refeicao da lista apos confirmar', async () => {
      dialogSpy.confirm.and.resolveTo(true);
      pratoSpy.deletar.and.returnValue(of({}));
      component.refeicoes = [refeicao, { ...refeicao, id: 2 }];

      await component.deletarRefeicao(new Event('click'), 1);

      expect(pratoSpy.deletar).toHaveBeenCalledWith(1);
      expect(component.refeicoes.map((r) => r.id)).toEqual([2]);
    });
  });
});
