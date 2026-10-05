/*
 * Generadores adicionales:
 *  - report ALV (SALV) a partir de una tabla y sus campos
 *  - esqueleto de clase de test ABAP Unit a partir de la definición de una clase
 *  - clase de excepción con mensajes T100
 * Las funciones de generación están en window.AbapGen (también usables en Node).
 */
(function (root) {
  'use strict';

  const up = s => String(s || '').trim().toUpperCase();
  const low = s => String(s || '').trim().toLowerCase();
  const list = s => String(s || '').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);

  /* ------------------------------ Report ALV ------------------------------ */
  function alvReport(o) {
    const report = low(o.report || 'zr_listado');
    const table = low(o.table || 'mara');
    const fields = list(o.fields).map(low);
    const sel = list(o.selection).map(low).filter(f => fields.includes(f) || true);
    const title = (o.title || `Listado de ${up(table)}`).replace(/'/g, "''");
    const maxRows = parseInt(o.maxRows, 10) || 0;
    const so = sel.map(f => `  SELECT-OPTIONS s_${f.slice(0, 6)} FOR gs_sel-${f}.`).join('\n');
    const where = sel.map(f => `${f} IN @s_${f.slice(0, 6)}`).join('\n        AND ');
    const fieldList = fields.length ? fields.join(', ') : '*';

    return `*&---------------------------------------------------------------------*
*& Report ${up(report)}
*& ${o.title || 'Listado ALV de ' + up(table)}
*& Generado con los generadores ABAP de Abel González Guerra
*&---------------------------------------------------------------------*
REPORT ${report}.

" Estructura auxiliar para las SELECT-OPTIONS (referencia a los campos de la tabla)
DATA gs_sel TYPE ${table}.

SELECTION-SCREEN BEGIN OF BLOCK b01 WITH FRAME TITLE TEXT-b01.
${so || '  " Sin criterios de selección'}
${maxRows ? `  PARAMETERS p_max TYPE i DEFAULT ${maxRows}.` : ''}
SELECTION-SCREEN END OF BLOCK b01.

CLASS lcl_report DEFINITION FINAL.
  PUBLIC SECTION.
    TYPES: BEGIN OF ty_row,
${(fields.length ? fields : ['mandt']).map(f => `             ${f} TYPE ${table}-${f},`).join('\n')}
           END OF ty_row,
           tt_rows TYPE STANDARD TABLE OF ty_row WITH EMPTY KEY.

    METHODS run.

  PRIVATE SECTION.
    DATA mt_rows TYPE tt_rows.

    METHODS read_data.
    METHODS display.
ENDCLASS.


CLASS lcl_report IMPLEMENTATION.

  METHOD run.
    read_data( ).
    IF mt_rows IS INITIAL.
      MESSAGE 'No hay datos para los criterios indicados' TYPE 'S' DISPLAY LIKE 'W'.
      RETURN.
    ENDIF.
    display( ).
  ENDMETHOD.


  METHOD read_data.
    SELECT FROM ${table}
      FIELDS ${fieldList}${where ? `\n      WHERE ${where}` : ''}
      ORDER BY PRIMARY KEY
      INTO CORRESPONDING FIELDS OF TABLE @mt_rows${maxRows ? '\n      UP TO @p_max ROWS' : ''}.
  ENDMETHOD.


  METHOD display.
    TRY.
        cl_salv_table=>factory( IMPORTING r_salv_table = DATA(lo_alv)
                                CHANGING  t_table      = mt_rows ).
      CATCH cx_salv_msg INTO DATA(lx_salv).
        MESSAGE lx_salv TYPE 'S' DISPLAY LIKE 'E'.
        RETURN.
    ENDTRY.

    lo_alv->get_functions( )->set_all( abap_true ).
    lo_alv->get_columns( )->set_optimize( abap_true ).
    lo_alv->get_display_settings( )->set_striped_pattern( abap_true ).
    lo_alv->get_display_settings( )->set_list_header( '${title}' ).

    " Variantes de disposición guardables por el usuario
    DATA(lo_layout) = lo_alv->get_layout( ).
    lo_layout->set_key( VALUE #( report = sy-repid ) ).
    lo_layout->set_save_restriction( if_salv_c_layout=>restrict_none ).
    lo_layout->set_default( abap_true ).

    lo_alv->display( ).
  ENDMETHOD.

ENDCLASS.


START-OF-SELECTION.
  NEW lcl_report( )->run( ).
`.replace(/\n\n\n\n/g, '\n\n\n');
  }

  /* --------------------------- Esqueleto de tests --------------------------- */
  function parseClass(src) {
    // quitar comentarios y literales sencillos
    const code = src.split('\n').filter(l => !/^\*/.test(l)).map(l => l.replace(/".*$/, '')).join('\n');
    const cls = (code.match(/CLASS\s+([A-Za-z0-9_\/]+)\s+DEFINITION/i) || [])[1];
    const pub = (code.match(/PUBLIC\s+SECTION\.([\s\S]*?)(PROTECTED\s+SECTION|PRIVATE\s+SECTION|ENDCLASS)/i) || [])[1] || '';
    const stmts = pub.split('.').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const methods = [];
    stmts.forEach(s => {
      const m = s.match(/^(CLASS-METHODS|METHODS)\s*:?\s*([\s\S]*)$/i);
      if (!m) return;
      const isStatic = /^CLASS/i.test(m[1]);
      // sentencias encadenadas: METHODS: a ..., b ...  -> separar por comas de primer nivel
      splitChain(m[2]).forEach(def => {
        const name = (def.match(/^([A-Za-z0-9_~]+)/) || [])[1];
        if (!name || /^(CONSTRUCTOR|CLASS_CONSTRUCTOR)$/i.test(name) || /\bFOR\s+(EVENT|TESTING)\b/i.test(def) || name.includes('~')) return;
        methods.push(Object.assign({ name: low(name), isStatic }, parseParams(def)));
      });
    });
    return { cls: low(cls || 'zcl_mi_clase'), methods };
  }

  function splitChain(s) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  function parseParams(def) {
    const sect = kw => {
      const re = new RegExp(`\\b${kw}\\b([\\s\\S]*?)(?=\\b(IMPORTING|EXPORTING|CHANGING|RETURNING|RAISING|EXCEPTIONS)\\b|$)`, 'i');
      return (def.match(re) || [])[1] || '';
    };
    const params = txt => {
      const res = [];
      const re = /(?:VALUE\(\s*)?([A-Za-z0-9_]+)\s*\)?\s+TYPE\s+((?:REF\s+TO\s+|STANDARD\s+TABLE\s+OF\s+|TABLE\s+OF\s+|RANGE\s+OF\s+)?[A-Za-z0-9_\/=>\-]+)(\s+OPTIONAL|\s+DEFAULT\s+\S+)?/gi;
      let m;
      while ((m = re.exec(txt))) res.push({ name: low(m[1]), type: low(m[2]).replace(/\s+/g, ' '), optional: !!m[3] });
      return res;
    };
    const ret = params(sect('RETURNING'))[0] || null;
    const raising = list(sect('RAISING').replace(/RESUMABLE\(([^)]*)\)/gi, '$1')).map(low);
    return { importing: params(sect('IMPORTING')), changing: params(sect('CHANGING')), ret, raising };
  }

  function testClass(src) {
    const { cls, methods } = parseClass(src);
    const short = cls.replace(/^[zy]cl_/, '').slice(0, 22);
    const tname = n => (n.length > 27 ? n.slice(0, 27) : n);
    // Los tipos genéricos (p, c, any...) no valen para declarar variables: se concretan
    const GENERIC = { p: 'p LENGTH 15 DECIMALS 2', c: 'c LENGTH 20', n: 'n LENGTH 10', x: 'x LENGTH 16', any: 'string', data: 'string', simple: 'string', clike: 'string', csequence: 'string', numeric: 'decfloat34', xsequence: 'xstring', decfloat: 'decfloat34' };
    const concrete = t => {
      if (GENERIC[t]) return GENERIC[t];
      if (/^(standard table of|table of) /.test(t)) return t.replace(/^table of/, 'standard table of') + ' WITH EMPTY KEY';
      return t;
    };
    const todo = t => /^ref to /.test(t) ? '" TODO: NEW #( ) o un doble de prueba' : '" TODO: valor de entrada';

    if (!methods.length) {
      return `" No se encontraron métodos públicos en la definición.\n" Pega la definición completa de la clase (CLASS ... DEFINITION ... ENDCLASS).`;
    }

    const decl = methods.map(m => `    METHODS ${tname(m.name)}_ok FOR TESTING${m.raising.length ? ' RAISING cx_static_check' : ''}.`).join('\n');

    const impl = methods.map(m => {
      const lines = [];
      const call = m.isStatic ? `${cls}=>${m.name}` : `mo_cut->${m.name}`;
      lines.push(`  METHOD ${tname(m.name)}_ok.`);
      lines.push('    " Dado');
      const args = [];
      m.importing.forEach(p => {
        if (p.optional) return;
        lines.push(`    DATA ${p.name} TYPE ${concrete(p.type)}.  ${todo(p.type)}`);
        args.push(`${p.name} = ${p.name}`);
      });
      m.changing.forEach(p => {
        lines.push(`    DATA ${p.name} TYPE ${concrete(p.type)}.  " TODO: valor inicial`);
        args.push(`${p.name} = ${p.name}`);
      });
      const argTxt = m.importing.filter(p => !p.optional).length || m.changing.length
        ? (m.changing.length ? ` ${m.importing.filter(p => !p.optional).length ? 'EXPORTING ' + m.importing.filter(p => !p.optional).map(p => `${p.name} = ${p.name}`).join(' ') + ' ' : ''}CHANGING ${m.changing.map(p => `${p.name} = ${p.name}`).join(' ')} ` : ` ${args.join(' ')} `)
        : ' ';
      lines.push('');
      lines.push('    " Cuando');
      if (m.ret) lines.push(`    DATA(${m.ret.name}) = ${call}(${argTxt}).`);
      else lines.push(`    ${call}(${argTxt}).`);
      lines.push('');
      lines.push('    " Entonces');
      if (m.ret) {
        if (m.ret.type === 'abap_bool') lines.push(`    cl_abap_unit_assert=>assert_true( act = ${m.ret.name} msg = '${m.name}: resultado inesperado' ).`);
        else if (/^ref to /.test(m.ret.type)) lines.push(`    cl_abap_unit_assert=>assert_bound( act = ${m.ret.name} msg = '${m.name}: no devuelve objeto' ).`);
        else {
          lines.push(`    DATA lv_expected TYPE ${concrete(m.ret.type)}.  " TODO: resultado esperado`);
          lines.push(`    cl_abap_unit_assert=>assert_equals( act = ${m.ret.name} exp = lv_expected msg = '${m.name}: resultado inesperado' ).`);
        }
      } else if (m.changing.length) {
        lines.push(`    DATA lv_expected TYPE ${concrete(m.changing[0].type)}.  " TODO: valor esperado`);
        lines.push(`    cl_abap_unit_assert=>assert_equals( act = ${m.changing[0].name} exp = lv_expected ).`);
      } else {
        lines.push(`    cl_abap_unit_assert=>fail( 'TODO: comprobar el efecto de ${m.name}' ).`);
      }
      lines.push('  ENDMETHOD.');
      return lines.join('\n');
    }).join('\n\n\n');

    const hasInstance = methods.some(m => !m.isStatic);
    return `"! Tests de ${up(cls)}. Pegar en la pestaña "Test Classes" de la clase y ejecutar con Ctrl+Shift+F10.
CLASS ltcl_${short} DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.${hasInstance ? `\n    DATA mo_cut TYPE REF TO ${cls}.   " clase bajo prueba\n\n    METHODS setup.` : ''}
${decl}
ENDCLASS.


CLASS ltcl_${short} IMPLEMENTATION.
${hasInstance ? `
  METHOD setup.
    mo_cut = NEW #( ).   " TODO: parámetros del constructor o dobles de prueba
  ENDMETHOD.

` : ''}
${impl}

ENDCLASS.
`;
  }

  /* ---------------------------- Clase de excepción --------------------------- */
  function exceptionClass(o) {
    const name = low(o.name || 'zcx_mi_error');
    const msgid = up(o.msgid || 'ZMSG');
    const base = o.base || 'cx_static_check';
    const msgs = String(o.messages || '').split('\n').map(l => l.trim()).filter(Boolean).map((l, i) => {
      const [c, n, ...t] = l.split(';');
      const text = (t.join(';') || c || '').trim();
      return { constant: low(c || `error_${i + 1}`).replace(/[^a-z0-9_]/g, '_').slice(0, 30), number: String(n || i + 1).replace(/\D/g, '').padStart(3, '0'), text };
    });
    if (!msgs.length) msgs.push({ constant: 'generic_error', number: '001', text: '&1 &2 &3 &4' });
    const maxAttr = Math.min(4, Math.max(0, ...msgs.map(m => Math.max(0, ...(m.text.match(/&(\d)/g) || ['&0']).map(x => +x[1])) || (m.text.match(/&(?!\d)/g) || []).length)));
    const attrs = [1, 2, 3, 4].slice(0, Math.max(maxAttr, 1));

    const consts = msgs.map(m => `      BEGIN OF ${m.constant},
        msgid TYPE symsgid VALUE '${msgid}',
        msgno TYPE symsgno VALUE '${m.number}',
${[1, 2, 3, 4].map(n => `        attr${n} TYPE scx_attrname VALUE '${n <= attrs.length ? `MV_ATTR${n}` : ''}',`).join('\n')}
      END OF ${m.constant}`).join(',\n');

    const se91 = msgs.map(m => `"!   ${msgid} ${m.number}  ${m.text}`).join('\n');
    const first = msgs[0];
    return `"! <p class="shorttext synchronized">${o.description || 'Excepción con mensajes de ' + msgid}</p>
"! Mensajes que hay que crear en SE91 (clase de mensajes ${msgid}):
${se91}
"!
"! Uso:
"!   RAISE EXCEPTION NEW ${name}( textid = ${name}=>${first.constant}${attrs.length ? ` attr1 = CONV #( lv_valor )` : ''} ).
"!   ...
"!   CATCH ${name} INTO DATA(lx). MESSAGE lx TYPE 'S' DISPLAY LIKE 'E'.
CLASS ${name} DEFINITION
  PUBLIC
  INHERITING FROM ${base}
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_t100_dyn_msg.
    INTERFACES if_t100_message.

    CONSTANTS:
${consts}.

${attrs.map(n => `    DATA mv_attr${n} TYPE string READ-ONLY.`).join('\n')}

    METHODS constructor
      IMPORTING textid   LIKE if_t100_message=>t100key OPTIONAL
                previous LIKE previous OPTIONAL
${attrs.map(n => `                attr${n}    TYPE string OPTIONAL`).join('\n')}.
ENDCLASS.



CLASS ${name} IMPLEMENTATION.

  METHOD constructor ##ADT_SUPPRESS_GENERATION.
    super->constructor( previous = previous ).

${attrs.map(n => `    mv_attr${n} = attr${n}.`).join('\n')}

    CLEAR me->textid.
    IF textid IS INITIAL.
      if_t100_message~t100key = if_t100_message=>default_textid.
    ELSE.
      if_t100_message~t100key = textid.
    ENDIF.
  ENDMETHOD.

ENDCLASS.
`;
  }

  root.AbapGen = { alvReport, testClass, exceptionClass, parseClass };

  /* ------------------------------ Interfaz ------------------------------ */
  if (typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  const hl = c => root.AbapHighlight.highlight(c);
  const bind = (inputs, outId, fn, copyId) => {
    const run = () => { const code = fn(); $(outId).dataset.raw = code; $(outId).innerHTML = hl(code); };
    inputs.forEach(id => $(id).addEventListener('input', run));
    $(copyId).addEventListener('click', async e => {
      try { await navigator.clipboard.writeText($(outId).dataset.raw || ''); e.target.textContent = 'Copiado'; } catch (err) { e.target.textContent = 'No se pudo copiar'; }
      setTimeout(() => { e.target.textContent = 'Copiar'; }, 1400);
    });
    run();
  };

  if ($('alv-out')) {
    bind(['alv-report', 'alv-table', 'alv-fields', 'alv-sel', 'alv-title', 'alv-max'], 'alv-out', () => alvReport({
      report: $('alv-report').value, table: $('alv-table').value, fields: $('alv-fields').value,
      selection: $('alv-sel').value, title: $('alv-title').value, maxRows: $('alv-max').value
    }), 'alv-copy');
  }
  if ($('ut-out')) {
    bind(['ut-in'], 'ut-out', () => testClass($('ut-in').value), 'ut-copy');
  }
  if ($('cx-out')) {
    const base = $('cx-base');
    base.addEventListener('change', () => base.dispatchEvent(new Event('input')));
    bind(['cx-name', 'cx-msgid', 'cx-base', 'cx-msgs'], 'cx-out', () => exceptionClass({
      name: $('cx-name').value, msgid: $('cx-msgid').value, base: $('cx-base').value, messages: $('cx-msgs').value
    }), 'cx-copy');
  }
})(typeof window !== 'undefined' ? window : globalThis);
