import { Component, OnDestroy } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { SyncProcessorService } from './core/sync-processor.service';
import { DialogComponent } from './shared/components/dialog/dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, DialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  protected readonly title = 'gapb-app';
  showNav = true;
  isOffline = !navigator.onLine;
  updateAvailable = false;
  showInstallBanner = false;

  private readonly ROTAS_SEM_NAV = ['/login', '/registro'];
  private destroy$ = new Subject<void>();
  private deferredInstallPrompt: any = null;

  private readonly handleOnline = () => this.isOffline = false;
  private readonly handleOffline = () => this.isOffline = true;
  private readonly handleBeforeInstallPrompt = (event: Event) => {
    event.preventDefault();
    this.deferredInstallPrompt = event;
    this.showInstallBanner = true;
  };

  constructor(
    router: Router,
    private syncProcessor: SyncProcessorService,
    private swUpdate: SwUpdate,
  ) {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Captura o prompt nativo de instalação para oferecer um botão próprio,
    // já que o navegador nem sempre exibe o prompt automaticamente.
    window.addEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);

    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'),
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.updateAvailable = true;
      });
    }

    router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntil(this.destroy$)
    ).subscribe((e: any) => {
      const url: string = e.urlAfterRedirects || e.url;
      this.showNav = !this.ROTAS_SEM_NAV.some(r => url.startsWith(r));
    });
  }

  async recarregarApp() {
    if (this.swUpdate.isEnabled) {
      // Garante que o novo Service Worker esteja totalmente ativo antes de recarregar,
      // evitando um reload que misture assets da versão antiga com a nova.
      await this.swUpdate.activateUpdate();
    }
    document.location.reload();
  }

  async instalarApp() {
    if (!this.deferredInstallPrompt) return;
    this.deferredInstallPrompt.prompt();
    await this.deferredInstallPrompt.userChoice;
    this.deferredInstallPrompt = null;
    this.showInstallBanner = false;
  }

  dispensarInstalacao() {
    this.showInstallBanner = false;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
    window.removeEventListener('beforeinstallprompt', this.handleBeforeInstallPrompt);
  }
}
