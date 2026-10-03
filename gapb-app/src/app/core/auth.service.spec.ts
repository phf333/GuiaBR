import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { Usuario } from '../shared/models';
import { environment } from '../../environments/environment';
import { LocalDbService } from './local-db.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let routerSpy: jasmine.SpyObj<Router>;
  let localDbSpy: jasmine.SpyObj<LocalDbService>;
  const base = environment.apiUrl;

  const TOKEN_KEY = 'guiabr_token';
  const USUARIO_KEY = 'guiabr_usuario';

  const usuario: Usuario = { id: 1, nome: 'Ana', email: 'ana@x.com' };
  const authResponse = { access_token: 'tok-123', usuario };

  function criarService(): AuthService {
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: routerSpy },
        { provide: LocalDbService, useValue: localDbSpy },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  beforeEach(() => {
    localStorage.clear();
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    localDbSpy = jasmine.createSpyObj('LocalDbService', ['clearUserData']);
    localDbSpy.clearUserData.and.resolveTo();
  });

  afterEach(() => {
    localStorage.clear();
    httpMock?.verify();
  });

  describe('login', () => {
    beforeEach(() => {
      service = criarService();
    });

    it('deve postar no endpoint de login e salvar a sessao', () => {
      spyOn(localStorage, 'setItem').and.callThrough();
      let emitido: Usuario | null = null;
      service.usuarioAtual$.subscribe((u) => (emitido = u));

      service.login('ana@x.com', '123456').subscribe();
      const req = httpMock.expectOne(`${base}/api/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'ana@x.com', senha: '123456' });
      req.flush(authResponse);

      expect(localStorage.setItem).toHaveBeenCalledWith(TOKEN_KEY, 'tok-123');
      expect(localStorage.setItem).toHaveBeenCalledWith(USUARIO_KEY, JSON.stringify(usuario));
      expect(emitido!).toEqual(usuario);
    });
  });

  describe('register', () => {
    beforeEach(() => {
      service = criarService();
    });

    it('deve postar no endpoint de registro e salvar a sessao', () => {
      service.register('Ana', 'ana@x.com', '123456').subscribe();

      const req = httpMock.expectOne(`${base}/api/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ nome: 'Ana', email: 'ana@x.com', senha: '123456' });
      req.flush(authResponse);

      expect(service.token).toBe('tok-123');
      expect(service.usuarioAtual$.value).toEqual(usuario);
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      service = criarService();
    });

    it('deve limpar a sessao, emitir null e navegar para /login', () => {
      localStorage.setItem(TOKEN_KEY, 'tok-123');
      localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));

      service.logout();

      expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(USUARIO_KEY)).toBeNull();
      expect(service.usuarioAtual$.value).toBeNull();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });
  });

  describe('isolamento dos dados locais por usuario', () => {
    const DONO_KEY = 'guiabr_dono_dados';
    const outroUsuario: Usuario = { id: 2, nome: 'Bia', email: 'bia@x.com' };

    function logar(resposta: { access_token: string; usuario: Usuario }) {
      service.login(resposta.usuario.email, '123456').subscribe();
      httpMock.expectOne(`${base}/api/auth/login`).flush(resposta);
    }

    beforeEach(() => {
      service = criarService();
    });

    it('logout deve apagar os dados locais do usuario', () => {
      logar(authResponse);
      localStorage.setItem('guiabr_historico_scanner', '[]');
      localStorage.setItem('outra_app', 'x');

      service.logout();

      expect(localStorage.getItem('guiabr_historico_scanner')).toBeNull();
      expect(localStorage.getItem(DONO_KEY)).toBeNull();
      expect(localStorage.getItem('outra_app')).toBe('x');
      expect(localDbSpy.clearUserData).toHaveBeenCalled();
    });

    it('logout por sessao expirada deve preservar os dados locais', () => {
      logar(authResponse);
      localStorage.setItem('guiabr_historico_scanner', '[]');

      service.logout(true);

      expect(service.token).toBeNull();
      expect(localStorage.getItem('guiabr_historico_scanner')).toBe('[]');
      expect(localStorage.getItem(DONO_KEY)).toBe('1');
      expect(localDbSpy.clearUserData).not.toHaveBeenCalled();
    });

    it('login do mesmo usuario apos sessao expirada deve manter os dados locais', () => {
      logar(authResponse);
      localStorage.setItem('guiabr_historico_scanner', '[]');
      service.logout(true);

      logar(authResponse);

      expect(localStorage.getItem('guiabr_historico_scanner')).toBe('[]');
      expect(localDbSpy.clearUserData).not.toHaveBeenCalled();
    });

    it('login de outro usuario deve apagar os dados locais do anterior', () => {
      logar(authResponse);
      localStorage.setItem('guiabr_historico_scanner', '[]');
      service.logout(true);

      logar({ access_token: 'tok-456', usuario: outroUsuario });

      expect(localStorage.getItem('guiabr_historico_scanner')).toBeNull();
      expect(localDbSpy.clearUserData).toHaveBeenCalled();
      expect(service.token).toBe('tok-456');
      expect(localStorage.getItem(DONO_KEY)).toBe('2');
    });
  });

  describe('token', () => {
    it('deve refletir o valor salvo no localStorage', () => {
      localStorage.setItem(TOKEN_KEY, 'abc');
      service = criarService();
      expect(service.token).toBe('abc');
    });

    it('deve ser null quando nao houver token', () => {
      service = criarService();
      expect(service.token).toBeNull();
    });
  });

  describe('isLoggedIn', () => {
    it('deve ser true quando houver token', () => {
      localStorage.setItem(TOKEN_KEY, 'abc');
      service = criarService();
      expect(service.isLoggedIn).toBeTrue();
    });

    it('deve ser false quando nao houver token', () => {
      service = criarService();
      expect(service.isLoggedIn).toBeFalse();
    });
  });

  describe('carregamento do usuario salvo (construtor)', () => {
    it('deve inicializar usuarioAtual$ com o usuario salvo', () => {
      localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario));
      service = criarService();
      expect(service.usuarioAtual$.value).toEqual(usuario);
    });

    it('deve inicializar com null quando nao houver usuario salvo', () => {
      service = criarService();
      expect(service.usuarioAtual$.value).toBeNull();
    });

    it('deve inicializar com null quando o JSON estiver corrompido', () => {
      localStorage.setItem(USUARIO_KEY, '{json invalido');
      service = criarService();
      expect(service.usuarioAtual$.value).toBeNull();
    });
  });
});
