// Genera .br y .gz junto a cada activo comprimible de dist/ (se sirven con Content-Encoding por bff/static.ts).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { extname, join } from 'node:path';

const DIST = 'dist';
const EXT = new Set(['.js', '.css', '.html', '.svg', '.json', '.webmanifest', '.txt', '.map']);
let files = 0,
  raw = 0,
  br = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (EXT.has(extname(p))) compress(p);
  }
}
function compress(p) {
  const buf = readFileSync(p);
  if (buf.length < 256) return;
  const b = brotliCompressSync(buf, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length },
  });
  const g = gzipSync(buf, { level: 9 });
  if (b.length < buf.length) writeFileSync(`${p}.br`, b);
  if (g.length < buf.length) writeFileSync(`${p}.gz`, g);
  files++;
  raw += buf.length;
  br += Math.min(b.length, buf.length);
}
walk(DIST);
console.log(
  `precompress: ${files} archivos, ${(raw / 1024).toFixed(0)} KB -> ${(br / 1024).toFixed(0)} KB (brotli)`,
);
