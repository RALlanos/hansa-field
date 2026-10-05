# Hansa Field — corrección de rumbo del producto

## Instrucción para quien implemente

Antes de crear pantallas, importar archivos, instalar tecnología nueva o cambiar el modelo de datos, lee este documento completo. El objetivo no es construir un importador de Excel ni una copia visual aislada de Fulcrum: es construir **Hansa Field**, una plataforma GIS operativa configurable para Hansa Latinoamérica, inspirada funcionalmente en Fulcrum.

No implementes migraciones destructivas, compatibilidad duplicada, una segunda aplicación ni un segundo modelo de Records sin una decisión explícita del responsable del producto.

## Objetivo de producto

Hansa Field permite que una organización configure Apps sin código, capture y opere Registros georreferenciados, los consulte en mapa y tabla, los relacione con Proyectos cuando corresponda y aplique permisos, auditoría y automatización.

El flujo principal es:

```text
Organización + permisos
        ↓
App / formulario versionado
        ↓
Registro georreferenciado
        ↓
Mapa + tabla + filtros + edición
        ↓
Proyecto, asignación, auditoría y automatización
```

La importación desde Excel, CSV, Shapefile, Fulcrum, ArcGIS u otras fuentes alimenta este flujo. No es la razón de ser del producto y no debe imponer el modelo de datos ni la experiencia principal.

## Decisiones obligatorias

### 1. Una plataforma técnica única

Antes de integrar trabajo nuevo, confirmar cuál repositorio y stack es la fuente de verdad. No mantener simultáneamente una versión FastAPI/Vite y otra NestJS/Next.js con dominios equivalentes.

La fuente elegida debe tener:

- PostgreSQL/PostGIS como autoridad geográfica;
- contratos HTTP documentados;
- un único frontend operativo;
- migraciones, pruebas y CI sobre esa misma plataforma.

### 2. Separar definición, versión e instancia

Nunca mezclar estos niveles:

```text
App / Formulario
└── Versión publicada e inmutable
    └── esquema, secciones, campos, reglas, simbología y geometrías permitidas

Registro
└── valores validados + geometría + estado + auditoría
```

Cambiar un formulario publicado debe crear una versión nueva; no destruir datos ni cambiar retroactivamente el significado de un campo. El identificador estable de un campo no puede ser su etiqueta visible.

### 3. Registros y proyectos

El Registro es la identidad canónica del dato. Un Proyecto organiza o contextualiza registros; no debe crear copias canónicas silenciosas.

Si Hansa requiere datos, estado o geometría específicos dentro de un Proyecto, usar una participación explícita (`project_record` o su equivalente), con identidad propia. Esa participación puede tener overrides locales, pero no debe modificar el Registro canónico ni otras participaciones.

Definir y documentar una sola de estas reglas antes de programar más consumidores:

1. Proyecto como asignación simple del Registro; o
2. Proyecto como participación explícita con atributos/geométría locales.

No dejar ambas reglas activas para la misma operación.

### 4. Permisos desde el núcleo

Desde el primer flujo usable debe existir:

- organización activa;
- usuario autenticado;
- autorización mínima para leer y editar;
- separación real de datos por organización;
- trazabilidad de quién creó o modificó un Registro.

Los permisos granulares por App, Proyecto, capa y grupo pueden completarse después, pero la seguridad no puede ser solo una condición visual del frontend.

## Prioridad de implementación

### Prioridad 0 — Contratos y base común

Completar antes de ampliar funcionalidades:

- modelo único de App, versión, Registro y Proyecto;
- API coherente y validada;
- SRID, GeoJSON, índice GiST y consultas por bbox;
- autenticación/multiorganización básica;
- pruebas y CI del flujo esencial.

### Prioridad 1 — Primer flujo completo

Debe funcionar de punta a punta:

1. Crear o configurar una App.
2. Añadir campos, secciones y validaciones.
3. Configurar geometrías permitidas.
4. Configurar título, estado, icono y color básico.
5. Publicar una versión.
6. Crear un Registro con geometría desde la web.
7. Validar en cliente y servidor.
8. Verlo, filtrarlo y editarlo en tabla, mapa y vista dividida.
9. Consultar su auditoría básica.

Un registro no debe existir solo como fila de importación: debe poder capturarse y editarse mediante el formulario configurado.

### Prioridad 2 — Operación web real

Después del flujo anterior:

- filtros por campo, estado, App, Proyecto y bbox;
- sincronización mapa ↔ tabla ↔ selección;
- asignación, cambio de estado, duplicación y retiro controlado;
- permisos por rol y alcance;
- estilos cartográficos por valor de un campo, por ejemplo `Estado`;
- clustering, simplificación, vector tiles o caché por zona según volumen;
- Projects y participaciones locales, si son parte del caso de uso validado.

### Prioridad 3 — Capacidades complementarias

Solo después del núcleo operativo:

- importación CSV/XLSX/Shapefile/GeoJSON/KML;
- exportación y API de consultas;
- multimedia, firmas y bocetos;
- workflows, tareas, reportes y dashboards;
- integraciones Fulcrum, ArcGIS, webhooks avanzados y shares públicos.

## Importación: regla de diseño

La importación debe reutilizar exactamente el mismo contrato que la creación manual de Registros:

```text
archivo
→ inspección
→ mapeo a App y versión
→ validación
→ preview de incidencias
→ confirmación explícita
→ Registros / participaciones válidas
→ reporte auditable
```

No crear tablas, campos ni flujos alternos solo para importar. Un archivo importado debe terminar en los mismos Registros que un usuario puede abrir, editar, filtrar, representar y auditar.

## GIS: requisitos mínimos

- geometrías almacenadas en PostGIS con SRID explícito;
- tipos de geometría permitidos definidos por la App;
- validación de geometrías en frontend y backend;
- consultas por bbox, con límites de payload;
- mapa no descarga todo el universo de registros;
- puntos se agrupan al alejarse;
- líneas y polígonos se simplifican solo como representación visual;
- atributos completos y formularios se cargan bajo demanda al abrir un Registro;
- simbología no altera la geometría.

## Lo que no debe priorizarse todavía

No dedicar capacidad principal a estas funciones antes de completar las prioridades 0 y 1:

- importador de Excel aislado;
- pantallas de carga masiva sin editor de Registro funcional;
- dashboards decorativos;
- reportes PDF;
- exportadores complejos;
- utilidades administrativas que no sirven al flujo de captura/operación;
- duplicar APIs o modelos para “compatibilidad temporal”.

## Criterios de aceptación del MVP

El MVP está listo para ampliar alcance solamente si una demostración puede cumplir todo lo siguiente sin datos de prueba manualmente insertados:

- Un administrador crea/configura una App con campos y geometría.
- La App publica una versión identificable.
- Un usuario autorizado crea un Registro desde el formulario.
- La geometría aparece correctamente en el mapa y en la tabla.
- Los filtros de estado/campo/bbox producen el mismo conjunto operativo en mapa y tabla.
- Editar un Registro conserva el historial y respeta validaciones.
- Un usuario sin permiso no puede leer ni modificar datos fuera de su alcance.
- Si hay Proyectos, una participación local no modifica el Registro canónico ni otro Proyecto.
- El mapa mantiene rendimiento con consultas por bbox y no descarga todos los Registros al navegador.

## Entregable requerido antes de implementar más módulos

Presentar una decisión breve, aprobable y verificable que incluya:

1. Stack y repositorio fuente de verdad.
2. Diagrama de entidades: Organización, Usuario, App/Formulario, Versión, Registro y Proyecto/participación.
3. Contrato HTTP del flujo de crear/editar/listar Registro.
4. Matriz mínima de permisos.
5. Demostración del flujo de Prioridad 1.
6. Lista explícita de módulos que quedan postergados hasta completar el MVP.
