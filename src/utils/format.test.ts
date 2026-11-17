import { describe, expect, it } from 'vitest';
import { formatCOP, formatFecha, formatFechaHora, formatMoneda, maskLast4 } from './format';

describe('format', () => {
  it('formatCOP usa Intl es-CO con símbolo de peso', () => {
    expect(formatCOP(1234567)).toMatch(/\$\s?1\.234\.567/);
    expect(formatCOP(0)).toMatch(/\$\s?0/);
  });
  it('formatMoneda formatea divisas y no falla con códigos inválidos', () => {
    expect(formatMoneda(50, 'USD')).toMatch(/50/);
    expect(formatMoneda(50, 'NO_ES_MONEDA')).toBe('50 NO_ES_MONEDA');
  });
  it('las fechas se muestran en hora de Bogotá (UTC-5)', () => {
    // 03:00 UTC del 1-ene es todavía 31-dic en Bogotá
    expect(formatFecha('2026-01-01T03:00:00Z')).toMatch(/31/);
    expect(formatFechaHora('2026-01-01T15:30:00Z')).toMatch(/10:30/);
  });
  it('maskLast4 deja solo los últimos 4 caracteres', () => {
    expect(maskLast4('0011000002')).toBe('••••••0002');
    expect(maskLast4('123')).toBe('123');
  });
});
