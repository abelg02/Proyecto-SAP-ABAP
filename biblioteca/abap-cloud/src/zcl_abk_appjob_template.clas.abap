"! <p class="shorttext synchronized">Plantilla de Application Job (proceso en fondo en ABAP Cloud)</p>
"! En ABAP Cloud no hay SM36 ni SUBMIT: los procesos en fondo son Application Jobs.
"! Pasos para usar esta plantilla:
"!   1. Copiar la clase y poner la lógica en EXECUTE.
"!   2. ADT > New > Other > Application Job Catalog Entry (apunta a esta clase).
"!   3. ADT > New > Other > Application Job Template (apunta a la entrada de catálogo).
"!   4. Planificar desde la app Fiori "Application Jobs" o por código con CL_APJ_RT_API.
"! Para probarla sin planificar: F9 (IF_OO_ADT_CLASSRUN) ejecuta la misma lógica.
CLASS zcl_abk_appjob_template DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_apj_dt_exec_object.
    INTERFACES if_apj_rt_exec_object.
    INTERFACES if_oo_adt_classrun.

  PRIVATE SECTION.
    CONSTANTS: BEGIN OF c_param,
                 days    TYPE c LENGTH 8 VALUE 'P_DAYS',
                 testrun TYPE c LENGTH 8 VALUE 'P_TEST',
               END OF c_param.

    METHODS process
      IMPORTING iv_days    TYPE i
                iv_testrun TYPE abap_bool
      RETURNING VALUE(rv_processed) TYPE i.
ENDCLASS.



CLASS zcl_abk_appjob_template IMPLEMENTATION.

  METHOD if_apj_dt_exec_object~get_parameters.
    " Parámetros que verá quien planifique el job (equivalente a la pantalla de selección)
    et_parameter_def = VALUE #(
      ( selname = c_param-days    kind = if_apj_dt_exec_object=>parameter datatype = 'I' length = 4
        param_text = 'Antigüedad en días' changeable_ind = abap_true mandatory_ind = abap_true )
      ( selname = c_param-testrun kind = if_apj_dt_exec_object=>parameter datatype = 'C' length = 1
        param_text = 'Simulación (sin grabar)' checkbox_ind = abap_true changeable_ind = abap_true ) ).

    " Valores por defecto
    et_parameter_val = VALUE #(
      ( selname = c_param-days    kind = if_apj_dt_exec_object=>parameter sign = 'I' option = 'EQ' low = '30' )
      ( selname = c_param-testrun kind = if_apj_dt_exec_object=>parameter sign = 'I' option = 'EQ' low = abap_true ) ).
  ENDMETHOD.


  METHOD if_apj_rt_exec_object~execute.
    DATA lv_days    TYPE i VALUE 30.
    DATA lv_testrun TYPE abap_bool VALUE abap_true.

    LOOP AT it_parameters INTO DATA(ls_param).
      CASE ls_param-selname.
        WHEN c_param-days.
          lv_days = ls_param-low.
        WHEN c_param-testrun.
          lv_testrun = xsdbool( ls_param-low = abap_true ).
      ENDCASE.
    ENDLOOP.

    DATA(lv_count) = process( iv_days = lv_days iv_testrun = lv_testrun ).

    " El log queda asociado al job y se ve desde la app Application Jobs
    TRY.
        DATA(lo_log) = zcl_abk_log=>create( iv_object = 'ZABK_LOG' iv_subobject = 'JOB' ).
        lo_log->info( |Procesados { lv_count } registros (simulación: { lv_testrun })| ).
        lo_log->save( ).
      CATCH cx_bali_runtime.
        " Sin log no se interrumpe el job
    ENDTRY.
  ENDMETHOD.


  METHOD if_oo_adt_classrun~main.
    out->write( |Simulación: { process( iv_days = 30 iv_testrun = abap_true ) } registros| ).
  ENDMETHOD.


  METHOD process.
    " Lógica del job. Ejemplo: contar registros más antiguos que N días.
    DATA(lv_limit) = cl_abap_context_info=>get_system_date( ) - iv_days.
    " SELECT COUNT(*) FROM zmi_tabla WHERE created_on < @lv_limit INTO @rv_processed.
    IF iv_testrun = abap_false.
      " Aquí iría la modificación real (MODIFY ENTITIES ... / UPDATE de tabla propia)
    ENDIF.
    rv_processed = 0.
  ENDMETHOD.

ENDCLASS.
