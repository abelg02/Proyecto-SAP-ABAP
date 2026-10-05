" Implementación local del behavior pool ZBP_R_REQUEST_ABK
" La clase global solo lleva:
"   CLASS ZBP_R_REQUEST_ABK DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF ZR_REQUEST_ABK.
"   ENDCLASS.
"   CLASS ZBP_R_REQUEST_ABK IMPLEMENTATION.
"   ENDCLASS.

CLASS lhc_Request DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    CONSTANTS: BEGIN OF c_status,
                 open        TYPE c LENGTH 2 VALUE 'OP',
                 in_progress TYPE c LENGTH 2 VALUE 'IP',
                 completed   TYPE c LENGTH 2 VALUE 'CO',
                 canceled    TYPE c LENGTH 2 VALUE 'CN',
               END OF c_status.

    METHODS get_instance_features FOR INSTANCE FEATURES
      IMPORTING keys REQUEST requested_features FOR Request RESULT result.

    METHODS get_instance_authorizations FOR INSTANCE AUTHORIZATION
      IMPORTING keys REQUEST requested_authorizations FOR Request RESULT result.

    METHODS changeStatus FOR MODIFY
      IMPORTING keys FOR ACTION Request~changeStatus RESULT result.

    METHODS setDefaults FOR DETERMINE ON MODIFY
      IMPORTING keys FOR Request~setDefaults.

    METHODS validateMandatory FOR VALIDATE ON SAVE
      IMPORTING keys FOR Request~validateMandatory.

    METHODS validateDueDate FOR VALIDATE ON SAVE
      IMPORTING keys FOR Request~validateDueDate.
ENDCLASS.


CLASS lhc_Request IMPLEMENTATION.

  METHOD get_instance_features.
    READ ENTITIES OF ZR_REQUEST_ABK IN LOCAL MODE
      ENTITY Request FIELDS ( Status ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    result = VALUE #( FOR ls_data IN lt_data
                      LET is_closed = xsdbool( ls_data-Status = c_status-completed OR ls_data-Status = c_status-canceled )
                          is_open   = xsdbool( ls_data-Status = c_status-open )
                      IN ( %tky                 = ls_data-%tky
                           %update              = COND #( WHEN is_closed = abap_true THEN if_abap_behv=>fc-o-disabled ELSE if_abap_behv=>fc-o-enabled )
                           %delete              = COND #( WHEN is_open   = abap_true THEN if_abap_behv=>fc-o-enabled  ELSE if_abap_behv=>fc-o-disabled )
                           %action-changeStatus = COND #( WHEN is_closed = abap_true THEN if_abap_behv=>fc-o-disabled ELSE if_abap_behv=>fc-o-enabled ) ) ).
  ENDMETHOD.


  METHOD get_instance_authorizations.
    " Plantilla: autoriza todo. Sustituir por AUTHORITY-CHECK OBJECT 'Z...' o por
    " una comprobación de creador / responsable, como en el proyecto de incidencias.
    result = VALUE #( FOR ls_key IN keys ( %tky                 = ls_key-%tky
                                          %update              = if_abap_behv=>auth-allowed
                                          %delete              = if_abap_behv=>auth-allowed
                                          %action-changeStatus = if_abap_behv=>auth-allowed ) ).
  ENDMETHOD.


  METHOD changeStatus.
    READ ENTITIES OF ZR_REQUEST_ABK IN LOCAL MODE
      ENTITY Request FIELDS ( Status ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    LOOP AT lt_data INTO DATA(ls_data).
      DATA(ls_param) = keys[ KEY id %tky = ls_data-%tky ]-%param.

      " Regla de ejemplo: de 'Abierto' no se salta directamente a 'Completado'
      IF ls_data-Status = c_status-open AND ls_param-NewStatus = c_status-completed.
        APPEND VALUE #( %tky = ls_data-%tky ) TO failed-Request.
        APPEND VALUE #( %tky = ls_data-%tky
                        %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                                      text     = |No se puede pasar de { ls_data-Status } a { ls_param-NewStatus }| ) )
               TO reported-Request.
        CONTINUE.
      ENDIF.

      MODIFY ENTITIES OF ZR_REQUEST_ABK IN LOCAL MODE
        ENTITY Request UPDATE FIELDS ( Status )
        WITH VALUE #( ( %tky = ls_data-%tky Status = ls_param-NewStatus ) ).
    ENDLOOP.

    READ ENTITIES OF ZR_REQUEST_ABK IN LOCAL MODE
      ENTITY Request ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(lt_result).

    result = VALUE #( FOR ls_res IN lt_result ( %tky = ls_res-%tky %param = ls_res ) ).
  ENDMETHOD.


  METHOD setDefaults.
    READ ENTITIES OF ZR_REQUEST_ABK IN LOCAL MODE
      ENTITY Request FIELDS ( RequestId Status ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    DELETE lt_data WHERE RequestId IS NOT INITIAL.
    CHECK lt_data IS NOT INITIAL.

    " En productivo usa un rango de números (ZCL_ABK_NUMBER_RANGE). MAX + 1 vale para formación.
    SELECT SINGLE FROM ZDT_REQUEST_AB FIELDS MAX( request_id ) INTO @DATA(lv_max).

    MODIFY ENTITIES OF ZR_REQUEST_ABK IN LOCAL MODE
      ENTITY Request UPDATE FIELDS ( RequestId Status )
      WITH VALUE #( FOR ls_data IN lt_data INDEX INTO lv_index
                    ( %tky   = ls_data-%tky
                      RequestId = lv_max + lv_index
                      Status = c_status-open ) ).
  ENDMETHOD.


  METHOD validateMandatory.
    READ ENTITIES OF ZR_REQUEST_ABK IN LOCAL MODE
      ENTITY Request FIELDS ( Title Priority ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    LOOP AT lt_data INTO DATA(ls_data).
      APPEND VALUE #( %tky = ls_data-%tky %state_area = 'MANDATORY' ) TO reported-Request.

      IF ls_data-Title IS INITIAL OR ls_data-Priority IS INITIAL.
        APPEND VALUE #( %tky = ls_data-%tky ) TO failed-Request.
        APPEND VALUE #( %tky              = ls_data-%tky
                        %state_area       = 'MANDATORY'
                        %element-Title    = COND #( WHEN ls_data-Title    IS INITIAL THEN if_abap_behv=>mk-on )
                        %element-Priority = COND #( WHEN ls_data-Priority IS INITIAL THEN if_abap_behv=>mk-on )
                        %msg              = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                                                   text     = `Título y prioridad son obligatorios` ) )
               TO reported-Request.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.


  METHOD validateDueDate.
    READ ENTITIES OF ZR_REQUEST_ABK IN LOCAL MODE
      ENTITY Request FIELDS ( DueDate ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    DATA(lv_today) = cl_abap_context_info=>get_system_date( ).

    LOOP AT lt_data INTO DATA(ls_data) WHERE DueDate IS NOT INITIAL AND DueDate < lv_today.
      APPEND VALUE #( %tky = ls_data-%tky ) TO failed-Request.
      APPEND VALUE #( %tky             = ls_data-%tky
                      %element-DueDate = if_abap_behv=>mk-on
                      %msg             = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                                                text     = `La fecha límite no puede estar en el pasado` ) )
             TO reported-Request.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
