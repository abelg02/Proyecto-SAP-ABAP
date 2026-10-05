@AccessControl.authorizationCheck: #CHECK
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
