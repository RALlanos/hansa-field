# ADR-0003: Stack TypeScript para web y API

## Estado

Aceptado

## Fecha

2026-09-02

## Contexto

El producto necesita una web responsiva, una API modular, tipos compartibles y ejecución reproducible en Node/Docker. El equipo requiere reducir cambios de lenguaje y mantener límites claros entre interfaz y dominio.

## Decisión

Usar Node.js 24 LTS, TypeScript, Next.js 16 con App Router para la web y NestJS 12 con ESM para la API. El workspace se administrará con pnpm y bloqueará scripts de instalación no aprobados. PostgreSQL 17 con PostGIS 3.6 se ejecutará en un servicio independiente.

## Fuentes verificadas

- Next.js 16 documenta Node 20.9 como mínimo, App Router y scripts separados de lint: https://nextjs.org/docs/app/getting-started/installation
- NestJS 12 recomienda un Node LTS actual, usa ESM en sus paquetes y genera proyectos ESM con Vitest: https://docs.nestjs.com/first-steps y https://docs.nestjs.com/migration-guide
- PostGIS documenta la imagen comunitaria Docker como instalación soportada: https://postgis.net/documentation/getting_started/install_docker/

## Alternativas consideradas

### Ampliar el stack del ERP directamente

Se conserva familiaridad conceptual, pero se rechaza reutilizar su repositorio o dependencias porque Hansa Field necesita ciclos y fallos independientes.

### Un único servidor Next.js como frontend y backend

Se rechaza para el núcleo de dominio porque las importaciones, trabajos geográficos y futura integración necesitan límites de módulo y procesos operativos más claros. Next.js queda como interfaz y NestJS como API.

## Consecuencias

- Web y API comparten TypeScript pero se compilan y despliegan separadamente.
- Las dependencias se fijan exactamente y existe un único lockfile.
- Los scripts de instalación están bloqueados por defecto y cualquier excepción deberá revisarse y documentarse.
