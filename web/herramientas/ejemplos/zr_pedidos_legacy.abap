*&---------------------------------------------------------------------*
*& Report ZR_PEDIDOS_PENDIENTES
*& Listado de pedidos de compra pendientes de entrada de mercancía
*& Escrito en 2009, modificado varias veces desde entonces
*&---------------------------------------------------------------------*
REPORT zr_pedidos_pendientes.

TABLES: ekko.

DATA: BEGIN OF it_pedidos OCCURS 0,
        ebeln LIKE ekko-ebeln,
        lifnr LIKE ekko-lifnr,
        name1 LIKE lfa1-name1,
        ebelp LIKE ekpo-ebelp,
        matnr LIKE ekpo-matnr,
        maktx LIKE makt-maktx,
        menge LIKE ekpo-menge,
        netwr LIKE ekpo-netwr,
      END OF it_pedidos.

DATA: it_ekpo  TYPE TABLE OF ekpo WITH HEADER LINE,
      wa_ekko  TYPE ekko,
      lv_count TYPE i,
      lv_total TYPE ekpo-netwr,
      lv_texto TYPE string,
      lv_fecha TYPE sy-datum,
      lv_pass  TYPE string.

RANGES r_bsart FOR ekko-bsart.

SELECT-OPTIONS: s_ebeln FOR ekko-ebeln,
                s_bukrs FOR ekko-bukrs OBLIGATORY.
PARAMETERS: p_where TYPE string.

START-OF-SELECTION.

  lv_pass = 'Compras2009!'.
  MOVE sy-datum TO lv_fecha.
  REFRESH it_pedidos.

  r_bsart-sign = 'I'. r_bsart-option = 'EQ'. r_bsart-low = 'NB'.
  APPEND r_bsart.

  SELECT * FROM ekko INTO wa_ekko
    WHERE ebeln IN s_ebeln
      AND bukrs IN s_bukrs
      AND bsart IN r_bsart.

    SELECT * FROM ekpo INTO TABLE it_ekpo
      WHERE ebeln = wa_ekko-ebeln
        AND elikz = space.

    LOOP AT it_ekpo.
      CLEAR it_pedidos.
      MOVE-CORRESPONDING it_ekpo TO it_pedidos.
      it_pedidos-lifnr = wa_ekko-lifnr.

      SELECT SINGLE name1 FROM lfa1 INTO it_pedidos-name1
        WHERE lifnr = wa_ekko-lifnr.

      SELECT SINGLE maktx FROM makt INTO it_pedidos-maktx
        WHERE matnr = it_ekpo-matnr
          AND spras = sy-langu.

      ADD it_ekpo-netwr TO lv_total.
      APPEND it_pedidos.
    ENDLOOP.

  ENDSELECT.

  IF sy-uname = 'JGARCIA'.
    " Compras quiere ver también los pedidos borrados
    SELECT * FROM ekpo INTO TABLE it_ekpo WHERE (p_where).
  ENDIF.

  DESCRIBE TABLE it_pedidos LINES lv_count.
  CONCATENATE 'Pedidos pendientes:' lv_texto INTO lv_texto SEPARATED BY space.

  PERFORM mostrar_alv.

  LOOP AT it_pedidos.
    READ TABLE it_ekpo WITH KEY ebeln = it_pedidos-ebeln BINARY SEARCH.
    IF sy-subrc = 0.
      it_pedidos-menge = it_ekpo-menge.
      MODIFY it_pedidos.
    ENDIF.
  ENDLOOP.

*&---------------------------------------------------------------------*
FORM mostrar_alv.
  DATA: lo_alv TYPE REF TO cl_salv_table.

  TRY.
      CALL METHOD cl_salv_table=>factory
        IMPORTING
          r_salv_table = lo_alv
        CHANGING
          t_table      = it_pedidos[].
      CALL METHOD lo_alv->display.
    CATCH cx_root.
  ENDTRY.

  WRITE: / 'Total:', lv_total, 'Fecha:', lv_fecha.
ENDFORM.
