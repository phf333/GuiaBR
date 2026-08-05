export type TipoRefeicao = 'cafe_manha' | 'lanche' | 'almoco' | 'jantar';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  data_cadastro?: string;
}

export interface SazonalidadeAtual {
  valor: number;
  texto: string;
  nivel: 'alta' | 'media' | 'baixa' | 'fora';
}

export interface Alimento {
  id: number;
  nome: string;
  grupo: string;
  classificacao_guia: string;
  codigo_barras?: string;
  dados_completos?: any;
  sazonalidade_atual: SazonalidadeAtual | null;
  categoria_guia?: string;
}

export interface ItemRefeicao {
  alimento_id: number;
  nome: string;
  grupo: string;
  classificacao_guia: string;
  categoria_guia: string;
  sazonalidade_atual: SazonalidadeAtual | null;
}

export interface CriterioChecklist {
  id: string;
  label: string;
  obrigatorio: boolean;
  dica: string;
  cumprido: boolean;
}

export interface AnaliseRefeicao {
  classificacao: 'adequada' | 'parcial' | 'inadequada';
  mensagem: string;
  checklist: CriterioChecklist[];
  obrigatorios_cumpridos: number;
  obrigatorios_total: number;
}

export interface Refeicao {
  id: number;
  nome_refeicao: string;
  tipo_refeicao: TipoRefeicao;
  data_criacao: string;
  total_itens: number;
  itens?: ItemRefeicao[];
  analise?: AnaliseRefeicao;
}

export interface ItemEscaneado {
  nome: string;
  label: string;
  tipo: 'ultraprocessado' | 'saudavel' | 'indisponivel';
  barcode: string;
  dados: any;
  imageUrl?: string;
}
