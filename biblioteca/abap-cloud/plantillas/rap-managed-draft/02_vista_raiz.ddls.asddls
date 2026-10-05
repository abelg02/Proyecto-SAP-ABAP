@AccessControl.authorizationCheck: #CHECK
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
