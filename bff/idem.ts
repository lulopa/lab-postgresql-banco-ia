/** Caché de respuestas por clave de idempotencia para operaciones que la BD no deduplica (eventos, cierre). */
const cache = new Map<string, { sub: string; result: unknown; exp: number }>();
const TTL = 10 * 60_000;

export function replay<T>(sub: string, key: string): T | undefined {
  const e = cache.get(key);
  if (!e || Date.now() > e.exp) {
    cache.delete(key);
    return undefined;
  }
  return e.sub === sub ? (e.result as T) : undefined;
}
export function remember(sub: string, key: string, result: unknown): void {
  cache.set(key, { sub, result, exp: Date.now() + TTL });
}
