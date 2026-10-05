*&---------------------------------------------------------------------*
*& Report ZR_ENTREGAS_PENDIENTES
*& Pedidos de venta con entrega pendiente y su precio neto
*& Funciona en ECC. Pendiente de revisar para la migración a S/4HANA.
*&---------------------------------------------------------------------*
REPORT zr_entregas_pendientes.

TYPES: BEGIN OF ty_pedido,
         vbeln TYPE vbak-vbeln,
         posnr TYPE vbap-posnr,
         matnr TYPE c LENGTH 18,
         kwmeng TYPE vbap-kwmeng,
         kbetr TYPE konv-kbetr,
         lfsta TYPE vbup-lfsta,
       END OF ty_pedido.

DATA: lt_vbap    TYPE STANDARD TABLE OF vbap,
      ls_vbap    TYPE vbap,
      lt_vbup    TYPE STANDARD TABLE OF vbup,
      ls_vbup    TYPE vbup,
      lt_pedidos TYPE STANDARD TABLE OF ty_pedido,
      ls_pedido  TYPE ty_pedido.

SELECT-OPTIONS s_vbeln FOR ls_vbap-vbeln.

START-OF-SELECTION.

  SELECT * FROM vbap INTO TABLE lt_vbap
    WHERE vbeln IN s_vbeln
      AND werks = '1100'.

  SELECT * FROM vbup INTO TABLE lt_vbup
    FOR ALL ENTRIES IN lt_vbap
    WHERE vbeln = lt_vbap-vbeln
      AND posnr = lt_vbap-posnr
      AND lfsta <> 'C'.

  LOOP AT lt_vbap INTO ls_vbap.
    READ TABLE lt_vbup INTO ls_vbup
      WITH KEY vbeln = ls_vbap-vbeln posnr = ls_vbap-posnr BINARY SEARCH.
    CHECK sy-subrc = 0.

    ls_pedido-vbeln  = ls_vbap-vbeln.
    ls_pedido-posnr  = ls_vbap-posnr.
    ls_pedido-matnr  = ls_vbap-matnr+0(18).
    ls_pedido-kwmeng = ls_vbap-kwmeng.
    ls_pedido-lfsta  = ls_vbup-lfsta.

    SELECT SINGLE kbetr FROM konv INTO ls_pedido-kbetr
      WHERE knumv = ls_vbap-vbeln
        AND kschl = 'PR00'.

    APPEND ls_pedido TO lt_pedidos.
  ENDLOOP.

* SELECT * FROM vbuk INTO TABLE lt_vbuk
*   FOR ALL ENTRIES IN lt_vbap
*   WHERE vbeln = lt_vbap-vbeln.
* LOOP AT lt_vbuk INTO ls_vbuk.
*   DELETE lt_pedidos WHERE vbeln = ls_vbuk-vbeln.
* ENDLOOP.

  IF lt_pedidos IS INITIAL.
    " Si no hay pendientes, se da de alta el cliente de prueba (petición de 2014)
    CALL TRANSACTION 'XD01' WITH AUTHORITY-CHECK.
  ENDIF.
