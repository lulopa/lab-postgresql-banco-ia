import { appendFileSync } from 'node:fs';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { config } from './config';
import { problem } from './problem';

/**
 * OTP de 6 dígitos para operaciones sensibles. La base de datos no tiene OTP.
 * DESARROLLO: el código se imprime en la consola del BFF. PRODUCCIÓN: reemplazar `deliver` por el proveedor SMS/correo.
 */
const store = new Map<string, { code: string; exp: number; tries: number }>();

function deliver(sub: string, code: string): void {
  // Solo para pruebas E2E automatizadas (nunca en producción): vuelca el OTP a un archivo.
  if (!config.production && process.env.E2E_OTP_FILE)
    appendFileSync(process.env.E2E_OTP_FILE, `${sub} ${code}\n`);
  if (!config.production)
    console.log(`[DEV OTP] usuario ${sub}: ${code} (válido ${config.otpTtlMs / 1000}s)`);
  // TODO producción: enviar por SMS/correo; nunca registrar el código.
}

export function issueOtp(sub: string): { canal: 'SMS'; ttl_segundos: number } {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  store.set(sub, { code, exp: Date.now() + config.otpTtlMs, tries: 0 });
  deliver(sub, code);
  return { canal: 'SMS', ttl_segundos: config.otpTtlMs / 1000 };
}

/** Un solo uso, vence a los 2 minutos y se bloquea tras 5 intentos fallidos. */
export function consumeOtp(sub: string, given: unknown): void {
  const e = store.get(sub);
  const fail = () =>
    problem(
      422,
      'OTP_INVALIDO',
      'Código inválido',
      'El código de seguridad es incorrecto o venció. Solicita uno nuevo.',
    );
  if (!e || typeof given !== 'string' || !/^\d{6}$/.test(given) || Date.now() > e.exp) {
    store.delete(sub);
    throw fail();
  }
  e.tries += 1;
  const ok = timingSafeEqual(Buffer.from(e.code), Buffer.from(given));
  if (!ok) {
    if (e.tries >= config.otpMaxTries) store.delete(sub);
    throw fail();
  }
  store.delete(sub);
}
