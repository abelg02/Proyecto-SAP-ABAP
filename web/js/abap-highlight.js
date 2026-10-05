/*
 * Resaltado de sintaxis ABAP / CDS / BDEF muy ligero.
 * Lo usa el build (Node) para los bloques de código de las páginas y el navegador para las herramientas.
 */
(function (root) {
  const KEYWORDS = ('ABSTRACT ACTION ADD ALIAS ALL AND APPEND APPENDING AS ASCENDING ASSIGN ASSIGNING ASSOCIATION AT AUTHORITY-CHECK ' +
    'BEGIN BETWEEN BINARY BY BYPASSING CALL CASE CAST CATCH CHANGING CHECK CLASS CLASS-DATA CLASS-METHODS CLEANUP CLEAR CLIENT CLOSE ' +
    'COMMIT COMPONENTS COMPOSITION COMPUTE CONCATENATE COND CONSTANTS CONTINUE CONV CORRESPONDING CREATE DATA DATASET DEFAULT DEFINE ' +
    'DEFINITION DELETE DESCENDING DESCRIBE DETERMINATION DISTINCT DIVIDE DO DRAFT ELSE ELSEIF EMPTY END END-OF-SELECTION ENDCASE ENDCLASS ENDDO ' +
    'ENDFORM ENDFUNCTION ENDIF ENDLOOP ENDMETHOD ENDON ENDSELECT ENDTRY ENDWHILE ENTITIES ENTITY ENTRIES EQ EXCEPTIONS EXIT EXPORTING EXPOSE ' +
    'FAILED FEATURES FIELD FIELD-SYMBOL FIELD-SYMBOLS FIELDS FINAL FOR FORM FREE FROM FUNCTION GE GROUP GT HASHED HEADER IF IMPLEMENTATION ' +
    'IMPORTING IN INDEX INHERITING INITIAL INNER INSERT INTERFACES INTO IS JOIN KEY LE LEFT LENGTH LET LIKE LINE LINES LOCAL LOOP LT MANAGED ' +
    'MAPPING METHOD METHODS MODE MODIFY MOVE MOVE-CORRESPONDING MULTIPLY NE NEW NEXT NON-UNIQUE NOT NUMBERING OBJECT OCCURS OF ON OPTIONAL OR ' +
    'OTHERS OUTER PARAMETER PARAMETERS PERFORM PERSISTENT PRIVATE PROJECTION PROTECTED PUBLIC RAISE RAISING RANGE RANGES READ READ-ONLY ' +
    'REDUCE REF REFERENCE REFRESH REPORT REPORTED REQUEST RESULT RETURN RETURNING ROOT SECTION SELECT SELECT-OPTIONS SELECTION-SCREEN ' +
    'SINGLE SORT SORTED STANDARD START-OF-SELECTION STRICT STRUCTURE SUBMIT SUBTRACT SWITCH TABLE TABLES TESTING THEN TO TRANSACTION ' +
    'TRANSPORTING TRY TYPE TYPES UNIQUE UNTIL UP UPDATE USE USING VALIDATION VALUE VIEW WHEN WHERE WHILE WITH WORK WRITE XSDBOOL ' +
    'ABAP_TRUE ABAP_FALSE ABAP_BOOL').split(' ');
  const KW = new Set(KEYWORDS);

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function highlightLine(line) {
    if (/^\s*\*/.test(line) && /^\*/.test(line)) return `<span class="c">${escapeHtml(line)}</span>`;
    let out = '';
    let i = 0;
    while (i < line.length) {
      const ch = line[i];
      // comentario de fin de línea (" en ABAP, // en CDS)
      if (ch === '"' || (ch === '/' && line[i + 1] === '/')) { out += `<span class="c">${escapeHtml(line.slice(i))}</span>`; break; }
      if (ch === "'" || ch === '`' || ch === '|') {
        let j = i + 1;
        while (j < line.length && line[j] !== ch) j++;
        out += `<span class="s">${escapeHtml(line.slice(i, j + 1))}</span>`;
        i = j + 1;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < line.length && /[A-Za-z0-9_\-]/.test(line[j])) j++;
        // no tragarse el '-' de componentes (ls_x-campo) ni '->'
        let word = line.slice(i, j);
        if (/-$/.test(word)) { word = word.replace(/-+$/, ''); j = i + word.length; }
        const upper = word.toUpperCase();
        const prev = line[i - 1];
        const isComponent = prev === '-' || prev === '>' || prev === '~' || prev === '%';
        out += (!isComponent && KW.has(upper)) ? `<span class="k">${escapeHtml(word)}</span>` : escapeHtml(word);
        i = j;
        continue;
      }
      if (/[0-9]/.test(ch) && !/[A-Za-z_]/.test(line[i - 1] || '')) {
        let j = i;
        while (j < line.length && /[0-9]/.test(line[j])) j++;
        out += `<span class="n">${line.slice(i, j)}</span>`;
        i = j;
        continue;
      }
      out += escapeHtml(ch);
      i++;
    }
    return out;
  }

  function highlight(code) {
    return code.replace(/\r\n?/g, '\n').split('\n').map(highlightLine).join('\n');
  }

  root.AbapHighlight = { highlight, escapeHtml };
})(typeof window !== 'undefined' ? window : globalThis);
