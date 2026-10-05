// Tests del conversor de Open SQL. Uso: node scripts/tests/test-sql.mjs
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
await import(pathToFileURL(path.join(here, '..', '..', 'web', 'js', 'sql-convert.js')).href);
const { convert } = globalThis.SqlConvert;

let ok = 0;
function t(name, fn) {
  try { fn(); ok++; console.log('  ok  ', name); }
  catch (e) { console.log('  FALLO', name, '\n       ', e.message); process.exitCode = 1; }
}
const one = (src, opts) => convert(src, opts)[0];

t('SELECT básico', () => assert.equal(one('SELECT matnr mtart FROM mara INTO TABLE lt_mara WHERE mtart = p_mtart.').code,
  'SELECT FROM mara\n  FIELDS matnr, mtart\n  WHERE mtart = @p_mtart\n  INTO TABLE @lt_mara.'));
t('SELECT SINGLE con estructura', () => assert.equal(one('SELECT SINGLE maktx FROM makt INTO lv_maktx WHERE matnr = ls_item-matnr AND spras = sy-langu.').code,
  'SELECT SINGLE FROM makt\n  FIELDS maktx\n  WHERE matnr = @ls_item-matnr AND spras = @sy-langu\n  INTO @lv_maktx.'));
t('FOR ALL ENTRIES', () => {
  const r = one('SELECT ebeln ebelp FROM ekpo INTO TABLE lt_ekpo FOR ALL ENTRIES IN lt_ekko WHERE ebeln = lt_ekko-ebeln.');
  assert.match(r.code, /FOR ALL ENTRIES IN @lt_ekko\n  WHERE ebeln = @lt_ekko-ebeln/);
  assert.ok(r.warnings.some(w => /no está vacía/.test(w)));
});
t('Rango IN', () => assert.match(one('SELECT vbeln FROM vbak INTO TABLE lt WHERE vbeln IN s_vbeln.').code, /IN @s_vbeln/));
t('Agregado con alias', () => assert.match(one('SELECT matnr SUM( kwmeng ) AS total FROM vbap INTO TABLE lt GROUP BY matnr.').code,
  /FIELDS matnr, SUM\( kwmeng \) AS total[\s\S]*GROUP BY matnr/));
t('COUNT(*)', () => assert.match(one('SELECT COUNT(*) FROM vbak INTO lv_n WHERE kunnr = lv_kunnr.').code, /FIELDS COUNT\( \* \)/));
t('INTO lista', () => assert.match(one('SELECT SINGLE matnr mtart FROM mara INTO (lv_matnr, lv_mtart) WHERE matnr = p_matnr.').code, /INTO \( @lv_matnr, @lv_mtart \)/));
t('JOIN', () => assert.match(one('SELECT a~vbeln b~posnr FROM vbak AS a INNER JOIN vbap AS b ON b~vbeln = a~vbeln INTO TABLE lt WHERE a~kunnr = p_kunnr.').code,
  /FROM vbak AS a INNER JOIN vbap AS b ON b~vbeln = a~vbeln\n  FIELDS a~vbeln, b~posnr/));
t('SELECT * avisa', () => assert.ok(one('SELECT * FROM mara INTO TABLE lt_mara.').warnings.some(w => /SELECT \*/.test(w))));
t('ENDSELECT avisa', () => assert.ok(one('SELECT matnr FROM mara INTO lv_matnr.').warnings.some(w => /ENDSELECT/.test(w))));
t('ORDER BY descendente', () => assert.match(one('SELECT vbeln netwr FROM vbak INTO TABLE lt ORDER BY netwr DESCENDING.').code, /ORDER BY netwr DESCENDING/));
t('UP TO n ROWS', () => assert.match(one('SELECT matnr FROM mara INTO TABLE lt UP TO 10 ROWS.').code, /UP TO 10 ROWS\.$/));
t('Declaración en línea', () => assert.match(one('SELECT matnr FROM mara INTO TABLE lt_mara.', { inline: true }).code, /INTO TABLE @DATA\(lt_mara\)/));
t('Literal intacto', () => assert.match(one("SELECT matnr FROM mara INTO TABLE lt WHERE mtart = 'FERT'.").code, /mtart = 'FERT'/));
t('Ya estricta no se toca', () => assert.ok(one('SELECT matnr FROM mara WHERE mtart = @p INTO TABLE @lt.').unchanged));
t('Comentarios ignorados', () => assert.equal(convert('* comentario\nSELECT matnr FROM mara INTO TABLE lt. " fin').length, 1));
t('Variable ambigua avisa', () => assert.ok(one('SELECT matnr FROM mara INTO TABLE lt WHERE mtart = tipo.').warnings.some(w => /tipo/.test(w))));

console.log(`\n${ok} tests correctos`);
