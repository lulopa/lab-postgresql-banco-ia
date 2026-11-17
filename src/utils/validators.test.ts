import { describe, expect, it } from 'vitest';
import { isIdCuentaDestino, isValidOtp, parseMonto, redactSensitive } from './validators';

describe('parseMonto', () => {
  it.each([
    ['1500000', 1500000],
    ['1500000.50', 1500000.5],
    ['1500000,5', 1500000.5],
    [' 42 ', 42],
  ])('acepta %s', (raw, expected) => expect(parseMonto(raw)).toBe(expected));

  it.each(['', '0', '-5', '1.234', 'abc', '1e6', '1,2,3', '12.', '.5'])('rechaza "%s"', (raw) =>
    expect(parseMonto(raw)).toBeNull(),
  );
});

describe('isValidOtp', () => {
  it('exige exactamente 6 dígitos', () => {
    expect(isValidOtp('123456')).toBe(true);
    for (const bad of ['12345', '1234567', '12345a', '', ' 123456']) expect(isValidOtp(bad)).toBe(false);
  });
});

describe('isIdCuentaDestino', () => {
  it('acepta números/identificadores razonables y rechaza basura', () => {
    expect(isIdCuentaDestino('0011000002')).toBe(true);
    expect(isIdCuentaDestino(' ABC-123456 ')).toBe(true);
    expect(isIdCuentaDestino('12')).toBe(false);
    expect(isIdCuentaDestino('1; DROP TABLE cuenta')).toBe(false);
    expect(isIdCuentaDestino('<script>alert(1)</script>')).toBe(false);
  });
});

describe('redactSensitive', () => {
  it('redacta claves sensibles en objetos anidados y arreglos sin tocar el resto', () => {
    const out = redactSensitive({
      monto: 5,
      otp_token: '123456',
      nested: { Password: 'x', ok: 1 },
      lista: [{ api_token: 'abc', n: 2 }],
    });
    expect(out).toEqual({
      monto: 5,
      otp_token: '«redactado»',
      nested: { Password: '«redactado»', ok: 1 },
      lista: [{ api_token: '«redactado»', n: 2 }],
    });
  });
  it('deja pasar primitivos y null', () => {
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive('texto')).toBe('texto');
    expect(redactSensitive(7)).toBe(7);
  });
});
