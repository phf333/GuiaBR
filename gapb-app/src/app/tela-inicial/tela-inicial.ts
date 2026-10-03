import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, combineLatest } from 'rxjs';
import { takeUntil, map } from 'rxjs/operators';
import { AuthService } from '../core/auth.service';
import { Usuario } from '../shared/models';
import { GuiaService } from '../guia/guia.service';

interface MenuItem {
  title: string;
  subtitle: string;
  bgColor: string;
  iconColor: string;
  icon: 'guia' | 'camera' | 'prato';
}

@Component({
  selector: 'app-tela-inicial',
  imports: [CommonModule],
  templateUrl: './tela-inicial.html',
  styleUrl: './tela-inicial.scss',
  host: { class: 'page-fill' },
})
export class TelaInicial implements OnInit, OnDestroy {
  usuarioAtual: Usuario | null = null;
  private destroy$ = new Subject<void>();

  readonly menuItems: MenuItem[] = [
    {
      title: 'Guia Alimentar',
      subtitle: 'Carregando...',
      bgColor: '#e8f5ee',
      iconColor: '#2d8a5c',
      icon: 'guia',
    },
    {
      title: 'Escanear Alimento',
      subtitle: 'Use a câmera do celular',
      bgColor: '#fff6e5',
      iconColor: '#e89020',
      icon: 'camera',
    },
    {
      title: 'Monte seu prato',
      subtitle: 'Planeje sua refeição',
      bgColor: '#f0eeff',
      iconColor: '#7c5cbf',
      icon: 'prato',
    },
  ];

  constructor(
    public auth: AuthService,
    private router: Router,
    private guiaService: GuiaService
  ) {}

  ngOnInit() {
    this.auth.usuarioAtual$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.usuarioAtual = user;
      });

    this.guiaService.capitulos$
      .pipe(takeUntil(this.destroy$))
      .subscribe(capitulos => {
        if (capitulos.length === 0) return;
        const total = capitulos.length;
        const concluidos = capitulos.filter(c => c.status === 'done').length;
        // Atualiza apenas a propriedade do item existente — sem recriar o array
        const guiaItem = this.menuItems.find(i => i.icon === 'guia');
        if (guiaItem) guiaItem.subtitle = `${concluidos}/${total} capítulos concluídos`;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onCardClick(item: MenuItem) {
    if (item.icon === 'camera') {
      this.router.navigate(['/escanear']);
    } else if (item.icon === 'guia') {
      this.router.navigate(['/guia']);
    } else if (item.icon === 'prato') {
      this.router.navigate(['/prato']);
    }
  }

  logout() {
    this.auth.logout();
  }
}
