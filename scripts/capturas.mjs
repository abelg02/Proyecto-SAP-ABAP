// Capturas de la web para revisar el diseño y para el material de marketing.
// Uso: node scripts/capturas.mjs [pagina.html ...] [--movil] [--full]
// Sirve la carpeta web/ en un puerto local y guarda PNG en scripts/capturas/.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', 'web');
const outDir = path.join(here, 'capturas');
fs.mkdirSync(outDir, { recursive: true });

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.abap': 'text/plain; charset=utf-8', '.mp4': 'video/mp4', '.zip': 'application/zip' };

export function serve(dir = root) {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(dir, p);
    if (!file.startsWith(dir) || !fs.existsSync(file)) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r({ server, url: `http://localhost:${server.address().port}` })));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const mobile = args.includes('--movil');
  const full = args.includes('--full');
  const pages = args.filter(a => !a.startsWith('--'));
  if (!pages.length) pages.push('index.html');

  const { server, url } = await serve();
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1 });

  for (const p of pages) {
    await page.goto(`${url}/${p}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    const name = p.replace(/[\/\\]/g, '_').replace(/\.html$/, '') + (mobile ? '-movil' : '') + '.png';
    await page.screenshot({ path: path.join(outDir, name), fullPage: full });
    console.log('ok', name);
  }
  await browser.close();
  server.close();
}
