import { DialogService, DialogState } from './dialog.service';

describe('DialogService', () => {
  let service: DialogService;

  beforeEach(() => {
    service = new DialogService();
  });

  describe('confirm', () => {
    it('deve emitir um estado do tipo confirm com a mensagem e titulo', () => {
      let estado: DialogState | null = null;
      service.state$.subscribe((s) => (estado = s));

      service.confirm('Tem certeza?', 'Atenção');

      expect(estado!).toBeTruthy();
      expect(estado!.tipo).toBe('confirm');
      expect(estado!.mensagem).toBe('Tem certeza?');
      expect(estado!.titulo).toBe('Atenção');
    });

    it('deve resolver a Promise com o valor passado a responder', async () => {
      const promessa = service.confirm('Tem certeza?');
      service.responder(true);
      await expectAsync(promessa).toBeResolvedTo(true);
    });

    it('deve resolver com false quando responder(false)', async () => {
      const promessa = service.confirm('Tem certeza?');
      service.responder(false);
      await expectAsync(promessa).toBeResolvedTo(false);
    });
  });

  describe('alert', () => {
    it('deve emitir um estado do tipo alert', () => {
      let estado: DialogState | null = null;
      service.state$.subscribe((s) => (estado = s));

      service.alert('Mensagem informativa');

      expect(estado!.tipo).toBe('alert');
      expect(estado!.mensagem).toBe('Mensagem informativa');
    });

    it('deve resolver a Promise quando responder for chamado', async () => {
      const promessa = service.alert('Mensagem');
      service.responder(true);
      await expectAsync(promessa).toBeResolved();
    });
  });

  describe('responder', () => {
    it('deve limpar o estado ativo ao responder', () => {
      const estados: (DialogState | null)[] = [];
      service.state$.subscribe((s) => estados.push(s));

      service.confirm('x');
      service.responder(true);

      expect(estados[estados.length - 1]).toBeNull();
    });

    it('deve ser no-op quando nao ha dialogo ativo', () => {
      expect(() => service.responder(true)).not.toThrow();
    });
  });
});
