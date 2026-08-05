import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ZXingScannerModule } from '@zxing/ngx-scanner';
import { BarcodeFormat } from '@zxing/library';
import { ApiService } from '../core/api.service';
import { LocalDbService } from '../core/local-db.service';
import { DialogService } from '../core/dialog.service';
import { CLASSE_PARA_NOVA, classificarPorNovaGroup } from '../shared/pipes/shared-pipes';
import { ItemEscaneado } from '../shared/models';
import { NavHeaderComponent } from '../shared/components/nav-header/nav-header';

@Component({
  selector: 'pag-escaneamento',
  standalone: true,
  imports: [CommonModule, ZXingScannerModule, NavHeaderComponent],
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

  ultimosEscaneados: ItemEscaneado[] = [];

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
    this.api.get<any[]>('/api/alimentos/historico').subscribe({
      next: (historico) => {
        if (historico && historico.length > 0) {
          this.ultimosEscaneados = historico.map(h => {
            const normalizedClasse = h.classificacao_guia?.toLowerCase();
            const nova = normalizedClasse ? CLASSE_PARA_NOVA[normalizedClasse] : undefined;
            const classificacao = classificarPorNovaGroup(nova);
            return {
              nome: h.nome,
              label: classificacao.label,
              tipo: classificacao.tipo,
              barcode: h.codigo_barras,
              imageUrl: h.image_url,
              dados: null
            };
          });
          localStorage.setItem('guiabr_historico_scanner', JSON.stringify(this.ultimosEscaneados));
        } else {
          this.ultimosEscaneados = [];
          localStorage.setItem('guiabr_historico_scanner', JSON.stringify([]));
        }
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

    this.api.get<any>('/api/alimentos/busca', { codigo: barcode }).subscribe({
      next: (res) => {
        this.carregandoDetalhes = false;
        const classificacao = classificarPorNovaGroup(res.product?.nova_group);
        const item: ItemEscaneado = {
          nome: res.product?.product_name || 'Produto desconhecido',
          label: classificacao.label,
          tipo: classificacao.tipo,
          barcode,
          imageUrl: res.product?.image_url || res.product?.image_front_thumb_url || res.product?.image_front_url,
          dados: res,
        };
        localStorage.setItem(`guiabr_produto_${barcode}`, JSON.stringify(res));

        this.ultimosEscaneados = [item, ...this.ultimosEscaneados.filter(h => h.barcode !== barcode)].slice(0, 20);
        localStorage.setItem('guiabr_historico_scanner', JSON.stringify(this.ultimosEscaneados));

        this.router.navigate(['/resultado'], { state: { produto: item.dados } });
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

  verResultado(item: ItemEscaneado) {
    if (item.dados) {
      this.router.navigate(['/resultado'], { state: { produto: item.dados } });
    } else if (item.barcode) {
      const cachedProduct = localStorage.getItem(`guiabr_produto_${item.barcode}`);
      if (cachedProduct) {
        try {
          const res = JSON.parse(cachedProduct);
          item.dados = res;
          this.router.navigate(['/resultado'], { state: { produto: res } });
          return;
        } catch (e) {
          console.error('Erro ao ler produto do cache do localStorage:', e);
        }
      }

      this.carregandoDetalhes = true;
      this.api.get<any>('/api/alimentos/busca', { codigo: item.barcode, historico: 'false' }).subscribe({
        next: (res) => {
          this.carregandoDetalhes = false;
          item.dados = res;
          localStorage.setItem(`guiabr_produto_${item.barcode}`, JSON.stringify(res));
          this.router.navigate(['/resultado'], { state: { produto: res } });
        },
        error: (err) => {
          this.carregandoDetalhes = false;
          console.error('Erro ao buscar detalhes do produto no histórico:', err);
          this.dialog.alert('Erro ao buscar detalhes do produto. Verifique sua conexão de internet.');
        },
      });
    }
  }

  async excluirHistorico(event: Event, item: ItemEscaneado) {
    event.stopPropagation();
    if (!(await this.dialog.confirm('Deseja realmente remover este item do histórico?'))) return;

    this.ultimosEscaneados = this.ultimosEscaneados.filter(h => h.barcode !== item.barcode || h.nome !== item.nome);
    localStorage.setItem('guiabr_historico_scanner', JSON.stringify(this.ultimosEscaneados));
    if (item.barcode) {
      localStorage.removeItem(`guiabr_produto_${item.barcode}`);
    }

    if (navigator.onLine && item.barcode) {
      this.api.delete(`/api/alimentos/historico/${item.barcode}`).subscribe({
        next: () => {
          console.log('Item removido do histórico no backend.');
        },
        error: (err) => {
          console.error('Erro ao excluir item do histórico no backend:', err);
        }
      });
    } else {
      if (item.barcode) {
        this.localDb.addToSyncQueue('deletar_historico', { barcode: item.barcode })
          .then(() => console.log('Exclusão de histórico enfileirada offline.'));
      }
    }
  }

  voltar() {
    this.router.navigate(['/']);
  }
  navegarHome() {
    this.router.navigate(['/']);
  }
}
