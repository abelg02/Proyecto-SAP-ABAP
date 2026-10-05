// Revisa que en lo que se publica (web/ y el código de las descargas) no haya datos personales ni secretos:
// correos, teléfonos, rutas del ordenador, claves de API, tokens o variables de entorno.
// Uso: node scripts/comprobar-privacidad.mjs     (sale con error si encuentra algo)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targets = [path.join(root, 'web'), path.join(root, 'biblioteca'), path.join(root, 'dist')];
const TEXT = /\.(html|js|mjs|css|md|txt|abap|xml|json|svg|asddls|asbdef|asddlxs|assrvd)$/i;

const user = os.userInfo().username;
const CHECKS = [
  ['Correo electrónico', /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, m => !/@(empresa\.com|example\.com|proveedor\.com)$/i.test(m)],
  ['Teléfono', /(?:\+34[\s.-]?)?(?<![\d.])[679]\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?![\d.])/g, () => true],
  ['Ruta del ordenador', /[A-Za-z]:[\\/](Users|Usuarios)[\\/][^\s"'<>]+/gi, () => true],
  ['Nombre de usuario de Windows', new RegExp(`\\b${user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[\\\\/]`, 'g'), () => true],
  ['Clave de API', /\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}|\bAKIA[0-9A-Z]{16}\b|\bAIza[0-9A-Za-z_-]{30,}|\bghp_[A-Za-z0-9]{30,}|\bxox[bp]-[A-Za-z0-9-]{20,}/g, () => true],
  ['Token Bearer', /Bearer\s+[A-Za-z0-9._-]{24,}/g, m => !/FICTICIA|EJEMPLO/.test(m)],
  ['Variable de entorno con secreto', /(APIMART|OPENAI|ANTHROPIC|HIGGSFIELD)_?API_?KEY/gi, () => true],
  ['IBAN', /\bES\d{2}[\s]?\d{4}[\s]?\d{4}[\s]?\d{2}[\s]?\d{10}\b/g, () => true],
  ['DNI / NIE', /\b(\d{8}[A-HJ-NP-TV-Z]|[XYZ]\d{7}[A-HJ-NP-TV-Z])\b/g, () => true]
];

let files = 0;
const found = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); continue; }
    if (/^\.env/.test(e.name)) { found.push([p, 'Fichero de entorno', e.name]); continue; }
    if (!TEXT.test(e.name)) continue;
    files++;
    const text = fs.readFileSync(p, 'utf8');
    for (const [label, re, keep] of CHECKS) {
      for (const m of text.match(re) || []) if (keep(m)) found.push([p, label, m]);
    }
  }
}
targets.forEach(walk);

// Los ZIP de descargas se generan desde biblioteca/ (ya revisada). Comprobar que no hay otros binarios inesperados.
const unexpected = [];
(function binaries(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) binaries(p);
    else if (!TEXT.test(e.name) && !/\.(png|jpg|jpeg|webp|ico|pdf|zip|mp4|woff2?)$/i.test(e.name)) unexpected.push(p);
  }
})(path.join(root, 'web'));

if (found.length) {
  console.log('POSIBLES DATOS SENSIBLES:');
  found.forEach(([p, l, m]) => console.log(`  ${l.padEnd(30)} ${path.relative(root, p)}  ->  ${m}`));
}
if (unexpected.length) {
  console.log('Ficheros no esperados en web/:');
  unexpected.forEach(p => console.log('  ' + path.relative(root, p)));
}
console.log(`${files} ficheros revisados · ${found.length} avisos · ${unexpected.length} ficheros no esperados`);
process.exitCode = found.length || unexpected.length ? 1 : 0;
