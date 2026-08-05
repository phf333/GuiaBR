import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, Subject, from } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { PratoService } from '../prato.service';
import { LocalDbService } from '../../core/local-db.service';
import { Alimento, Refeicao, ItemRefeicao } from '../../shared/models';
import {
  TipoIconePipe,
  TipoLabelPipe,
  ClasseGuiaPipe,
  LabelClassePipe,
  ClasseSafraPipe,
  ClasseClassificacaoPipe,
} from '../../shared/pipes/shared-pipes';

@Component({
  selector: 'app-prato-detalhe',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TipoIconePipe,
    TipoLabelPipe,
    ClasseGuiaPipe,
    LabelClassePipe,
    ClasseSafraPipe,
    ClasseClassificacaoPipe,
  ],
  templateUrl: './prato-detalhe.html',
  styleUrl: './prato-detalhe.scss',
  host: { class: 'page-fill' },
})
export class PratoDetalheComponent implements OnInit, OnDestroy {
  refeicao: Refeicao | null = null;
  carregando = true;
  buscaQuery = '';
  resultadosBusca: Alimento[] = [];
  buscando = false;
  soSafra = false;
  filtroProcessamento = '';
  confirmado = false;

  private adicionadosSet = new Set<number>();
  private buscaSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private pratoService: PratoService,
    private localDb: LocalDbService
  ) {}

  ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.carregarRefeicao(id);

    this.buscaSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.atualizarResultados();
    });

    this.atualizarResultados();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  carregarRefeicao(id: number) {
    this.carregando = true;
    this.pratoService.obter(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.refeicao = data;
          this.carregando = false;
          this.atualizarAdicionados();
          this.confirmado = (data.itens?.length ?? 0) > 0;
        },
        error: () => this.carregando = false,
      });
  }

  onBusca(q: string) {
    if (q.trim() === '') {
      this.atualizarResultados();
    } else {
      this.buscaSubject.next(q);
    }
  }

  toggleSafra() {
    this.soSafra = !this.soSafra;
    this.atualizarResultados();
  }

  onFiltroProcessamentoChange() {
    this.atualizarResultados();
  }

  atualizarResultados() {
    this.buscando = true;
    from(this.localDb.searchAlimentos(this.buscaQuery, this.soSafra, this.filtroProcessamento))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (r) => {
          this.resultadosBusca = r;
          this.buscando = false;
        },
        error: () => {
          this.buscando = false;
        }
      });
  }

  adicionarAlimento(alimento: Alimento) {
    if (!this.refeicao) return;
    this.confirmado = false;
    this.pratoService.adicionarItem(this.refeicao.id, alimento.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.refeicao = updated;
          this.atualizarAdicionados();
          this.buscaQuery = '';
          this.atualizarResultados();
        },
      });
  }

  removerItem(alimentoId: number) {
    if (!this.refeicao) return;
    this.confirmado = false;
    this.pratoService.removerItem(this.refeicao.id, alimentoId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.refeicao = updated;
          this.atualizarAdicionados();
        },
      });
  }

  confirmarEscolha() { this.confirmado = true; }

  jaAdicionado(alimentoId: number): boolean {
    return this.adicionadosSet.has(alimentoId);
  }

  private atualizarAdicionados() {
    this.adicionadosSet = new Set(
      (this.refeicao?.itens ?? []).map((i: ItemRefeicao) => i.alimento_id)
    );
  }

  voltar() { this.router.navigate(['/prato']); }
}
