import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PratoService } from './prato.service';
import { DialogService } from '../core/dialog.service';
import { Refeicao, TipoRefeicao } from '../shared/models';
import { TipoIconePipe, TipoLabelPipe, FormatarDataPipe, TIPO_ICONES, TIPO_LABELS } from '../shared/pipes/shared-pipes';

@Component({
  selector: 'app-prato',
  standalone: true,
  imports: [CommonModule, FormsModule, TipoIconePipe, TipoLabelPipe, FormatarDataPipe],
  templateUrl: './prato.html',
  styleUrl: './prato.scss',
  host: { class: 'page-fill' },
})
export class PratoComponent implements OnInit, OnDestroy {
  refeicoes: Refeicao[] = [];
  carregando = true;
  mostrarModal = false;
  novoNome = '';
  novoTipo: TipoRefeicao = 'almoco';
  criando = false;
  erro: string | null = null;
  private destroy$ = new Subject<void>();

  readonly tipos = (['cafe_manha', 'lanche', 'almoco', 'jantar'] as TipoRefeicao[]).map(valor => ({
    valor,
    label: TIPO_LABELS[valor],
    icone: TIPO_ICONES[valor],
  }));

  constructor(private pratoService: PratoService, public router: Router, private dialog: DialogService) {}

  ngOnInit() { this.carregar(); }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  carregar() {
    this.carregando = true;
    this.pratoService.listar()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => { this.refeicoes = data; this.carregando = false; },
        error: () => this.carregando = false,
      });
  }

  abrirModal() {
    this.novoNome = '';
    this.novoTipo = 'almoco';
    this.erro = null;
    this.mostrarModal = true;
  }

  fecharModal() { this.mostrarModal = false; }

  criarRefeicao() {
    if (!this.novoNome.trim()) { this.erro = 'Dê um nome para a refeição.'; return; }
    this.criando = true;
    this.pratoService.criar(this.novoNome.trim(), this.novoTipo)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => { this.mostrarModal = false; this.criando = false; this.router.navigate(['/prato', r.id]); },
        error: () => { this.erro = 'Erro ao criar refeição.'; this.criando = false; },
      });
  }

  async deletarRefeicao(event: Event, id: number) {
    event.stopPropagation();
    if (!(await this.dialog.confirm('Excluir esta refeição?'))) return;
    this.pratoService.deletar(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => this.refeicoes = this.refeicoes.filter(r => r.id !== id),
      });
  }

  voltar() { this.router.navigate(['/home']); }
}
