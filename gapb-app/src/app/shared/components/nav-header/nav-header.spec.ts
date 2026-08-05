import { NavHeaderComponent } from './nav-header';

describe('NavHeaderComponent', () => {
  let component: NavHeaderComponent;

  beforeEach(() => {
    component = new NavHeaderComponent();
  });

  describe('onBack', () => {
    it('deve emitir o evento back', () => {
      const spy = jasmine.createSpy('back');
      component.back.subscribe(spy);

      component.onBack();

      expect(spy).toHaveBeenCalled();
    });
  });
});
