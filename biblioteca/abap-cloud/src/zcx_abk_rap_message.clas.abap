"! <p class="shorttext synchronized">Mensajes para RAP (validaciones, acciones, autorizaciones)</p>
"! Excepción que implementa IF_ABAP_BEHV_MESSAGE para poder rellenar REPORTED con
"! textos de una clase de mensajes y severidad, sin repetir el boilerplate en cada BO.
"!
"! Clase de mensajes esperada: ZABK_RAP (créala en ADT o cambia la constante GC_MSGID).
"!   001 El campo &1 es obligatorio
"!   002 La fecha &1 no puede ser posterior a &2
"!   003 Solo se puede borrar en estado &1
"!   004 No tienes autorización para &1
"!   005 Transición de estado no permitida: &1 -> &2
"!   006 &1 &2 &3 &4
"!
"! Uso en una validación:
"!   APPEND VALUE #( %tky = ls_inc-%tky ) TO failed-incident.
"!   APPEND VALUE #( %tky        = ls_inc-%tky
"!                   %element-Title = if_abap_behv=>mk-on
"!                   %msg        = zcx_abk_rap_message=>mandatory( `Título` ) ) TO reported-incident.
CLASS zcx_abk_rap_message DEFINITION
  PUBLIC
  INHERITING FROM cx_static_check
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_abap_behv_message.
    INTERFACES if_t100_dyn_msg.

    CONSTANTS gc_msgid TYPE symsgid VALUE 'ZABK_RAP'.

    DATA mv_attr1 TYPE string READ-ONLY.
    DATA mv_attr2 TYPE string READ-ONLY.
    DATA mv_attr3 TYPE string READ-ONLY.
    DATA mv_attr4 TYPE string READ-ONLY.

    METHODS constructor
      IMPORTING textid   LIKE if_t100_message=>t100key OPTIONAL
                previous LIKE previous OPTIONAL
                severity TYPE if_abap_behv_message=>t_severity DEFAULT if_abap_behv_message=>severity-error
                attr1    TYPE string OPTIONAL
                attr2    TYPE string OPTIONAL
                attr3    TYPE string OPTIONAL
                attr4    TYPE string OPTIONAL.

    CLASS-METHODS mandatory
      IMPORTING iv_field      TYPE string
      RETURNING VALUE(ro_msg) TYPE REF TO zcx_abk_rap_message.

    CLASS-METHODS date_order
      IMPORTING iv_from       TYPE string
                iv_to         TYPE string
      RETURNING VALUE(ro_msg) TYPE REF TO zcx_abk_rap_message.

    CLASS-METHODS delete_only_in
      IMPORTING iv_status     TYPE string
      RETURNING VALUE(ro_msg) TYPE REF TO zcx_abk_rap_message.

    CLASS-METHODS not_authorized
      IMPORTING iv_activity   TYPE string
      RETURNING VALUE(ro_msg) TYPE REF TO zcx_abk_rap_message.

    CLASS-METHODS invalid_transition
      IMPORTING iv_from       TYPE string
                iv_to         TYPE string
      RETURNING VALUE(ro_msg) TYPE REF TO zcx_abk_rap_message.

    "! Mensaje libre (hasta 4 trozos de 50 caracteres) con la severidad indicada
    CLASS-METHODS free_text
      IMPORTING iv_text       TYPE string
                iv_severity   TYPE if_abap_behv_message=>t_severity DEFAULT if_abap_behv_message=>severity-error
      RETURNING VALUE(ro_msg) TYPE REF TO zcx_abk_rap_message.

  PRIVATE SECTION.
    CLASS-METHODS build
      IMPORTING iv_number     TYPE symsgno
                iv_severity   TYPE if_abap_behv_message=>t_severity DEFAULT if_abap_behv_message=>severity-error
                iv_v1         TYPE string OPTIONAL
                iv_v2         TYPE string OPTIONAL
                iv_v3         TYPE string OPTIONAL
                iv_v4         TYPE string OPTIONAL
      RETURNING VALUE(ro_msg) TYPE REF TO zcx_abk_rap_message.
ENDCLASS.



CLASS zcx_abk_rap_message IMPLEMENTATION.

  METHOD constructor ##ADT_SUPPRESS_GENERATION.
    super->constructor( previous = previous ).

    if_t100_message~t100key = COND #( WHEN textid IS INITIAL THEN if_t100_message=>default_textid ELSE textid ).
    if_abap_behv_message~m_severity = severity.

    mv_attr1 = attr1.
    mv_attr2 = attr2.
    mv_attr3 = attr3.
    mv_attr4 = attr4.
  ENDMETHOD.


  METHOD mandatory.
    ro_msg = build( iv_number = '001' iv_v1 = iv_field ).
  ENDMETHOD.


  METHOD date_order.
    ro_msg = build( iv_number = '002' iv_v1 = iv_from iv_v2 = iv_to ).
  ENDMETHOD.


  METHOD delete_only_in.
    ro_msg = build( iv_number = '003' iv_v1 = iv_status ).
  ENDMETHOD.


  METHOD not_authorized.
    ro_msg = build( iv_number = '004' iv_v1 = iv_activity ).
  ENDMETHOD.


  METHOD invalid_transition.
    ro_msg = build( iv_number = '005' iv_v1 = iv_from iv_v2 = iv_to ).
  ENDMETHOD.


  METHOD free_text.
    ro_msg = build( iv_number   = '006'
                    iv_severity = iv_severity
                    iv_v1       = substring( val = iv_text off = 0   len = nmin( val1 = 50 val2 = strlen( iv_text ) ) )
                    iv_v2       = COND #( WHEN strlen( iv_text ) > 50  THEN substring( val = iv_text off = 50  len = nmin( val1 = 50 val2 = strlen( iv_text ) - 50 ) ) )
                    iv_v3       = COND #( WHEN strlen( iv_text ) > 100 THEN substring( val = iv_text off = 100 len = nmin( val1 = 50 val2 = strlen( iv_text ) - 100 ) ) )
                    iv_v4       = COND #( WHEN strlen( iv_text ) > 150 THEN substring( val = iv_text off = 150 len = nmin( val1 = 50 val2 = strlen( iv_text ) - 150 ) ) ) ).
  ENDMETHOD.


  METHOD build.
    ro_msg = NEW #( textid   = VALUE #( msgid = gc_msgid
                                        msgno = iv_number
                                        attr1 = 'MV_ATTR1'
                                        attr2 = 'MV_ATTR2'
                                        attr3 = 'MV_ATTR3'
                                        attr4 = 'MV_ATTR4' )
                    severity = iv_severity
                    attr1    = iv_v1
                    attr2    = iv_v2
                    attr3    = iv_v3
                    attr4    = iv_v4 ).
  ENDMETHOD.

ENDCLASS.
