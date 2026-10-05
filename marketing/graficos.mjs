// Genera el material gráfico: imagen para compartir (og.png), banner de LinkedIn y carrusel PDF.
// Uso: node marketing/graficos.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
await import(pathToFileURL(path.join(root, 'web', 'js', 'abap-highlight.js')).href);
const { highlight } = globalThis.AbapHighlight;
const out = p => path.join(root, p);
fs.mkdirSync(out('linkedin'), { recursive: true });

const FONTS = '<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Public+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">';
const BASE = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: "Public Sans", Arial, sans-serif; color: #1c2530; background: #fff; }
  em, i { font-style: normal; }
  code, pre { font-family: "JetBrains Mono", monospace; font-variant-ligatures: none; }
  .k { color: #79b8ff; } .s { color: #a5d6a7; } .c { color: #7d8a97; } .n { color: #f8c58b; }
  .mark { width: 56px; height: 56px; border-radius: 8px; background: #15202b; color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 22px; }
  .win { background: #1b232d; border: 1px solid #2b3642; border-radius: 12px; overflow: hidden; }
  .win .bar { background: #222c37; color: #9aa7b5; font-family: "JetBrains Mono", monospace; padding: 14px 22px; border-bottom: 1px solid #2b3642; display:flex; justify-content:space-between; }
  .win pre { color: #d6dde5; padding: 22px 26px; white-space: pre; }
`;
const hl = code => highlight(code.trim());

const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });

async function shot(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file });
  await page.close();
  console.log('ok', path.relative(root, file));
}

/* ---------- og.png (1200x630) ---------- */
await shot(`
<div style="width:1200px;height:630px;padding:70px 80px;display:flex;flex-direction:column;justify-content:space-between;border-bottom:10px solid #0a5cad">
  <div style="display:flex;align-items:center;gap:18px"><div class="mark">AG</div><div style="font-size:24px;font-weight:600">Abel González Guerra</div></div>
  <div>
    <div style="font-size:22px;font-weight:600;color:#0a5cad;letter-spacing:.06em;text-transform:uppercase;margin-bottom:18px">SAP ABAP · ABAP Cloud · RAP</div>
    <div style="font-size:58px;font-weight:700;line-height:1.12;letter-spacing:-.02em;max-width:980px">Desarrollo ABAP para S/4HANA con el modelo clean core</div>
  </div>
  <div style="font-size:22px;color:#4a5665">Apps RAP · migración de código Z · CDS · herramientas gratuitas para equipos ABAP</div>
</div>`, 1200, 630, path.join(root, 'web', 'img', 'og.png'));

/* ---------- Banner LinkedIn (1584x396) ---------- */
await shot(`
<div style="width:1584px;height:396px;background:#15202b;color:#fff;display:flex;align-items:center;justify-content:flex-end;padding:0 90px 0 520px;gap:60px;position:relative;overflow:hidden">
  <div style="position:absolute;left:0;top:0;bottom:0;width:470px;background:#1b232d;border-right:1px solid #2b3642;padding:40px 36px;font-family:'JetBrains Mono',monospace;font-size:15px;line-height:1.7;color:#d6dde5;white-space:pre;opacity:.9">${hl(`define behavior for ZR_Request
  alias Request
{
  create; update; delete;
  action ( features : instance )
    approve result [1] $self;
  validation validateDates
    on save { create; }
}`)}</div>
  <div style="text-align:right">
    <div style="font-size:44px;font-weight:700;letter-spacing:-.01em">Desarrollador SAP ABAP</div>
    <div style="font-size:24px;color:#a9cdf5;margin-top:10px">ABAP Cloud · RAP · CDS · S/4HANA</div>
    <div style="font-size:19px;color:#9aa7b5;margin-top:22px">Apps Fiori con RAP · migración de código Z · Sevilla, en remoto</div>
  </div>
</div>`, 1584, 396, out('linkedin/banner.png'));

/* ---------- Carrusel LinkedIn (1080x1350, PDF) ---------- */
const S = (num, total, body, opts = {}) => `
<section style="width:1080px;height:1350px;padding:90px 84px 70px;display:flex;flex-direction:column;position:relative;page-break-after:always;background:${opts.dark ? '#15202b' : '#fff'};color:${opts.dark ? '#fff' : '#1c2530'}">
  <div style="flex:1;display:flex;flex-direction:column;${opts.center ? 'justify-content:center;' : ''}">${body}</div>
  <div style="display:flex;justify-content:space-between;align-items:center;font-size:24px;color:${opts.dark ? '#9aa7b5' : '#6b7685'};border-top:2px solid ${opts.dark ? '#2b3642' : '#e3e7ec'};padding-top:26px">
    <span style="display:flex;align-items:center;gap:14px"><span class="mark" style="width:44px;height:44px;font-size:17px;${opts.dark ? 'background:#fff;color:#15202b' : ''}">AG</span>Abel González Guerra · SAP ABAP</span>
    <span>${num} / ${total}</span>
  </div>
</section>`;
const H = (t, sub) => `<div style="font-size:26px;font-weight:600;color:#0a5cad;letter-spacing:.06em;text-transform:uppercase;margin-bottom:22px">${sub}</div><h1 style="font-size:64px;line-height:1.1;letter-spacing:-.02em;margin-bottom:34px">${t}</h1>`;
const P = t => `<p style="font-size:34px;line-height:1.45;color:#3d4957;margin-bottom:28px">${t}</p>`;
const CODE = (code, file) => `<div class="win" style="margin:10px 0 34px"><div class="bar" style="font-size:20px"><span>${file}</span></div><pre style="font-size:23px;line-height:1.55">${hl(code)}</pre></div>`;
const T = 8;

const slides = [
  S(1, T, `
    <div style="font-size:28px;font-weight:600;color:#a9cdf5;letter-spacing:.06em;text-transform:uppercase;margin-bottom:30px">Rendimiento ABAP</div>
    <h1 style="font-size:96px;line-height:1.05;letter-spacing:-.025em;margin-bottom:40px">El SELECT dentro del LOOP</h1>
    <p style="font-size:40px;line-height:1.4;color:#c9d4df">Cómo encontrarlo y tres formas de quitarlo, con el código.</p>`, { dark: true, center: true }),
  S(2, T, H('Funciona en desarrollo. Se hunde en productivo.', 'El problema') + CODE(`
LOOP AT lt_items INTO DATA(ls_item).
  SELECT SINGLE maktx FROM makt
    WHERE matnr = @ls_item-matnr
      AND spras = @sy-langu
    INTO @ls_item-maktx.
ENDLOOP.`, 'ZR_INFORME.prog.abap') + P('Cada vuelta del bucle es un viaje a la base de datos. <b>20.000 posiciones = 20.000 consultas</b> para datos que podrían llegar en una sola.')),
  S(3, T, H('Cómo encontrarlo', 'Diagnóstico') + `
    <div style="display:grid;gap:30px">
      <div style="border:2px solid #e3e7ec;border-radius:12px;padding:32px"><div style="font-size:36px;font-weight:700;margin-bottom:10px">SQL trace (ST05)</div><div style="font-size:30px;color:#4a5665;line-height:1.45">La misma sentencia ejecutada miles de veces en "sentencias idénticas".</div></div>
      <div style="border:2px solid #e3e7ec;border-radius:12px;padding:32px"><div style="font-size:36px;font-weight:700;margin-bottom:10px">ATC / Code Inspector</div><div style="font-size:30px;color:#4a5665;line-height:1.45">Comprobación de rendimiento "SELECT en bucles".</div></div>
      <div style="border:2px solid #e3e7ec;border-radius:12px;padding:32px"><div style="font-size:36px;font-weight:700;margin-bottom:10px">Leyendo el código</div><div style="font-size:30px;color:#4a5665;line-height:1.45">SELECT entre LOOP y ENDLOOP, y SELECT ... ENDSELECT anidados.</div></div>
    </div>`),
  S(4, T, H('Opción 1: FOR ALL ENTRIES', 'Leer todo de una vez') + CODE(`
IF lt_items IS NOT INITIAL.
  SELECT FROM makt
    FIELDS matnr, maktx
    FOR ALL ENTRIES IN @lt_items
    WHERE matnr = @lt_items-matnr
      AND spras = @sy-langu
    INTO TABLE @lt_texts.   " HASHED
ENDIF.`, 'FOR ALL ENTRIES') + P('El <b>IF</b> es obligatorio: con la tabla vacía, FOR ALL ENTRIES lee la tabla <b>entera</b>. Y el destino, HASHED: buscar en una STANDARD dentro del bucle es el mismo problema en memoria.')),
  S(5, T, H('Opción 2: un JOIN', 'Que cruce la base de datos') + CODE(`
SELECT FROM ekpo AS p
  LEFT OUTER JOIN makt AS t
    ON  t~matnr = p~matnr
    AND t~spras = @sy-langu
  FIELDS p~ebeln, p~ebelp,
         p~matnr, t~maktx
  WHERE p~ebeln IN @s_ebeln
  INTO TABLE @DATA(lt_items).`, 'JOIN') + P('Si los datos del bucle salen de otra SELECT, que HANA haga el cruce. <b>LEFT OUTER</b>, para no perder las posiciones sin texto.')),
  S(6, T, H('Opción 3: una vista CDS', 'Reutilizable y lista para S/4HANA') + CODE(`
define view entity ZI_PoItemText
  as select from I_PurchaseOrderItemAPI01
  association [0..1] to I_ProductDescription
    as _Text on  _Text.Product = $projection.Material
             and _Text.Language = $session.system_language
{
  key PurchaseOrder,
  key PurchaseOrderItem,
      Material,
      _Text.ProductDescription
}`, 'ZI_PoItemText.ddls') + P('El cruce vive en un solo sitio y se usa desde ABAP, OData o Fiori. En ABAP Cloud, sobre vistas <b>liberadas</b>.')),
  S(7, T, H('¿Cuál elegir?', 'Resumen') + `
    <table style="width:100%;border-collapse:collapse;font-size:31px;line-height:1.4">
      <tr><td style="padding:26px 0;border-bottom:2px solid #e3e7ec;color:#3d4957">Los datos vienen de un fichero, una BAPI o una pantalla</td><td style="padding:26px 0 26px 30px;border-bottom:2px solid #e3e7ec;font-weight:700;white-space:nowrap">FOR ALL ENTRIES</td></tr>
      <tr><td style="padding:26px 0;border-bottom:2px solid #e3e7ec;color:#3d4957">Los datos vienen de otra SELECT</td><td style="padding:26px 0 26px 30px;border-bottom:2px solid #e3e7ec;font-weight:700">JOIN</td></tr>
      <tr><td style="padding:26px 0;border-bottom:2px solid #e3e7ec;color:#3d4957">El cruce se repite o el destino es S/4HANA / ABAP Cloud</td><td style="padding:26px 0 26px 30px;border-bottom:2px solid #e3e7ec;font-weight:700">Vista CDS</td></tr>
      <tr><td style="padding:26px 0;color:#3d4957">Son tres vueltas y siempre lo serán</td><td style="padding:26px 0 26px 30px;font-weight:700">Déjalo, comentado</td></tr>
    </table>`),
  S(8, T, `
    <h1 style="font-size:70px;line-height:1.1;letter-spacing:-.02em;margin-bottom:40px">¿Tienes un report así?</h1>
    <p style="font-size:38px;line-height:1.45;color:#c9d4df;margin-bottom:34px">Pásalo por <b style="color:#fff">CleanCore Check</b>: herramienta gratuita que marca el SELECT en bucle y otras 71 reglas para ECC, S/4HANA y ABAP Cloud. El código no sale de tu navegador.</p>
    <p style="font-size:38px;line-height:1.45;color:#c9d4df">El artículo completo, con más detalle, está en mi web. Enlace en los comentarios.</p>`, { dark: true, center: true })
];

{
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE} @page { size: 1080px 1350px; margin: 0; } section:last-child { page-break-after: auto !important; }</style></head><body>${slides.join('')}</body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: out('linkedin/carrusel-select-en-loop.pdf'), width: '1080px', height: '1350px', printBackground: true });
  fs.mkdirSync(out('linkedin/carrusel-png'), { recursive: true });
  const els = await page.$$('section');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: out(`linkedin/carrusel-png/${i + 1}.png`) });
  console.log('ok marketing/linkedin/carrusel-select-en-loop.pdf');
  await page.close();
}

await browser.close();
