import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NOVA_GROUPS, classificarPorNovaGroup } from '../shared/pipes/shared-pipes';
import { ProdutoEscaneado } from '../shared/models';
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
  produto: ProdutoEscaneado | null = null;

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
      this.montarDados(this.produto);
    }
  }

  montarDados(produto: ProdutoEscaneado) {
    this.nomeProduto = produto.nome;
    this.marcaQuantidade = [produto.marca, produto.quantidade].filter(Boolean).join(' – ');

    const classificacao = classificarPorNovaGroup(produto.nova_group);
    const groupInfo = classificacao.hasNova ? NOVA_GROUPS[produto.nova_group!] : null;
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
