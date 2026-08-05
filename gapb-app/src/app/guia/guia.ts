import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { GuiaService, Capitulo } from './guia.service';
import { DialogService } from '../core/dialog.service';

@Component({
  selector: 'app-guia',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './guia.html',
  styleUrl: './guia.scss',
  host: { class: 'page-fill' }
})
export class GuiaComponent {
  capitulos$: Observable<Capitulo[]>;
  progresso$: Observable<string>;

  constructor(
    private router: Router,
    private guiaService: GuiaService,
    private dialog: DialogService
  ) {
    this.capitulos$ = this.guiaService.capitulos$;

    this.progresso$ = this.guiaService.capitulos$.pipe(
      map(caps => {
        const concluidos = caps.filter(c => c.status === 'done').length;
        return `${concluidos} de ${caps.length} capítulos concluídos`;
      })
    );
  }

  abrirCapitulo(cap: Capitulo) {
    if (cap.status === 'locked') return;
    this.router.navigate(['/guia/capitulo'], { state: { capitulo: cap } });
  }

  async confirmarResetarProgresso() {
    if (await this.dialog.confirm('Deseja resetar todo o seu progresso de leitura do Guia?')) {
      this.guiaService.resetarProgresso();
    }
  }

  irParaHome() { this.router.navigate(['/']); }
}