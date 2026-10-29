// Tests del motor con la lista oficial de SAP cargada (web/datos/sap-apis.json).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../../web/js/cleancore-engine.js';

const C = globalThis.CleanCore;
const datos = JSON.parse(fs.readFileSync(new URL('../../web/datos/sap-apis.json', import.meta.url), 'utf8'));
let ok = 0;
const prueba = (nombre, fn) => { fn(); ok++; console.log('  ok  ', nombre); };
const reglas = (code, target, id) => C.analyze(code, { target }).findings.filter((f) => f.rule === id);

C.setSapList(datos);
prueba('Tabla no liberada: sucesor oficial', () => {
  const f = reglas("SELECT * FROM vbak INTO TABLE @DATA(lt).", 'btp', 'CLD-002');
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /lista oficial de SAP/);
  assert.match(f[0].detail, /I_SALESDOCUMENT/);
});
prueba('Vista CDS liberada en S/4HANA Cloud, no en BTP', () => {
  assert.equal(reglas("SELECT FROM i_product FIELDS product INTO TABLE @DATA(lt).", 's4pub', 'CLD-002').length, 0);
  // En BTP ABAP Environment no existen las vistas de S/4HANA: la lista oficial lo refleja
  assert.equal(reglas("SELECT FROM i_product FIELDS product INTO TABLE @DATA(lt).", 'btp', 'CLD-002').length, 1);
});
prueba('Tabla que no está en la lista (VBUK): no liberada', () => {
  assert.equal(reglas("SELECT * FROM vbuk INTO TABLE @DATA(lt).", 's4pub', 'CLD-002').length, 1);
});
prueba('Tablas Z: nunca', () => {
  assert.equal(reglas("SELECT * FROM zmi_tabla INTO TABLE @DATA(lt).", 'btp', 'CLD-002').length, 0);
});
prueba('Función liberada (BAPI_TRANSACTION_COMMIT): sin hallazgo', () => {
  assert.equal(reglas("CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'.", 'btp', 'CLD-006').length, 0);
});
prueba('BAPI no liberada en Public Edition: sucesor oficial', () => {
  const f = reglas("CALL FUNCTION 'BAPI_PO_CREATE1' EXPORTING poheader = ls.", 's4pub', 'CLD-006');
  assert.equal(f.length, 1);
  assert.match(f[0].detail, /I_PURCHASEORDERTP_2/);
});
prueba('Clase liberada: sin hallazgo; no liberada: hallazgo', () => {
  assert.equal(reglas("DATA(d) = cl_abap_context_info=>get_system_date( ).", 'btp', 'CLD-010').length, 0);
  assert.equal(reglas("cl_http_client=>create_by_url( EXPORTING url = lv IMPORTING client = lo ).", 'btp', 'CLD-010').length, 1);
});
prueba('SAP GUI no se cuenta dos veces', () => {
  assert.equal(reglas("DATA lo TYPE REF TO cl_gui_alv_grid.", 'btp', 'CLD-010').length, 0);
});
C.setSapList(null);
prueba('Sin lista, como antes', () => {
  assert.equal(reglas("SELECT * FROM vbak INTO TABLE @DATA(lt).", 'btp', 'CLD-002').length, 1);
  assert.equal(reglas("DATA(d) = cl_abap_context_info=>get_system_date( ).", 'btp', 'CLD-010').length, 0);
});
console.log(`\n${ok} tests de la lista oficial correctos`);
