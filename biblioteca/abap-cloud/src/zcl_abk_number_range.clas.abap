"! <p class="shorttext synchronized">Rangos de números en ABAP Cloud (CL_NUMBERRANGE_RUNTIME)</p>
"! Alternativa correcta al típico SELECT MAX( id ) + 1, que en concurrencia da duplicados.
"! Requisito: objeto de rango de números creado en ADT (New > Other > Number Range Object)
"! e intervalo '01' mantenido (CL_NUMBERRANGE_INTERVALS o app Manage Number Range Intervals).
"!
"! Uso en una determinación RAP o en EARLY NUMBERING:
"!   DATA(lv_id) = zcl_abk_number_range=>next( iv_object = 'ZABK_INC' ).
CLASS zcl_abk_number_range DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    CLASS-METHODS next
      IMPORTING iv_object        TYPE cl_numberrange_runtime=>nr_object
                iv_interval      TYPE cl_numberrange_runtime=>nr_interval DEFAULT '01'
      RETURNING VALUE(rv_number) TYPE cl_numberrange_runtime=>nr_number
      RAISING   cx_nr_object_not_found
                cx_number_ranges.

    "! Reserva un bloque de números de una vez (cargas masivas)
    CLASS-METHODS next_block
      IMPORTING iv_object        TYPE cl_numberrange_runtime=>nr_object
                iv_interval      TYPE cl_numberrange_runtime=>nr_interval DEFAULT '01'
                iv_quantity      TYPE i
      EXPORTING ev_first         TYPE cl_numberrange_runtime=>nr_number
                ev_returned      TYPE i
      RAISING   cx_nr_object_not_found
                cx_number_ranges.
ENDCLASS.



CLASS zcl_abk_number_range IMPLEMENTATION.

  METHOD next.
    cl_numberrange_runtime=>number_get( EXPORTING nr_range_nr = iv_interval
                                                  object      = iv_object
                                        IMPORTING number      = rv_number ).
  ENDMETHOD.


  METHOD next_block.
    cl_numberrange_runtime=>number_get( EXPORTING nr_range_nr       = iv_interval
                                                  object            = iv_object
                                                  quantity          = CONV #( iv_quantity )
                                        IMPORTING number            = ev_first
                                                  returned_quantity = DATA(lv_returned) ).
    ev_returned = lv_returned.
  ENDMETHOD.

ENDCLASS.
