import {
  classificarPorNovaGroup,
  ClassificacaoNovaPipe,
  ClasseGuiaPipe,
  LabelClassePipe,
  ClasseSafraPipe,
  ClasseClassificacaoPipe,
  TipoIconePipe,
  TipoLabelPipe,
  FormatarDataPipe,
} from './shared-pipes';

describe('classificarPorNovaGroup', () => {
  it('deve classificar grupos 1 a 3 como saudavel', () => {
    [1, 2, 3].forEach((grupo) => {
      const res = classificarPorNovaGroup(grupo);
      expect(res.hasNova).toBeTrue();
      expect(res.tipo).toBe('saudavel');
    });
  });

  it('deve classificar o grupo 4 como ultraprocessado', () => {
    const res = classificarPorNovaGroup(4);
    expect(res.hasNova).toBeTrue();
    expect(res.tipo).toBe('ultraprocessado');
    expect(res.label).toBe('Alimento ultraprocessado');
  });

  it('deve retornar indisponivel para undefined', () => {
    const res = classificarPorNovaGroup(undefined);
    expect(res.hasNova).toBeFalse();
    expect(res.tipo).toBe('indisponivel');
    expect(res.label).toBe('Classificação indisponível');
  });

  it('deve retornar indisponivel para null', () => {
    const res = classificarPorNovaGroup(null);
    expect(res.hasNova).toBeFalse();
    expect(res.tipo).toBe('indisponivel');
  });

  it('deve retornar indisponivel para um grupo inexistente', () => {
    const res = classificarPorNovaGroup(99);
    expect(res.hasNova).toBeFalse();
    expect(res.tipo).toBe('indisponivel');
  });
});

describe('ClassificacaoNovaPipe', () => {
  it('deve devolver a classificacao do grupo NOVA', () => {
    const pipe = new ClassificacaoNovaPipe();
    expect(pipe.transform(4).tipo).toBe('ultraprocessado');
    expect(pipe.transform(null).tipo).toBe('indisponivel');
  });
});

describe('ClasseGuiaPipe', () => {
  let pipe: ClasseGuiaPipe;

  beforeEach(() => {
    pipe = new ClasseGuiaPipe();
  });

  describe('transform', () => {
    it('deve mapear uma classe conhecida para sua classe CSS', () => {
      expect(pipe.transform('in natura')).toBe('guia-in-natura');
      expect(pipe.transform('ultraprocessado')).toBe('guia-ultraprocessado');
    });

    it('deve normalizar maiusculas antes de mapear', () => {
      expect(pipe.transform('IN NATURA')).toBe('guia-in-natura');
    });

    it('deve retornar string vazia para classe desconhecida', () => {
      expect(pipe.transform('inexistente')).toBe('');
    });

    it('deve retornar string vazia para entrada vazia/undefined', () => {
      expect(pipe.transform('')).toBe('');
      expect(pipe.transform(undefined as unknown as string)).toBe('');
    });
  });
});

describe('LabelClassePipe', () => {
  let pipe: LabelClassePipe;

  beforeEach(() => {
    pipe = new LabelClassePipe();
  });

  describe('transform', () => {
    it('deve mapear uma classe conhecida para seu label', () => {
      expect(pipe.transform('ingrediente culinario')).toBe('Ing. culinário');
    });

    it('deve retornar a propria entrada quando desconhecida', () => {
      expect(pipe.transform('outra')).toBe('outra');
    });
  });
});

describe('ClasseSafraPipe', () => {
  let pipe: ClasseSafraPipe;

  beforeEach(() => {
    pipe = new ClasseSafraPipe();
  });

  describe('transform', () => {
    it('deve prefixar o nivel normalizado com "safra-"', () => {
      expect(pipe.transform('Alta')).toBe('safra-alta');
    });

    it('deve retornar safra-fora quando o nivel for indefinido', () => {
      expect(pipe.transform(undefined)).toBe('safra-fora');
    });
  });
});

describe('ClasseClassificacaoPipe', () => {
  let pipe: ClasseClassificacaoPipe;

  beforeEach(() => {
    pipe = new ClasseClassificacaoPipe();
  });

  describe('transform', () => {
    it('deve mapear cada classificacao para sua cor', () => {
      expect(pipe.transform('adequada')).toBe('classificacao-verde');
      expect(pipe.transform('parcial')).toBe('classificacao-amarelo');
      expect(pipe.transform('inadequada')).toBe('classificacao-vermelho');
    });

    it('deve retornar string vazia para entrada vazia', () => {
      expect(pipe.transform('')).toBe('');
    });

    it('deve retornar string vazia para classificacao desconhecida', () => {
      expect(pipe.transform('outra')).toBe('');
    });
  });
});

describe('TipoIconePipe', () => {
  let pipe: TipoIconePipe;

  beforeEach(() => {
    pipe = new TipoIconePipe();
  });

  describe('transform', () => {
    it('deve retornar o icone do tipo conhecido', () => {
      expect(pipe.transform('almoco')).toBe('🥗');
    });

    it('deve retornar o icone padrao para tipo desconhecido', () => {
      expect(pipe.transform('desconhecido')).toBe('🍽️');
    });
  });
});

describe('TipoLabelPipe', () => {
  let pipe: TipoLabelPipe;

  beforeEach(() => {
    pipe = new TipoLabelPipe();
  });

  describe('transform', () => {
    it('deve retornar o label do tipo conhecido', () => {
      expect(pipe.transform('cafe_manha')).toBe('Café da manhã');
    });

    it('deve retornar a propria entrada para tipo desconhecido', () => {
      expect(pipe.transform('brunch')).toBe('brunch');
    });
  });
});

describe('FormatarDataPipe', () => {
  let pipe: FormatarDataPipe;

  beforeEach(() => {
    pipe = new FormatarDataPipe();
  });

  describe('transform', () => {
    it('deve formatar uma data ISO no padrao pt-BR (dia/mes)', () => {
      const resultado = pipe.transform('2024-03-15T12:00:00Z');
      expect(resultado).toContain('15');
      // O mês abreviado em pt-BR para março é "mar."
      expect(resultado.toLowerCase()).toContain('mar');
    });

    it('deve retornar string vazia para entrada vazia', () => {
      expect(pipe.transform('')).toBe('');
    });
  });
});
