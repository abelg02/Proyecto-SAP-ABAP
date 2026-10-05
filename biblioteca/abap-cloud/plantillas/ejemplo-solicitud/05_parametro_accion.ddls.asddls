@EndUserText.label: 'Parámetro de la acción changeStatus'
define abstract entity ZDD_REQUEST_STAT_PRM
{
  @EndUserText.label: 'Nuevo estado'
  NewStatus : abap.char(2);
  @EndUserText.label: 'Comentario'
  Comment   : abap.char(200);
}
