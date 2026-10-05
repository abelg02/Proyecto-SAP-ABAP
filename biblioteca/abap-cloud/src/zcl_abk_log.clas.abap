"! <p class="shorttext synchronized">Application Log para ABAP Cloud (API released CL_BALI_*)</p>
"! Envuelve CL_BALI_LOG para no repetir las mismas 15 líneas en cada clase.
"! Requisito: objeto y subobjeto de log creados en ADT (New > Other > Application Log Object).
"!
"! Uso:
"!   DATA(lo_log) = zcl_abk_log=>create( iv_object = 'ZABK_LOG' iv_subobject = 'IMPORT' iv_external_id = |Pedido { lv_id }| ).
"!   lo_log->info( |Leídas { lines( lt_data ) } filas| ).
"!   lo_log->error( `Proveedor no encontrado` ).
"!   lo_log->save( ).
CLASS zcl_abk_log DEFINITION
  PUBLIC
  FINAL
  CREATE PRIVATE.

  PUBLIC SECTION.
    CLASS-METHODS create
      IMPORTING iv_object      TYPE cl_bali_header_setter=>ty_object
                iv_subobject   TYPE cl_bali_header_setter=>ty_subobject
                iv_external_id TYPE cl_bali_header_setter=>ty_external_id OPTIONAL
      RETURNING VALUE(ro_log)  TYPE REF TO zcl_abk_log
      RAISING   cx_bali_runtime.

    METHODS info
      IMPORTING iv_text       TYPE csequence
      RETURNING VALUE(ro_log) TYPE REF TO zcl_abk_log.

    METHODS warning
      IMPORTING iv_text       TYPE csequence
      RETURNING VALUE(ro_log) TYPE REF TO zcl_abk_log.

    METHODS error
      IMPORTING iv_text       TYPE csequence
      RETURNING VALUE(ro_log) TYPE REF TO zcl_abk_log.

    "! Añade una excepción completa (texto de la excepción y de sus PREVIOUS)
    METHODS exception
      IMPORTING ix_error      TYPE REF TO cx_root
      RETURNING VALUE(ro_log) TYPE REF TO zcl_abk_log.

    "! Añade un mensaje de clase de mensajes (T100)
    METHODS message
      IMPORTING iv_severity   TYPE if_bali_constants=>ty_severity DEFAULT if_bali_constants=>c_severity_status
                iv_id         TYPE symsgid
                iv_number     TYPE symsgno
                iv_v1         TYPE simple OPTIONAL
                iv_v2         TYPE simple OPTIONAL
                iv_v3         TYPE simple OPTIONAL
                iv_v4         TYPE simple OPTIONAL
      RETURNING VALUE(ro_log) TYPE REF TO zcl_abk_log.

    METHODS has_errors
      RETURNING VALUE(rv_result) TYPE abap_bool.

    "! Guarda el log. Si se ejecuta dentro de un Application Job, se asocia al job.
    METHODS save
      IMPORTING iv_assign_to_job TYPE abap_bool DEFAULT abap_true
      RAISING   cx_bali_runtime.

    "! Handle del log, para mostrarlo o leerlo después
    METHODS get_handle
      RETURNING VALUE(rv_handle) TYPE if_bali_log=>ty_handle.

  PRIVATE SECTION.
    DATA mo_log        TYPE REF TO if_bali_log.
    DATA mv_has_errors TYPE abap_bool.

    METHODS add_text
      IMPORTING iv_severity TYPE if_bali_constants=>ty_severity
                iv_text     TYPE csequence.
ENDCLASS.



CLASS zcl_abk_log IMPLEMENTATION.

  METHOD create.
    ro_log = NEW #( ).
    ro_log->mo_log = cl_bali_log=>create_with_header(
                       header = cl_bali_header_setter=>create( object      = iv_object
                                                               subobject   = iv_subobject
                                                               external_id = iv_external_id ) ).
  ENDMETHOD.


  METHOD info.
    add_text( iv_severity = if_bali_constants=>c_severity_information iv_text = iv_text ).
    ro_log = me.
  ENDMETHOD.


  METHOD warning.
    add_text( iv_severity = if_bali_constants=>c_severity_warning iv_text = iv_text ).
    ro_log = me.
  ENDMETHOD.


  METHOD error.
    add_text( iv_severity = if_bali_constants=>c_severity_error iv_text = iv_text ).
    ro_log = me.
  ENDMETHOD.


  METHOD exception.
    TRY.
        mo_log->add_item( cl_bali_exception_setter=>create( severity  = if_bali_constants=>c_severity_error
                                                            exception = ix_error ) ).
        mv_has_errors = abap_true.
      CATCH cx_bali_runtime.
        " Si el log falla no debe tumbar el proceso de negocio
    ENDTRY.
    ro_log = me.
  ENDMETHOD.


  METHOD message.
    TRY.
        mo_log->add_item( cl_bali_message_setter=>create( severity   = iv_severity
                                                          id         = iv_id
                                                          number     = iv_number
                                                          variable_1 = CONV #( iv_v1 )
                                                          variable_2 = CONV #( iv_v2 )
                                                          variable_3 = CONV #( iv_v3 )
                                                          variable_4 = CONV #( iv_v4 ) ) ).
        IF iv_severity = if_bali_constants=>c_severity_error.
          mv_has_errors = abap_true.
        ENDIF.
      CATCH cx_bali_runtime.
        " Igual que en EXCEPTION: un fallo del log no interrumpe el proceso
    ENDTRY.
    ro_log = me.
  ENDMETHOD.


  METHOD has_errors.
    rv_result = mv_has_errors.
  ENDMETHOD.


  METHOD save.
    cl_bali_log_db=>get_instance( )->save_log( log                        = mo_log
                                               assign_to_current_appl_job = iv_assign_to_job ).
  ENDMETHOD.


  METHOD get_handle.
    rv_handle = mo_log->get_handle( ).
  ENDMETHOD.


  METHOD add_text.
    TRY.
        " CL_BALI_FREE_TEXT_SETTER admite hasta 200 caracteres por entrada
        mo_log->add_item( cl_bali_free_text_setter=>create( severity = iv_severity
                                                            text     = CONV #( iv_text ) ) ).
        IF iv_severity = if_bali_constants=>c_severity_error.
          mv_has_errors = abap_true.
        ENDIF.
      CATCH cx_bali_runtime.
        " Igual que en EXCEPTION: un fallo del log no interrumpe el proceso
    ENDTRY.
  ENDMETHOD.

ENDCLASS.
