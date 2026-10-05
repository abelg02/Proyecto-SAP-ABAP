// Genera la web estática en ../web a partir de las páginas de ./paginas y la plantilla ./layout.html
// Uso: node web-fuente/build.mjs
//
// Cada página empieza con un comentario JSON:
//   <!-- {"title": "...", "description": "...", "out": "blog/x.html", "nav": "blog"} -->
// Los bloques <pre class="abap">código sin escapar</pre> se escapan y se resaltan aquí.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..', 'web');
await import(pathToFileURL(path.join(webDir, 'js', 'abap-highlight.js')).href);
const { highlight, escapeHtml } = globalThis.AbapHighlight;

await import(pathToFileURL(path.join(webDir, 'js', 'cleancore-engine.js')).href);
const { RULES, CAT, TARGETS, ruleSeverity } = globalThis.CleanCore;
const SEV = { error: 'Error', warning: 'Aviso', info: 'Sugerencia' };
const SHORT = { ecc700: 'ECC 7.0x', ecc740: 'ECC 7.40', s4op: 'S/4 on-prem', s4pce: 'S/4 PCE', s4pub: 'S/4 Public', btp: 'BTP' };
function rulesTable() {
  const all = Object.keys(TARGETS);
  const rows = RULES.map(r => {
    const where = all.filter(t => ruleSeverity(r, t));
    const label = where.length === all.length ? 'Todos' : where.map(t => SHORT[t]).join(', ');
    return `<tr><td>${r.id}</td><td>${escapeHtml(r.title)}</td><td>${CAT[r.cat]}</td><td><span class="sev sev-${r.sev}">${SEV[r.sev]}</span></td><td class="small">${label}</td></tr>`;
  });
  return `<table class="rules-table"><thead><tr><th>Regla</th><th>Qué detecta</th><th>Categoría</th><th>Gravedad</th><th>Sistemas</th></tr></thead><tbody>${rows.join('')}</tbody></table>`;
}

const SITE = JSON.parse(fs.readFileSync(path.join(here, 'config.json'), 'utf8'));
const layout = fs.readFileSync(path.join(here, 'layout.html'), 'utf8');

const NAV = [
  ['herramientas', 'Herramientas', 'herramientas/index.html'],
  ['biblioteca', 'Biblioteca', 'biblioteca.html'],
  ['proyectos', 'Proyecto RAP', 'proyectos/gestion-incidencias.html'],
  ['blog', 'Blog', 'blog/index.html'],
  ['recursos', 'Recursos', 'recursos.html'],
  ['sobre-mi', 'Sobre mí', 'sobre-mi.html']
];

function listPages(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? listPages(path.join(dir, e.name)) : e.name.endsWith('.html') ? [path.join(dir, e.name)] : []);
}

let count = 0;
for (const file of listPages(path.join(here, 'paginas'))) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/^<!--\s*(\{[\s\S]*?\})\s*-->/);
  if (!m) { console.warn('Sin cabecera JSON:', file); continue; }
  const meta = JSON.parse(m[1]);
  let body = src.slice(m[0].length);

  const depth = meta.out.split('/').length - 1;
  const base = depth ? '../'.repeat(depth) : '';

  // {{base}} en enlaces internos y datos de config
  body = body.replace(/\{\{base\}\}/g, base).replace(/\{\{site\.(\w+)\}\}/g, (_, k) => SITE[k] ?? '');

  // {{include:ruta}} inserta un fichero de web/ escapado (para <textarea hidden>)
  body = body.replace(/\{\{include:([^}]+)\}\}/g, (_, p) => escapeHtml(fs.readFileSync(path.join(webDir, p.trim()), 'utf8')));
  body = body.replace(/\{\{rules_count\}\}/g, String(RULES.length));

  // Tabla de reglas de CleanCore Check, generada desde el propio motor
  if (body.includes('{{cleancore_rules}}')) body = body.replace('{{cleancore_rules}}', rulesTable());

  // Código ABAP: escapar + resaltar
  body = body.replace(/<pre class="abap">\n?([\s\S]*?)<\/pre>/g, (_, code) =>
    `<pre class="abap"><code>${highlight(code.replace(/\n$/, ''))}</code></pre>`);
  body = body.replace(/<pre class="plain">\n?([\s\S]*?)<\/pre>/g, (_, code) =>
    `<pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`);

  const nav = NAV.map(([id, label, href]) =>
    `<a href="${base}${href}"${meta.nav === id ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('\n        ');

  const title = meta.title === SITE.name ? meta.title : `${meta.title} · ${SITE.name}`;
  const html = layout
    .replace(/\{\{title\}\}/g, escapeHtml(title))
    .replace(/\{\{description\}\}/g, escapeHtml(meta.description || SITE.description))
    .replace(/\{\{canonical\}\}/g, SITE.url ? SITE.url.replace(/\/$/, '') + '/' + meta.out.replace(/index\.html$/, '') : '')
    .replace(/\{\{nav\}\}/g, nav)
    .replace(/\{\{styles\}\}/g, (meta.styles || []).map(s => `<link rel="stylesheet" href="${base}${s}">`).join('\n'))
    .replace(/\{\{scripts\}\}/g, (meta.scripts || []).map(s => `<script src="${base}${s}"></script>`).join('\n'))
    // LinkedIn y WhatsApp solo muestran la imagen de vista previa con la dirección completa
    .replace(/\{\{og_image\}\}/g, SITE.url ? SITE.url.replace(/\/$/, '') + '/img/og.png' : base + 'img/og.png')
    .replace(/\{\{body\}\}/g, body)
    .replace(/\{\{base\}\}/g, base)
    .replace(/\{\{year\}\}/g, String(new Date().getFullYear()))
    .replace(/\{\{site\.(\w+)\}\}/g, (_, k) => SITE[k] ?? '');

  const out = path.join(webDir, meta.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
  count++;
}

// sitemap.xml si hay dominio configurado
if (SITE.url) {
  const urls = listPages(path.join(here, 'paginas')).map(f => {
    const meta = JSON.parse(fs.readFileSync(f, 'utf8').match(/^<!--\s*(\{[\s\S]*?\})\s*-->/)[1]);
    return `  <url><loc>${SITE.url.replace(/\/$/, '')}/${meta.out.replace(/index\.html$/, '')}</loc></url>`;
  });
  fs.writeFileSync(path.join(webDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
}

console.log(`${count} páginas generadas en ${webDir}`);
