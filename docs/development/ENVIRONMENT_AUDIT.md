# Auditoría del entorno — 2026-09-02

## Estado observado antes de cambios

| Herramienta           | Existía | Versión/estado                          | Decisión                                                                                        |
| --------------------- | ------- | --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Node / pnpm           | Sí      | 24.19.0 / 11.19.0                       | Mantener.                                                                                       |
| TypeScript            | Sí      | 5.9.3, `strict` en ambas Apps           | Mantener; opciones extra se adoptarán por módulo.                                               |
| Prettier              | Sí      | 3.9.6, sin archivo explícito            | Configuración explícita compatible añadida.                                                     |
| Lint                  | Sí      | Oxlint 1.81.0                           | Se habilitan plugins React, Next, import, promise, Vitest y a11y; no se añade ESLint duplicado. |
| Vitest                | Sí      | 4.1.11                                  | Se separan comandos unitarios e integración PostGIS.                                            |
| PostgreSQL/PostGIS    | Sí      | PostgreSQL 17 / PostGIS 3.6.4 saludable | Mantener y probar en integración real.                                                          |
| Playwright            | No      | —                                       | Añadido para E2E Chromium.                                                                      |
| Husky / lint-staged   | No      | —                                       | Añadidos para formatter/lint en commits locales.                                                |
| Redis / BullMQ        | No      | —                                       | Diferido: no hay trabajos asíncronos implementados.                                             |
| MapLibre / Ajv / GDAL | No      | —                                       | Diferidos: no introducir dependencias sin flujo que las use.                                    |
| CI                    | No      | Sin remoto Git configurado              | No se asume proveedor; pendiente al definir remoto.                                             |

## Riesgos y deuda que no se modifica en esta preparación

- Rutas actuales del constructor y Registros concentran UI, estado y fetch; el siguiente cambio funcional debe extraer componentes/coordinadores cohesivos, no sumar más lógica allí.
- La visualización actual de registros no es aún MapLibre ni tiene consultas por viewport; no debe afirmarse que escala a todos los registros.
- Los tipos de campo todavía están duplicados entre cliente y API. Centralizarlos requiere un contrato compartido versionado y será un incremento propio para no alterar schemas existentes.
- Advertencias de Oxlint sobre mocks de Vitest y accesibilidad existentes quedan visibles; no se silencian durante esta tarea.

## Cambios seguros aplicados

- `AGENTS.md` raíz, skills de repo y workflow de Codex.
- Prettier explícito, quality gates, validación de skills y scripts separados para unidad/integración/E2E.
- Hook Husky con lint-staged.
- Smoke E2E del catálogo de Apps.
