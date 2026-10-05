/*
 * Conversor de Open SQL antiguo a sintaxis estricta (7.40 SP05+).
 *   SELECT matnr mtart FROM mara INTO TABLE lt_mara WHERE mtart = p_mtart.
 *   ->
 *   SELECT FROM mara
 *     FIELDS matnr, mtart
 *     WHERE mtart = @p_mtart
 *     INTO TABLE @lt_mara.
 * Funciona en el navegador (window.SqlConvert) y en Node (globalThis.SqlConvert).
 */
(function (root) {
  'use strict';

  const CLAUSES = [
    ['FOR', 'ALL', 'ENTRIES', 'IN'], ['GROUP', 'BY'], ['ORDER', 'BY'], ['UP', 'TO'], ['PACKAGE', 'SIZE'],
    ['BYPASSING', 'BUFFER'], ['CLIENT', 'SPECIFIED'], ['USING', 'CLIENT'],
    ['FROM'], ['INTO'], ['APPENDING'], ['WHERE'], ['HAVING'], ['CONNECTION']
  ];
  const SQL_WORDS = new Set(('AND OR NOT NULL IS IN BETWEEN LIKE ESCAPE EXISTS AS ON INNER LEFT RIGHT OUTER CROSS JOIN ' +
    'ASCENDING DESCENDING PRIMARY KEY ROWS EQ NE LT GT LE GE ALL ANY SOME SINGLE DISTINCT TABLE CORRESPONDING FIELDS OF ' +
    'COUNT SUM MIN MAX AVG CASE WHEN THEN ELSE END CAST COALESCE INITIAL ASC DESC').split(' '));
  const HOST_PREFIX = /^(L[VSTRO]_|G[VSTRO]_|P_|PA_|S_|SO_|R_|I[VSTRO]_|E[VSTRO]_|C[VSTRO]_|R[VSTRO]_|M[VSTRO]_|WA_|IT_|ET_|CT_|GT_|GS_|GV_|SY-|<)/i;

  function tokenize(text) {
    const out = [];
    const re = /'(?:[^']|'')*'|`(?:[^`]|``)*`|\(|\)|,|<[A-Za-z0-9_]+>(?:-[A-Za-z0-9_]+)*|[^\s(),]+/g;
    let m;
    while ((m = re.exec(text))) out.push(m[0]);
    return out;
  }

  function matchClause(tokens, i) {
    for (const c of CLAUSES) {
      if (c.every((w, k) => (tokens[i + k] || '').toUpperCase() === w)) return c;
    }
    return null;
  }

  const isLiteral = t => /^['`]/.test(t) || /^-?\d+(\.\d+)?$/.test(t);
  function isHost(t, afterOperator) {
    if (!t || t.startsWith('@') || isLiteral(t) || /^[(),]$/.test(t)) return false;
    const u = t.toUpperCase();
    if (SQL_WORDS.has(u)) return false;
    if (u === 'SPACE' || u === 'ABAP_TRUE' || u === 'ABAP_FALSE') return true;
    if (t.includes('~')) return false;                 // columna con alias de tabla
    if (HOST_PREFIX.test(t)) return true;
    if (t.includes('-') && afterOperator) return true;  // componente de estructura: ls_x-campo
    return false;
  }

  // Une tokens en texto con espacios estilo ABAP: "COUNT( * )", "a, b"
  function join(tokens) {
    let s = '';
    tokens.forEach((t, i) => {
      if (t === ',') { s = s.replace(/\s+$/, '') + ', '; return; }
      if (t === ')') { s = s.replace(/\s+$/, '') + ' ) '; return; }
      if (t === '(') { s = s.replace(/\s+$/, '') + '( '; return; }
      s += t + ' ';
    });
    return s.replace(/\(\s+\)/g, '( )').replace(/\s+/g, ' ').trim();
  }

  // Lista de campos antigua (separada por espacios) -> separada por comas
  function fieldList(tokens) {
    const items = [];
    let cur = [];
    let depth = 0;
    const up = t => (t || '').toUpperCase();
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t === ',' && depth === 0) { if (cur.length) items.push(cur); cur = []; continue; }
      if (t === '(') depth++;
      if (t === ')') depth--;
      cur.push(t);
      if (depth > 0) continue;
      const next = tokens[i + 1];
      // un elemento continúa si sigue "(", "AS", un modificador de orden, o si este token es AS / DISTINCT
      const continues = next === '(' || up(next) === 'AS' || /^(ASCENDING|DESCENDING)$/.test(up(next)) || /^(AS|DISTINCT)$/.test(up(t)) || t === '(';
      if (!continues) { items.push(cur); cur = []; }
    }
    if (cur.length) items.push(cur);
    return items.filter(x => x.length).map(join).join(', ');
  }

  function hostify(tokens, notes) {
    const out = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const prev = (tokens[i - 1] || '').toUpperCase();
      const afterOp = /^(=|<>|<|>|<=|>=|EQ|NE|LT|GT|LE|GE|LIKE|IN|BETWEEN|AND|ESCAPE)$/.test(prev) &&
        !(prev === 'AND' && !/BETWEEN/.test(tokens.slice(Math.max(0, i - 4), i).join(' ').toUpperCase()));
      if (isHost(t, afterOp)) { out.push('@' + t); continue; }
      if (afterOp && /^[A-Za-z_][A-Za-z0-9_]*$/.test(t) && !SQL_WORDS.has(t.toUpperCase()) && prev !== 'AND' && t !== '(') {
        notes.ambiguous.add(t);
      }
      out.push(t);
    }
    return out;
  }

  function convertSelect(stmt, opts) {
    const options = Object.assign({ inline: false }, opts || {});
    const warnings = [];
    const notes = { ambiguous: new Set() };
    const tokens = tokenize(stmt.replace(/\.\s*$/, ''));
    if ((tokens[0] || '').toUpperCase() !== 'SELECT') return null;

    // Si ya usa @, se asume sintaxis estricta
    if (tokens.some(t => t.startsWith('@'))) {
      return { code: stmt.trim(), warnings: ['La sentencia ya usa la sintaxis estricta (@): no se ha modificado.'], unchanged: true };
    }

    const parts = { fields: [] };
    let current = 'fields';
    let single = false, distinct = false, forUpdate = false;
    let i = 1;
    while (i < tokens.length) {
      const up = tokens[i].toUpperCase();
      if (current === 'fields' && parts.fields.length === 0) {
        if (up === 'SINGLE') { single = true; i++; continue; }
        if (up === 'DISTINCT') { distinct = true; i++; continue; }
        if (up === 'FOR' && (tokens[i + 1] || '').toUpperCase() === 'UPDATE') { forUpdate = true; i += 2; continue; }
      }
      const c = matchClause(tokens, i);
      // FROM dentro de "INTO CORRESPONDING FIELDS OF" no existe; JOIN pertenece a FROM
      if (c) {
        current = c.join(' ');
        parts[current] = parts[current] || [];
        i += c.length;
        continue;
      }
      parts[current].push(tokens[i]);
      i++;
    }

    if (!parts.FROM) return { code: stmt.trim(), warnings: ['No se encontró la cláusula FROM.'], unchanged: true };

    // Campos
    let fields = parts.fields.length ? fieldList(parts.fields) : '*';
    if (fields === '*') warnings.push('SELECT *: lee todas las columnas. Indica solo los campos que necesitas.');
    if (/^COUNT\(\s*\*\s*\)$/i.test(fields.replace(/\s/g, '').replace('COUNT(*)', 'COUNT( * )')) && !parts.INTO) {
      // SELECT COUNT(*) sin INTO: deja sy-dbcnt
    }

    // INTO / APPENDING
    let into = '';
    const intoKw = parts.INTO ? 'INTO' : parts.APPENDING ? 'APPENDING' : null;
    if (intoKw) {
      const t = parts[intoKw];
      if (t[0] === '(') {
        // INTO (a, b, c)
        const vars = t.filter(x => !/^[(),]$/.test(x)).map(v => '@' + v);
        into = `${intoKw} ( ${vars.join(', ')} )`;
      } else {
        const words = t.slice();
        const target = words.pop();
        const prefix = words.map(w => w.toUpperCase()).join(' ');
        const isTable = /TABLE/.test(prefix);
        const decl = options.inline && intoKw === 'INTO' && !/CORRESPONDING/.test(prefix) && /^(l[tsv]_|lr_)/i.test(target);
        into = `${intoKw}${prefix ? ' ' + prefix : ''} ${decl ? `@DATA(${target})` : '@' + target}`;
        if (!isTable && !single && !/COUNT/i.test(fields)) {
          warnings.push('Sin TABLE ni SINGLE, la SELECT es un bucle y necesita ENDSELECT. Valora leer con INTO TABLE.');
        }
        if (decl) warnings.push(`Declaración en línea: quita la declaración DATA ${target} anterior.`);
      }
    } else if (!/COUNT/i.test(fields)) {
      warnings.push('La sentencia no tiene INTO: revisa que esté completa.');
    }

    if (parts['PACKAGE SIZE']) into += ` PACKAGE SIZE ${hostify(parts['PACKAGE SIZE'], notes).join(' ')}`;

    // FROM (con JOIN ... ON): host variables en las condiciones ON, si las hay
    const from = join(hostify(parts.FROM, notes));
    const fae = parts['FOR ALL ENTRIES IN'] ? '@' + parts['FOR ALL ENTRIES IN'].join('') : '';
    if (fae) warnings.push(`FOR ALL ENTRIES: comprueba antes que ${fae.slice(1)} no está vacía (IF ${fae.slice(1)} IS NOT INITIAL). Si lo está, se lee la tabla entera.`);
    const where = parts.WHERE ? join(hostify(parts.WHERE, notes)) : '';
    const groupBy = parts['GROUP BY'] ? fieldList(parts['GROUP BY']) : '';
    const having = parts.HAVING ? join(hostify(parts.HAVING, notes)) : '';
    let orderBy = parts['ORDER BY'] ? join(parts['ORDER BY']) : '';
    if (orderBy && !/^PRIMARY\s+KEY$/i.test(orderBy)) orderBy = fieldList(parts['ORDER BY']).replace(/,\s*(ASCENDING|DESCENDING)/gi, ' $1');
    const upTo = parts['UP TO'] ? join(hostify(parts['UP TO'].filter(t => t.toUpperCase() !== 'ROWS'), notes)) : '';

    if (parts['BYPASSING BUFFER']) warnings.push('BYPASSING BUFFER se mantiene. Comprueba que de verdad hace falta saltar el buffer.');
    if (parts['CLIENT SPECIFIED']) warnings.push('CLIENT SPECIFIED es obsoleto: en sintaxis estricta se usa USING CLIENT @lv_mandt (y solo en casos muy justificados).');
    if (intoKw && /TABLE/i.test(parts[intoKw].join(' ')) && !orderBy && !single) {
      warnings.push('Sin ORDER BY: en HANA el orden de las filas no está garantizado. Si después usas BINARY SEARCH, DELETE ADJACENT DUPLICATES o AT NEW, añade ORDER BY o un SORT.');
    }
    if (notes.ambiguous.size) {
      warnings.push(`Revisa a mano: ${[...notes.ambiguous].join(', ')}. No sé si es una columna o una variable ABAP; si es una variable, añade @ delante.`);
    }

    const head = `SELECT${single ? ' SINGLE' : ''}${forUpdate ? ' FOR UPDATE' : ''}${distinct ? ' DISTINCT' : ''} FROM ${from}`;
    const lines = [head];
    if (parts['BYPASSING BUFFER']) lines[0] += ' BYPASSING BUFFER';
    lines.push(`  FIELDS ${fields}`);
    if (fae) lines.push(`  FOR ALL ENTRIES IN ${fae}`);
    if (where) lines.push(`  WHERE ${where}`);
    if (groupBy) lines.push(`  GROUP BY ${groupBy}`);
    if (having) lines.push(`  HAVING ${having}`);
    if (orderBy) lines.push(`  ORDER BY ${orderBy}`);
    if (into) lines.push(`  ${into}`);
    if (upTo) lines.push(`  UP TO ${upTo} ROWS`);
    // Partir WHERE largos en líneas por AND
    const code = lines.join('\n').replace(/^(  WHERE .*)$/m, w => w.length > 70 ? w.replace(/ (AND|OR) /g, '\n    $1 ') : w) + '.';
    return { code, warnings };
  }

  // Convierte todas las SELECT de un texto; el resto se deja como está
  function convert(text, opts) {
    const results = [];
    const clean = text.replace(/\r\n?/g, '\n').split('\n').filter(l => !/^\*/.test(l)).map(l => {
      // quitar comentarios de final de línea fuera de literales
      let q = null;
      for (let i = 0; i < l.length; i++) {
        const ch = l[i];
        if (q) { if (ch === q) q = null; continue; }
        if (ch === "'" || ch === '`') { q = ch; continue; }
        if (ch === '"') return l.slice(0, i);
      }
      return l;
    }).join('\n');

    // separar por punto fuera de literales
    let buf = '', q = null;
    const stmts = [];
    for (const ch of clean) {
      if (q) { buf += ch; if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '`') { q = ch; buf += ch; continue; }
      if (ch === '.' ) { stmts.push(buf.trim() + '.'); buf = ''; continue; }
      buf += ch;
    }
    if (buf.trim()) stmts.push(buf.trim());

    stmts.forEach(s => {
      const one = s.replace(/\s+/g, ' ');
      if (/^SELECT\b/i.test(one)) results.push(Object.assign({ original: one }, convertSelect(one, opts)));
      else if (/^ENDSELECT\b/i.test(one)) results.push({ original: one, code: 'ENDSELECT.', warnings: [] });
    });
    return results;
  }

  root.SqlConvert = { convert, convertSelect };
})(typeof window !== 'undefined' ? window : globalThis);
