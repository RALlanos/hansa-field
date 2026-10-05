# Hansa Field y Cerebro — comparación de producto y guía de alineación

> **Propósito:** este documento es una evaluación para conversar con el equipo de Cerebro. No es una instrucción de integrar código, migrar bases de datos ni reemplazar su stack técnico.
>
> **Conclusión breve:** Cerebro tiene una buena base técnica para alcanzar el mismo producto. Lo que debe alinearse no es React/FastAPI/Flutter frente a Next/Nest, sino el **modelo de dominio y el orden del producto**. Hansa Field no es un importador de archivos GIS: es el _Fulcrum de Hansa_, una plataforma configurable para definir formularios, registrar trabajo georreferenciado y operarlo en mapa, tabla, proyectos y equipos.

## 1. Qué producto estamos construyendo

Hansa Field permite que una organización:

1. Diseñe una App (un formulario operativo) sin programar.
2. Publique una versión estable de ese formulario.
3. Cree, edite, ubique y consulte Registros georreferenciados.
4. Los opere desde mapa, tabla, filtros, permisos y auditoría.
5. Los relacione con Proyectos sin perder una fuente canónica del dato.
6. Importe datos de Fulcrum, Shapefile, GeoJSON, KML, CSV o XLSX **al mismo modelo de Registros**.

El flujo central es:

```text
Organización + usuarios + permisos
             ↓
App / formulario configurable
             ↓
Versión publicada e inmutable
             ↓
Registro georreferenciado
             ↓
Mapa + tabla + filtros + formulario + auditoría
             ↓
Participación en Proyecto, tareas e integraciones
```

La importación es una puerta de entrada de datos; no debe definir ni reemplazar este flujo.

## 2. Lo que está bien encaminado en Cerebro

Estas decisiones son compatibles con Hansa Field y no deben descartarse solo porque el repositorio histórico use otro stack.

| Área         | Decisión de Cerebro                           | Evaluación                                                                    |
| ------------ | --------------------------------------------- | ----------------------------------------------------------------------------- |
| Web          | React + TypeScript + Vite                     | Correcta para una interfaz operativa de mapa, tabla y formularios.            |
| Móvil        | Flutter                                       | Correcta para una futura app Android/iOS única.                               |
| API          | FastAPI                                       | Correcta si los contratos HTTP, autorización y validación son explícitos.     |
| Datos GIS    | PostgreSQL + PostGIS                          | Obligatoria y correcta: es la autoridad de geometrías y búsquedas espaciales. |
| Mapa         | MapLibre                                      | Buena elección para renderización cartográfica operativa.                     |
| Constructor  | Formularios configurables, secciones y campos | Es el núcleo correcto del producto.                                           |
| Trabajo ágil | Épicas, historias, DoD y sprints              | Útil si el backlog se ordena alrededor de un flujo usable completo.           |

**No se pide convertir Cerebro a NestJS/Next.js.** La coherencia se logra manteniendo el mismo lenguaje de negocio, invariantes y contratos, aunque cambie la implementación.

## 3. Diferencias importantes encontradas

| Tema                              | Enfoque que se venía planteando en Cerebro                    | Modelo que necesita Hansa Field                                                                       | Por qué importa                                                                             |
| --------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Centro del producto               | Importación y listas auxiliares muy visibles                  | Configurar App → publicar → crear/operar Registro                                                     | Un usuario debe poder trabajar sin importar ningún archivo.                                 |
| App                               | App como formulario sin separación suficiente de versiones    | `App` + `AppVersion` publicada e inmutable                                                            | Un formulario cambia; los Registros históricos no pueden perder significado.                |
| Campo                             | Etiqueta/nombre puede terminar identificando el dato          | `fieldId` estable independiente de etiqueta y código editable                                         | “Altura” puede pasar a “Altura del poste” sin romper datos ni filtros.                      |
| Proyecto                          | Proyecto como hijo de App o `project_id` directo del Registro | Proyecto organiza referencias mediante `ProjectApp` y, si hace falta, `ProjectRecord`                 | Un poste puede ser parte de varios proyectos sin duplicar ni contaminar su dato maestro.    |
| Registro                          | Registro dependiente de un proyecto                           | Registro canónico de una AppVersion                                                                   | Permite reutilización, auditoría y consistencia.                                            |
| Estado/simbología                 | Tabla o entidad separada de “estados”                         | Un campo de selección normal, por ejemplo `Estado`, cuyas opciones llevan color/icono                 | Así Fulcrum pinta `POSTES`, `TAPS` o `NODO`: son valores del formulario, no Apps separadas. |
| Geometría                         | Geometría tratada como totalmente inmutable                   | Geometría canónica editable y auditada; override local solo si existe `ProjectRecord`                 | En campo hay correcciones legítimas; deben quedar trazadas, no prohibidas.                  |
| Importación                       | Flujo propio que puede generar modelos paralelos              | Mismo contrato de validación y persistencia que la creación manual                                    | Lo importado debe abrirse, editarse, filtrarse y verse igual que un Registro manual.        |
| Lista de opciones / clasificación | Importador XLSX/CSV como parte necesaria del modelo base      | Opciones dentro del constructor; catálogos compartidos y clasificaciones solo cuando exista caso real | Evita convertir una configuración simple en un subsistema complejo.                         |
| Mapa                              | Carga general de datos                                        | Consultas por bbox, límite de payload, clustering y detalle bajo demanda                              | Es la única forma de operar millones de registros sin bloquear el navegador.                |

## 4. Modelo de dominio que ambos equipos deben compartir

```text
Organización
 ├── Usuarios y permisos
 ├── App
 │    └── AppVersion (publicada, inmutable)
 │         ├── schema: campos, tipos, validaciones
 │         ├── uiSchema: secciones, orden, visibilidad
 │         └── mapStyle: geometrías permitidas y simbología
 ├── Registro
 │    ├── appId + appVersionId
 │    ├── values (atributos validados)
 │    ├── geometry (PostGIS, SRID explícito)
 │    └── auditoría
 └── Proyecto
      ├── ProjectApp (habilita una App en el contexto del Proyecto)
      └── ProjectRecord (participación opcional del Registro)
           └── atributos/estado/geometría locales, si el caso lo necesita
```

### Regla esencial de los proyectos

Un Proyecto **no clona** el Registro. Puede referenciar el mismo Registro en más de un contexto.

Ejemplo: un `Poste 123` existe como Registro maestro. Puede participar en el proyecto “Expansión FTTH La Paz” y también en “Mantenimiento Zona Norte”. Si un Proyecto necesita una observación, tarea o estado local, se guarda en su `ProjectRecord`; no cambia el poste maestro ni el otro Proyecto.

## 5. Cómo se comportan formularios, campos y versiones

1. La persona diseña una App en borrador: secciones, campos, opciones, geometría, icono y color.
2. Al publicar se crea una `AppVersion` inmutable.
3. Los nuevos Registros usan esa versión.
4. Para cambiar un formulario ya publicado se crea otro borrador y se publica una versión nueva.
5. Los Registros anteriores conservan la versión con la que nacieron y siguen interpretándose correctamente.

Reglas que no se deben negociar:

- El `fieldId` y el `optionId` son IDs internos estables; el label es solo texto visible.
- Retirar un campo no borra los valores históricos.
- Cambiar tipo de un campo no convierte datos en silencio; exige una migración explícita, previa y auditable.
- El formulario de crear y el de editar deben ser el mismo constructor/configuración, no editores improvisados distintos.

## 6. Estado, color y filtros: el patrón Fulcrum que queremos conservar

Cuando Fulcrum muestra varios colores dentro de una misma App, normalmente no son “secciones” ni Apps diferentes. Son opciones de un campo, por ejemplo:

```text
Campo: Estado / Tipo de activo
├── POSTES       → verde + icono poste
├── TAPS         → azul + icono tap
├── NODO         → naranja + icono nodo
└── DIVISORES    → morado + icono divisor
```

En Hansa/Cerebro ese patrón debe ser configurable por AppVersion:

- elegir el campo que gobierna el estilo del mapa;
- configurar color e icono por opción del campo;
- mostrar un filtro con esos valores y su leyenda;
- seguir permitiendo una App única cuando los datos pertenecen al mismo formulario;
- permitir separar en varias Apps solo si los formularios, permisos o ciclos de vida son realmente distintos.

No se debe obligar a crear una App por color ni una App por categoría.

## 7. Importaciones: qué sí deben hacer y qué no

Una importación correcta sigue este flujo:

```text
Archivo / API externa
→ inspección de capas y campos
→ seleccionar App + AppVersion
→ mapear columnas a fieldId
→ validar geometría, CRS y valores
→ preview de altas, actualizaciones, omitidos e incidencias
→ confirmación explícita
→ Registro canónico + auditoría de importación
```

Consecuencias prácticas:

- Shapefile, KML, GeoJSON, CSV, XLSX y Fulcrum son fuentes, no modelos distintos.
- Un `UUID` conocido es candidato a actualización; si no viene UUID es un Registro nuevo; si trae un UUID inexistente es incidencia, no una inserción silenciosa.
- El importador no debe crear tablas por App, EAV, ni registros incompletos ocultos.
- Excel/CSV para opciones es opcional y avanzado: sirve para catálogos corporativos grandes, no para sustituir el constructor de una App.
- La clasificación jerárquica solo debe construirse si se valida un uso real (territorio, red, operación). No debe ser requisito para crear una App o importar un dataset.

## 8. Mapa y rendimiento: comportamiento mínimo esperado

Con datos masivos, el navegador no recibe todos los Registros. Debe funcionar así:

1. El mapa informa su bbox, zoom y filtros activos.
2. La API consulta PostGIS con índice espacial y devuelve un conjunto limitado.
3. Los puntos se agrupan a escala lejana; líneas/polígonos se simplifican solo para dibujarse.
4. Al acercarse, el mapa solicita el detalle de esa zona.
5. El mapa y la tabla consumen el mismo conjunto filtrado; no deben mostrar conteos incompatibles.
6. Los atributos completos y el formulario se solicitan al abrir un Registro, no para cada marcador.

## 9. Orden recomendado del trabajo

No se recomienda completar todos los módulos de administración antes de poder operar un dato real. El primer incremento demostrable debería ser:

1. Organización, usuario y autorización mínima.
2. Crear App con secciones, campos, opciones y geometrías permitidas.
3. Publicar AppVersion.
4. Crear y editar un Registro desde web, con validación y auditoría.
5. Mostrar el mismo Registro en mapa y tabla; filtrar por bbox y por campo `Estado`.
6. Añadir un Proyecto y asignar el Registro sin duplicarlo.

Después: importación GIS/Fulcrum, multimedia, offline móvil, tareas, automatizaciones y reportes.

## 10. Preguntas que el equipo debe cerrar antes de implementar

1. ¿Cuál es el repositorio y despliegue que será la fuente técnica de verdad?
2. ¿Qué versión de una App puede usar un Registro nuevo y cómo se conserva su histórico?
3. ¿Usaremos `ProjectRecord` desde el MVP o los Proyectos serán inicialmente asignaciones simples?
4. ¿Qué roles mínimos pueden crear Apps, publicar, crear Registros, editar y ver datos?
5. ¿Qué campos de selección gobiernan simbología y filtros por cada App?
6. ¿Qué formatos de importación son realmente necesarios en la primera etapa?
7. ¿Qué límite de registros/renderizado se acepta por bbox y por zoom?

## 11. Mensaje corto para presentar al equipo

> La visión técnica de Cerebro es válida. Lo que debemos proteger es el contrato de producto: una App es un formulario versionado; un Registro es el dato geográfico canónico; un Proyecto organiza participaciones sin duplicar; las opciones de un campo pueden definir estado, color, icono y filtros; y cualquier importación termina en esos mismos Registros. Si mantenemos estas reglas, Cerebro puede ser la implementación moderna de Hansa Field sin perder la lógica operativa tipo Fulcrum que necesitamos para Hansa Latinoamérica.

## 12. Alcance de este documento

Este archivo describe diferencias y recomendaciones. No autoriza por sí mismo:

- editar el repositorio Cerebro;
- migrar o borrar datos;
- cambiar su stack;
- crear APIs, tablas ni pantallas;
- reemplazar su planificación sin revisión del equipo.

El siguiente paso correcto es que el equipo lo revise, confirme las decisiones de dominio y recién entonces convierta las decisiones aceptadas en historias y ADRs propias de Cerebro.
