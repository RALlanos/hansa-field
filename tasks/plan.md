# Implementation Plan: Hansa Field MVP

## Overview

Construiremos Hansa Field mediante entregas verticales pequeñas. Cada entrega debe dejar una aplicación ejecutable y demostrable, no una colección de capas técnicas desconectadas. La primera entrega validará la arquitectura, la persistencia geoespacial, el modelo App/registro/UUID, una importación básica y el mapa. La lectura CAD se evaluará temprano como prueba técnica aislada porque es el mayor riesgo de compatibilidad y licenciamiento.

## Architecture Decisions

- Monolito modular TypeScript con web y API desplegables en contenedores separados, pero un único dominio y repositorio.
- PostgreSQL/PostGIS como autoridad de Apps, registros, geometrías, membresías de proyecto y versiones.
- Archivos y fotografías normalizadas mediante almacenamiento S3-compatible; Redis/BullMQ para trabajos persistentes.
- Las Apps son fuentes maestras. Los proyectos organizan referencias a Apps y registros mediante contenedores anidados.
- Toda importación termina en una o varias Apps maestras; si comienza desde un proyecto, crea simultáneamente las membresías correspondientes.
- UUID como identidad autoritativa de reimportación.
- Autorización desacoplada mediante un puerto interno; la primera versión utiliza un operador técnico único.
- Desarrollo guiado por pruebas, migraciones versionadas y decisiones arquitectónicas registradas.

## Delivery Strategy

### Phase 1: Technical foundation and first vertical slice

Objetivo demostrable: crear una App, importar un conjunto geográfico sencillo, producir registros con UUID y visualizarlos en el mapa desde una aplicación web local.

1. Validar el runtime local, Docker, puertos disponibles y dependencias oficiales.
2. Crear el repositorio y el esqueleto mínimo de web, API, pruebas y contenedores.
3. Levantar PostgreSQL/PostGIS y aplicar la primera migración versionada.
4. Implementar el módulo mínimo de Apps y una pantalla para crear/listar Apps.
5. Implementar registros maestros con UUID y geometría mixta.
6. Implementar una importación pequeña GeoJSON/CSV con previsualización y confirmación.
7. Consultar registros por extensión y mostrarlos con MapLibre.
8. Ejecutar una prueba técnica DWG/DXF en Linux, documentar compatibilidad, licencias y alternativa segura.

### Checkpoint 1

- La aplicación arranca con un solo comando documentado.
- Las pruebas y compilaciones pasan.
- Una App puede crearse desde la web.
- Una muestra importada genera UUID, persiste geometrías y aparece en el mapa.
- Repetir la importación no duplica datos identificados.
- Existe una decisión fundamentada sobre el lector CAD; no se incorpora una dependencia no desplegable.
- Revisión conjunta antes de ampliar el alcance.

### Phase 2: Import assistant and multi-App routing

- Carga por partes reanudable y trabajos persistentes.
- Atributo clasificador, alias y tres opciones cuando falta.
- Enrutamiento de un ZIP hacia varias Apps.
- Mapeo lado a lado de columnas a campos y perfiles reutilizables.
- Reportes de nuevos, actualizados, inválidos y conflictos.
- Importación contextual desde proyecto y asignación simultánea a contenedores.

### Phase 3: App builder and schema evolution

- Campos, tipos de objeto, geometrías mixtas, reglas y simbología.
- Versionado, campos retirados y datos eliminados.
- Migraciones guiadas y corrección masiva de incompatibilidades.
- Configuración contextual `project_app` y campos exclusivos de membresía.
- PDF versionado del diccionario de datos.

### Phase 4: Projects and organization

- Proyectos y contenedores anidados.
- Asociación de Apps y subconjuntos de registros.
- Navegación Proyecto → Apps y App → proyectos.
- Edición de maestros desde proyecto y panel separado de extensiones contextuales.
- Exportación/reimportación con UUID y conservación de membresías.

### Phase 5: Operations, export and evidence

- Selección y edición masiva de atributos, estado y posición.
- Eliminación con ventana de cinco minutos y purga reforzada.
- CSV, XLSX, GeoJSON, KML/KMZ, Shapefile y ZIP.
- Normalización fotográfica fija, detalle de registro e informes.
- Bloqueo de edición, borrador observable y recuperación por reconexión.

### Phase 6: Identity and permissions

- Identidad y futura federación con ERP.
- Permisos por App, proyecto, intersección y contenedor heredable.
- Restricciones por acción, sección y campo evaluadas en servidor.
- Vistas guardadas separadas de políticas de seguridad.
- Auditoría de operaciones sensibles.

## Risks and Mitigations

| Risk                                                       | Impact | Mitigation                                                                              |
| ---------------------------------------------------------- | -----: | --------------------------------------------------------------------------------------- |
| Lectura DWG en Linux sin AutoCAD                           |   Alto | Prueba técnica en Phase 1; validar formato, licencia y calidad antes de integrarlo.     |
| Importaciones grandes agotan memoria o disco               |   Alto | Streaming, cuotas, trabajos persistentes, temporales aislados y pruebas crecientes.     |
| Variantes por proyecto vuelven inmantenible una App        |   Alto | Esquema base + overlay versionado, vista de diferencias y validación de compatibilidad. |
| Datos geográficos usan CRS incorrecto                      |   Alto | Detección, previsualización, corrección manual y conservación de procedencia.           |
| Reimportación sobrescribe datos incorrectos                |   Alto | UUID autoritativo, diff previo, confirmación y rechazo de UUID desconocidos.            |
| Funciones futuras de permisos obligan a reescribir módulos |  Medio | Puerto de autorización desde la fundación y contextos de recurso explícitos.            |

## Deliberately Deferred

- Login y permisos reales.
- Integración con ERP y Work Orders.
- Android y operación offline.
- Exportación DWG/DXF.
- Diseño de informes PDF específicos.

## Approval Gate

La implementación comienza únicamente después de que el usuario apruebe la Phase 1. Al terminar el Checkpoint 1 se presentará la aplicación funcionando y se solicitará aprobación para Phase 2.
