import { Router } from '@angular/router';
import { fakeAsync, tick } from '@angular/core/testing';
import { CapituloComponent } from './capitulo';
import { GuiaService, Capitulo } from '../guia.service';

describe('CapituloComponent', () => {
  let component: CapituloComponent;
  let routerSpy: jasmine.SpyObj<Router>;
  let guiaServiceMock: jasmine.SpyObj<GuiaService>;

  function capitulo(over: Partial<Capitulo> = {}): Capitulo {
    return {
      numero: 1,
      titulo: 'Cap',
      status: 'active',
      cards: [
        { tipo: 'fundamento', texto: 'f1' },
        { tipo: 'fundamento', texto: 'f2' },
        { tipo: 'sabia_que', texto: 's1' },
      ],
      ...over,
    };
  }

  function mockHistoryState(state: any) {
    spyOnProperty(history, 'state', 'get').and.returnValue(state);
  }

  /** Cria um ElementRef fake para o carrossel, com cards posicionados pelos offsets dados. */
  function fakeCarrossel(offsets: number[]): any {
    const cards = offsets.map((offsetLeft) => ({ offsetLeft }));
    return {
      nativeElement: {
        querySelectorAll: () => cards,
        scrollLeft: 0,
        scrollTo: jasmine.createSpy('scrollTo'),
      },
    };
  }

  /** Cria um Event fake de scroll cujo target expõe cards com getBoundingClientRect().left. */
  function fakeScrollEvent(containerLeft: number, cardLefts: number[]): Event {
    const cards = cardLefts.map((left) => ({
      getBoundingClientRect: () => ({ left }),
    }));
    const target: any = {
      querySelectorAll: () => cards,
      getBoundingClientRect: () => ({ left: containerLeft }),
    };
    return { target } as unknown as Event;
  }

  beforeEach(() => {
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    guiaServiceMock = jasmine.createSpyObj('GuiaService', [
      'obterUltimoCard',
      'salvarUltimoCard',
      'concluirCapitulo',
    ]);
    guiaServiceMock.obterUltimoCard.and.returnValue(0);
    component = new CapituloComponent(routerSpy, guiaServiceMock);
  });

  describe('getters fundamentos/sabiaque', () => {
    it('deve retornar apenas os cards do tipo fundamento', () => {
      component.capitulo = capitulo();
      expect(component.fundamentos.length).toBe(2);
    });

    it('deve retornar o card sabia_que', () => {
      component.capitulo = capitulo();
      expect(component.sabiaque?.texto).toBe('s1');
    });

    it('deve retornar lista vazia quando nao ha capitulo', () => {
      component.capitulo = null;
      expect(component.fundamentos).toEqual([]);
    });
  });

  describe('ngOnInit', () => {
    it('deve redirecionar para /guia quando nao ha capitulo no history.state', () => {
      mockHistoryState({});

      component.ngOnInit();

      expect(routerSpy.navigate).toHaveBeenCalledWith(['/guia']);
      expect(component.capitulo).toBeNull();
    });

    it('deve restaurar a ultima pagina visitada', () => {
      mockHistoryState({ capitulo: capitulo() });
      guiaServiceMock.obterUltimoCard.and.returnValue(1);

      component.ngOnInit();

      expect(component.paginaAtiva).toBe(1);
    });

    it('deve concluir automaticamente um capitulo com apenas 1 fundamento', () => {
      const cap = capitulo({ cards: [{ tipo: 'fundamento', texto: 'unico' }], status: 'active' });
      mockHistoryState({ capitulo: cap });

      component.ngOnInit();

      expect(guiaServiceMock.concluirCapitulo).toHaveBeenCalledWith(1);
      expect(cap.status).toBe('done');
    });

    it('nao deve reconcluir um capitulo ja concluido', () => {
      const cap = capitulo({ cards: [{ tipo: 'fundamento', texto: 'unico' }], status: 'done' });
      mockHistoryState({ capitulo: cap });

      component.ngOnInit();

      expect(guiaServiceMock.concluirCapitulo).not.toHaveBeenCalled();
    });
  });

  describe('navegacao', () => {
    it('irParaHome deve navegar para a raiz', () => {
      component.irParaHome();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/']);
    });

    it('voltar deve navegar para /guia', () => {
      component.voltar();
      expect(routerSpy.navigate).toHaveBeenCalledWith(['/guia']);
    });
  });

  describe('ngAfterViewInit', () => {
    it('nao deve fazer nada quando carrosselRef nao esta definido', () => {
      expect(() => component.ngAfterViewInit()).not.toThrow();
    });

    it('deve zerar o scroll quando paginaAtiva e 0', fakeAsync(() => {
      const ref = fakeCarrossel([0, 300, 600]);
      component.carrosselRef = ref;
      component.paginaAtiva = 0;

      component.ngAfterViewInit();
      tick(50);

      expect(ref.nativeElement.scrollLeft).toBe(0);
    }));

    it('deve rolar ate o card da pagina ativa quando paginaAtiva > 0', fakeAsync(() => {
      const ref = fakeCarrossel([0, 300, 600]);
      component.carrosselRef = ref;
      component.paginaAtiva = 1;

      component.ngAfterViewInit();
      tick(50);

      expect(ref.nativeElement.scrollLeft).toBe(300 - 16);
    }));
  });

  describe('irParaCard', () => {
    it('nao deve fazer nada quando carrosselRef nao esta definido', () => {
      expect(() => component.irParaCard(0)).not.toThrow();
    });

    it('deve chamar scrollTo com o offset do card alvo', () => {
      const ref = fakeCarrossel([0, 300, 600]);
      component.carrosselRef = ref;

      component.irParaCard(2);

      expect(ref.nativeElement.scrollTo).toHaveBeenCalledWith({ left: 600 - 16, behavior: 'smooth' });
    });

    it('nao deve chamar scrollTo quando o indice nao existe', () => {
      const ref = fakeCarrossel([0, 300]);
      component.carrosselRef = ref;

      component.irParaCard(5);

      expect(ref.nativeElement.scrollTo).not.toHaveBeenCalled();
    });
  });

  describe('onScroll', () => {
    it('nao deve fazer nada quando nao ha capitulo carregado', () => {
      component.capitulo = null;

      expect(() => component.onScroll(fakeScrollEvent(0, [0]))).not.toThrow();
      expect(guiaServiceMock.salvarUltimoCard).not.toHaveBeenCalled();
    });

    it('deve atualizar paginaAtiva para o card mais proximo do inicio do container', () => {
      component.capitulo = capitulo();
      component.paginaAtiva = 0;

      component.onScroll(fakeScrollEvent(0, [400, 16, 800]));

      expect(component.paginaAtiva).toBe(1);
      expect(guiaServiceMock.salvarUltimoCard).toHaveBeenCalledWith(1, 1);
    });

    it('deve concluir o capitulo ao chegar no ultimo card', () => {
      const cap = capitulo({ status: 'active' }); // 2 fundamentos
      component.capitulo = cap;
      component.paginaAtiva = 0;

      // o segundo card fica mais perto do inicio do container => vira o ultimo card
      component.onScroll(fakeScrollEvent(0, [400, 16]));

      expect(component.paginaAtiva).toBe(1);
      expect(guiaServiceMock.concluirCapitulo).toHaveBeenCalledWith(1);
      expect(cap.status).toBe('done');
    });

    it('nao deve concluir novamente um capitulo ja concluido', () => {
      const cap = capitulo({ status: 'done' });
      component.capitulo = cap;
      component.paginaAtiva = 0;

      component.onScroll(fakeScrollEvent(0, [400, 16]));

      expect(guiaServiceMock.concluirCapitulo).not.toHaveBeenCalled();
    });
  });
});
