# Bitácora de implementación de Hansa Field

## Inicio de la implementación

- **Fecha:** 2026-09-02
- **Hora:** 12:43:39
- **Zona horaria:** America/La_Paz (UTC-04:00)
- **Responsables:** equipo de desarrollo Hansa — Jhon y Codex
- **Estado inicial:** especificación funcional y mapa de capacidades aprobados; no existe todavía repositorio de código en esta carpeta.

## Qué estamos construyendo

Hansa Field será una aplicación web corporativa independiente del ERP. Su función será definir Apps de datos, importar y normalizar información geográfica, mantener registros maestros con UUID, visualizarlos en mapas y organizarlos posteriormente dentro de proyectos jerárquicos. La arquitectura debe admitir futuras identidades, permisos componibles e integración controlada con el ERP sin acoplar ambos productos.

## Primera entrega autorizada

La primera entrega es una prueba vertical ejecutable y verificable:

1. Repositorio independiente y estructura de monolito modular.
2. Aplicación web y API ejecutables localmente.
3. PostgreSQL/PostGIS independiente.
4. Creación y listado de Apps.
5. Registros maestros con UUID y geometrías Point, LineString y Polygon.
6. Importación inicial GeoJSON/CSV con validación, previsualización y confirmación.
7. Consulta por extensión y visualización mediante MapLibre.
8. Prueba técnica separada para lectura DWG/DXF en Linux.

## Resultado esperado

Al cerrar esta entrega debe poder demostrarse el recorrido:

```text
Crear App
  → cargar archivo
  → validar y previsualizar
  → confirmar
  → generar o reconocer UUID
  → persistir en PostGIS
  → consultar la extensión visible
  → mostrar los registros en el mapa
```

La repetición de una importación con UUID conocido debe actualizar el registro correspondiente; un UUID desconocido debe invalidar la importación; un elemento sin UUID debe convertirse en candidato nuevo.

## Fuera de esta entrega

- Login, usuarios y permisos reales.
- Integración con ERP, Work Orders y materiales.
- Aplicación Android y funcionamiento offline.
- Constructor completo de formularios y variantes por proyecto.
- Árbol definitivo de proyectos y contenedores.
- Importación masiva multi-App completa.
- Exportaciones finales e informes específicos.
- Conversión CAD integrada antes de validar compatibilidad y licencias.

## Entorno comprobado al inicio

| Componente     | Versión detectada |
| -------------- | ----------------- |
| Node.js        | 24.19.0           |
| Corepack       | 0.35.0            |
| pnpm           | 11.19.0           |
| Docker         | 29.7.2            |
| Docker Compose | 5.4.0             |

## Cambios de alcance o diseño durante la implementación

Registrar aquí únicamente cambios reales respecto del plan aprobado, incluyendo fecha, motivo, impacto y decisión. No usar esta sección para describir trabajo rutinario.

| Fecha y hora                  | Cambio                                                                                                            | Motivo                                                                                                                                                          | Impacto                                                                                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-02 12:49:31 UTC-04:00 | La lista de dependencias autorizadas para ejecutar scripts se trasladó de `package.json` a `pnpm-workspace.yaml`. | pnpm 11.19 informó que esa configuración ya no se lee desde `package.json`.                                                                                     | No cambia el alcance; mantiene bloqueados los scripts de instalación en la ubicación vigente.                                              |
| 2026-09-02 12:53:59 UTC-04:00 | El puerto web local cambió de `3000` a `3200`.                                                                    | Los puertos `3000` y `3002` están ocupados por procesos existentes relacionados con el entorno del ERP.                                                         | Hansa Field evita interferencia local; la API permanece en `3100` y PostgreSQL en `5434`.                                                  |
| 2026-09-02 12:58:15 UTC-04:00 | La inyección del `HealthService` pasó a declarar explícitamente su token.                                         | El ejecutor de desarrollo `tsx` no emite la misma metadata implícita de decoradores que la compilación TypeScript, aunque las pruebas y el build habían pasado. | El controlador funciona de forma consistente en desarrollo y producción; se añadió prueba modular y se mantiene la comprobación HTTP real. |
| 2026-09-02 13:02:43 UTC-04:00 | La imagen de base cambió de `postgis/postgis:17-3.6` a `postgis/postgis:17-3.6-alpine`.                           | El registro oficial no publica la primera etiqueta; sí publica la variante Alpine para PostgreSQL 17 y PostGIS 3.6.4.                                           | Se mantiene la versión funcional prevista con una etiqueta existente y verificable.                                                        |

## Percances durante la implementación

Esta sección se completará únicamente si ocurre un problema real que afecte el plan, el resultado, el tiempo o una decisión técnica. Si no ocurre ningún percance, se eliminará al cerrar la entrega según la instrucción del usuario.

| Fecha y hora                  | Percance                                                          | Diagnóstico                                                                                                                                                           | Resolución o estado                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 12:45:41 UTC-04:00 | Git rechazó el primer commit documental.                          | La PC no tenía `user.name` ni `user.email` configurados. Los archivos ya estaban preparados, pero no se creó ningún commit.                                           | Se configurará una identidad técnica únicamente en este repositorio, sin alterar la configuración global ni publicar contenido.               |
| 2026-09-02 12:53:59 UTC-04:00 | Next.js no pudo iniciar en el puerto `3000`.                      | El puerto ya estaba ocupado por el entorno local existente; también se confirmó `3002` en uso.                                                                        | No se detuvo ningún proceso externo. Se trasladó la web de Hansa Field a `3200` y se actualizaron configuración y documentación.              |
| 2026-09-02 12:58:15 UTC-04:00 | El health check devolvió HTTP 500 durante la primera prueba real. | `HealthController` recibía `undefined` en desarrollo por diferencia de metadata de decoradores entre `tsx` y `tsc`. La prueba unitaria aislada no cruzaba ese límite. | Se reprodujo mediante HTTP, se declaró `@Inject(HealthService)`, se añadió una prueba modular y se exigirá prueba HTTP además de la unitaria. |
| 2026-09-02 13:02:43 UTC-04:00 | Docker no pudo resolver `postgis/postgis:17-3.6`.                 | La etiqueta no existe en Docker Hub; el intento terminó antes de crear el contenedor o volumen.                                                                       | Se verificaron Docker Hub y el repositorio oficial y se adoptó `17-3.6-alpine` (PostGIS 3.6.4).                                               |
| 2026-09-02 13:07:46 UTC-04:00 | La primera conexión de la prueba de migración fue rechazada.      | El valor de desarrollo escrito inicialmente en el test no coincidía con la contraseña local declarada en Compose; no se llegó a crear el esquema temporal.            | Se unificó la URL local y la limpieza del test ahora comprueba que el esquema haya sido creado antes de intentar eliminarlo.                  |

## Avances verificados

| Fecha y hora                  | Incremento                                                                                     | Evidencia                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 12:50 UTC-04:00    | Workspace independiente, dependencias fijadas y servicio PostGIS definido en Compose.          | Instalación congelada reproducible, scripts de dependencias bloqueados, `docker compose config` válido, formato y lint limpios.                                      |
| 2026-09-02 13:01:42 UTC-04:00 | Primera shell web/API: portada, área de Apps bloqueada hasta persistencia y health check real. | 4 pruebas pasan; tipos, lint y builds pasan; `GET /api/health/live` responde correctamente; portada y `/apps` verificadas en navegador sin errores de consola.       |
| 2026-09-02 13:05:21 UTC-04:00 | Servicio geoespacial local disponible y aislado del ERP.                                       | El contenedor está saludable en `5434`; PostgreSQL 17 confirmó PostGIS 3.6.4, GEOS 3.14.1 y PROJ 9.8.1 mediante consulta SQL real.                                   |
| 2026-09-02 13:08:49 UTC-04:00 | Persistencia geoespacial fundacional y migración versionada.                                   | Integración real crea y revierte un esquema aislado; valida UUID, Point/LineString/Polygon, SRID 4326 e índices GiST/GIN; la migración se aplicó luego a desarrollo. |

## Cierre de la entrega

Pendiente. Al finalizar se registrarán fecha/hora, pruebas ejecutadas, resultado demostrado, cambios respecto del plan y percances reales si existieron.
