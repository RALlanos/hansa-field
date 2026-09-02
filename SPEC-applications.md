# Spec: Applications

## Objective

Entregar el núcleo configurable de Hansa Field. Un usuario maestro crea Apps, define sus campos y secciones, guarda versiones y captura/consulta registros con o sin geometría. Cada App admite puntos, líneas, polígonos o registros tabulares según su definición.

## Capability map

| Módulo      | Responsabilidad                             | Depende de  |
| ----------- | ------------------------------------------- | ----------- |
| app-catalog | Crear, listar y abrir Apps                  | PostGIS     |
| app-schema  | Campos, secciones, validación y versiones   | app-catalog |
| app-records | Captura y consulta de registros con UUID    | app-schema  |
| app-views   | Mapa, dividido y tabla; vista por extensión | app-records |

Orden: `app-catalog → app-schema → app-records → app-views`.

## Boundaries

- Siempre: validar entrada en API, UUID estables, consultas SQL parametrizadas, datos de App separados de excepciones futuras de Proyecto.
- Preguntar antes: nuevos tipos de archivo, autenticación/roles, cambio de esquema que elimine datos.
- Nunca: duplicar una App para ocultar campos, enviar atributos no autorizados una vez existan permisos, crear datos de muestra en la base del usuario sin aviso.

## Success criteria

- Una App puede crearse, listarse y abrirse desde la web.
- Un constructor permite secciones y los tipos: texto corto/largo, número, sí/no, fecha, hora, selección simple/múltiple, foto, archivo y firma.
- Guardar genera una versión utilizable sin invalidar registros existentes.
- Un registro puede no tener geometría o tener Point, LineString o Polygon según la App.
- La vista alterna mapa, mapa+tabla y tabla sin descargar todos los registros fuera de la extensión del mapa.
- El modelo deja un punto de extensión para reglas por campo/acción y sobrescrituras de Proyecto, sin implementarlas aún.
