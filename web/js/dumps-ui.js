/* Explicador de dumps: busca el error de ejecución en el texto pegado y muestra su explicación */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = window.DumpsData;
  const hl = c => window.AbapHighlight.highlight(c);
  const esc = s => window.AbapHighlight.escapeHtml(String(s));

  const byExc = {};
  D.forEach(d => (d.exc || []).forEach(x => { (byExc[x] = byExc[x] || []).push(d); }));

  function card(d, open) {
    return `<details class="finding dump-card"${open ? ' open' : ''}>
      <summary><span class="sev sev-info">${esc(d.cat)}</span><span class="ln" style="font-family:var(--mono)">${d.id}</span><span>${esc(d.title)}</span><span></span></summary>
      <div class="finding-body">
        <p style="color:var(--text)">${esc(d.what)}</p>
        ${d.exc ? `<p class="small">Excepción capturable: ${d.exc.map(x => `<code>${x}</code>`).join(', ')}</p>` : ''}
        <h5 class="dh">Causas habituales</h5><ul>${d.causes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>
        <h5 class="dh">Cómo analizarlo</h5><ol>${d.steps.map(c => `<li>${esc(c)}</li>`).join('')}</ol>
        ${d.fix ? `<h5 class="dh">Corrección típica</h5><div class="ba"><div><h5>Antes</h5><pre><code>${hl(d.fix.before)}</code></pre></div><div><h5>Después</h5><pre><code>${hl(d.fix.after)}</code></pre></div></div>` : ''}
      </div>
    </details>`;
  }

  function analyze() {
    const text = $('dump-in').value;
    const out = $('dump-result');
    if (!text.trim()) { out.innerHTML = ''; return; }
    const upper = text.toUpperCase();

    const found = D.filter(d => new RegExp(`(^|[^A-Z0-9_])${d.id}([^A-Z0-9_]|$)`).test(upper));
    const excs = [...new Set(upper.match(/\bCX_[A-Z0-9_]+/g) || [])];
    excs.forEach(x => (byExc[x] || []).forEach(d => { if (!found.includes(d)) found.push(d); }));

    // Datos útiles del dump (en inglés o en español)
    const pick = re => (text.match(re) || [])[1];
    const facts = [
      ['Programa', pick(/(?:Program|Programa)\s*[:.]?\s+([A-Z0-9_\/=]+)/i)],
      ['Include', pick(/Include\s*[:.]?\s+([A-Z0-9_\/=]+)/i)],
      ['Línea', pick(/(?:Row|Line|Línea|Fila)\s*[:.]?\s+(\d+)/i)],
      ['Excepción', excs.join(', ')]
    ].filter(f => f[1]);

    let html = '';
    if (facts.length) html += `<div class="dump-facts">${facts.map(([k, v]) => `<span><b>${k}</b> ${esc(v)}</span>`).join('')}</div>`;
    if (found.length) {
      html += found.map((d, i) => card(d, i === 0)).join('');
    } else if (excs.length) {
      html += `<div class="callout">No tengo una ficha para <code>${esc(excs[0])}</code>. Las excepciones CX_SY_ son del sistema: busca su clase en SE24 (pestaña Textos) y mira la pila de llamadas del dump. Si es una excepción Z, el texto del dump indica qué validación falló.</div>`;
    } else {
      html += `<div class="callout">No reconozco el error en el texto. Pega el nombre exacto del error de ejecución (por ejemplo <code>TIME_OUT</code>) o el bloque "Runtime Errors / Error tiempo de ejecución" del dump. También puedes buscar en la lista de abajo.</div>`;
    }
    out.innerHTML = html;
  }

  function renderList() {
    const q = $('dump-search').value.trim().toUpperCase();
    const list = D.filter(d => !q || (d.id + ' ' + d.title + ' ' + d.what + ' ' + (d.exc || []).join(' ')).toUpperCase().includes(q));
    const cats = [...new Set(list.map(d => d.cat))];
    $('dump-count').textContent = `${list.length} de ${D.length} errores`;
    $('dump-list').innerHTML = cats.map(c => `<h3 class="dump-cat">${esc(c)}</h3>` + list.filter(d => d.cat === c).map(d => card(d, false)).join('')).join('') ||
      '<p class="muted">Sin resultados.</p>';
  }

  $('dump-in').addEventListener('input', analyze);
  $('dump-search').addEventListener('input', renderList);
  $('dump-example').addEventListener('click', () => {
    $('dump-in').value = `Category               ABAP programming error
Runtime Errors         ITAB_LINE_NOT_FOUND
Except.                CX_SY_ITAB_LINE_NOT_FOUND
ABAP Program           ZR_FACTURAS_MENSUALES
Application Component  Not assigned
Date and Time          05.10.2026 09:41:12

Short Text
    Line in internal table not found.

What happened?
    Error in the ABAP Application Program
    The current ABAP program "ZR_FACTURAS_MENSUALES" had to be terminated because it has
    come across a statement that unfortunately cannot be executed.

Information on where terminated
    The termination occurred in the ABAP program "ZR_FACTURAS_MENSUALES" - in "GET_TEXTS".
    The main program was "ZR_FACTURAS_MENSUALES".
    In the source code you have the termination point in line 214`;
    analyze();
  });
  renderList();
})();
