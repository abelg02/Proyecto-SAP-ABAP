"! <p class="shorttext synchronized">Application Log clásico (SLG1) con BAL_*</p>
"! Versión on-premise de ZCL_ABK_LOG. Objeto y subobjeto se crean en SLG0.
"!
"! Uso:
"!   DATA(lo_log) = zcl_abk_bal=>create( iv_object = 'ZABK' iv_subobject = 'CARGA' iv_extnumber = |Fichero { lv_name }| ).
"!   lo_log->add_text( iv_text = `Fila 12: material vacío` iv_type = 'E' ).
"!   lo_log->add_bapiret2( lt_return ).
"!   lo_log->save( ).
"!   lo_log->show( ).                    " solo en diálogo
CLASS zcl_abk_bal DEFINITION
  PUBLIC
  FINAL
  CREATE PRIVATE.

  PUBLIC SECTION.
    CLASS-METHODS create
      IMPORTING iv_object     TYPE balobj_d
                iv_subobject  TYPE balsubobj
                iv_extnumber  TYPE balnrext OPTIONAL
                iv_keep_days  TYPE i DEFAULT 30
      RETURNING VALUE(ro_log) TYPE REF TO zcl_abk_bal.

    METHODS add_text
      IMPORTING iv_text TYPE csequence
                iv_type TYPE symsgty DEFAULT 'I'.

    METHODS add_message
      IMPORTING iv_type TYPE symsgty DEFAULT sy-msgty
                iv_id   TYPE symsgid DEFAULT sy-msgid
                iv_no   TYPE symsgno DEFAULT sy-msgno
                iv_v1   TYPE symsgv  DEFAULT sy-msgv1
                iv_v2   TYPE symsgv  DEFAULT sy-msgv2
                iv_v3   TYPE symsgv  DEFAULT sy-msgv3
                iv_v4   TYPE symsgv  DEFAULT sy-msgv4.

    METHODS add_bapiret2
      IMPORTING it_return TYPE bapiret2_t.

    METHODS add_exception
      IMPORTING ix_error TYPE REF TO cx_root.

    METHODS save.

    METHODS show.

    METHODS has_errors
      RETURNING VALUE(rv_result) TYPE abap_bool.

  PRIVATE SECTION.
    DATA mv_handle     TYPE balloghndl.
    DATA mv_has_errors TYPE abap_bool.
ENDCLASS.



CLASS zcl_abk_bal IMPLEMENTATION.

  METHOD create.
    ro_log = NEW #( ).

    DATA(ls_header) = VALUE bal_s_log( object    = iv_object
                                       subobject = iv_subobject
                                       extnumber = iv_extnumber
                                       aldate_del = sy-datum + iv_keep_days
                                       del_before = abap_true ).

    CALL FUNCTION 'BAL_LOG_CREATE'
      EXPORTING
        i_s_log      = ls_header
      IMPORTING
        e_log_handle = ro_log->mv_handle
      EXCEPTIONS
        OTHERS       = 1.
    IF sy-subrc <> 0.
      CLEAR ro_log->mv_handle.
    ENDIF.
  ENDMETHOD.


  METHOD add_text.
    CALL FUNCTION 'BAL_LOG_MSG_ADD_FREE_TEXT'
      EXPORTING
        i_log_handle = mv_handle
        i_msgty      = iv_type
        i_text       = CONV char200( iv_text )
      EXCEPTIONS
        OTHERS       = 1.
    IF iv_type CA 'EA'.
      mv_has_errors = abap_true.
    ENDIF.
  ENDMETHOD.


  METHOD add_message.
    DATA(ls_msg) = VALUE bal_s_msg( msgty = iv_type msgid = iv_id msgno = iv_no
                                    msgv1 = iv_v1 msgv2 = iv_v2 msgv3 = iv_v3 msgv4 = iv_v4 ).
    CALL FUNCTION 'BAL_LOG_MSG_ADD'
      EXPORTING
        i_log_handle = mv_handle
        i_s_msg      = ls_msg
      EXCEPTIONS
        OTHERS       = 1.
    IF iv_type CA 'EA'.
      mv_has_errors = abap_true.
    ENDIF.
  ENDMETHOD.


  METHOD add_bapiret2.
    LOOP AT it_return INTO DATA(ls_return).
      add_message( iv_type = ls_return-type
                   iv_id   = ls_return-id
                   iv_no   = ls_return-number
                   iv_v1   = ls_return-message_v1
                   iv_v2   = ls_return-message_v2
                   iv_v3   = ls_return-message_v3
                   iv_v4   = ls_return-message_v4 ).
    ENDLOOP.
  ENDMETHOD.


  METHOD add_exception.
    DATA(lx_current) = ix_error.
    WHILE lx_current IS BOUND.
      add_text( iv_text = lx_current->get_text( ) iv_type = 'E' ).
      lx_current = lx_current->previous.
    ENDWHILE.
  ENDMETHOD.


  METHOD save.
    CALL FUNCTION 'BAL_DB_SAVE'
      EXPORTING
        i_t_log_handle = VALUE bal_t_logh( ( mv_handle ) )
      EXCEPTIONS
        OTHERS         = 1.
  ENDMETHOD.


  METHOD show.
    CALL FUNCTION 'BAL_DSP_LOG_DISPLAY'
      EXPORTING
        i_t_log_handle = VALUE bal_t_logh( ( mv_handle ) )
      EXCEPTIONS
        OTHERS         = 1.
  ENDMETHOD.


  METHOD has_errors.
    rv_result = mv_has_errors.
  ENDMETHOD.

ENDCLASS.
