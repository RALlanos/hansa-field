# ADR-0002: Apps como fuente maestra y proyectos como organización contextual

## Estado

Aceptado

## Fecha

2026-09-02

## Contexto

Un mismo tipo de información puede utilizarse en varios proyectos. Duplicar Apps o registros para cada proyecto produce inconsistencias y repite el problema observado en Fulcrum. Al mismo tiempo, un proyecto necesita organizar subconjuntos por país, departamento, nodo u otra estructura y añadir campos contextuales.

## Decisión

Cada registro maestro pertenece a una App y recibe un UUID estable. Un proyecto referencia Apps y registros mediante membresías y contenedores anidados; no copia el registro maestro. Los campos base actualizan el maestro y los campos exclusivos del proyecto se guardan en la membresía contextual.

Las importaciones pueden comenzar desde una App o desde un proyecto configurado. En ambos casos crean o actualizan registros en Apps maestras. Una carga desde proyecto también crea las membresías de contenedor en la misma operación confirmada.

## Alternativas consideradas

### Copiar registros dentro de cada proyecto

Rechazado porque produce múltiples verdades para un mismo activo y vuelve ambiguas las reimportaciones.

### Hacer que el proyecto sea propietario exclusivo del registro

Rechazado porque impide reutilizar una App como catálogo maestro y obliga a repetir datos entre proyectos.

## Consecuencias

- El UUID identifica el mismo elemento a través de exportaciones y reimportaciones.
- Las vistas por App y por proyecto muestran perspectivas distintas de la misma información.
- El esquema debe separar valores maestros de extensiones contextuales.
- Los permisos futuros pueden aplicarse a Apps, proyectos, contenedores o membresías.
