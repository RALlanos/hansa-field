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

| Componente | Versión detectada |
|---|---|
| Node.js | 24.19.0 |
| Corepack | 0.35.0 |
| pnpm | 11.19.0 |
| Docker | 29.7.2 |
| Docker Compose | 5.4.0 |

## Cambios de alcance o diseño durante la implementación

Registrar aquí únicamente cambios reales respecto del plan aprobado, incluyendo fecha, motivo, impacto y decisión. No usar esta sección para describir trabajo rutinario.

| Fecha y hora | Cambio | Motivo | Impacto |
|---|---|---|---|
| — | Ninguno al inicio | — | — |

## Percances durante la implementación

Esta sección se completará únicamente si ocurre un problema real que afecte el plan, el resultado, el tiempo o una decisión técnica. Si no ocurre ningún percance, se eliminará al cerrar la entrega según la instrucción del usuario.

| Fecha y hora | Percance | Diagnóstico | Resolución o estado |
|---|---|---|---|
| 2026-09-02 12:45:41 UTC-04:00 | Git rechazó el primer commit documental. | La PC no tenía `user.name` ni `user.email` configurados. Los archivos ya estaban preparados, pero no se creó ningún commit. | Se configurará una identidad técnica únicamente en este repositorio, sin alterar la configuración global ni publicar contenido. |

## Cierre de la entrega

Pendiente. Al finalizar se registrarán fecha/hora, pruebas ejecutadas, resultado demostrado, cambios respecto del plan y percances reales si existieron.
