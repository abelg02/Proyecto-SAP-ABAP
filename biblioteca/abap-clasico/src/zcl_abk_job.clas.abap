"! <p class="shorttext synchronized">Lanzar un report en fondo (JOB_OPEN / SUBMIT / JOB_CLOSE)</p>
"! Patrón para descargar procesos pesados del diálogo: el usuario pulsa un botón y el
"! trabajo se ejecuta en SM37, opcionalmente con variante o con parámetros concretos.
"!
"! Uso:
"!   DATA(ls_job) = zcl_abk_job=>submit( iv_report  = 'ZR_FACTURAS_MASIVAS'
"!                                       it_params  = VALUE #( ( selname = 'P_BUKRS' kind = 'P' low = '1000' ) )
"!                                       iv_start_immediately = abap_true ).
"!   MESSAGE |Job { ls_job-jobname } ({ ls_job-jobcount }) lanzado| TYPE 'S'.
CLASS zcl_abk_job DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    TYPES: BEGIN OF ty_job,
             jobname  TYPE btcjob,
             jobcount TYPE btcjobcnt,
           END OF ty_job.

    TYPES tt_params TYPE STANDARD TABLE OF rsparamsl_255 WITH EMPTY KEY.

    CLASS-METHODS submit
      IMPORTING iv_report            TYPE progname
                iv_variant           TYPE variant OPTIONAL
                it_params            TYPE tt_params OPTIONAL
                iv_jobname           TYPE btcjob OPTIONAL
                iv_start_immediately TYPE abap_bool DEFAULT abap_true
                iv_start_date        TYPE d OPTIONAL
                iv_start_time        TYPE t OPTIONAL
      RETURNING VALUE(rs_job)        TYPE ty_job
      RAISING   cx_abap_api_state.

    "! Estado de un job: 'F' terminado, 'A' cancelado, 'R' en ejecución, 'S' liberado, 'P' planificado
    CLASS-METHODS status
      IMPORTING is_job           TYPE ty_job
      RETURNING VALUE(rv_status) TYPE btcstatus.
ENDCLASS.



CLASS zcl_abk_job IMPLEMENTATION.

  METHOD submit.
    " Solo reports propios que existan: evita lanzar cualquier programa si el nombre viene de fuera
    IF iv_report NP 'Z*' AND iv_report NP 'Y*'.
      RAISE EXCEPTION TYPE cx_abap_api_state.
    ENDIF.
    SELECT SINGLE @abap_true FROM trdir WHERE name = @iv_report AND subc = '1' INTO @DATA(lv_exists).
    IF lv_exists = abap_false.
      RAISE EXCEPTION TYPE cx_abap_api_state.
    ENDIF.

    rs_job-jobname = COND #( WHEN iv_jobname IS NOT INITIAL THEN iv_jobname ELSE CONV #( iv_report ) ).

    CALL FUNCTION 'JOB_OPEN'
      EXPORTING
        jobname          = rs_job-jobname
      IMPORTING
        jobcount         = rs_job-jobcount
      EXCEPTIONS
        cant_create_job  = 1
        invalid_job_data = 2
        jobname_missing  = 3
        OTHERS           = 4.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_abap_api_state.
    ENDIF.

    IF iv_variant IS NOT INITIAL.
      SUBMIT (iv_report) USING SELECTION-SET iv_variant
             VIA JOB rs_job-jobname NUMBER rs_job-jobcount
             AND RETURN. " cleancore:ignorar SEC-010 nombre validado arriba (Z/Y y existente)
    ELSE.
      SUBMIT (iv_report) WITH SELECTION-TABLE it_params
             VIA JOB rs_job-jobname NUMBER rs_job-jobcount
             AND RETURN. " cleancore:ignorar SEC-010 nombre validado arriba (Z/Y y existente)
    ENDIF.

    CALL FUNCTION 'JOB_CLOSE'
      EXPORTING
        jobcount             = rs_job-jobcount
        jobname              = rs_job-jobname
        strtimmed            = iv_start_immediately
        sdlstrtdt            = COND d( WHEN iv_start_immediately = abap_false THEN iv_start_date )
        sdlstrttm            = COND t( WHEN iv_start_immediately = abap_false THEN iv_start_time )
      EXCEPTIONS
        cant_start_immediate = 1
        invalid_startdate    = 2
        jobname_missing      = 3
        job_close_failed     = 4
        job_nosteps          = 5
        job_notex            = 6
        lock_failed          = 7
        OTHERS               = 8.
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE cx_abap_api_state.
    ENDIF.
  ENDMETHOD.


  METHOD status.
    SELECT SINGLE status FROM tbtco
      WHERE jobname  = @is_job-jobname
        AND jobcount = @is_job-jobcount
      INTO @rv_status.
  ENDMETHOD.

ENDCLASS.
