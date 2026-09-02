# Hansa Field

Plataforma web para Apps de datos, registros geográficos e importaciones controladas de Hansa.

## Estado

La primera entrega vertical está en construcción. El alcance vigente está documentado en `SPEC-platform-foundation.md`; las tareas ejecutables están en `tasks/todo.md` y la bitácora cronológica en `docs/implementation/IMPLEMENTATION-LOG.md`.

## Requisitos

- Node.js 24.15 o superior
- pnpm 11.19
- Docker con Compose

## Inicio rápido

```powershell
Copy-Item .env.example .env
pnpm install --ignore-scripts
docker compose up -d database
pnpm dev
```

La web utilizará `http://localhost:3200`, la API `http://localhost:3100` y PostgreSQL el puerto local `5434`, evitando interferir con el ERP local.

## Comandos

| Comando                 | Propósito                                |
| ----------------------- | ---------------------------------------- |
| `pnpm dev`              | Ejecutar los paquetes en modo desarrollo |
| `pnpm test`             | Ejecutar pruebas                         |
| `pnpm typecheck`        | Verificar tipos                          |
| `pnpm lint`             | Analizar el workspace con oxlint         |
| `pnpm quality`          | Formato, lint, tipos y pruebas unitarias |
| `pnpm test:integration` | Validar migraciones contra PostGIS real  |
| `pnpm test:e2e`         | Ejecutar el smoke E2E en Chromium        |
| `pnpm quality:full`     | Ejecutar todos los gates más build y E2E |
| `pnpm build`            | Crear compilaciones de producción        |

La primera vez que se ejecuten las pruebas E2E, instala el navegador con
`pnpm exec playwright install chromium`.

## Arquitectura

El repositorio usa un monolito modular: `apps/web` contiene la interfaz Next.js y `apps/api` la API NestJS. PostgreSQL/PostGIS será la autoridad de datos. Las decisiones duraderas se registran en `docs/decisions`.

## Fuentes oficiales verificadas

- Next.js App Router e instalación: https://nextjs.org/docs/app/getting-started/installation
- NestJS 12, ESM y requisitos de Node: https://docs.nestjs.com/first-steps
- Migración y cambios de NestJS 12: https://docs.nestjs.com/migration-guide
- PostGIS con Docker: https://postgis.net/documentation/getting_started/install_docker/
