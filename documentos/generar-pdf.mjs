// Genera los PDF (chuleta, CV, propuesta tipo) desde documentos/fuente/*.html con Chrome,
// los copia a web/documentos/ y crea las imágenes de portada para la web.
// Uso: node documentos/generar-pdf.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
await import(pathToFileURL(path.join(root, 'web', 'js', 'abap-highlight.js')).href);
const { highlight } = globalThis.AbapHighlight;

const DOCS = [
  { src: 'chuleta.html', pdf: 'Chuleta-ABAP-moderno.pdf', cover: 'chuleta-portada.png', web: true },
  { src: 'cv.html', pdf: 'CV-Abel-Gonzalez-Guerra-SAP-ABAP.pdf', cover: 'cv-portada.png', web: true }
];

const outDir = path.join(here, 'pdf');
const webDocs = path.join(root, 'web', 'documentos');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(webDocs, { recursive: true });

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });

for (const d of DOCS) {
  const srcPath = path.join(here, 'fuente', d.src);
  if (!fs.existsSync(srcPath)) { console.log('falta', d.src); continue; }
  // Resalta los bloques <pre class="abap"> igual que el build de la web
  const html = fs.readFileSync(srcPath, 'utf8').replace(/<pre class="abap">\n?([\s\S]*?)<\/pre>/g,
    (_, code) => `<pre class="abap">${highlight(code.replace(/\n$/, ''))}</pre>`);
  const tmp = path.join(here, 'fuente', '_' + d.src);
  fs.writeFileSync(tmp, html);

  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  // Aviso si algún bloque se sale de su página
  const overflow = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p, i) => (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2) ? i + 1 : 0).filter(Boolean));
  if (overflow.length) console.log(`  ¡${d.src}: contenido cortado en página(s) ${overflow.join(', ')}!`);

  const pdfPath = path.join(outDir, d.pdf);
  await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
  if (d.web) fs.copyFileSync(pdfPath, path.join(webDocs, d.pdf));
  // Vista previa de cada página en PNG (para revisar sin abrir el PDF)
  const prevDir = path.join(outDir, 'vista-previa');
  fs.mkdirSync(prevDir, { recursive: true });
  const pages = await page.$$('.page');
  for (let i = 0; i < pages.length; i++) {
    await pages[i].screenshot({ path: path.join(prevDir, `${d.pdf.replace('.pdf', '')}-p${i + 1}.png`) });
  }
  if (d.cover) {
    await page.screenshot({ path: path.join(root, 'web', 'img', d.cover), clip: { x: 0, y: 0, width: 794, height: 1123 } });
  }
  fs.unlinkSync(tmp);
  console.log('ok', d.pdf);
}

await browser.close();
