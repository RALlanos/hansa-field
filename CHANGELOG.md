# Changelog

Todos los cambios relevantes para usuarios y operadores se documentarán aquí.

## [Unreleased]

### Added

- Documentación inicial del alcance, arquitectura y plan de implementación de Hansa Field.
- Workspace independiente con Next.js 16, NestJS 12, pnpm y Docker Compose.
- Portada web, área inicial de Apps y health check de disponibilidad de la API.
- PostgreSQL 17/PostGIS 3.6.4 con migraciones reversibles para Apps, versiones y registros geoespaciales con UUID.
- Espacio inicial de Registros con navegación de usuario maestro, filtros, capas, mapa visual y tabla de muestra bajo la identidad Hansa Field.
- API inicial de Apps para crear y listar definiciones geoespaciales con validación de entrada y código único.
- Constructor de Apps inspirado en el flujo de Fulcrum: paleta de campos, secciones, edición de propiedades y guardado de versiones inmutables.
- Constructor corregido: el tipo de atributo es fijo, las propiedades del campo se abren por separado y la App cuenta con icono, color y reglas booleanas de visibilidad.
- Vista de Registros por App con modos mapa, dividido y tabla; permite crear y editar registros manuales de Punto o sin ubicación.
