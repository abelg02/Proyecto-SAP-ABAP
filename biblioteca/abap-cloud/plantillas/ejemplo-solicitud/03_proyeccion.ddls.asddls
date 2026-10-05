@AccessControl.authorizationCheck: #CHECK
@Metadata.allowExtensions: true
@Search.searchable: true
@EndUserText.label: 'Solicitud - proyección'
define root view entity ZC_REQUEST_ABK
  provider contract transactional_query
  as projection on ZR_REQUEST_ABK
{
  key RequestUUID,
      @Search.defaultSearchElement: true
      RequestId,
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
