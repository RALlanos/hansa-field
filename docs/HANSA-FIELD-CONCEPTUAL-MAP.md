# Hansa Field — mapa conceptual de la evolución

> Decisiones confirmadas el 2026-09-08: Dataset neutral y grupo opcional. B1 ya no bloquea implementación. El usuario autorizó reset de desarrollo y un baseline limpio, sin migración histórica. Los diagramas son el objetivo; no implican que todas las funcionalidades estén conectadas todavía.

Fecha: 2026-09-08. **Arquitectura propuesta, no implementada.** Leer decisiones y fases en el [plan](HANSA-FIELD-IMPLEMENTATION-PLAN.md).

Idea central: el molde no es el dato; el lugar de nacimiento no se borra; participar no es copiar; vincular no es fusionar. La propuesta de colección neutral para datos locales necesita la confirmación B1 del plan.

## Mapa 1 — Entidades principales

- **Plantilla:** molde reutilizable, sin registros.
- **App:** dataset operativo visible en el catálogo.
- **Colección/Dataset:** soporte común de schema y registros; puede ser de App o local de Proyecto. No duplica registros ni exige otra pantalla.
- **Proyecto:** contexto de trabajo, puede estar vacío.
- **Cajón:** receta de configuración.
- **Record:** representación individual con UUID y baseline.
- **ProjectApp:** configuración de una App relacionada con un Proyecto.
- **ProjectRecord:** participación editable localmente.
- **Territorio:** ubicación/asignación configurable.
- **Grupo:** equivalencia confirmada entre records, opcional y sin atributos fusionados.

```mermaid
flowchart TD
  T[Plantilla molde] -->|origen opcional| A[App operativa]
  A --> D[Colección con schema]
  P[Proyecto] -->|puede alojar| L[Colección local sin App]
  D --> R[Record]
  L --> R
  A --> PA[ProjectApp configuración]
  P --> PA
  P --> PR[ProjectRecord participación]
  PA -->|cuando existe App| PR
  R --> PR
  C[Cajón receta] -->|aplicar explícitamente| PA
  R --- M[Membresía territorial]
  M --- TR[Territorio]
  R --- G[Grupo opcional]
```

## Mapa 2 — Independencia

| Puede existir            | Sin necesitar                                         |
| ------------------------ | ----------------------------------------------------- |
| Plantilla                | App, Proyecto, Records                                |
| App                      | Plantilla, Proyecto, Cajón                            |
| Proyecto                 | App, Cajón, Records                                   |
| Cajón                    | Proyecto, datos                                       |
| Territorio/jerarquía     | App, Proyecto                                         |
| Record de App            | Proyecto/participación                                |
| Record local de Proyecto | App, pero sí colección/schema y participación inicial |
| Record no vinculado      | Grupo                                                 |

```mermaid
flowchart LR
  A[App] --> AC[Colección App]
  P[Proyecto vacío] -->|solo si importa localmente| PC[Colección local]
  AC --> R1[Record sin proyecto]
  PC --> R2[Record sin App]
  R2 --> PR[Participación en Proyecto]
```

Independencia no significa datos sin schema ni autorización. La organización administra acceso a ambos casos.

## Mapa 3 — Creación desde App

```mermaid
flowchart LR
  A[Elegir App] --> I[Inspección y mapping]
  I --> V[Preview y confirmar]
  V --> R[Record nuevo en colección App]
  V --> O[Origen App e importación]
  R --> S[Visibilidad según política]
  R -. incorporación posterior explícita .-> PR[Participación en Proyecto]
```

Ejemplo: importar P001 a App Postes no crea un proyecto artificial. Reimportar App requiere revisión y permiso de escritura del baseline.

## Mapa 4 — Creación desde Proyecto

```mermaid
flowchart TD
  P[Proyecto] --> D{Destino confirmado}
  D -->|App relacionada| PA[ProjectApp]
  D -->|Sin App| LC[Colección local con schema]
  PA --> I[Wizard actual y preview]
  LC --> I
  I --> C[Confirmación atómica]
  C --> R[Record nuevo]
  C --> PR[Participación inicial]
  C --> O[Origen Proyecto permanente]
  R --> V[Restringido salvo política explícita]
```

Sin App, no se crea una App escondida. Llevarlo posteriormente a App exige elección de migración compatible o consolidación; publicar por sí solo no lo mueve.

## Mapa 5 — App + varios Proyectos

```mermaid
flowchart TD
  A[App Postes] --> R[Record R1 baseline Hormigón]
  R --> PA[Participación A]
  R --> PB[Participación B]
  PA --> VA[A ve Hormigón]
  PB --> O[B override Metal]
  O --> VB[B ve Metal]
```

Un Record UUID, dos UUID de participación. Retirar B no borra R1 ni A. Si se crean dos representaciones independientes de la misma entidad, tendrán dos UUID y podrán vincularse: es un caso distinto.

## Mapa 6 — Territorios y jerarquías

```mermaid
flowchart TD
  S1[Jerarquía administrativa] --> L1[Niveles configurados]
  L1 --> T1[Territorios y límites versionados]
  S2[Jerarquía operativa] --> L2[Otros niveles configurados]
  L2 --> T2[Territorios operativos]
  T1 --> M[Membresías con método y revisión]
  T2 --> M
  R[Record geometría real] --> M
  PR[Geometría contextual] --> CM[Membresía contextual separada]
  T1 --> CM
```

Una línea puede cruzar varios territorios. Un punto en frontera requiere regla. La asignación manual no se borra al recalcular. El icono del mapa no determina territorio.

## Mapa 7 — Mapa Universal

```mermaid
flowchart TD
  A[Apps elegidas] --> S[Scope autorizado]
  P[Proyectos elegidos] --> S
  T[Territorios y filtros] --> S
  S --> B[Bbox y geometría efectiva]
  B --> E[Representaciones elegibles]
  E --> V[Preferencia visual opcional]
  V --> Q{Presupuesto y densidad}
  Q --> TA[Agregados territoriales]
  Q --> CL[Clusters espaciales]
  Q --> RF[Records individuales]
  TA --> UI[Mapa y contador con significado explícito]
  CL --> UI
  RF --> UI
```

No se descargan millones de registros. El contador diferencia records, participaciones y símbolos; una línea asociada a dos territorios no es dos records. Tabla usa mismo scope, paginada; detalles completos se piden al seleccionar.

## Mapa 8 — Posibles duplicados: tres decisiones

```mermaid
flowchart TD
  A[Record A] --> C[Candidato por reglas versionadas]
  B[Record B] --> C
  C --> R[Revisión humana]
  R --> N[1 No son iguales]
  N --> NR[Separados y rechazo persistente]
  R --> V[2 Vincular]
  V --> G[Grupo y prioridad visual]
  R --> U[3 Unificar]
  U --> M[Mapping y conflictos]
  M --> O[Resultado trazable sin borrar origen]
```

Misma coordenada no demuestra identidad. Un candidato pendiente no es vínculo. La detección no se ejecuta comparando todos los registros cada vez que se mueve el mapa.

## Mapa 9 — Vinculación y prioridad

```mermaid
flowchart TD
  G[Grupo E1 equivalencia confirmada] --> A[Record A conserva fuente y schema]
  G --> B[Record B conserva fuente y schema]
  G --> C[Record C conserva fuente y schema]
  G --> PG[Preferencia global A]
  G --> PC[Preferencia Proyecto B]
  PG --> ACL[Aplicar permisos filtros y bbox]
  PC --> ACL
  ACL --> UI[Representante elegible y badge de vinculados]
```

Vincular no modifica geometrías ni valores. Principal oculto/no elegible no aparece por ser principal. Desvincular elimina la relación activa, no el registro. Grupos con un rechazo previo entre miembros requieren resolver esa contradicción antes de unirse.

## Mapa 10 — Consolidación

```mermaid
flowchart LR
  A[Fuente A revisión fija] --> M[Mapping confirmado]
  B[Fuente B revisión fija] --> M
  M --> E[Equivalencias]
  M --> T[Transformaciones tipadas]
  M --> D[Campos diferentes separados]
  E --> C[Resolver conflictos y geometría]
  T --> C
  D --> C
  C --> P[Preview con ganadores]
  P --> R[Record resultado nuevo]
  P --> L[Lineage valores reglas y fuentes]
```

“Tipo” de material no es “Tipo” de estructura. “Poste de 9 metros” puede convertirse en Altura=9 mediante transformación confirmada. Los originales sobreviven; revertir resultado no borra las fuentes ni deshace cambios posteriores ajenos.

## Mapa 11 — Exportación

```mermaid
flowchart TD
  O[Origen y revisiones retenidas] --> A[Original App a revisión]
  O --> P[Original Proyecto a revisión]
  C[Resultado y lineage] --> E[Consolidado a revisión]
  A --> M[Archivo más manifest de identidades y schema]
  P --> M
  E --> M
```

Exportar archivo exacto requiere conservar sus bytes. Exportar estado original requiere snapshot. Lo perdido antes de esta evolución no puede reconstruirse inventando procedencia. Vinculación visual no excluye records de exportación por defecto.

## Mapa 12 — Lecturas independientes

| Vista      | Fuente lógica                                              |
| ---------- | ---------------------------------------------------------- |
| App        | Records de su colección, sin PR obligatorio                |
| Proyecto   | participaciones activas y efectivos; App o colección local |
| Territorio | memberships/geometría del scope autorizado                 |
| Universal  | unión de representaciones autorizadas, acotada             |
| Record     | baseline/revisión y contexto opcional                      |
| Grupo      | miembros confirmados; valores separados                    |

```mermaid
flowchart LR
  R[Records baseline] --> AV[Vista App y detalle]
  PR[Participaciones] --> PV[Vista Proyecto efectiva]
  TM[Membresías territoriales] --> TV[Vista Territorio]
  GM[Miembros de grupo] --> EV[Vista equivalencia]
  AV --> U[Mapa Universal por scope]
  PV --> U
  TV --> U
  EV --> U
```

Las flechas a Universal son composición conceptual de read models, no N llamadas frontend ni descarga completa de cada vista.

## Mapa 13 — Arquitectura completa propuesta

```mermaid
flowchart TD
  ORG[Organización y autorización] --> A[App independiente]
  ORG --> P[Proyecto independiente]
  T[Template y versiones sin datos] -->|opcional| A
  T -->|opcional| LD[Colección local con versión]
  A --> AD[Colección App con versión]
  P --> LD
  C[Cajón receta reusable] --> APPLY[Aplicación explícita con preview]
  APPLY --> PA[ProjectApp versión y settings locales]
  A --> PA
  P --> PA
  AD --> R[Record UUID baseline revisión]
  LD --> R
  R --> PR[ProjectRecord UUID revisión y overrides]
  P --> PR
  PA -->|opcional para participación local| PR
  I[Importar App o Proyecto] --> W[Writer único validado]
  W --> R
  W --> PR
  W --> O[Origen observaciones y changesets]
  R --> PUB[Publicación distinta de existencia]
  PR --> PROM[Promoción explícita con revisión]
  PROM --> R
  TS[TerritoryScheme] --> TL[TerritoryLevel]
  TL --> TERR[Territory versionado]
  TERR --> MEM[Membresías por método y revisión]
  R --> MEM
  PR --> MEM
  R --> DET[Candidatos no automáticos]
  DET --> DEC[Tres decisiones humanas]
  DEC --> NO[No iguales persistente]
  DEC --> GR[Grupo opcional sin mezclar valores]
  DEC --> CON[Consolidar con mapping y conflictos]
  CON --> RR[Record resultado con lineage]
  RR --> O
  O --> EXP[Exportación original o consolidada]
  PUB --> READ[Lectura autorizada bbox filtros y presupuesto]
  PR --> READ
  MEM --> READ
  GR --> READ
  RR --> READ
  READ --> MAP[Territorios clusters o features]
  READ --> TAB[Tabla cursor y contador coherente]
```

### Cómo evolucionaremos sin rehacerlo

Protección actual → identidad/revisión → Template/App/colección → Proyecto local → importación explícita → compartir/publicar/promover → territorios → mapa universal → vínculos → consolidación → retirar compatibilidad → certificar escala.

La fase de colecciones depende de confirmar B1. No se implementó ninguna flecha de estos diagramas en esta tarea. Se conservan datos existentes y se proponen migraciones incrementales, nunca reset.
