"! <p class="shorttext synchronized">Cliente HTTP / REST para ABAP Cloud</p>
"! Tres formas de conectar, de menos a más recomendable en productivo:
"!   1) for_url( )             -> URL directa. Sólo para pruebas (en Cloud requiere que el host esté permitido).
"!   2) for_cloud_destination( ) -> destino creado en el BTP Cockpit.
"!   3) for_comm_arrangement( )  -> Communication Arrangement (lo correcto en S/4HANA Cloud).
"!
"! Uso:
"!   DATA(lo_http) = zcl_abk_http=>for_url( `https://api.frankfurter.app/latest?from=EUR` ).
"!   DATA(ls_resp) = lo_http->get( ).
"!   IF ls_resp-status = 200.
"!     zcl_abk_json=>from_json( EXPORTING iv_json = ls_resp-body CHANGING cs_data = ls_rates ).
"!   ENDIF.
CLASS zcl_abk_http DEFINITION
  PUBLIC
  FINAL
  CREATE PRIVATE.

  PUBLIC SECTION.
    TYPES: BEGIN OF ty_response,
             status TYPE i,
             reason TYPE string,
             body   TYPE string,
           END OF ty_response.

    CLASS-METHODS for_url
      IMPORTING iv_url         TYPE string
      RETURNING VALUE(ro_http) TYPE REF TO zcl_abk_http
      RAISING   cx_http_dest_provider_error
                cx_web_http_client_error.

    CLASS-METHODS for_cloud_destination
      IMPORTING iv_destination TYPE string
      RETURNING VALUE(ro_http) TYPE REF TO zcl_abk_http
      RAISING   cx_http_dest_provider_error
                cx_web_http_client_error.

    CLASS-METHODS for_comm_arrangement
      IMPORTING iv_scenario    TYPE if_com_management=>ty_cscn_id
                iv_service     TYPE if_com_management=>ty_cscn_outb_srv_id
      RETURNING VALUE(ro_http) TYPE REF TO zcl_abk_http
      RAISING   cx_http_dest_provider_error
                cx_web_http_client_error.

    "! Cabecera para todas las peticiones de esta instancia
    METHODS header
      IMPORTING iv_name        TYPE string
                iv_value       TYPE string
      RETURNING VALUE(ro_http) TYPE REF TO zcl_abk_http.

    METHODS basic_auth
      IMPORTING iv_user        TYPE string
                iv_password    TYPE string
      RETURNING VALUE(ro_http) TYPE REF TO zcl_abk_http.

    METHODS bearer
      IMPORTING iv_token       TYPE string
      RETURNING VALUE(ro_http) TYPE REF TO zcl_abk_http.

    METHODS get
      IMPORTING iv_path            TYPE string OPTIONAL
      RETURNING VALUE(rs_response) TYPE ty_response
      RAISING   cx_web_http_client_error.

    METHODS post
      IMPORTING iv_path            TYPE string OPTIONAL
                iv_body            TYPE string
                iv_content_type    TYPE string DEFAULT `application/json`
      RETURNING VALUE(rs_response) TYPE ty_response
      RAISING   cx_web_http_client_error.

    METHODS put
      IMPORTING iv_path            TYPE string OPTIONAL
                iv_body            TYPE string
                iv_content_type    TYPE string DEFAULT `application/json`
      RETURNING VALUE(rs_response) TYPE ty_response
      RAISING   cx_web_http_client_error.

    METHODS delete
      IMPORTING iv_path            TYPE string OPTIONAL
      RETURNING VALUE(rs_response) TYPE ty_response
      RAISING   cx_web_http_client_error.

    "! Cerrar la conexión cuando no se vaya a usar más
    METHODS close.

  PRIVATE SECTION.
    TYPES: BEGIN OF ty_header,
             name  TYPE string,
             value TYPE string,
           END OF ty_header,
           tt_headers TYPE STANDARD TABLE OF ty_header WITH EMPTY KEY.

    DATA mo_client  TYPE REF TO if_web_http_client.
    DATA mt_headers TYPE tt_headers.

    CLASS-METHODS from_destination
      IMPORTING io_destination TYPE REF TO if_http_destination
      RETURNING VALUE(ro_http) TYPE REF TO zcl_abk_http
      RAISING   cx_web_http_client_error.

    METHODS execute
      IMPORTING iv_method          TYPE if_web_http_client=>method
                iv_path            TYPE string OPTIONAL
                iv_body            TYPE string OPTIONAL
                iv_content_type    TYPE string OPTIONAL
      RETURNING VALUE(rs_response) TYPE ty_response
      RAISING   cx_web_http_client_error.
ENDCLASS.



CLASS zcl_abk_http IMPLEMENTATION.

  METHOD for_url.
    ro_http = from_destination( cl_http_destination_provider=>create_by_url( i_url = iv_url ) ).
  ENDMETHOD.


  METHOD for_cloud_destination.
    ro_http = from_destination( cl_http_destination_provider=>create_by_cloud_destination(
                                  i_name       = iv_destination
                                  i_authn_mode = if_a4c_cp_service=>service_specific ) ).
  ENDMETHOD.


  METHOD for_comm_arrangement.
    ro_http = from_destination( cl_http_destination_provider=>create_by_comm_arrangement(
                                  comm_scenario  = iv_scenario
                                  service_id     = iv_service ) ).
  ENDMETHOD.


  METHOD from_destination.
    ro_http = NEW #( ).
    ro_http->mo_client = cl_web_http_client_manager=>create_by_http_destination( io_destination ).
  ENDMETHOD.


  METHOD header.
    APPEND VALUE #( name = iv_name value = iv_value ) TO mt_headers.
    ro_http = me.
  ENDMETHOD.


  METHOD basic_auth.
    mo_client->get_http_request( )->set_authorization_basic( i_username = iv_user i_password = iv_password ).
    ro_http = me.
  ENDMETHOD.


  METHOD bearer.
    ro_http = header( iv_name = `Authorization` iv_value = |Bearer { iv_token }| ).
  ENDMETHOD.


  METHOD get.
    rs_response = execute( iv_method = if_web_http_client=>get iv_path = iv_path ).
  ENDMETHOD.


  METHOD post.
    rs_response = execute( iv_method       = if_web_http_client=>post
                           iv_path         = iv_path
                           iv_body         = iv_body
                           iv_content_type = iv_content_type ).
  ENDMETHOD.


  METHOD put.
    rs_response = execute( iv_method       = if_web_http_client=>put
                           iv_path         = iv_path
                           iv_body         = iv_body
                           iv_content_type = iv_content_type ).
  ENDMETHOD.


  METHOD delete.
    rs_response = execute( iv_method = if_web_http_client=>delete iv_path = iv_path ).
  ENDMETHOD.


  METHOD close.
    TRY.
        mo_client->close( ).
      CATCH cx_web_http_client_error.
        " La conexión ya estaba cerrada: no hay nada que hacer
    ENDTRY.
  ENDMETHOD.


  METHOD execute.
    DATA(lo_request) = mo_client->get_http_request( ).

    IF iv_path IS NOT INITIAL.
      lo_request->set_uri_path( i_uri_path = iv_path ).
    ENDIF.

    LOOP AT mt_headers INTO DATA(ls_header).
      lo_request->set_header_field( i_name = ls_header-name i_value = ls_header-value ).
    ENDLOOP.

    IF iv_body IS NOT INITIAL.
      lo_request->set_header_field( i_name = `Content-Type` i_value = iv_content_type ).
      lo_request->set_text( iv_body ).
    ENDIF.

    DATA(lo_response) = mo_client->execute( iv_method ).
    DATA(ls_status) = lo_response->get_status( ).

    rs_response = VALUE #( status = ls_status-code
                           reason = ls_status-reason
                           body   = lo_response->get_text( ) ).
  ENDMETHOD.

ENDCLASS.
