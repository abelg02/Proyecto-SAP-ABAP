"! Tests unitarios de ZCL_ABK_STRING. Ejecutar en ADT con Ctrl+Shift+F10.
CLASS ltcl_string DEFINITION FINAL FOR TESTING
  DURATION SHORT
  RISK LEVEL HARMLESS.

  PRIVATE SECTION.
    METHODS email_valido            FOR TESTING.
    METHODS email_invalido          FOR TESTING.
    METHODS alpha_in_rellena_ceros  FOR TESTING.
    METHODS alpha_out_quita_ceros   FOR TESTING.
    METHODS quita_acentos           FOR TESTING.
    METHODS title_case              FOR TESTING.
    METHODS csv_con_comillas        FOR TESTING.
    METHODS dia_de_la_semana        FOR TESTING.
    METHODS laborables_salta_finde  FOR TESTING.
    METHODS ultimo_dia_febrero      FOR TESTING.
    METHODS ultimo_dia_diciembre    FOR TESTING.
ENDCLASS.


CLASS ltcl_string IMPLEMENTATION.

  METHOD email_valido.
    cl_abap_unit_assert=>assert_true( zcl_abk_string=>is_valid_email( `usuario.prueba@empresa.com` ) ).
  ENDMETHOD.

  METHOD email_invalido.
    cl_abap_unit_assert=>assert_false( zcl_abk_string=>is_valid_email( `usuario@empresa` ) ).
    cl_abap_unit_assert=>assert_false( zcl_abk_string=>is_valid_email( `sin-arroba.es` ) ).
  ENDMETHOD.

  METHOD alpha_in_rellena_ceros.
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>alpha_in( iv_value = `4711` iv_length = 10 )
                                        exp = `0000004711` ).
  ENDMETHOD.

  METHOD alpha_out_quita_ceros.
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>alpha_out( `0000004711` ) exp = `4711` ).
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>alpha_out( `ABC001` ) exp = `ABC001` ).
  ENDMETHOD.

  METHOD quita_acentos.
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>remove_accents( `Camión Año Éxito` )
                                        exp = `Camion Ano Exito` ).
  ENDMETHOD.

  METHOD title_case.
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>to_title_case( `JUAN pérez GARCÍA` )
                                        exp = `Juan Pérez García` ).
  ENDMETHOD.

  METHOD csv_con_comillas.
    DATA(lt_fields) = zcl_abk_string=>split_csv_line( iv_line = `1001;"Tornillo; M8";"Dice ""hola""";4,50` ).
    cl_abap_unit_assert=>assert_equals( act = lines( lt_fields ) exp = 4 ).
    cl_abap_unit_assert=>assert_equals( act = lt_fields[ 2 ] exp = `Tornillo; M8` ).
    cl_abap_unit_assert=>assert_equals( act = lt_fields[ 3 ] exp = `Dice "hola"` ).
  ENDMETHOD.

  METHOD dia_de_la_semana.
    " 06/10/2026 es martes
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>weekday( '20261006' ) exp = 2 ).
  ENDMETHOD.

  METHOD laborables_salta_finde.
    " Viernes 09/10/2026 + 1 laborable = lunes 12/10/2026
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>add_working_days( iv_date = '20261009' iv_days = 1 )
                                        exp = '20261012' ).
  ENDMETHOD.

  METHOD ultimo_dia_febrero.
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>last_day_of_month( '20280210' ) exp = '20280229' ).
  ENDMETHOD.

  METHOD ultimo_dia_diciembre.
    cl_abap_unit_assert=>assert_equals( act = zcl_abk_string=>last_day_of_month( '20261215' ) exp = '20261231' ).
  ENDMETHOD.

ENDCLASS.
