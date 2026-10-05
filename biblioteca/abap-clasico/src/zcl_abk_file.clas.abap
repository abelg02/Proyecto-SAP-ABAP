"! <p class="shorttext synchronized">Ficheros: PC (diálogo) y servidor de aplicación, CSV a tabla y vuelta</p>
"! - upload_csv / download_csv: PC del usuario con CL_GUI_FRONTEND_SERVICES (solo en diálogo, SAP GUI).
"! - read_server / write_server: servidor (AL11), válido en fondo. Si la ruta la escribe el
"!   usuario, valídala antes con FILE_VALIDATE_NAME (nombre de fichero lógico, transacción FILE).
"! - csv_to_table / table_to_csv: conversión genérica por posición de columna.
"!
"! Uso:
"!   DATA lt_materiales TYPE STANDARD TABLE OF zs_material_upload.
"!   DATA(lt_lines) = zcl_abk_file=>upload_csv( ).                 " abre el diálogo de selección
"!   zcl_abk_file=>csv_to_table( EXPORTING it_lines = lt_lines iv_skip_header = abap_true
"!                               CHANGING  ct_table = lt_materiales ).
CLASS zcl_abk_file DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    CLASS-METHODS upload_csv
      IMPORTING iv_filename     TYPE string OPTIONAL
      RETURNING VALUE(rt_lines) TYPE string_table
      RAISING   cx_sy_file_io.

    CLASS-METHODS download_csv
      IMPORTING it_lines         TYPE string_table
                iv_default_name  TYPE string DEFAULT `export.csv`
      RAISING   cx_sy_file_io.

    CLASS-METHODS read_server
      IMPORTING iv_path         TYPE string
      RETURNING VALUE(rt_lines) TYPE string_table
      RAISING   cx_sy_file_io.

    CLASS-METHODS write_server
      IMPORTING iv_path  TYPE string
                it_lines TYPE string_table
      RAISING   cx_sy_file_io.

    "! Rellena una tabla interna desde líneas CSV; cada columna va al componente en la misma posición
    CLASS-METHODS csv_to_table
      IMPORTING it_lines       TYPE string_table
                iv_separator   TYPE c DEFAULT ';'
                iv_skip_header TYPE abap_bool DEFAULT abap_true
      CHANGING  ct_table       TYPE STANDARD TABLE.

    "! Convierte cualquier tabla interna plana a líneas CSV, con cabecera de nombres de campo
    CLASS-METHODS table_to_csv
      IMPORTING it_table        TYPE STANDARD TABLE
                iv_separator    TYPE c DEFAULT ';'
                iv_header       TYPE abap_bool DEFAULT abap_true
      RETURNING VALUE(rt_lines) TYPE string_table.
ENDCLASS.



CLASS zcl_abk_file IMPLEMENTATION.

  METHOD upload_csv.
    DATA lt_files  TYPE filetable.
    DATA lv_rc     TYPE i.
    DATA lv_action TYPE i.

    DATA(lv_filename) = iv_filename.

    IF lv_filename IS INITIAL.
      cl_gui_frontend_services=>file_open_dialog(
        EXPORTING  file_filter = |CSV (*.csv)\|*.csv\|{ cl_gui_frontend_services=>filetype_all }|
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
      EXPORTING  filename = lv_filename
                 filetype = 'ASC'
                 codepage = '4110'          " UTF-8
      CHANGING   data_tab = rt_lines
      EXCEPTIONS OTHERS   = 1 ).
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_sy_file_io EXPORTING filename = lv_filename.
    ENDIF.
  ENDMETHOD.


  METHOD download_csv.
    DATA lv_filename TYPE string.
    DATA lv_path     TYPE string.
    DATA lv_fullpath TYPE string.
    DATA lv_action   TYPE i.

    cl_gui_frontend_services=>file_save_dialog(
      EXPORTING  default_file_name = iv_default_name
                 default_extension = `csv`
      CHANGING   filename          = lv_filename
                 path              = lv_path
                 fullpath          = lv_fullpath
                 user_action       = lv_action
      EXCEPTIONS OTHERS            = 1 ).
    IF sy-subrc <> 0 OR lv_action <> cl_gui_frontend_services=>action_ok.
      RETURN.
    ENDIF.

    cl_gui_frontend_services=>gui_download(
      EXPORTING  filename = lv_fullpath
                 filetype = 'ASC'
                 codepage = '4110'
                 write_bom = abap_true    " para que Excel abra bien los acentos
      CHANGING   data_tab = it_lines
      EXCEPTIONS OTHERS   = 1 ).
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_sy_file_io EXPORTING filename = lv_fullpath.
    ENDIF.
  ENDMETHOD.


  METHOD read_server.
    DATA lv_line TYPE string.

    TRY.
        OPEN DATASET iv_path FOR INPUT IN TEXT MODE ENCODING UTF-8 SKIPPING BYTE-ORDER MARK. " cleancore:ignorar SEC-009 quien llama valida la ruta (ver cabecera)
        IF sy-subrc <> 0.
          RAISE EXCEPTION TYPE cx_sy_file_io EXPORTING filename = iv_path.
        ENDIF.
        DO.
          READ DATASET iv_path INTO lv_line.
          IF sy-subrc <> 0.
            EXIT.
          ENDIF.
          APPEND lv_line TO rt_lines.
        ENDDO.
        CLOSE DATASET iv_path.
      CATCH cx_sy_file_open cx_sy_file_authority cx_sy_file_access_error INTO DATA(lx_file).
        RAISE EXCEPTION TYPE cx_sy_file_io EXPORTING filename = iv_path previous = lx_file.
    ENDTRY.
  ENDMETHOD.


  METHOD write_server.
    TRY.
        OPEN DATASET iv_path FOR OUTPUT IN TEXT MODE ENCODING UTF-8. " cleancore:ignorar SEC-009 quien llama valida la ruta (ver cabecera)
        IF sy-subrc <> 0.
          RAISE EXCEPTION TYPE cx_sy_file_io EXPORTING filename = iv_path.
        ENDIF.
        LOOP AT it_lines INTO DATA(lv_line).
          TRANSFER lv_line TO iv_path.
        ENDLOOP.
        CLOSE DATASET iv_path.
      CATCH cx_sy_file_open cx_sy_file_authority cx_sy_file_access_error INTO DATA(lx_file).
        RAISE EXCEPTION TYPE cx_sy_file_io EXPORTING filename = iv_path previous = lx_file.
    ENDTRY.
  ENDMETHOD.


  METHOD csv_to_table.
    DATA lr_line TYPE REF TO data.

    CREATE DATA lr_line LIKE LINE OF ct_table.
    ASSIGN lr_line->* TO FIELD-SYMBOL(<ls_line>).

    LOOP AT it_lines INTO DATA(lv_line).
      IF sy-tabix = 1 AND iv_skip_header = abap_true.
        CONTINUE.
      ENDIF.
      CHECK lv_line IS NOT INITIAL.

      CLEAR <ls_line>.
      SPLIT lv_line AT iv_separator INTO TABLE DATA(lt_fields).

      LOOP AT lt_fields INTO DATA(lv_field).
        ASSIGN COMPONENT sy-tabix OF STRUCTURE <ls_line> TO FIELD-SYMBOL(<lv_target>).
        IF sy-subrc <> 0.
          EXIT.
        ENDIF.
        " Importes con coma decimal (formato español): 1.234,56 -> 1234.56
        DESCRIBE FIELD <lv_target> TYPE DATA(lv_type).
        IF lv_type CA 'PFa'.
          REPLACE ALL OCCURRENCES OF '.' IN lv_field WITH ''.
          REPLACE ALL OCCURRENCES OF ',' IN lv_field WITH '.'.
        ENDIF.
        TRY.
            <lv_target> = condense( lv_field ).
          CATCH cx_sy_conversion_error.
            CLEAR <lv_target>.
        ENDTRY.
      ENDLOOP.

      APPEND <ls_line> TO ct_table.
    ENDLOOP.
  ENDMETHOD.


  METHOD table_to_csv.
    DATA(lo_struct) = CAST cl_abap_structdescr(
                        CAST cl_abap_tabledescr( cl_abap_typedescr=>describe_by_data( it_table ) )->get_table_line_type( ) ).
    DATA(lt_components) = lo_struct->get_components( ).

    IF iv_header = abap_true.
      APPEND concat_lines_of( table = VALUE string_table( FOR ls_comp IN lt_components ( CONV #( ls_comp-name ) ) )
                              sep   = iv_separator ) TO rt_lines.
    ENDIF.

    LOOP AT it_table ASSIGNING FIELD-SYMBOL(<ls_row>).
      DATA(lv_out) = ``.
      DO lines( lt_components ) TIMES.
        ASSIGN COMPONENT sy-index OF STRUCTURE <ls_row> TO FIELD-SYMBOL(<lv_value>).
        DATA(lv_text) = condense( CONV string( <lv_value> ) ).
        " Si el valor contiene el separador o comillas, se entrecomilla
        IF lv_text CA iv_separator OR lv_text CA '"'.
          lv_text = |"{ replace( val = lv_text sub = `"` with = `""` occ = 0 ) }"|.
        ENDIF.
        lv_out = COND #( WHEN sy-index = 1 THEN lv_text ELSE |{ lv_out }{ iv_separator }{ lv_text }| ).
      ENDDO.
      APPEND lv_out TO rt_lines.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
