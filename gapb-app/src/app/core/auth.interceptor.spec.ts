import { TestBed } from '@angular/core/testing';
import { HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { of, throwError, Observable } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let authSpy: jasmine.SpyObj<AuthService>;
  let next: jasmine.Spy<HttpHandlerFn>;
  let reqRecebida: HttpRequest<unknown> | undefined;

  function executar(req: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    return TestBed.runInInjectionContext(() => authInterceptor(req, next));
  }

  beforeEach(() => {
    reqRecebida = undefined;
    authSpy = jasmine.createSpyObj(
      'AuthService',
      ['logout'],
      { token: null as string | null, isLoggedIn: true },
    );
    next = jasmine.createSpy('next').and.callFake((r: HttpRequest<unknown>) => {
      reqRecebida = r;
      return of({} as HttpEvent<unknown>);
    });

    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: authSpy }],
    });
  });

  describe('quando existe token', () => {
    it('deve clonar a requisicao adicionando o header Authorization', () => {
      Object.defineProperty(authSpy, 'token', { get: () => 'tok-123' });
      const req = new HttpRequest('GET', '/api/x');

      executar(req).subscribe();

      expect(next).toHaveBeenCalled();
      expect(reqRecebida!.headers.get('Authorization')).toBe('Bearer tok-123');
    });
  });

  describe('quando nao existe token', () => {
    it('deve encaminhar a requisicao original sem header', () => {
      Object.defineProperty(authSpy, 'token', { get: () => null });
      const req = new HttpRequest('GET', '/api/x');

      executar(req).subscribe();

      expect(next).toHaveBeenCalledWith(req);
      expect(reqRecebida!.headers.has('Authorization')).toBeFalse();
    });
  });

  describe('quando a resposta e 401', () => {
    it('deve fazer logout e repropagar o erro', () => {
      Object.defineProperty(authSpy, 'token', { get: () => 'tok-expirado' });
      Object.defineProperty(authSpy, 'isLoggedIn', { get: () => true });
      next.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
      const req = new HttpRequest('GET', '/api/x');
      let erroRecebido: HttpErrorResponse | undefined;

      executar(req).subscribe({ error: (err) => (erroRecebido = err) });

      expect(authSpy.logout).toHaveBeenCalled();
      expect(erroRecebido!.status).toBe(401);
    });

    it('nao deve fazer logout se o usuario ja nao estava logado', () => {
      Object.defineProperty(authSpy, 'token', { get: () => null });
      Object.defineProperty(authSpy, 'isLoggedIn', { get: () => false });
      next.and.returnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
      const req = new HttpRequest('GET', '/api/x');

      executar(req).subscribe({ error: () => {} });

      expect(authSpy.logout).not.toHaveBeenCalled();
    });
  });

  describe('quando a resposta e um erro diferente de 401', () => {
    it('nao deve fazer logout e deve repropagar o erro', () => {
      Object.defineProperty(authSpy, 'token', { get: () => 'tok-valido' });
      Object.defineProperty(authSpy, 'isLoggedIn', { get: () => true });
      next.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
      const req = new HttpRequest('GET', '/api/x');
      let erroRecebido: HttpErrorResponse | undefined;

      executar(req).subscribe({ error: (err) => (erroRecebido = err) });

      expect(authSpy.logout).not.toHaveBeenCalled();
      expect(erroRecebido!.status).toBe(500);
    });
  });
});
