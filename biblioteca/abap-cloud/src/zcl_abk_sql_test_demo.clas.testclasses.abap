"! Plantilla de test con dobles de base de datos y de CDS.
"! Sustituye ZDT_INCT_AGG / ZR_DT_INCT_AGG por tus tablas y vistas.
"! Los tests no tocan los datos reales: el framework redirige las SELECT a tablas temporales.

"--------------------------------------------------------------------
" 1) Doble de TABLA de base de datos (CL_OSQL_TEST_ENVIRONMENT)
"--------------------------------------------------------------------
CLASS ltcl_sql_double DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    CLASS-DATA go_env TYPE REF TO if_osql_test_environment.

    CLASS-METHODS class_setup.
    CLASS-METHODS class_teardown.
    METHODS setup.

    METHODS cuenta_incidencias_abiertas FOR TESTING.
ENDCLASS.


CLASS ltcl_sql_double IMPLEMENTATION.

  METHOD class_setup.
    go_env = cl_osql_test_environment=>create( i_dependency_list = VALUE #( ( 'ZDT_INCT_AGG' ) ) ).
  ENDMETHOD.

  METHOD class_teardown.
    go_env->destroy( ).
  ENDMETHOD.

  METHOD setup.
    go_env->clear_doubles( ).

    DATA lt_data TYPE STANDARD TABLE OF zdt_inct_agg WITH EMPTY KEY.
    lt_data = VALUE #( ( inc_uuid = cl_system_uuid=>create_uuid_x16_static( ) incident_id = 1 status = 'OP' )
                       ( inc_uuid = cl_system_uuid=>create_uuid_x16_static( ) incident_id = 2 status = 'OP' )
                       ( inc_uuid = cl_system_uuid=>create_uuid_x16_static( ) incident_id = 3 status = 'CL' ) ).
    go_env->insert_test_data( lt_data ).
  ENDMETHOD.

  METHOD cuenta_incidencias_abiertas.
    SELECT COUNT(*) FROM zdt_inct_agg WHERE status = 'OP' INTO @DATA(lv_count).
    cl_abap_unit_assert=>assert_equals( act = lv_count exp = 2 ).
  ENDMETHOD.

ENDCLASS.


"--------------------------------------------------------------------
" 2) Doble de las fuentes de una VISTA CDS (CL_CDS_TEST_ENVIRONMENT)
"    Prueba la lógica de la propia vista: CASE, joins, cálculos.
"--------------------------------------------------------------------
CLASS ltcl_cds_double DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    CLASS-DATA go_env TYPE REF TO if_cds_test_environment.

    CLASS-METHODS class_setup.
    CLASS-METHODS class_teardown.
    METHODS setup.

    METHODS vista_devuelve_todas FOR TESTING.
ENDCLASS.


CLASS ltcl_cds_double IMPLEMENTATION.

  METHOD class_setup.
    go_env = cl_cds_test_environment=>create( i_for_entity = 'ZR_DT_INCT_AGG' ).
  ENDMETHOD.

  METHOD class_teardown.
    go_env->destroy( ).
  ENDMETHOD.

  METHOD setup.
    go_env->clear_doubles( ).

    DATA lt_data TYPE STANDARD TABLE OF zdt_inct_agg WITH EMPTY KEY.
    lt_data = VALUE #( ( inc_uuid = cl_system_uuid=>create_uuid_x16_static( ) incident_id = 10 status = 'IP' ) ).
    go_env->insert_test_data( lt_data ).
  ENDMETHOD.

  METHOD vista_devuelve_todas.
    SELECT FROM zr_dt_inct_agg FIELDS IncidentId, Status INTO TABLE @DATA(lt_result).
    cl_abap_unit_assert=>assert_equals( act = lines( lt_result ) exp = 1 ).
    cl_abap_unit_assert=>assert_equals( act = lt_result[ 1 ]-Status exp = 'IP' ).
  ENDMETHOD.

ENDCLASS.
