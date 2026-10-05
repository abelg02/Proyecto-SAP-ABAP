/* Interfaz del conversor de Open SQL */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const hl = c => window.AbapHighlight.highlight(c);
  const esc = s => window.AbapHighlight.escapeHtml(String(s));

  function run() {
    const res = window.SqlConvert.convert($('sql-in').value, { inline: $('sql-inline').checked });
    const out = $('sql-out');
    if (!res.length) {
      out.innerHTML = '<div class="panel-empty">Pega una o varias sentencias SELECT con la sintaxis antigua.</div>';
      $('sql-copy').dataset.raw = '';
      return;
    }
    $('sql-copy').dataset.raw = res.map(r => r.code).join('\n\n');
    out.innerHTML = res.map((r, i) => `
      <div class="sql-block">
        <div class="small muted" style="margin-bottom:6px">Sentencia ${i + 1}${r.unchanged ? ' · sin cambios' : ''}</div>
        <pre><code>${hl(r.code)}</code></pre>
        ${r.warnings.length ? `<ul class="sql-warn">${r.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
      </div>`).join('');
  }

  $('sql-in').addEventListener('input', run);
  $('sql-inline').addEventListener('change', run);
  $('sql-copy').addEventListener('click', async e => {
    const b = e.target;
    try { await navigator.clipboard.writeText(b.dataset.raw || ''); b.textContent = 'Copiado'; } catch (err) { b.textContent = 'No se pudo copiar'; }
    setTimeout(() => { b.textContent = 'Copiar todo'; }, 1400);
  });
  $('sql-example').addEventListener('click', () => {
    $('sql-in').value = `SELECT ebeln lifnr bedat FROM ekko INTO TABLE lt_ekko
  WHERE bukrs IN s_bukrs
    AND bsart = p_bsart.

SELECT ebeln ebelp matnr menge netwr FROM ekpo INTO CORRESPONDING FIELDS OF TABLE lt_ekpo
  FOR ALL ENTRIES IN lt_ekko
  WHERE ebeln = lt_ekko-ebeln
    AND loekz = space.

SELECT SINGLE name1 FROM lfa1 INTO lv_name1 WHERE lifnr = ls_ekko-lifnr.

SELECT matnr SUM( menge ) AS total FROM ekpo INTO TABLE lt_totales
  WHERE ebeln IN s_ebeln
  GROUP BY matnr.`;
    run();
  });
  $('sql-example').click();
})();
