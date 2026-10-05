# Mapa de cambios: Cerebro antiguo `(2)` y documentación actual

## Propósito

Este documento permite revisar exactamente qué se cambió en el Cerebro para alinear su producto con Hansa Field. No es una especificación de código ni autoriza cambios técnicos por sí solo.

## Dónde están ambas versiones

La documentación está dentro de:

```text
C:\Users\Jhon_PC\Desktop\Cerebro oficial\Cerebro oficial\docs\scrum
```

- Los archivos que terminan en **`(2).md`** son la versión anterior y se conservan como referencia histórica.
- Los archivos con el mismo nombre, sin `(2)`, son la versión actual.
- Las decisiones nuevas que no existían antes son `ADR-8`, `ADR-9` y `ADR-10`.

> No se debe programar tomando un archivo `(2)` como regla vigente. Su utilidad es permitir comparar y entender el cambio.

## Mapa de referencias

| Área                   | Documento antiguo `(2)`                                | Documento actual                                      | Cambio principal                                                                                                   |
| ---------------------- | ------------------------------------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Reglas para IA/equipo  | `CLAUDE (2).md`                                        | `CLAUDE.md`                                           | Añade el modelo canónico, versiones, Record maestro, autorización por backend e importación con el mismo contrato. |
| Inicio                 | `docs/scrum/00 Inicio (2).md`                          | `docs/scrum/00 Inicio.md`                             | Define que ADR-8 prevalece sobre historias antiguas contradictorias.                                               |
| Visión                 | `01 Visión/Visión del proyecto (2).md`                 | `01 Visión/Visión del proyecto.md`                    | Cambia el foco de funcionalidades dispersas al núcleo operativo: Apps, Records, mapa/tabla y Proyectos.            |
| Épica Apps y Proyectos | `03 Épicas/EP-2 Proyectos y formularios (2).md`        | `03 Épicas/EP-2 Proyectos y formularios.md`           | Separa App reutilizable de Proyecto contextual.                                                                    |
| Constructor de campos  | `04 Historias/HU-2.2 ... (2).md` y `HU-2.3 ... (2).md` | `HU-2.2 ...md` y `HU-2.3 ...md`                       | El drop abre popup; etiqueta no es identidad; guardar campo y publicar versión son acciones explícitas.            |
| Versionado             | `HU-2.12 Versionado del formulario (2).md`             | `HU-2.12 Versionado del formulario.md` + `ADR-7`      | AppVersion publicada es inmutable; IDs de campo/opción son estables.                                               |
| Modelo Proyecto/App    | `HU-2.13 Proyectos dentro de una aplicación (2).md`    | `HU-2.16 Proyectos y Apps de Proyecto.md`             | Se descarta “Proyecto dentro de App”; se usan `ProjectApp` y `ProjectRecord`.                                      |
| Estado y estilo        | `HU-2.11 Estados y simbología (2).md`                  | `HU-2.11 Estados y simbología.md`                     | Estado/Tipo es un campo de selección; cada opción puede definir color e icono.                                     |
| Crear/editar Records   | No había un flujo web canónico prioritario             | `HU-3.11 Crear y editar Record canónico desde web.md` | El Record se valida, guarda con AppVersion, se edita y audita desde web.                                           |
| Mapa y tabla           | `HU-4.1` a `HU-4.5` con `(2)`                          | `HU-4.1` a `HU-4.5` sin `(2)`                         | Bbox, filtros, contador, mapa y tabla comparten el mismo conjunto operativo.                                       |
| Importación            | `HU-6.1`, `HU-6.2`, `HU-6.9` con `(2)`                 | Equivalentes sin `(2)`                                | Importar no crea un modelo aparte: usa la validación/persistencia de Records y exige preview/confirmación.         |
| Plan                   | `05 Sprints/Plan de lanzamiento (2).md`                | `05 Sprints/Plan de lanzamiento.md`                   | Sustituye un plan muy amplio por tres incrementos verticales verificables.                                         |
| Calidad                | `06 Calidad/Definición de Terminado (2).md`            | `06 Calidad/Definición de Terminado.md`               | Exige pruebas, aislamiento por organización, PostGIS, auditoría, IDs estables y ADR-8.                             |

## Documentos nuevos que explican el cambio

### 1. ADR-8 — modelo canónico

```text
docs/scrum/08 Decisiones/ADR-8 Modelo de dominio canónico de Hansa Field.md
```

Es el documento principal. Define:

```text
Organización → App → AppVersion → Record
Proyecto → ProjectApp → ProjectRecord → Record
```

Reglas que fija:

- `Record` no tiene `project_id` como fuente de verdad.
- Una App no pertenece a un único Proyecto.
- Un ProjectRecord no copia el Record maestro.
- Importación y captura manual usan el mismo contrato.
- El estilo de mapa pertenece a opciones del formulario.

### 2. ADR-9 — permisos de Records canónicos

```text
docs/scrum/08 Decisiones/ADR-9 Permisos sobre Records fuera de un Proyecto.md
```

Evita el vacío de seguridad de un Record que existe fuera de cualquier Proyecto. Está marcado como **Propuesta** y debe aceptarse o ajustarse antes de implementar esa área.

### 3. ADR-10 — alcance inicial de ProjectRecord

```text
docs/scrum/08 Decisiones/ADR-10 ProjectRecord como referencia simple en el Lanzamiento 1.md
```

Propone comenzar con ProjectRecord como referencia, sin editar atributos ni geometría local por Proyecto. Esto reduce complejidad y conserva la ampliación futura si aparece un caso real.

## Cambios explicados con ejemplos

### Antes: Proyecto como dueño del dato

```text
Proyecto FTTH
└── Poste P-1001

Proyecto Mantenimiento
└── copia de Poste P-1001
```

Problema: dos copias del mismo poste pueden cambiar de manera distinta.

### Ahora: dato maestro con participaciones

```text
App Postes
└── Record maestro P-1001

Proyecto FTTH
└── ProjectRecord → P-1001

Proyecto Mantenimiento
└── ProjectRecord → P-1001
```

Resultado: hay una fuente de verdad; cada Proyecto organiza el mismo activo sin duplicarlo.

### Antes: estados o categorías como entidades paralelas

```text
App
├── tabla/entidad Estado
└── lista separada de colores
```

### Ahora: simbología como parte del formulario

```text
App Red HFC
└── Campo Tipo de activo
    ├── POSTES    → verde + icono de poste
    ├── TAPS      → azul + icono de tap
    └── NODO      → naranja + icono de nodo
```

Resultado: el mismo valor sirve para formulario, validación, filtro, leyenda y símbolo de mapa.

### Antes: importación como flujo independiente

```text
Archivo → importador → tabla/capa propia
```

### Ahora: importación como creación controlada de Records

```text
Archivo → inspección → mapeo a AppVersion → validación
→ preview → confirmación → Record canónico + auditoría
```

## Orden correcto para revisar con el equipo

1. Leer `ADR-8`.
2. Comparar `HU-2.13 ... (2)` contra `HU-2.16`.
3. Comparar el plan de lanzamiento anterior y el actual.
4. Revisar `HU-3.11` como el flujo central de crear/editar un Record.
5. Revisar `HU-4.1` a `HU-4.5` para entender mapa, tabla, filtros y rendimiento.
6. Revisar `HU-6.1`, `HU-6.2` y `HU-6.9` para confirmar que la importación no crea un sistema paralelo.

## Decisiones aún pendientes

Antes de implementar las áreas correspondientes, el equipo debe resolver:

1. ADR-9: alcance de permisos sobre Records fuera de Proyecto.
2. ADR-10: ProjectRecord simple o con overrides locales en el Lanzamiento 1.
3. Qué hacer cuando una importación trae una opción desconocida: una AppVersion publicada no puede mutarse; se crea borrador, se publica versión y se vuelve a validar el lote.
4. Qué repositorio es la fuente técnica de verdad para no abrir implementaciones paralelas.
