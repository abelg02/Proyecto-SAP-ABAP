"! <p class="shorttext synchronized">Envío de emails en ABAP Cloud (CL_BCS_MAIL_MESSAGE)</p>
"! Requisito en BTP / S/4HANA Cloud: escenario de comunicación SAP_COM_0548 (Email) y
"! un remitente permitido en la app "Maintain Email Sender Addresses".
"!
"! Uso:
"!   zcl_abk_mail=>new( )->from( `noreply@empresa.com` )
"!                        ->to( `compras@empresa.com` )
"!                        ->cc( `jefe@empresa.com` )
"!                        ->subject( |Pedido { lv_po } aprobado| )
"!                        ->html_body( lv_html )
"!                        ->attach( iv_content = lv_pdf iv_filename = `pedido.pdf` iv_mime_type = `application/pdf` )
"!                        ->send( ).
CLASS zcl_abk_mail DEFINITION
  PUBLIC
  FINAL
  CREATE PRIVATE.

  PUBLIC SECTION.
    TYPES: BEGIN OF ty_result,
             sent    TYPE abap_bool,
             details TYPE string,
           END OF ty_result.

    CLASS-METHODS new
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    METHODS from
      IMPORTING iv_address     TYPE csequence
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    METHODS to
      IMPORTING iv_address     TYPE csequence
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    METHODS cc
      IMPORTING iv_address     TYPE csequence
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    METHODS bcc
      IMPORTING iv_address     TYPE csequence
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    METHODS subject
      IMPORTING iv_subject     TYPE csequence
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    METHODS html_body
      IMPORTING iv_html        TYPE string
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    METHODS text_body
      IMPORTING iv_text        TYPE string
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    METHODS attach
      IMPORTING iv_content     TYPE xstring
                iv_filename    TYPE string
                iv_mime_type   TYPE string DEFAULT `application/octet-stream`
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    "! Adjunta texto (CSV, TXT, JSON) sin convertirlo antes a XSTRING
    METHODS attach_text
      IMPORTING iv_content     TYPE string
                iv_filename    TYPE string
                iv_mime_type   TYPE string DEFAULT `text/plain`
      RETURNING VALUE(ro_mail) TYPE REF TO zcl_abk_mail
      RAISING   cx_bcs_mail.

    "! Envía el correo. El envío real es asíncrono: "sent" indica que se ha entregado al servicio.
    METHODS send
      RETURNING VALUE(rs_result) TYPE ty_result
      RAISING   cx_bcs_mail.

  PRIVATE SECTION.
    DATA mo_mail TYPE REF TO cl_bcs_mail_message.
ENDCLASS.



CLASS zcl_abk_mail IMPLEMENTATION.

  METHOD new.
    ro_mail = NEW #( ).
    ro_mail->mo_mail = cl_bcs_mail_message=>create_instance( ).
  ENDMETHOD.


  METHOD from.
    mo_mail->set_sender( CONV #( iv_address ) ).
    ro_mail = me.
  ENDMETHOD.


  METHOD to.
    mo_mail->add_recipient( iv_address = CONV #( iv_address ) ).
    ro_mail = me.
  ENDMETHOD.


  METHOD cc.
    mo_mail->add_recipient( iv_address = CONV #( iv_address ) iv_copy = cl_bcs_mail_message=>cc ).
    ro_mail = me.
  ENDMETHOD.


  METHOD bcc.
    mo_mail->add_recipient( iv_address = CONV #( iv_address ) iv_copy = cl_bcs_mail_message=>bcc ).
    ro_mail = me.
  ENDMETHOD.


  METHOD subject.
    mo_mail->set_subject( CONV #( iv_subject ) ).
    ro_mail = me.
  ENDMETHOD.


  METHOD html_body.
    mo_mail->set_main( cl_bcs_mail_textpart=>create_instance( iv_content      = iv_html
                                                              iv_content_type = `text/html` ) ).
    ro_mail = me.
  ENDMETHOD.


  METHOD text_body.
    mo_mail->set_main( cl_bcs_mail_textpart=>create_instance( iv_content      = iv_text
                                                              iv_content_type = `text/plain` ) ).
    ro_mail = me.
  ENDMETHOD.


  METHOD attach.
    mo_mail->add_attachment( cl_bcs_mail_binarypart=>create_instance( iv_content      = iv_content
                                                                      iv_content_type = iv_mime_type
                                                                      iv_filename     = iv_filename ) ).
    ro_mail = me.
  ENDMETHOD.


  METHOD attach_text.
    mo_mail->add_attachment( cl_bcs_mail_textpart=>create_instance( iv_content      = iv_content
                                                                    iv_content_type = iv_mime_type
                                                                    iv_filename     = iv_filename ) ).
    ro_mail = me.
  ENDMETHOD.


  METHOD send.
    mo_mail->send( IMPORTING et_status = DATA(lt_status) ).

    rs_result-sent = abap_true.
    LOOP AT lt_status INTO DATA(ls_status).
      rs_result-details = |{ rs_result-details }{ ls_status-recipient }: { ls_status-status }; |.
      " Estado 'E' = error al entregar a ese destinatario
      IF ls_status-status = 'E'.
        rs_result-sent = abap_false.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
