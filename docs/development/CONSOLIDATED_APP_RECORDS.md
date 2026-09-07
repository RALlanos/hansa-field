# Consulta consolidada de Apps maestras

`GET /api/apps/:appId/records` consulta participaciones activas mediante
`project_apps.app_id`, no mediante la pertenencia del record canónico.
Filtros: `projectId`, `projectAppIds` separados por comas y `search`.
Paginación: `page` y `pageSize` (máximo 100). Cada fila conserva
`recordUuid`, `projectRecordUuid`, `projectAppId`, contexto de proyecto y
valores efectivos producidos por `resolveEffectiveRecord`.

`GET /api/apps/:appId/records/metadata` une los campos de las versiones
actuales de Project Apps por identidad estructural `id`. Cada columna indica
la clave técnica aplicable en cada Project App. La UI muestra N/A si no existe
correspondencia y — si el campo existe sin valor; no mezcla atributos.

`GET /api/apps/:appId/records/map` añade `bbox` y `zoom`, mantiene los mismos
filtros y utiliza la geometría visual efectiva. Por debajo de zoom 18 devuelve
agregados espaciales por Project App (máximo 2.000); al acercarse devuelve
participaciones con sus identidades (máximo 10.000). `truncated` indica que se
alcanzó el límite. No se descargan todos los registros para paginar la tabla.

La pantalla es de consulta; no ofrece escrituras canónicas. Las pruebas del
servicio utilizan un esquema PostGIS temporal, aislado de los datos operativos.
