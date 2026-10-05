"! <p class="shorttext synchronized">Textos largos (READ_TEXT / SAVE_TEXT) como string</p>
"! Los textos largos de SAP (cabecera de pedido, notas de material, textos de posición...)
"! se guardan en líneas TLINE de 132 caracteres. Esta clase los lee y graba como un string.
"!
"! Para saber ID, objeto y nombre de un texto: en la transacción, abrir el texto en el editor
"! de pantalla completa y ver Ir a > Cabecera.
"!
"! Uso:
"!   DATA(lv_text) = zcl_abk_longtext=>read( iv_id = 'F01' iv_object = 'EKKO' iv_name = CONV #( lv_ebeln ) ).
"!   zcl_abk_longtext=>save( iv_id = 'F01' iv_object = 'EKKO' iv_name = CONV #( lv_ebeln ) iv_text = lv_text ).
CLASS zcl_abk_longtext DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    CLASS-METHODS read
      IMPORTING iv_id          TYPE tdid
                iv_object      TYPE tdobject
                iv_name        TYPE tdobname
                iv_language    TYPE spras DEFAULT sy-langu
      RETURNING VALUE(rv_text) TYPE string.

    CLASS-METHODS save
      IMPORTING iv_id        TYPE tdid
                iv_object    TYPE tdobject
                iv_name      TYPE tdobname
                iv_language  TYPE spras DEFAULT sy-langu
                iv_text      TYPE string
                iv_commit    TYPE abap_bool DEFAULT abap_false
      RETURNING VALUE(rv_ok) TYPE abap_bool.

  PRIVATE SECTION.
    CLASS-METHODS to_lines
      IMPORTING iv_text         TYPE string
      RETURNING VALUE(rt_lines) TYPE tline_tab.
ENDCLASS.



CLASS zcl_abk_longtext IMPLEMENTATION.

  METHOD read.
    DATA lt_lines TYPE STANDARD TABLE OF tline.

    CALL FUNCTION 'READ_TEXT'
      EXPORTING
        id                      = iv_id
        language                = iv_language
        name                    = iv_name
        object                  = iv_object
      TABLES
        lines                   = lt_lines
      EXCEPTIONS
        id                      = 1
        language                = 2
        name                    = 3
        not_found               = 4
        object                  = 5
        reference_check         = 6
        wrong_access_to_archive = 7
        OTHERS                  = 8.
    IF sy-subrc <> 0.
      RETURN.   " sin texto: string vacío
    ENDIF.

    " '*' = párrafo nuevo, '/' = salto de línea; ' ' o '=' continúan la línea anterior
    LOOP AT lt_lines INTO DATA(ls_line).
      IF sy-tabix = 1.
        rv_text = ls_line-tdline.
      ELSEIF ls_line-tdformat = '=' OR ls_line-tdformat = space.
        rv_text = rv_text && ls_line-tdline.
      ELSE.
        rv_text = |{ rv_text }\n{ ls_line-tdline }|.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.


  METHOD save.
    DATA(ls_header) = VALUE thead( tdobject = iv_object
                                   tdname   = iv_name
                                   tdid     = iv_id
                                   tdspras  = iv_language ).
    DATA(lt_lines) = to_lines( iv_text ).

    CALL FUNCTION 'SAVE_TEXT'
      EXPORTING
        header          = ls_header
        savemode_direct = abap_true
      TABLES
        lines           = lt_lines
      EXCEPTIONS
        id              = 1
        language        = 2
        name            = 3
        object          = 4
        OTHERS          = 5.
    rv_ok = xsdbool( sy-subrc = 0 ).

    IF rv_ok = abap_true AND iv_commit = abap_true.
      COMMIT WORK AND WAIT.
    ENDIF.
  ENDMETHOD.


  METHOD to_lines.
    " Cada salto de línea del string es un párrafo nuevo; las líneas largas se parten a 132
    SPLIT iv_text AT |\n| INTO TABLE DATA(lt_paragraphs).
    LOOP AT lt_paragraphs INTO DATA(lv_paragraph).
      DATA(lv_first) = abap_true.
      DO.
        APPEND VALUE #( tdformat = COND #( WHEN lv_first = abap_true THEN '*' ELSE '=' )
                        tdline   = lv_paragraph ) TO rt_lines.
        lv_first = abap_false.
        IF strlen( lv_paragraph ) <= 132.
          EXIT.
        ENDIF.
        lv_paragraph = substring( val = lv_paragraph off = 132 ).
      ENDDO.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
