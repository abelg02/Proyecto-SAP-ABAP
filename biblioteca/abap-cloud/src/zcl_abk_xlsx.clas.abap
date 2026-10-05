"! <p class="shorttext synchronized">Leer y escribir Excel (XLSX) en ABAP Cloud con XCO</p>
"! Lectura: el contenido llega como XSTRING (por ejemplo, un campo RAWSTRING con
"! @Semantics.largeObject en una entidad RAP, o la respuesta de una API).
"!
"! Uso:
"!   TYPES: BEGIN OF ty_row,
"!            material TYPE string,
"!            quantity TYPE string,
"!          END OF ty_row.
"!   DATA lt_rows TYPE STANDARD TABLE OF ty_row WITH EMPTY KEY.
"!   zcl_abk_xlsx=>read( EXPORTING iv_content = lv_xstring iv_skip_header = abap_true
"!                       CHANGING  ct_rows    = lt_rows ).
"!
"!   DATA(lv_file) = zcl_abk_xlsx=>write( it_rows = lt_rows iv_sheet = `Pedidos` ).
CLASS zcl_abk_xlsx DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    "! Lee una hoja en una tabla interna. Las columnas se asignan por posición a los
    "! componentes de la estructura de la tabla (recomendado: todos de tipo string).
    CLASS-METHODS read
      IMPORTING iv_content     TYPE xstring
                iv_sheet       TYPE i DEFAULT 1
                iv_skip_header TYPE abap_bool DEFAULT abap_true
      CHANGING  ct_rows        TYPE STANDARD TABLE.

    "! Escribe una tabla interna en un XLSX nuevo y devuelve el contenido
    CLASS-METHODS write
      IMPORTING it_rows           TYPE STANDARD TABLE
                iv_sheet          TYPE string DEFAULT `Hoja1`
      RETURNING VALUE(rv_content) TYPE xstring.
ENDCLASS.



CLASS zcl_abk_xlsx IMPLEMENTATION.

  METHOD read.
    DATA(lo_read) = xco_cp_xlsx=>document->for_file_content( iv_file_content = iv_content )->read_access( ).
    DATA(lo_sheet) = lo_read->get_workbook( )->worksheet->at_position( iv_sheet ).

    " Desde la fila 2 si hay cabecera; desde la columna A hasta el final
    DATA(lo_pattern) = xco_cp_xlsx_selection=>pattern_builder->simple_from_to(
                         )->from_row( xco_cp_xlsx=>coordinate->for_numeric_value( COND #( WHEN iv_skip_header = abap_true THEN 2 ELSE 1 ) )
                         )->from_column( xco_cp_xlsx=>coordinate->for_alphabetic_value( 'A' )
                         )->get_pattern( ).

    lo_sheet->select( lo_pattern
      )->row_stream(
      )->operation->write_to( REF #( ct_rows )
      )->set_value_transformation( xco_cp_xlsx_read_access=>value_transformation->string_value
      )->if_xco_xlsx_ra_operation~execute( ).
  ENDMETHOD.


  METHOD write.
    DATA(lo_write) = xco_cp_xlsx=>document->empty( )->write_access( ).
    DATA(lo_sheet) = lo_write->get_workbook( )->worksheet->at_position( 1 ).
    lo_sheet->set_name( iv_sheet ).

    DATA(lo_pattern) = xco_cp_xlsx_selection=>pattern_builder->simple_from_to(
                         )->from_column( xco_cp_xlsx=>coordinate->for_alphabetic_value( 'A' )
                         )->from_row( xco_cp_xlsx=>coordinate->for_numeric_value( 1 )
                         )->get_pattern( ).

    lo_sheet->select( lo_pattern
      )->row_stream(
      )->operation->write_from( REF #( it_rows )
      )->execute( ).

    rv_content = lo_write->get_file_content( ).
  ENDMETHOD.

ENDCLASS.
