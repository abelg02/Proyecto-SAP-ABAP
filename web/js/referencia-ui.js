/* Referencia ABAP: búsqueda en transacciones, funciones/BAPIs y tablas */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const R = window.ReferenciaData;
  const esc = s => window.AbapHighlight.escapeHtml(String(s));
  let tab = 'transactions';

  const VIEWS = {
    transactions: {
      head: ['Transacción', 'Área', 'Para qué sirve'],
      rows: q => R.transactions.filter(x => match(q, x.code, x.area, x.desc)).map(x => [`<code>${esc(x.code)}</code>`, esc(x.area), esc(x.desc)])
    },
    functions: {
      head: ['Función / BAPI', 'Área', 'Qué hace', 'En ABAP Cloud'],
      rows: q => R.functions.filter(x => match(q, x.name, x.area, x.desc, x.cloud)).map(x => [`<code>${esc(x.name)}</code>`, esc(x.area), esc(x.desc), esc(x.cloud)])
    },
    tables: {
      head: ['Tabla', 'Contenido', 'Vista CDS liberada', 'En S/4HANA'],
      rows: q => R.tables.filter(x => match(q, x.name, x.desc, x.cds, x.s4)).map(x => [`<code>${esc(x.name)}</code>`, esc(x.desc), x.cds ? `<code>${esc(x.cds)}</code>` : '<span class="muted">-</span>', x.s4 ? esc(x.s4) : '<span class="muted">Sin cambios relevantes</span>'])
    }
  };

  function match(q, ...fields) {
    if (!q) return true;
    const hay = fields.join(' ').toUpperCase();
    return q.split(/\s+/).every(w => hay.includes(w));
  }

  function render() {
    const q = $('ref-search').value.trim().toUpperCase();
    const v = VIEWS[tab];
    const rows = v.rows(q);
    document.querySelectorAll('[data-ref]').forEach(b => {
      const n = VIEWS[b.dataset.ref].rows(q).length;
      b.classList.toggle('active', b.dataset.ref === tab);
      b.querySelector('.n').textContent = n;
    });
    $('ref-table').innerHTML = `<thead><tr>${v.head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${v.head.length}" class="muted">Sin resultados para "${esc(q)}".</td></tr>`}</tbody>`;
  }

  document.querySelectorAll('[data-ref]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.ref; render(); }));
  $('ref-search').addEventListener('input', render);
  const m = location.hash.match(/^#(transactions|functions|tables)$/);
  if (m) tab = m[1];
  render();
})();
