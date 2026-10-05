// Tests del motor de CleanCore Check. Uso: npm test
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(here, '..', '..', 'web');
await import(pathToFileURL(path.join(web, 'js', 'cleancore-engine.js')).href);
const { analyze, modernize } = globalThis.CleanCore;

let ok = 0;
function t(name, fn) {
  try { fn(); ok++; console.log('  ok  ', name); }
  catch (e) { console.log('  FALLO', name, '\n       ', e.message); process.exitCode = 1; }
}
const ids = (src, target = 'cloud') => analyze(src, { target }).findings.map(f => f.rule);

console.log('Reglas');
t('MOVE se detecta', () => assert.ok(ids('MOVE a TO b.').includes('OBS-001')));
t('MOVE-CORRESPONDING no es OBS-001', () => assert.ok(!ids('MOVE-CORRESPONDING a TO b.').includes('OBS-001')));
t('Literal con palabra clave no da falso positivo', () => assert.deepEqual(ids("lv_text = 'MOVE a TO b. SELECT * FROM mara'."), []));
t('Comentario no da falso positivo', () => assert.deepEqual(ids('* SELECT * FROM mara.\nlv_a = 1. " ADD 1 TO x.'), []));
t('SELECT en LOOP', () => assert.ok(ids('LOOP AT lt INTO DATA(ls).\n SELECT SINGLE a FROM zt INTO @DATA(x) WHERE b = @ls-b.\nENDLOOP.').includes('PERF-001')));
t('SELECT fuera de LOOP no es PERF-001', () => assert.ok(!ids('SELECT SINGLE a FROM zt INTO @DATA(x) WHERE b = @lv.').includes('PERF-001')));
t('FAE sin comprobar', () => assert.ok(ids('SELECT a FROM zt FOR ALL ENTRIES IN @lt WHERE a = @lt-a INTO TABLE @DATA(r).').includes('PERF-003')));
t('FAE comprobado', () => assert.ok(!ids('IF lt IS NOT INITIAL.\nSELECT a FROM zt FOR ALL ENTRIES IN @lt WHERE a = @lt-a INTO TABLE @DATA(r).\nENDIF.').includes('PERF-003')));
t('BINARY SEARCH sin SORT', () => assert.ok(ids('READ TABLE lt INTO ls WITH KEY a = 1 BINARY SEARCH.').includes('PERF-004')));
t('BINARY SEARCH con SORT', () => assert.ok(!ids('SORT lt BY a.\nREAD TABLE lt INTO ls WITH KEY a = 1 BINARY SEARCH.').includes('PERF-004')));
t('MARA en cloud', () => assert.ok(ids('SELECT FROM mara FIELDS matnr INTO TABLE @DATA(x).').includes('CLD-002')));
t('MARA on-premise no es CLD', () => assert.ok(!ids('SELECT FROM mara FIELDS matnr INTO TABLE @DATA(x).', 'onprem').some(i => i.startsWith('CLD'))));
t('Tabla Z no es CLD-002', () => assert.ok(!ids('SELECT FROM zmara FIELDS matnr INTO TABLE @DATA(x).').includes('CLD-002')));
t('BAPI no liberada con alternativa', () => {
  const f = analyze("CALL FUNCTION 'BAPI_PO_CREATE1' EXPORTING poheader = ls.").findings.find(x => x.rule === 'CLD-006');
  assert.ok(f && /I_PurchaseOrderTP_2/.test(f.detail));
});
t('Función Z no es CLD-006', () => assert.ok(!ids("CALL FUNCTION 'Z_MI_FUNCION'.").includes('CLD-006')));
t('Credencial', () => assert.ok(ids("lv_password = 'x'.").includes('SEC-003')));
t('Usuario fijo', () => assert.ok(ids("IF sy-uname = 'PEPE'.\nENDIF.").includes('SEC-004')));
t('WHERE dinámico', () => assert.ok(ids('SELECT a FROM zt WHERE (lv_where) INTO TABLE @DATA(x).').includes('SEC-001')));
t('CATCH vacío', () => assert.ok(ids('TRY.\n x( ).\nCATCH cx_sy_zerodivide.\nENDTRY.').includes('QA-002')));
t('CATCH con tratamiento', () => assert.ok(!ids('TRY.\n x( ).\nCATCH cx_sy_zerodivide.\n y( ).\nENDTRY.').includes('QA-002')));
t('LOOP sin área de trabajo', () => assert.ok(ids('LOOP AT lt.\nENDLOOP.').includes('OBS-014')));
t('LOOP con ASSIGNING', () => assert.ok(!ids('LOOP AT lt ASSIGNING FIELD-SYMBOL(<l>).\nENDLOOP.').includes('OBS-014')));

console.log('Sistemas destino y reglas nuevas');
t('ECC 7.0x marca DATA( en línea', () => assert.ok(ids('LOOP AT lt INTO DATA(ls).\nENDLOOP.', 'ecc700').includes('REL-001')));
t('S/4 no marca DATA( en línea', () => assert.ok(!ids('LOOP AT lt INTO DATA(ls).\nENDLOOP.', 's4op').includes('REL-001')));
t('ECC 7.0x marca VALUE #(', () => assert.ok(ids("lt = VALUE #( ( 1 ) ).", 'ecc700').includes('REL-002')));
t('DATA ... VALUE literal no es REL-002', () => assert.ok(!ids("DATA lv TYPE c VALUE 'X'.", 'ecc700').includes('REL-002')));
t('ECC 7.40 marca +=', () => assert.ok(ids('lv_n += 1.', 'ecc740').includes('REL-005')));
t('S/4 no marca +=', () => assert.ok(!ids('lv_n += 1.', 's4op').includes('REL-005')));
t('ECC 7.0x no propone NEW (OBS-011 desactivada)', () => assert.ok(!ids('CREATE OBJECT lo.', 'ecc700').includes('OBS-011')));
t('VBUK en S/4', () => assert.ok(ids('SELECT SINGLE gbstk FROM vbuk INTO @DATA(x) WHERE vbeln = @lv.', 's4op').includes('S4-001')));
t('VBUK en ECC no es S4', () => assert.ok(!ids('SELECT SINGLE gbstk FROM vbuk INTO x WHERE vbeln = lv.', 'ecc740').includes('S4-001')));
t('SELECT sin ORDER BY + BINARY SEARCH', () => assert.ok(ids('SELECT a b FROM ekpo INTO TABLE lt_ekpo.\nREAD TABLE lt_ekpo INTO ls WITH KEY a = 1 BINARY SEARCH.', 's4op').includes('S4-002')));
t('Con ORDER BY no es S4-002', () => assert.ok(!ids('SELECT a, b FROM ekpo ORDER BY a INTO TABLE @lt_ekpo.\nREAD TABLE lt_ekpo INTO ls WITH KEY a = 1 BINARY SEARCH.', 's4op').includes('S4-002')));
t('MATNR de 18', () => assert.ok(ids('DATA lv_matnr TYPE c LENGTH 18.', 's4op').includes('S4-003')));
t('XD01 en S/4', () => assert.ok(ids("CALL TRANSACTION 'XD01' USING lt_bdc.", 's4op').includes('S4-004')));
t('MB1A en S/4', () => assert.ok(ids("CALL TRANSACTION 'MB1A' USING lt_bdc.", 's4op').includes('S4-005')));
t('UPDATE sobre MARA', () => assert.ok(ids("UPDATE mara SET mtart = 'FERT' WHERE matnr = @lv.", 'ecc740').includes('SEC-008')));
t('UPDATE sobre tabla Z no es SEC-008', () => assert.ok(!ids("UPDATE zmara SET mtart = 'FERT' WHERE matnr = @lv.", 'ecc740').includes('SEC-008')));
t('DELETE de tabla interna no es SEC-008', () => assert.ok(!ids("DELETE lt_items WHERE status = 'X'.", 'ecc740').includes('SEC-008')));
t('OPEN DATASET p_file sin validar', () => assert.ok(ids('OPEN DATASET p_file FOR INPUT IN TEXT MODE ENCODING UTF-8.', 's4op').includes('SEC-009')));
t('BUKRS fijo', () => assert.ok(ids("SELECT a FROM zt WHERE bukrs = '1000' INTO TABLE @DATA(x).", 's4op').includes('QA-008')));
t('Bloque de código comentado', () => assert.ok(ids("* SELECT * FROM mara INTO TABLE lt.\n* LOOP AT lt INTO ls.\n*   lv = ls-matnr.\n*   APPEND ls TO lt2.\n* ENDLOOP.\nlv = 1.", 's4op').includes('QA-010')));
t('Comentario normal no es bloque', () => assert.ok(!ids("* Este programa lee pedidos\n* y los muestra en un ALV\n* para Compras\n* desde 2009\n* revisado 2015\nlv = 1.", 's4op').includes('QA-010')));
t('Private Edition rebaja cloud a aviso', () => {
  const f = analyze('SELECT FROM mara FIELDS matnr INTO TABLE @DATA(x).', { target: 's4pce' }).findings.find(x => x.rule === 'CLD-002');
  assert.ok(f && f.sev === 'warning');
});
t('Reglas desactivadas', () => assert.ok(!analyze('MOVE a TO b.', { target: 's4op', disabled: ['OBS-001'] }).findings.length));
t('Comentario cleancore:ignorar', () => assert.ok(!ids('SUBMIT (lv_rep) AND RETURN. " cleancore:ignorar SEC-010 lista blanca previa', 's4op').includes('SEC-010')));

console.log('Modernizador');
t('ECC 7.40: ADD sin +=', () => assert.equal(modernize('ADD 1 TO lv_n.', { target: 'ecc740' }).code, 'lv_n = lv_n + 1.'));
t('ECC 7.0x: CREATE OBJECT no se toca', () => assert.equal(modernize('CREATE OBJECT lo.', { target: 'ecc700' }).code, 'CREATE OBJECT lo.'));
t('On-premise: sy-datum no se toca', () => assert.equal(modernize('lv_d = sy-datum.', { target: 's4op' }).code, 'lv_d = sy-datum.'));
const mod =src => modernize(src, { target: 'cloud' }).code;
t('MOVE', () => assert.equal(mod('  MOVE a TO b.'), '  b = a.'));
t('ADD con comentario', () => assert.equal(mod('ADD 1 TO lv_n. " contador'), 'lv_n += 1. " contador'));
t('DESCRIBE', () => assert.equal(mod('DESCRIBE TABLE lt LINES n.'), 'n = lines( lt ).'));
t('CREATE OBJECT simple', () => assert.equal(mod('CREATE OBJECT lo_x.'), 'lo_x = NEW #( ).'));
t('CREATE OBJECT con parámetros no se toca', () => assert.equal(mod('CREATE OBJECT lo_x EXPORTING a = 1.'), 'CREATE OBJECT lo_x EXPORTING a = 1.'));
t('CONCATENATE', () => assert.equal(mod('CONCATENATE a b INTO c.'), 'c = a && b.'));
t('CONCATENATE SEPARATED BY space', () => assert.equal(mod('CONCATENATE a b INTO c SEPARATED BY space.'), 'c = |{ a } { b }|.'));
t('sy-datum', () => assert.equal(mod('lv_d = sy-datum.'), 'lv_d = cl_abap_context_info=>get_system_date( ).'));
t('TYPE sy-datum no se toca', () => assert.equal(mod('DATA lv_d TYPE sy-datum.'), 'DATA lv_d TYPE sy-datum.'));
t('sy-datum en SQL no se toca', () => assert.equal(mod('SELECT a FROM zt WHERE d = @sy-datum INTO TABLE @DATA(x).'), 'SELECT a FROM zt WHERE d = @sy-datum INTO TABLE @DATA(x).'));
t('Dos sentencias en la línea no se tocan', () => assert.equal(mod('MOVE a TO b. MOVE c TO d.'), 'MOVE a TO b. MOVE c TO d.'));

console.log('Programa de ejemplo');
const legacy = fs.readFileSync(path.join(web, 'herramientas', 'ejemplos', 'zr_pedidos_legacy.abap'), 'utf8');
const r = analyze(legacy, { target: 'cloud' });
console.log(`  Puntuación ${r.score} · ${r.counts.error} errores, ${r.counts.warning} avisos, ${r.counts.info} sugerencias`);
const byRule = {};
r.findings.forEach(f => { byRule[f.rule] = (byRule[f.rule] || 0) + 1; });
console.log('  ' + Object.entries(byRule).map(([k, v]) => `${k}×${v}`).join('  '));
const m = modernize(legacy, { target: 'cloud' });
console.log(`  Cambios automáticos: ${m.changes.length}`);
m.changes.forEach(c => console.log(`    L${c.line} ${c.rule}: ${c.from}  ->  ${c.to}`));

console.log('Biblioteca propia (debería salir limpia)');
const lib = path.join(here, '..', '..', 'biblioteca');
for (const [dir, target] of [['abap-cloud/src', 'cloud'], ['abap-clasico/src', 'onprem']]) {
  for (const f of fs.readdirSync(path.join(lib, dir)).filter(n => n.endsWith('.abap'))) {
    const res = analyze(fs.readFileSync(path.join(lib, dir, f), 'utf8'), { target });
    const list = res.findings.map(x => `${x.rule}@${x.line}`).join(' ');
    console.log(`  ${String(res.score).padStart(3)}  ${dir}/${f}  ${list}`);
  }
}
console.log(`\n${ok} tests correctos`);
