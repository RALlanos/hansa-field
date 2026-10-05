# Hansa Field — insumo completo para la skill `scrum-proyectos-ia`

## Propósito de este documento

Este documento contiene las respuestas listas para completar los nueve pasos de la skill `scrum-proyectos-ia` en otra IA. Sirve para crear un backlog, sprints y documentación coherentes con el producto que Hansa realmente quiere construir.

No sustituye las decisiones ya aceptadas en `docs/decisions/`. Si la otra IA propone un modelo que contradice este documento, se debe conservar la arquitectura de dominio de Hansa y pedir confirmación antes de modificarla.

## Regla principal para la otra IA

Hansa Field es una plataforma GIS operacional configurable inspirada funcionalmente en Fulcrum, pero no es un clon ni un importador de Excel. Los archivos GIS, Fulcrum y otras fuentes son entradas de datos; no determinan el modelo de producto.

La arquitectura de dominio obligatoria es:

```text
Organización + permisos
        ↓
App maestra
        ↓
AppVersion publicada e inmutable
        ↓
Record canónico
        ↓
Project → ProjectApp → ProjectRecord → Record
```

Reglas que la IA no puede modificar sin una decisión explícita:

- Un Record no tiene `project_id` directo como fuente de verdad.
- Una App publicada no se edita retroactivamente: se crea una AppVersion nueva.
- El ID de un campo o de una opción no es su etiqueta visible.
- Un ProjectRecord puede tener atributos o geometría local sin alterar el Record canónico.
- Un archivo importado termina en los mismos Records que se crean manualmente.
- PostgreSQL/PostGIS es la autoridad geográfica.
- Nunca integrar con ERP leyendo tablas: las futuras integraciones son mediante APIs y contratos explícitos.

---

# Cómo usar este archivo en otra IA

## Preparación

1. Carga o instala `scrum-proyectos-ia.skill` en la otra IA.
2. Abre el repositorio de Hansa Field como contexto de trabajo.
3. Comparte también estos documentos:
   - `AGENTS.md`;
   - `docs/intent/fulcrum-hansa.md`;
   - `docs/decisions/0002-app-master-records-and-project-memberships.md`;
   - `docs/decisions/0004-opciones-de-campo-e-importacion-gis.md`;
   - este archivo.
4. Pega el prompt inicial de la siguiente sección.
5. Cuando la IA avance por los pasos 1 a 9, pega las respuestas preparadas para el paso que solicite.
6. Donde exista `[CONFIRMAR]`, decide la opción antes de aprobar ese paso. No inventes una respuesta si afecta alcance, presupuesto o seguridad.
7. En el Paso 9, revisa el plan, apruébalo y pide que cree la bóveda en `docs/scrum/hansa-field/`.

## Prompt inicial para pegar en la otra IA

```text
Usa la skill scrum-proyectos-ia para planificar Hansa Field. Sigue sus 9 pasos en orden y no implementes código todavía. Usa el archivo HANSA-FIELD-INSUMO-PARA-SCRUM-IA.md como fuente de respuestas y contexto.

La arquitectura de dominio de Hansa Field es obligatoria: Organización → App → AppVersion inmutable → Record canónico; Project → ProjectApp → ProjectRecord → Record. No uses records.project_id como relación directa de negocio, no dupliques Records por Proyecto y no conviertas importación GIS/Excel en el producto principal.

Marca como (supuesto) cualquier dato que no esté confirmado. Antes de crear la bóveda, presenta el plan de sprints, los riesgos y las historias para aprobación.
```

---

# Respuestas preparadas para el formulario de nueve pasos

## Paso 1 — Identidad del proyecto

Pega este bloque como respuesta textual:

```text
Nombre del proyecto: Hansa Field

Problema que resuelve (1 frase): Hansa necesita una plataforma GIS propia para configurar formularios, capturar o importar activos georreferenciados, operarlos en mapa y tabla, y relacionarlos con proyectos sin depender de Fulcrum, planillas dispersas ni acceso directo a datos de ERP.

Usuarios principales (quiénes lo usarán): Administrador de plataforma, administrador de organización, configurador GIS, especialista de importación e integración, director/coordinador de operaciones, gerente de proyecto, supervisor de proyecto, técnico de campo, operador de datos, control de calidad, auditor/gerencia y consulta externa autorizada.

Éxito = (¿qué número mejorará? ej. "registrar una venta en menos de 30 s"): Un técnico autorizado puede localizar, registrar o editar un activo georreferenciado con sus atributos obligatorios en menos de 30 segundos; el mapa responde a zoom/pan en menos de 1 segundo para la vista actual; y 100% de los cambios queda con usuario, fecha, origen y versión de formulario auditables.
```

### Métricas de éxito ampliadas

La IA debe registrar estas métricas en la Visión:

| Objetivo         | Métrica                                     |                       Meta inicial | Momento                |
| ---------------- | ------------------------------------------- | ---------------------------------: | ---------------------- |
| Captura de campo | Crear registro válido con ubicación         |                      ≤ 30 segundos | piloto                 |
| Edición          | Abrir y guardar un registro                 |                      ≤ 10 segundos | piloto                 |
| Consulta         | Encontrar un activo en mapa/filtro/búsqueda |                      ≤ 15 segundos | piloto                 |
| Mapa             | Respuesta perceptible a pan/zoom            |                        ≤ 1 segundo | vista actual           |
| Primera vista    | Mapa + tabla iniciales                      |                       ≤ 3 segundos | conjunto paginado/bbox |
| Calidad          | Registros sin auditoría                     |                                 0% | siempre                |
| Calidad          | Errores de campos obligatorios              | reducir ≥ 80% frente a carga libre | piloto                 |
| Autonomía        | Configuraciones sin cambio de código        |    ≥ 80% de solicitudes habituales | piloto                 |

## Paso 2 — Tipo de sistema y contexto

Elige estas opciones:

| Pregunta    | Respuesta            | Motivo                                                                                                      |
| ----------- | -------------------- | ----------------------------------------------------------------------------------------------------------- |
| Tipo        | Aplicación web       | La operación administrativa, configuración, mapa y tabla se ejecutan primero en navegador.                  |
| Dispositivo | PC y celular         | Oficina opera en PC; campo requiere móvil y conectividad variable. La app móvil entra por fases.            |
| Código      | Hay código existente | Existe Hansa Field, con frontend, API, PostGIS, decisiones de dominio y funcionalidades ya desarrolladas.   |
| Usuarios    | 20 a 200             | Piloto corporativo inicial. Diseñar para crecer por organización y no descargar todos los datos al cliente. |

Nota obligatoria para la IA: Hansa Field no reemplaza un único sistema mediante migración destructiva. Fulcrum, archivos GIS y futuros sistemas corporativos son fuentes externas que se conectan progresivamente mediante APIs y contratos. La dependencia funcional de Fulcrum se reduce de manera gradual.

## Paso 3 — Tiempo, equipo y autonomía

Selecciona inicialmente:

| Pregunta  | Respuesta recomendada | Observación                                                                            |
| --------- | --------------------- | -------------------------------------------------------------------------------------- |
| Plazo     | 12 semanas            | `[CONFIRMAR]` Permite cerrar el núcleo operativo, no todas las capacidades de Fulcrum. |
| Sprint    | 1 semana              | Feedback frecuente con IA y usuarios operativos.                                       |
| Equipo    | 2–3 personas + IA     | `[CONFIRMAR]` Usar “Solo yo + IA” si no habrá segundo revisor humano.                  |
| Autonomía | Implementa y abre PR  | La IA implementa incrementos pequeños; una persona revisa y aprueba.                   |

Texto de roles, ajustable antes de pegar:

```text
PO: Jhon Llanos / responsable de producto de Hansa
SM: [CONFIRMAR responsable de planificación]
Revisa el código de la IA: [CONFIRMAR responsable técnico]
```

Velocidad inicial sugerida con 2–3 personas + IA: **18 puntos por sprint de una semana**. La IA debe recalibrarla después del Sprint 1 con trabajo realmente terminado.

## Paso 4 — Stack tecnológico

El proyecto existente es la fuente de verdad técnica. Responder:

| Capa                  | Tecnología                                                                       | Decisión / motivo                                                             |
| --------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Frontend web          | Next.js + React + TypeScript                                                     | Interfaz operativa compacta: mapa, tabla, filtros, formularios.               |
| Backend               | NestJS + TypeScript                                                              | Monolito modular con controllers, services, contratos y persistencia aislada. |
| Base de datos         | PostgreSQL + PostGIS                                                             | Autoridad geográfica, geometrías con SRID e índices espaciales.               |
| Paquetes              | pnpm monorepo                                                                    | Gestión consistente de web, API y contratos.                                  |
| Infraestructura local | Docker Compose                                                                   | PostgreSQL/PostGIS y servicios locales reproducibles.                         |
| Mapas web             | Leaflet actual; evolución gradual según necesidad                                | No introducir MapLibre/vector tiles sin evidencia y decisión específica.      |
| Pruebas               | TypeScript estricto, pruebas unitarias/integración y PostGIS real cuando aplique | Los flujos de DB/GIS no se validan solo con mocks.                            |
| CI                    | GitHub + GitHub Actions `[supuesto]`                                             | Calidad, tipos, pruebas y build antes de integrar.                            |
| IA                    | Claude Code / Codex `[CONFIRMAR]`                                                | Implementa por historias pequeñas y revisión humana.                          |

### Decisión móvil futura, fuera del MVP web

La IA debe registrar como ADR futuro, no como obligación del Sprint 1:

```text
App móvil: React Native + Expo + TypeScript
Mapa móvil: MapLibre React Native
Datos locales: SQLite y cola de sincronización
Objetivo: Android e iOS desde una base de código, reutilizando contratos HTTP,
tipos y definición de formularios; no reutilizando la interfaz web literalmente.
```

No crear todavía una app móvil ni introducir dependencias móviles en el monorepo sin una historia aprobada.

## Paso 5 — Restricciones y visión

Selecciona y documenta:

| Tema          | Respuesta                                                                                                                                                   |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Integraciones | Correo/WhatsApp como futuro `[supuesto]`; Fulcrum API y formatos GIS son integraciones de datos prioritarias aunque no aparezcan en el formulario estándar. |
| Normativa     | Datos personales. Se debe proteger ubicación, usuarios, evidencias y credenciales de APIs.                                                                  |
| Presupuesto   | 20–100 USD mensuales `[CONFIRMAR]` para piloto; Docker local reduce el gasto inicial.                                                                       |

Restricciones adicionales obligatorias:

- No leer tablas ni usar directamente la base del ERP.
- No guardar secretos, tokens de Fulcrum ni claves en frontend, commits, documentación pública o logs.
- No descargar todos los Records al navegador; usar bbox, filtros, paginación, clustering/simplificación donde corresponda.
- No usar `any`, `@ts-ignore` ni conversiones que oculten problemas de tipos.
- No crear una tabla por App ni EAV por campo; los atributos dinámicos corresponden a JSONB validado.
- No borrar datos compartidos o ejecutar migraciones destructivas sin confirmación explícita.
- Un cambio publicado de formulario debe generar una versión nueva.

### Declaración de visión aprobable

```text
Para los equipos de Hansa que levantan, supervisan y operan activos georreferenciados,
Hansa Field es una plataforma GIS corporativa configurable que permite crear formularios
versionados, capturar o importar Registros, visualizarlos y filtrarlos en mapa y tabla,
y organizarlos en Proyectos con permisos y auditoría. A diferencia de planillas,
importadores aislados o una dependencia total de Fulcrum, Hansa Field mantiene una fuente
de verdad geográfica propia, trazable y adaptable a operaciones de distintos países.
```

### Alcance del MVP web

- Configurar una App y publicar una versión identificable.
- Crear, editar, validar y auditar Records con geometría.
- Ver el mismo conjunto operativo en mapa, tabla y vista dividida según bbox/filtros.
- Gestionar ProjectApps y ProjectRecords sin duplicar Records canónicos.
- Importar GIS mediante inspección, mapeo, preview, confirmación y reporte de incidencias.
- Configurar opciones por campo y simbología por valor, por ejemplo `Estado`.

### Fuera de alcance inicial

- Replicar todas las funciones de Fulcrum.
- Importador Excel/CSV de catálogos como flujo principal.
- Automatizaciones complejas, reportes decorativos o dashboards ERP.
- Sincronización móvil offline completa.
- Crear Apps/Proyectos automáticamente por cada valor de `Estado`.

## Paso 6 — Personas

Hansa Field tendrá más roles que las cuatro personas que se usan para iniciar el backlog. La skill limita el Paso 6 a cuatro personas porque un MVP no debe intentar resolver la experiencia completa de todos a la vez.

Selecciona inicialmente las cuatro personas prioritarias que siguen y registra las demás como roles del producto o como personas de fases posteriores.

### Adriana — administradora de plataforma

- Contexto: administra organizaciones, usuarios, Apps, permisos y configuraciones generales.
- Objetivo: habilitar nuevas Apps confiables sin solicitar cambios técnicos para cada campo.
- Frustración: formularios rígidos, configuraciones dispersas y falta de trazabilidad sobre cambios.
- Dispositivo: PC.

### Gabriel — configurador GIS y datos

- Contexto: prepara capas, revisa atributos, importa fuentes GIS y mantiene simbología.
- Objetivo: mapear datos de Shapefile/KML/GeoJSON/Fulcrum a una App sin corromper datos ni perder incidencias.
- Frustración: importaciones opacas, columnas ambiguas y estilos que no reflejan los atributos reales.
- Dispositivo: PC con mapa y tabla densos.

### Sofía — supervisora de proyecto

- Contexto: consulta activos de uno o varios Proyectos y necesita datos locales sin alterar la fuente maestra.
- Objetivo: filtrar, revisar y asignar participaciones del Proyecto con evidencia de origen.
- Frustración: duplicados entre proyectos y cambios locales que modifican datos globales.
- Dispositivo: PC y tablet.

### Diego — técnico de campo

- Contexto: captura o corrige activos cerca de una ubicación, con conectividad irregular.
- Objetivo: registrar o editar un activo válido en menos de 30 segundos, con GPS, formulario y evidencia.
- Frustración: formularios lentos, datos repetidos y pérdida de trabajo cuando no hay conexión.
- Dispositivo: celular Android inicialmente; iOS después.

### Catálogo completo de roles de Hansa Field

La otra IA debe incluir este catálogo en `Roles y stakeholders.md`. No todos reciben los mismos permisos ni todos entran al primer Sprint.

| Rol                                   | Qué hace                                                                                   | Alcance habitual                                                         | Prioridad |
| ------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------- |
| Administrador de plataforma           | Define políticas globales, soporte, parámetros y seguridad de la plataforma.               | Todas las organizaciones, solo si se autoriza explícitamente.            | Must      |
| Administrador de organización         | Gestiona usuarios, grupos, roles y acceso dentro de su empresa/país.                       | Una organización.                                                        | Must      |
| Configurador de Apps                  | Diseña Apps, campos, secciones, opciones, simbología y publica versiones.                  | Apps autorizadas.                                                        | Must      |
| Especialista GIS                      | Revisa capas, CRS, geometrías, atributos, estilos y calidad espacial.                      | Capas/Apps autorizadas.                                                  | Must      |
| Operador de importación               | Ejecuta inspección, mapeo, preview y confirmación de importaciones.                        | Fuentes y Apps autorizadas.                                              | Should    |
| Integrador de sistemas                | Conecta Fulcrum, ERP por API, servicios corporativos u otras fuentes.                      | Contratos y credenciales autorizadas; nunca acceso directo a tablas ERP. | Should    |
| Director o coordinador de operaciones | Consulta cobertura, avance, incidencias y capacidad entre proyectos/regiones.              | Proyectos, territorios y reportes autorizados.                           | Should    |
| Gerente de proyecto                   | Crea/configura Proyectos, ProjectApps, responsables y alcance operativo.                   | Sus Proyectos.                                                           | Must      |
| Supervisor de proyecto                | Revisa, asigna, valida y corrige participaciones del Proyecto.                             | Sus Proyectos y equipos.                                                 | Must      |
| Técnico de campo                      | Consulta, crea y edita Records autorizados; captura GPS, fotos y evidencias.               | Apps/Proyectos asignados.                                                | Must      |
| Operador de datos                     | Normaliza, completa, corrige y valida atributos desde oficina.                             | Apps/Proyectos asignados.                                                | Should    |
| Control de calidad                    | Revisa incidencias, duplicados, geometrías inválidas y cumplimiento de formularios.        | Registros dentro de su alcance, con capacidad de aprobar/rechazar.       | Should    |
| Auditor                               | Consulta trazabilidad, versiones, cambios, importaciones y evidencias sin modificar datos. | Alcance de auditoría otorgado.                                           | Must      |
| Consulta / cliente                    | Visualiza mapas, tablas o reportes aprobados sin editar.                                   | Capas, Proyectos o vistas explícitamente compartidas.                    | Could     |
| Contratista externo                   | Ejecuta trabajo de campo limitado para un contrato o zona.                                 | Apps/Proyectos asignados, con expiración de acceso.                      | Could     |

### Regla de permisos

Los permisos no se resuelven únicamente por nombre de rol. Cada autorización debe combinar:

```text
Organización
→ rol/grupo
→ acción (ver, crear, editar, publicar, importar, retirar, auditar)
→ alcance (App, Project, ProjectApp, territorio o conjunto permitido)
```

Ejemplos:

- Un configurador de Apps puede publicar una versión, pero no necesariamente importar datos de todos los Proyectos.
- Un supervisor puede editar un `ProjectRecord` local, sin poder cambiar el Record canónico.
- Un auditor puede ver el historial sin editar.
- Un contratista puede crear Records en una App y territorio asignados durante un periodo, pero no descargar todo el universo de datos.

## Paso 7 — Épicas y prioridad MoSCoW

Propón estas ocho épicas y prioridades. La IA puede dividirlas, pero no fusionar niveles de dominio incompatibles.

| ID   | Épica                              | Descripción                                                                                       | Persona principal | Prioridad |
| ---- | ---------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------- | --------- |
| EP-1 | Organización, acceso y auditoría   | Organización activa, autenticación, roles mínimos, autorización de API y trazabilidad de cambios. | Adriana           | Must      |
| EP-2 | Diseñador de Apps y versiones      | Crear Apps, secciones, campos, validaciones, opciones y publicar AppVersions inmutables.          | Adriana           | Must      |
| EP-3 | Operación de Records               | Crear, ver, editar, validar y auditar Records canónicos con geometría.                            | Diego             | Must      |
| EP-4 | Mapa, tabla y filtros operativos   | Bbox, filtros, tabla sincronizada, selección, simbología y rendimiento GIS.                       | Sofía             | Must      |
| EP-5 | Proyectos y participaciones        | Project, ProjectApp y ProjectRecord con atributos/geométría locales aislados.                     | Sofía             | Must      |
| EP-6 | Importación e integración de datos | Importar GIS y fuentes externas mediante el mismo contrato de Records; preview y auditoría.       | Gabriel           | Should    |
| EP-7 | Catálogos y simbología por valor   | Opciones dentro de campos, color/icono por valor y lista compartida avanzada.                     | Gabriel           | Should    |
| EP-8 | Operación móvil sin conexión       | App React Native, GPS, cámara, caché local y sincronización.                                      | Diego             | Could     |

### Orden obligatorio de dependencias

```text
EP-1 → EP-2 → EP-3 → EP-4
                    ↘ EP-5
EP-2 + EP-3 → EP-6 + EP-7
EP-1 + EP-2 + EP-3 + EP-4 → EP-8
```

La otra IA no debe priorizar importación, mapas avanzados o móvil por encima de identidad, versión de formulario, validación y Record canónico.

## Paso 8 — Reglas medibles e historias

La otra IA debe preguntar por las reglas de negocio que sigan abiertas y proponer las historias siguientes. Las historias están deliberadamente pequeñas; cada una debe tener criterios `Dado / Cuando / Entonces`, al menos un caso de error y notas para la IA.

### EP-1 — Organización, acceso y auditoría (Must)

| ID     | Historia                                                                                                              | Puntos | Reglas / criterios mínimos                                                               |
| ------ | --------------------------------------------------------------------------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------- |
| HU-1.1 | Como administradora, quiero operar con una organización activa para que los datos no se mezclen entre organizaciones. |      5 | Usuario sin organización activa no obtiene datos; toda consulta filtra por organización. |
| HU-1.2 | Como administradora, quiero roles mínimos de lectura y edición para controlar quién modifica información.             |      5 | API rechaza escritura no autorizada aunque el frontend oculte botones.                   |
| HU-1.3 | Como auditora, quiero consultar creador, fecha, origen y cambios de un Record para investigar modificaciones.         |      5 | Cada mutación registra actor, fecha, entidad, operación y origen.                        |

### EP-2 — Diseñador de Apps y versiones (Must)

| ID     | Historia                                                                                                              | Puntos | Reglas / criterios mínimos                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------- | -----: | --------------------------------------------------------------------------------------- |
| HU-2.1 | Como administradora, quiero crear una App con nombre, código y geometrías permitidas para definir un tipo de activo.  |      3 | Código único por organización; al menos una geometría permitida.                        |
| HU-2.2 | Como administradora, quiero añadir secciones y campos con IDs estables para diseñar formularios reutilizables.        |      8 | Renombrar `Altura` no cambia su fieldId; tipo de campo no cambia silenciosamente.       |
| HU-2.3 | Como administradora, quiero configurar requerido, opciones, límites y reglas por campo para prevenir datos inválidos. |      8 | Validación en cliente y API; campo oculto conserva/elimina valor según regla explícita. |
| HU-2.4 | Como administradora, quiero publicar una versión de App para que los cambios no alteren formularios históricos.       |      5 | Versión publicada inmutable; nueva edición crea una versión nueva.                      |

### EP-3 — Operación de Records (Must)

| ID     | Historia                                                                                                        | Puntos | Reglas / criterios mínimos                                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------- |
| HU-3.1 | Como técnico, quiero crear un Record desde el formulario de la App para registrar un activo válido.             |      8 | Debe respetar AppVersion, validaciones y geometría permitida; error visible si falla.             |
| HU-3.2 | Como técnico, quiero editar un Record sin perder sus datos ni historial para corregir información de campo.     |      8 | Conserva UUID; cada edición queda auditada; no modifica una participación local de otro Proyecto. |
| HU-3.3 | Como técnico, quiero cargar la información completa solo al abrir un Record para que el mapa permanezca rápido. |      5 | Lista/mapa usan resumen; detalle bajo demanda.                                                    |

### EP-4 — Mapa, tabla y filtros (Must)

| ID     | Historia                                                                                                                               | Puntos | Reglas / criterios mínimos                                                                                             |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------------------------------- |
| HU-4.1 | Como supervisora, quiero ver Records del bbox actual en mapa y tabla para trabajar sobre la misma área.                                |      8 | Pan/zoom actualiza consulta; tabla no muestra Records fuera del viewport; respeta filtros y ProjectApps seleccionadas. |
| HU-4.2 | Como supervisora, quiero filtrar por App, Proyecto, campo y Estado para ubicar activos relevantes.                                     |      5 | Un mismo filtro produce el mismo conjunto en mapa y tabla; estado vacío no equivale a todos.                           |
| HU-4.3 | Como supervisora, quiero que puntos se agrupen al alejarme y líneas/polígonos se representen eficientemente para mantener rendimiento. |      8 | Nunca descargar todos los Records; límites de payload, clustering y simplificación solo visual.                        |
| HU-4.4 | Como configurador GIS, quiero usar Estado como campo de simbología para ver color/icono por tipo de activo.                            |      5 | Fallback al estilo de App si no existe estilo de opción; leyenda y filtro usan misma configuración.                    |

### EP-5 — Proyectos y participaciones (Must)

| ID     | Historia                                                                                                               | Puntos | Reglas / criterios mínimos                                                                                                     |
| ------ | ---------------------------------------------------------------------------------------------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------ |
| HU-5.1 | Como supervisora, quiero agregar una App a un Proyecto como ProjectApp para configurar su uso local.                   |      5 | Solo aparecen ProjectApps del Proyecto actual; no altera App maestra.                                                          |
| HU-5.2 | Como supervisora, quiero incorporar un Record existente a un Proyecto para reutilizar el mismo activo sin duplicarlo.  |      5 | Mismo recordUuid, distinto projectRecordUuid por Proyecto; impedir dos participaciones activas iguales en la misma ProjectApp. |
| HU-5.3 | Como supervisora, quiero aplicar atributos o geometría local a una participación para registrar contexto del Proyecto. |      8 | Override en B no altera Record canónico ni participación A; resolución efectiva documentada.                                   |
| HU-5.4 | Como supervisora, quiero retirar una participación sin borrar el Record para cerrar el alcance local con seguridad.    |      3 | Se retira ProjectRecord; Record canónico y otros Proyectos siguen disponibles.                                                 |

### EP-6 — Importación e integración de datos (Should)

| ID     | Historia                                                                                                                             | Puntos | Reglas / criterios mínimos                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------ | -----: | ------------------------------------------------------------------------------------------------ |
| HU-6.1 | Como configurador GIS, quiero inspeccionar un archivo GIS y elegir su capa para conocer geometrías y columnas antes de importar.     |      5 | Detecta archivo inválido, CRS y geometría incompatible.                                          |
| HU-6.2 | Como configurador GIS, quiero mapear columnas del archivo a fieldIds de una App para importar con el contrato normal de Records.     |      8 | Normaliza tipos, valida opciones y muestra preview antes de persistir.                           |
| HU-6.3 | Como configurador GIS, quiero decidir cómo tratar valores de selección desconocidos para evitar cambios invisibles en la App.        |      5 | Rechazar, omitir o crear opción nueva con confirmación explícita y nueva versión cuando aplique. |
| HU-6.4 | Como configurador GIS, quiero recibir un reporte auditable de importación para revisar nuevos, actualizados, omitidos e incidencias. |      5 | UUID conocido actualiza candidato; UUID ausente crea; UUID inexistente suministrado es error.    |

### EP-7 — Catálogos y simbología por valor (Should)

| ID     | Historia                                                                                                                               | Puntos | Reglas / criterios mínimos                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------- | -----: | ----------------------------------------------------------------------------------- |
| HU-7.1 | Como administradora, quiero crear opciones dentro de un campo de selección para configurar Estado, Tipo o Material sin importar Excel. |      5 | Crear, ordenar, desactivar; optionId estable al renombrar.                          |
| HU-7.2 | Como configurador GIS, quiero asignar color e icono a una opción para representar Records de manera legible.                           |      3 | Simbología es visual, no cambia geometría ni valor canónico.                        |
| HU-7.3 | Como administradora, quiero elegir una lista compartida solo cuando varias Apps deban reutilizarla intencionalmente.                   |      5 | No aparece como módulo principal; cambios no reinterpretan historia sin versionado. |

### EP-8 — Operación móvil sin conexión (Could)

| ID     | Historia                                                                                               | Puntos | Reglas / criterios mínimos                                          |
| ------ | ------------------------------------------------------------------------------------------------------ | -----: | ------------------------------------------------------------------- |
| HU-8.1 | Como técnico, quiero descargar el área y formularios autorizados para trabajar sin conexión.           |      8 | Límite explícito de área/datos; indica vigencia de caché.           |
| HU-8.2 | Como técnico, quiero guardar capturas offline en una cola local para no perder trabajo.                |      8 | Reintentos, estados y conflicto visible al sincronizar.             |
| HU-8.3 | Como técnico, quiero capturar ubicación y evidencia desde Android/iOS para documentar mi intervención. |      8 | Permisos de dispositivo, error de GPS/cámara y metadatos de origen. |

## Paso 9 — Plan de sprints, riesgos y definición de terminado

### Plan inicial de 12 sprints de una semana

La IA debe recalcular al aprobar historias reales. Este es un plan de referencia, no autorización para construir todo simultáneamente.

| Sprint | Objetivo                          | Historias candidatas   | Puntos aprox. |
| ------ | --------------------------------- | ---------------------- | ------------: |
| 01     | Contratos y seguridad mínima      | HU-1.1, HU-1.2         |            10 |
| 02     | Auditoría y App básica            | HU-1.3, HU-2.1         |             8 |
| 03     | Campos y versiones                | HU-2.2                 |             8 |
| 04     | Validaciones y publicación        | HU-2.3, HU-2.4         |            13 |
| 05     | Crear Records                     | HU-3.1                 |             8 |
| 06     | Editar y detalle eficiente        | HU-3.2, HU-3.3         |            13 |
| 07     | Mapa y tabla por bbox             | HU-4.1                 |             8 |
| 08     | Filtros y rendimiento             | HU-4.2, HU-4.3         |            13 |
| 09     | Simbología inicial y ProjectApp   | HU-4.4, HU-5.1         |            10 |
| 10     | Participaciones y overrides       | HU-5.2, HU-5.3, HU-5.4 |            16 |
| 11     | Inspección y mapeo GIS            | HU-6.1, HU-6.2         |            13 |
| 12     | Validación importación y opciones | HU-6.3, HU-6.4, HU-7.1 |            15 |

El total propuesto supera una velocidad conservadora de 18 puntos por sprint solo si cada historia se subdivide y se termina íntegramente. Si el equipo real es menor, se debe mover EP-6 y EP-7 a un lanzamiento posterior, no reducir calidad ni eliminar pruebas.

### Riesgos principales

| ID  | Riesgo                                                                                              | Probabilidad | Impacto | Respuesta                                                                                 |
| --- | --------------------------------------------------------------------------------------------------- | -----------: | ------: | ----------------------------------------------------------------------------------------- |
| R1  | Mezclar arquitectura de dominio de Hansa con modelos temporales o con `records.project_id` directo. |            3 |       5 | ADR obligatorio, revisión de contratos y pruebas de aislamiento.                          |
| R2  | Importación masiva degrada API/mapa o descarga universos completos al navegador.                    |            4 |       5 | Bbox, paginación, límites, índices PostGIS, perfiles y pruebas con datos representativos. |
| R3  | Cambios de Apps/opciones reinterpreten datos históricos.                                            |            3 |       5 | AppVersion inmutable, fieldId/optionId estables, versionado de catálogos.                 |
| R4  | Claves de Fulcrum u otros proveedores se filtren en repositorio, navegador o logs.                  |            3 |       5 | Secret manager/variables de entorno, backend como único consumidor, rotación y auditoría. |
| R5  | IA implemente UI o rutas sin contratos y rompa flujos existentes.                                   |            4 |       4 | Una historia por PR, tipos, pruebas, revisión humana, no rediseñar por intuición.         |
| R6  | Requisitos móviles/offline entren antes de cerrar el flujo web.                                     |            3 |       4 | Mantener EP-8 como Could y diseñar contratos reutilizables desde el núcleo.               |

### Definición de Terminado específica de Hansa Field

Además de la Definition of Done de la skill, una historia de Hansa Field está terminada solamente cuando:

- Cumple todos sus criterios de aceptación y tiene pruebas pertinentes.
- `pnpm quality`, typecheck, pruebas y build aplicables pasan.
- Todo endpoint valida autorización en backend; no depende de ocultar controles web.
- Cambios GIS tienen SRID explícito, validación de geometría y consulta/index PostGIS si modifican persistencia o bbox.
- Cambios a Apps/campos/opciones preservan IDs estables y versiones publicadas.
- Cambios de Proyecto no modifican silenciosamente Records canónicos ni otro Proyecto.
- Los estados de carga, vacío, error y límite están representados en UX operativa.
- No se agregaron secretos, datos personales de prueba ni dependencias sin revisión.
- Documentación y contratos se actualizaron si cambió un límite de módulo, API o modelo de datos.
- Una persona revisó el cambio antes de aprobarlo.

---

# Preguntas que debes responder antes de aprobar el Paso 9

Estas decisiones no deben quedar como suposiciones eternas:

1. ¿El MVP debe ser de 4, 8 o 12 semanas?
2. ¿Quién será Scrum Master y quién revisa cambios de IA?
3. ¿El piloto inicial tendrá menos de 20 usuarios, 20–200 o más?
4. ¿Qué proveedor o estrategia de autenticación se aprobó para el piloto?
5. ¿Qué integración externa entra realmente al primer lanzamiento: ninguna, Fulcrum, GIS local, correo/WhatsApp u otra?
6. ¿La importación GIS es Must para el primer piloto o debe quedar para el lanzamiento siguiente?
7. ¿Qué rol podrá publicar una AppVersion y quién podrá crear opciones nuevas durante una importación?
8. ¿El móvil offline se compromete para una fecha concreta o queda explícitamente en `Could`?

---

# Resultado esperado de la otra IA

Tras aprobar el Paso 9, la otra IA debe crear la bóveda en:

```text
docs/scrum/hansa-field/
```

Debe incluir, como mínimo:

- visión y métricas de Hansa Field;
- roles y personas;
- épicas, historias y criterios verificables;
- plan de sprints y tablero del Sprint 01;
- riesgos;
- definición de terminado específica de Hansa;
- ADRs para el stack, PostGIS, versiones de Apps y participación de Proyecto;
- un `CLAUDE.md` o ampliación de `AGENTS.md` que apunte a la bóveda;
- un estacionamiento de ideas con funcionalidades postergadas.

No debe generar código ni migraciones durante esta planificación. La primera implementación posterior debe ser una historia aprobada del Sprint 01.
