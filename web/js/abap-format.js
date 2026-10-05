/*
 * Formateador de código ABAP (similar al Pretty Printer de SE38/ADT):
 *  - sangría por bloques (IF, LOOP, CASE/WHEN, TRY/CATCH, METHOD, CLASS ... SECTION, etc.)
 *  - palabras clave en mayúsculas, minúsculas o sin cambiar
 *  - no toca literales ni comentarios; las líneas de continuación conservan su sangría relativa
 * Funciona en el navegador (window.AbapFormat) y en Node (globalThis.AbapFormat).
 */
(function (root) {
  'use strict';

  const KEYWORDS = new Set(('ABSTRACT ACCEPTING ADD ADJACENT ALIASES ALL AND APPEND APPENDING AS ASCENDING ASSERT ASSIGN ASSIGNING AT AUTHORITY-CHECK ' +
    'BACK BEGIN BETWEEN BINARY BLOCK BY BYPASSING CALL CASE CAST CATCH CHANGING CHECK CLASS CLASS-DATA CLASS-METHODS CLEANUP CLEAR CLIENT CLOSE ' +
    'COLLECT COMMIT COMPARING COMPONENTS COND CONCATENATE CONDENSE CONSTANTS CONTINUE CONV CORRESPONDING COUNT CREATE DATA DATASET DEFAULT DEFERRED ' +
    'DEFINITION DELETE DESCENDING DESCRIBE DIVIDE DO DUPLICATES ELSE ELSEIF EMPTY ENCODING END END-OF-SELECTION ENDAT ENDCASE ENDCATCH ENDCLASS ENDDO ' +
    'ENDFORM ENDFUNCTION ENDIF ENDINTERFACE ENDLOOP ENDMETHOD ENDMODULE ENDON ENDPROVIDE ENDSELECT ENDTRY ENDWHILE ENTITIES ENTITY ENTRIES EVENTS EXCEPTIONS ' +
    'EXIT EXPORTING EXPORT FIELD FIELD-SYMBOL FIELD-SYMBOLS FIELDS FINAL FIND FIRST FOR FORM FORMAT FREE FROM FUNCTION GET GROUP HASHED HEADER HIDE IF ' +
    'IMPLEMENTATION IMPORT IMPORTING IN INCLUDE INDEX INHERITING INITIAL INITIALIZATION INNER INPUT INSERT INTERFACE INTERFACES INTO IS JOIN KEY LEAVE LEFT ' +
    'LENGTH LIKE LINE LINES LOAD LOCAL LOOP MESSAGE METHOD METHODS MODE MODIFY MODULE MOVE MOVE-CORRESPONDING MULTIPLY NEW NEXT NO NON-UNIQUE NOT OBJECT ' +
    'OBLIGATORY OCCURRENCES OF OFF ON OPEN OPTIONAL OR OTHERS OUTER OUTPUT PACKAGE PARAMETERS PERFORM PRIVATE PROTECTED PUBLIC RADIOBUTTON RAISE RAISING RANGE ' +
    'RANGES READ READ-ONLY REDEFINITION REDUCE REF REFERENCE REFRESH REPLACE REPORT RESULT RETURN RETURNING ROLLBACK ROWS SEARCH SECTION SELECT SELECT-OPTIONS ' +
    'SELECTION-SCREEN SET SHIFT SINGLE SIZE SKIP SORT SORTED SPLIT STANDARD START-OF-SELECTION STATICS STRUCTURE SUBMIT SUBTRACT SWITCH TABLE TABLES TESTING ' +
    'TEXT THEN TIMES TO TOP-OF-PAGE TRANSFER TRANSLATE TRANSPORTING TRY TYPE TYPE-POOLS TYPES ULINE UNIQUE UNTIL UP UPDATE USING VALUE WHEN WHERE WHILE WITH ' +
    'WORK WRITE').split(' '));

  function maskLine(line) {
    if (/^\*/.test(line)) return { code: '', comment: line, full: true };
    let out = '', q = null;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { out += ch === q ? ch : '_'; if (ch === q) q = null; continue; }
      if (ch === "'" || ch === '`' || ch === '|') { q = ch; out += ch; continue; }
      if (ch === '"') return { code: out, comment: line.slice(i), full: false, at: i };
      out += ch;
    }
    return { code: out, comment: '', full: false };
  }

  // Cambia el caso de las palabras clave solo en el código (no en literales)
  function caseKeywords(line, mode) {
    if (mode === 'keep') return line;
    const m = maskLine(line);
    if (m.full) return line;
    const codeLen = m.at === undefined ? line.length : m.at;
    let out = '';
    const re = /[A-Za-z][A-Za-z0-9_-]*/g;
    let last = 0, x;
    const code = m.code;
    while ((x = re.exec(code))) {
      const word = line.substr(x.index, x[0].length);
      if (code.substr(x.index, x[0].length) !== word) continue;   // dentro de un literal
      const prev = code[x.index - 1];
      let w = word.replace(/-$/, '');
      const up = w.toUpperCase();
      const isComp = prev === '-' || prev === '>' || prev === '~' || prev === '=' && code[x.index - 2] === '>';
      if (!isComp && KEYWORDS.has(up) && (code[x.index + w.length] !== '(' || /^(DATA|FIELD-SYMBOL|FINAL)$/.test(up))) {
        out += line.slice(last, x.index) + (mode === 'lower' ? up.toLowerCase() : up);
        last = x.index + w.length;
      } else if (mode === 'mixed') {
        // estilo más habitual: palabras clave en mayúsculas, nombres en minúsculas
        out += line.slice(last, x.index) + w.toLowerCase();
        last = x.index + w.length;
      }
    }
    out += line.slice(last, codeLen) + line.slice(codeLen);
    return out;
  }

  const firstWords = s => s.toUpperCase().replace(/\s+/g, ' ').trim();

  function format(source, opts) {
    const options = Object.assign({ indent: 2, keywords: 'upper', blankLines: 1 }, opts || {});
    const IND = ' '.repeat(options.indent);
    const lines = source.replace(/\r\n?/g, '\n').replace(/\t/g, '  ').split('\n');
    const hasEndselect = /^\s*ENDSELECT\b/im.test(source);
    const out = [];
    const stack = [];                    // { type, add }
    const depth = () => stack.reduce((n, s) => n + s.add, 0);
    const top = () => stack[stack.length - 1];

    let inStatement = false;             // estamos en una línea de continuación
    let stmtBase = 0, stmtOrigIndent = 0;
    let blanks = 0;

    for (const raw of lines) {
      const trimmed = raw.trim();
      if (!trimmed) {
        blanks++;
        if (blanks <= options.blankLines) out.push('');
        continue;
      }
      blanks = 0;
      const m = maskLine(raw);
      if (m.full) { out.push(raw.replace(/\s+$/, '')); continue; }   // comentario de línea completa: columna 0
      const codePart = m.code.trim();
      const origIndent = raw.length - raw.trimStart().length;

      // Línea de continuación de una sentencia anterior
      if (inStatement) {
        const rel = Math.max(options.indent, origIndent - stmtOrigIndent);
        out.push(' '.repeat(stmtBase + rel) + caseKeywords(trimmed, options.keywords).replace(/\s+$/, ''));
        if (/\.\s*$/.test(codePart) || (!codePart && false)) inStatement = !/\.\s*$/.test(codePart);
        else inStatement = !/\.\s*$/.test(codePart);
        continue;
      }

      if (!codePart) {                    // comentario " al inicio de línea
        out.push(IND.repeat(depth()) + trimmed);
        continue;
      }

      const U = firstWords(codePart);
      let printDepth = depth();

      // --- cierres y bloques intermedios (antes de imprimir)
      if (/^(ENDIF|ENDLOOP|ENDDO|ENDWHILE|ENDMETHOD|ENDFORM|ENDFUNCTION|ENDMODULE|ENDSELECT|ENDAT|ENDON|ENDPROVIDE|ENDINTERFACE|ENDCATCH|ENDWITH)\b/.test(U)) {
        stack.pop(); printDepth = depth();
      } else if (/^ENDCLASS\b/.test(U)) {
        if (top() && top().type === 'SECTION') stack.pop();
        stack.pop(); printDepth = depth();
      } else if (/^ENDCASE\b/.test(U)) {
        if (top() && top().type === 'WHEN') stack.pop();
        stack.pop(); printDepth = depth();
      } else if (/^ENDTRY\b/.test(U)) {
        if (top() && top().type === 'CATCH') stack.pop();
        stack.pop(); printDepth = depth();
      } else if (/^(ELSE|ELSEIF)\b/.test(U)) {
        printDepth = depth() - 1;
      } else if (/^WHEN\b/.test(U)) {
        if (top() && top().type === 'WHEN') stack.pop();
        printDepth = depth();
      } else if (/^(CATCH|CLEANUP)\b/.test(U) && !/^CATCH\s+SYSTEM-EXCEPTIONS/.test(U)) {
        if (top() && top().type === 'CATCH') stack.pop();
        printDepth = depth() - 1;
      } else if (/^(PUBLIC|PROTECTED|PRIVATE)\s+SECTION\b/.test(U)) {
        if (top() && top().type === 'SECTION') stack.pop();
        printDepth = depth();
      }

      out.push(IND.repeat(Math.max(0, printDepth)) + caseKeywords(trimmed, options.keywords).replace(/\s+$/, ''));

      // --- aperturas (después de imprimir)
      const isClassBlock = /^CLASS\s+\S+\s+(DEFINITION|IMPLEMENTATION)\b/.test(U) && !/\b(DEFERRED|LOAD)\b/.test(U);
      const isSelectLoop = hasEndselect && /^SELECT\b/.test(U) && !/\bSINGLE\b/.test(U) && !/\b(INTO|APPENDING)\s+(CORRESPONDING\s+FIELDS\s+OF\s+)?TABLE\b/.test(U) && !/^SELECT\s+COUNT/.test(U);
      if (/^(IF|LOOP|DO|WHILE|METHOD|FORM|FUNCTION|MODULE|PROVIDE|ON\s+CHANGE\s+OF|CATCH\s+SYSTEM-EXCEPTIONS|WITH\s+\+)\b/.test(U) ||
          /^AT\s+(NEW|END\s+OF|FIRST|LAST)\b/.test(U) || isClassBlock || isSelectLoop ||
          (/^INTERFACE\s+\S+/.test(U) && !/\b(DEFERRED|LOAD)\b/.test(U) && !/^INTERFACES\b/.test(U))) {
        stack.push({ type: 'BLOCK', add: 1 });
      } else if (/^CASE\b/.test(U)) {
        stack.push({ type: 'CASE', add: 1 });
      } else if (/^WHEN\b/.test(U)) {
        stack.push({ type: 'WHEN', add: 1 });
      } else if (/^TRY\b/.test(U)) {
        stack.push({ type: 'TRY', add: 2 });
      } else if (/^(CATCH|CLEANUP)\b/.test(U) && !/^CATCH\s+SYSTEM-EXCEPTIONS/.test(U)) {
        stack.push({ type: 'CATCH', add: 0 });
      } else if (/^(PUBLIC|PROTECTED|PRIVATE)\s+SECTION\b/.test(U)) {
        stack.push({ type: 'SECTION', add: 1 });
      }

      // ¿la sentencia continúa en la línea siguiente?
      inStatement = !/\.\s*$/.test(codePart);
      if (inStatement) { stmtBase = Math.max(0, printDepth) * options.indent; stmtOrigIndent = origIndent; }
    }

    // quitar líneas vacías al final
    while (out.length && !out[out.length - 1]) out.pop();
    return out.join('\n') + '\n';
  }

  root.AbapFormat = { format };
})(typeof window !== 'undefined' ? window : globalThis);
