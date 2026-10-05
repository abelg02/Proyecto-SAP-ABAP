/*
 * Plantillas de un BO RAP gestionado con draft.
 * Se usan en dos sitios:
 *   - web/herramientas/generadores.html (genera los ficheros con los nombres que pongas)
 *   - biblioteca/scripts/generar-plantillas.mjs (escribe la versión con marcadores {{...}})
 */
(function (root) {
  const files = {
    '01_tabla.ddic.txt': `@EndUserText.label : '{{DESCRIPCION}} - tabla activa'
@AbapCatalog.enhancement.category : #NOT_EXTENSIBLE
@AbapCatalog.tableCategory : #TRANSPARENT
@AbapCatalog.deliveryClass : #A
@AbapCatalog.dataMaintenance : #RESTRICTED
define table {{TABLA}} {
  key client            : abap.clnt not null;
  key {{CLAVE_DB}}      : sysuuid_x16 not null;
  {{ID_DB}}             : abap.numc(10);
  title                 : abap.char(60);
  description           : abap.string(0);
  status                : abap.char(2);
  priority              : abap.char(1);
  @Semantics.amount.currencyCode : '{{TABLA}}.currency'
  amount                : abap.curr(15,2);
  currency              : abap.cuky;
  due_date              : abap.dats;
  local_created_by      : abp_creation_user;
  local_created_at      : abp_creation_tstmpl;
  local_last_changed_by : abp_locinst_lastchange_user;
  local_last_changed_at : abp_locinst_lastchange_tstmpl;
  last_changed_at       : abp_lastchange_tstmpl;
}
`,

    '02_vista_raiz.ddls.asddls': `@AccessControl.authorizationCheck: #CHECK
@EndUserText.label: '{{DESCRIPCION}} - vista raíz'
define root view entity {{R_VIEW}}
  as select from {{TABLA}}
  association [0..1] to I_Currency as _Currency on $projection.Currency = _Currency.Currency
{
  key {{CLAVE_DB}}             as {{CLAVE}},
      {{ID_DB}}                as {{ID}},
      title                    as Title,
      description              as Description,
      status                   as Status,
      priority                 as Priority,
      @Semantics.amount.currencyCode: 'Currency'
      amount                   as Amount,
      currency                 as Currency,
      due_date                 as DueDate,

      // Criticidad para colorear el estado en Fiori: 1 rojo, 2 amarillo, 3 verde, 0 gris
      case status
        when 'OP' then 2
        when 'IP' then 2
        when 'CO' then 3
        when 'CN' then 1
        else 0
      end                      as StatusCriticality,

      @Semantics.user.createdBy: true
      local_created_by         as LocalCreatedBy,
      @Semantics.systemDateTime.createdAt: true
      local_created_at         as LocalCreatedAt,
      @Semantics.user.localInstanceLastChangedBy: true
      local_last_changed_by    as LocalLastChangedBy,
      @Semantics.systemDateTime.localInstanceLastChangedAt: true
      local_last_changed_at    as LocalLastChangedAt,
      @Semantics.systemDateTime.lastChangedAt: true
      last_changed_at          as LastChangedAt,

      _Currency
}
`,

    '03_proyeccion.ddls.asddls': `@AccessControl.authorizationCheck: #CHECK
@Metadata.allowExtensions: true
@Search.searchable: true
@EndUserText.label: '{{DESCRIPCION}} - proyección'
define root view entity {{C_VIEW}}
  provider contract transactional_query
  as projection on {{R_VIEW}}
{
  key {{CLAVE}},
      @Search.defaultSearchElement: true
      {{ID}},
      @Search.defaultSearchElement: true
      @Search.fuzzinessThreshold: 0.8
      Title,
      Description,
      Status,
      Priority,
      Amount,
      @Consumption.valueHelpDefinition: [{ entity: { name: 'I_CurrencyStdVH', element: 'Currency' } }]
      Currency,
      DueDate,
      StatusCriticality,
      LocalCreatedBy,
      LocalCreatedAt,
      LocalLastChangedAt,
      LastChangedAt,
      _Currency
}
`,

    '04_metadata_extension.ddlx.asddlxs': `@Metadata.layer: #CORE
@UI: {
  headerInfo: { typeName: '{{DESCRIPCION}}',
                typeNamePlural: '{{DESCRIPCION_PLURAL}}',
                title: { type: #STANDARD, value: 'Title' },
                description: { value: '{{ID}}' } },
  presentationVariant: [{ sortOrder: [{ by: '{{ID}}', direction: #DESC }], visualizations: [{ type: #AS_LINEITEM }] }]
}
annotate entity {{C_VIEW}} with
{
  @UI.facet: [ { id: 'General', purpose: #STANDARD, type: #IDENTIFICATION_REFERENCE, label: 'Datos generales', position: 10 } ]

  @UI.hidden: true
  {{CLAVE}};

  @UI: { lineItem: [{ position: 10 }], identification: [{ position: 10 }], selectionField: [{ position: 10 }] }
  {{ID}};

  @UI: { lineItem: [{ position: 20 }], identification: [{ position: 20 }] }
  Title;

  @UI: { identification: [{ position: 30 }], multiLineText: true }
  Description;

  @UI: { lineItem: [{ position: 40, criticality: 'StatusCriticality' },
                    { type: #FOR_ACTION, dataAction: 'changeStatus', label: 'Cambiar estado' }],
         identification: [{ position: 40, criticality: 'StatusCriticality' },
                          { type: #FOR_ACTION, dataAction: 'changeStatus', label: 'Cambiar estado' }],
         selectionField: [{ position: 20 }] }
  Status;

  @UI: { lineItem: [{ position: 50 }], identification: [{ position: 50 }], selectionField: [{ position: 30 }] }
  Priority;

  @UI: { lineItem: [{ position: 60 }], identification: [{ position: 60 }] }
  Amount;

  @UI: { lineItem: [{ position: 70 }], identification: [{ position: 70 }] }
  DueDate;

  @UI.hidden: true
  StatusCriticality;
}
`,

    '05_parametro_accion.ddls.asddls': `@EndUserText.label: 'Parámetro de la acción changeStatus'
define abstract entity {{PARAM}}
{
  @EndUserText.label: 'Nuevo estado'
  NewStatus : abap.char(2);
  @EndUserText.label: 'Comentario'
  Comment   : abap.char(200);
}
`,

    '06_bdef_raiz.bdef.asbdef': `managed implementation in class {{BP_CLASS}} unique;
strict ( 2 );
with draft;

define behavior for {{R_VIEW}} alias {{ALIAS}}
persistent table {{TABLA}}
draft table {{TABLA_DRAFT}}
etag master LocalLastChangedAt
lock master total etag LastChangedAt
authorization master ( instance )
{
  field ( readonly, numbering : managed ) {{CLAVE}};
  field ( readonly ) {{ID}}, Status, StatusCriticality,
                     LocalCreatedBy, LocalCreatedAt, LocalLastChangedBy, LocalLastChangedAt, LastChangedAt;
  field ( mandatory ) Title, Priority;

  create;
  update ( features : instance );
  delete ( features : instance );

  action ( features : instance ) changeStatus parameter {{PARAM}} result [1] $self;

  determination setDefaults on modify { create; }

  validation validateMandatory on save { create; field Title, Priority; }
  validation validateDueDate   on save { create; field DueDate; }

  side effects { action changeStatus affects $self; }

  draft action Resume;
  draft action Edit;
  draft action Activate optimized;
  draft action Discard;

  draft determine action Prepare
  {
    validation validateMandatory;
    validation validateDueDate;
  }

  mapping for {{TABLA}}
  {
    {{CLAVE}}          = {{CLAVE_DB}};
    {{ID}}             = {{ID_DB}};
    Title              = title;
    Description        = description;
    Status             = status;
    Priority           = priority;
    Amount             = amount;
    Currency           = currency;
    DueDate            = due_date;
    LocalCreatedBy     = local_created_by;
    LocalCreatedAt     = local_created_at;
    LocalLastChangedBy = local_last_changed_by;
    LocalLastChangedAt = local_last_changed_at;
    LastChangedAt      = last_changed_at;
  }
}
`,

    '07_bdef_proyeccion.bdef.asbdef': `projection;
strict ( 2 );
use draft;
use side effects;

define behavior for {{C_VIEW}} alias {{ALIAS}}
{
  use create;
  use update;
  use delete;

  use action changeStatus;

  use action Resume;
  use action Edit;
  use action Activate;
  use action Discard;
  use action Prepare;
}
`,

    '08_behavior_pool.clas.locals_imp.abap': `" Implementación local del behavior pool {{BP_CLASS}}
" La clase global solo lleva:
"   CLASS {{BP_CLASS}} DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF {{R_VIEW}}.
"   ENDCLASS.
"   CLASS {{BP_CLASS}} IMPLEMENTATION.
"   ENDCLASS.

CLASS lhc_{{ALIAS}} DEFINITION INHERITING FROM cl_abap_behavior_handler.
  PRIVATE SECTION.
    CONSTANTS: BEGIN OF c_status,
                 open        TYPE c LENGTH 2 VALUE 'OP',
                 in_progress TYPE c LENGTH 2 VALUE 'IP',
                 completed   TYPE c LENGTH 2 VALUE 'CO',
                 canceled    TYPE c LENGTH 2 VALUE 'CN',
               END OF c_status.

    METHODS get_instance_features FOR INSTANCE FEATURES
      IMPORTING keys REQUEST requested_features FOR {{ALIAS}} RESULT result.

    METHODS get_instance_authorizations FOR INSTANCE AUTHORIZATION
      IMPORTING keys REQUEST requested_authorizations FOR {{ALIAS}} RESULT result.

    METHODS changeStatus FOR MODIFY
      IMPORTING keys FOR ACTION {{ALIAS}}~changeStatus RESULT result.

    METHODS setDefaults FOR DETERMINE ON MODIFY
      IMPORTING keys FOR {{ALIAS}}~setDefaults.

    METHODS validateMandatory FOR VALIDATE ON SAVE
      IMPORTING keys FOR {{ALIAS}}~validateMandatory.

    METHODS validateDueDate FOR VALIDATE ON SAVE
      IMPORTING keys FOR {{ALIAS}}~validateDueDate.
ENDCLASS.


CLASS lhc_{{ALIAS}} IMPLEMENTATION.

  METHOD get_instance_features.
    READ ENTITIES OF {{R_VIEW}} IN LOCAL MODE
      ENTITY {{ALIAS}} FIELDS ( Status ) WITH CORRESPONDING #( keys )
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
    READ ENTITIES OF {{R_VIEW}} IN LOCAL MODE
      ENTITY {{ALIAS}} FIELDS ( Status ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    LOOP AT lt_data INTO DATA(ls_data).
      DATA(ls_param) = keys[ KEY id %tky = ls_data-%tky ]-%param.

      " Regla de ejemplo: de 'Abierto' no se salta directamente a 'Completado'
      IF ls_data-Status = c_status-open AND ls_param-NewStatus = c_status-completed.
        APPEND VALUE #( %tky = ls_data-%tky ) TO failed-{{ALIAS}}.
        APPEND VALUE #( %tky = ls_data-%tky
                        %msg = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                                      text     = |No se puede pasar de { ls_data-Status } a { ls_param-NewStatus }| ) )
               TO reported-{{ALIAS}}.
        CONTINUE.
      ENDIF.

      MODIFY ENTITIES OF {{R_VIEW}} IN LOCAL MODE
        ENTITY {{ALIAS}} UPDATE FIELDS ( Status )
        WITH VALUE #( ( %tky = ls_data-%tky Status = ls_param-NewStatus ) ).
    ENDLOOP.

    READ ENTITIES OF {{R_VIEW}} IN LOCAL MODE
      ENTITY {{ALIAS}} ALL FIELDS WITH CORRESPONDING #( keys )
      RESULT DATA(lt_result).

    result = VALUE #( FOR ls_res IN lt_result ( %tky = ls_res-%tky %param = ls_res ) ).
  ENDMETHOD.


  METHOD setDefaults.
    READ ENTITIES OF {{R_VIEW}} IN LOCAL MODE
      ENTITY {{ALIAS}} FIELDS ( {{ID}} Status ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    DELETE lt_data WHERE {{ID}} IS NOT INITIAL.
    CHECK lt_data IS NOT INITIAL.

    " En productivo usa un rango de números (ZCL_ABK_NUMBER_RANGE). MAX + 1 vale para formación.
    SELECT SINGLE FROM {{TABLA}} FIELDS MAX( {{ID_DB}} ) INTO @DATA(lv_max).

    MODIFY ENTITIES OF {{R_VIEW}} IN LOCAL MODE
      ENTITY {{ALIAS}} UPDATE FIELDS ( {{ID}} Status )
      WITH VALUE #( FOR ls_data IN lt_data INDEX INTO lv_index
                    ( %tky   = ls_data-%tky
                      {{ID}} = lv_max + lv_index
                      Status = c_status-open ) ).
  ENDMETHOD.


  METHOD validateMandatory.
    READ ENTITIES OF {{R_VIEW}} IN LOCAL MODE
      ENTITY {{ALIAS}} FIELDS ( Title Priority ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    LOOP AT lt_data INTO DATA(ls_data).
      APPEND VALUE #( %tky = ls_data-%tky %state_area = 'MANDATORY' ) TO reported-{{ALIAS}}.

      IF ls_data-Title IS INITIAL OR ls_data-Priority IS INITIAL.
        APPEND VALUE #( %tky = ls_data-%tky ) TO failed-{{ALIAS}}.
        APPEND VALUE #( %tky              = ls_data-%tky
                        %state_area       = 'MANDATORY'
                        %element-Title    = COND #( WHEN ls_data-Title    IS INITIAL THEN if_abap_behv=>mk-on )
                        %element-Priority = COND #( WHEN ls_data-Priority IS INITIAL THEN if_abap_behv=>mk-on )
                        %msg              = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                                                   text     = \`Título y prioridad son obligatorios\` ) )
               TO reported-{{ALIAS}}.
      ENDIF.
    ENDLOOP.
  ENDMETHOD.


  METHOD validateDueDate.
    READ ENTITIES OF {{R_VIEW}} IN LOCAL MODE
      ENTITY {{ALIAS}} FIELDS ( DueDate ) WITH CORRESPONDING #( keys )
      RESULT DATA(lt_data).

    DATA(lv_today) = cl_abap_context_info=>get_system_date( ).

    LOOP AT lt_data INTO DATA(ls_data) WHERE DueDate IS NOT INITIAL AND DueDate < lv_today.
      APPEND VALUE #( %tky = ls_data-%tky ) TO failed-{{ALIAS}}.
      APPEND VALUE #( %tky             = ls_data-%tky
                      %element-DueDate = if_abap_behv=>mk-on
                      %msg             = new_message_with_text( severity = if_abap_behv_message=>severity-error
                                                                text     = \`La fecha límite no puede estar en el pasado\` ) )
             TO reported-{{ALIAS}}.
    ENDLOOP.
  ENDMETHOD.

ENDCLASS.
`,

    '09_service.srvd.assrvd': `@EndUserText.label: '{{DESCRIPCION}} - servicio'
define service {{SERVICE}} {
  expose {{C_VIEW}} as {{ALIAS}};
}
`
  };

  /* Construye los nombres de todos los objetos a partir de prefijo + entidad */
  function names(prefix, entity, desc, descPlural) {
    const P = prefix.toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const E = entity.replace(/[^A-Za-z0-9]/g, '');
    const EU = E.toUpperCase();
    const snake = E.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
    return {
      TABLA: `ZDT_${EU}_${P}`.slice(0, 14),
      TABLA_DRAFT: `ZDT_${EU}_${P}`.slice(0, 14) + '_D',
      CLAVE_DB: `${snake}_uuid`.slice(0, 30),
      CLAVE: `${E}UUID`,
      ID_DB: `${snake}_id`.slice(0, 30),
      ID: `${E}Id`,
      R_VIEW: `ZR_${EU}_${P}`.slice(0, 30),
      C_VIEW: `ZC_${EU}_${P}`.slice(0, 30),
      ALIAS: E,
      PARAM: `ZDD_${EU}_STAT_PRM`.slice(0, 30),
      BP_CLASS: `ZBP_R_${EU}_${P}`.slice(0, 30),
      SERVICE: `ZUI_${EU}_${P}`.slice(0, 30),
      DESCRIPCION: desc || E,
      DESCRIPCION_PLURAL: descPlural || (desc ? desc + 's' : E + 's')
    };
  }

  function generate(values) {
    const out = {};
    for (const [file, tpl] of Object.entries(files)) {
      out[file] = tpl.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in values ? values[k] : m));
    }
    return out;
  }

  root.RapTemplates = { files, names, generate };
})(typeof window !== 'undefined' ? window : globalThis);
