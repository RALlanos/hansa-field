# Shell de inicio — Hansa Field

## Fecha y alcance

- Fecha: 2026-09-02
- Alcance: pantalla `/` y sistema visual compartido de Hansa Field.
- Referencia: estructura visual observada en `hansa-erp-version-final.zip`, únicamente como referencia de navegación administrativa. No se extrae, importa ni reutiliza código, datos ni contratos del ERP.

## Objetivo

Sustituir la primera pantalla experimental por una shell operativa consistente: lateral fijo, barra superior blanca, jerarquía tipográfica reducida y área central orientada a abrir Apps. Hansa Field se identifica con rojo profundo, blanco y grises neutros.

## Límites funcionales

- **Apps** es el único módulo disponible y enlaza al catálogo real `/apps`.
- Los accesos a Importaciones, Exportaciones, Capas, Proyectos y Configuración son estructura futura; se muestran como no disponibles y no simulan acciones ni datos.
- La shell no integra ERP, autenticación ni permisos. El estado actual de usuario maestro sigue siendo una etiqueta local de demostración.
- No se declara un mapa real: MapLibre sigue fuera de este incremento.

## Decisiones de interfaz

1. La portada opera como una puerta de entrada al flujo disponible: Aplicaciones. No replica las opciones futuras en tarjetas ni presenta datos sintéticos.
2. Una familia tipográfica del sistema y escalas compactas para etiquetas, controles, títulos y texto operativo.
3. El rojo Hansa se reserva para identidad, selección y acciones principales; las superficies permanecen blancas o grises neutras.
4. Los iconos de Inicio son SVG propios, consistentes y accesibles; no se usan glifos Unicode como sistema de iconos.
5. Componentes de presentación separados: barra lateral, barra superior, iconos y contenido de inicio.
6. Interacciones de lateral accesibles: botón con nombre, `aria-expanded`, foco visible y comportamiento de teclado nativo.

## Verificación prevista

- Prueba unitaria de navegación a Apps y de la shell de usuario maestro.
- Formato, lint, TypeScript, pruebas unitarias, build y E2E del workspace.
