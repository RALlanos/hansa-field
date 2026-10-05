# ADR-0004: Opciones de campo e importación GIS como un único flujo operativo

## Estado

Propuesto para implementación. Este documento es el respaldo de producto y arquitectura para adaptar módulos nuevos sin alterar el modelo de dominio de Hansa Field.

## Fecha

2026-10-01

## Decisión en una frase

Los datos geográficos se importan como Registros de una App y se interpretan mediante la versión de esa App; las opciones de selección se configuran en el Diseñador, no mediante módulos de importación de Excel visibles como flujo principal.

## Contexto

Hansa Field es una plataforma GIS operativa configurable. Un usuario configura una App, captura o importa Registros geográficos, los consulta en mapa y tabla, y puede relacionarlos con Proyectos. Fulcrum es una referencia funcional, pero no define por sí solo el dominio de Hansa.

En algunos trabajos recientes aparecieron dos módulos de primer nivel:

- **Listas de opciones**: catálogos reutilizables de valores para campos de selección.
- **Clasificaciones**: árboles jerárquicos de valores para un campo.

También se promovió la importación CSV/XLSX de esos catálogos. Esto crea una impresión equivocada: que los datos deben prepararse en hojas de cálculo antes de poder importar o configurar una App.

En la operación GIS real, un Shapefile, KML, GeoJSON, DXF procesado o fuente externa como Fulcrum normalmente ya trae geometría y atributos. Por ejemplo:

```text
Geometría         POINT / LINESTRING / POLYGON
STATUS            POSTES / TAPS / NODO / DIVISORES
MATERIAL          HORMIGÓN / MADERA
DISTRITO          EQUIPETROL
TECNOLOGÍA        HFC / FTTH
```

El trabajo correcto no es importar otro archivo para crear el catálogo: es asociar esas columnas a campos estables de la App, validar sus valores y usarlos para filtros, formularios y simbología cartográfica.

## Problema del enfoque actual

### 1. El producto parece un importador de catálogos

Una pantalla vacía de “Clasificaciones” que invita a importar CSV/XLSX hace parecer que esa carga es un paso previo obligatorio. No lo es para el flujo ordinario de crear una App e importar datos GIS.

Esto aleja el producto de su tarea operativa: configurar una App, abrir registros, trabajar sobre un mapa, filtrar, editar y auditar.

### 2. La terminología confunde niveles de dominio distintos

Una clasificación es solamente un conjunto de valores de un campo. Por ejemplo:

```text
Bolivia → La Paz → Murillo → La Paz
```

No es un Proyecto, una Project App, una participación (`project_record`), un territorio ni la Segmentación operativa. Llamar a todo “clasificación” o “segmento” induce a organizar los Registros mediante un catálogo de valores cuando cada mecanismo tiene responsabilidades distintas.

### 3. Se corre el riesgo de perder identidad e historial

Si una lista compartida se modifica libremente, cambiar la etiqueta `POSTE` por `POSTE DE HORMIGÓN`, eliminarla o reutilizarla puede alterar cómo se interpretan Registros históricos. La etiqueta visible no puede ser la identidad.

Además, una App publicada no puede cambiar retroactivamente el significado de un formulario, sus opciones, sus validaciones o su simbología.

### 4. El importador puede convertirse en un camino paralelo

Si la carga GIS acepta atributos sin pasar por la versión de la App, se terminan con reglas distintas para creación manual e importación. Eso rompe validaciones, estilos, filtros y auditoría.

## Modelo conceptual obligatorio

### Definición, versión e instancia

```text
App (identidad estable)
└── AppVersion publicada e inmutable
    ├── campos con fieldId estable
    ├── secciones y UI
    ├── reglas y validaciones
    ├── geometrías permitidas
    └── opciones de selección y simbología

Record (dato canónico)
├── appId
├── appVersionId de creación/edición aplicable
├── atributos validados
└── geometría PostGIS
```

Un cambio a una App publicada crea una nueva versión. No se reescriben los campos ni opciones de versiones anteriores. Cada campo y cada opción debe tener un UUID o clave interna estable; el `label` es solo texto presentado al usuario.

### Proyectos y participaciones

Los Proyectos no son propietarios implícitos del Registro:

```text
Project
└── ProjectApp
    └── ProjectRecord
        └── Record canónico
```

Un valor de `Estado` no crea un Proyecto ni una App nueva. Tampoco debe duplicar un Record. Si el Proyecto requiere atributos o geometría local, los guarda en su participación (`ProjectRecord`) sin modificar el Record maestro ni participaciones de otros Proyectos.

### Qué significa cada término

| Término          | Propósito                                                          | No es                               |
| ---------------- | ------------------------------------------------------------------ | ----------------------------------- |
| Opción de campo  | Valor permitido para un campo, como `TAPS`                         | Un Record ni una App                |
| Lista compartida | Catálogo reutilizable en varios campos/App bajo decisión explícita | Requisito para toda importación     |
| Lista jerárquica | Opciones padre/hija para un único campo                            | Segmentación, Proyecto o territorio |
| Segmentación     | Organización o filtro operativo de participaciones/registros       | Un catálogo de opciones             |
| Project Record   | Participación de un Record en un Proyecto                          | Copia del Record canónico           |

## Decisión funcional

### Opciones dentro del Diseñador de Apps

Para un campo de selección simple o múltiple, el Diseñador debe permitir:

- crear opciones;
- editar etiqueta y descripción;
- ordenar opciones;
- activar/desactivar una opción;
- marcar una opción como predeterminada cuando corresponda;
- asignar color e icono opcional para el mapa;
- conservar su identificador estable aunque cambie la etiqueta.

Ejemplo de configuración:

```text
App: Red HFC
Campo: Estado
Campo usado para simbología: Sí

POSTES       → id estable → verde   → icono de poste
TAPS         → id estable → azul    → icono de tap
NODO         → id estable → naranja → icono de nodo
DIVISORES    → id estable → morado  → icono de divisor
```

El estilo general de la App sigue siendo el fallback para Registros cuyo valor no tenga simbología particular.

### Listas compartidas como capacidad avanzada

La capacidad se conserva para casos reales: catálogos corporativos de materiales, departamentos, municipios o tipos de equipo que se reutilizan intencionalmente en varias Apps.

No será una sección principal de la navegación. En el Diseñador se presentará como una elección secundaria:

```text
Opciones del campo
  ( ) Definir opciones en esta App
  ( ) Usar lista compartida
```

La edición de una lista compartida usada por una versión publicada deberá crear una versión de catálogo o requerir una nueva versión de App. Nunca debe cambiar silenciosamente la interpretación de los Registros históricos.

### Listas jerárquicas: postergadas, no eliminadas

Una jerarquía de valores puede ser útil en países o áreas con estructuras geográficas diferentes:

```text
País → Departamento/Estado → Provincia → Municipio/Distrito
```

Sin embargo, no es un requisito para crear una App ni para importar un archivo GIS. Se pospone como opción avanzada de un campo de selección. No debe aparecer como “Clasificaciones” en la navegación operativa hasta que exista un caso concreto, UX aprobada y reglas de versionado.

## Flujo de importación GIS

La importación y la creación manual usan el mismo contrato de Registro:

```text
Archivo GIS / integración externa
        ↓
Elegir App y versión destino
        ↓
Inspeccionar capas, geometrías y columnas
        ↓
Mapear columna → fieldId de la App
        ↓
Normalizar tipos y CRS
        ↓
Validar geometría y opciones
        ↓
Preview de incidencias y decisión explícita
        ↓
Confirmar
        ↓
Records canónicos + ProjectRecords si se importó desde Proyecto
        ↓
Reporte auditable
```

### Mapeo de opciones durante importación

Para una columna de selección, el usuario ve los valores distintos encontrados y decide antes de confirmar:

```text
Archivo: STATUS
App:    Estado

POSTES     → POSTES
TAPS       → TAPS
NODO       → NODO
SIN_DATO   → omitir / rechazar / crear opción nueva
```

La creación de opciones nuevas no puede ser automática e invisible. Debe aparecer en el preview y quedar registrada. Las políticas posibles son:

- **rechazar** registros con valores no válidos;
- **omitir** esos registros con incidencia;
- **crear opciones nuevas** tras confirmación explícita, generando la versión de App necesaria.

Un mismo archivo con `STATUS = POSTES`, `TAPS` y `NODO` crea Registros dentro de una misma App. No crea una App ni un Proyecto por cada valor de Estado.

## Mapa, filtros y simbología

La simbología es una propiedad de representación, no de la geometría. Un Record puede seguir siendo `Point` aunque su Estado determine un icono o color específico.

Cuando la App tiene un campo de simbología configurado, mapa y panel de filtros deben consumir la misma definición de AppVersion:

- leyenda: opciones activas con color/icono;
- filtro: incluir/excluir valores del campo;
- mapa: pintar por opción o usar fallback de la App;
- tabla: mostrar valor legible y no solo ID interno;
- detalle: cargar atributos completos bajo demanda.

Las consultas continúan limitadas por bbox, filtros y paginación. La simbología no autoriza descargar todos los Records al navegador.

## Cambios requeridos

### Interfaz

1. Retirar “Listas de opciones” y “Clasificaciones” de la navegación principal.
2. Incorporar opciones y simbología por opción al Diseñador de Apps.
3. Dejar “usar lista compartida” como control avanzado dentro de configuración de campo.
4. No mostrar CSV/XLSX como paso o pantalla principal para crear una App.
5. Añadir preview de valores de selección en el asistente de importación GIS.
6. Mostrar leyenda y filtros basados en el campo configurado para simbología.

### Backend y contratos

1. Centralizar validación de opciones por `fieldId` y `optionId` estable.
2. Incorporar opciones, estilo por opción y campo de simbología en el snapshot inmutable de AppVersion.
3. Hacer que la importación invoque el mismo servicio de validación/creación de Records que la captura manual.
4. Registrar en auditoría el mapeo, normalizaciones, opciones creadas, omisiones y errores.
5. Mantener APIs de catálogos existentes solo como infraestructura no expuesta hasta rediseñar su versionado y permisos.
6. No introducir `records.project_id` directo ni caminos paralelos de persistencia.

### Datos y migración

1. No eliminar catálogos existentes sin inventariar sus referencias.
2. No reescribir valores históricos por cambios de etiquetas.
3. Migrar progresivamente opciones de catálogos a definiciones de AppVersion cuando estén utilizadas por una App.
4. Si no hay datos valiosos en desarrollo, es preferible reiniciar datos de prueba a mantener compatibilidad compleja; la decisión de borrado requiere aprobación explícita.

## Alternativas descartadas

### Hacer de Excel/CSV el mecanismo normal para opciones

Rechazado. Duplica información ya existente en archivos GIS, añade pasos y errores de coordinación, y desplaza la configuración de la App hacia un flujo administrativo ajeno al trabajo operativo.

### Crear una App por cada Estado o Tipo

Rechazado. Duplica formularios, rompe filtros unificados y hace más difícil reutilizar el mismo activo en Proyectos. Estado, tipo y material son atributos, no identidades de App por defecto.

### Usar “clasificaciones” como Segmentación

Rechazado. Un árbol de valores de campo no expresa participación en Proyecto ni reemplaza el modelo de Segmentación. Mezclarlos vuelve ambiguas las consultas y los permisos.

### Permitir que cualquier edición de lista cambie datos existentes

Rechazado. Destruye la semántica histórica de Registros y versiones publicadas.

## Alcance que queda fuera por ahora

- importador masivo de catálogos Excel/CSV como experiencia operativa;
- clasificación jerárquica editable en producción;
- propagación automática de cambios de listas compartidas;
- crear Apps/Proyectos automáticamente por valores de un atributo;
- rediseñar Segmentación como parte de esta entrega.

Estas capacidades pueden retomarse con una necesidad concreta, contrato, modelo de permisos y prueba de versionado.

## Criterios de aceptación

La implementación de este ajuste se considera lista cuando:

1. Un administrador configura un campo `Estado` y sus opciones dentro del Diseñador.
2. Publicar cambios produce una AppVersion nueva, preservando versiones previas.
3. Un Shapefile/KML/GeoJSON se mapea por columna a campos estables de la App.
4. Valores de selección inválidos aparecen en preview y no se incorporan sin una decisión explícita.
5. El mapa representa los Registros por color/icono según el campo de simbología configurado.
6. Leyenda, filtros, tabla y mapa muestran el mismo conjunto de Registros bajo los mismos filtros y bbox.
7. Un Registro importado puede abrirse, editarse, validarse y auditarse como uno creado manualmente.
8. La carga desde un Proyecto crea participaciones sin copiar ni alterar el Record canónico innecesariamente.

## Consecuencias

- La experiencia inicial es más simple: se configura una App y se importan o capturan Registros.
- Se mantiene la flexibilidad regional: cada organización puede definir sus propios estados, tipos y jerarquías futuras.
- Los catálogos grandes siguen siendo posibles, pero no condicionan el MVP.
- La simbología por valor permite replicar el comportamiento útil de Fulcrum sin multiplicar Apps.
- El equipo debe implementar versionado y validación correctamente antes de habilitar edición masiva de catálogos compartidos.
