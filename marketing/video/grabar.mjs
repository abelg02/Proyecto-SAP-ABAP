// Graba el vídeo de presentación de CleanCore Check y la web, fotograma a fotograma, sobre la web real.
// Uso: node marketing/video/grabar.mjs        (requiere ffmpeg en el PATH)
// Salida: marketing/video/cleancore-check.mp4 (1920x1080) y cleancore-check-vertical.mp4 (1080x1920)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from '../../scripts/capturas.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(here, '_frames');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(tmp, { recursive: true });

const FPS = 30;
const W = 1440, H = 810, SCALE = 4 / 3;   // 1920 x 1080 final
const ff = (...args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

const { server, url } = await serve();
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE });
const page = await ctx.newPage();

/* ----------------------------- utilidades ----------------------------- */
let sceneDir, frame;
function startScene(name) {
  sceneDir = path.join(tmp, name);
  fs.mkdirSync(sceneDir, { recursive: true });
  frame = 0;
}
async function snap(n = 1) {
  const buf = await page.screenshot({ type: 'jpeg', quality: 92 });
  for (let i = 0; i < n; i++) fs.writeFileSync(path.join(sceneDir, `f${String(frame++).padStart(5, '0')}.jpg`), buf);
}
const hold = s => snap(Math.round(s * FPS));
const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

async function cursor() {
  await page.evaluate(() => {
    if (document.getElementById('fake-cursor')) return;
    const c = document.createElement('div');
    c.id = 'fake-cursor';
    c.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M2 2 L2 24 L8 18 L12 28 L16 26 L12 16 L20 16 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0px', top: '0px', zIndex: 99999, pointerEvents: 'none', transform: 'translate(-2px,-2px)', transition: 'none' });
    document.body.appendChild(c);
    window.__cur = { x: window.innerWidth * 0.62, y: window.innerHeight * 0.6 };
    c.style.left = window.__cur.x + 'px'; c.style.top = window.__cur.y + 'px';
  });
}
async function moveTo(selector, seconds = 0.7, dx = 0.5, dy = 0.5) {
  const box = await page.locator(selector).first().boundingBox();
  const tx = box.x + box.width * dx, ty = box.y + box.height * dy;
  const from = await page.evaluate(() => window.__cur);
  const n = Math.round(seconds * FPS);
  for (let i = 1; i <= n; i++) {
    const t = ease(i / n);
    await page.evaluate(([x, y]) => { const c = document.getElementById('fake-cursor'); c.style.left = x + 'px'; c.style.top = y + 'px'; window.__cur = { x, y }; },
      [from.x + (tx - from.x) * t, from.y + (ty - from.y) * t]);
    await snap();
  }
}
async function click(selector) {
  await moveTo(selector);
  await page.evaluate(() => { const c = document.getElementById('fake-cursor'); c.style.transform = 'translate(-2px,-2px) scale(.85)'; });
  await snap(3);
  await page.evaluate(() => { const c = document.getElementById('fake-cursor'); c.style.transform = 'translate(-2px,-2px)'; });
  await page.locator(selector).first().click();
}
async function scrollTo(y, seconds) {
  const from = await page.evaluate(() => window.scrollY);
  const n = Math.round(seconds * FPS);
  for (let i = 1; i <= n; i++) {
    await page.evaluate(v => window.scrollTo(0, v), from + (y - from) * ease(i / n));
    await page.waitForTimeout(12);
    await snap();
  }
}
async function scrollEl(selector, y, seconds) {
  const n = Math.round(seconds * FPS);
  const from = await page.$eval(selector, e => e.scrollTop);
  for (let i = 1; i <= n; i++) {
    await page.$eval(selector, (e, v) => { e.scrollTop = v; }, from + (y - from) * ease(i / n));
    await snap();
  }
}
async function typeInto(selector, text, perChar = 2) {
  await page.fill(selector, '');
  for (const ch of text) {
    await page.locator(selector).first().press(ch === ' ' ? 'Space' : ch);
    await snap(perChar);
  }
}

/* ------------------------------ escenas ------------------------------ */
const CARD = (title, sub, small) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700&display=swap" rel="stylesheet">
<style>*{margin:0;box-sizing:border-box}body{width:${W}px;height:${H}px;background:#15202b;color:#fff;font-family:"Public Sans",Arial;display:flex;flex-direction:column;justify-content:center;padding:0 120px}
.e{font-size:18px;font-weight:600;color:#a9cdf5;letter-spacing:.08em;text-transform:uppercase;margin-bottom:22px}
h1{font-size:64px;letter-spacing:-.02em;line-height:1.08;margin-bottom:22px;max-width:1000px}p{font-size:26px;color:#c9d4df;max-width:900px;line-height:1.45}
.f{position:absolute;left:120px;bottom:60px;font-size:18px;color:#9aa7b5;display:flex;gap:12px;align-items:center}
.m{width:36px;height:36px;border-radius:6px;background:#fff;color:#15202b;display:grid;place-items:center;font-weight:700;font-size:14px}</style></head>
<body><div class="e">${small}</div><h1>${title}</h1><p>${sub}</p><div class="f"><span class="m">AG</span>Abel González Guerra · Desarrollador SAP ABAP</div></body></html>`;

// 1. Portada
startScene('01-portada');
await page.setContent(CARD('Herramientas gratuitas para SAP ABAP', '¿Tu código está listo para S/4HANA o ABAP Cloud? ¿Qué significa ese dump? Pégalo y lo sabrás en un segundo.', 'ECC · S/4HANA · ABAP Cloud'), { waitUntil: 'networkidle' });
await hold(3.2);

// 2. Análisis del ejemplo
startScene('02-analisis');
await page.goto(`${url}/herramientas/cleancore-check.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => window.scrollTo(0, 120));
await cursor();
await hold(0.8);
await page.selectOption('#target', 's4op');
await click('[data-example="s4"]');
await page.waitForSelector('.summary');
await page.waitForTimeout(150);
await hold(2.6);
await moveTo('.cat-bars', 0.8, 0.3, 0.5);
await hold(1.2);

// 3. Abrir un hallazgo
startScene('03-hallazgo');
await click('.finding:nth-of-type(2) summary');
await page.waitForTimeout(120);
await hold(0.6);
await scrollTo(470, 1.2);
await hold(2.4);

// 4. Código modernizado
startScene('04-modernizado');
await scrollTo(120, 0.8);
await moveTo('#target', 0.6);
await page.selectOption('#target', 'btp');
await hold(0.5);
await click('[data-example="legacy"]');
await page.waitForTimeout(120);
await hold(1.2);
await click('.tab[data-tab="modern"]');
await page.waitForTimeout(120);
await hold(2.6);
await moveTo('#apply-modern', 0.7);
await hold(0.8);

// 4b. Explicador de dumps
startScene('045-dumps');
await page.goto(`${url}/herramientas/dumps.html`, { waitUntil: 'networkidle' });
await cursor();
await hold(0.6);
await click('#dump-example');
await page.waitForTimeout(150);
await hold(1.2);
await scrollTo(260, 1.0);
await hold(2.2);

// 5. Portada de la web: de legacy a ABAP Cloud
startScene('05-web');
await page.goto(`${url}/index.html`, { waitUntil: 'networkidle' });
await cursor();
await hold(1.6);
const evoTop = await page.$eval('#evolucion', e => e.getBoundingClientRect().top + window.scrollY);
await scrollTo(evoTop + 40, 1.4);
await hold(1.4);
for (let i = 1; i <= 3; i++) {
  const y = await page.$eval(`.evolution-steps .step:nth-child(${i + 1})`, e => e.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.3);
  await scrollTo(y, 1.3);
  await page.waitForTimeout(260);
  await hold(1.5);
}

// 6. Generador RAP
startScene('06-generador');
await page.goto(`${url}/herramientas/generadores.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => window.scrollTo(0, 270));
await cursor();
await hold(0.6);
await click('#rap-entity');
await typeInto('#rap-entity', 'Invoice', 3);
await page.fill('#rap-desc', 'Factura');
await page.fill('#rap-plural', 'Facturas');
await page.dispatchEvent('#rap-desc', 'input');
await hold(0.8);
await click('[data-f="06_bdef_raiz.bdef.asbdef"]');
await page.waitForTimeout(100);
await hold(2.4);

// 7. Cierre
startScene('07-cierre');
await page.setContent(CARD('Gratis, y tu código no sale del navegador.', '72 reglas para 6 sistemas SAP · explicador de dumps · conversor de SQL · generadores RAP y ALV · biblioteca de clases ABAP. Enlace en los comentarios.', 'Sin registro'), { waitUntil: 'networkidle' });
await hold(3.6);

await browser.close();
server.close();

/* ------------------------------ montaje ------------------------------ */
const scenes = fs.readdirSync(tmp).sort();
const clips = [];
for (const s of scenes) {
  const clip = path.join(tmp, `${s}.mp4`);
  ff('-framerate', String(FPS), '-i', path.join(tmp, s, 'f%05d.jpg'),
     '-vf', 'scale=1920:1080:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-r', String(FPS), clip);
  clips.push(clip);
}
const dur = f => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString());

// Fundidos cortos entre escenas
const XF = 0.35;
let filter = '';
let last = '[0:v]';
let offset = 0;
for (let i = 1; i < clips.length; i++) {
  offset += dur(clips[i - 1]) - XF;
  const outLabel = i === clips.length - 1 ? '[v]' : `[x${i}]`;
  filter += `${last}[${i}:v]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}${outLabel};`;
  last = outLabel;
}
const silent = path.join(tmp, 'video.mp4');
ff(...clips.flatMap(c => ['-i', c]), '-filter_complex', filter.replace(/;$/, ''), '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', silent);
const total = dur(silent);

const music = ['musica.mp3', 'musica.wav', 'musica.m4a'].map(f => path.join(here, f)).find(f => fs.existsSync(f));
const final = path.join(here, 'cleancore-check.mp4');
if (music) {
  ff('-i', silent, '-stream_loop', '-1', '-i', music,
     '-filter_complex', `[1:a]atrim=0:${total.toFixed(2)},afade=t=in:d=0.6,afade=t=out:st=${(total - 1.8).toFixed(2)}:d=1.8,volume=0.8,loudnorm=I=-16:TP=-1.5:LRA=11[a]`,
     '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', final);
} else {
  fs.copyFileSync(silent, final);
  console.log('(sin música: no se encontró marketing/video/musica.*)');
}

// Versión vertical: fondo con título y llamada a la acción + vídeo horizontal centrado
const bg = path.join(tmp, 'vertical-bg.png');
{
  const b = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600;700&display=swap" rel="stylesheet">
  <style>*{margin:0;box-sizing:border-box}body{width:1080px;height:1920px;background:#15202b;color:#fff;font-family:"Public Sans",Arial;position:relative}
  .t{position:absolute;top:250px;left:80px;right:80px}.e{font-size:30px;font-weight:600;color:#a9cdf5;letter-spacing:.08em;text-transform:uppercase;margin-bottom:26px}
  h1{font-size:82px;line-height:1.06;letter-spacing:-.02em}.b{position:absolute;top:1340px;left:80px;right:80px;font-size:40px;line-height:1.45;color:#c9d4df}
  .f{position:absolute;left:80px;bottom:150px;font-size:30px;color:#9aa7b5;display:flex;gap:16px;align-items:center}.m{width:56px;height:56px;border-radius:8px;background:#fff;color:#15202b;display:grid;place-items:center;font-weight:700;font-size:21px}</style></head>
  <body><div class="t"><div class="e">Herramientas gratuitas SAP ABAP</div><h1>¿Tu código ABAP está listo para S/4HANA?</h1></div>
  <div class="b">Pega un report y elige tu sistema: te marca lo que no compila, lo que se rompe al migrar y cómo corregirlo. También explica dumps de la ST22.</div>
  <div class="f"><span class="m">AG</span>Abel González Guerra · SAP ABAP</div></body></html>`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: bg });
  await b.close();
}
const vertical = path.join(here, 'cleancore-check-vertical.mp4');
ff('-loop', '1', '-i', bg, '-i', final,
   '-filter_complex', '[1:v]scale=1000:-2:flags=lanczos[v];[0:v][v]overlay=40:720:shortest=1,format=yuv420p[o]',
   '-map', '[o]', ...(music ? ['-map', '1:a', '-c:a', 'copy'] : []), '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-r', String(FPS), '-shortest', vertical);

// Miniatura
ff('-ss', '4.2', '-i', final, '-frames:v', '1', '-q:v', '2', path.join(here, 'miniatura.jpg'));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Listo: ${path.relative(process.cwd(), final)} (${total.toFixed(1)} s), vertical y miniatura`);
