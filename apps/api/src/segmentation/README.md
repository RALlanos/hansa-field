# Segmentación

Administración opcional en `/segmentation?appId=UUID` o
`/segmentation?projectId=UUID`. API: `/api/segmentation`.

Cada esquema pertenece exclusivamente a una App o Proyecto. Los niveles tienen
UUID estable y orden independiente del nombre. Los segmentos forman un árbol;
el padre debe pertenecer al mismo esquema y a un nivel anterior. Las operaciones
estructurales se serializan bloqueando el esquema. Archivar no elimina datos.

Las asignaciones de App apuntan a `records.id`; las de Proyecto a
`project_records.id`, incluidas las colecciones locales. Una restricción de base
verifica el contexto. Retirar una asignación no borra el registro. Los ancestros
se resuelven recursivamente, sin copiar asignaciones ni atributos.

La importación CSV/TSV mapea columnas a niveles existentes: preview y confirmación
usan `expectedRevision`. Un cambio estructural invalida el preview. Los nombres
hermanos existentes se reutilizan; las nuevas rutas se crean en una transacción.
Esta importación no mapea metadata adicional: niveles con metadata obligatoria
requieren creación individual por ahora. Límite por envío: 20.000 filas.

`segmentationColumnMapping` prepara el destino de columnas para una futura
integración con el importador de Records, que no se modifica aquí.

Los permisos almacenan principal de usuario/rol, permiso e inclusión de
descendientes. Su resolución está disponible por API; no constituye un IAM ni
activa autorización en otros módulos. Se conserva el contexto organizacional
local del backend existente. La geometría opcional es GeoJSON/PostGIS SRID 4326;
no se conecta a los mapas.

Migración aditiva: `0002_segmentation`. No necesita reset ni datos iniciales.
