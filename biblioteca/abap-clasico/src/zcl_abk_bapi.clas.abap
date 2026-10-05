"! <p class="shorttext synchronized">Tratamiento de BAPIRET2 y COMMIT/ROLLBACK de BAPIs</p>
"! Evita el error más común con BAPIs: hacer COMMIT aunque la tabla RETURN traiga un 'E' o 'A'.
"!
"! Uso:
"!   CALL FUNCTION 'BAPI_PO_CHANGE' ... TABLES return = lt_return.
"!   DATA(lo_result) = zcl_abk_bapi=>finish( it_return = lt_return ).
"!   IF lo_result->is_ok( ).
"!     MESSAGE |Pedido { lv_ebeln } modificado| TYPE 'S'.
"!   ELSE.
"!     lo_result->show( ).   " popup con todos los mensajes
"!   ENDIF.
CLASS zcl_abk_bapi DEFINITION
  PUBLIC
  FINAL
  CREATE PRIVATE.

  PUBLIC SECTION.
    "! Comprueba RETURN y hace COMMIT AND WAIT si no hay errores; si los hay, ROLLBACK.
    CLASS-METHODS finish
      IMPORTING it_return        TYPE bapiret2_t
                iv_test_mode     TYPE abap_bool DEFAULT abap_false
                PREFERRED PARAMETER it_return
      RETURNING VALUE(ro_result) TYPE REF TO zcl_abk_bapi.

    "! Solo analiza RETURN, sin COMMIT ni ROLLBACK
    CLASS-METHODS check
      IMPORTING it_return        TYPE bapiret2_t
      RETURNING VALUE(ro_result) TYPE REF TO zcl_abk_bapi.

    "! Convierte un BAPIRETURN / BAPIRET1 de BAPIs antiguas a BAPIRET2
    CLASS-METHODS from_bapireturn
      IMPORTING is_return        TYPE bapireturn
      RETURNING VALUE(rs_ret2)   TYPE bapiret2.

    METHODS is_ok
      RETURNING VALUE(rv_ok) TYPE abap_bool.

    METHODS errors
      RETURNING VALUE(rt_errors) TYPE bapiret2_t.

    "! Primer mensaje de error con el texto ya formateado
    METHODS first_error_text
      RETURNING VALUE(rv_text) TYPE string.

    "! Todos los mensajes en una línea (para logs o para un campo de texto)
    METHODS as_string
      RETURNING VALUE(rv_text) TYPE string.

    "! Muestra todos los mensajes en el popup estándar (diálogo; no usar en fondo)
    METHODS show.

  PRIVATE SECTION.
    DATA mt_return TYPE bapiret2_t.
ENDCLASS.



CLASS zcl_abk_bapi IMPLEMENTATION.

  METHOD finish.
    ro_result = check( it_return ).

    IF ro_result->is_ok( ) AND iv_test_mode = abap_false.
      DATA ls_commit_return TYPE bapiret2.
      CALL FUNCTION 'BAPI_TRANSACTION_COMMIT'
        EXPORTING
          wait   = abap_true
        IMPORTING
          return = ls_commit_return.
      IF ls_commit_return-type CA 'EA'.
        APPEND ls_commit_return TO ro_result->mt_return.
      ENDIF.
    ELSE.
      CALL FUNCTION 'BAPI_TRANSACTION_ROLLBACK'.
    ENDIF.
  ENDMETHOD.


  METHOD check.
    ro_result = NEW #( ).
    ro_result->mt_return = it_return.
  ENDMETHOD.


  METHOD from_bapireturn.
    rs_ret2 = VALUE #( type       = is_return-type
                       message    = is_return-message
                       log_no     = is_return-log_no
                       log_msg_no = is_return-log_msg_no
                       message_v1 = is_return-message_v1
                       message_v2 = is_return-message_v2
                       message_v3 = is_return-message_v3
                       message_v4 = is_return-message_v4 ).
    " BAPIRETURN trae el ID y número juntos en CODE (p. ej. 'M7001')
    IF strlen( is_return-code ) > 3.
      rs_ret2-id     = substring( val = is_return-code len = strlen( is_return-code ) - 3 ).
      rs_ret2-number = substring( val = is_return-code off = strlen( is_return-code ) - 3 ).
    ENDIF.
  ENDMETHOD.


  METHOD is_ok.
    rv_ok = xsdbool( NOT line_exists( mt_return[ type = 'E' ] ) AND NOT line_exists( mt_return[ type = 'A' ] ) ).
  ENDMETHOD.


  METHOD errors.
    rt_errors = VALUE #( FOR ls_ret IN mt_return WHERE ( type CA 'EA' ) ( ls_ret ) ).
  ENDMETHOD.


  METHOD first_error_text.
    DATA(lt_errors) = errors( ).
    IF lt_errors IS NOT INITIAL.
      rv_text = lt_errors[ 1 ]-message.
    ENDIF.
  ENDMETHOD.


  METHOD as_string.
    rv_text = concat_lines_of( table = VALUE string_table( FOR ls_ret IN mt_return ( |{ ls_ret-type }: { ls_ret-message }| ) )
                               sep   = ` | ` ).
  ENDMETHOD.


  METHOD show.
    CHECK mt_return IS NOT INITIAL.
    CALL FUNCTION 'FINB_BAPIRET2_DISPLAY'
      EXPORTING
        it_message = mt_return.
  ENDMETHOD.

ENDCLASS.
