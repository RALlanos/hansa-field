# Entradas operativas

El frontend activo es `app/page.tsx` → `OperationalWorkspace`.
Templates, Apps, Proyectos, Cajones, Registros, Importar, Mapa Universal y
Segmentación se abren desde ese menú. `/segmentation` administra el contexto
explícito de una App o Proyecto, sin cargar el shell retirado.

La API activa registra Health, Operational y Segmentation. Las operaciones de
datos usan `/api/workspace`, Templates `/api/workspace/templates`, importaciones
`/api/workspace/imports` y Segmentación `/api/segmentation`.

Mapa y tabla utilizan el mismo alcance `mode`, `appIds`, `projectIds`,
`localCollectionIds` y `bbox`; tabla admite adicionalmente `cursor` y `limit`.
El endpoint de listado entrega `data`, `totalRecords` y `nextCursor`.
El detalle del editor se obtiene antes de editar para no confundir geometría
visual con geometría efectiva.

Los enlaces antiguos reconocidos de `/apps` redirigen al contexto nuevo. No
existen páginas ni controladores paralelos para el modelo retirado. Las piezas
reutilizadas (constructor, símbolos, validación de geometría e inspección ZIP)
se conservan porque el sistema activo las importa.

Esta retirada no modifica la base de datos. Las funciones de las pantallas
retiradas que no existen en el piloto (por ejemplo exportación y consolidación
avanzadas) no se consideran migradas por eliminar su código. Su recuperación
requiere implementación explícita sobre Dataset, no reactivar los endpoints
retirados.
