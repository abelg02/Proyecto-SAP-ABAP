# ABAP Toolkit (prefijo ZABK)

Biblioteca gratuita y de código abierto (licencia MIT) con clases y plantillas ABAP para tareas que se repiten en casi todos los proyectos: logs, emails, llamadas HTTP, JSON, Excel, jobs, ficheros, BAPIs, ALV, textos largos y el esqueleto de un Business Object RAP.

Dos paquetes, porque los sistemas SAP están partidos en dos:

| Paquete | Para qué sistemas | Contenido |
|---|---|---|
| `abap-cloud/` | SAP BTP ABAP Environment, S/4HANA Cloud Public Edition y desarrollos clean core en Private Edition u on-premise 2022+ | Solo APIs liberadas (released) |
| `abap-clasico/` | ECC 6.0 (ABAP 7.40 o superior) y S/4HANA on-premise | ALV, BAPIs, ficheros, Excel, jobs, SLG1, textos largos. Sintaxis moderna, sin FORM ni cabeceras de tabla |

## Contenido

### abap-cloud/src (12 objetos)
| Objeto | Qué hace |
|---|---|
| `ZCL_ABK_LOG` | Application log con `CL_BALI_*` en tres líneas: `create`, `info/warning/error/exception`, `save` |
| `ZCL_ABK_MAIL` | Email con `CL_BCS_MAIL_MESSAGE`, interfaz encadenada, HTML, CC, BCC y adjuntos |
| `ZCL_ABK_HTTP` | Cliente REST: por URL, destino de BTP o communication arrangement; GET, POST, PUT, DELETE, Basic y Bearer |
| `ZCL_ABK_JSON` | JSON con `/UI2/CL_JSON` (camelCase, ISO 8601) y lectura de un valor por ruta |
| `ZCL_ABK_XLSX` | Leer y escribir Excel (XLSX) con XCO |
| `ZCL_ABK_APPJOB_TEMPLATE` | Plantilla de Application Job (proceso en fondo) con parámetros, log y prueba con F9 |
| `ZCX_ABK_RAP_MESSAGE` | Mensajes RAP con severidad para `REPORTED`: obligatorio, fechas, transición de estado, texto libre |
| `ZCL_ABK_CONTEXT` | Fecha, hora, usuario y zona horaria sin `sy-datum` ni `sy-uname` |
| `ZCL_ABK_NUMBER_RANGE` | Rangos de números con `CL_NUMBERRANGE_RUNTIME` (en lugar de `MAX + 1`) |
| `ZCL_ABK_STRING` | Email, ALPHA, acentos, title case, CSV con comillas, días laborables, fin de mes. Con 11 tests unitarios |
| `ZCL_ABK_ITAB` | Patrones de tablas internas: `GROUP BY`, `REDUCE`, `FOR ... WHERE`, rangos. Ejecutable con F9 |
| `ZCL_ABK_SQL_TEST_DEMO` | Plantilla de tests con dobles de tabla (`CL_OSQL_TEST_ENVIRONMENT`) y de CDS (`CL_CDS_TEST_ENVIRONMENT`) |

### abap-cloud/plantillas
BO RAP gestionado con draft (9 ficheros) con marcadores y un ejemplo relleno. Ver `plantillas/LEEME.md`.

### abap-clasico/src (8 objetos)
| Objeto | Qué hace |
|---|---|
| `ZCL_ABK_SALV` | ALV con `CL_SALV_TABLE` en una llamada: funciones, textos, totales, hotspot, popup, variantes |
| `ZCL_ABK_BAPI` | `BAPIRET2`: COMMIT AND WAIT solo si no hay errores, si no ROLLBACK; texto del primer error; popup |
| `ZCL_ABK_FILE` | CSV del PC y del servidor; CSV a tabla interna y tabla a CSV, con importes en formato español |
| `ZCL_ABK_EXCEL_UPLOAD` | Subir un XLSX del PC a una tabla interna con `CL_FDT_XL_SPREADSHEET` |
| `ZCL_ABK_LONGTEXT` | Textos largos (`READ_TEXT` / `SAVE_TEXT`) como string |
| `ZCL_ABK_JOB` | Lanzar un report Z en fondo con variante o parámetros y consultar su estado |
| `ZCL_ABK_BAL` | SLG1 con textos, mensajes, BAPIRET2 y excepciones encadenadas |
| `ZABK_R_CARGA_CSV` | Report de ejemplo que combina todo: fichero, validación en bloque, BAPI, log y ALV |

## Instalación

**Con abapGit (recomendado).** Crea un paquete (por ejemplo `ZABK_CLOUD` o `ZABK_CLASSIC`) y, en abapGit, elige *New Offline* e importa el ZIP del paquete, o *New Online* si lo subes a un repositorio de GitHub. En ABAP Cloud se usa abapGit desde ADT; on-premise, el report `ZABAPGIT`.

**A mano.** Crea cada clase en ADT o SE24 con el mismo nombre y pega el código. Los ficheros `*.testclasses.abap` van en la pestaña *Test Classes*.

**Requisitos de algunos objetos:**
- `ZCL_ABK_LOG`: objeto de Application Log (ADT, *Application Log Object*).
- `ZCL_ABK_MAIL`: escenario de comunicación `SAP_COM_0548` y dirección de remitente autorizada.
- `ZCX_ABK_RAP_MESSAGE`: clase de mensajes `ZABK_RAP` con los mensajes 001-006 (textos en la cabecera de la clase).
- `ZCL_ABK_NUMBER_RANGE`: objeto de rango de números y su intervalo `01`.
- `ZCL_ABK_APPJOB_TEMPLATE`: entrada de catálogo y plantilla de Application Job (pasos en la cabecera).
- `ZCL_ABK_SQL_TEST_DEMO`: cambia las tablas y vistas del ejemplo por las tuyas.

## Estado

El código está escrito con las APIs liberadas y la sintaxis moderna, y pasa CleanCore Check sin errores ni avisos, pero **no se ha activado todavía en un sistema SAP**. Si el compilador de tu versión pide algún ajuste (un nombre de parámetro, un tipo), suele ser cosa de minutos. Pruébalo siempre en desarrollo antes de transportarlo.

## Licencia
MIT: úsalo, modifícalo y compártelo libremente, también en proyectos de empresa. Ver `LICENSE`.
