# Plantilla RAP gestionado con draft

Un Business Object completo de una entidad, listo para una app Fiori Elements (List Report + Object Page).
Es el mismo esquema del proyecto de Gestión de Incidencias, reducido a lo que se repite en casi todos los BO.

- `rap-managed-draft/`: los 9 ficheros con marcadores `{{...}}`.
- `ejemplo-solicitud/`: los mismos ficheros ya rellenados para una entidad `Request` con prefijo `ABK`.

La forma rápida de rellenarla es el generador de la web (`web/herramientas/generadores.html`): escribes prefijo y entidad y te devuelve los 9 ficheros.
Para regenerar estas carpetas: `node biblioteca/scripts/generar-plantillas.mjs`.

## Marcadores

| Marcador | Ejemplo | Qué es |
|---|---|---|
| `{{TABLA}}` | `ZDT_REQUEST_AB` | Tabla activa (máx. 16 caracteres) |
| `{{TABLA_DRAFT}}` | `ZDT_REQUEST_AB_D` | Tabla de borradores |
| `{{CLAVE_DB}}` / `{{CLAVE}}` | `request_uuid` / `RequestUUID` | Clave UUID en base de datos y en CDS |
| `{{ID_DB}}` / `{{ID}}` | `request_id` / `RequestId` | Número legible |
| `{{R_VIEW}}` / `{{C_VIEW}}` | `ZR_REQUEST_ABK` / `ZC_REQUEST_ABK` | Vista raíz y proyección |
| `{{ALIAS}}` | `Request` | Alias de la entidad en la BDEF |
| `{{PARAM}}` | `ZDD_REQUEST_STAT_PRM` | Entidad abstracta del parámetro de la acción |
| `{{BP_CLASS}}` | `ZBP_R_REQUEST_ABK` | Behavior pool |
| `{{SERVICE}}` | `ZUI_REQUEST_ABK` | Service definition |
| `{{DESCRIPCION}}` | `Solicitud` | Texto de etiquetas |

## Orden de creación en ADT

1. Tabla `01` y activar.
2. Vistas `02`, `03` y entidad abstracta `05`; activar.
3. BDEF `06`. Ctrl+1 sobre `draft table` para generar la tabla draft y Ctrl+1 sobre el nombre de la clase para crear el behavior pool.
4. Pegar `08` en la pestaña *Local Types* del behavior pool y activar.
5. BDEF de proyección `07` y metadata extension `04`.
6. Service definition `09`. Botón derecho, *New Service Binding*, tipo `OData V4 - UI`, *Publish* y *Preview*.

## Qué incluye

- Numeración UUID gestionada y número legible por determinación.
- Draft, ETag y bloqueo total.
- Acción con parámetro y `features : instance`: deshabilitada en estados cerrados.
- Validaciones con `%state_area` y `%element`, para que Fiori marque el campo erróneo.
- Side effects para refrescar la página tras la acción.
- Criticidad del estado y campos de auditoría con `@Semantics`.
