# Mapa de capacidades: Hansa Field

## Propósito

Este mapa descompone Hansa Field en módulos estables que pueden especificarse, construirse y validarse de forma independiente. Los documentos del área piloto sirven como evidencia funcional; este mapa reestructura ese material para obtener un producto corporativo configurable.

## Supuestos que estamos haciendo

1. El área que actualmente usa Fulcrum será el primer piloto, pero no será el único consumidor futuro.
2. El MVP debe completar un flujo real de extremo a extremo, no replicar todo el catálogo de Fulcrum.
3. La primera entrega será una aplicación accesible directamente, sin login, usuarios ni restricciones funcionales. Estas capacidades se incorporarán después por capas.
4. La administración principal se realizará en web y el trabajo de campo requerirá posteriormente una experiencia móvil offline.
5. Apps de datos y formularios serán fuentes maestras configurables. Los proyectos asociarán Apps y subconjuntos de sus registros, organizados en contenedores anidados, sin duplicar los datos.
6. GIS es una capacidad central del piloto; la integración profunda con el ERP puede evolucionar después del flujo base.
7. Una realidad física debe corresponder a un registro maestro; las diferencias entre audiencias se resolverán más adelante mediante permisos, vistas y relaciones.
8. La arquitectura inicial será un monolito modular desplegable como una unidad, con contratos internos explícitos y propiedad de datos por módulo.
9. Hansa dispone de infraestructura Linux en la nube y despliega servicios con Docker; Hansa Field operará con repositorio, despliegue y base independientes dentro de ese entorno, aunque comparta el servidor físico con el ERP.
10. La primera interfaz será web de escritorio/responsiva. La experiencia Android y la sincronización offline se diseñarán como evolución posterior, sin bloquear el MVP web.
11. La escala inicial de referencia es de unas 70 Apps, múltiples Apps por proyecto y alrededor de 8.000 registros por App, con posibilidad de crecimiento e importaciones grandes.

## Decisión arquitectónica preliminar

Se propone un **monolito modular**: una sola aplicación desplegable y, si resulta suficiente, una sola base de datos física; internamente cada módulo tendrá responsabilidades, contratos y tablas claramente delimitados.

La modularidad se utilizará para aislar cambios y reglas de negocio, no solamente para implementar permisos. Los módulos de dominio no deberán conocer cómo se autentica un usuario. En su lugar, `platform-foundation` definirá un contrato neutral de contexto de ejecución y autorización. Durante el prototipo, un adaptador de operador único permitirá todas las acciones; posteriormente `identity-and-access` implementará usuarios, sesiones y políticas sin reescribir la lógica de cada módulo.

Esta decisión sigue siendo preliminar hasta validar el stack, las dependencias y los principales flujos de datos en la especificación de `platform-foundation`.

## Módulos propuestos

| Module id | Responsabilidad | Depende de | Prioridad propuesta |
|---|---|---|---|
| `platform-foundation` | Stack, dependencias, estructura del monolito modular, configuración, persistencia, archivos, contratos internos, manejo de errores y puertos para autorización futura. | — | Primero |
| `workspaces-and-projects` | Estructura corporativa, proyectos, árboles de contenedores anidados, asociaciones con Apps, membresías de registros, importación contextual y permisos heredables por subárbol. | `platform-foundation` | MVP base |
| `app-builder` | Apps de datos reutilizables, tipos de objeto con geometrías mixtas, formularios, campos comunes o condicionales, reglas, versiones, previsualización, publicación y capas de personalización por proyecto. | `platform-foundation`, `workspaces-and-projects` | MVP base |
| `records-and-assets` | Registros, activos maestros, UUID, relaciones, estados, evidencias y metadatos. | `app-builder`, `workspaces-and-projects` | MVP base |
| `geospatial-data` | Geometrías, mapas, capas, edición individual y masiva, validación CRS e importación/exportación SHP, KML/KMZ, CSV y GeoJSON priorizados. | `records-and-assets` | MVP |
| `data-exchange` | Importación/exportación desde Apps o proyectos configurados, clasificación de un archivo hacia varias Apps, asignación simultánea a contenedores, mapeo, previsualización, validación, conflictos y trabajos asíncronos. | `records-and-assets`, `geospatial-data` | MVP |
| `field-operations` | Captura, fotos, archivos, GPS, borradores, asignación de trabajo y posterior operación offline con sincronización. | `records-and-assets`, `geospatial-data` | MVP por etapas |
| `review-and-governance` | Revisión, aprobación, conflictos, historial, auditoría, archivado y trazabilidad. | `records-and-assets`, `field-operations` | MVP |
| `identity-and-access` | Login, usuarios, sesiones y permisos componibles por acción, recurso, alcance, sección y campo. Puede ofrecer perfiles como plantillas, pero no depende de una jerarquía fija de tipos de usuario. Implementa los puertos definidos por la fundación. | `platform-foundation`, `workspaces-and-projects` | Después de validar las bases |
| `data-delivery` | Reportes, vistas, filtros guardados, PDF y compartición controlada; aplica restricciones cuando exista `identity-and-access`. | `data-exchange`, `review-and-governance` | MVP acotado / expansión posterior |
| `integrations-and-automation` | API, webhooks, eventos, importaciones avanzadas, ERP y conciliación de materiales. | `records-and-assets`, `review-and-governance` | Posterior al núcleo independiente; el MVP solo prepara contratos |
| `insights-and-operations` | Dashboards, indicadores, búsqueda transversal, observabilidad y operación a escala. | `data-delivery`, `integrations-and-automation` | Posterior al MVP |

## Orden de construcción propuesto

```text
platform-foundation
  -> workspaces-and-projects
  -> app-builder
  -> records-and-assets
  -> geospatial-data
  -> data-exchange
  -> field-operations
  -> review-and-governance
  -> identity-and-access
  -> data-delivery
  -> integrations-and-automation
  -> insights-and-operations
```

Algunas capacidades podrán desarrollarse en paralelo después de estabilizar `records-and-assets`, pero sus contratos deberán respetar esta dirección de dependencias.

## Modelo de autorización futuro

Hansa Field no utilizará una jerarquía rígida de cargos como fuente de autoridad. Dos personas con el mismo cargo organizativo podrán tener permisos diferentes, y una misma persona podrá combinar capacidades de varias áreas.

Una concesión de permiso deberá expresar como mínimo:

```text
Sujeto + Acción + Recurso + Alcance + Visibilidad/edición de campos
```

Ejemplos conceptuales:

| Sujeto | Acción | Recurso y alcance | Restricción de datos |
|---|---|---|---|
| Operador A | Editar | Proyecto Norte y sus Apps | Todos los campos autorizados |
| Operador B | Consultar y generar informes | Proyecto Norte | Solo lectura |
| Comercial | Consultar y editar | Registros de clientes asignados | Ocultar secciones técnicas; editar únicamente campos comerciales |
| Almacén | Consultar | Materiales de proyectos autorizados | Sin acceso a información técnica ni edición de registros |

Los perfiles como `operador`, `comercial` o `almacén` serán plantillas opcionales para asignar un conjunto inicial de permisos. No serán tipos cerrados ni impedirán añadir o retirar permisos específicos por persona.

Cada módulo publicará un catálogo estable de capacidades, por ejemplo `project.update`, `app.publish`, `record.read`, `record.update`, `record.export` y `material.read`. `identity-and-access` decidirá si un sujeto puede ejecutar una capacidad dentro de un alcance, mientras el módulo propietario continuará validando sus reglas de negocio.

La autorización deberá cubrir por separado:

- **acción:** consultar, crear, editar, eliminar, aprobar, importar, exportar, compartir o administrar;
- **recurso:** proyecto, App de datos, registro, material, archivo, reporte u otro módulo;
- **alcance:** organización, área, país, cliente, proyecto, App o registros asignados;
- **datos:** secciones y campos visibles, editables, importables y exportables;
- **condiciones:** estado del registro, asignación, pertenencia al proyecto u otras reglas explícitas.

La política exacta de combinación, prioridad entre concesiones y restricciones, herencia y denegaciones se definirá en la especificación de `identity-and-access`; no debe quedar dispersa dentro de controladores, pantallas o consultas de cada módulo.

## Corte propuesto del MVP piloto

El MVP no se define como una lista aislada de pantallas. Debe demostrar este recorrido completo:

1. El equipo valida el stack, la visualización, el almacenamiento y la estructura del monolito modular mediante una base ejecutable mínima.
2. Un operador entra directamente; crea Apps desde el área de Apps y proyectos desde el área de Proyectos, sin autenticación inicial.
3. Configura, previsualiza y publica un formulario.
4. Importa registros y geometrías, mapea atributos, previsualiza errores y evita duplicados.
5. Crea o modifica registros y evidencias desde la aplicación.
6. Revisa cambios, errores o conflictos y consulta el historial.
7. Filtra y exporta los datos y geometrías.
8. Después de validar este núcleo, se incorporan login, usuarios y restricciones por acción, recurso y campo.

Las funciones que no sean necesarias para completar o verificar este recorrido deberán justificarse antes de entrar al MVP.

## Decisión requerida para cerrar la Fase 0

El equipo debe aprobar o corregir:

- los límites y nombres estables de los módulos;
- la dirección de sus dependencias;
- el orden general de construcción;
- el recorrido que define el MVP piloto.

Después de esta aprobación se redactará una especificación independiente por módulo, comenzando por `platform-foundation`. Esa especificación comparará y decidirá programas, framework, lenguaje, base de datos, librerías GIS, visualización de mapas, almacenamiento de archivos, formatos de importación/exportación y estrategia de pruebas antes de iniciar el código del producto.
