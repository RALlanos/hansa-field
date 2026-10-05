# Cerebro — comparación: antes y ahora

> Este documento explica el cambio de dirección aplicado a la documentación de Cerebro. No modifica código, datos ni tecnología.

## Resumen

Antes, Cerebro tenía buenas decisiones técnicas, pero el producto podía terminar pareciéndose a un importador de archivos GIS con capas, listas y clasificaciones.

Ahora, Cerebro está documentado como **Hansa Field**: una plataforma GIS configurable inspirada funcionalmente en Fulcrum, donde el centro es el Registro georreferenciado operable, no el archivo importado.

## Comparación directa

| Tema                     | Antes                                                                     | Ahora                                                                                      |
| ------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Centro del producto      | Importar Excel, GIS, listas y clasificaciones.                            | Crear App → publicar formulario → crear/editar Record → operar mapa y tabla.               |
| App                      | Podía quedar ligada a un Proyecto.                                        | Es reutilizable e independiente de Proyectos.                                              |
| Formulario               | Los cambios sobre datos ya existentes no estaban definidos con precisión. | Una AppVersion publicada es inmutable; cambiar el formulario crea una versión nueva.       |
| Campos                   | El nombre visible podía terminar identificando al campo.                  | `fieldId` estable: “Altura” puede pasar a “Altura del poste” sin romper los datos.         |
| Registro                 | Podía depender directamente de un Proyecto.                               | Es canónico, pertenece a una AppVersion y puede participar en varios Proyectos.            |
| Proyecto                 | Tendía a contener Apps y Records propios.                                 | Usa `ProjectApp` y `ProjectRecord` como participaciones sin copiar el dato maestro.        |
| Colores de mapa          | Se consideraban estados o clasificaciones separadas.                      | Un campo de selección como Estado o Tipo puede definir color e icono por opción.           |
| `POSTES`, `TAPS`, `NODO` | Podían terminar como Apps o entidades separadas.                          | Pueden ser opciones de una App, con estilos y filtros propios.                             |
| Importación              | Podía tener persistencia y validaciones propias.                          | Usa el mismo contrato que crear o editar un Record manualmente.                            |
| Excel                    | Parecía necesario para crear listas u opciones.                           | Es opcional para importar datos; las opciones normales se configuran en el constructor.    |
| Mapa                     | Existía riesgo de descargar todos los activos al navegador.               | Consulta por bbox, filtros, clustering y detalle bajo demanda.                             |
| Tabla                    | Podía trabajar separada del mapa.                                         | Comparte contexto, filtros, selección y datos con el mapa.                                 |
| Prioridad                | Móvil, importadores, exportaciones, clasificaciones y reportes tempranos. | Primero un núcleo web operativo; después importación, offline, multimedia y exportaciones. |
| Permisos                 | Principalmente por Proyecto.                                              | Por organización, App, Proyecto y participación; siempre validados en backend.             |
| Geometría                | Tendía a considerarse inmutable.                                          | Se puede corregir con permiso, SRID explícito y auditoría.                                 |

## Cambio esencial de flujo

### Antes

```text
Archivo
  ↓
Importar
  ↓
Capa / lista / clasificación
  ↓
Visualizar
```

### Ahora

```text
App configurable
  ↓
Versión publicada
  ↓
Record geográfico canónico
  ↓
Mapa + tabla + filtros + formulario + auditoría
  ↓
Participación opcional en uno o varios Proyectos
```

## Ejemplo: un activo en dos proyectos

### Antes: riesgo de duplicación

Un mismo poste podía pertenecer a un único Proyecto mediante `project_id`, o copiarse para aparecer en dos proyectos. Eso provoca información duplicada y difícil de mantener.

### Ahora: una fuente de verdad

```text
Poste P-1001 = un Record maestro

Proyecto Mantenimiento Norte
└── ProjectRecord → referencia a P-1001

Proyecto Expansión FTTH
└── ProjectRecord → referencia al mismo P-1001
```

El poste se almacena una vez. Cada Proyecto puede organizar su participación sin modificar el activo maestro ni el otro Proyecto.

## Ejemplo: colores y filtros tipo Fulcrum

Una sola App puede contener activos distintos sin multiplicarse en Apps separadas:

```text
App: Red HFC
└── Campo de selección: Tipo de activo
    ├── POSTES     → verde + icono de poste
    ├── TAPS       → azul + icono de tap
    ├── NODO       → naranja + icono de nodo
    └── DIVISORES  → morado + icono de divisor
```

El mapa, la leyenda y los filtros usan esas mismas opciones. La configuración se guarda en la AppVersion y no en una tabla de estados paralela.

## Decisiones que siguen pendientes

La dirección ya es correcta, pero el equipo debe cerrar estas decisiones antes de implementar sus áreas correspondientes:

1. **Permisos de Records fuera de un Proyecto:** decidir si el rol de organización aplica globalmente o por App.
2. **ProjectRecord en el Lanzamiento 1:** se recomienda empezar como referencia simple, sin atributos ni geometría locales editables.
3. **Fuente técnica de verdad:** confirmar un único repositorio oficial antes de abrir ramas, CI o despliegues.
4. **Importar opciones desconocidas:** una importación no puede modificar una AppVersion publicada; debe crear un borrador, publicar nueva versión y volver a validar el lote.

## Conclusión

Cerebro no necesitaba cambiar de stack. React, FastAPI, Flutter, PostGIS y MapLibre son adecuados. El cambio necesario era de **modelo de producto y dominio**:

> Hansa Field no es un importador GIS. Es una plataforma para configurar Apps versionadas, operar Records geográficos canónicos y relacionarlos con Proyectos sin perder su identidad.
