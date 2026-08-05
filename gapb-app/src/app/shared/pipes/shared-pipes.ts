import { Pipe, PipeTransform } from '@angular/core';

// ---------------------------------------------------------------------------
// Constantes e Mapeamentos Unificados
// ---------------------------------------------------------------------------

export interface NovaGroupInfo {
  titulo: string;
  label: string;
  descricao: string;
  tipo: 'saudavel' | 'ultraprocessado';
}

export const NOVA_GROUPS: Record<number, NovaGroupInfo> = {
  1: {
    titulo: 'ALIMENTO IN NATURA',
    label: 'Alimento in natura',
    descricao: 'Alimento natural ou minimamente processado.',
    tipo: 'saudavel'
  },
  2: {
    titulo: 'INGREDIENTE CULINÁRIO',
    label: 'Ingrediente culinário',
    descricao: 'Usado para temperar ou cozinhar alimentos.',
    tipo: 'saudavel'
  },
  3: {
    titulo: 'ALIMENTO PROCESSADO',
    label: 'Alimento processado',
    descricao: 'Contém aditivos para durabilidade ou sabor.',
    tipo: 'saudavel'
  },
  4: {
    titulo: 'ALIMENTO ULTRAPROCESSADO',
    label: 'Alimento ultraprocessado',
    descricao: 'Alimentos altamente processados com aditivos artificiais e baixo valor nutricional.',
    tipo: 'ultraprocessado'
  }
};

/** Inverso de NOVA_GROUPS: converte a string classificacao_guia no número do grupo NOVA (1-4). */
export const CLASSE_PARA_NOVA: Record<string, number> = {
  'in natura': 1,
  'ingrediente culinario': 2,
  'processado': 3,
  'ultraprocessado': 4,
};

export interface ClassificacaoNova {
  hasNova: boolean;
  label: string;
  tipo: 'ultraprocessado' | 'saudavel' | 'indisponivel';
}

/** Determina rótulo e tipo (para exibição) a partir de um grupo NOVA (1-4), possivelmente ausente. */
export function classificarPorNovaGroup(novaGroup: number | undefined | null): ClassificacaoNova {
  const hasNova = novaGroup !== undefined && novaGroup !== null && NOVA_GROUPS[novaGroup] !== undefined;
  return {
    hasNova,
    label: hasNova ? (NOVA_GROUPS[novaGroup as number]?.label ?? 'Classificação indisponível') : 'Classificação indisponível',
    tipo: hasNova ? ((novaGroup as number) >= 4 ? 'ultraprocessado' : 'saudavel') : 'indisponivel',
  };
}

const CLASSES_GUIA: Record<string, string> = {
  'in natura': 'guia-in-natura',
  'minimamente processado': 'guia-in-natura',
  'ingrediente culinario': 'guia-ingrediente-culinario',
  'processado': 'guia-processado',
  'ultraprocessado': 'guia-ultraprocessado',
};

const LABELS_CLASSE: Record<string, string> = {
  'in natura': 'In natura',
  'minimamente processado': 'Minimamente processado',
  'ingrediente culinario': 'Ing. culinário',
  'processado': 'Processado',
  'ultraprocessado': 'Ultraprocessado',
};

export const TIPO_ICONES: Record<string, string> = {
  cafe_manha: '☀️',
  lanche: '🍎',
  almoco: '🥗',
  jantar: '🌙',
};

export const TIPO_LABELS: Record<string, string> = {
  cafe_manha: 'Café da manhã',
  lanche: 'Lanche',
  almoco: 'Almoço',
  jantar: 'Jantar',
};

// ---------------------------------------------------------------------------
// Pipes de Formatação do Guia Alimentar e Refeições
// ---------------------------------------------------------------------------

@Pipe({ name: 'classeGuia', standalone: true, pure: true })
export class ClasseGuiaPipe implements PipeTransform {
  transform(classe: string): string {
    return CLASSES_GUIA[classe?.toLowerCase()] ?? '';
  }
}

@Pipe({ name: 'labelClasse', standalone: true, pure: true })
export class LabelClassePipe implements PipeTransform {
  transform(classe: string): string {
    return LABELS_CLASSE[classe?.toLowerCase()] ?? classe;
  }
}

@Pipe({ name: 'classeSafra', standalone: true, pure: true })
export class ClasseSafraPipe implements PipeTransform {
  transform(nivel: string | undefined): string {
    if (!nivel) return 'safra-fora';
    return 'safra-' + nivel.toLowerCase();
  }
}

@Pipe({ name: 'classeClassificacao', standalone: true, pure: true })
export class ClasseClassificacaoPipe implements PipeTransform {
  transform(classificacao: string): string {
    if (!classificacao) return '';
    const mapa: Record<string, string> = {
      adequada: 'classificacao-verde',
      parcial: 'classificacao-amarelo',
      inadequada: 'classificacao-vermelho'
    };
    return mapa[classificacao.toLowerCase()] ?? '';
  }
}

@Pipe({ name: 'tipoIcone', standalone: true, pure: true })
export class TipoIconePipe implements PipeTransform {
  transform(tipo: string): string {
    return TIPO_ICONES[tipo] ?? '🍽️';
  }
}

@Pipe({ name: 'tipoLabel', standalone: true, pure: true })
export class TipoLabelPipe implements PipeTransform {
  transform(tipo: string): string {
    return TIPO_LABELS[tipo] ?? tipo;
  }
}

@Pipe({ name: 'formatarData', standalone: true, pure: true })
export class FormatarDataPipe implements PipeTransform {
  transform(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }
}
