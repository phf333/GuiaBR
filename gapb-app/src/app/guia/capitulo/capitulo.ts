import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GuiaService, Capitulo, CardConteudo } from '../guia.service';
import { NavHeaderComponent } from '../../shared/components/nav-header/nav-header';

@Component({
  selector: 'app-capitulo',
  standalone: true,
  imports: [CommonModule, NavHeaderComponent],
  templateUrl: './capitulo.html',
  styleUrl: './capitulo.scss',
  host: { class: 'page-fill' }
})
export class CapituloComponent implements OnInit, AfterViewInit {
  capitulo: Capitulo | null = null;
  paginaAtiva = 0;
  concluidoDisparado = false;

  @ViewChild('carrossel') carrosselRef!: ElementRef<HTMLElement>;

  constructor(
    private router: Router,
    private guiaService: GuiaService
  ) { }

  get fundamentos(): CardConteudo[] {
    return this.capitulo?.cards.filter(c => c.tipo === 'fundamento') ?? [];
  }

  get sabiaque(): CardConteudo | undefined {
    return this.capitulo?.cards.find(c => c.tipo === 'sabia_que');
  }

  ngOnInit() {
    const cap = history.state?.capitulo;

    if (!cap) {
      this.router.navigate(['/guia']);
      return;
    }

    this.capitulo = cap;

    // Restaura a última página visitada
    this.paginaAtiva = this.guiaService.obterUltimoCard(cap.numero);

    // Capítulos com apenas 1 fundamento são concluídos ao entrar (apenas se ainda não estiver concluído)
    if (this.fundamentos.length <= 1 && cap.status !== 'done' && !this.concluidoDisparado) {
      this.concluidoDisparado = true;
      cap.status = 'done';
      this.guiaService.concluirCapitulo(cap.numero);
    }
  }

  ngAfterViewInit() {
    if (this.carrosselRef) {
      const el = this.carrosselRef.nativeElement;
      setTimeout(() => {
        if (this.paginaAtiva > 0) {
          const cards = el.querySelectorAll('.card-conteudo--fundamento');
          if (cards[this.paginaAtiva]) {
            const cardEl = cards[this.paginaAtiva] as HTMLElement;
            // Rola para alinhar o card à esquerda do carrossel (descontando o padding de 16px)
            el.scrollLeft = cardEl.offsetLeft - 16;
          }
        } else {
          // Força o scroll para o início para anular a restauração nativa de scroll do navegador
          el.scrollLeft = 0;
        }
      }, 50);
    }
  }


  onScroll(event: Event) {
    if (!this.capitulo) return;
    const capitulo = this.capitulo;

    const el = event.target as HTMLElement;
    const cards = el.querySelectorAll('.card-conteudo--fundamento');
    const containerRect = el.getBoundingClientRect();

    let menorDistancia = Infinity;
    let novaPagina = 0;

    cards.forEach((card, index) => {
      const cardRect = card.getBoundingClientRect();
      // A borda esquerda do card se alinha com o início do container (considerando os 16px de padding do CSS)
      const distancia = Math.abs(cardRect.left - containerRect.left - 16);
      if (distancia < menorDistancia) {
        menorDistancia = distancia;
        novaPagina = index;
      }
    });

    if (novaPagina !== this.paginaAtiva) {
      this.paginaAtiva = novaPagina;
      // Salva a posição atual sempre que o card mudar
      this.guiaService.salvarUltimoCard(capitulo.numero, novaPagina);
    }

    // Dispara conclusão ao chegar no último card (apenas se tiver mais de 1 e ainda não estiver concluído)
    const ehUltimoCard = this.paginaAtiva === this.fundamentos.length - 1;
    if (this.fundamentos.length > 1 && ehUltimoCard && capitulo.status !== 'done' && !this.concluidoDisparado) {
      this.concluidoDisparado = true;
      capitulo.status = 'done';
      this.guiaService.concluirCapitulo(capitulo.numero);
    }
  }

  irParaCard(index: number) {
    if (this.carrosselRef) {
      const el = this.carrosselRef.nativeElement;
      const cards = el.querySelectorAll('.card-conteudo--fundamento');
      if (cards[index]) {
        const cardEl = cards[index] as HTMLElement;
        el.scrollTo({
          left: cardEl.offsetLeft - 16,
          behavior: 'smooth'
        });
      }
    }
  }

  irParaHome() { this.router.navigate(['/']); }
  voltar() { this.router.navigate(['/guia']); }
}
