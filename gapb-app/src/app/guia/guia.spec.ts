import { of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { GuiaComponent } from './guia';
import { GuiaService, Capitulo } from './guia.service';
import { DialogService } from '../core/dialog.service';

describe('GuiaComponent', () => {
  let component: GuiaComponent;
  let routerSpy: jasmine.SpyObj<Router>;
  let guiaServiceMock: jasmine.SpyObj<GuiaService>;
  let dialogSpy: jasmine.SpyObj<DialogService>;

  const capitulos: Capitulo[] = [
    { numero: 1, titulo: 'A', status: 'done', cards: [] },
    { numero: 2, titulo: 'B', status: 'active', cards: [] },
    { numero: 3, titulo: 'C', status: 'locked', cards: [] },
  ];

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    guiaServiceMock = jasmine.createSpyObj('GuiaService', ['resetarProgresso'], {
      capitulos$: of(capitulos),
    });
    dialogSpy = jasmine.createSpyObj('DialogService', ['confirm']);
    component = new GuiaComponent(routerSpy, guiaServiceMock, dialogSpy);
  });

  describe('progresso$', () => {
    it('deve calcular a quantidade de capitulos concluidos', async () => {
      const texto = await firstValueFrom(component.progresso$);
      expect(texto).toBe('1 de 3 capítulos concluídos');
    });
  });

  describe('abrirCapitulo', () => {
    it('deve navegar para o capitulo quando nao esta bloqueado', () => {
      component.abrirCapitulo(capitulos[1]);

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/guia/capitulo'], {
        state: { capitulo: capitulos[1] },
      });
    });

    it('nao deve navegar quando o capitulo esta bloqueado', () => {
      component.abrirCapitulo(capitulos[2]);
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  describe('confirmarResetarProgresso', () => {
    it('deve resetar o progresso quando confirmado', async () => {
      dialogSpy.confirm.and.resolveTo(true);

      await component.confirmarResetarProgresso();

      expect(guiaServiceMock.resetarProgresso).toHaveBeenCalled();
    });

    it('nao deve resetar quando cancelado', async () => {
      dialogSpy.confirm.and.resolveTo(false);

      await component.confirmarResetarProgresso();

      expect(guiaServiceMock.resetarProgresso).not.toHaveBeenCalled();
    });
  });

  describe('irParaHome', () => {
    it('deve navegar para a raiz', () => {
      component.irParaHome();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });
  });
});
