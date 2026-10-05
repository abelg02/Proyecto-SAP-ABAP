// Escribe la plantilla RAP con marcadores {{...}} en biblioteca/abap-cloud/plantillas/rap-managed-draft
// y, de ejemplo, una versión ya rellenada (Solicitud de compra) en .../ejemplo-solicitud.
// Uso: node biblioteca/scripts/generar-plantillas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
await import(pathToFileURL(path.join(root, 'web', 'js', 'rap-templates.js')).href);
const { files, names, generate } = globalThis.RapTemplates;

const tplDir = path.join(root, 'biblioteca', 'abap-cloud', 'plantillas', 'rap-managed-draft');
fs.mkdirSync(tplDir, { recursive: true });
for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(tplDir, name), content);

const exDir = path.join(root, 'biblioteca', 'abap-cloud', 'plantillas', 'ejemplo-solicitud');
fs.mkdirSync(exDir, { recursive: true });
const values = names('ABK', 'Request', 'Solicitud', 'Solicitudes');
for (const [name, content] of Object.entries(generate(values))) fs.writeFileSync(path.join(exDir, name), content);

console.log('Plantilla:', tplDir);
console.log('Ejemplo  :', exDir);
console.log(values);
