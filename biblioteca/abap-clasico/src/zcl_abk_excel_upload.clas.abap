"! <p class="shorttext synchronized">Subir un Excel (.xlsx) del PC a una tabla interna (ECC / S/4HANA)</p>
"! Usa CL_FDT_XL_SPREADSHEET, disponible en ECC 6.0 EhP6+ y S/4HANA on-premise, que lee
"! el formato XLSX real (no requiere Excel instalado en el PC, a diferencia de
"! ALSM_EXCEL_TO_INTERNAL_TABLE o TEXT_CONVERT_XLS_TO_SAP).
"!
"! Uso:
"!   TYPES: BEGIN OF ty_row,
"!            matnr TYPE string,
"!            menge TYPE string,
"!          END OF ty_row.
"!   DATA lt_rows TYPE STANDARD TABLE OF ty_row WITH EMPTY KEY.
"!   zcl_abk_excel_upload=>from_pc( EXPORTING iv_skip_header = abap_true
"!                                  CHANGING  ct_rows        = lt_rows ).
CLASS zcl_abk_excel_upload DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    "! Abre el diálogo de selección de fichero (si no se pasa iv_filename) y lee la primera hoja
    CLASS-METHODS from_pc
      IMPORTING iv_filename    TYPE string OPTIONAL
                iv_sheet       TYPE i DEFAULT 1
                iv_skip_header TYPE abap_bool DEFAULT abap_true
      CHANGING  ct_rows        TYPE STANDARD TABLE
      RAISING   cx_sy_file_io.

    "! Lee el contenido de un XLSX ya cargado (por ejemplo desde el servidor o un correo)
    CLASS-METHODS from_xstring
      IMPORTING iv_content     TYPE xstring
                iv_name        TYPE string DEFAULT `fichero.xlsx`
                iv_sheet       TYPE i DEFAULT 1
                iv_skip_header TYPE abap_bool DEFAULT abap_true
      CHANGING  ct_rows        TYPE STANDARD TABLE
      RAISING   cx_sy_file_io.
ENDCLASS.



CLASS zcl_abk_excel_upload IMPLEMENTATION.

  METHOD from_pc.
    DATA lt_files  TYPE filetable.
    DATA lv_rc     TYPE i.
    DATA lv_action TYPE i.
    DATA lt_bin    TYPE solix_tab.
    DATA lv_size   TYPE i.

    DATA(lv_filename) = iv_filename.
    IF lv_filename IS INITIAL.
      cl_gui_frontend_services=>file_open_dialog(
        EXPORTING  file_filter = |Excel (*.xlsx)\|*.xlsx|
        CHANGING   file_table  = lt_files
                   rc          = lv_rc
                   user_action = lv_action
        EXCEPTIONS OTHERS      = 1 ).
      IF sy-subrc <> 0 OR lv_action <> cl_gui_frontend_services=>action_ok OR lt_files IS INITIAL.
        RETURN.
      ENDIF.
      lv_filename = lt_files[ 1 ]-filename.
    ENDIF.

    cl_gui_frontend_services=>gui_upload(
      EXPORTING  filename   = lv_filename
                 filetype   = 'BIN'
      IMPORTING  filelength = lv_size
      CHANGING   data_tab   = lt_bin
      EXCEPTIONS OTHERS     = 1 ).
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_sy_file_io EXPORTING filename = lv_filename.
    ENDIF.

    from_xstring( EXPORTING iv_content     = cl_bcs_convert=>solix_to_xstring( it_solix = lt_bin iv_size = lv_size )
                            iv_name        = lv_filename
                            iv_sheet       = iv_sheet
                            iv_skip_header = iv_skip_header
                  CHANGING  ct_rows        = ct_rows ).
  ENDMETHOD.


  METHOD from_xstring.
    DATA lo_excel TYPE REF TO cl_fdt_xl_spreadsheet.
    FIELD-SYMBOLS <lt_sheet> TYPE STANDARD TABLE.

    TRY.
        lo_excel = NEW #( document_name = iv_name
                          xdocument     = iv_content ).
      CATCH cx_fdt_excel_core INTO DATA(lx_excel).
        RAISE EXCEPTION TYPE cx_sy_file_io EXPORTING filename = iv_name previous = lx_excel.
    ENDTRY.

    lo_excel->if_fdt_doc_spreadsheet~get_worksheet_names( IMPORTING worksheet_names = DATA(lt_names) ).
    IF iv_sheet > lines( lt_names ).
      RETURN.
    ENDIF.

    DATA(lr_sheet) = lo_excel->if_fdt_doc_spreadsheet~get_itab_from_worksheet( lt_names[ iv_sheet ] ).
    ASSIGN lr_sheet->* TO <lt_sheet>.

    " Cada fila de la hoja tiene columnas A, B, C... que se copian por posición
    DATA lr_target TYPE REF TO data.
    CREATE DATA lr_target LIKE LINE OF ct_rows.
    ASSIGN lr_target->* TO FIELD-SYMBOL(<ls_target>).

    LOOP AT <lt_sheet> ASSIGNING FIELD-SYMBOL(<ls_source>).
      IF sy-tabix = 1 AND iv_skip_header = abap_true.
        CONTINUE.
      ENDIF.
      CLEAR <ls_target>.
      DO.
        ASSIGN COMPONENT sy-index OF STRUCTURE <ls_source> TO FIELD-SYMBOL(<lv_from>).
        IF sy-subrc <> 0.
          EXIT.
        ENDIF.
        ASSIGN COMPONENT sy-index OF STRUCTURE <ls_target> TO FIELD-SYMBOL(<lv_to>).
        IF sy-subrc <> 0.
          EXIT.
        ENDIF.
        <lv_to> = <lv_from>.
      ENDDO.
      IF <ls_target> IS NOT INITIAL.
        APPEND <ls_target> TO ct_rows.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
