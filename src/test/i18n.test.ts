/**
 * Guardas de i18n: (1) ningún texto visible fijo en JSX/atributos (todo pasa por t()),
 * (2) toda clave t('...') existe en el catálogo en inglés.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/en';

const ROOT = join(process.cwd(), 'src');
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const sources = walk(ROOT).filter(
  (f) =>
    /\.tsx?$/.test(f) &&
    !/\.test\.tsx?$/.test(f) &&
    !f.includes('/test/') &&
    !f.includes('/i18n/') &&
    !/\.stories\.tsx$/.test(f) &&
    !f.includes('/design-system/'),
);
const LETTERS = /[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}/;
const TEXT_ATTRS = new Set([
  'label',
  'placeholder',
  'title',
  'alt',
  'aria-label',
  'caption',
  'empty',
  'hint',
  'error',
  'aria-description',
]);

describe('i18n', () => {
  it('no hay texto visible escrito directamente en los componentes', () => {
    const violations: string[] = [];
    for (const file of sources.filter((f) => f.endsWith('.tsx'))) {
      const sf = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const visit = (node: ts.Node) => {
        if (ts.isJsxText(node) && LETTERS.test(node.getText()))
          violations.push(`${file.replace(ROOT, 'src')}: texto "${node.getText().trim()}"`);
        if (
          ts.isJsxAttribute(node) &&
          TEXT_ATTRS.has(node.name.getText()) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer) &&
          LETTERS.test(node.initializer.text)
        )
          violations.push(
            `${file.replace(ROOT, 'src')}: atributo ${node.name.getText()}="${node.initializer.text}"`,
          );
        ts.forEachChild(node, visit);
      };
      visit(sf);
    }
    expect(violations).toEqual([]);
  });

  it('toda clave usada con t() existe en el catálogo en inglés', () => {
    const keys = new Set<string>();
    const DATA = [
      'config/routes.ts',
      'components/shared/PageMeta.tsx',
      'pages/auth/Login.tsx',
      'pages/cliente/Dashboard.tsx',
      'pages/auditoria/Anomalias.tsx',
      'pages/operativa/EventosCuenta.tsx',
      'pages/operativa/CierreCaja.tsx',
    ];
    for (const f of sources) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/\b(?:i18n\.)?t\(\s*'((?:[^'\\]|\\.)*)'/g))
        keys.add((m[1] as string).replace(/\\'/g, "'"));
      if (DATA.some((d) => f.endsWith(d))) {
        for (const m of s.matchAll(/\b(?:label|title|description|l):\s*'((?:[^'\\]|\\.)*)'/g))
          keys.add((m[1] as string).replace(/\\'/g, "'"));
        for (const m of s.matchAll(/^\s*(?:[A-Z_]+|[a-z_]+):\s*'((?:[^'\\]|\\.)*)',?\s*$/gm))
          if (/\s/.test(m[1] as string) || /^[A-ZÁÉÍÓÚ]/.test(m[1] as string)) keys.add(m[1] as string);
      }
    }
    const missing = [...keys].filter(
      (k) =>
        !(k in en) &&
        !/^(info|success|warning|danger|neutral|SMS)$/.test(k) &&
        !k.startsWith('/') &&
        !/^[A-Z_]+$/.test(k),
    );
    expect(missing).toEqual([]);
  });

  it('el catálogo en inglés no tiene entradas vacías', () => {
    expect(Object.entries(en).filter(([, v]) => !v.trim())).toEqual([]);
  });
});
