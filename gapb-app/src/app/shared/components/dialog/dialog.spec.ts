import { of } from 'rxjs';
import { DialogComponent } from './dialog';
import { DialogService } from '../../../core/dialog.service';

describe('DialogComponent', () => {
  let component: DialogComponent;
  let dialogSpy: jasmine.SpyObj<DialogService>;

  beforeEach(() => {
    dialogSpy = jasmine.createSpyObj('DialogService', ['responder'], {
      state$: of(null),
    });
    component = new DialogComponent(dialogSpy);
  });

  describe('state$', () => {
    it('deve expor o state$ do DialogService', () => {
      expect(component.state$).toBe(dialogSpy.state$);
    });
  });

  describe('responder', () => {
    it('deve delegar a resposta ao DialogService', () => {
      component.responder(true);
      expect(dialogSpy.responder).toHaveBeenCalledWith(true);
    });
  });
});
