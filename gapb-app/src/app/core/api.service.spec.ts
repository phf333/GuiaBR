import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  const base = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('get', () => {
    it('deve fazer GET na URL com baseUrl, sem parametros extras', () => {
      service.get('/api/teste').subscribe();

      const req = httpMock.expectOne((r) => r.url === `${base}/api/teste`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush([]);
    });

    it('deve serializar os params informados', () => {
      service.get('/api/busca', { codigo: 123, ativo: true }).subscribe();

      const req = httpMock.expectOne((r) => r.url === `${base}/api/busca`);
      expect(req.request.params.get('codigo')).toBe('123');
      expect(req.request.params.get('ativo')).toBe('true');
      req.flush([]);
    });

    it('deve ignorar params null ou undefined', () => {
      service
        .get('/api/busca', { a: 'x', b: null as any, c: undefined as any })
        .subscribe();

      const req = httpMock.expectOne((r) => r.url === `${base}/api/busca`);
      expect(req.request.params.get('a')).toBe('x');
      expect(req.request.params.has('b')).toBeFalse();
      expect(req.request.params.has('c')).toBeFalse();
      req.flush([]);
    });

    it('deve entregar o corpo da resposta ao assinante', () => {
      const resposta = [{ id: 1 }];
      let recebido: any;
      service.get<any[]>('/api/lista').subscribe((r) => (recebido = r));

      httpMock.expectOne((r) => r.url === `${base}/api/lista`).flush(resposta);
      expect(recebido).toEqual(resposta);
    });
  });

  describe('post', () => {
    it('deve fazer POST na URL correta com o body', () => {
      const body = { nome: 'x' };
      service.post('/api/refeicoes', body).subscribe();

      const req = httpMock.expectOne(`${base}/api/refeicoes`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush({});
    });
  });

  describe('delete', () => {
    it('deve fazer DELETE na URL correta', () => {
      service.delete('/api/refeicoes/1').subscribe();

      const req = httpMock.expectOne(`${base}/api/refeicoes/1`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });
  });
});
