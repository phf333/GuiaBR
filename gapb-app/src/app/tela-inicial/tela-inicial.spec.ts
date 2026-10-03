import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';
import { TelaInicial } from './tela-inicial';
import { AuthService } from '../core/auth.service';
import { Usuario } from '../shared/models';
import { GuiaService, Capitulo } from '../guia/guia.service';

describe('TelaInicial', () => {
  let component: TelaInicial;
  let routerSpy: jasmine.SpyObj<Router>;
  let authMock: { usuarioAtual$: BehaviorSubject<Usuario | null>; logout: jasmine.Spy };
  let guiaMock: { capitulos$: BehaviorSubject<Capitulo[]> };

  const usuario: Usuario = { id: 1, nome: 'Ana', email: 'a@x.com' };

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    authMock = {
      usuarioAtual$: new BehaviorSubject<Usuario | null>(null),
      logout: jasmine.createSpy('logout'),
    };
    guiaMock = { capitulos$: new BehaviorSubject<Capitulo[]>([]) };
    component = new TelaInicial(
      authMock as unknown as AuthService,
      routerSpy,
      guiaMock as unknown as GuiaService,
    );
  });

  describe('ngOnInit', () => {
    it('deve refletir o usuario atual emitido pelo AuthService', () => {
      component.ngOnInit();
      authMock.usuarioAtual$.next(usuario);

      expect(component.usuarioAtual).toEqual(usuario);
    });

    it('deve atualizar o subtitulo do guia com o progresso dos capitulos', () => {
      component.ngOnInit();
      guiaMock.capitulos$.next([
        { numero: 1, titulo: 'A', status: 'done', cards: [] },
        { numero: 2, titulo: 'B', status: 'active', cards: [] },
      ]);

      const guiaItem = component.menuItems.find((i) => i.icon === 'guia');
      expect(guiaItem!.subtitle).toBe('1/2 capítulos concluídos');
    });

    it('nao deve alterar o subtitulo quando a lista de capitulos esta vazia', () => {
      component.ngOnInit();
      const original = component.menuItems.find((i) => i.icon === 'guia')!.subtitle;

      guiaMock.capitulos$.next([]);

      expect(component.menuItems.find((i) => i.icon === 'guia')!.subtitle).toBe(original);
    });
  });

  describe('onCardClick', () => {
    it('deve navegar para /escanear ao clicar no card de camera', () => {
      component.onCardClick({ icon: 'camera' } as any);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/escanear']);
    });

    it('deve navegar para /guia ao clicar no card do guia', () => {
      component.onCardClick({ icon: 'guia' } as any);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/guia']);
    });

    it('deve navegar para /prato ao clicar no card de prato', () => {
      component.onCardClick({ icon: 'prato' } as any);
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/prato']);
    });
  });

  describe('logout', () => {
    it('deve delegar ao AuthService', () => {
      component.logout();
      expect(authMock.logout).toHaveBeenCalled();
    });
  });
});
