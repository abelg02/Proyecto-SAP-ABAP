"! Interfaz de precios con un proveedor externo.
"! Lee un fichero del servidor, actualiza precios y llama a una API REST.
CLASS zcl_interfaz_precios DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS importar
      IMPORTING iv_fichero TYPE string
                iv_filtro  TYPE string.
  PRIVATE SECTION.
    CONSTANTS gc_api_key TYPE string VALUE 'CLAVE-FICTICIA-DE-EJEMPLO'.
ENDCLASS.


CLASS zcl_interfaz_precios IMPLEMENTATION.

  METHOD importar.
    DATA lv_linea   TYPE string.
    DATA lv_where   TYPE string.
    DATA lv_token   TYPE string.

    lv_token = 'Bearer CLAVE-FICTICIA-DE-EJEMPLO'.

    " El fichero lo indica el usuario en la pantalla
    OPEN DATASET iv_fichero FOR INPUT IN TEXT MODE ENCODING DEFAULT.
    DO.
      READ DATASET iv_fichero INTO lv_linea.
      IF sy-subrc <> 0.
        EXIT.
      ENDIF.
    ENDDO.
    CLOSE DATASET iv_fichero.

    " Filtro libre que llega desde la llamada RFC
    CONCATENATE 'MATNR LIKE ''' iv_filtro '%''' INTO lv_where.
    SELECT matnr, meins FROM mara
      WHERE (lv_where)
      INTO TABLE @DATA(lt_mara).

    LOOP AT lt_mara INTO DATA(ls_mara).
      UPDATE mbew SET verpr = 0
        WHERE matnr = @ls_mara-matnr.
    ENDLOOP.

    IF sy-uname = 'ADMIN_INTERF'.
      " El usuario de interfaz no necesita autorización
      RETURN.
    ENDIF.

    TRY.
        cl_http_client=>create_by_url( EXPORTING url = 'https://api.proveedor.com/precios'
                                       IMPORTING client = DATA(lo_client) ).
      CATCH cx_root.
    ENDTRY.

    COMMIT WORK.
  ENDMETHOD.

ENDCLASS.
