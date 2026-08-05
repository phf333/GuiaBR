import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from './auth.service';

describe('authGuard', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  const rota = {} as ActivatedRouteSnapshot;
  const estado = {} as RouterStateSnapshot;

  function executar() {
    return TestBed.runInInjectionContext(() => authGuard(rota, estado));
  }

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', [], { isLoggedIn: false });
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
  });

  describe('quando o usuario esta logado', () => {
    it('deve permitir a ativacao e nao navegar', () => {
      Object.defineProperty(authSpy, 'isLoggedIn', { get: () => true });

      const resultado = executar();

      expect(resultado).toBeTrue();
      expect(routerSpy.navigate).not.toHaveBeenCalled();
    });
  });

  describe('quando o usuario nao esta logado', () => {
    it('deve bloquear a ativacao e redirecionar para /login', () => {
      Object.defineProperty(authSpy, 'isLoggedIn', { get: () => false });

      const resultado = executar();

      expect(resultado).toBeFalse();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });
});
