import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { DialogService } from '../core/dialog.service';
import { ClassificacaoNovaPipe } from '../shared/pipes/shared-pipes';
import { ProdutoEscaneado } from '../shared/models';
import { NavHeaderComponent } from '../shared/components/nav-header/nav-header';

@Component({
  selector: 'pag-escaneamento',
  standalone: true,
  imports: [CommonModule, ZXingScannerModule, NavHeaderComponent, ClassificacaoNovaPipe],
  templateUrl: './pag-escaneamento.html',
  styleUrl: './pag-escaneamento.scss',
  host: { class: 'page-fill page-fill--relative' },
})
export class EscanearComponent implements OnInit {
  constructor(
    private api: ApiService,
    private router: Router,
    private localDb: LocalDbService,
    private dialog: DialogService,
  ) { }

  showScanner = false;
  carregandoDetalhes = false;
  allowedFormats = [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A];

  ultimosEscaneados: ProdutoEscaneado[] = [];

  ngOnInit() {
    const cached = localStorage.getItem('guiabr_historico_scanner');
    if (cached) {
      try {
        this.ultimosEscaneados = JSON.parse(cached);
      } catch (e) {
        console.error('Erro ao ler histórico do cache local:', e);
      }
    }
    this.carregarHistorico();
  }

  carregarHistorico() {
    this.api.get<ProdutoEscaneado[]>('/api/alimentos/historico').subscribe({
      next: (historico) => {
        this.ultimosEscaneados = historico ?? [];
        localStorage.setItem('guiabr_historico_scanner', JSON.stringify(this.ultimosEscaneados));
      },
      error: (err) => {
        console.warn('Erro ao carregar histórico do backend, lendo do cache local:', err);
        const cached = localStorage.getItem('guiabr_historico_scanner');
        if (cached) {
          try {
            this.ultimosEscaneados = JSON.parse(cached);
          } catch (e) {
            console.error('Erro ao fazer parse do histórico cacheado:', e);
          }
        }
      }
    });
  }

  onClick() {
    this.showScanner = true;
  }

  isValidBarcode(barcode: string): boolean {
    if (!barcode || !/^\d+$/.test(barcode)) {
      return false;
    }
    if (![8, 12, 13, 14].includes(barcode.length)) {
      return false;
    }

    const digits = barcode.split('').map(Number);
    const checkDigit = digits.pop()!;

    let sum = 0;
    const reversedDigits = digits.reverse();
    for (let i = 0; i < reversedDigits.length; i++) {
      const weight = i % 2 === 0 ? 3 : 1;
      sum += reversedDigits[i] * weight;
    }

    const calculatedCheckDigit = (10 - (sum % 10)) % 10;
    return checkDigit === calculatedCheckDigit;
  }

  handleScanSuccess(barcode: string) {
    if (!this.isValidBarcode(barcode)) {
      return;
    }

    this.showScanner = false;
    this.carregandoDetalhes = true;

    this.api.get<ProdutoEscaneado>('/api/alimentos/busca', { codigo: barcode }).subscribe({
      next: (produto) => {
        this.carregandoDetalhes = false;
        this.ultimosEscaneados = [
          produto,
          ...this.ultimosEscaneados.filter(h => h.codigo_barras !== produto.codigo_barras),
        ].slice(0, 20);
        localStorage.setItem('guiabr_historico_scanner', JSON.stringify(this.ultimosEscaneados));

        this.verResultado(produto);
      },
      error: (err) => {
        this.carregandoDetalhes = false;
        console.error('Erro na requisição de busca do backend:', err);
        if (err.status === 0) {
          this.dialog.alert('Erro de conexão com o servidor. Verifique se o backend está ativo e se o certificado SSL foi aceito na porta 5000.');
        } else {
          this.dialog.alert('Produto não encontrado ou não cadastrado na base de dados.');
        }
      },
    });
  }

  verResultado(produto: ProdutoEscaneado) {
    this.router.navigate(['/resultado'], { state: { produto } });
  }

  async excluirHistorico(event: Event, item: ProdutoEscaneado) {
    event.stopPropagation();
    if (!(await this.dialog.confirm('Deseja realmente remover este item do histórico?'))) return;

    this.ultimosEscaneados = this.ultimosEscaneados.filter(h => h.codigo_barras !== item.codigo_barras);
    localStorage.setItem('guiabr_historico_scanner', JSON.stringify(this.ultimosEscaneados));

    if (navigator.onLine) {
      this.api.delete(`/api/alimentos/historico/${item.codigo_barras}`).subscribe({
        next: () => {
          console.log('Item removido do histórico no backend.');
        },
        error: (err) => {
          console.error('Erro ao excluir item do histórico no backend:', err);
        }
      });
    } else {
      this.localDb.addToSyncQueue('deletar_historico', { barcode: item.codigo_barras })
        .then(() => console.log('Exclusão de histórico enfileirada offline.'));
    }
  }

  voltar() {
    this.router.navigate(['/']);
  }
  navegarHome() {
    this.router.navigate(['/']);
  }
}
