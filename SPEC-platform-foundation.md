# Spec (borrador): `platform-foundation`

## Estado

**Fase 1 - Specify, pendiente de revisión humana.** Este documento define la fundación y compara tecnologías; no autoriza todavía la implementación.

## Objetivo

Establecer una base ejecutable, mantenible y medible para Hansa Field antes de desarrollar Apps, proyectos o registros. La fundación debe decidir el stack, organizar el monolito modular, soportar datos geográficos y archivos grandes, y dejar contratos estables para incorporar usuarios y permisos sin reescribir los módulos de dominio.

### Usuarios de esta fundación

- El equipo de desarrollo formado por el usuario responsable y Codex.
- El área piloto que actualmente utiliza Fulcrum, como primer validador funcional.
- Los futuros módulos de Hansa Field, como consumidores de contratos internos.

### Éxito de la fundación

La fundación se considera validada cuando puede ejecutar un recorrido técnico mínimo: cargar un archivo geográfico de muestra como trabajo asíncrono, validarlo, persistir geometrías y atributos, consultar únicamente la extensión visible del mapa, mostrarla en web y producir una exportación reproducible; todo con pruebas, logs y sin depender de usuarios reales.

## Supuestos que estamos haciendo

1. Hansa Field será un producto, repositorio, despliegue y base de datos separados del ERP, aunque use el mismo servidor y el mismo estilo operativo de Docker/Linux.
2. La primera interfaz será web de escritorio/responsiva; Android y offline pertenecen a una fase posterior.
3. El prototipo no tendrá login ni administración de usuarios. Un `ExecutionContext` técnico representará a un operador único con acceso total.
4. El backend será un monolito modular: un proceso/despliegue de API con módulos encapsulados, no microservicios.
5. La interfaz web podrá desplegarse en su propio contenedor sin convertir los módulos de negocio en servicios distribuidos.
6. PostgreSQL con PostGIS será la autoridad para geometrías y registros; los archivos originales y evidencias se almacenarán fuera de la base mediante un contrato S3-compatible.
7. SHP/ZIP, KML/KMZ, CSV y GeoJSON serán formatos de intercambio. La primera versión también incorporará DWG/DXF mediante una etapa controlada de normalización CAD a GIS.
8. Una App de datos tendrá una definición versionada; sus registros combinarán columnas estructurales estables con valores dinámicos validados.
9. La referencia de escala inicial es de 70 Apps y aproximadamente 8.000 registros por App, pero ninguna decisión debe imponer ese número como límite.
10. Los registros pertenecen primero a una App global. Los proyectos organizan referencias a Apps y subconjuntos de sus registros sin duplicar ni convertirse en la fuente maestra.
11. Una App podrá admitir conjuntamente puntos, líneas y polígonos cuando su proceso operativo lo requiera; el tipo de objeto determinará la geometría, validaciones y simbología de cada registro.

→ Estos supuestos deben corregirse antes de aprobar la especificación.

## Recomendación tecnológica preliminar

### Dirección recomendada

Reutilizar el ecosistema operativo ya conocido por Hansa, pero iniciar Hansa Field en un repositorio y base independientes:

| Capa                | Recomendación                                                                         | Motivo                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime             | Node.js 24 LTS                                                                        | Es una versión LTS vigente y apta para producción; evita Node 20, que ya está EOL.                                                      |
| Lenguaje            | TypeScript                                                                            | Unifica backend, web, contratos y validación; el ERP actual ya lo utiliza.                                                              |
| Backend             | NestJS 12                                                                             | Sus módulos encapsulan proveedores y exponen interfaces explícitas, ajustándose al monolito modular.                                    |
| Web                 | Next.js 16 + React 19                                                                 | Compatible con despliegue Node/Docker y con la experiencia existente del ERP.                                                           |
| Base de datos       | PostgreSQL 16/17 + PostGIS 3.6 estable                                                | Mantiene datos relacionales, JSON dinámico y geometrías indexadas dentro de transacciones consistentes.                                 |
| Acceso SQL          | SQL-first mediante `pg` y una capa tipada evaluada entre Kysely y consultas generadas | PostGIS es central y Prisma no soporta actualmente sus tipos geográficos de forma nativa.                                               |
| Mapas               | MapLibre GL JS 6                                                                      | Renderizado WebGL, GeoJSON y teselas vectoriales; ofrece un camino de crecimiento más adecuado que cargar miles de marcadores DOM.      |
| Conversión GIS      | GDAL/OGR en contenedor de trabajo                                                     | Lee, valida y transforma SHP, KML, GeoJSON y PostgreSQL sin implementar parsers propios de producción.                                  |
| Trabajos asíncronos | Redis + BullMQ                                                                        | Separa importaciones y exportaciones grandes de las solicitudes HTTP y permite estados, reintentos y progreso.                          |
| Apps/formularios    | JSON Schema versionado + Ajv; UI Schema separado                                      | La definición es portable y validable tanto en servidor como en cliente. El constructor visual no se acopla a la forma de persistencia. |
| Archivos            | Contrato S3-compatible; almacenamiento local solo en desarrollo                       | Permite conservar originales, evidencias y exportaciones sin inflar PostgreSQL.                                                         |
| Pruebas             | Unitarias e integración con Vitest; E2E con Playwright; PostGIS/Redis reales en CI    | La fundación debe probar contratos y consultas espaciales contra servicios reales.                                                      |
| Empaquetado         | pnpm workspace + Docker Compose                                                       | Un repositorio, versiones coherentes y despliegue reproducible.                                                                         |

### Evidencia oficial revisada

- NestJS recomienda módulos de funciones para agrupar capacidades y encapsula los proveedores por defecto: <https://docs.nestjs.com/modules>.
- Node.js recomienda utilizar únicamente versiones Active LTS o Maintenance LTS; Node 24 figura como LTS: <https://nodejs.org/en/about/previous-releases>.
- Next.js admite despliegue completo como servidor Node o contenedor Docker: <https://nextjs.org/docs/app/getting-started/deploying>.
- PostGIS almacena, indexa y procesa geometrías junto a los datos relacionales: <https://postgis.net/docs/manual-3.7/en/postgis_introduction.html>.
- PostGIS documenta GiST como índice espacial principal y aconseja indexar al superar algunos miles de filas: <https://www.postgis.net/docs/using_postgis_dbmanagement.html>.
- PostgreSQL permite indexar documentos `jsonb` mediante GIN: <https://www.postgresql.org/docs/16/datatype-json.html#JSON-INDEXING>.
- Prisma reconoce que no ofrece soporte geográfico PostGIS nativo y requiere campos `Unsupported`/SQL crudo: <https://docs.prisma.io/docs/orm/prisma-client/using-raw-sql/safeql>.
- GDAL `ogr2ogr` convierte entre Shapefile, KML, GeoJSON y PostgreSQL: <https://gdal.org/en/stable/programs/ogr2ogr.html>.
- MapLibre recomienda URL, agrupación y teselas vectoriales para grandes conjuntos GeoJSON: <https://maplibre.org/maplibre-gl-js/docs/guides/large-data/>.
- JSON Schema permite declarar explícitamente el dialecto usado por cada definición: <https://json-schema.org/understanding-json-schema/reference/schema>.

## Alternativas consideradas

### A. TypeScript/NestJS/Next.js/PostGIS - recomendada

- **Ventaja:** maximiza reutilización del conocimiento y operación actuales de Hansa.
- **Ventaja:** contratos compartidos entre web y backend.
- **Riesgo:** el acceso PostGIS debe diseñarse conscientemente; no conviene esconderlo detrás de un ORM sin soporte geográfico real.

### B. .NET/ASP.NET Core/PostGIS

- **Ventaja:** plataforma robusta y tipada para aplicaciones corporativas.
- **Costo:** introduce otro ecosistema, toolchain y patrón de despliegue sin una necesidad confirmada.
- **Decisión:** no recomendada salvo que Hansa tenga una política corporativa o experiencia .NET no mencionada.

### C. Python/Django o FastAPI/PostGIS

- **Ventaja:** ecosistema GIS y procesamiento de datos muy amplio.
- **Costo:** separa contratos web/backend y diverge del ERP existente.
- **Uso posible:** procesos GIS especializados aislados solo si GDAL CLI no cubre una necesidad real; no como backend principal inicial.

## Diseño del repositorio

```text
apps/
  api/                         -> NestJS; composición del monolito modular
  web/                         -> Next.js; interfaz web
packages/
  contracts/                   -> tipos, esquemas de entrada/salida y códigos de error
  config/                      -> carga y validación de configuración
  testing/                     -> fixtures y utilidades compartidas
modules/
  platform-foundation/         -> contexto de ejecución, errores, eventos, trabajos y puertos
  workspaces-and-projects/     -> módulo posterior
  app-builder/                 -> módulo posterior
  records-and-assets/          -> módulo posterior
infra/
  docker/                      -> imágenes y configuración local
  migrations/                  -> migraciones SQL versionadas
  gdal/                        -> imagen/proceso de conversión GIS
docs/
  intent/                      -> intención confirmada
  discovery/                   -> evidencia y muestras
  architecture/                -> ADR y contratos
tests/
  e2e/                         -> recorridos completos
```

Cada módulo será propietario de sus tablas y contratos. Un módulo no importará repositorios internos de otro; utilizará su interfaz pública o eventos internos. La base física puede ser única, pero la propiedad lógica no lo será.

## Contratos mínimos de la fundación

```ts
export interface ExecutionContext {
  principalId: string;
  mode: "SYSTEM_OPERATOR" | "AUTHENTICATED_USER";
}

export interface AuthorizationPort {
  can(
    context: ExecutionContext,
    capability: string,
    resource: ResourceRef,
  ): Promise<boolean>;
}

export interface JobPort<TInput> {
  enqueue(input: TInput, idempotencyKey: string): Promise<{ jobId: string }>;
}

export interface ObjectStoragePort {
  put(input: {
    key: string;
    contentType: string;
    stream: NodeJS.ReadableStream;
  }): Promise<void>;
  get(key: string): Promise<NodeJS.ReadableStream>;
}
```

Durante el prototipo, `AuthorizationPort` tendrá una implementación que concede todas las capacidades al operador técnico. Los módulos deberán seguir consultando el puerto para que la autorización real pueda añadirse sin modificar sus casos de uso.

## Modelo inicial de datos dinámicos

La fundación debe validar un modelo híbrido:

- Tablas relacionales para organización, proyecto, App, versión de esquema, registro, archivo, geometría e historial.
- Una asociación versionable `project_app` representará qué Apps utiliza cada proyecto y su configuración contextual, sin copiar la definición de la App ni sus registros maestros.
- La configuración `project_app` actuará como una capa declarativa sobre la App base: podrá activar u ocultar campos, cambiar su obligatoriedad, aplicar valores predeterminados y reglas condicionales, y habilitar complementos propios del contexto, como exigir fotografías solo en un proyecto.
- También podrá definir campos nuevos exclusivos de esa asociación. Estos campos tendrán identificadores estables y procedencia `PROJECT_APP`; sus valores se almacenarán en la membresía contextual del registro y no modificarán el registro maestro ni aparecerán en otros proyectos.
- El formulario efectivo se resolverá como `versión de App base + versión de configuración project_app`. Por ejemplo, una variante FTTH preconectorizada podrá desactivar `fusiones` sin crear otra App ni producir columnas vacías innecesarias.
- Desactivar un campo base en un proyecto afecta su captura, visualización y exportación dentro de ese contexto, pero no elimina el campo de la App base ni los datos válidos de otros proyectos.
- La capa contextual no modificará ni bifurcará silenciosamente la definición base. Tendrá versión, previsualización de diferencias y validación de compatibilidad cuando cambie la App principal.
- El punto de entrada definirá el alcance propuesto de edición: desde un proyecto se editará su configuración `project_app`; desde la vista global de la App se preparará una nueva versión base que afecta a todos los proyectos vinculados.
- La navegación no será la única protección contra cambios masivos. Antes de publicar, la interfaz mostrará explícitamente `Solo este proyecto` o `Todos los proyectos que usan esta App`, el conteo afectado, las incompatibilidades y una confirmación acorde al impacto.
- Al publicar una nueva versión base, cada asociación `project_app` se reevaluará. Los proyectos compatibles podrán adoptarla según la política definida; los que requieran decisión quedarán en `ACTUALIZACION_PENDIENTE` con opciones para activar/configurar el campo, ocultarlo localmente o resolver conflictos.
- Un proyecto con `ACTUALIZACION_PENDIENTE` continuará operando con su última combinación estable de App y configuración contextual; la actualización global no bloqueará por defecto la captura, edición, consulta ni exportación.
- La plataforma mostrará una alerta persistente que identifique el proyecto, la App modificada, la versión nueva y un resumen de campos o reglas añadidos, modificados o retirados. También ofrecerá una comparación completa entre la versión utilizada y la disponible.
- Una versión publicada será inmutable. Si una actualización resulta incorrecta, la plataforma permitirá restaurar una versión anterior creando una nueva versión de reversión; no borrará ni reescribirá el historial ya publicado.
- Antes de revertir se analizará el impacto sobre configuraciones de proyecto y datos creados con versiones posteriores, aplicando los mismos controles de migración y sin descartar valores silenciosamente.
- Si el cambio introduce información obligatoria, los registros históricos aplicarán el flujo `REQUIERE_ACTUALIZACION`; no se crearán valores ficticios ni se perderán datos para aparentar compatibilidad.
- Cada registro pertenecerá a una App y podrá asociarse después a uno o varios proyectos mediante una membresía `project_record`. Editar desde un proyecto actualizará los campos maestros de la App y, por separado, los campos exclusivos de esa membresía contextual.
- `jsonb` para valores configurables del formulario.
- Columna PostGIS `geometry` con SRID interno uniforme.
- Campos promovidos/indexados cuando una definición de App requiera búsquedas frecuentes, unicidad o relaciones.
- Definiciones JSON Schema inmutables por versión; publicar una versión nueva no modifica silenciosamente registros históricos.
- Quitar un campo de una versión activa lo oculta del formulario, las consultas ordinarias y todas las exportaciones nuevas, pero no destruye automáticamente sus valores históricos.
- El constructor mostrará una sección secundaria `Datos eliminados` con los campos retirados y el volumen de valores conservados. Desde allí se podrá mantenerlos o iniciar su purga definitiva mediante una migración explícita, previsualizada y confirmada.
- Un cambio incompatible de tipo de campo se tratará como una migración guiada. Antes de publicarlo, la plataforma analizará todos los valores afectados, identificará cada inconsistencia y explicará el motivo y el valor esperado.
- El usuario podrá corregir los valores incompatibles desde la plataforma, individualmente o mediante reglas y edición masiva. Como alternativa podrá exportar únicamente los casos problemáticos, corregirlos externamente y reimportarlos con una clave estable que los vincule a sus registros originales.
- Ningún valor incompatible se descartará ni se convertirá silenciosamente. El usuario decidirá si corrige los casos, asigna un valor vacío cuando el esquema lo permita, conserva la versión anterior o cancela la migración.
- Al añadir un campo obligatorio a una App con datos, la nueva versión podrá publicarse sin completar previamente todos los registros históricos. El campo será obligatorio para registros nuevos y los anteriores quedarán en estado `REQUIERE_ACTUALIZACION` hasta corregirse individualmente o en masa.
- Los registros pendientes tendrán una señal coherente en mapa y lista: tono de advertencia, icono y etiqueta, sin depender de parpadeo. Al pasar el mouse, enfocar con teclado o abrir el detalle se explicará qué campos faltan y por qué. La lista y el mapa permitirán filtrarlos.
- La señal visual nunca será el único indicador: el estado y la causa estarán disponibles como texto y para tecnologías de asistencia.
- Los registros en estado `REQUIERE_ACTUALIZACION` podrán exportarse. Antes de generar el archivo se informará cuántos contiene la selección y la salida incluirá metadatos de control como `estado_validacion` y `campos_pendientes`, sin mezclar esos metadatos con los campos configurables de la App.
- Identificadores internos UUID independientes de nombres DBF, códigos CAD o IDs externos.

No se utilizará una tabla nueva por cada App ni un esquema completamente EAV de fila por campo en la primera propuesta. Ambos extremos dificultan respectivamente la evolución o las consultas.

## Organización y navegación

- Las Apps solo se crearán y administrarán desde el área de Apps. Desde un proyecto se podrán asociar Apps existentes y personalizarlas para ese contexto, pero no crear una App nueva.
- Una importación podrá iniciarse desde el área de Apps o desde un proyecto/contenedor previamente configurado. En ambos casos, todos los registros se crearán o actualizarán en sus Apps maestras.
- Si la carga se inicia desde un proyecto, el perfil del contenedor definirá las Apps de destino permitidas y las reglas de enrutamiento. En la misma confirmación se crearán los registros maestros y sus membresías en el proyecto/contenedor, evitando un paso posterior de asignación.
- Si la carga se inicia desde Apps, el usuario podrá dejar los registros solo en su fuente maestra o seleccionar después todos o algunos para asociarlos a proyectos y contenedores.
- Vista por proyectos: seleccionar un proyecto mostrará su árbol de contenedores, Apps asociadas, subconjuntos de registros, capas y actividad.
- Vista por Apps: seleccionar una App mostrará todos sus registros maestros y los proyectos/contenedores donde están asociados.
- Ambas vistas serán perspectivas sobre las mismas asociaciones y registros; cambiar la navegación no duplicará datos.
- El mapa podrá superponer varias Apps de un proyecto y distinguir tipos de objeto, geometrías y estados mediante simbología configurable.
- Dentro de una App mixta, la definición indicará los tipos de objeto y las geometrías que admite cada uno. Podrá compartir campos comunes y mostrar campos específicos de forma condicional.
- La navegación mostrará cuándo una App tiene personalizaciones en el proyecto actual y permitirá comparar la configuración efectiva con la App base.
- Un proyecto tendrá contenedores jerárquicos arbitrarios. Un contenedor podrá almacenar otros contenedores y asociaciones a Apps/registros; por ejemplo `Bolivia → Santa Cruz → Nodo 1 → Postes, NAPs, edificios y cables`.
- Crear, renombrar, mover y reordenar contenedores será una operación sencilla y no cambiará el UUID ni duplicará el registro referenciado.

### Alcance futuro de permisos

- Los permisos podrán otorgarse por proyecto, por App o por la intersección `project_app`.
- Un permiso por proyecto podrá abarcar varias Apps asociadas; uno por App podrá abarcar varios proyectos; y una regla más específica podrá limitar acciones, secciones o campos en una asociación concreta.
- Los permisos también podrán otorgarse sobre cualquier contenedor del proyecto y heredarse por su subárbol. Por ejemplo, acceso a `Bolivia/La Paz` permitirá operar sus nodos, Apps y registros sin conceder acceso a otros departamentos del mismo proyecto.
- Una regla más específica en un subcontenedor podrá reducir o ampliar capacidades únicamente cuando la política y el otorgante lo autoricen; la evaluación efectiva mostrará siempre de dónde proviene cada permiso.
- La autorización efectiva se calculará en servidor y los campos no visibles no se enviarán a la interfaz ni a las exportaciones.

## Flujo técnico de importación

```text
Carga del archivo
  -> almacenamiento inmutable del original
  -> inspección segura
  -> detección de formato y CRS
  -> conversión a representación intermedia
  -> mapeo de atributos
  -> validación y previsualización
  -> confirmación del operador
  -> importación idempotente por lotes
  -> reporte de nuevos, coincidencias, conflictos e inválidos
```

Para el primer recorrido técnico se usarán las muestras recibidas: 6.265 puntos, 1.995 líneas, 45 atributos y WGS84. La importación repetida con la misma identidad no deberá duplicar registros.

### Identidad, actualización y mapeo durante importaciones

- Cada registro, punto, línea o polígono tendrá un UUID estable generado por Hansa Field y exportado junto con sus datos.
- Un elemento importado sin UUID se tratará como candidato nuevo dentro de la App a la que sea enrutado. Solo después podrá asociarse a uno o varios proyectos y contenedores.
- Un elemento con UUID se buscará contra la autoridad de Hansa Field. Si existe, se preparará una actualización de ese mismo registro, incluyendo los cambios de geometría y atributos mapeados; nunca se creará una copia por haber cambiado de ubicación.
- Si el UUID suministrado no existe en Hansa Field, el elemento será inválido. La plataforma no buscará sustitutos, no permitirá casarlo manualmente con otro registro y no lo reinterpretará como nuevo.
- Una importación con UUID desconocidos no podrá confirmarse. El reporte identificará los elementos afectados y pedirá corregir o retirar esos UUID y volver a cargar el archivo.
- Antes de aplicar actualizaciones, la previsualización indicará el proyecto, la App, los registros afectados y, por cada uno, las diferencias de geometría, campos, valores y estado. La escritura solo comenzará después de confirmación explícita.
- Las columnas del archivo se mostrarán junto a los campos disponibles del formulario efectivo. El usuario podrá vincularlas incluso cuando el nombre sea diferente o contenga errores, por ejemplo `TIPO DE OSTE` con `TIPO DE POSTE`.
- La plataforma podrá sugerir coincidencias por nombre normalizado y tipo de dato, pero el usuario confirmará las ambiguas. El mapeo confirmado se guardará como perfil versionado y alias de importación para reutilizarlo.
- Un campo nuevo del archivo podrá mapearse a uno existente o iniciar la creación controlada de un campo contextual. Una diferencia de nombre nunca creará automáticamente dos campos equivalentes.
- La ubicación o similitud de atributos podrá generar advertencias de posible duplicado para elementos sin UUID, pero no sustituirá la identidad autoritativa ni provocará una sobrescritura automática.
- Un mismo archivo o ZIP podrá contener objetos destinados a varias Apps. El asistente de importación clasificará lotes por capa, nombre de bloque, geometría, `STATUS`, color u otros atributos y mostrará el destino propuesto de cada grupo antes de confirmar.
- Cada perfil podrá definir un atributo clasificador prioritario —su nombre canónico se decidirá posteriormente— y alias aceptados. El importador buscará primero ese atributo para determinar, mediante sus valores, la App de destino de cada elemento.
- Si el archivo no contiene el atributo clasificador, mostrará una advertencia y exactamente tres opciones: `Crear atributo vacío`, `Crear y llenar para todos` o `Cancelar importación`.
- `Crear atributo vacío` añadirá la columna únicamente en el conjunto de preparación y dejará sus elementos pendientes para completarlos o asignarlos después, individualmente o en masa.
- `Crear y llenar para todos` solicitará un valor, lo asignará a todos los elementos del lote y ejecutará nuevamente las reglas de enrutamiento. La previsualización permitirá corregir excepciones antes de confirmar.
- `Cancelar importación` abandonará el trabajo sin publicar registros ni modificar las Apps. Los temporales se eliminarán según la política de retención.
- Si existe el atributo pero alguno de sus valores no tiene una regla, mostrará `No se encontraron coincidencias` y abrirá un mapeador de enrutamiento. A la izquierda habrá un selector con los atributos/columnas disponibles y sus valores; a la derecha, las Apps habilitadas como destinos.
- Ningún elemento con clasificador vacío o sin App destino podrá publicarse. Permanecerá como pendiente en la previsualización hasta ser resuelto o retirado del lote.
- El usuario podrá definir reglas como `atributo X = valor Y → App Z`. La previsualización actualizará inmediatamente cuántos elementos se asignan a cada App y cuáles siguen sin destino.
- El usuario podrá mapear en una sola operación postes, NAPs, usuarios, edificios, herrajes y otras categorías de puntos hacia sus Apps correspondientes; las líneas podrán agruparse y enrutar por categorías como fibra, coaxial o área de cobertura.
- Después del enrutamiento, cada grupo pasará a un segundo mapeo lado a lado: columnas del archivo a la izquierda y campos de la App destino a la derecha. Las coincidencias seguras se completarán automáticamente y las faltantes o ambiguas se resolverán una a una o mediante acciones masivas.
- Las reglas confirmadas de enrutamiento, alias y mapeo de campos se guardarán como perfiles versionados para que posteriores archivos compatibles se procesen automáticamente.
- Cuando el origen sea un proyecto, la previsualización mostrará conjuntamente `grupo de entrada → App maestra → contenedor del proyecto`; ninguna regla podrá enviar datos a una App no asociada o no autorizada sin una decisión explícita.
- Si una reimportación contiene UUID conocidos, la plataforma resolverá sus Apps y membresías de proyecto existentes automáticamente; no exigirá volver a crear ni reasociar esos registros.

### Archivos grandes

- Aunque la interfaz se ejecute en un navegador de una PC, las cargas grandes se dividirán en partes reanudables. Si se corta internet, el cliente continuará desde la última parte confirmada en lugar de reiniciar el archivo.
- Una vez completada la carga, la validación y conversión se ejecutarán en el servidor como un trabajo persistente. El usuario podrá cambiar de pantalla o cerrar el navegador y consultar su estado al regresar.
- No habrá un límite funcional fijo de registros por App. El límite inicial por archivo será configurable y partirá de 2 GB como valor propuesto.
- Cuando exista administración de usuarios, el usuario maestro podrá ajustar el límite desde configuración. Durante la primera versión sin usuarios, lo ajustará el operador técnico mediante configuración del sistema.
- El límite configurable no podrá superar la capacidad técnica segura definida por despliegue, almacenamiento y cuota disponibles. La interfaz mostrará el límite efectivo y el espacio estimado antes de iniciar.
- Una importación podrá cancelarse con seguridad antes de su confirmación; los temporales se limpiarán según una política de retención sin afectar datos ya publicados.

### Normalización CAD de la primera versión

- La importación CAD convertirá DWG/DXF a un modelo GIS canónico y sencillo antes de ingresar registros: puntos, líneas y polígonos con atributos estructurados. Los bloques CAD no serán una geometría propia de Hansa Field.
- Un bloque relevante se convertirá normalmente en un punto ubicado en su inserción o centro calculado; su nombre, atributos, capa y `CAD_HANDLE` se conservarán como datos de procedencia.
- Los iconos de puntos serán simbología visual configurable de la App. Cambiar un icono no cambiará la geometría ni los valores del registro.
- Las reglas específicas observadas en `TIGO_DWG_A_GIS_v19` se usarán como primer perfil de importación Tigo: capas a tipos de activo, colores de cable a categorías, bloques a atributos, deduplicación por tolerancia, asociación espacial y generación de elementos derivados.
- Estas reglas no quedarán codificadas como lógica universal. El importador separará: lectura CAD, normalización GIS, perfil de mapeo, validaciones y confirmación. Otros proyectos o áreas podrán tener perfiles distintos.
- GeoPackage será el formato intermedio preferido para inspección y trazabilidad, pero PostgreSQL/PostGIS seguirá siendo la autoridad después de confirmar la importación.
- El original CAD y el resultado normalizado conservarán una relación de procedencia. Las transformaciones automáticas mostrarán candidatos, descartados, advertencias y elementos que requieren revisión antes de publicar.
- La primera implementación reutilizará conceptualmente la lógica entregada, pero reemplazará su dependencia interactiva de AutoCAD, PowerShell y QGIS de escritorio por trabajos aislados del servidor cuando las licencias y capacidades del lector DWG elegido lo permitan.

### Sistemas de coordenadas

- El importador detectará automáticamente el CRS mediante metadatos del archivo, archivos auxiliares y validaciones espaciales; nunca asumirá silenciosamente una zona cuando exista ambigüedad.
- Antes de confirmar mostrará el resultado sobre el mapa, el CRS detectado en lenguaje comprensible y una opción avanzada para cambiarlo manualmente.
- Se conservarán el CRS declarado/detectado, la decisión del usuario y las coordenadas originales como procedencia de importación.
- La representación canónica permitirá consultar y superponer información de distintos proyectos. Las distancias, áreas y tolerancias se calcularán en una proyección apropiada para la ubicación del proyecto, sugerida automáticamente y ajustable por un usuario técnico.

## Exportaciones de la primera versión

- CSV y XLSX para atributos, revisión administrativa y correcciones externas.
- GeoJSON, KML/KMZ y Shapefile para intercambio de registros con geometría.
- ZIP como contenedor cuando la salida incluya varios archivos, fotografías o evidencias.
- PDF únicamente para informes con una plantilla definida, no como formato general de intercambio de datos.
- DWG y DXF quedan explícitamente fuera de la primera versión de exportación.
- Las exportaciones grandes se ejecutarán como trabajos asíncronos con progreso, resultado descargable y vencimiento configurable del archivo generado.

## Fotografías y adjuntos visuales

- Las fotografías cargadas se validarán y transcodificarán a un formato, orientación, resolución y nivel de compresión estándar. Después de completar y verificar la conversión, no se conservará el archivo fotográfico original.
- La plataforma tendrá una única política de resolución, formato y calidad definida por el equipo de desarrollo. El usuario no podrá cambiarla; se seleccionará un estándar suficientemente nítido para evidencia técnica y eficiente para almacenamiento.
- La imagen normalizada quedará vinculada al UUID del registro y al campo que la solicita. Se conservarán metadatos operativos aprobados —fecha, ubicación y autor cuando existan— separados del archivo visual.
- El mapa y la lista no descargarán ni mostrarán fotografías por defecto. Las imágenes se solicitarán únicamente al abrir el detalle de un punto, línea, polígono o registro.
- Una exportación incluirá fotografías solo cuando el usuario lo seleccione. En ese caso se entregarán dentro de un ZIP con nombres y manifiesto vinculados a los UUID y campos correspondientes.
- Los informes podrán insertar las fotografías normalizadas conforme a su plantilla; no necesitarán acceder al archivo original.

## Diccionario de datos por App

- Cada App podrá generar un PDF versionado para compartir con diseñadores y proveedores de datos antes de crear CAD, GIS o plantillas externas.
- El documento incluirá nombre y código estable de la App, versión y fecha; tipos de objeto y geometría; campos con nombre visible y clave técnica; tipo de dato; obligatoriedad; opciones válidas; unidades; reglas relevantes; alias aceptados; ejemplo de valor y atributos clasificadores de importación.
- El PDF distinguirá claramente campos maestros de la App y campos contextuales de un proyecto cuando se genere desde una asociación `project_app`.
- El documento servirá como guía; la importación seguirá validando el archivo real y no asumirá que fue producido correctamente por haber usado el PDF.

## Integración futura con el ERP

La separación de bases no implica aislamiento funcional. Hansa Field consultará únicamente información aprobada del ERP mediante contratos versionados, sin acceder directamente a sus tablas.

Casos de integración confirmados:

- reutilizar posteriormente la identidad corporativa para iniciar sesión con las mismas credenciales o una sesión federada;
- consultar Work Orders y vincularlas con edificios, activos y registros de Hansa Field;
- consultar materiales esperados o entregados desde el ERP;
- comparar esos materiales con los materiales observados o instalados en campo;
- registrar inconsistencias y su resolución sin poner en riesgo la operación transaccional del ERP.

Principio de resiliencia: un error o indisponibilidad de Hansa Field no debe afectar al ERP, y una indisponibilidad temporal del ERP no debe corromper Hansa Field. Las consultas integradas deberán usar timeouts, cache controlada, reintentos limitados y estados explícitos de información desactualizada.

La autoridad preliminar será:

| Información                                          | Autoridad                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------- |
| Credenciales e identidad corporativa futura          | ERP o proveedor de identidad corporativo por confirmar               |
| Work Orders y materiales autorizados/entregados      | ERP                                                                  |
| Edificios, activos, geometrías y evidencias de campo | Hansa Field                                                          |
| Material observado o instalado                       | Hansa Field                                                          |
| Diferencia entre esperado e instalado                | Hansa Field como resultado derivado, vinculada a referencias del ERP |

### Secuencia aprobada

La primera versión funcionará de manera independiente y validará proyectos, Apps de datos, formularios, importación, registros, mapa y exportación. No consultará Work Orders ni materiales del ERP. La fundación solamente definirá puertos y contratos para que la integración pueda añadirse después sin acoplar los módulos de dominio al ERP.

La primera integración futura deberá ser pequeña y verificable: consultar una Work Order, vincularla con un edificio o activo y comparar una muestra de material esperado contra material instalado.

## Visualización inicial

- Consultar registros por extensión visible del mapa y proyecto/App.
- Enviar únicamente atributos requeridos por la vista activa.
- Usar GeoJSON servido por URL para la muestra inicial.
- Incorporar clustering para puntos y simplificación/limitación por zoom.
- Definir desde el contrato una evolución a teselas vectoriales cuando el volumen o las mediciones lo justifiquen.
- No descargar todas las Apps ni todos los proyectos al navegador.
- Permitir crear y editar puntos, líneas y polígonos desde la web.
- Permitir seleccionar múltiples registros y ejecutar operaciones masivas autorizadas con previsualización, confirmación, ejecución asíncrona cuando corresponda e historial auditable.
- Evitar que una edición masiva bloquee el navegador o se aplique parcialmente sin un reporte explícito.
- La selección múltiple inicial permitirá editar atributos del objeto, cambiar estado, desplazar la posición de geometrías y eliminar el conjunto seleccionado.
- El desplazamiento masivo moverá la selección como un solo bloque, conservando las distancias relativas y la forma de sus geometrías.
- La eliminación será definitiva, pero tendrá una ventana de deshacer de cinco minutos. Durante ese plazo, el registro quedará marcado como pendiente de eliminación, oculto de las vistas operativas y bloqueado para nuevas modificaciones.
- Al vencer la ventana, un trabajo asíncrono eliminará físicamente el registro y sus datos dependientes propios. Los archivos compartidos o referencias externas se tratarán según reglas explícitas para no eliminar información todavía utilizada por otros registros.
- La papelera permitirá adelantar la eliminación definitiva sin esperar los cinco minutos. Esta acción tendrá un segundo paso de confirmación reforzada: mostrará el conteo exacto afectado y exigirá escribir ese número para habilitar la purga. Para selecciones heterogéneas o cuando no sea posible establecer un conteo inequívoco, exigirá escribir `ELIMINAR`.

### Edición concurrente

- Un registro, la definición de una App o la configuración de un proyecto tendrá como máximo un editor activo por recurso; editar un registro no bloqueará toda su App o proyecto.
- Al comenzar una edición se adquirirá un bloqueo temporal renovable. Los demás usuarios verán el nombre del editor y el recurso en modo de solo lectura.
- Los observadores podrán ver los cambios no guardados en vivo, claramente identificados como borrador, pero no modificarlos hasta que el editor guarde, cancele o pierda el bloqueo.
- El bloqueo se liberará al guardar o cancelar. Ante pérdida de conexión tendrá inicialmente una tolerancia configurable de dos minutos, con cuenta regresiva visible; si la sesión regresa dentro del plazo recuperará el bloqueo y su borrador. Después vencerá automáticamente para evitar bloqueos abandonados. Más adelante podrán definirse permisos para solicitar o forzar la toma del bloqueo.
- El guardado incluirá una versión esperada del recurso como protección adicional contra sobrescrituras, incluso si falla la señalización del bloqueo.
- Mientras la primera versión no tenga identidades, el mecanismo distinguirá sesiones de edición; al incorporar usuarios mostrará su nombre sin cambiar el contrato de concurrencia.
- Quedan fuera inicialmente las operaciones topológicas avanzadas como cortar, unir, extender, hacer snapping de redes o recalcular trazados completos.

## Comandos contractuales propuestos

Estos comandos deberán existir después del scaffolding:

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
docker compose up --build
docker compose run --rm api pnpm db:migrate
```

## Estilo de código

- TypeScript estricto; no usar `any` en contratos públicos.
- Nombres de capacidades en formato `resource.action`, por ejemplo `record.import`.
- Entradas y salidas separadas; nunca reutilizar directamente entidades persistidas como DTO públicos.
- Errores con código estable, mensaje humano y detalles estructurados.
- Validación solamente en límites externos y contratos de módulo.
- SQL espacial aislado en el módulo propietario y cubierto por pruebas de integración.

Ejemplo:

```ts
export type ImportJobState =
  | { type: "QUEUED"; queuedAt: string }
  | { type: "VALIDATING"; processed: number; total: number }
  | { type: "READY_FOR_CONFIRMATION"; summary: ImportSummary }
  | { type: "FAILED"; errorCode: string };
```

## Estrategia de pruebas

- **Unitarias:** validadores, mapeos, políticas y reglas puras.
- **Contrato de módulos:** entradas, salidas y errores públicos.
- **Integración:** PostgreSQL/PostGIS, Redis y almacenamiento mediante contenedores reales.
- **Importación:** fixtures pequeños y muestras representativas anonimizadas; repetición idempotente y errores parciales.
- **Rendimiento:** 8.000 registros por App como escenario base y pruebas crecientes para detectar el punto de degradación.
- **E2E:** cargar, previsualizar, confirmar, consultar en mapa y exportar.
- **Seguridad:** demostrar que los atributos no autorizados no aparecen en API, exportación ni trabajos derivados cuando se incorpore autorización real.

## Límites

### Siempre hacer

- Versionar esquemas, migraciones y contratos.
- Validar archivos y datos externos como no confiables.
- Ejecutar importaciones grandes de forma asíncrona e idempotente.
- Consultar autorización mediante un puerto, incluso con acceso total temporal.
- Añadir pruebas para cada contrato y migración.
- Mantener ERP y Hansa Field con bases, contenedores y ciclos de despliegue separados.

### Preguntar primero

- Añadir una dependencia de producción.
- Cambiar el formato canónico de geometría o SRID interno.
- Exponer una API desde el ERP o escribir datos en él.
- Admitir un formato nuevo de importación.
- Promover un campo dinámico a columna/indexación dedicada.
- Cambiar la política de retención de archivos o historial.

### Nunca hacer

- Acceder directamente a tablas del ERP desde Hansa Field.
- Guardar archivos grandes dentro de columnas de PostgreSQL.
- Ejecutar código, macros o instrucciones contenidos en archivos importados.
- Tratar nombres truncados de DBF como identificadores permanentes.
- Aplicar seguridad solo ocultando componentes de la interfaz.
- Duplicar Apps o registros para resolver diferencias de visibilidad.
- Introducir microservicios antes de demostrar una necesidad operativa o de escala.

## Criterios de éxito verificables

1. El entorno completo inicia con un comando Docker Compose en Linux y en desarrollo local.
2. Backend y web compilan, pasan lint, typecheck y pruebas.
3. Los módulos no importan implementaciones internas de otros módulos.
4. Una muestra SHP/KML se valida sin bloquear una solicitud HTTP.
5. La importación produce un resumen antes de persistir y puede confirmarse o cancelarse.
6. Repetir una importación confirmada con la misma identidad no duplica registros.
7. Los 8.260 elementos de la muestra pueden consultarse por extensión del mapa y visualizarse sin enviar todas las Apps al navegador.
8. Las geometrías quedan en WGS84 o en el SRID canónico aprobado, con índice espacial.
9. El archivo original y el reporte de importación permanecen vinculados y auditables.
10. El operador técnico utiliza el mismo contrato de autorización que posteriormente implementarán los usuarios reales.
11. Existe evidencia de pruebas unitarias, integración y E2E; una base sin pruebas no supera la fase de fundación.
12. El operador puede crear y modificar geometrías individuales desde la web.
13. Una operación masiva selecciona un conjunto reproducible, presenta una previsualización, confirma el impacto y deja un historial auditable de éxitos y errores.
14. Las operaciones masivas mínimas cubren atributos, estado, desplazamiento de posición y eliminación de la selección.
15. Una eliminación puede deshacerse durante cinco minutos; vencido el plazo, el registro y sus datos dependientes exclusivos se purgan definitivamente mediante un proceso verificable.
16. El desplazamiento masivo mantiene las posiciones relativas y la geometría de todos los elementos seleccionados.
17. La purga manual desde la papelera exige una confirmación reforzada basada en el conteo exacto o en la palabra `ELIMINAR`, y deja evidencia auditable de quién, cuándo y qué purgó una vez que exista identidad de usuarios.
18. Dos sesiones no pueden editar simultáneamente el mismo recurso: la segunda observa el borrador en vivo y puede editar cuando la primera guarda, cancela o pierde su bloqueo temporal.
19. Un bloqueo abandonado vence automáticamente y ningún guardado puede sobrescribir silenciosamente una versión más reciente del recurso.
20. La pérdida de conexión conserva inicialmente el bloqueo y el borrador durante dos minutos configurables; una reconexión dentro de ese plazo permite continuar la edición.
21. Un campo retirado deja de aparecer y de exportarse de inmediato, mientras sus valores anteriores permanecen recuperables desde `Datos eliminados` hasta que se confirme una purga definitiva.
22. La purga de un campo informa cuántos registros y valores serán afectados, no altera silenciosamente otras versiones y deja un resultado auditable.
23. Antes de cambiar el tipo de un campo, la plataforma presenta el total y detalle de valores incompatibles, permite corregirlos en masa dentro de la plataforma y ofrece exportación/reimportación como alternativa.
24. Una migración de esquema no se publica mientras existan inconsistencias sin una resolución explícita y nunca elimina valores automáticamente.
25. Un campo obligatorio nuevo se exige inmediatamente a registros nuevos; los históricos incompletos se identifican como `REQUIERE_ACTUALIZACION`, permanecen operables según la política definida y pueden corregirse en masa.
26. El mapa y la lista distinguen los registros incompletos mediante tono, icono y texto accesible, muestran la causa y permiten filtrarlos sin utilizar parpadeo continuo.
27. Una exportación con registros incompletos presenta una advertencia previa e identifica en el resultado el estado de validación y los campos pendientes de cada registro.
28. La primera versión exporta CSV, XLSX, GeoJSON, KML/KMZ y Shapefile, y utiliza ZIP cuando corresponde; no genera DWG ni DXF.
29. Un perfil CAD convierte capas, bloques y estilos relevantes en puntos, líneas o polígonos canónicos, preserva la procedencia y permite revisar el resultado antes de importarlo.
30. La simbología de un punto se configura independientemente de su geometría y sus atributos; cambiar el icono no altera el dato.
31. Las reglas del convertidor Tigo se representan como un perfil versionado y extensible, no como comportamiento fijo para todas las Apps de Hansa.
32. Un registro pertenece a una App maestra y puede asociarse a proyectos mediante membresías sin duplicarse; los campos exclusivos del proyecto viven en esa membresía.
33. Una App mixta puede contener puntos, líneas y polígonos, con validaciones y simbología definidas por tipo de objeto.
34. El usuario puede navegar primero por proyecto o primero por App y llegar al mismo conjunto contextual de datos.
35. La asociación `project_app` puede personalizar visibilidad, obligatoriedad, valores y reglas de campos sin duplicar la App base y muestra claramente sus diferencias.
36. El modelo de autorización admite permisos por proyecto, por App y por su intersección, con restricciones más específicas por acción y campo.
37. Una configuración `project_app` puede crear campos exclusivos y configurar campos base; el formulario efectivo se obtiene de ambas versiones sin duplicar la App.
38. Desactivar un campo en un proyecto lo excluye de captura, presentación y exportación de ese contexto sin alterar otros proyectos ni la App base.
39. Editar desde un proyecto propone alcance local y editar desde la App propone alcance global, pero ambos muestran y confirman explícitamente el alcance antes de publicar.
40. Una actualización global reevalúa cada proyecto, identifica los compatibles y crea tareas de resolución para los que deban adoptar, configurar u ocultar campos nuevos.
41. Un proyecto con una actualización pendiente sigue funcionando con su versión estable y muestra qué App cambió, qué se modificó y la comparación entre versiones.
42. Restaurar una App crea una nueva versión basada en la anterior, conserva el historial completo y presenta el impacto sobre proyectos y registros antes de publicarse.
43. Una importación detecta y previsualiza el CRS automáticamente, permite corregirlo antes de confirmar y conserva tanto el origen como la decisión aplicada.
44. Las mediciones utilizan una proyección apropiada para el proyecto y no dependen de grados geográficos ni de una única zona UTM fija para toda Hansa.
45. Una carga interrumpida se reanuda desde la última parte confirmada y el procesamiento del servidor continúa aunque se cierre el navegador.
46. El límite de archivo es configurable por el usuario maestro —o por configuración técnica antes de existir usuarios— dentro de una cuota segura del despliegue; el valor inicial propuesto es 2 GB.
47. Una reimportación con UUID actualiza el registro correspondiente solo después de mostrar las diferencias y confirmar el alcance; un elemento sin UUID se prepara como registro nuevo.
48. El mapeador permite vincular columnas con nombres distintos a campos existentes, guarda perfiles/alias versionados y evita crear duplicados semánticos sin confirmación.
49. Un UUID desconocido invalida la importación hasta que el archivo sea corregido; nunca se reasigna ni se transforma automáticamente en un registro nuevo.
50. Una fotografía se almacena únicamente después de normalizarla y verificarla; el original se descarta y el mapa no la descarga hasta abrir el detalle del registro.
51. Las fotografías solo aparecen en exportaciones ZIP o informes cuando el usuario las solicita y mantienen una referencia inequívoca al UUID y campo de origen.
52. Las Apps se crean únicamente desde el área de Apps; una importación puede iniciarse desde Apps o desde un proyecto configurado, pero siempre crea o actualiza registros en Apps maestras.
53. Un proyecto admite contenedores anidados sin límite funcional fijo, capaces de organizar subcontendedores y referencias a registros de distintas Apps.
54. Una importación puede clasificar y enrutar múltiples tipos de puntos y líneas hacia varias Apps en una sola confirmación, con una previsualización del destino de cada grupo.
55. Una reimportación con UUID conocidos actualiza los maestros y conserva sus asociaciones de proyecto; no obliga a cargarlos ni organizarlos nuevamente.
56. Una carga iniciada desde un proyecto enruta cada grupo a una o varias Apps asociadas y crea sus membresías de contenedor en la misma operación confirmada.
57. Un permiso sobre un contenedor se hereda por su subárbol y permite autorizar una región, nodo u otra rama sin crear proyectos separados.
58. El importador busca primero un atributo clasificador configurado, enruta sus valores a Apps y permite resolver manualmente atributos o valores sin coincidencia mediante una interfaz lado a lado.
59. Después de enrutar, el importador casa las columnas con los campos de cada App, completa coincidencias seguras y exige confirmación para las ambiguas o faltantes.
60. Cada App puede generar un PDF versionado de su diccionario de datos, incluyendo geometrías, campos, tipos, reglas, valores y claves necesarias para facilitar archivos compatibles.
61. Si falta el atributo clasificador, el usuario puede crearlo vacío, crearlo con un valor masivo o cancelar; ningún elemento sin valor o destino se publica.

## Open Questions

1. **Resuelta:** Hansa Field tendrá repositorio, despliegue y base independientes; podrá compartir el servidor físico de Miami con el ERP.
2. **Resuelta:** la conexión real con el ERP queda fuera del primer núcleo independiente; se prepararán contratos de integración para una fase posterior.
3. ¿Qué proveedor S3-compatible existe en la infraestructura de Miami, o debemos desplegar uno?
4. ¿Cuál será el límite inicial de tamaño por archivo y por importación?
5. ¿El SRID canónico será EPSG:4326, o se almacenará una geometría proyectada adicional para mediciones locales?
6. **Resuelta:** la primera web debe crear y editar puntos, líneas y polígonos, tanto individualmente como mediante operaciones masivas controladas.
7. ¿Qué formato acordará el área piloto como salida de AutoCAD: DXF, SHP o ambos?
8. ¿Se reutilizarán catálogos de país/cliente/proyecto desde el ERP mediante API, o Hansa Field los administrará como referencias propias sincronizadas?
9. ¿Kysely/SQL tipado será suficiente como capa de datos, o se realizará un prototipo comparativo contra Prisma + SQL espacial aislado antes de decidir?
