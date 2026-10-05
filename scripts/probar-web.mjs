// Prueba de extremo a extremo de la web en Chrome: abre todas las páginas, usa cada herramienta
// y comprueba que no hay errores de JavaScript. Guarda capturas en scripts/capturas/.
// Uso: node scripts/probar-web.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from './capturas.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const shot = n => path.join(here, 'capturas', n);
fs.mkdirSync(path.join(here, 'capturas'), { recursive: true });

const { server, url } = await serve();
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push(`${page.url()}: ${m.text()}`); });

let ok = 0, fail = 0;
const check = (name, cond) => { if (cond) { ok++; console.log('  ok  ', name); } else { fail++; console.log('  FALLO', name); } };

// 1. Todas las páginas cargan
const pages = [];
(function walk(d, rel = '') {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory() && !['descargas', 'documentos', 'img', 'css', 'js', 'ejemplos'].includes(e.name)) walk(path.join(d, e.name), rel + e.name + '/');
    else if (e.name.endsWith('.html')) pages.push(rel + e.name);
  }
})(path.join(here, '..', 'web'));
console.log(`Páginas (${pages.length})`);
for (const p of pages) {
  const res = await page.goto(`${url}/${p}`, { waitUntil: 'networkidle' });
  check(p, res.status() === 200);
}

// 2. CleanCore Check: ejemplos y sistemas destino
console.log('CleanCore Check');
await page.goto(`${url}/herramientas/cleancore-check.html`, { waitUntil: 'networkidle' });
const targets = await page.$$eval('#target option', o => o.map(x => x.value));
check(`${targets.length} sistemas destino`, targets.length === 6);
for (const ex of ['legacy', 's4', 'security']) {
  await page.click(`[data-example="${ex}"]`);
  await page.waitForSelector('.summary');
  const n = await page.$$eval('.finding', f => f.length);
  check(`ejemplo ${ex}: ${n} hallazgos`, n > 3);
}
await page.selectOption('#target', 'ecc700');
await page.click('[data-example="legacy"]');
const relRules = await page.$$eval('.finding .rid', r => r.map(x => x.textContent));
check('ECC 7.0x aplica reglas de su versión y no las de Cloud', !relRules.some(r => r.startsWith('CLD')));
await page.selectOption('#target', 's4op');
await page.click('[data-example="s4"]');
const s4 = await page.$$eval('.finding .rid', r => r.map(x => x.textContent));
check('S/4HANA marca VBUK/KONV (S4-001)', s4.includes('S4-001'));
await page.click('.finding summary');
await page.screenshot({ path: shot('cc-s4.png') });
await page.click('.tab[data-tab="modern"]');
await page.click('.tab[data-tab="export"]');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-md')]);
check('exportar Markdown sin licencia', /\.md$/.test(dl.suggestedFilename()));
check('no queda ninguna mención a planes de pago', !(await page.content()).match(/licencia|€|Pro\b/i));

// 3. Dumps
console.log('Explicador de dumps');
await page.goto(`${url}/herramientas/dumps.html`, { waitUntil: 'networkidle' });
await page.click('#dump-example');
check('reconoce ITAB_LINE_NOT_FOUND', (await page.textContent('#dump-result')).includes('ITAB_LINE_NOT_FOUND'));
await page.fill('#dump-in', 'Error tiempo ejec.     TIME_OUT\nPrograma   ZR_X');
await page.dispatchEvent('#dump-in', 'input');
check('reconoce dump en español', (await page.textContent('#dump-result')).includes('TIME_OUT'));
await page.fill('#dump-search', 'memoria');
await page.dispatchEvent('#dump-search', 'input');
check('buscador de dumps', (await page.textContent('#dump-count')).match(/^\d+ de \d+/));
await page.screenshot({ path: shot('dumps.png') });

// 4. SQL
console.log('Conversor de SQL');
await page.goto(`${url}/herramientas/sql.html`, { waitUntil: 'networkidle' });
check('convierte el ejemplo', (await page.textContent('#sql-out')).includes('@s_bukrs'));
await page.screenshot({ path: shot('sql.png') });

// 5. Formateador
console.log('Formateador');
await page.goto(`${url}/herramientas/formateador.html`, { waitUntil: 'networkidle' });
check('formatea el ejemplo', (await page.textContent('#fmt-out')).includes('  LOOP AT') || (await page.textContent('#fmt-out')).includes('LOOP AT'));
await page.screenshot({ path: shot('formateador.png') });

// 6. Generadores
console.log('Generadores');
await page.goto(`${url}/herramientas/generadores.html`, { waitUntil: 'networkidle' });
for (const id of ['rap-code', 'json-out', 'alv-out', 'ut-out', 'cx-out']) check(`generador ${id}`, ((await page.textContent('#' + id)) || '').length > 200);

// 7. Referencia y fechas
console.log('Referencia y fechas');
await page.goto(`${url}/herramientas/referencia.html`, { waitUntil: 'networkidle' });
await page.fill('#ref-search', 'SM37');
await page.dispatchEvent('#ref-search', 'input');
check('busca transacciones', (await page.textContent('#ref-table')).includes('SM37'));
await page.click('[data-ref="functions"]');
check('pestaña funciones', (await page.textContent('#ref-table')).length > 0);
await page.goto(`${url}/herramientas/fechas.html`, { waitUntil: 'networkidle' });
await page.fill('#ts-in', '20261005143000');
await page.dispatchEvent('#ts-in', 'input');
check('convierte timestamp a hora de Madrid', (await page.textContent('#ts-out')).includes('16:30:00'));

// 8. Descargas
console.log('Descargas');
for (const f of ['ABAP-Toolkit-Cloud.zip', 'ABAP-Toolkit-Clasico.zip', 'ABAP-Toolkit-Completo.zip', 'Plantilla-RAP-managed-draft.zip', '../documentos/Chuleta-ABAP-moderno.pdf', '../documentos/CV-Abel-Gonzalez-Guerra-SAP-ABAP.pdf']) {
  const r = await page.request.get(`${url}/descargas/${f}`);
  check(`descarga ${f.replace('../', '')}`, r.status() === 200 && (await r.body()).length > 1000);
}

console.log(errors.length ? '\nERRORES JS:\n' + errors.join('\n') : '\nSin errores de JavaScript');
console.log(`${ok} comprobaciones correctas, ${fail} fallos`);
process.exitCode = fail || errors.length ? 1 : 0;
await browser.close();
server.close();
