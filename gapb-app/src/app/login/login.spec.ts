import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { LoginComponent } from './login';
import { AuthService } from '../core/auth.service';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['login']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    component = new LoginComponent(authSpy, routerSpy);
  });

  describe('onSubmit', () => {
    it('deve exibir erro e nao chamar login quando algum campo esta vazio', () => {
      component.email = '';
      component.senha = '';

      component.onSubmit();

      expect(component.erro).toBe('Preencha todos os campos.');
      expect(authSpy.login).not.toHaveBeenCalled();
    });

    it('deve navegar para /home em caso de sucesso', () => {
      component.email = 'a@x.com';
      component.senha = '123456';
      authSpy.login.and.returnValue(of({} as any));

      component.onSubmit();

      expect(authSpy.login).toHaveBeenCalledWith('a@x.com', '123456');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('deve exibir a mensagem de erro do backend em caso de falha', () => {
      component.email = 'a@x.com';
      component.senha = '123456';
      authSpy.login.and.returnValue(throwError(() => ({ error: { error: 'Credenciais inválidas' } })));

      component.onSubmit();

      expect(component.erro).toBe('Credenciais inválidas');
      expect(component.carregando).toBeFalse();
    });

    it('deve exibir mensagem generica quando o erro nao traz detalhe', () => {
      component.email = 'a@x.com';
      component.senha = '123456';
      authSpy.login.and.returnValue(throwError(() => ({})));

      component.onSubmit();

      expect(component.erro).toBe('Erro ao fazer login. Tente novamente.');
    });
  });
});
