import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { RegistroComponent } from './registro';
import { AuthService } from '../core/auth.service';

describe('RegistroComponent', () => {
  let component: RegistroComponent;
  let authSpy: jasmine.SpyObj<AuthService>;
  let routerSpy: jasmine.SpyObj<Router>;

  function preencher(over: Partial<RegistroComponent> = {}) {
    component.nome = 'Ana';
    component.email = 'a@x.com';
    component.senha = '123456';
    component.confirmarSenha = '123456';
    Object.assign(component, over);
  }

  beforeEach(() => {
    authSpy = jasmine.createSpyObj('AuthService', ['register']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    component = new RegistroComponent(authSpy, routerSpy);
  });

  describe('onSubmit', () => {
    it('deve exibir erro quando algum campo esta vazio', () => {
      preencher({ nome: '' });

      component.onSubmit();

      expect(component.erro).toBe('Preencha todos os campos.');
      expect(authSpy.register).not.toHaveBeenCalled();
    });

    it('deve exibir erro quando as senhas nao coincidem', () => {
      preencher({ confirmarSenha: 'outra' });

      component.onSubmit();

      expect(component.erro).toBe('As senhas não coincidem.');
      expect(authSpy.register).not.toHaveBeenCalled();
    });

    it('deve exibir erro quando a senha tem menos de 6 caracteres', () => {
      preencher({ senha: '123', confirmarSenha: '123' });

      component.onSubmit();

      expect(component.erro).toBe('A senha deve ter pelo menos 6 caracteres.');
      expect(authSpy.register).not.toHaveBeenCalled();
    });

    it('deve registrar e navegar para /home em caso de sucesso', () => {
      preencher();
      authSpy.register.and.returnValue(of({} as any));

      component.onSubmit();

      expect(authSpy.register).toHaveBeenCalledWith('Ana', 'a@x.com', '123456');
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('deve exibir mensagem de erro do backend em caso de falha', () => {
      preencher();
      authSpy.register.and.returnValue(throwError(() => ({ error: { error: 'E-mail já cadastrado' } })));

      component.onSubmit();

      expect(component.erro).toBe('E-mail já cadastrado');
      expect(component.carregando).toBeFalse();
    });
  });
});
