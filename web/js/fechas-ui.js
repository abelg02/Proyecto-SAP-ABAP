/* Conversor de timestamps y fechas ABAP */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  const hl = c => window.AbapHighlight.highlight(c);

  // Interpreta lo que escriba el usuario y devuelve una fecha UTC (Date) y la parte decimal de segundos
  function parse(input) {
    const s = input.trim();
    let m;
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:[.,](\d{1,7}))?$/))) {           // TIMESTAMP / TIMESTAMPL
      return { date: new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6])), frac: (m[7] || '').padEnd(7, '0'), kind: m[7] ? 'TIMESTAMPL (UTC)' : 'TIMESTAMP (UTC)' };
    }
    if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) {                                                    // DATS
      return { date: new Date(Date.UTC(+m[1], m[2] - 1, +m[3])), frac: '0000000', kind: 'DATS (fecha)' };
    }
    if ((m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/))) { // 05.10.2026 14:30
      return { date: new Date(Date.UTC(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))), frac: '0000000', kind: 'Fecha en formato europeo' };
    }
    if ((m = s.match(/^\d{9,10}$/))) return { date: new Date(+s * 1000), frac: '0000000', kind: 'Unix (segundos)' };
    if ((m = s.match(/^\d{12,13}$/))) return { date: new Date(+s), frac: pad(+s % 1000, 3) + '0000', kind: 'Unix (milisegundos)' };
    const d = new Date(s);
    if (!isNaN(d)) return { date: d, frac: pad(d.getUTCMilliseconds(), 3) + '0000', kind: 'ISO 8601' };
    return null;
  }

  function parts(d, tz) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, weekday: 'long' });
    const o = {};
    f.formatToParts(d).forEach(p => { o[p.type] = p.value; });
    if (o.hour === '24') o.hour = '00';
    return o;
  }

  const DAYS = { Monday: 'lunes', Tuesday: 'martes', Wednesday: 'miércoles', Thursday: 'jueves', Friday: 'viernes', Saturday: 'sábado', Sunday: 'domingo' };

  function convert() {
    const p = parse($('ts-in').value);
    const out = $('ts-out');
    if (!p) { out.innerHTML = '<tr><td colspan="2" class="muted">Formato no reconocido. Ejemplos: 20261005143000, 20261005143000.1234567, 20261005, 05.10.2026 14:30, 1791210600, 2026-10-05T14:30:00Z</td></tr>'; $('ts-code').innerHTML = ''; return; }
    const tz = $('ts-tz').value;
    const u = parts(p.date, 'UTC');
    const l = parts(p.date, tz);
    const tsU = `${u.year}${u.month}${u.day}${u.hour}${u.minute}${u.second}`;
    const tsL = `${l.year}${l.month}${l.day}${l.hour}${l.minute}${l.second}`;
    const rows = [
      ['Interpretado como', p.kind],
      ['TIMESTAMP (UTC)', tsU],
      ['TIMESTAMPL (UTC)', `${tsU}.${p.frac}`],
      [`Fecha local (${tz})`, `${l.day}.${l.month}.${l.year} · DATS ${l.year}${l.month}${l.day} · ${DAYS[l.weekday] || l.weekday}`],
      [`Hora local (${tz})`, `${l.hour}:${l.minute}:${l.second} · TIMS ${l.hour}${l.minute}${l.second}`],
      ['Timestamp local (no es UTC)', tsL],
      ['Unix (segundos)', String(Math.floor(p.date.getTime() / 1000))],
      ['ISO 8601 (UTC)', p.date.toISOString().replace('.000Z', 'Z')],
      ['Semana ISO', `${isoWeek(p.date)} de ${u.year}`]
    ];
    out.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td><code>${v}</code></td></tr>`).join('');
    const sapTz = $('ts-tz').selectedOptions[0].dataset.sap;
    $('ts-code').innerHTML = hl(`DATA lv_ts TYPE timestampl VALUE '${tsU}.${p.frac}'.

" Timestamp UTC -> fecha y hora locales
CONVERT TIME STAMP lv_ts TIME ZONE '${sapTz}'
  INTO DATE DATA(lv_date) TIME DATA(lv_time).
" lv_date = '${l.year}${l.month}${l.day}'  lv_time = '${l.hour}${l.minute}${l.second}'

" Fecha y hora locales -> timestamp UTC
CONVERT DATE lv_date TIME lv_time
  INTO TIME STAMP DATA(lv_ts_back) TIME ZONE '${sapTz}'.

" Timestamp actual (UTC)
GET TIME STAMP FIELD DATA(lv_now).                         " TIMESTAMP
DATA(lv_now_l) = utclong_current( ).                       " UTCLONG (7.54+)

" Diferencia en segundos entre dos TIMESTAMPL
DATA(lv_secs) = cl_abap_tstmp=>subtract( tstmp1 = lv_ts tstmp2 = lv_now ).`);
  }

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y) / 86400000 + 1) / 7);
  }

  /* ---------- Calculadora de días ---------- */
  function parseDate(s) {
    const p = parse(s);
    if (!p) return null;
    const u = parts(p.date, 'UTC');
    return new Date(Date.UTC(+u.year, u.month - 1, +u.day));
  }
  const fmt = d => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} (DATS ${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())})`;

  function calc() {
    const a = parseDate($('d-from').value), b = parseDate($('d-to').value);
    const n = parseInt($('d-add').value || '0', 10);
    const res = [];
    if (a && b) {
      const days = Math.round((b - a) / 86400000);
      let work = 0;
      const step = days >= 0 ? 1 : -1;
      for (let d = new Date(a); d.getTime() !== b.getTime(); d.setUTCDate(d.getUTCDate() + step)) {
        const wd = d.getUTCDay();
        if (wd !== 0 && wd !== 6) work += step;
      }
      res.push(`<tr><td>Días entre fechas</td><td><code>${days}</code> naturales · <code>${work}</code> laborables (lunes a viernes, sin festivos)</td></tr>`);
    }
    if (a && !isNaN(n)) {
      const plus = new Date(a); plus.setUTCDate(plus.getUTCDate() + n);
      let wd = new Date(a), left = Math.abs(n);
      while (left > 0) { wd.setUTCDate(wd.getUTCDate() + Math.sign(n)); if (wd.getUTCDay() % 6 !== 0) left--; }
      res.push(`<tr><td>Fecha inicial ${n >= 0 ? '+' : ''}${n} días</td><td><code>${fmt(plus)}</code></td></tr>`);
      res.push(`<tr><td>Fecha inicial ${n >= 0 ? '+' : ''}${n} laborables</td><td><code>${fmt(wd)}</code></td></tr>`);
      const last = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0));
      res.push(`<tr><td>Último día del mes</td><td><code>${fmt(last)}</code></td></tr>`);
    }
    $('d-out').innerHTML = res.join('') || '<tr><td class="muted">Escribe al menos la fecha inicial.</td></tr>';
  }

  ['ts-in', 'ts-tz'].forEach(id => $(id).addEventListener(id === 'ts-in' ? 'input' : 'change', convert));
  ['d-from', 'd-to', 'd-add'].forEach(id => $(id).addEventListener('input', calc));
  $('ts-now').addEventListener('click', () => {
    const d = new Date();
    $('ts-in').value = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
    convert();
  });
  $('ts-now').click();
  const today = new Date();
  $('d-from').value = `${pad(today.getDate())}.${pad(today.getMonth() + 1)}.${today.getFullYear()}`;
  calc();
})();
