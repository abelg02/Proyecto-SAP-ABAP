/* Interfaz de CleanCore Check. Depende de abap-highlight.js y cleancore-engine.js. Todo es gratuito y local. */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const src = $('src');
  const gutter = $('gutter');
  const panel = $('panel');
  const hl = code => window.AbapHighlight.highlight(code);
  const esc = s => window.AbapHighlight.escapeHtml(String(s));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
  };

  const state = {
    result: null, modern: null, files: [], fileName: '', fileResults: null,
    filterSev: 'all', filterCat: 'all', tab: 'findings',
    disabled: new Set(JSON.parse(store.get('ccc-disabled') || '[]'))
  };

  /* ------------------------------ Sistema destino ----------------------------- */
  const targetSel = $('target');
  const targetNote = $('target-note');
  const TARGETS = window.CleanCore.TARGETS;
  targetSel.innerHTML = Object.entries(TARGETS).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');
  targetSel.value = TARGETS[store.get('ccc-target')] ? store.get('ccc-target') : 's4op';
  const showNote = () => { targetNote.textContent = TARGETS[targetSel.value].note; };
  showNote();
  targetSel.addEventListener('change', () => {
    store.set('ccc-target', targetSel.value);
    showNote();
    if (src.value.trim()) run();
  });

  /* --------------------------------- Editor --------------------------------- */
  function updateGutter() {
    const n = src.value.split('\n').length;
    let s = '';
    for (let i = 1; i <= n; i++) s += i + '\n';
    gutter.textContent = s;
    $('editor-lines').textContent = `${n} ${n === 1 ? 'línea' : 'líneas'}`;
  }
  src.addEventListener('input', updateGutter);
  src.addEventListener('scroll', () => { gutter.scrollTop = src.scrollTop; });
  src.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b } = src;
      src.setRangeText('  ', a, b, 'end');
      updateGutter();
    }
  });

  function goToLine(line) {
    const lines = src.value.split('\n');
    let start = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) start += lines[i].length + 1;
    const end = start + (lines[line - 1] || '').length;
    src.focus();
    src.setSelectionRange(start, end);
    src.scrollTop = Math.max(0, (line - 6) * 20);
  }

  /* ------------------------------ Carga de código ---------------------------- */
  const EXAMPLES = {
    legacy: { file: 'zr_pedidos_legacy.abap', name: 'ZR_PEDIDOS_PENDIENTES', label: 'Report de 2009 (sintaxis antigua)' },
    s4: { file: 'zr_ventas_s4.abap', name: 'ZR_ENTREGAS_PENDIENTES', label: 'Report de ventas a migrar a S/4HANA' },
    security: { file: 'zcl_interfaz_inseguro.abap', name: 'ZCL_INTERFAZ_PRECIOS', label: 'Clase de interfaz con problemas de seguridad' }
  };
  function loadExample(key) {
    const ex = EXAMPLES[key];
    src.value = $('example-' + key).value;
    state.fileName = ex.name;
    state.files = [];
    $('editor-name').textContent = `${ex.file} (ejemplo)`;
    updateGutter();
    run();
  }
  document.querySelectorAll('[data-example]').forEach(b => b.addEventListener('click', () => loadExample(b.dataset.example)));

  $('btn-file').addEventListener('click', () => $('file').click());
  $('file').addEventListener('change', async e => {
    const list = [...e.target.files];
    if (!list.length) return;
    const texts = await Promise.all(list.map(f => f.text()));
    state.files = list.map((f, i) => ({ name: f.name, code: texts[i] }));
    src.value = texts[0];
    state.fileName = list[0].name;
    $('editor-name').textContent = list.length > 1 ? `${list[0].name} (+${list.length - 1} archivos)` : list[0].name;
    if (list.length > 1) state.tab = 'files';
    updateGutter();
    run();
    e.target.value = '';
  });

  // Arrastrar y soltar archivos sobre el editor
  const editorBox = src.closest('.editor');
  ['dragover', 'dragenter'].forEach(ev => editorBox.addEventListener(ev, e => { e.preventDefault(); editorBox.classList.add('drop'); }));
  ['dragleave', 'drop'].forEach(ev => editorBox.addEventListener(ev, () => editorBox.classList.remove('drop')));
  editorBox.addEventListener('drop', e => {
    e.preventDefault();
    if (!e.dataTransfer.files.length) return;
    const input = $('file');
    try { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); } catch (err) { /* navegador antiguo */ }
  });

  $('btn-run').addEventListener('click', run);
  $('btn-clear').addEventListener('click', () => {
    src.value = ''; state.result = null; state.files = []; state.fileName = '';
    $('editor-name').textContent = 'Código ABAP';
    updateGutter();
    panel.innerHTML = $('panel-empty-tpl').innerHTML;
  });

  /* -------------------------------- Análisis -------------------------------- */
  function run() {
    const code = src.value;
    if (!code.trim()) return;
    const opts = { target: targetSel.value, disabled: [...state.disabled] };
    state.result = window.CleanCore.analyze(code, opts);
    state.modern = window.CleanCore.modernize(code, opts);
    state.fileResults = state.files.length > 1
      ? state.files.map(f => ({ name: f.name, r: window.CleanCore.analyze(f.code, opts) }))
      : null;
    if (!state.fileResults && state.tab === 'files') state.tab = 'findings';
    render();
  }

  /* -------------------------------- Pintado --------------------------------- */
  const SEV_LABEL = { error: 'Error', warning: 'Aviso', info: 'Sugerencia' };
  const gradeClass = s => s >= 85 ? 'g-good' : s >= 60 ? 'g-mid' : 'g-bad';
  const fillClass = s => s >= 85 ? '' : s >= 60 ? 'mid' : 'bad';

  function render() {
    const r = state.result;
    const cats = Object.entries(r.categories);

    let html = `
      <div class="summary">
        <div class="score">
          <div class="score-num">${r.score}<small>/100</small></div>
          <div class="score-grade ${gradeClass(r.score)}">${r.grade}</div>
        </div>
        <div>
          <div class="counts">
            <span><b>${r.counts.error}</b> errores</span>
            <span><b>${r.counts.warning}</b> avisos</span>
            <span><b>${r.counts.info}</b> sugerencias</span>
            <span><b>${r.codeLines}</b> líneas de código</span>
          </div>
          <div class="cat-bars">
            ${cats.map(([, c]) => `
              <div class="cat-bar"><span>${c.label}</span><div class="track"><div class="fill ${fillClass(c.score)}" style="width:${Math.max(3, c.score)}%"></div></div><span>${c.score}</span></div>`).join('')}
          </div>
          <div class="small muted" style="margin-top:10px">${esc(r.targetLabel)} · ${r.rulesActive} reglas activas</div>
        </div>
      </div>`;

    const tabs = [
      ['findings', 'Hallazgos', r.findings.length],
      ['modern', 'Código modernizado', state.modern.changes.length]
    ];
    if (state.fileResults) tabs.push(['files', 'Archivos', state.fileResults.length]);
    tabs.push(['export', 'Exportar', null]);

    html += `<div class="tabs" role="tablist">${tabs.map(([id, label, n]) =>
      `<button class="tab${state.tab === id ? ' active' : ''}" data-tab="${id}" role="tab">${label}${n !== null ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;
    html += `<div class="tab-body">${renderTab()}</div>`;

    panel.innerHTML = html;
    bindPanel();
  }

  function renderTab() {
    if (state.tab === 'modern') return renderModern();
    if (state.tab === 'files') return renderFiles();
    if (state.tab === 'export') return renderExport();
    return renderFindings();
  }

  function renderFindings() {
    const r = state.result;
    const catOptions = Object.entries(r.categories).map(([k, c]) => `<option value="${k}"${state.filterCat === k ? ' selected' : ''}>${c.label} (${c.count})</option>`).join('');
    const chips = [['all', 'Todos'], ['error', 'Errores'], ['warning', 'Avisos'], ['info', 'Sugerencias']]
      .map(([k, l]) => `<button class="chip${state.filterSev === k ? ' on' : ''}" data-sev="${k}">${l}</button>`).join('');

    const list = r.findings.filter(f =>
      (state.filterSev === 'all' || f.sev === state.filterSev) && (state.filterCat === 'all' || f.cat === state.filterCat));

    let html = `<div class="filters">${chips}<select id="cat-filter"><option value="all">Todas las categorías</option>${catOptions}</select></div>`;

    if (!r.findings.length) {
      html += `<div class="panel-empty">Sin hallazgos para ${esc(r.targetLabel)}. Buen código.</div>`;
    } else if (!list.length) {
      html += `<div class="panel-empty">Ningún hallazgo con estos filtros.</div>`;
    } else {
      html += list.map(f => `
        <details class="finding">
          <summary>
            <span class="sev sev-${f.sev}">${SEV_LABEL[f.sev]}</span>
            <span class="ln">Línea ${f.line}</span>
            <span>${esc(f.title)}</span>
            <span class="rid">${f.rule}</span>
          </summary>
          <div class="finding-body">
            <pre><code>${hl(f.snippet)}</code></pre>
            ${f.detail ? `<p class="detail">${esc(f.detail)}</p>` : ''}
            <p>${esc(f.why)}</p>
            <div class="ba">
              <div><h5>Antes</h5><pre><code>${hl(f.before)}</code></pre></div>
              <div><h5>Después</h5><pre><code>${hl(f.after)}</code></pre></div>
            </div>
            <button class="linkish" data-line="${f.line}">Ir a la línea ${f.line}</button>
            · <button class="linkish" data-disable="${f.rule}">No aplicar ${f.rule}</button>
            · <span class="small muted">o añade <code>" cleancore:ignorar ${f.rule} motivo</code> al final de la línea</span>
          </div>
        </details>`).join('');
    }

    if (state.disabled.size) {
      html += `<div class="filters"><span class="small muted">Reglas desactivadas: ${[...state.disabled].join(', ')}</span> <button class="linkish" id="enable-all">Reactivar todas</button></div>`;
    }
    return html;
  }

  function renderModern() {
    const m = state.modern;
    if (!m.changes.length) return `<div class="panel-empty">No hay cambios automáticos seguros para este código y este sistema. Revisa los hallazgos uno a uno.</div>`;
    const changed = new Set(m.changes.map(c => c.line));
    const code = m.code.split('\n').map((l, i) => changed.has(i + 1) ? `<span class="hl">${hl(l)}</span>` : hl(l)).join('\n');
    return `
      <div class="mod-actions">
        <button class="btn btn-small" id="copy-modern">Copiar código</button>
        <button class="btn btn-secondary btn-small" id="download-modern">Descargar .abap</button>
        <button class="btn btn-secondary btn-small" id="apply-modern">Aplicar en el editor</button>
      </div>
      <div class="changes">
        <p class="small muted" style="margin:0 0 6px">${m.changes.length} ${m.changes.length === 1 ? 'cambio automático' : 'cambios automáticos'}, adaptados a la versión de ABAP del sistema elegido. Lo que necesita criterio (SQL, diseño, seguridad) no se toca.</p>
        ${m.changes.map(c => `<div class="change"><span>L${c.line}</span><div><div class="from">${esc(c.from)}</div><div class="to">${esc(c.to)}</div></div></div>`).join('')}
      </div>
      <pre class="mod-code"><code>${code}</code></pre>`;
  }

  function renderFiles() {
    const rows = state.fileResults.map((f, i) => `<tr><td><button class="linkish" data-file="${i}">${esc(f.name)}</button></td><td>${f.r.score}</td><td>${f.r.counts.error}</td><td>${f.r.counts.warning}</td><td>${f.r.counts.info}</td><td>${f.r.codeLines}</td></tr>`).join('');
    const avg = Math.round(state.fileResults.reduce((s, f) => s + f.r.score, 0) / state.fileResults.length);
    return `<p class="small muted" style="padding:12px 16px 0;margin:0">${state.fileResults.length} archivos · nota media ${avg}. Pulsa un archivo para ver sus hallazgos.</p>
      <table class="files-table"><thead><tr><th>Archivo</th><th>Nota</th><th>Errores</th><th>Avisos</th><th>Sug.</th><th>Líneas</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function renderExport() {
    return `
      <div class="mod-actions">
        <button class="btn btn-small" id="export-md">Informe en Markdown</button>
        <button class="btn btn-secondary btn-small" id="export-csv">Hallazgos en CSV</button>
        <button class="btn btn-secondary btn-small" id="export-print">Imprimir / PDF</button>
      </div>
      <p class="small muted" style="padding:0 16px">El Markdown se pega tal cual en Jira, GitHub o Confluence. El CSV se abre en Excel. "Imprimir" abre el informe en una ventana lista para guardar como PDF.</p>`;
  }

  function bindPanel() {
    panel.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); }));
    panel.querySelectorAll('[data-sev]').forEach(b => b.addEventListener('click', () => { state.filterSev = b.dataset.sev; render(); }));
    const cf = panel.querySelector('#cat-filter');
    cf && cf.addEventListener('change', () => { state.filterCat = cf.value; render(); });
    panel.querySelectorAll('[data-line]').forEach(b => b.addEventListener('click', () => goToLine(+b.dataset.line)));
    panel.querySelectorAll('[data-disable]').forEach(b => b.addEventListener('click', () => {
      state.disabled.add(b.dataset.disable);
      store.set('ccc-disabled', JSON.stringify([...state.disabled]));
      run();
    }));
    const ea = panel.querySelector('#enable-all');
    ea && ea.addEventListener('click', () => { state.disabled.clear(); store.set('ccc-disabled', '[]'); run(); });
    panel.querySelectorAll('[data-file]').forEach(b => b.addEventListener('click', () => {
      const f = state.files[+b.dataset.file];
      src.value = f.code; state.fileName = f.name; $('editor-name').textContent = f.name;
      updateGutter(); state.tab = 'findings'; run();
    }));

    const copy = panel.querySelector('#copy-modern');
    copy && copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(state.modern.code); copy.textContent = 'Copiado'; } catch (e) { copy.textContent = 'No se pudo copiar'; }
      setTimeout(() => { copy.textContent = 'Copiar código'; }, 1500);
    });
    const dl = panel.querySelector('#download-modern');
    dl && dl.addEventListener('click', () => download(state.modern.code, baseName() + '_modernizado.abap', 'text/plain'));
    const ap = panel.querySelector('#apply-modern');
    ap && ap.addEventListener('click', () => { src.value = state.modern.code; updateGutter(); state.tab = 'findings'; run(); });

    const md = panel.querySelector('#export-md');
    md && md.addEventListener('click', () => download(markdown(), baseName() + '_informe.md', 'text/markdown'));
    const csv = panel.querySelector('#export-csv');
    csv && csv.addEventListener('click', () => {
      const q = s => `"${String(s).replace(/"/g, '""')}"`;
      const rows = [['Archivo', 'Línea', 'Regla', 'Gravedad', 'Categoría', 'Título', 'Código', 'Detalle'].join(';')];
      const add = (name, r) => r.findings.forEach(f => rows.push([q(name), f.line, f.rule, SEV_LABEL[f.sev], q(f.catLabel), q(f.title), q(f.snippet), q(f.detail)].join(';')));
      if (state.fileResults) state.fileResults.forEach(f => add(f.name, f.r)); else add(state.fileName || 'codigo', state.result);
      download('﻿' + rows.join('\r\n'), baseName() + '_hallazgos.csv', 'text/csv');
    });
    const pr = panel.querySelector('#export-print');
    pr && pr.addEventListener('click', printReport);
  }

  function markdown() {
    let text = window.CleanCore.toMarkdown(state.result, state.fileName);
    if (state.fileResults) {
      text += '\n\n## Resumen por archivo\n\n| Archivo | Nota | Errores | Avisos | Sugerencias |\n|---|---|---|---|---|\n' +
        state.fileResults.map(f => `| ${f.name} | ${f.r.score} | ${f.r.counts.error} | ${f.r.counts.warning} | ${f.r.counts.info} |`).join('\n');
    }
    return text;
  }

  function printReport() {
    const r = state.result;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Informe CleanCore Check</title>
      <style>body{font-family:Arial,sans-serif;color:#1c2530;max-width:820px;margin:30px auto;padding:0 20px;font-size:13px;line-height:1.5}
      h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px}
      pre{background:#f6f8fa;border:1px solid #e3e7ec;padding:6px 8px;font-size:11px;white-space:pre-wrap}
      table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e3e7ec;padding:4px 6px;text-align:left}
      .e{color:#b42318}.w{color:#9a6200}.i{color:#0a5cad}</style></head><body>
      <h1>Informe CleanCore Check</h1>
      <p>${esc(state.fileName || 'Código pegado')} · ${esc(r.targetLabel)} · nota <b>${r.score}/100</b> (${r.grade}) · ${r.counts.error} errores, ${r.counts.warning} avisos, ${r.counts.info} sugerencias</p>
      <table>${Object.values(r.categories).map(c => `<tr><td>${c.label}</td><td>${c.count} hallazgos</td><td>${c.score}/100</td></tr>`).join('')}</table>
      ${r.findings.map(f => `<h2><span class="${f.sev[0]}">${SEV_LABEL[f.sev]}</span> · Línea ${f.line} · ${esc(f.title)} (${f.rule})</h2>
        <pre>${esc(f.snippet)}</pre>${f.detail ? `<p><b>${esc(f.detail)}</b></p>` : ''}<p>${esc(f.why)}</p>`).join('')}
      <p style="margin-top:30px;color:#888">Generado con CleanCore Check. El análisis se hizo en el navegador; el código no se envió a ningún servidor.</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  function baseName() { return (state.fileName || 'codigo').replace(/\.[^.]+$/, '').toLowerCase(); }

  function download(text, name, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  updateGutter();
  // ?ejemplo=legacy|s4|security en la URL carga ese ejemplo (enlaces desde el blog)
  const m = location.search.match(/[?&]ejemplo(?:=(\w+))?/);
  if (m) loadExample(EXAMPLES[m[1]] ? m[1] : 'legacy');

  // #codigo=...&nombre=...&sistema=... lo envía la extensión CleanCore para GitHub.
  // Va en el fragmento (#), que el navegador nunca manda al servidor, y se borra de la dirección al leerlo.
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('codigo')) {
    try {
      const b64 = h.get('codigo').replace(/-/g, '+').replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      src.value = new TextDecoder().decode(bytes);
      state.fileName = h.get('nombre') || '';
      state.files = [];
      $('editor-name').textContent = state.fileName || 'Código desde GitHub';
      if (TARGETS[h.get('sistema')]) { targetSel.value = h.get('sistema'); showNote(); }
      updateGutter();
      run();
    } catch (e) { /* enlace incompleto: se ignora */ }
    history.replaceState(null, '', location.pathname + location.search);
  }
})();
