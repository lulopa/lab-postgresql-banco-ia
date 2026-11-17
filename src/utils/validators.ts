export const OTP_LENGTH = 6;
export const isValidOtp = (v: string): boolean => /^\d{6}$/.test(v);

/** Acepta "1500000", "1500000.50" o "1500000,50". Devuelve null si no es válido (>0, máx. 2 decimales). */
export function parseMonto(raw: string): number | null {
  const s = raw.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const isIdCuentaDestino = (v: string): boolean => /^[A-Za-z0-9-]{6,36}$/.test(v.trim());

/** Redacta claves sensibles al mostrar payloads JSONB en la bitácora. */
const SENSITIVE = /(otp|password|clave|secret|token|pin|cvv)/i;
export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? '«redactado»' : redactSensitive(v)]),
    );
  }
  return value;
}
