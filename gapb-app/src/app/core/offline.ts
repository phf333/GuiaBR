import { Observable, ObservableInput, catchError, defer } from 'rxjs';

/**
 * Tenta a chamada online e cai para o caminho local quando o aparelho está offline
 * ou a chamada falha. O caminho local é quem lê o cache ou enfileira a escrita.
 */
export function comFallbackLocal<T>(
  online: boolean,
  chamarApi: () => Observable<T>,
  fallbackLocal: () => ObservableInput<T>,
  mensagemErro: string
): Observable<T> {
  const local = defer(fallbackLocal);
  if (!online) return local;
  return chamarApi().pipe(
    catchError((err) => {
      console.warn(mensagemErro, err);
      return local;
    })
  );
}
