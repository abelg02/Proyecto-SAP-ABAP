/* Interfaz del formateador ABAP */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  let result = '';

  function run() {
    const src = $('fmt-in').value;
    if (!src.trim()) { $('fmt-out').innerHTML = ''; $('fmt-stats').textContent = ''; result = ''; return; }
    result = window.AbapFormat.format(src, { keywords: $('fmt-case').value, indent: +$('fmt-indent').value });
    $('fmt-out').innerHTML = window.AbapHighlight.highlight(result.replace(/\n$/, ''));
    const changed = src.replace(/\r/g, '').split('\n').filter((l, i) => l !== (result.split('\n')[i] || '')).length;
    $('fmt-stats').textContent = `${result.split('\n').length - 1} líneas · ${changed} cambiadas`;
  }

  ['fmt-in', 'fmt-case', 'fmt-indent'].forEach(id => $(id).addEventListener(id === 'fmt-in' ? 'input' : 'change', run));
  $('fmt-copy').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(result); e.target.textContent = 'Copiado'; } catch (err) { e.target.textContent = 'No se pudo copiar'; }
    setTimeout(() => { e.target.textContent = 'Copiar resultado'; }, 1400);
  });
  $('fmt-example').addEventListener('click', () => {
    $('fmt-in').value = `report zr_stock_bajo.
parameters p_werks type werks_d obligatory.
start-of-selection.
select matnr, werks, lgort, labst from mard
where werks = @p_werks
into table @data(lt_stock).
loop at lt_stock into data(ls_stock).
if ls_stock-labst < 10.
case ls_stock-lgort.
when '0001'.
write: / ls_stock-matnr, 'stock bajo en almacén principal'.
when others.
write: / ls_stock-matnr, ls_stock-lgort.
endcase.
elseif ls_stock-labst = 0.
try.
data(lv_ratio) = 100 / ls_stock-labst.
catch cx_sy_zerodivide.
write: / ls_stock-matnr, 'sin stock'.
endtry.
endif.
endloop.`;
    run();
  });
  $('fmt-example').click();
})();
