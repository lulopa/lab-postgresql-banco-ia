import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/services/apiClient';
import { uuidv4 } from '@/utils/uuid';

/**
 * Ejecuta una acción de escritura con clave de idempotencia estable por "intención":
 *  - Misma petición (huella idéntica) tras un fallo de resultado DESCONOCIDO (red, 408, 5xx)
 *    => se reenvía la MISMA X-Idempotency-Key.
 *  - Éxito, error definitivo (4xx) o petición distinta => clave nueva en el siguiente envío.
 *  - Doble clic / reenvío mientras hay una petición en vuelo => se devuelve la misma promesa (1 solo POST).
 */
export function useIdempotentAction<TReq, TRes>(
  action: (req: TReq, key: string) => Promise<TRes>,
  onSuccess?: (res: TRes) => void,
) {
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  const pending = useRef<Promise<TRes> | null>(null);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | Error | null>(null);

  const run = useCallback(
    (req: TReq): Promise<TRes> => {
      if (pending.current) return pending.current;
      const fingerprint = JSON.stringify(req);
      if (!intent.current || intent.current.fingerprint !== fingerprint)
        intent.current = { fingerprint, key: uuidv4() };
      const { key } = intent.current;
      setError(null);
      setPending(true);
      const p = action(req, key)
        .then((res) => {
          intent.current = null;
          onSuccess?.(res);
          return res;
        })
        .catch((e: unknown) => {
          if (!(e instanceof ApiError && e.outcomeUnknown)) intent.current = null;
          setError(e instanceof Error ? e : new Error(String(e)));
          throw e;
        })
        .finally(() => {
          pending.current = null;
          setPending(false);
        });
      pending.current = p;
      return p;
    },
    [action, onSuccess],
  );

  return { run, isPending, error, clearError: () => setError(null) };
}
