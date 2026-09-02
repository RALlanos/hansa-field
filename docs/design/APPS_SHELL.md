# Shell compartida de Apps

## Fecha y objetivo

2026-09-02. La navegación lateral debe permanecer disponible al navegar entre catálogo, constructor y registros de una App. No pertenece solo al Inicio.

## Alcance técnico

- `apps/web/src/app/apps/layout.tsx` encapsula las rutas `/apps`, `/apps/:appId` y `/apps/:appId/records`.
- La shell es de presentación y no importa datos de Apps, Records ni proyectos.
- El lateral tiene estado local de expansión y puede reabrirse desde cualquiera de esas rutas.
- Solo `Apps` enlaza una capacidad existente. Los demás módulos siguen identificados como futuros y no ejecutan rutas o acciones ficticias.

## Sistema visual

La paleta usa rojo Hansa: rojo profundo para navegación y acciones, blanco/gris claro para superficies y rojo claro para foco. Todos los botones y componentes existentes consumen los mismos tokens de marca para evitar paletas residuales.

## Referencias externas

- La estructura administrativa del ZIP ERP se usa solo como referencia de lateral persistente y barra superior.
- Fulcrum se consulta como referencia funcional con autorización explícita del usuario. Su inicio de sesión requiere introducir credenciales en un tercero; se solicitará confirmación inmediata antes de esa transmisión.
