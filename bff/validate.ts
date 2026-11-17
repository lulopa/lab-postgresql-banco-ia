import type { Request } from 'express';
import { problem } from './problem';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function idempotencyKey(req: Request): string {
  const k = req.get('x-idempotency-key');
  if (!k || !UUID_V4.test(k))
    throw problem(
      400,
      'IDEMPOTENCY_KEY_INVALIDA',
      'Falta la clave de idempotencia',
      'La cabecera X-Idempotency-Key debe ser un UUID v4.',
    );
  return k.toLowerCase();
}

export function monto(v: unknown): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0 || n > 1e12 || Math.round(n * 100) / 100 !== n)
    throw problem(
      422,
      'MONTO_INVALIDO',
      'Monto inválido',
      'El monto debe ser mayor a cero y tener máximo 2 decimales.',
      { monto: ['Monto inválido'] },
    );
  return n;
}

export function texto(v: unknown, campo: string, min: number, max: number): string {
  if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max)
    throw problem(
      422,
      'CAMPO_INVALIDO',
      'Datos inválidos',
      `El campo ${campo} debe tener entre ${min} y ${max} caracteres.`,
      { [campo]: ['Valor inválido'] },
    );
  return v.trim();
}

export function numeroCuenta(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !/^[A-Za-z0-9-]{6,20}$/.test(v.trim()))
    throw problem(422, 'CUENTA_INVALIDA', 'Cuenta inválida', `El número de cuenta (${campo}) no es válido.`, {
      [campo]: ['Número de cuenta inválido'],
    });
  return v.trim();
}

export function bigintId(v: unknown, campo: string): string {
  if (typeof v !== 'string' || !/^\d{1,18}$/.test(v))
    throw problem(422, 'ID_INVALIDO', 'Identificador inválido', `El campo ${campo} no es válido.`, {
      [campo]: ['Identificador inválido'],
    });
  return v;
}

export function pagina(q: Request['query'], defecto = 20) {
  const p = Math.max(1, Number.parseInt(String(q.pagina ?? '1'), 10) || 1);
  const t = Math.min(100, Math.max(1, Number.parseInt(String(q.tamano ?? defecto), 10) || defecto));
  return { pagina: p, tamano: t, offset: (p - 1) * t };
}

export const paginado = <T>(items: T[], total: number, p: { pagina: number; tamano: number }) => ({
  items,
  pagina: p.pagina,
  tamano: p.tamano,
  total,
  total_paginas: Math.max(1, Math.ceil(total / p.tamano)),
});

export function fecha(v: unknown): string | null {
  if (v === undefined || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw problem(422, 'FECHA_INVALIDA', 'Fecha inválida', 'Usa el formato AAAA-MM-DD.');
  return v;
}

export const maskLast4 = (v: string) => (v.length <= 4 ? v : `${'•'.repeat(v.length - 4)}${v.slice(-4)}`);
