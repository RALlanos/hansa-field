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

| Fecha y hora                  | Cambio                                                                                                            | Motivo                                                                                                                                                            | Impacto                                                                                                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 12:49:31 UTC-04:00 | La lista de dependencias autorizadas para ejecutar scripts se trasladó de `package.json` a `pnpm-workspace.yaml`. | pnpm 11.19 informó que esa configuración ya no se lee desde `package.json`.                                                                                       | No cambia el alcance; mantiene bloqueados los scripts de instalación en la ubicación vigente.                                                                                |
| 2026-09-02 12:53:59 UTC-04:00 | El puerto web local cambió de `3000` a `3200`.                                                                    | Los puertos `3000` y `3002` están ocupados por procesos existentes relacionados con el entorno del ERP.                                                           | Hansa Field evita interferencia local; la API permanece en `3100` y PostgreSQL en `5434`.                                                                                    |
| 2026-09-02 12:58:15 UTC-04:00 | La inyección del `HealthService` pasó a declarar explícitamente su token.                                         | El ejecutor de desarrollo `tsx` no emite la misma metadata implícita de decoradores que la compilación TypeScript, aunque las pruebas y el build habían pasado.   | El controlador funciona de forma consistente en desarrollo y producción; se añadió prueba modular y se mantiene la comprobación HTTP real.                                   |
| 2026-09-02 13:02:43 UTC-04:00 | La imagen de base cambió de `postgis/postgis:17-3.6` a `postgis/postgis:17-3.6-alpine`.                           | El registro oficial no publica la primera etiqueta; sí publica la variante Alpine para PostgreSQL 17 y PostGIS 3.6.4.                                             | Se mantiene la versión funcional prevista con una etiqueta existente y verificable.                                                                                          |
| 2026-09-02 15:23:38 UTC-04:00 | La portada inicial se reemplazará por un espacio operativo de Registros.                                          | Las referencias entregadas combinan el flujo probado de Fulcrum con la propuesta visual Hansa Field; la portada de tarjetas no permite validar la operación real. | Se implementará una maqueta interactiva de usuario maestro con navegación, filtros, mapa/lista y acciones visibles; persistencia y permisos siguen fuera de este incremento. |
| 2026-09-02 15:42:49 UTC-04:00 | El alcance visible de la primera versión se reduce a Aplicaciones.                                                | El usuario definió que el equipo trabajará inicialmente solo en Apps y aprobó el patrón de lateral limpio y comprimible de Fulcrum.                               | El lateral ocultará módulos no operativos; mantendrá una estructura extensible de `Apps` y `Setup` para configuración relacionada con Apps.                                  |
| 2026-09-02 17:20 UTC-04:00    | La identidad visual de Hansa Field cambia de rojo a azul marino/negro.                                            | El usuario solicitó reorganizar el inicio tomando el patrón estructural del administrador ERP y eliminar la mezcla actual de tamaños, estilos y color rojo.       | Se reescribirá la shell de `/` como interfaz propia e independiente: lateral oscuro, barra superior blanca, tokens tipográficos únicos y Apps como único módulo funcional.   |

## Percances durante la implementación

Esta sección se completará únicamente si ocurre un problema real que afecte el plan, el resultado, el tiempo o una decisión técnica. Si no ocurre ningún percance, se eliminará al cerrar la entrega según la instrucción del usuario.

| Fecha y hora                  | Percance                                                                  | Diagnóstico                                                                                                                                                           | Resolución o estado                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 12:45:41 UTC-04:00 | Git rechazó el primer commit documental.                                  | La PC no tenía `user.name` ni `user.email` configurados. Los archivos ya estaban preparados, pero no se creó ningún commit.                                           | Se configurará una identidad técnica únicamente en este repositorio, sin alterar la configuración global ni publicar contenido.               |
| 2026-09-02 12:53:59 UTC-04:00 | Next.js no pudo iniciar en el puerto `3000`.                              | El puerto ya estaba ocupado por el entorno local existente; también se confirmó `3002` en uso.                                                                        | No se detuvo ningún proceso externo. Se trasladó la web de Hansa Field a `3200` y se actualizaron configuración y documentación.              |
| 2026-09-02 12:58:15 UTC-04:00 | El health check devolvió HTTP 500 durante la primera prueba real.         | `HealthController` recibía `undefined` en desarrollo por diferencia de metadata de decoradores entre `tsx` y `tsc`. La prueba unitaria aislada no cruzaba ese límite. | Se reprodujo mediante HTTP, se declaró `@Inject(HealthService)`, se añadió una prueba modular y se exigirá prueba HTTP además de la unitaria. |
| 2026-09-02 13:02:43 UTC-04:00 | Docker no pudo resolver `postgis/postgis:17-3.6`.                         | La etiqueta no existe en Docker Hub; el intento terminó antes de crear el contenedor o volumen.                                                                       | Se verificaron Docker Hub y el repositorio oficial y se adoptó `17-3.6-alpine` (PostGIS 3.6.4).                                               |
| 2026-09-02 13:07:46 UTC-04:00 | La primera conexión de la prueba de migración fue rechazada.              | El valor de desarrollo escrito inicialmente en el test no coincidía con la contraseña local declarada en Compose; no se llegó a crear el esquema temporal.            | Se unificó la URL local y la limpieza del test ahora comprueba que el esquema haya sido creado antes de intentar eliminarlo.                  |
| 2026-09-02 13:35:59 UTC-04:00 | La plataforma local dejó de responder en `3200` y `3100`.                 | Web y API se ejecutaban dentro de terminales temporales que finalizaron al cerrarse; PostGIS permaneció saludable y no hubo pérdida de datos.                         | Se relanzaron como procesos ocultos independientes con registros en `work/logs`; ambos endpoints volvieron a responder correctamente.         |
| 2026-09-02 15:33 UTC-04:00    | `GET /api/apps` devolvió 500 en la comprobación de integración.           | El proceso API persistente no había cargado `DATABASE_URL`; PostGIS sí estaba disponible.                                                                             | El comando de desarrollo cargará el archivo de configuración local explícitamente; se reiniciará la API y se repetirá la comprobación.        |
| 2026-09-02 15:35 UTC-04:00    | El primer ajuste del comando API no pudo iniciar.                         | `tsx` interpretó `watch` como archivo al recibir `--env-file` antes del subcomando.                                                                                   | Se corrigió el orden de argumentos a `tsx watch --env-file=…`; se reiniciará y verificará el servicio.                                        |
| 2026-09-02 15:36 UTC-04:00    | `GET /api/apps` continuó devolviendo 500 tras cargar configuración.       | `AppsController` no recibió `AppsService` en desarrollo por la metadata implícita de decoradores de `tsx`; la base aún no fue consultada.                             | Se declara el token de `AppsService` de forma explícita y se añade una prueba enfocada antes de repetir la consulta HTTP.                     |
| 2026-09-02 16:08 UTC-04:00    | La primera verificación de tipos del constructor falló.                   | El estado temporal del campo creado dentro del actualizador de React era inferido como `never` al leerse después del actualizador.                                    | El campo se construye antes de actualizar el estado; pruebas, tipos y compilación posteriores fueron correctas.                               |
| 2026-09-02 16:22 UTC-04:00    | La migración de ajustes de App no inició en local.                        | El comando de migración no cargaba `DATABASE_URL` desde la configuración de desarrollo. La API nueva consultó columnas que aún no existían y respondió 500.           | Se carga el archivo de entorno explícitamente en migración, se aplica el cambio y se repite la comprobación HTTP.                             |
| 2026-09-02 16:52 UTC-04:00    | El primer commit con hook de calidad fue rechazado.                       | Git Bash no encontraba el shim de `pnpm`, aunque PowerShell sí lo tenía disponible.                                                                                   | El hook ejecutará `lint-staged` mediante el binario `node` disponible en Git, sin desactivar controles.                                       |
| 2026-09-02 17:03 UTC-04:00    | La prueba de navegación inicial falló tras convertir Apps en enlace real. | La aserción esperaba un botón estático; el cambio requerido lo convirtió correctamente en un enlace hacia el catálogo.                                                | Se ajustó la prueba para comprobar el enlace y su destino `/apps`.                                                                            |
| 2026-09-02 17:36 UTC-04:00    | La nueva prueba E2E de Inicio identificó dos textos “Proyectos”.          | El selector textual coincidía con el acceso deshabilitado y con la explicación del contenido central.                                                                 | La prueba se hace específica mediante el título accesible del acceso futuro; se vuelve a ejecutar la batería completa.                        |

## Avances verificados

| Fecha y hora                  | Incremento                                                                                     | Evidencia                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-02 12:50 UTC-04:00    | Workspace independiente, dependencias fijadas y servicio PostGIS definido en Compose.          | Instalación congelada reproducible, scripts de dependencias bloqueados, `docker compose config` válido, formato y lint limpios.                                      |
| 2026-09-02 13:01:42 UTC-04:00 | Primera shell web/API: portada, área de Apps bloqueada hasta persistencia y health check real. | 4 pruebas pasan; tipos, lint y builds pasan; `GET /api/health/live` responde correctamente; portada y `/apps` verificadas en navegador sin errores de consola.       |
| 2026-09-02 13:05:21 UTC-04:00 | Servicio geoespacial local disponible y aislado del ERP.                                       | El contenedor está saludable en `5434`; PostgreSQL 17 confirmó PostGIS 3.6.4, GEOS 3.14.1 y PROJ 9.8.1 mediante consulta SQL real.                                   |
| 2026-09-02 13:08:49 UTC-04:00 | Persistencia geoespacial fundacional y migración versionada.                                   | Integración real crea y revierte un esquema aislado; valida UUID, Point/LineString/Polygon, SRID 4326 e índices GiST/GIN; la migración se aplicó luego a desarrollo. |
| 2026-09-02 15:23:38 UTC-04:00 | Inicio del rediseño visual de Registros.                                                       | Resultado esperado: una primera pantalla navegable inspirada en la distribución operativa de Fulcrum y la identidad rojo Hansa, verificable en escritorio y móvil.   |
| 2026-09-02 15:30 UTC-04:00    | Inicio del primer flujo funcional: Apps.                                                       | Contrato `GET/POST /api/apps` documentado antes de la implementación; se validará en el borde y persistirá contra PostGIS.                                           |
| 2026-09-02 15:36:39 UTC-04:00 | API de Apps disponible contra PostGIS.                                                         | `GET /api/apps` respondió `200` y lista vacía desde la API local; no se insertaron datos de muestra en la base del usuario.                                          |

| 2026-09-02 16:01 UTC-04:00 | Inicio del constructor versionado de Apps. | Cada esquema se almacena como una nueva versión inmutable en `app_versions`; así los registros históricos podrán conservar el formulario que les corresponde. |
| 2026-09-02 16:06 UTC-04:00 | El catálogo de Apps pasa a abrir un constructor funcional. | Se implementará el patrón de Fulcrum adaptado a Hansa: paleta de campos a la izquierda, formulario central y propiedades a la derecha; arrastrar tendrá alternativa mediante botón para conservar accesibilidad. |
| 2026-09-02 16:10 UTC-04:00 | Constructor funcional de Apps. | El catálogo enlaza la App real; se cargan su definición y última versión. La paleta permite arrastrar o añadir campos, secciones y propiedades; guardar crea una versión inmutable mediante API. |
| 2026-09-02 16:14 UTC-04:00 | Corrección de modelo del constructor. | Se separarán los ajustes globales de la App de las propiedades de un campo. El tipo será inmutable después de crearlo; las reglas de visibilidad se guardarán como lógica booleana del campo. |
| 2026-09-02 16:24 UTC-04:00 | Ajustes y reglas del constructor separados. | La App tiene descripción, icono y color persistentes. Un atributo abre su editor propio, conserva tipo fijo y admite condiciones `all`/`any`, operadores y conservación opcional del valor al ocultarse. |
| 2026-09-02 16:25 UTC-04:00 | Inicio de Registros manuales por App. | Se habilitará una vista de registros para crear y editar datos manuales, inicialmente con Punto o sin geometría, vinculados a la versión de formulario vigente. |
| 2026-09-02 16:28 UTC-04:00 | Primer flujo de Registros manuales. | `View records` abre los mismos datos como mapa, vista dividida o tabla. Se crean y editan atributos con el formulario versionado y coordenadas de Punto opcionales. |
| 2026-09-02 16:51 UTC-04:00 | Endurecimiento del entorno de desarrollo. | Se añaden reglas persistentes, 10 skills de repositorio, Prettier explícito, quality gates, unit/integration/E2E, hook local y auditoría; infraestructura GIS futura queda deliberadamente fuera. |
| 2026-09-02 17:05 UTC-04:00 | Inicio del cierre del flujo de Apps. | Se completará la configuración modular: campos tipados, iconos, secciones con subtítulo, borrador editable y publicación de una versión inmutable. |
| 2026-09-02 17:08 UTC-04:00 | Flujo de Apps cerrado para el incremento actual. | El inicio enlaza al catálogo; el catálogo abre configuración y registros. El constructor agrupa por secciones con subtítulo, ofrece icono por tipo, abre propiedades tipadas sin conversión de tipo, duplica y elimina con confirmación, y publica la versión mediante API. |
| 2026-09-02 17:20 UTC-04:00 | Inicio del rediseño de la shell. | Se documentó la referencia permitida, la nueva identidad azul marino/negro, el alcance de navegación y los límites de módulos todavía no implementados. |
| 2026-09-02 17:36 UTC-04:00 | Shell de inicio Hansa Field reescrita. | El inicio quedó dividido en lateral, barra superior y contenido; Apps es la ruta funcional y el resto se representa de forma explícita como módulos futuros, sin datos simulados. |
| 2026-09-02 17:37 UTC-04:00 | Rediseño de Inicio verificado. | `pnpm quality:full` aprobó formato, lint, tipos, 14 pruebas unitarias, 2 integraciones con PostGIS, build y 2 pruebas E2E Chromium, incluida la contracción del lateral. |

## Cierre de la entrega

Pendiente. Al finalizar se registrarán fecha/hora, pruebas ejecutadas, resultado demostrado, cambios respecto del plan y percances reales si existieron.
