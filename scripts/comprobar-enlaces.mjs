// Comprueba que todos los enlaces y recursos internos de web/ existen.
// Uso: node scripts/comprobar-enlaces.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.html')) pages.push(p);
  }
})(root);

let broken = 0;
let checked = 0;
for (const page of pages) {
  const html = fs.readFileSync(page, 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const url = m[1];
    if (/^(https?:|mailto:|tel:|data:|javascript:)/.test(url)) continue;
    checked++;
    if (url.startsWith('#')) {
      // anclas de afiliado / tienda pendientes de configurar no cuentan como rotas
      if (url.length > 1 && !ids.has(url.slice(1)) && !/^#(afiliado|comprar)/.test(url)) { console.log(`ancla  ${path.relative(root, page)} -> ${url}`); broken++; }
      continue;
    }
    const clean = url.split('#')[0].split('?')[0];
    const target = path.resolve(path.dirname(page), clean);
    if (!fs.existsSync(target)) { console.log(`ROTO   ${path.relative(root, page)} -> ${url}`); broken++; }
  }
}
console.log(`${pages.length} páginas, ${checked} enlaces internos, ${broken} rotos`);
process.exitCode = broken ? 1 : 0;
