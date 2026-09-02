# Línea base de descubrimiento: ERP y datos de Hansa Field

## Alcance de la revisión

Esta revisión es de solo lectura. Su objetivo es identificar restricciones, capacidades reutilizables y diferencias relevantes para Hansa Field. No convierte el código actual del ERP ni los archivos recibidos en requisitos obligatorios.

## Infraestructura confirmada

- Hansa dispone de infraestructura en la nube ubicada en Miami.
- El entorno objetivo utiliza Linux y Docker.
- El ERP local se ejecuta como un proyecto Docker Compose con servicios separados para backend, administración web, PWA, PostgreSQL y Redis.
- Hansa Field debe mantenerse separado funcionalmente del ERP, aunque pueda reutilizar patrones operativos y compartir la infraestructura física bajo límites explícitos.

## Stack detectado en el ERP local

| Capa               | Tecnología observada                                     |
| ------------------ | -------------------------------------------------------- |
| Backend            | TypeScript, NestJS 10, Prisma 5                          |
| Web administrativa | Next.js 14, React 18, TanStack Query, Tailwind CSS       |
| PWA                | Next.js 14, IndexedDB mediante `idb`, service worker/PWA |
| Persistencia       | PostgreSQL 16                                            |
| Cache/soporte      | Redis 7                                                  |
| Mapas actuales     | Leaflet 1.9                                              |
| Archivos           | Abstracción de almacenamiento con adaptadores local y S3 |
| Operación          | Docker Compose en Linux                                  |

## Patrones reutilizables

- Organización del backend en módulos NestJS por capacidad.
- UUID como identificadores persistentes.
- PostgreSQL y Redis ya operados por el equipo.
- Adaptador de almacenamiento que permite cambiar entre disco local y S3.
- Separación de backend, consola administrativa y experiencia móvil/PWA.
- Catálogos persistentes de país, cliente y proyecto.

## Patrones que Hansa Field no debe copiar literalmente

- El ERP modela un único rol fijo por usuario (`technician`, `supervisor`, `operator`, `material_manager`, `warehouse_dispatcher` o `pm`).
- La autorización por proyecto contiene ramas explícitas según el rol.
- La navegación web también contiene listas de roles por opción.
- Este enfoque no puede expresar de forma limpia dos operadores con permisos diferentes ni restringir secciones y campos de una misma App.
- No se detectaron archivos de pruebas automatizadas `*.spec.ts`, `*.test.ts` o `*.test.tsx`; Hansa Field necesita una estrategia de pruebas desde la fundación.
- Prisma no ofrece actualmente soporte nativo completo para tipos PostGIS; si se reutiliza debe aislarse el acceso espacial mediante SQL tipado o un adaptador específico.

## Revisión funcional autenticada del ERP

La revisión se realizó en modo de solo lectura y no modificó registros ni configuración.

- La consola administrativa organiza el trabajo alrededor de proyectos, Work Orders, materiales, técnicos, asistencia y usuarios.
- La navegación visible depende del rol fijo de la sesión.
- El dashboard consolida indicadores, alertas, estados y comparación por proyecto.
- La pantalla de proyectos permite administrar asignaciones y plantillas de informe asociadas al proyecto.
- El mapa actual usa Leaflet y presenta sitios y Work Orders con filtros por estado. Es adecuado para el caso actual, pero no demuestra todavía carga selectiva de miles de activos configurables por App.
- La importación visible de materiales recibe un CSV con columnas predeterminadas y actualiza coincidencias por código. Para Hansa Field este patrón debe evolucionar a inspección, mapeo, previsualización, confirmación e historial de importación.
- La pantalla de usuarios muestra un rol único por persona y asignaciones operativas. No ofrece composición por acción, App, sección o campo.

La interfaz confirma que Hansa Field no debe trasladar simplemente el modelo de roles del ERP. La integración futura debe hacerse mediante contratos de datos y API, no compartiendo la implementación de autorización.

## Archivos geográficos analizados

### KML combinado

- Tamaño: aproximadamente 19,6 MB.
- 8.260 `Placemark`.
- 6.265 geometrías `Point`.
- 1.995 geometrías `LineString`.
- 13.099 coordenadas totales.
- 45 atributos por entidad en la exportación observada.
- Extensión aproximada: longitud -63.2480 a -63.1237; latitud -17.7923 a -17.7071.

### Shapefile de puntos

- 6.265 registros.
- Tipo de geometría: `Point`.
- Componentes presentes: SHP, SHX, DBF y PRJ.
- Referencia espacial: WGS84.
- DBF aproximado sin compresión: 20,1 MB.

### Shapefile de líneas

- 1.995 registros.
- Tipo de geometría: `Polyline`.
- Componentes presentes: SHP, SHX, DBF y PRJ.
- Referencia espacial: WGS84.
- DBF aproximado sin compresión: 6,4 MB.

### DWG

- Se recibieron `LPZ93.dwg` y `LPZ04.dwg`.
- Ambos declaran encabezado `AC1032`, correspondiente al formato DWG de AutoCAD 2018.
- La inspección semántica de capas, entidades y sistemas de coordenadas requerirá una herramienta compatible con DWG o una exportación acordada a DXF/SHP.

## Implicaciones para la fundación

1. PostgreSQL con PostGIS debe ser el candidato principal para datos geográficos.
2. Las importaciones deben ejecutarse como trabajos de servidor, no dentro de una solicitud HTTP larga.
3. El archivo original, la previsualización, el mapeo, el resultado y los errores deben conservarse como una unidad auditable.
4. El navegador no debe recibir todas las geometrías y atributos de todas las Apps; se necesitan consultas por extensión del mapa, filtros de servidor y, al crecer, teselas vectoriales.
5. Los formularios dinámicos necesitan separar definición versionada de la App, valores de registros y campos indexables/promovidos.
6. Los formatos SHP/DBF truncan nombres y limitan tipos; el importador debe mapear nombres originales hacia identificadores internos estables.
7. KML, SHP y DWG no deben considerarse equivalentes. DWG requiere un flujo de preparación o conversión explícito.

## Escala de diseño inicial

- Aproximadamente 70 Apps.
- Múltiples Apps reutilizables dentro de un mismo proyecto.
- Aproximadamente 8.000 registros por App como referencia inicial, sin tratarlo como límite máximo.
- Fotografías de resolución reducida aceptables para el piloto.
- Importaciones grandes y crecimiento futuro deben manejarse de forma asíncrona y observable.
