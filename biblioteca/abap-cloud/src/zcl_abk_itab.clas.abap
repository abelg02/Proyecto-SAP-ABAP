"! <p class="shorttext synchronized">Patrones de tablas internas modernas (FOR, REDUCE, GROUP BY, rangos)</p>
"! Clase ejecutable (F9 en ADT, IF_OO_ADT_CLASSRUN). Cada método es un patrón que se
"! copia tal cual: agrupar, sumar, filtrar, convertir a rango, deduplicar y unir dos tablas.
CLASS zcl_abk_itab DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC.

  PUBLIC SECTION.
    INTERFACES if_oo_adt_classrun.

    TYPES: BEGIN OF ty_order,
             order_id TYPE n LENGTH 10,
             customer TYPE c LENGTH 10,
             country  TYPE land1,
             amount   TYPE p LENGTH 15 DECIMALS 2,
             currency TYPE waers,
           END OF ty_order,
           tt_orders TYPE SORTED TABLE OF ty_order WITH UNIQUE KEY order_id
                     WITH NON-UNIQUE SORTED KEY by_customer COMPONENTS customer.

    TYPES: BEGIN OF ty_total,
             customer TYPE c LENGTH 10,
             orders   TYPE i,
             amount   TYPE p LENGTH 15 DECIMALS 2,
           END OF ty_total,
           tt_totals TYPE STANDARD TABLE OF ty_total WITH EMPTY KEY.

    TYPES tt_customer_range TYPE RANGE OF ty_order-customer.

    "! Total y número de pedidos por cliente (LOOP AT GROUP / REDUCE)
    METHODS totals_by_customer
      IMPORTING it_orders        TYPE tt_orders
      RETURNING VALUE(rt_totals) TYPE tt_totals.

    "! Pedidos de los clientes indicados (FOR ... WHERE ... IN rango)
    METHODS orders_of_customers
      IMPORTING it_orders        TYPE tt_orders
                it_customers     TYPE tt_customer_range
      RETURNING VALUE(rt_result) TYPE tt_orders.

    "! Convierte una lista de valores en un RANGE para WHERE ... IN
    METHODS to_range
      IMPORTING it_customers    TYPE string_table
      RETURNING VALUE(rt_range) TYPE tt_customer_range.

    "! Suma total con REDUCE
    METHODS grand_total
      IMPORTING it_orders       TYPE tt_orders
      RETURNING VALUE(rv_total) TYPE ty_order-amount.

  PRIVATE SECTION.
    METHODS sample_data
      RETURNING VALUE(rt_orders) TYPE tt_orders.
ENDCLASS.



CLASS zcl_abk_itab IMPLEMENTATION.

  METHOD if_oo_adt_classrun~main.
    DATA(lt_orders) = sample_data( ).

    out->write( `Totales por cliente:` ).
    out->write( totals_by_customer( lt_orders ) ).

    out->write( `Pedidos de C001 y C003:` ).
    out->write( orders_of_customers( it_orders    = lt_orders
                                     it_customers = to_range( VALUE #( ( `C001` ) ( `C003` ) ) ) ) ).

    out->write( |Total general: { grand_total( lt_orders ) }| ).
  ENDMETHOD.


  METHOD totals_by_customer.
    LOOP AT it_orders INTO DATA(ls_order)
         GROUP BY ( customer = ls_order-customer
                    size     = GROUP SIZE )
         ASCENDING
         INTO DATA(ls_group).

      APPEND VALUE #( customer = ls_group-customer
                      orders   = ls_group-size
                      amount   = REDUCE #( INIT lv_sum TYPE ty_order-amount
                                           FOR ls_member IN GROUP ls_group
                                           NEXT lv_sum += ls_member-amount ) ) TO rt_totals.
    ENDLOOP.
  ENDMETHOD.


  METHOD orders_of_customers.
    rt_result = VALUE #( FOR ls_order IN it_orders WHERE ( customer IN it_customers ) ( ls_order ) ).
  ENDMETHOD.


  METHOD to_range.
    rt_range = VALUE #( FOR lv_customer IN it_customers
                        ( sign = 'I' option = 'EQ' low = lv_customer ) ).
  ENDMETHOD.


  METHOD grand_total.
    rv_total = REDUCE #( INIT lv_sum TYPE ty_order-amount
                         FOR ls_order IN it_orders
                         NEXT lv_sum += ls_order-amount ).
  ENDMETHOD.


  METHOD sample_data.
    rt_orders = VALUE #( currency = 'EUR'
                         ( order_id = '1' customer = 'C001' country = 'ES' amount = '120.50' )
                         ( order_id = '2' customer = 'C002' country = 'PT' amount = '80.00' )
                         ( order_id = '3' customer = 'C001' country = 'ES' amount = '45.25' )
                         ( order_id = '4' customer = 'C003' country = 'FR' amount = '300.00' )
                         ( order_id = '5' customer = 'C002' country = 'PT' amount = '19.99' ) ).
  ENDMETHOD.

ENDCLASS.
