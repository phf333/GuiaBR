import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NOVA_GROUPS, classificarPorNovaGroup } from '../shared/pipes/shared-pipes';
import { NavHeaderComponent } from '../shared/components/nav-header/nav-header';

@Component({
  selector: 'resultado-escaneamento',
  standalone: true,
  imports: [CommonModule, NavHeaderComponent],
  templateUrl: './resultado-escaneamento.html',
  styleUrl: './resultado-escaneamento.scss',
  host: { class: 'page-fill' },
})
export class ResultadoComponent implements OnInit {
  produto: any = null;

  nomeProduto = '';
  marcaQuantidade = '';
  alertaTitulo = '';
  alertaDescricao = '';
  alertaClass = '';
  alertaIcone = '';

  constructor(private router: Router) {
    const nav = this.router.getCurrentNavigation();
    this.produto = nav?.extras?.state?.['produto'] ?? history.state?.produto ?? null;
  }

  ngOnInit() {
    if (this.produto) {
      this.montarDados();
    }
  }

  montarDados() {
    const p = this.produto.product;
    this.nomeProduto = p?.product_name || 'Produto desconhecido';
    this.marcaQuantidade = [p?.brands, p?.quantity].filter(Boolean).join(' – ');

    const nova: number = p?.nova_group;
    const classificacao = classificarPorNovaGroup(nova);
    const groupInfo = classificacao.hasNova ? NOVA_GROUPS[nova] : null;
    this.alertaTitulo = groupInfo?.titulo ?? 'CLASSIFICAÇÃO INDISPONÍVEL';
    this.alertaDescricao = groupInfo?.descricao ?? 'Não foi possível obter o grau de processamento deste produto.';
    this.alertaClass = classificacao.tipo === 'ultraprocessado'
      ? 'alerta--vermelho'
      : (classificacao.tipo === 'saudavel' ? 'alerta--verde' : 'alerta--cinza');
    this.alertaIcone = classificacao.tipo === 'ultraprocessado'
      ? 'alert-circle'
      : (classificacao.tipo === 'saudavel' ? 'check-circle' : 'info-circle');
  }

  voltar() {
    this.router.navigate(['/escanear']);
  }
  navegarHome() {
    this.router.navigate(['/']);
  }
}
