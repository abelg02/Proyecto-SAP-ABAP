"! <p class="shorttext synchronized">JSON <-> estructuras ABAP (released: /UI2/CL_JSON)</p>
"! /UI2/CL_JSON está liberada para ABAP Cloud. Esta clase fija las opciones que casi
"! siempre se quieren (camelCase, sin campos vacíos, fechas ISO) para no recordarlas cada vez.
"!
"! Uso:
"!   DATA(lv_json) = zcl_abk_json=>to_json( ls_pedido ).          " {"orderId":"4500000012",...}
"!   zcl_abk_json=>from_json( EXPORTING iv_json = lv_body CHANGING cs_data = ls_pedido ).
CLASS zcl_abk_json DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    CONSTANTS: BEGIN OF c_case,
                 camel TYPE char1 VALUE /ui2/cl_json=>pretty_mode-camel_case,
                 lower TYPE char1 VALUE /ui2/cl_json=>pretty_mode-low_case,
                 none  TYPE char1 VALUE /ui2/cl_json=>pretty_mode-none,
               END OF c_case.

    "! Serializa cualquier dato (estructura, tabla, referencia) a JSON
    CLASS-METHODS to_json
      IMPORTING ig_data         TYPE any
                iv_case         TYPE char1 DEFAULT c_case-camel
                iv_compress     TYPE abap_bool DEFAULT abap_true
                PREFERRED PARAMETER ig_data
      RETURNING VALUE(rv_json)  TYPE string.

    "! Deserializa JSON sobre una estructura o tabla ya tipada
    CLASS-METHODS from_json
      IMPORTING iv_json TYPE string
                iv_case TYPE char1 DEFAULT c_case-camel
      CHANGING  cs_data TYPE any.

    "! Lee un único valor por ruta, sin definir tipos. Ej: get_value( iv_json = lv iv_path = `rates/USD` )
    CLASS-METHODS get_value
      IMPORTING iv_json         TYPE string
                iv_path         TYPE string
      RETURNING VALUE(rv_value) TYPE string.

  PRIVATE SECTION.
ENDCLASS.



CLASS zcl_abk_json IMPLEMENTATION.

  METHOD to_json.
    rv_json = /ui2/cl_json=>serialize( data        = ig_data
                                       pretty_name = iv_case
                                       compress    = iv_compress
                                       ts_as_iso8601 = abap_true ).
  ENDMETHOD.


  METHOD from_json.
    /ui2/cl_json=>deserialize( EXPORTING json        = iv_json
                                         pretty_name = iv_case
                               CHANGING  data        = cs_data ).
  ENDMETHOD.


  METHOD get_value.
    DATA lr_data TYPE REF TO data.
    FIELD-SYMBOLS <lg_node> TYPE any.

    lr_data = /ui2/cl_json=>generate( json = iv_json ).
    SPLIT iv_path AT '/' INTO TABLE DATA(lt_steps).

    LOOP AT lt_steps INTO DATA(lv_step).
      IF lr_data IS NOT BOUND.
        RETURN.
      ENDIF.
      ASSIGN lr_data->* TO <lg_node>.
      " /UI2/CL_JSON=>GENERATE crea estructuras dinámicas con los nombres en mayúsculas
      ASSIGN COMPONENT to_upper( lv_step ) OF STRUCTURE <lg_node> TO FIELD-SYMBOL(<lr_child>).
      IF sy-subrc <> 0.
        RETURN.
      ENDIF.
      lr_data = <lr_child>.
    ENDLOOP.

    IF lr_data IS BOUND.
      ASSIGN lr_data->* TO <lg_node>.
      rv_value = |{ <lg_node> }|.
    ENDIF.
  ENDMETHOD.

ENDCLASS.
