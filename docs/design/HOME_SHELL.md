# Shell de inicio — Hansa Field

## Fecha y alcance

- Fecha: 2026-09-02
- Alcance: pantalla `/` y sistema visual compartido de Hansa Field.
- Referencia: estructura visual observada en `hansa-erp-version-final.zip`, únicamente como referencia de navegación administrativa. No se extrae, importa ni reutiliza código, datos ni contratos del ERP.

## Objetivo

Sustituir la primera pantalla experimental por una shell operativa consistente: lateral oscuro fijo, barra superior blanca, jerarquía tipográfica reducida y área central orientada a abrir Apps. Hansa Field se identifica con azul marino/negro y blanco; el rojo deja de ser color de marca.

## Límites funcionales

- **Apps** es el único módulo disponible y enlaza al catálogo real `/apps`.
- Los accesos a Importaciones, Exportaciones, Capas, Proyectos y Configuración son estructura futura; se muestran como no disponibles y no simulan acciones ni datos.
- La shell no integra ERP, autenticación ni permisos. El estado actual de usuario maestro sigue siendo una etiqueta local de demostración.
- No se declara un mapa real: MapLibre sigue fuera de este incremento.

## Decisiones de interfaz

1. Una familia tipográfica del sistema y cuatro escalas principales: 12, 14, 16 y 24 px.
2. Tokens únicos de color, borde, foco y espaciado en `styles.css`.
3. Componentes de presentación separados: barra lateral, barra superior y contenido de inicio.
4. Interacciones de lateral accesibles: botón con nombre, `aria-expanded` y comportamiento de teclado nativo.

## Verificación prevista

- Prueba unitaria de navegación a Apps y de la shell de usuario maestro.
- Formato, lint, TypeScript, pruebas unitarias, build y E2E del workspace.
