*&---------------------------------------------------------------------*
*& Report ZABK_R_CARGA_CSV
*&---------------------------------------------------------------------*
*& Report de ejemplo que usa las clases del pack clásico juntas:
*&   fichero CSV del PC o del servidor -> validación -> BAPI -> log SLG1 -> ALV de resultado.
*& Caso: actualizar el texto breve de materiales (BAPI_MATERIAL_SAVEDATA).
*& Columnas del CSV: material;idioma;texto
*&---------------------------------------------------------------------*
REPORT zabk_r_carga_csv.

TYPES: BEGIN OF ty_upload,
         matnr TYPE matnr,
         spras TYPE spras,
         maktx TYPE maktx,
       END OF ty_upload.

TYPES: BEGIN OF ty_result,
         matnr   TYPE matnr,
         status  TYPE icon_d,
         message TYPE bapi_msg,
       END OF ty_result.

DATA gt_upload TYPE STANDARD TABLE OF ty_upload WITH EMPTY KEY.
DATA gt_result TYPE STANDARD TABLE OF ty_result WITH EMPTY KEY.

SELECTION-SCREEN BEGIN OF BLOCK b1 WITH FRAME TITLE TEXT-b01.
  PARAMETERS p_pc   RADIOBUTTON GROUP src DEFAULT 'X' USER-COMMAND src.
  PARAMETERS p_serv RADIOBUTTON GROUP src.
  PARAMETERS p_path TYPE string LOWER CASE.
  PARAMETERS p_test AS CHECKBOX DEFAULT 'X'.
SELECTION-SCREEN END OF BLOCK b1.

CLASS lcl_app DEFINITION FINAL.
  PUBLIC SECTION.
    CLASS-METHODS main.
ENDCLASS.

CLASS lcl_app IMPLEMENTATION.
  METHOD main.
  DATA lt_lines TYPE string_table.

  " 1) Leer fichero
  TRY.
      lt_lines = COND #( WHEN p_pc = abap_true THEN zcl_abk_file=>upload_csv( p_path )
                         ELSE zcl_abk_file=>read_server( p_path ) ).
    CATCH cx_sy_file_io INTO DATA(lx_file).
      MESSAGE lx_file TYPE 'S' DISPLAY LIKE 'E'.
      RETURN.
  ENDTRY.

  zcl_abk_file=>csv_to_table( EXPORTING it_lines = lt_lines
                              CHANGING  ct_table = gt_upload ).
  IF gt_upload IS INITIAL.
    MESSAGE 'El fichero no contiene datos' TYPE 'S' DISPLAY LIKE 'W'.
    RETURN.
  ENDIF.

  DATA(lo_log) = zcl_abk_bal=>create( iv_object    = 'ZABK'
                                      iv_subobject = 'CARGA'
                                      iv_extnumber = CONV #( p_path ) ).

  " 2) Validar en bloque: una sola SELECT para todos los materiales (no SELECT dentro del LOOP)
  SELECT matnr FROM mara
    FOR ALL ENTRIES IN @gt_upload
    WHERE matnr = @gt_upload-matnr
    INTO TABLE @DATA(lt_existing).
  SORT lt_existing BY matnr.

  " 3) Procesar
  LOOP AT gt_upload INTO DATA(ls_upload).
    DATA(lv_matnr) = CONV matnr( |{ ls_upload-matnr ALPHA = IN }| ).

    READ TABLE lt_existing WITH KEY matnr = lv_matnr BINARY SEARCH TRANSPORTING NO FIELDS.
    IF sy-subrc <> 0.
      APPEND VALUE #( matnr = lv_matnr status = icon_red_light message = 'Material no existe' ) TO gt_result.
      lo_log->add_text( iv_text = |{ lv_matnr }: no existe| iv_type = 'E' ).
      CONTINUE.
    ENDIF.

    DATA lt_return TYPE bapiret2_t.
    DATA ls_return TYPE bapiret2.
    DATA lt_makt   TYPE STANDARD TABLE OF bapi_makt.
    CLEAR lt_return.
    lt_makt = VALUE #( ( langu = ls_upload-spras matl_desc = ls_upload-maktx ) ).

    CALL FUNCTION 'BAPI_MATERIAL_SAVEDATA'
      EXPORTING
        headdata            = VALUE bapimathead( material = lv_matnr )
      IMPORTING
        return              = ls_return
      TABLES
        materialdescription = lt_makt.
    APPEND ls_return TO lt_return.

    DATA(lo_bapi) = zcl_abk_bapi=>finish( it_return = lt_return iv_test_mode = p_test ).
    lo_log->add_bapiret2( lt_return ).

    APPEND VALUE #( matnr   = lv_matnr
                    status  = COND #( WHEN lo_bapi->is_ok( ) THEN icon_green_light ELSE icon_red_light )
                    message = COND #( WHEN lo_bapi->is_ok( ) AND p_test = abap_true THEN 'Correcto (modo test, sin grabar)'
                                      WHEN lo_bapi->is_ok( ) THEN 'Texto actualizado'
                                      ELSE lo_bapi->first_error_text( ) ) ) TO gt_result.
  ENDLOOP.

  lo_log->save( ).

  " 4) Resultado
  zcl_abk_salv=>display( EXPORTING iv_title = |Carga de textos de material ({ lines( gt_result ) } filas)|
                                   it_texts = VALUE #( ( column = 'STATUS'  text = 'Estado' )
                                                       ( column = 'MESSAGE' text = 'Mensaje' ) )
                         CHANGING  ct_data  = gt_result ).
  ENDMETHOD.
ENDCLASS.

START-OF-SELECTION.
  lcl_app=>main( ).
