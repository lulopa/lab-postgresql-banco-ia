import { describe, expect, it } from 'vitest';
import { isUuidV4, uuidv4 } from './uuid';

describe('uuid', () => {
  it('uuidv4 genera UUID v4 válidos y distintos', () => {
    const a = uuidv4();
    const b = uuidv4();
    expect(isUuidV4(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  it('isUuidV4 rechaza otras versiones y texto arbitrario', () => {
    expect(isUuidV4('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(false); // v1
    expect(isUuidV4('no-es-uuid')).toBe(false);
    expect(isUuidV4('')).toBe(false);
  });
  it('usa el respaldo con getRandomValues cuando randomUUID no existe', () => {
    const original = crypto.randomUUID;
    // @ts-expect-error simulamos un navegador sin randomUUID
    crypto.randomUUID = undefined;
    try {
      expect(isUuidV4(uuidv4())).toBe(true);
    } finally {
      crypto.randomUUID = original;
    }
  });
});
