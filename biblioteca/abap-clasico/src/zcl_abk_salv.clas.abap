"! <p class="shorttext synchronized">ALV en 1 línea con CL_SALV_TABLE (ECC / S/4HANA on-premise)</p>
"! Lo que casi todos los informes repiten: funciones estándar, columnas optimizadas,
"! cebra, título, textos de columna, ocultar campos, totales y hotspot.
"!
"! Uso:
"!   zcl_abk_salv=>display( EXPORTING iv_title  = 'Pedidos abiertos'
"!                                    it_hide   = VALUE #( ( `MANDT` ) )
"!                                    it_sum    = VALUE #( ( `NETWR` ) )
"!                                    it_texts  = VALUE #( ( column = `NETWR` text = `Importe neto` ) )
"!                          CHANGING  ct_data   = lt_pedidos ).
CLASS zcl_abk_salv DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    TYPES: BEGIN OF ty_text,
             column TYPE lvc_fname,
             text   TYPE scrtext_l,
           END OF ty_text,
           tt_texts   TYPE STANDARD TABLE OF ty_text WITH EMPTY KEY,
           tt_columns TYPE STANDARD TABLE OF lvc_fname WITH EMPTY KEY.

    CLASS-METHODS display
      IMPORTING iv_title    TYPE lvc_title OPTIONAL
                it_hide     TYPE tt_columns OPTIONAL
                it_sum      TYPE tt_columns OPTIONAL
                it_texts    TYPE tt_texts OPTIONAL
                iv_hotspot  TYPE lvc_fname OPTIONAL
                iv_popup    TYPE abap_bool DEFAULT abap_false
      CHANGING  ct_data     TYPE STANDARD TABLE.

    "! Para cuando se quiere seguir configurando el ALV antes de mostrarlo
    CLASS-METHODS create
      IMPORTING iv_title    TYPE lvc_title OPTIONAL
      EXPORTING eo_salv     TYPE REF TO cl_salv_table
      CHANGING  ct_data     TYPE STANDARD TABLE.

  PRIVATE SECTION.
    CLASS-DATA gt_data_ref TYPE REF TO data.

    CLASS-METHODS on_link_click
      FOR EVENT link_click OF cl_salv_events_table
      IMPORTING row column.
ENDCLASS.



CLASS zcl_abk_salv IMPLEMENTATION.

  METHOD display.
    DATA lo_salv TYPE REF TO cl_salv_table.

    create( EXPORTING iv_title = iv_title
            IMPORTING eo_salv  = lo_salv
            CHANGING  ct_data  = ct_data ).
    IF lo_salv IS NOT BOUND.
      RETURN.
    ENDIF.

    DATA(lo_columns) = lo_salv->get_columns( ).

    LOOP AT it_hide INTO DATA(lv_hide).
      TRY.
          lo_columns->get_column( lv_hide )->set_visible( abap_false ).
        CATCH cx_salv_not_found.
          " Columna inexistente en esta tabla: se ignora
      ENDTRY.
    ENDLOOP.

    LOOP AT it_texts INTO DATA(ls_text).
      TRY.
          DATA(lo_column) = lo_columns->get_column( ls_text-column ).
          lo_column->set_long_text( ls_text-text ).
          lo_column->set_medium_text( CONV #( ls_text-text ) ).
          lo_column->set_short_text( CONV #( ls_text-text ) ).
        CATCH cx_salv_not_found.
          " Columna inexistente en esta tabla: se ignora
      ENDTRY.
    ENDLOOP.

    DATA(lo_aggregations) = lo_salv->get_aggregations( ).
    LOOP AT it_sum INTO DATA(lv_sum).
      TRY.
          lo_aggregations->add_aggregation( columnname = lv_sum aggregation = if_salv_c_aggregation=>total ).
        CATCH cx_salv_not_found cx_salv_data_error cx_salv_existing.
          " Columna inexistente, no numérica o con total ya definido: se ignora
      ENDTRY.
    ENDLOOP.

    IF iv_hotspot IS NOT INITIAL.
      TRY.
          CAST cl_salv_column_table( lo_columns->get_column( iv_hotspot ) )->set_cell_type( if_salv_c_cell_type=>hotspot ).
          GET REFERENCE OF ct_data INTO gt_data_ref.
          SET HANDLER on_link_click FOR lo_salv->get_event( ).
        CATCH cx_salv_not_found.
          " Columna inexistente en esta tabla: se ignora
      ENDTRY.
    ENDIF.

    IF iv_popup = abap_true.
      lo_salv->set_screen_popup( start_column = 5 end_column = 150 start_line = 3 end_line = 25 ).
    ENDIF.

    lo_salv->display( ).
  ENDMETHOD.


  METHOD create.
    TRY.
        cl_salv_table=>factory( IMPORTING r_salv_table = eo_salv
                                CHANGING  t_table      = ct_data ).
      CATCH cx_salv_msg INTO DATA(lx_salv).
        MESSAGE lx_salv TYPE 'S' DISPLAY LIKE 'E'.
        RETURN.
    ENDTRY.

    eo_salv->get_functions( )->set_all( abap_true ).
    eo_salv->get_columns( )->set_optimize( abap_true ).
    eo_salv->get_display_settings( )->set_striped_pattern( abap_true ).

    IF iv_title IS NOT INITIAL.
      eo_salv->get_display_settings( )->set_list_header( iv_title ).
    ENDIF.

    " Permite al usuario guardar variantes de disposición
    DATA(lo_layout) = eo_salv->get_layout( ).
    lo_layout->set_key( VALUE #( report = sy-cprog ) ).
    lo_layout->set_save_restriction( if_salv_c_layout=>restrict_none ).
    lo_layout->set_default( abap_true ).
  ENDMETHOD.


  METHOD on_link_click.
    " Ejemplo: si la columna clicada es un documento comercial (VBELN), abrir VA03.
    " Adáptalo a tu caso (ME23N para EBELN, MM03 para MATNR, FB03 para BELNR...).
    FIELD-SYMBOLS <lt_data> TYPE STANDARD TABLE.
    ASSIGN gt_data_ref->* TO <lt_data>.
    READ TABLE <lt_data> INDEX row ASSIGNING FIELD-SYMBOL(<ls_row>).
    CHECK sy-subrc = 0.
    ASSIGN COMPONENT column OF STRUCTURE <ls_row> TO FIELD-SYMBOL(<lv_value>).
    CHECK sy-subrc = 0 AND column = 'VBELN'.

    SET PARAMETER ID 'AUN' FIELD <lv_value>.
    CALL TRANSACTION 'VA03' WITH AUTHORITY-CHECK AND SKIP FIRST SCREEN.
  ENDMETHOD.

ENDCLASS.
