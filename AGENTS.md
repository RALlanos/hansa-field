# HANSA FIELD CODING RULES

## Producto y límites

Hansa Field es una plataforma GIS configurable, inspirada funcionalmente en Fulcrum e independiente del ERP. La futura integración será mediante APIs y contratos explícitos; nunca leyendo tablas ni usando la base del ERP.

La interfaz es una herramienta operativa compacta: mapa, tabla, filtros y formularios densos. Evita dashboards de ERP, tarjetas decorativas, gradientes y animaciones sin valor operativo.

## Arquitectura

- Monolito modular: Next.js/React en `apps/web`; NestJS en `apps/api`; PostgreSQL/PostGIS es autoridad geográfica.
- Futuras capacidades: Redis/BullMQ, MapLibre, GDAL, Ajv/JSON Schema y contrato S3-compatible. No instalarlas ni simularlas sin una tarea que las requiera.
- Un módulo publica contratos; no importa repositorios internos de otro módulo. Controllers traducen HTTP; services contienen reglas; persistencia queda aislada.
- Apps separan definición, versión inmutable, esquema/UI y registros. Los proyectos organizan referencias, no duplican la fuente maestra.

## Código y tipos

- Mantén TypeScript estricto. No uses `any`, `@ts-ignore` ni conversiones para silenciar errores.
- Contratos públicos usan tipos explícitos; DTO HTTP y filas persistentes no son la misma entidad. UUID internos; booleanos, números y fechas conservan su tipo.
- Funciones y componentes cohesionados. No agregues abstracciones genéricas sin un segundo uso real ni aumentes archivos grandes: extrae una unidad con responsabilidad clara.
- SQL parametrizado, migraciones reversibles y consultas PostGIS con índices. No EAV por campo ni tabla por App; usa `jsonb` para atributos dinámicos cuando corresponda.

## GIS, datos y seguridad

- Geometrías se guardan en PostGIS, con CRS/SRID explícito. No guardes coordenadas GIS como strings ni confundas simbología con geometría.
- Para mapas a escala: consultas por bbox, paginación, clustering/teselas y nunca descargar todos los registros al navegador.
- No guardes binarios grandes en PostgreSQL. Valida MIME, tamaño y nombres; archivos grandes serán jobs.
- No confíes en el frontend para autorización, no concatenes SQL, no guardes secretos ni ejecutes contenido importado.

## Flujo obligatorio

1. Lee este archivo y el skill aplicable; inspecciona el módulo y contrato existente.
2. Explica problema, alcance y plan pequeño. No reescribas por intuición.
3. Implementa un incremento vertical y verificable.
4. Ejecuta `pnpm quality`; además integración/E2E/build cuando se modifique DB, API o flujo UI crítico.
5. Revisa arquitectura, seguridad, bordes, UX, rendimiento y documentación antes de declarar terminado.

## Reglas de dominio

- Un cambio de formulario publicado genera versión nueva; no destruye versiones ni datos antiguos.
- Operación masiva: selección → cálculo → preview → confirmación → ejecución → reporte/auditoría.
- UUID conocido en importación actualiza candidato; UUID ausente es nuevo; UUID suministrado e inexistente es error.
- Eliminación y migraciones de datos requieren confirmación y nunca borran dependencias compartidas silenciosamente.

## Calidad

No declares una entrega terminada sin requisito comprobado, tipos, validación de límites, error/empty/loading states, pruebas pertinentes, lint, format check y documentación de contratos. Consulta `docs/development/CODEX_WORKFLOW.md`.
