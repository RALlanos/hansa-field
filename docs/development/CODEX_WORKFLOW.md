# Flujo de trabajo de Codex — Hansa Field

## Antes de desarrollar

1. Leer `AGENTS.md` y seleccionar una skill de `.agents/skills` aplicable.
2. Inspeccionar módulo, contratos, migraciones, pruebas y decisiones existentes.
3. Ejecutar el baseline pertinente; no asumir que las herramientas o la deuda documentada siguen vigentes.
4. Definir un incremento pequeño, incluyendo qué no se tocará.

## Durante

- Mantener el monolito modular y contratos explícitos entre módulos.
- Implementar pruebas de regresión para bugs y tests reales de PostGIS si se cambia GIS/DB.
- Validar límites HTTP; SQL parametrizado; no secretos, `any`, códigos importados ejecutables ni datos ficticios no autorizados.
- Para UI, cubrir carga, error, vacío, foco/teclado, textos largos y los modos de visualización afectados.
- Para GIS, confirmar CRS/SRID, validez, índice y estrategia de viewport antes de afirmar escalabilidad.

## Después

1. Ejecutar `pnpm quality`.
2. Ejecutar `pnpm test:integration`, `pnpm build` y `pnpm test:e2e` cuando cambien persistencia, contratos o flujo crítico.
3. Revisar el diff por duplicación, bordes, compatibilidad, seguridad, rendimiento y documentación.
4. Documentar contrato/decisión/incidente cuando cambie. Crear commits atómicos y no usar `git add .`.

## Comandos

| Comando                 | Propósito                               |
| ----------------------- | --------------------------------------- |
| `pnpm quality`          | Formato, lint, tipos y tests unitarios. |
| `pnpm test:integration` | Migraciones y PostGIS real.             |
| `pnpm test:e2e`         | Flujo Chromium de navegador.            |
| `pnpm quality:full`     | Gates completos más build.              |

Los tests E2E requieren que Chromium haya sido instalado con `pnpm exec playwright install chromium`.
