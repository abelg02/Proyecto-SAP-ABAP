"! <p class="shorttext synchronized">Utilidades de texto y fechas (ABAP puro, válido en Cloud y on-premise)</p>
"! Sin dependencias: solo sentencias del lenguaje. Probado con la clase de test local (ltcl_string).
CLASS zcl_abk_string DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    TYPES tt_strings TYPE STANDARD TABLE OF string WITH EMPTY KEY.

    "! Comprueba el formato de un email (no comprueba que exista)
    CLASS-METHODS is_valid_email
      IMPORTING iv_email        TYPE csequence
      RETURNING VALUE(rv_valid) TYPE abap_bool.

    "! Rellena con ceros a la izquierda (equivalente a CONVERSION_EXIT_ALPHA_INPUT)
    CLASS-METHODS alpha_in
      IMPORTING iv_value         TYPE csequence
                iv_length        TYPE i
      RETURNING VALUE(rv_result) TYPE string.

    "! Quita los ceros a la izquierda (equivalente a CONVERSION_EXIT_ALPHA_OUTPUT)
    CLASS-METHODS alpha_out
      IMPORTING iv_value         TYPE csequence
      RETURNING VALUE(rv_result) TYPE string.

    "! Sustituye vocales acentuadas, ñ y ç por su letra base (útil para claves y ficheros)
    CLASS-METHODS remove_accents
      IMPORTING iv_text          TYPE csequence
      RETURNING VALUE(rv_result) TYPE string.

    "! Primera letra de cada palabra en mayúscula, el resto en minúscula
    CLASS-METHODS to_title_case
      IMPORTING iv_text          TYPE csequence
      RETURNING VALUE(rv_result) TYPE string.

    "! Parte una línea CSV respetando campos entre comillas y comillas dobles escapadas ("")
    CLASS-METHODS split_csv_line
      IMPORTING iv_line          TYPE csequence
                iv_separator     TYPE c DEFAULT ';'
      RETURNING VALUE(rt_fields) TYPE tt_strings.

    "! Día de la semana: 1 = lunes … 7 = domingo
    CLASS-METHODS weekday
      IMPORTING iv_date       TYPE d
      RETURNING VALUE(rv_day) TYPE i.

    "! Suma días laborables (lunes a viernes). No tiene en cuenta festivos.
    CLASS-METHODS add_working_days
      IMPORTING iv_date        TYPE d
                iv_days        TYPE i
      RETURNING VALUE(rv_date) TYPE d.

    "! Último día del mes de la fecha indicada
    CLASS-METHODS last_day_of_month
      IMPORTING iv_date        TYPE d
      RETURNING VALUE(rv_date) TYPE d.

ENDCLASS.



CLASS zcl_abk_string IMPLEMENTATION.

  METHOD is_valid_email.
    rv_valid = xsdbool( matches( val  = condense( val = iv_email )
                                 pcre = `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$` ) ).
  ENDMETHOD.


  METHOD alpha_in.
    DATA(lv_value) = condense( val = iv_value ).
    IF lv_value CO '0123456789' AND strlen( lv_value ) < iv_length.
      rv_result = repeat( val = `0` occ = iv_length - strlen( lv_value ) ) && lv_value.
    ELSE.
      rv_result = lv_value.
    ENDIF.
  ENDMETHOD.


  METHOD alpha_out.
    rv_result = condense( val = iv_value ).
    IF rv_result CO '0123456789'.
      SHIFT rv_result LEFT DELETING LEADING '0'.
      IF rv_result IS INITIAL AND iv_value IS NOT INITIAL.
        rv_result = `0`.
      ENDIF.
    ENDIF.
  ENDMETHOD.


  METHOD remove_accents.
    rv_result = iv_text.
    TRANSLATE rv_result USING 'áaéeíióoúuàaèeìiòoùuäaëeïiöoüuâaêeîiôoûuñnçcÁAÉEÍIÓOÚUÀAÈEÌIÒOÙUÄAËEÏIÖOÜUÂAÊEÎIÔOÛUÑNÇC'.
  ENDMETHOD.


  METHOD to_title_case.
    SPLIT to_lower( iv_text ) AT space INTO TABLE DATA(lt_words).
    LOOP AT lt_words ASSIGNING FIELD-SYMBOL(<lv_word>) WHERE table_line IS NOT INITIAL.
      <lv_word> = to_upper( substring( val = <lv_word> len = 1 ) ) && substring( val = <lv_word> off = 1 ).
    ENDLOOP.
    rv_result = concat_lines_of( table = lt_words sep = ` ` ).
  ENDMETHOD.


  METHOD split_csv_line.
    DATA lv_field     TYPE string.
    DATA lv_in_quotes TYPE abap_bool.

    DATA(lv_line) = CONV string( iv_line ).
    DATA(lv_length) = strlen( lv_line ).
    DATA(lv_pos) = 0.

    WHILE lv_pos < lv_length.
      DATA(lv_char) = substring( val = lv_line off = lv_pos len = 1 ).

      IF lv_char = '"'.
        " Comilla doble escapada dentro de un campo entre comillas: "" -> "
        IF lv_in_quotes = abap_true AND lv_pos + 1 < lv_length
           AND substring( val = lv_line off = lv_pos + 1 len = 1 ) = '"'.
          lv_field = lv_field && '"'.
          lv_pos += 1.
        ELSE.
          lv_in_quotes = xsdbool( lv_in_quotes = abap_false ).
        ENDIF.
      ELSEIF lv_char = iv_separator AND lv_in_quotes = abap_false.
        APPEND lv_field TO rt_fields.
        CLEAR lv_field.
      ELSE.
        lv_field = lv_field && lv_char.
      ENDIF.

      lv_pos += 1.
    ENDWHILE.

    APPEND lv_field TO rt_fields.
  ENDMETHOD.


  METHOD weekday.
    " El 01/01/1900 fue lunes: la diferencia en días módulo 7 da el día de la semana
    rv_day = ( iv_date - CONV d( '19000101' ) ) MOD 7 + 1.
  ENDMETHOD.


  METHOD add_working_days.
    rv_date = iv_date.
    DATA(lv_step) = COND i( WHEN iv_days >= 0 THEN 1 ELSE -1 ).
    DATA(lv_pending) = abs( iv_days ).

    WHILE lv_pending > 0.
      rv_date = rv_date + lv_step.
      IF weekday( rv_date ) <= 5.
        lv_pending -= 1.
      ENDIF.
    ENDWHILE.
  ENDMETHOD.


  METHOD last_day_of_month.
    DATA(lv_first_next) = iv_date.
    lv_first_next+6(2) = '01'.
    IF lv_first_next+4(2) = '12'.
      lv_first_next+0(4) = |{ CONV i( lv_first_next+0(4) ) + 1 WIDTH = 4 ALIGN = RIGHT PAD = '0' }|.
      lv_first_next+4(2) = '01'.
    ELSE.
      lv_first_next+4(2) = |{ CONV i( lv_first_next+4(2) ) + 1 WIDTH = 2 ALIGN = RIGHT PAD = '0' }|.
    ENDIF.
    rv_date = lv_first_next - 1.
  ENDMETHOD.

ENDCLASS.
