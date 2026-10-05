/* Generadores: esqueleto RAP y tipos ABAP desde JSON */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const hl = code => window.AbapHighlight.highlight(code);

  function download(text, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  async function copy(btn, text) {
    const old = btn.textContent;
    try { await navigator.clipboard.writeText(text); btn.textContent = 'Copiado'; } catch (e) { btn.textContent = 'No se pudo copiar'; }
    setTimeout(() => { btn.textContent = old; }, 1400);
  }

  /* ============================== 1. RAP ============================== */
  const rap = { files: {}, current: null };

  function genRap() {
    const prefix = $('rap-prefix').value.trim() || 'ABK';
    const entity = $('rap-entity').value.trim() || 'Request';
    const desc = $('rap-desc').value.trim() || entity;
    const plural = $('rap-plural').value.trim() || desc + 's';
    const values = window.RapTemplates.names(prefix, entity, desc, plural);
    rap.files = window.RapTemplates.generate(values);

    $('rap-names').innerHTML = Object.entries({
      'Tabla': values.TABLA, 'Tabla draft': values.TABLA_DRAFT, 'Vista raíz': values.R_VIEW, 'Proyección': values.C_VIEW,
      'Behavior pool': values.BP_CLASS, 'Parámetro acción': values.PARAM, 'Servicio': values.SERVICE
    }).map(([k, v]) => `<tr><td>${k}</td><td><code>${v}</code></td></tr>`).join('');

    const names = Object.keys(rap.files);
    if (!rap.current || !rap.files[rap.current]) rap.current = names[0];
    $('rap-tabs').innerHTML = names.map(n => `<button class="chip${n === rap.current ? ' on' : ''}" data-f="${n}">${n.replace(/^\d+_/, '').replace(/\..*$/, '').replace(/_/g, ' ')}</button>`).join('');
    $('rap-tabs').querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { rap.current = b.dataset.f; genRap(); }));
    $('rap-file').textContent = rap.current;
    $('rap-code').innerHTML = hl(rap.files[rap.current]);
  }

  ['rap-prefix', 'rap-entity', 'rap-desc', 'rap-plural'].forEach(id => $(id).addEventListener('input', genRap));
  $('rap-copy').addEventListener('click', e => copy(e.target, rap.files[rap.current]));
  $('rap-download').addEventListener('click', () => download(rap.files[rap.current], rap.current));
  $('rap-download-all').addEventListener('click', () => {
    // Un único fichero de texto con todos los objetos separados, para no depender de librerías ZIP
    const all = Object.entries(rap.files).map(([n, c]) => `${'='.repeat(72)}\n= ${n}\n${'='.repeat(72)}\n${c}`).join('\n\n');
    download(all, `rap_${$('rap-entity').value.trim().toLowerCase() || 'bo'}_todos.txt`);
  });
  genRap();

  /* ========================== 2. JSON -> ABAP ========================== */
  const toSnake = k => k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[^A-Za-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase() || 'field';
  const fieldName = k => {
    let n = toSnake(k);
    if (/^\d/.test(n)) n = 'f_' + n;
    return n.slice(0, 30);
  };

  function jsonToAbap(json, rootName) {
    const types = [];
    const used = new Set();
    const uniq = base => { let n = base.slice(0, 28), i = 2; while (used.has(n)) n = `${base.slice(0, 26)}_${i++}`; used.add(n); return n; };

    function scalar(v) {
      if (typeof v === 'boolean') return 'abap_bool';
      if (typeof v === 'number') return Number.isInteger(v) ? (Math.abs(v) > 2147483647 ? 'int8' : 'i') : 'decfloat34';
      if (typeof v === 'string') {
        if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return 'string " fecha-hora ISO; con /ui2/cl_json puede ir a timestampl';
        return 'string';
      }
      return 'string';
    }

    // Une las claves de todos los objetos de un array para no perder campos opcionales
    function mergeObjects(arr) {
      const out = {};
      arr.forEach(o => { if (o && typeof o === 'object' && !Array.isArray(o)) Object.entries(o).forEach(([k, v]) => { if (!(k in out) || out[k] === null) out[k] = v; }); });
      return out;
    }

    function structFor(obj, name) {
      const tname = uniq('ty_' + name);
      const lines = [];
      Object.entries(obj).forEach(([k, v]) => {
        const f = fieldName(k);
        if (Array.isArray(v)) {
          const sample = v.find(x => x !== null && x !== undefined);
          if (sample && typeof sample === 'object' && !Array.isArray(sample)) {
            const t = structFor(mergeObjects(v), f);
            lines.push(`${f} TYPE STANDARD TABLE OF ${t} WITH EMPTY KEY`);
          } else {
            lines.push(`${f} TYPE STANDARD TABLE OF ${sample === undefined ? 'string' : scalar(sample).split(' ')[0]} WITH EMPTY KEY`);
          }
        } else if (v && typeof v === 'object') {
          lines.push(`${f} TYPE ${structFor(v, f)}`);
        } else {
          lines.push(`${f} TYPE ${scalar(v)}`);
        }
      });
      const width = Math.max(...lines.map(l => l.indexOf(' TYPE')), 4);
      const body = lines.map(l => {
        const [fld, ...rest] = l.split(' TYPE ');
        const t = rest.join(' TYPE ');
        const comment = t.includes('"') ? t.slice(t.indexOf('"')) : '';
        const typ = comment ? t.slice(0, t.indexOf('"')).trim() : t;
        return `         ${fld.padEnd(width)} TYPE ${typ},${comment ? ' ' + comment : ''}`;
      });
      types.push(`TYPES: BEGIN OF ${tname},\n${body.join('\n')}\n       END OF ${tname}.`);
      return tname;
    }

    let rootType;
    let isTable = false;
    if (Array.isArray(json)) {
      isTable = true;
      rootType = structFor(mergeObjects(json), rootName);
      types.push(`TYPES tt_${rootName} TYPE STANDARD TABLE OF ${rootType} WITH EMPTY KEY.`);
    } else {
      rootType = structFor(json, rootName);
    }

    const target = isTable ? `lt_${rootName}` : `ls_${rootName}`;
    const decl = isTable ? `DATA ${target} TYPE tt_${rootName}.` : `DATA ${target} TYPE ${rootType}.`;
    const usage = `\n\n" Lectura (los nombres camelCase del JSON se mapean a snake_case)\n${decl}\n/ui2/cl_json=>deserialize( EXPORTING json        = lv_json\n                                     pretty_name = /ui2/cl_json=>pretty_mode-camel_case\n                           CHANGING  data        = ${target} ).\n\n" Con la biblioteca ABAP Toolkit:\n" zcl_abk_json=>from_json( EXPORTING iv_json = lv_json CHANGING cs_data = ${target} ).`;
    return types.join('\n\n') + usage;
  }

  function genJson() {
    const raw = $('json-in').value.trim();
    const name = fieldName($('json-name').value.trim() || 'response');
    const out = $('json-out');
    const err = $('json-err');
    if (!raw) { out.innerHTML = ''; err.textContent = ''; return; }
    try {
      const data = JSON.parse(raw);
      if (data === null || typeof data !== 'object') throw new Error('El JSON debe ser un objeto o un array.');
      const code = jsonToAbap(data, name);
      out.dataset.raw = code;
      out.innerHTML = hl(code);
      err.textContent = '';
    } catch (e) {
      err.textContent = 'JSON no válido: ' + e.message;
    }
  }
  $('json-in').addEventListener('input', genJson);
  $('json-name').addEventListener('input', genJson);
  $('json-copy').addEventListener('click', e => copy(e.target, $('json-out').dataset.raw || ''));
  $('json-example').addEventListener('click', () => {
    $('json-in').value = JSON.stringify({
      orderId: '4500012345',
      supplier: { id: '100234', name: 'Suministros Andalucía SL', vatNumber: 'ESB41000000', active: true },
      createdAt: '2026-10-02T09:14:00Z',
      totalAmount: 1520.75,
      currency: 'EUR',
      items: [
        { itemNo: 10, material: 'TORN-M8-40', quantity: 500, unitPrice: 0.12, deliveryDate: '2026-10-15' },
        { itemNo: 20, material: 'ARAND-M8', quantity: 500, unitPrice: 0.03, deliveryDate: '2026-10-15', notes: 'Zincado' }
      ],
      tags: ['urgente', 'obra-sevilla']
    }, null, 2);
    $('json-name').value = 'purchase_order';
    genJson();
  });
  $('json-example').click();
})();
