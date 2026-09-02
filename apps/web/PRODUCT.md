# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Operadores de campo, supervisores y administradores que preparan formularios
configurables y consultan información geográfica desde una herramienta web de
operaciones.

## Product Purpose

Hansa Field permite definir Apps de captura, publicar sus formularios
versionados y gestionar registros maestros asociados con geometrías.

## Positioning

Una plataforma GIS independiente del ERP: sus Apps versionan la definición de
formularios sin reescribir los registros históricos y sus proyectos organizan
referencias, no copias de los datos maestros.

## Operating Context

El trabajo inicia en Aplicaciones. Una persona crea o configura una App,
compone formularios con campos tipados, publica una versión y administra sus
registros como punto, línea, polígono o sin geometría, según la App.

## Capabilities and Constraints

- Aplicaciones es el único módulo disponible en esta etapa.
- Importaciones, exportaciones, capas, proyectos y configuración son módulos
  futuros independientes; no deben presentar acciones ni datos simulados.
- El producto es un monolito modular con Next.js/React, NestJS y PostGIS.
- Hansa Field no lee tablas del ERP ni comparte su base de datos.
- Los cambios de formularios publicados generan versiones inmutables.

## Brand Commitments

El producto se denomina Hansa Field. Su interfaz es una herramienta operativa
compacta, inspirada funcionalmente en Fulcrum y estructurada con claridad
administrativa. La identidad solicitada usa rojo Hansa, blanco y grises
neutros; no debe copiar código, datos ni identidad del ERP o de Fulcrum.

## Evidence on Hand

- Flujos de Apps, constructor y registros implementados en `apps/web/src/app/apps`.
- Referencias visuales y funcionales de Fulcrum aportadas por el usuario,
  revisadas en modo lectura; no son material reutilizable.
- No hay imágenes, métricas, testimonios ni datos de producción autorizados
  para la portada.

## Product Principles

1. Hacer visible la siguiente acción operativa sin simular capacidades futuras.
2. Mantener una navegación estable y compacta mientras crecen los módulos.
3. Separar definición de App, versiones y registros históricos.
4. Favorecer control, densidad y legibilidad sobre decoración.

## Accessibility & Inclusion

La navegación y las acciones principales deben conservar etiquetas accesibles,
foco visible, contraste suficiente, comportamiento por teclado y estructura
legible en escritorio y pantalla estrecha.
