// Genera los ficheros de metadatos de abapGit (*.clas.xml, *.prog.xml, package.devc.xml)
// a partir de los fuentes .abap. Sin ellos abapGit no sabe crear los objetos.
// Uso: node biblioteca/scripts/generar-xml-abapgit.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGU = 'S';   // idioma original: español (coincide con MASTER_LANGUAGE de .abapgit.xml)

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const wrap = (serializer, values) => `<?xml version="1.0" encoding="utf-8"?>
<abapGit version="v1.0.0" serializer="${serializer}" serializer_version="v1.0.0">
 <asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
${values}
  </asx:values>
 </asx:abap>
</abapGit>
`;

function classXml(name, src, hasTests) {
  const descr = (src.match(/shorttext synchronized">([^<]+)</) || [])[1] || name;
  const isException = /INHERITING\s+FROM\s+cx_/i.test(src);
  const isTestClass = /CREATE\s+PUBLIC\s+FOR\s+TESTING/i.test(src);
  return wrap('LCL_OBJECT_CLAS', `   <VSEOCLASS>
    <CLSNAME>${name.toUpperCase()}</CLSNAME>
    <LANGU>${LANGU}</LANGU>
    <DESCRIPT>${esc(descr.slice(0, 60))}</DESCRIPT>${isException ? '\n    <CATEGORY>40</CATEGORY>' : ''}${isTestClass ? '\n    <CATEGORY>05</CATEGORY>' : ''}
    <STATE>1</STATE>
    <CLSCCINCL>X</CLSCCINCL>
    <FIXPT>X</FIXPT>
    <UNICODE>X</UNICODE>${hasTests ? '\n    <WITH_UNIT_TESTS>X</WITH_UNIT_TESTS>' : ''}${isException ? '\n    <MSG_ID>ZABK_RAP</MSG_ID>' : ''}
   </VSEOCLASS>`);
}

const PROG_TEXTS = {
  zabk_r_carga_csv: {
    title: 'Carga de textos de material desde CSV',
    symbols: { B01: 'Origen del fichero' },
    selection: { P_PC: 'Fichero en el PC', P_SERV: 'Fichero en el servidor', P_PATH: 'Ruta del fichero', P_TEST: 'Modo test (sin grabar)' }
  }
};

function progXml(name) {
  const t = PROG_TEXTS[name] || { title: name, symbols: {}, selection: {} };
  const items = [
    `     <item>\n      <ID>R</ID>\n      <ENTRY>${esc(t.title)}</ENTRY>\n      <LENGTH>${t.title.length}</LENGTH>\n     </item>`,
    ...Object.entries(t.symbols).map(([k, v]) => `     <item>\n      <ID>I</ID>\n      <KEY>${k}</KEY>\n      <ENTRY>${esc(v)}</ENTRY>\n      <LENGTH>${Math.max(v.length, 20)}</LENGTH>\n     </item>`),
    ...Object.entries(t.selection).map(([k, v]) => `     <item>\n      <ID>S</ID>\n      <KEY>${k}</KEY>\n      <ENTRY>${esc(v)}</ENTRY>\n      <LENGTH>${v.length + 8}</LENGTH>\n     </item>`)
  ];
  return wrap('LCL_OBJECT_PROG', `   <PROGDIR>
    <NAME>${name.toUpperCase()}</NAME>
    <SUBC>1</SUBC>
    <RLOAD>${LANGU}</RLOAD>
    <FIXPT>X</FIXPT>
    <UQUAL>X</UQUAL>
   </PROGDIR>
   <TPOOL>
${items.join('\n')}
   </TPOOL>`);
}

for (const [dir, pkgText] of [['abap-cloud/src', 'ABAP Toolkit - ABAP Cloud'], ['abap-clasico/src', 'ABAP Toolkit - ABAP clasico']]) {
  const full = path.join(lib, dir);
  const files = fs.readdirSync(full);
  let n = 0;
  for (const f of files) {
    let m = f.match(/^(.+)\.clas\.abap$/);
    if (m) {
      const hasTests = files.includes(`${m[1]}.clas.testclasses.abap`);
      fs.writeFileSync(path.join(full, `${m[1]}.clas.xml`), classXml(m[1], fs.readFileSync(path.join(full, f), 'utf8'), hasTests));
      n++;
      continue;
    }
    m = f.match(/^(.+)\.prog\.abap$/);
    if (m) { fs.writeFileSync(path.join(full, `${m[1]}.prog.xml`), progXml(m[1])); n++; }
  }
  fs.writeFileSync(path.join(full, 'package.devc.xml'), wrap('LCL_OBJECT_DEVC', `   <DEVC>\n    <CTEXT>${pkgText}</CTEXT>\n   </DEVC>`));
  console.log(`${dir}: ${n} objetos + package.devc.xml`);
}
