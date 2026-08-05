import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, NavigationEnd, Router } from '@angular/router';
import { provideServiceWorker, SwUpdate } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { SyncProcessorService } from './core/sync-processor.service';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideServiceWorker('ngsw-worker.js', { enabled: false }),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the phone wrapper', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.phone-wrapper')).toBeTruthy();
  });
});

describe('App (métodos e assinaturas)', () => {
  let app: App;
  let routerEvents$: Subject<any>;
  let versionUpdates$: Subject<any>;
  let swUpdateMock: { isEnabled: boolean; versionUpdates: Subject<any> };

  function criarApp(swEnabled = false): App {
    routerEvents$ = new Subject();
    versionUpdates$ = new Subject();
    swUpdateMock = { isEnabled: swEnabled, versionUpdates: versionUpdates$ };

    const routerMock = { events: routerEvents$.asObservable() } as unknown as Router;
    const syncProcessorMock = {} as SyncProcessorService;

    return new App(routerMock, syncProcessorMock, swUpdateMock as unknown as SwUpdate);
  }

  afterEach(() => {
    app?.ngOnDestroy();
  });

  describe('deteccao de rede (online/offline)', () => {
    it('deve marcar isOffline = false quando o evento online dispara', () => {
      app = criarApp();
      app.isOffline = true;

      window.dispatchEvent(new Event('online'));

      expect(app.isOffline).toBeFalse();
    });

    it('deve marcar isOffline = true quando o evento offline dispara', () => {
      app = criarApp();
      app.isOffline = false;

      window.dispatchEvent(new Event('offline'));

      expect(app.isOffline).toBeTrue();
    });
  });

  describe('beforeinstallprompt', () => {
    it('deve capturar o prompt, prevenir o padrao e exibir o banner', () => {
      app = criarApp();
      const fakeEvent: any = new Event('beforeinstallprompt');
      spyOn(fakeEvent, 'preventDefault');

      window.dispatchEvent(fakeEvent);

      expect(fakeEvent.preventDefault).toHaveBeenCalled();
      expect(app.showInstallBanner).toBeTrue();
    });
  });

  describe('instalarApp', () => {
    it('nao deve fazer nada quando nao ha prompt capturado', async () => {
      app = criarApp();

      await app.instalarApp();

      expect(app.showInstallBanner).toBeFalse();
    });

    it('deve chamar prompt() e esconder o banner apos a escolha do usuario', async () => {
      app = criarApp();
      const fakeEvent: any = new Event('beforeinstallprompt');
      fakeEvent.prompt = jasmine.createSpy('prompt');
      fakeEvent.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(fakeEvent);
      expect(app.showInstallBanner).toBeTrue();

      await app.instalarApp();

      expect(fakeEvent.prompt).toHaveBeenCalled();
      expect(app.showInstallBanner).toBeFalse();
    });
  });

  describe('dispensarInstalacao', () => {
    it('deve esconder o banner de instalacao', () => {
      app = criarApp();
      app.showInstallBanner = true;

      app.dispensarInstalacao();

      expect(app.showInstallBanner).toBeFalse();
    });
  });

  describe('atualizacao do service worker', () => {
    it('deve marcar updateAvailable quando VERSION_READY e emitido com swUpdate habilitado', () => {
      app = criarApp(true);

      versionUpdates$.next({ type: 'VERSION_READY' });

      expect(app.updateAvailable).toBeTrue();
    });

    it('nao deve assinar versionUpdates quando swUpdate esta desabilitado', () => {
      app = criarApp(false);

      versionUpdates$.next({ type: 'VERSION_READY' });

      expect(app.updateAvailable).toBeFalse();
    });

    it('deve ignorar eventos diferentes de VERSION_READY', () => {
      app = criarApp(true);

      versionUpdates$.next({ type: 'VERSION_DETECTED' });

      expect(app.updateAvailable).toBeFalse();
    });
  });

  describe('navegacao (showNav)', () => {
    it('deve esconder a nav em /login', () => {
      app = criarApp();

      routerEvents$.next(new NavigationEnd(1, '/login', '/login'));

      expect(app.showNav).toBeFalse();
    });

    it('deve esconder a nav em /registro', () => {
      app = criarApp();

      routerEvents$.next(new NavigationEnd(1, '/registro', '/registro'));

      expect(app.showNav).toBeFalse();
    });

    it('deve exibir a nav em outras rotas', () => {
      app = criarApp();
      app.showNav = false;

      routerEvents$.next(new NavigationEnd(1, '/home', '/home'));

      expect(app.showNav).toBeTrue();
    });

    it('deve ignorar eventos que nao sejam NavigationEnd', () => {
      app = criarApp();
      app.showNav = true;

      routerEvents$.next({ type: 'NavigationStart' });

      expect(app.showNav).toBeTrue();
    });
  });

  describe('ngOnDestroy', () => {
    it('deve parar de reagir a versionUpdates apos destruir', () => {
      app = criarApp(true);

      app.ngOnDestroy();
      versionUpdates$.next({ type: 'VERSION_READY' });

      expect(app.updateAvailable).toBeFalse();
    });
  });
});
