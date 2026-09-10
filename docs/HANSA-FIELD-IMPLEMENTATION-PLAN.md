# Hansa Field — plan de evolución incremental

> Actualización de ejecución 2026-09-08: el usuario confirmó B1 (Dataset neutral) y RecordGroup opcional, autorizó nuevo baseline/reset de desarrollo y descartó compatibilidad/backfill. La estrategia incremental de datos de las secciones 34–35 queda sustituida por cutover limpio; no se implementarán dual-read, dual-write ni flags legacy. El cuerpo conserva la trazabilidad de la propuesta original. Estado de implementación: [PILOT-IMPLEMENTATION-STATUS.md](PILOT-IMPLEMENTATION-STATUS.md).

Fecha: 2026-09-08. Documento de decisión y planificación; **no autoriza implementación**.

Base: [auditoría técnica](HANSA-FIELD-DATA-ARCHITECTURE-REVIEW.md) y nuevas decisiones funcionales del usuario. Complemento visual: [mapa conceptual](HANSA-FIELD-CONCEPTUAL-MAP.md). Solo se crean estos dos documentos; no se cambia la auditoría, el código, los tests ni la base. Todas las rutas, relaciones y migraciones futuras aquí descritas son propuestas, no funcionalidades existentes.

## 1. Resumen ejecutivo

Podemos evolucionar el sistema, preservando `records`, `project_records`, UUIDs, geometría PostGIS, JSONB, wizard, Cajones y schemas existentes. No hace falta una reescritura ni reset.

La nueva exigencia de importar directamente a Proyecto **sin asignar una App** cambia la conclusión anterior de App obligatoria. Recomiendo una pequeña abstracción de persistencia: **colección de registros con schema**, denominada Dataset en este plan. Cada App es la fachada operacional de un Dataset; un Proyecto puede albergar colecciones locales con schema sin crear Apps ocultas. Record pertenece a un Dataset, no a un owner polimórfico sin FK. La organización conserva la propiedad administrativa. El Dataset no es otra pantalla obligatoria ni una copia de datos: es el contrato común de almacenamiento de dos casos reales.

ProjectRecord sigue siendo participación y diferencias locales. ProjectApp se conserva solo cuando hay una App relacionada. Un grupo de equivalencia opcional registra que varios records representan lo mismo, sin fusionarlos. Consolidar crea un resultado trazable separado; vincular no mezcla atributos.

Se proponen **12 fases, F0–F11**, con una decisión arquitectónica bloqueante para el tramo de ownership. F0 y las protecciones pueden ejecutarse después de autorización aun antes de resolverla; hoy no se ejecuta nada.

## 2. Arquitectura actual que conservamos

La auditoría sigue siendo evidencia técnica. Se reconfirmaron `persistBatch` y rutas de importación/exportación para planear el cambio. Persistencia real: SQL mediante `pg`, no Prisma. El baseline actual tiene `records.app_id/app_version_id/canonical_attributes`, ProjectRecord activo/retirado y versiones de ProjectApp.

Conservar PK existentes, el registro canónico único, retiro lógico, resolución efectiva central, transacciones y unicidad de participación activa. No recrear métodos legacy. El importador actualmente hace upsert canónico; el consolidado de App actualmente lee participaciones. Son comportamientos a sustituir, no razones para borrar sus módulos completos.

## 3. Arquitectura objetivo

Tres planos separados:

- **Definición:** Template y versiones reutilizables; Dataset schema y versiones operativas; schema contextual de ProjectApp.
- **Datos:** Record con baseline propio y revisión; ProjectRecord con revisión, overrides y campos locales. Dataset puede ser de App o local a Proyecto.
- **Interpretación/lectura:** publicación, territorios y equivalencia; consulta canónica o contextual autorizada con presupuesto de respuesta.

Una App no depende de Template. Un Proyecto puede empezar vacío, aplicar cero o varios Cajones y añadir Apps explícitamente. Territorio y Cajón no almacenan records. Identidad real compartida no es dueño de atributos.

## 4. Decisiones ya aprobadas

Independencia funcional de Template/App/Proyecto/Cajón/Territorio; múltiples jerarquías; Point/LineString/Polygon; contexto de entrada permanente; operaciones explícitas; tres decisiones de coincidencia; exportación de origen; lectura acotada; ausencia de reset y de tecnologías de escala obligatorias.

No reabrimos estas decisiones. La representación física neutral, los nombres de nuevas tablas y los umbrales de benchmark son recomendaciones pendientes, no aprobación implícita.

## 5. CONTRADICCIONES / DECISIONES QUE NECESITAN CONFIRMACIÓN

**Un bloqueador arquitectónico: significado de “originado directamente en Proyecto”.**

La auditoría recomendaba pertenencia obligatoria a App. Eso basta si el usuario acepta elegir una App destino durante la importación de Proyecto y guardar el Proyecto solo como procedencia. No basta si el dato debe permanecer sin App hasta una incorporación/migración posterior explícita.

| Alternativa                                                   | Ventaja                                                    | Consecuencia                                                                                      |
| ------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| App obligatoria + origen Proyecto                             | Cambio menor                                               | Obliga a App destino; incumple la interpretación estricta de proyecto sin App                     |
| `app_id` nullable y owner App/Proyecto directamente en Record | Menos entidades                                            | Duplica contratos de schema/colección y reglas XOR en varias tablas; consultas y FKs más frágiles |
| Dataset neutral tipado, recomendado                           | Un vínculo obligatorio de Record y schema para ambos casos | Añade colección común y requiere backfill controlado                                              |

**Confirmación requerida:** aceptar colecciones locales de Proyecto sin App y, por ello, Dataset neutral. El plan desarrolla esa alternativa; si se confirma que importar a Proyecto siempre exige App, se simplifica F2 y no se introduce Dataset neutral. No implementar simultáneamente ambos diseños.

Otros puntos reconciliados, no bloqueadores:

- “No mover” no prohíbe compartir UUID: incorporar crea participación, no traslada pertenencia.
- “Canónico” significa baseline de un Record, no necesariamente registro publicado ni representación única de una entidad real.
- “Vinculados” no significa mismos atributos ni mismos UUIDs. Un grupo no sustituye a sus miembros.
- “No son iguales” es una decisión almacenada; si luego se intenta unir sus grupos, se muestra conflicto y se exige revocarla expresamente.
- “Original” se distingue en tres niveles: snapshot importado, vista contextual a revisión y archivo byte a byte. Lo no conservado históricamente se marca desconocido/no disponible; no se promete reconstrucción imposible.

## 6. Invariantes

1. Ningún UUID existente se cambia durante backfill.
2. Record pertenece a una colección operativa con schema versionado; organización autoriza el acceso.
3. Procedencia de nacimiento es inmutable; cambios de contexto son eventos adicionales.
4. Importar en Proyecto crea Record + participación inicial atómicamente. Importar en App no exige participación.
5. Incorporar conserva Record UUID; duplicar nuevo genera otro; vincular conserva todos.
6. Reimportación contextual no modifica baseline, origen ni otros proyectos.
7. PATCH omitido conserva, null explícito tiene semántica definida, reset de override hereda.
8. Cada valor se interpreta con identidad de campo y versión; labels solo sugieren matching.
9. No se mezclan atributos al vincular y no se destruyen fuentes al consolidar.
10. Autorización precede selección de representante, conteos, agregación, exportación y detalle.
11. Mapa/tabla comparten colección lógica y revisión del scope, no necesariamente el mismo payload.
12. Toda transición se reconcilia y tiene rollback operacional; no dual-write entre dos fuentes maestras.

## 7. Template

Extraer catálogo reusable con `templates`/`template_versions`. Nunca redirigir records a Template. Secciones, campos, reglas, geometrías y simbología inicial se copian/referencian por versión al crear una App o colección local. Publicar una nueva plantilla no modifica instancias existentes.

## 8. App y Dataset neutral

Mantener `app_definitions` como identidad de App. Añadir relación 1:1 con Dataset. Dataset posee schema operativo y Record; App aporta nombre, catálogo y configuración pública. Dataset no tiene atributos de registros duplicados.

Modelo conceptual de integridad: Dataset contiene exactamente uno de `app_id` o `local_project_id`, con FKs reales y exclusión XOR, además de organización. App puede tener solo un Dataset; Proyecto puede tener varios locales. No usar `owner_type + owner_id` sin integridad referencial. Crear App y su Dataset es una sola transacción.

Reutilizar `app_versions` como almacenamiento de versiones operativas extendiéndola con Dataset y retirando gradualmente la obligatoriedad de App. Su nombre físico puede permanecer temporalmente; un rename posterior no es requisito funcional. Schema local no se guarda en otro JSON incompatible.

## 9. Project

Proyecto vacío válido. Puede conectar Apps mediante ProjectApp y contener colecciones locales independientes. No crea automáticamente una App por importar. Cada colección local necesita nombre/schema explícito; no es una App encubierta que aparezca en el catálogo.

La organización, no el proyecto de origen, decide promoción y permisos. Archivar Proyecto preserva sus colecciones/fuentes y participaciones históricas; borrar Proyecto con datos no es un cascade de producto permitido.

## 10. Cajón

Mantener `app_blocks` y miembros como receta. El miembro debe declarar una intención: usar App existente, o instanciar configuración desde Template con elección explícita de App nueva/colección local. No inferir Apps por nombres coincidentes. Aplicación: selección → preview de destinos/versiones → confirmación idempotente → creación/configuración; cero records copiados. Guardar snapshot de aplicación de receta; edición posterior no retroactiva.

## 11. Record: baseline sin owner App obligatorio

Reutilizar `records.id`, `canonical_attributes`, `geometry`, timestamps; evolucionar a Dataset/version/revision/origin/publicación. Baseline es autoridad para **ese record**, no para todos los miembros de un grupo.

No crear tablas `project_only_records`, `linked_records` ni `consolidated_entities` con copias equivalentes. “Project-only” es colección local + visibilidad restringida. “Linked” es membresía de equivalencia. “Consolidated” es Record resultado con lineage. App ID puede derivarse del Dataset y ser ausente para origen local; no mantener un app_id ficticio para cumplir el schema viejo.

## 12. ProjectRecord

Conservar tabla y UUID; añadir contexto de Proyecto directo y ProjectApp opcional. Proyecto se almacena aquí legítimamente como **participación**, no restaurando el antiguo owner implícito de `records.project_id`.

Integridad futura: si hay ProjectApp, debe pertenecer al mismo Proyecto y Dataset del record; FK compuesta/validación transaccional respaldada por constraint donde sea posible. Sin ProjectApp, la participación referencia un record de colección local; puede incorporarse a otro proyecto como referencia local explícita. Recomendación: una participación activa por `(project_id,record_id)`, dado que ProjectApp es única por proyecto/dataset. Auditar duplicados antes de introducir ese índice.

Para nacimiento local se crea participación con deltas vacíos, aunque parezca redundante: identifica el ámbito editable, permite retiro y hace que toda edición de proyecto use el mismo mecanismo. Datos originales permanecen en baseline; reimportaciones del proyecto actualizan su participación. Crear solo ProjectRecord exigiría identidad y geometría aparte o un record nullable, y rompería consultas independientes y vinculación.

## 13. ProjectApp

Reutilizar identidad, relación de Proyecto, versiones y schema contextual. Añadir fuente/version de Dataset explícita y settings locales. Referencia siempre una App cuando exista esa relación; **no crear una ProjectApp falsa para colecciones sin App**. El editor de colección local usa schema de Dataset y participación directa. Campos heredados conservan identidad; locales tienen identidad propia y no se promueven por guardar formulario. Configuración de B nunca cambia A, App o Cajón.

## 14. Territorio

Scheme, Level y Territory independientes con vigencia, reglas de jerarquía y geometría opcional. Membresía muchos-a-muchos híbrida, con método/manual/espacial, revisión de límite y de geometría. Canónico usa geometría del Record; contexto con override usa membresía contextual derivada, marcada con ProjectRecord, sin sobrescribir la canónica. No usar display geometry para pertenencia. Líneas y polígonos pueden cruzar varios; agregar counts sin sumar membresías como records únicos.

## 15. Procedencia permanente

Nacimiento: `record_origin` lógico, representable por metadatos inmutables de Record más primer evento de cambios. Registra tipo manual/importado, contexto App/Proyecto, IDs y snapshot de nombres, actor, fecha, job/fuente. No depender solo de una FK `ON DELETE SET NULL`.

Reusar `record_import_sources`, evolucionándola a observaciones append-only con identificador de observación y operación. Conservar external ID como texto y namespace de fuente/dataset; no exigir universalmente UUID externo. Cada reimportación añade observación, no destruye la anterior. Job y bytes originales/checksum/ruta preservada complementan la trazabilidad, con permisos y retención. Auditoría contiene incorporación, desvinculación, publicación, migración y promoción; transforms/conflictos guardan entradas y versiones exactas.

## 16. Entrada desde App

Usuario elige App y versión/mapping. Crear nuevo → Record en Dataset de App, origen App y observación; ProjectRecord no se crea. Restricted por defecto salvo política autorizada. Participar en Proyecto después es operación separada, sin copia de Record.

## 17. Entrada desde Proyecto

Dos destinos visibles, no deducidos silenciosamente:

- **App ya relacionada:** usuario elige ProjectApp; Record nuevo pertenece al Dataset de esa App y nace con origen Proyecto y participación inicial. La UI debe mostrar destino y visibilidad.
- **Colección local sin App:** usuario elige/crea colección y schema dentro de Proyecto; Record pertenece a ese Dataset local, más participación inicial. App ID ausente. Esto satisface la interpretación estricta del bloqueador.

Para llevar el segundo caso a App: migración explícita de pertenencia con mapping preservando UUID si es una reclasificación compatible, o consolidación/duplicación nueva si debe conservar dos representaciones independientes. No asignar App al publicar: publicación no cambia ownership.

## 18. Operaciones explícitas

| Operación               | Qué cambia                      | Identidad/procedencia                          | Conflicto que bloquea confirmación                          |
| ----------------------- | ------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| Importar nuevo App      | Record + observación            | UUID nuevo, origen App                         | ID Hansa existente usado como nuevo, schema/permiso         |
| Importar nuevo Proyecto | Record + PR + observación       | dos UUIDs nuevos, origen Proyecto              | destino ambiguo, schema sin confirmar                       |
| Reimportar App          | baseline y revisión autorizados | mismos UUID; observación nueva                 | revisión antigua, pertenencia distinta, promoción implícita |
| Reimportar Proyecto     | overrides/local/geometry del PR | mismos Record/PR, observación nueva            | PR de otro contexto, fuente ambigua, revisión antigua       |
| Incorporar existente    | PR nuevo                        | mismo Record; evento de incorporación          | participación activa existente, permiso/mapping             |
| Vincular                | grupo/membresías/prioridad      | records intactos; decisión auditada            | rechazo previo, incompatibilidad semántica                  |
| Promover cambio         | baseline del record elegido     | UUID igual; revisión + decisiones por campo    | canónico cambió, tipos/unidades, permiso                    |
| Migrar pertenencia      | Dataset/schema de Record        | UUID igual, origen inmutable + snapshot previo | participaciones incompatibles; exige plan conjunto          |
| Consolidar              | Record resultado + lineage      | UUID nuevo por defecto; originales intactos    | mapping/ganador sin resolver, revisiones cambiadas          |
| Duplicar nuevo          | Record independiente            | UUID nuevo + derived-from                      | operación confundida con reutilización                      |

Migrar no es obligatorio para incorporar. Si migrar rompe ProjectApps que referencian Dataset anterior, debe abortar o presentar plan de reasignación de todas las participaciones afectadas, nunca parchearlas silenciosamente. No implementar migración general en primera entrega.

## 19. Publicación

Separar `restricted/published` de `active/archived`. Política por organización/colección; importación local permanece restringida salvo confirmación. Mapa Universal muestra publicado y también contextos restringidos seleccionados **si el actor tiene permiso**; eso no publica datos. Publicar no equivale a consolidar ni a vincular. Revocación de acceso afecta cache y representantes inmediatamente.

## 20. Vinculación: exactamente tres decisiones

1. **No son iguales:** rechazo de pareja normalizada por UUID; motivo, actor, revisión y vigencia. Persistente hasta revocación explícita. No volver a sugerirla por cada pan/zoom.
2. **Vincular:** ambos sobreviven; grupo de equivalencia confirmado, sin merge de atributos, schema, geometría u ownership.
3. **Unificar/consolidar:** preview/mapping/conflictos → resultado trazable nuevo, sin borrar fuentes.

“Pendiente de revisión” es estado del candidato, no cuarta decisión principal. La detección no confirma nada; reglas configurables con versión producen candidatos reproducibles, no verdad.

## 21. Consolidación no destructiva

Crear Record resultado en destino elegido, con schema/version y revisión inicial. Consolidation run fija fuentes `{recordUuid, revision, projectRecordUuid?, projectRevision?}`, mapping, reglas de transformación, ganador por campo y justificación. Source values, nulls y unidades se preservan en lineage, incluyendo geometría seleccionada/transformada.

El grupo solo identifica equivalencia; no guarda una segunda copia canónica. Resultado puede ser miembro preferido del grupo si todos se refieren a la misma entidad. Consolidación de inspecciones distintas en un resumen no implica equivalencia y se relaciona solo por lineage. Revertir archiva resultado y restaura preferencias, sin deshacer ediciones posteriores ajenas ni borrar fuentes. Recalcular consolidado crea nueva revisión/run con entradas fijadas, no actualización silenciosa continua.

## 22. ¿Entidad superior o relaciones entre Records?

| Enfoque                   | Ventajas                                                              | Costos                                                                                        |
| ------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Parejas equivalentes      | Fácil para dos records                                                | cierre transitivo, elección de principal y separación de grupos caros; relaciones cuadráticas |
| Grupo confirmado opcional | miembro único por grupo, representante estable y consulta O(miembros) | requiere operación auditada de unir/separar grupos                                            |

Recomiendo **RecordGroup opcional**, creado solo tras vinculación confirmada. No crear uno por cada record ni declararlo verdad física universal. Un record pertenece como máximo a un grupo activo de equivalencia de identidad; relaciones “inspección de”, “parte de” o proximidad no pertenecen a ese grupo. No fusionar automáticamente grupos por score.

Prioridad global del grupo y preferencia contextual por Proyecto son separadas. Elegir representante **después** de aplicar ACL, filtros y bbox; si principal no es elegible, usar miembro elegible determinista. Badge cuenta miembros autorizados/elegibles, nunca revela datos ocultos. Distancia grande entre miembros debe advertirse y permitir “mostrar todos”. Rechazos entre cualquier par de grupos bloquean unión hasta revisión. Desvincular genera nueva revisión de membresía, preserva historial y no elimina Record.

## 23. Identidad y mapping de campos

Conservar matching automático del wizard por nombre como sugerencia. Confirmación guarda IDs de campo/schema/version, tipos, unidades y dirección. Misma identidad heredada permite equivalencia; labels iguales no la garantizan.

- Equivalencia: Altura ↔ Altura Poste si semántica/unidad coincide.
- Transformación: texto “Poste de 9 metros” → número 9 mediante regla versionada declarativa.
- Diferentes: Tipo Material ≠ Tipo Estructura; no unir.

Sin código arbitrario del usuario. Transformaciones tipadas y limitadas; errores a incidencias. Mapping reutilizable se invalida/revalida al cambiar contrato de campos. Correcciones de identidad primero, antes de incorporar/consolidar. JSONB objetivo por identidad; proyección de keys/labels para UX/exportación. No reinterpretar datos históricos con latest.

## 24. Exportación preservada

Modos conceptuales: original de App a revisión, original/contextual de Proyecto a revisión, resultado consolidado a revisión. Archivo exacto original requiere archivo retenido, no reconstrucción desde JSON. Exportación actualizada no debe etiquetarse “original”.

Manifest de exportación: UUID Record/PR, schema/revisiones, source ID/namespace, transformaciones y contexto. Grupo se exporta como relaciones/preferencias opcionales, no suprime miembros por defecto. Exportar consolidado incluye lineage o referencia descargable autorizada; si fuente no accesible, no filtrar valores protegidos. Historial perdido por upserts previos se marca no recuperable salvo copia externa verificada.

## 25. Mapa Universal

Un query scope explícito combina Apps, Proyectos, territorios y filtros; no concatena endpoints sin deduplicación. Unidad de lectura = representación `(recordUuid, contextRef?)`. Modo canónico muestra baseline publicado; modo proyecto usa efectivo. Si se selecciona el mismo R1 vía App y dos proyectos, se distinguen representaciones y se permite colapsar visualmente; no se confunde con tres Records.

Pipeline: autorización → scope de colecciones/contextos → bbox efectivo → filtros → candidatos elegibles → equivalencia confirmada/preferencia → agregación territorial/cluster/features según presupuesto. La detección de duplicados es trabajo separado; nunca comparación N² por mover mapa. Mostrar counts diferenciados: Records distintos, participaciones/representaciones y grupos visuales. Tabla puede expandir miembros del símbolo sin perder origen.

No todas las consultas atraviesan PR: App/Record usan baseline; Proyecto usa PR; territorio canónico usa geometría/membresía; grupo usa membresías; Universal combina proyecciones. Territorios sin geometría admiten asignación manual; no requieren tiles.

## 26. Escalabilidad

Mismo cálculo de participaciones de auditoría: 10 M records × 10 = 100 M PR; 50 M × 10 = 500 M. Los grupos son dispersos: solo records realmente vinculados. Candidatos generados por bloques selectivos (organización, tipo, territorio, source namespace, cercanía indexada), no producto cartesiano. Puntos coincidentes no bastan; líneas/polígonos requieren comparación geométrica apropiada y criterios de dominio.

No instalar Redis/MVT/particionado/réplicas por este plan. Antes: límites de bytes/vértices, keyset, índices ligados a consultas, geometría efectiva indexable, cache con revisión/ACL, import staging acotado. Offline y cola distribuida posteriores; jobs durables pueden comenzar en PostgreSQL.

## 27. Tablas reutilizadas

`records`, `project_records`, `projects`, `app_definitions`, `app_versions`, `project_apps`, `project_app_versions`, `app_blocks`, `block_template_members`, `import_profiles`, `import_jobs`, `record_import_sources`. Mantener datos e IDs. Las tablas de definición de campo existentes pueden servir al backfill/identidad: no dar por hecho que están pobladas.

## 28. Tablas modificadas, sin DDL ahora

| Tabla                   | Evolución propuesta                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| records                 | Dataset/version/revision/origen/publicación; retirar dependencia obligatoria App solo después del backfill |
| app_definitions         | App operacional; origen Template opcional                                                                  |
| app_versions            | versión operativa de Dataset; FK consistente entre Dataset/version                                         |
| project_records         | project_id explícito, ProjectApp opcional, schema/revisión y semántica PATCH; únicos activos auditados     |
| project_apps / versions | Dataset de App/version base; settings locales y campos heredados                                           |
| block_template_members  | referencia tipada Template/App y snapshot de aplicación; no copiar datos                                   |
| import_jobs             | target discriminado App/colección local/ProjectApp; snapshot de scope confirmado                           |
| record_import_sources   | observaciones append-only, PR opcional, namespace y revisión/operation                                     |
| tablas de fields        | identidad estable con owner de schema válido; backfill desde schemas, no por label global                  |

No escribir `records.project_id` como compatibilidad. El vínculo local vive en Dataset; nacimiento vive en provenance.

## 29. Nuevas tablas propuestas por necesidad

Nombres orientativos: `templates`, `template_versions`; `datasets`; `changesets` y `record_changes` (historia de Record/PR con FKs tipadas, snapshots/deltas verificables e idempotencia); `field_mappings`; `territory_schemes`, `territory_levels`, `territories`, `record_territory_memberships`; `record_groups`, `record_group_members`, `record_match_decisions`; `consolidation_runs`.

Preferencias contextuales pueden comenzar como configuración versionada del grupo si pequeñas y validadas; normalizarlas si consultas lo exigen. Candidatos pueden ser salida paginada de un job con decisiones persistentes separadas; no retener millones de scores duplicados sin necesidad. Lineage por campo puede vivir en resultado versionado de consolidation run, no EAV de valores operativos.

Dataset y Group no son la misma abstracción: el primero define pertenencia/schema, el segundo equivalencia opcional. No crear un tercer “owner/source” genérico.

## 30. Tablas que no crearíamos

No `project_only_records`, no `linked_records`, no `canonical_entities` con atributos duplicados, no variant/subvariant, no tabla por App, no columna universal node/zone/district, no duplicación completa por territorio, no schema alternativo solo para importaciones. No tabla de records de plantilla.

## 31. Endpoints actuales afectados

Prefijo `/api` implícito. Reconfirmados en código:

| Ruta actual                                                      | Transición                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| GET apps/:appId/records y metadata/map                           | separar colección canónica de vista de participaciones; contrato versionado/flag hasta migrar UI |
| GET projects/:projectId/records                                  | conserva ruta, añade colección local y cursor/scope                                              |
| GET map/records                                                  | conserva lector contextual; no llamarlo global sin cambiar semántica                             |
| POST/PATCH/DELETE project-apps/:id/records                       | reutilizar servicio de participación; PATCH preserva ausentes                                    |
| POST project-apps/:id/records/incorporate                        | conservar; mapping/revisión/provenance, no creación canónica                                     |
| GET/POST project-apps/:id/versions                               | mantener; identidad/versión y presentación local                                                 |
| POST imports/shapefile/inspect, :jobId/plan, :jobId/confirm      | mantener wizard; destino discriminado y persistencia central                                     |
| POST apps/:appId/transfers/preview y confirm; GET export.geojson | inspeccionar consumidor/semántica al migrar; converger a operaciones compartidas, no dos motores |
| Apps, Projects, Blocks CRUD                                      | evolución aditiva de relaciones/template/preview; no borrar rutas sin sustituir UI               |

## 32. Endpoints nuevos propuestos

No implementar todos de golpe. Reusar rutas existentes si operación ya existe.

- CRUD/versiones de `/templates`.
- `/projects/:id/collections` para colecciones locales y `/projects/:id/records` POST/incorporate/PATCH/DELETE contextual cuando no hay ProjectApp, delegando al mismo servicio.
- POST `/apps/:id/records`, GET `/records/:id` con revisión/contexto autorizado; PATCH canónico explícito con revisión esperada.
- Preview/confirm de promoción/publicación mediante `/records/:id/...` sin mezclarlo con edición contextual.
- Territory schemes/levels/territories y membresías.
- GET `/map/universal` y query de tabla correspondiente con mismo scope y cursor.
- Jobs de candidatos y decisión de pareja; grupos/membresías/preferencias; consolidation preview/confirm; exportación por scope/revisión.

Todos los comandos masivos: operación idempotente, preview ligado a revisiones, confirmación que revalida. No usar una ruta universal que oculte si escribe baseline, participación o relación.

## 33. Servicios afectados y obsolescencia

`ProjectsService`/`BlocksService`: instanciación explícita, settings y versiones. `ProjectRecordsCoreService`: extracción de operaciones de baseline/participación reutilizables, sin copiar lógica al importador. `effective-record`: identidad/null/revisión central. `ShapefileImportsService.persistBatch`: reemplazar upsert canónico contextual; `prepare`: scope de external IDs. `ConsolidatedRecordsService`: preservar lectura de participaciones como tal, añadir canónico sin PR; no borrar funcionalidad por rename. `RecordsService`: scope, índices/cluster común. Frontend: builder, workspace, import wizard, tabla y mapa consumen DTO claros.

Quedan obsoletos: búsqueda global de source ID sin namespace, `latest` como interpretación histórica obligatoria, objetos ausentes que borran overrides, duplicación de reglas de clustering y mezcla de `appId`/`projectAppId`. No volver a crear RecordsService legacy para sostener clientes antiguos.

## 34. Migración sin big bang

Expandir → backfill verificable → nuevo writer único → lectores por flag → reconciliar → retirar campos/rutas viejas. Backfill por lotes, checkpoint, checksum de geometría/JSON, idempotente y con quarantine de ambigüedades. Cada fase agrega constraints después de validar datos, sin cambiar baseline histórico aplicado.

Compatibility layer temporal **solo de DTO**, con fecha/criterio de retiro. Un único escritor por operación y cohort/proyecto; puede mantener columnas derivadas antiguas de forma transaccional mientras representen exactamente lo mismo. No dos fuentes maestras ni dos commits coordinados desde frontend. Dual read solo en sombra para comparar conjuntos/revisiones, nunca mezclar valores de lecturas discordantes al usuario. Feature flags por capacidad/cohorte, auditables.

Antes de activar colecciones sin App, todos los lectores legacy que exigen App deben estar aislados a sus scopes válidos. No inventar App placeholder. Rollback de código puede requerir apagar nueva escritura y conservar lectura nueva para datos no representables en versión anterior; no prometer rollback total con un simple DROP. Backups y restore ensayado en entorno aislado.

## 35. Compatibilidad de datos existentes

Un Dataset por App existente, preservando FK lógica/UUID. Versiones se vinculan por IDs originales. Registros existentes conservan pertenencia App; no moverlos a colecciones locales por deducción de origen. Origen conocido por jobs se registra con evidencia; ambiguo queda `legacy_unknown`, nunca “manual” inventado. Campos ambiguos o sin schema quedan preservados como payload de origen no reinterpretado hasta resolver mapping. Snapshot actual no se etiqueta como importación original perdida.

Auditar divergencias entre schemas de ProjectApps y canónico; no deduplicar IDs externos al migrar. Hashes y conteos de records, PR activos/retirados, versiones y geometrías deben coincidir antes y después. Índices/constraints nuevos se prueban con FKs inválidas y concurrencia, no solo con fixture feliz.

## 36. Plan por fases y tareas verificables

Cada fase es un hito, **no una ejecución gigante**. Las tareas enumeradas se ejecutarán por separado (aprox. 1–5 archivos por incremento), con API+UI del camino correspondiente. Ninguna casilla representa trabajo hecho en esta tarea.

### F0 — Invariantes y protección de escritura

- Objetivo/dependencias: fijar regresiones de auditoría; sin dependencias de ownership nuevo.
- Tablas/migraciones: ninguna inicial; no reset.
- Servicios/UI/endpoints: tests del importador, core y PATCH actual; UX muestra conflicto en vez de escribir fuera de scope.
- Tareas: [ ] test A/B de reimportación; [ ] guard de scope/idempotencia sin upsert canónico contextual; [ ] preservar PATCH omitido y validar null/reset; [ ] prueba de exportación actual como baseline.
- Compatibilidad: mismo endpoint; rechazar operación ambigua explícitamente, sin simular éxito ni hacer downgrade silencioso.
- Tests/aceptación: reimportar B no cambia A/canónico; retry no duplica; editar atributo no borra geometría. Riesgo: clientes dependían de reemplazo implícito; documentar semántica y adaptar request existente.
- No tocar: Template, Dataset, territorios, grupos. Primer gate 100K en entorno aislado para referencia, no bloqueo por arquitectura futura.

### F1 — Campos, versiones y revisiones

- Objetivo/dependencias: interpretar y proteger datos; depende F0.
- Tablas: fields existentes, versiones, records/PR; changesets/history/mappings iniciales. Migración aditiva y backfill por schema.
- Servicios/UI/endpoints: schema validators, resolver y editores; revisión esperada en edición/confirmación.
- Tareas: [ ] identidad estable y mapping de keys; [ ] referencia de versión contextual; [ ] revisions/If-Match e idempotency; [ ] historial mínimo y provenance de nueva escritura.
- Compatibilidad: reader de keys viejo por versión marcada durante backfill; un formato de valores autoritativo por fila, no mezcla heurística. Retirar lector viejo al terminar cohort.
- Tests/aceptación: renombrar label conserva valor; campo homónimo no se mezcla; edición concurrente devuelve conflicto; exportación a revisión fija. Riesgo: schemas históricos incompletos → quarantine.
- No tocar: ownership nuevo ni offline completo.

### F2 — Template/App y colección neutral

- Objetivo/dependencias: separar molde y almacenamiento; F1 y confirmación del bloqueador.
- Tablas: templates/versions, datasets; app_definitions/app_versions/records. Migración expand/backfill sin rename.
- Servicios/UI/endpoints: AppsService y creación App, CRUD Template; permite App sin Template.
- Tareas: [ ] Dataset por App existente + reconciliación; [ ] catálogo Template extraído con IDs independientes; [ ] creación App con/sin molde; [ ] reader canónico por App sin PR.
- Compatibilidad: App APIs existentes siguen IDs; flags habilitan DTO nuevos. Campos App legacy derivados solo para records de App; todavía no escribir locales.
- Tests/aceptación: mismos UUID/counts, App sin proyecto/plantilla, cambiar molde no altera schema operativo. Riesgo: confundir copia de schema con misma identidad de instancia.
- No tocar: cargas locales, equivalencia o MVT.

### F3 — Proyecto y procedencia local

- Objetivo/dependencias: proyecto vacío y colección sin App, F2.
- Tablas: datasets locales, PR contexto directo/PA opcional, ProjectApp/version/settings, Cajones y snapshots; provenance. Migración de PR existentes con project_id validado.
- Servicios/UI/endpoints: Projects/Blocks/core, configurar proyecto y colección local; rutas contextualizadas propuestas.
- Tareas: [ ] crear proyecto vacío; [ ] relacionar App/aplicar Cajón con preview; [ ] crear colección local/schema y Record+PR; [ ] settings propios y provenance inmutable.
- Compatibilidad: lectores ProjectApp siguen existentes; nuevo lector de Proyecto agrega locales por flag. No habilitar si consumidor intenta GET App con UUID de colección local.
- Tests/aceptación: origen local sin App ficticia; edición B aislada; Cajón no retroactivo; retiro preserva Record; restricciones de organización. Riesgo: cascades y borrado; usar archivo/rechazo con referencias.
- No tocar: consolidación ni import masivo nuevo.

### F4 — Importación App/Proyecto explícita

- Objetivo/dependencias: mismo wizard, writers correctos; F1–F3.
- Tablas: jobs/sources append-only, scopes/versiones; Record/PR mediante núcleo. Migración de target nullable/discriminado con constraints.
- Servicios/UI/endpoints: inspect/plan/confirm existentes, transfers asociados y destinos visibles.
- Tareas: [ ] target App y collection local/PA; [ ] matching manual intacto + mapa por IDs confirmado; [ ] reimport por namespace/scope; [ ] observaciones y exportación de fuente; [ ] staging/lotes reanudables si volumen excede presupuesto.
- Compatibilidad: jobs antiguos completados permanecen legibles; jobs pendientes se revalidan contra versión vieja o se cancelan explícitamente con opción de inspeccionar de nuevo. Un writer por modo.
- Tests/aceptación: cuatro import/reimport, misma fuente en contextos distintos, UUID desconocido, conflicto de versión, rollback y retry; no modificación de canónico ajeno. Riesgo: datos históricos sin namespace.
- No tocar: matching rediseñado ni auto-link. Gate 1M.

### F5 — Incorporación, publicación y promoción

- Objetivo/dependencias: compartir sin mover, F4.
- Tablas: estados, auditoría, PR; no tabla de record compartido.
- Servicios/UI/endpoints: incorporate actual, preview/confirm promoción y publicación; permisos del actor.
- Tareas: [ ] incorporación de local/App a otro proyecto; [ ] publicación explícita/política; [ ] promoción con revisión/ganadores; [ ] pruebas de retirar/archivar sin perder fuente.
- Compatibilidad: default conservador para visibilidad existente, aprobado por responsable; no publicar por backfill. Guardar vista actual autorizada mediante scope transitorio, no cambiar permisos silenciosamente.
- Tests/aceptación: mismo Record/distinto PR; promover modifica solo destino autorizado y marca efecto en herederos; privado no sale en conteos universales. Riesgo: permisos aún insuficientes en producto actual, gate de seguridad obligatorio.
- No tocar: migración de pertenencia general ni equivalencia.

### F6 — Territorios configurables

- Objetivo/dependencias: dimensión geográfica independiente; F3/F5.
- Tablas nuevas territoriales/membresías, índices según consulta; no zone_id en records.
- Servicios/UI/endpoints: gestión de esquema/niveles/territorios, asignación manual y cálculo espacial.
- Tareas: [ ] jerarquía/validación ciclos; [ ] asignación híbrida versionada; [ ] geometría contextual separada; [ ] recálculo por cambios de límites.
- Compatibilidad: atributos nodo/distrito permanecen datos; usuario confirma mapping territorial, nunca conversión automática.
- Tests/aceptación: dos esquemas, punto frontera, línea y polígono multiterritorio; manual sobrevive recálculo; counts únicos correctos. Riesgo: topología/geometría inválida y fan-out.
- No tocar: permisos basados únicamente en territorio ni descarga offline. Gate 1M espacial.

### F7 — Mapa Universal y tabla por scope

- Objetivo/dependencias: lecturas independientes, F5/F6.
- Tablas/migraciones: índices/read projection solo según planes; no duplicar fuente de verdad.
- Servicios/UI/endpoints: query scope, `/map/universal`, tabla cursor, detalle bajo demanda; conservar pantallas existentes hasta paridad.
- Tareas: [ ] normalizar scopes y DTO feature mínimo; [ ] bbox efectivo/selectividad; [ ] agregación/densidad y tabla/counter; [ ] cache coherente por revisión/ACL.
- Compatibilidad: shadow-read compara sets; no combinar resultados viejos/nuevos. Flag por pantalla; retirar viejo mapa cuando paridad funcional y presupuesto pasen.
- Tests/aceptación: App sin PR, proyecto local, multi-App/territorio, dato privado no visible, stale response descartada; counts exactos o explícitamente etiquetados. Riesgo: `COALESCE` y COUNT scans.
- No tocar: detección automática por viewport. Gate 5M, antes de habilitar esa escala.

### F8 — Candidatos y decisiones de equivalencia

- Objetivo/dependencias: tres decisiones persistentes; F1/F5/F7.
- Tablas: grupos, miembros y decisiones; jobs de candidatos, no millones de grupos vacíos.
- Servicios/UI/endpoints: candidato/revisión, vínculo, rechazo y preferencias.
- Tareas: [ ] reglas de candidatos versionadas; [ ] no-iguales persistente; [ ] vínculo/grupo/desvínculo; [ ] representante global/contextual autorizado.
- Compatibilidad: sin grupo, record se muestra igual que antes; vista “todos” siempre disponible.
- Tests/aceptación: coords iguales no fusionan; rechazo evita sugerencia repetida; link conserva hashes de datos; principal oculto no filtra existencia; conflicto transitivo detectado. Riesgo: uniones semánticas falsas.
- No tocar: fusión automática ni borrar registros. Gate 5M candidatos selectivos.

### F9 — Consolidación y exportación trazable

- Objetivo/dependencias: resultado sin destruir origen; F1/F4/F8.
- Tablas: consolidation runs/lineage, records nuevos y history; mappings existentes reutilizados.
- Servicios/UI/endpoints: preview/confirm consolidation y modos de exportación autorizados.
- Tareas: [ ] mapping equivalencia/transformación/diferente; [ ] resolución de conflictos y revisiones fijas; [ ] resultado/lineage atómico; [ ] revertir/archivar resultado y exportar fuentes.
- Compatibilidad: exportación vieja sigue significado documentado; nuevo modo se elige, no cambia por vínculo.
- Tests/aceptación: tres exportaciones reproducibles, geometría/provenance conservadas, fuentes intactas, retry único, cambios post-preview invalidan confirmación. Riesgo: historial histórico perdido no reconstruible.
- No tocar: event sourcing completo ni sync automático de consolidado.

### F10 — Migración explícita y retirada de compatibilidad

- Objetivo/dependencias: cerrar contratos sin big bang, F9.
- Tablas: validar y retirar columnas derivadas viejas solo con cero consumidores; posible migración de pertenencia con lineage.
- Servicios/UI/endpoints: quitar rutas DTO antiguas tras telemetría y deprecación; ningún módulo reescrito por estética.
- Tareas: [ ] auditoría consumidores/backfill; [ ] migrar colección local a App con preview de impacto; [ ] reconciliación; [ ] retirar flags/adaptadores por módulo.
- Compatibilidad: no dual-write; rollback usa release compatible con nuevo schema o deshabilita comando nuevo, nunca elimina datos recientes.
- Tests/aceptación: fixture migrado y restaurado, cero UUID cambiado, no referencia legacy operacional; migración incompatible aborta sin mutaciones. Riesgo: clientes externos desconocidos.
- No tocar: partición física automática.

### F11 — Gate de capacidad y optimizaciones justificadas

- Objetivo/dependencias: certificar carga objetivo, F7–F10; benchmarks previos ya ocurrieron.
- Tablas/servicios/UI/endpoints: solo cuellos medidos de query/import/mapa/tabla; índices o proyecciones con invalidez controlada.
- Tareas: [ ] 10M y distribución realista de PR; [ ] carga mixta y restore; [ ] identificar cuello; [ ] adoptar MVT/cache/partición solo si mejora demostrada.
- Migración/compatibilidad: aditiva por optimización; mantiene contrato de scope/IDs; comparaciones antes/después.
- Tests/aceptación: presupuestos acordados y sin inconsistencias bajo concurrencia; 50M es proyección posterior, no aprobado por extrapolación. Riesgo: I/O/RAM, WAL, vacuum, geometrías grandes y counts.
- No tocar: microservicios, Redis obligatorio o offline completo sin tarea propia.

## 37. Tests y gates de entrega por fase

Cada tarea futura: tests focalizados, `pnpm quality`; integración PostGIS aislada si cambia persistencia; typecheck API/Web, builds y E2E del flujo tocado antes de activar flag. Tests no deben limpiar base del usuario.

Checkpoints: F0–F1 integridad; F2–F3 propiedad/independencia; F4–F5 cuatro importaciones + promoción; F6–F7 geografía/autorización; F8–F9 equivalencia/exportación; F10–F11 compatibilidad/capacidad. Cada checkpoint exige revisión humana y evidencia. “Compila” no es aceptación de datos.

## 38. Benchmark por fase

No se generan datos ahora. Dataset sintético/reproducible separado, complementado con distribución anonimizada real; Points/Lines/Polygons de distinta complejidad, zonas densas/rurales, PR promedio 1/2/5/10. Documentar hardware, versiones, concurrencia, cache fría/caliente y parámetros.

| Gate    | Volumen | Cuándo bloquea                                                                            |
| ------- | ------- | ----------------------------------------------------------------------------------------- |
| Base F0 | 100K    | compara regresiones; fallos de integridad bloquean toda fase                              |
| F4/F6   | 1M      | import/retry, listado cursor, detalle, bbox canónico/contextual, membresía espacial       |
| F7/F8   | 5M      | navegación amplia/agregados, filtros multi-scope, ACL, candidatos sin N²                  |
| F11     | 10M     | carga mixta e índices/invalidación con PR hasta 100M si se pretende soportar esa densidad |

Presupuestos **propuestos para acordar antes de cada benchmark**, no resultados: p95 detalle/tabla ≤500 ms, mapa ≤1 s y p99 ≤2 s a 20 usuarios concurrentes en hardware registrado; respuesta cartográfica ≤2 MB comprimidos y límite de vértices explícito por renderer. Importación debe mantener memoria acotada por lote y cero duplicados al reanudar. Si no se acuerda tasa de ingestión objetivo, no declarar capacidad de importación certificada.

COUNT exacto costoso se separa/asíncrono conservando significado, nunca se etiqueta aproximación como exacta. Bloquean avance al volumen anunciado: scan global no selectivo por bbox pequeño, OFFSET profundo, búsqueda JSON textual sin límite, clustering que excede presupuesto, cache que filtra datos privados, backfill no reconciliable. Evaluar planes/BUFFERS/WAL, latencia cliente y render; no solo tiempo SQL. 50M requiere gate adicional específico, no promesa en F11.

## 39. Riesgos principales

Ownership ambiguo → confirmar B1; historial perdido → explicitar límites; keys homónimas → IDs/versiones; reset accidental → nunca usarlo como migración; API antigua incompatible con locales → flags por capacidad; canonical upsert → detener primero; autorización → gate antes de universal; vínculos incorrectos → confirmación/revocación; fan-out geométrico → query selectiva y benchmark; cache → revisión/ACL en clave; proyecto archivado → no cascade de fuentes.

## 40. Orden recomendado

F0 → F1 → F2 → F3 → F4 → F5 → F6 → F7 → F8 → F9 → F10 → F11. Adelantar identidad/revisión respecto a la secuencia sugerida evita construir importación y consolidación sobre labels y escrituras sin control de concurrencia. Benchmarks empiezan en F0, no al final. Si B1 no se confirma, ejecutar solo protecciones autorizadas y replantear F2, sin inventar un owner provisional.

## 41. Primer cambio de código recomendado, no ejecutado

Test de regresión PostGIS de reimportación B sobre record también presente en A, más corrección acotada del writer contextual/scope. Archivos foco: `shapefile-imports.service.ts`, test de importación y contrato mínimo del núcleo. A/canónico y origen deben mantener hash; B actualiza solo su participación y deja observación. Si el mapping actual no permite hacerlo de forma segura, rechazar el caso con error específico hasta F1/F4, nunca sobrescribir silenciosamente.

## 42. Segundo cambio recomendado, no ejecutado

PATCH de participación con semántica de ausencia/reset y tests; `project-app-records.controller.ts` y `project-records-core.service.ts`. Omitir geometría conserva override; reset explícito hereda; null de atributo no se confunde con ausencia. Esto protege datos antes de cualquier cambio de ownership.

## 43. Qué no tocar todavía y recomendación final

No reset, no nuevo baseline, no renombres masivos, no cambio frontend en esta tarea, no tests escritos hoy, no Redis/MVT obligatorio, no microservicios ni event sourcing. No crear tablas del plan hasta aprobar fase y B1.

Dirección: modelo actual evolucionable; Dataset neutral recomendado para nacimiento local genuino; ProjectRecord necesario, ProjectApp solo para App relacionada; procedencia inmutable más observaciones/cambios append-only; rechazo por pareja persistente; grupo opcional para equivalencia; consolidación en Record nuevo con lineage. Primero detener escrituras canónicas implícitas. El plan está completo como propuesta, aunque B1 debe confirmarse antes del tramo de dominio afectado.
