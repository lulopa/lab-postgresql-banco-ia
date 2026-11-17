const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' });

/** Documento §5.1: formato obligatorio de moneda. Mostrar siempre con la clase `num` (tabular-nums). */
export const formatCOP = (value: number): string => cop.format(value);

/** Para montos en divisa extranjera (anomalías). */
export const formatMoneda = (value: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
};

const TZ = 'America/Bogota';
export const formatFecha = (iso: string): string =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: TZ }).format(new Date(iso));
export const formatFechaHora = (iso: string): string =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'medium', timeZone: TZ }).format(
    new Date(iso),
  );

/** Enmascara dejando solo los últimos 4 caracteres (defensa en profundidad). */
export const maskLast4 = (v: string): string =>
  v.length <= 4 ? v : `${'•'.repeat(v.length - 4)}${v.slice(-4)}`;
