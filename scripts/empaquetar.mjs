// Prepara las descargas gratuitas de la biblioteca:
//   - web/descargas/*.zip  (se publican con la web)
//   - dist/abap-toolkit/   (carpeta lista para subir como repositorio a GitHub, si quieres)
// Uso: node scripts/empaquetar.mjs     (usa PowerShell Compress-Archive, incluido en Windows)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = path.join(root, 'biblioteca');
const out = path.join(root, 'web', 'descargas');
const dist = path.join(root, 'dist');
const stage = path.join(dist, '_stage');
fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(stage, { recursive: true });

const copy = (from, to) => fs.cpSync(from, to, { recursive: true });

function zip(folder, name) {
  const target = path.join(out, name);
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    `Compress-Archive -Path '${folder}\\*' -DestinationPath '${target}' -Force`], { stdio: 'inherit' });
  console.log('ok', path.relative(root, target), `${(fs.statSync(target).size / 1024).toFixed(0)} KB`);
}

// abapGit necesita un .abapgit.xml en la raíz con la carpeta de fuentes
const abapgitXml = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
 <asx:values>
  <DATA>
   <MASTER_LANGUAGE>S</MASTER_LANGUAGE>
   <STARTING_FOLDER>/src/</STARTING_FOLDER>
   <FOLDER_LOGIC>PREFIX</FOLDER_LOGIC>
  </DATA>
 </asx:values>
</asx:abap>
`;

function pack(id, parts) {
  const dir = path.join(stage, id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [from, to] of parts) copy(path.join(lib, from), path.join(dir, to));
  for (const f of ['README.md', 'LICENSE']) copy(path.join(lib, f), path.join(dir, f));
  return dir;
}

// Paquetes instalables con abapGit (offline)
const cloud = pack('cloud', [['abap-cloud/src', 'src'], ['abap-cloud/plantillas', 'plantillas']]);
fs.writeFileSync(path.join(cloud, '.abapgit.xml'), abapgitXml);
zip(cloud, 'ABAP-Toolkit-Cloud.zip');

const classic = pack('clasico', [['abap-clasico/src', 'src']]);
fs.writeFileSync(path.join(classic, '.abapgit.xml'), abapgitXml);
zip(classic, 'ABAP-Toolkit-Clasico.zip');

const full = pack('completo', [['abap-cloud', 'abap-cloud'], ['abap-clasico', 'abap-clasico']]);
zip(full, 'ABAP-Toolkit-Completo.zip');

// Plantilla RAP sola
const rap = path.join(stage, 'rap');
copy(path.join(lib, 'abap-cloud', 'plantillas'), rap);
zip(rap, 'Plantilla-RAP-managed-draft.zip');

// Repositorio para GitHub (opcional)
const repo = path.join(dist, 'abap-toolkit');
copy(path.join(lib, 'abap-cloud'), path.join(repo, 'abap-cloud'));
copy(path.join(lib, 'abap-clasico'), path.join(repo, 'abap-clasico'));
for (const f of ['README.md', 'LICENSE']) copy(path.join(lib, f), path.join(repo, f));
console.log('ok', path.relative(root, repo), '(carpeta lista para subir a GitHub si quieres)');

fs.rmSync(stage, { recursive: true, force: true });
