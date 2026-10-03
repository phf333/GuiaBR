import { firstValueFrom, of, throwError } from 'rxjs';
import { comFallbackLocal } from './offline';

describe('comFallbackLocal', () => {
  let chamarApi: jasmine.Spy;
  let fallbackLocal: jasmine.Spy;

  beforeEach(() => {
    chamarApi = jasmine.createSpy('chamarApi').and.returnValue(of('servidor'));
    fallbackLocal = jasmine.createSpy('fallbackLocal').and.resolveTo('local');
    spyOn(console, 'warn');
  });

  it('online: deve usar a resposta da API sem tocar o caminho local', async () => {
    const res = await firstValueFrom(comFallbackLocal(true, chamarApi, fallbackLocal, 'erro'));

    expect(res).toBe('servidor');
    expect(fallbackLocal).not.toHaveBeenCalled();
  });

  it('offline: deve usar o caminho local sem chamar a API', async () => {
    const res = await firstValueFrom(comFallbackLocal(false, chamarApi, fallbackLocal, 'erro'));

    expect(res).toBe('local');
    expect(chamarApi).not.toHaveBeenCalled();
  });

  it('online com erro: deve cair para o caminho local e registrar o aviso', async () => {
    const erro = new Error('falha');
    chamarApi.and.returnValue(throwError(() => erro));

    const res = await firstValueFrom(comFallbackLocal(true, chamarApi, fallbackLocal, 'mensagem'));

    expect(res).toBe('local');
    expect(console.warn).toHaveBeenCalledWith('mensagem', erro);
  });

  it('deve propagar o erro do caminho local', async () => {
    fallbackLocal.and.rejectWith(new Error('sem cache'));

    await expectAsync(firstValueFrom(comFallbackLocal(false, chamarApi, fallbackLocal, 'erro')))
      .toBeRejectedWithError('sem cache');
  });
});
