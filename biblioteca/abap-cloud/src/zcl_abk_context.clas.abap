"! <p class="shorttext synchronized">Fecha, hora, usuario y zona horaria en ABAP Cloud</p>
"! En ABAP Cloud no se deben usar SY-DATUM, SY-UZEIT ni SY-UNAME (el ATC lo marca).
"! Esta clase centraliza CL_ABAP_CONTEXT_INFO y las conversiones de timestamp.
CLASS zcl_abk_context DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    "! Fecha del sistema (UTC)
    CLASS-METHODS today
      RETURNING VALUE(rv_date) TYPE d.

    "! Hora del sistema (UTC)
    CLASS-METHODS now_time
      RETURNING VALUE(rv_time) TYPE t.

    "! Timestamp UTC largo, para campos de auditoría (LastChangedAt, etc.)
    CLASS-METHODS now_utcl
      RETURNING VALUE(rv_timestamp) TYPE timestampl.

    "! Usuario técnico (CB9980000xxx en BTP)
    CLASS-METHODS user_technical
      RETURNING VALUE(rv_user) TYPE syuname.

    "! Nombre visible del usuario, si existe
    CLASS-METHODS user_name
      RETURNING VALUE(rv_name) TYPE string.

    "! Zona horaria del usuario (por ejemplo CET)
    CLASS-METHODS user_timezone
      RETURNING VALUE(rv_tz) TYPE timezone.

    "! Convierte un timestamp UTC a fecha y hora locales del usuario (o de la zona indicada)
    CLASS-METHODS to_local
      IMPORTING iv_timestamp TYPE timestampl
                iv_timezone  TYPE timezone OPTIONAL
      EXPORTING ev_date      TYPE d
                ev_time      TYPE t.

    "! Diferencia en segundos entre dos timestamps (positiva si iv_to es posterior)
    CLASS-METHODS seconds_between
      IMPORTING iv_from           TYPE timestampl
                iv_to             TYPE timestampl
      RETURNING VALUE(rv_seconds) TYPE decfloat34.
ENDCLASS.



CLASS zcl_abk_context IMPLEMENTATION.

  METHOD today.
    rv_date = cl_abap_context_info=>get_system_date( ).
  ENDMETHOD.


  METHOD now_time.
    rv_time = cl_abap_context_info=>get_system_time( ).
  ENDMETHOD.


  METHOD now_utcl.
    GET TIME STAMP FIELD rv_timestamp.
  ENDMETHOD.


  METHOD user_technical.
    rv_user = cl_abap_context_info=>get_user_technical_name( ).
  ENDMETHOD.


  METHOD user_name.
    TRY.
        rv_name = cl_abap_context_info=>get_user_formatted_name( ).
      CATCH cx_abap_context_info_error.
        rv_name = user_technical( ).
    ENDTRY.
  ENDMETHOD.


  METHOD user_timezone.
    TRY.
        rv_tz = cl_abap_context_info=>get_user_time_zone( ).
      CATCH cx_abap_context_info_error.
        rv_tz = 'UTC'.
    ENDTRY.
  ENDMETHOD.


  METHOD to_local.
    DATA(lv_tz) = COND timezone( WHEN iv_timezone IS INITIAL THEN user_timezone( ) ELSE iv_timezone ).
    CONVERT TIME STAMP iv_timestamp TIME ZONE lv_tz INTO DATE ev_date TIME ev_time.
  ENDMETHOD.


  METHOD seconds_between.
    rv_seconds = cl_abap_tstmp=>subtract( tstmp1 = iv_to tstmp2 = iv_from ).
  ENDMETHOD.

ENDCLASS.
