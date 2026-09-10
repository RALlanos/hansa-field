# Estado de implementación piloto

Decisiones vigentes: 2026-09-08. B1 Dataset neutral confirmado; RecordGroup opcional confirmado. Reset de desarrollo autorizado, no ejecutado todavía. No habrá backfill, dual-write ni Apps ficticias.

| Bloque             | Estado      | Evidencia                                     |
| ------------------ | ----------- | --------------------------------------------- |
| Fundación          | IN PROGRESS | Preparación de contratos y baseline           |
| Writers            | IN PROGRESS | Regresiones de PATCH y reimportación en curso |
| UI operativa       | PENDING     | Sin migrar a Dataset                          |
| Territorios        | PENDING     | Sin implementar                               |
| Mapa Universal     | PENDING     | Sin implementar                               |
| Equivalencia       | PENDING     | Sin implementar                               |
| Consolidación      | PENDING     | Sin implementar                               |
| Benchmark y piloto | PENDING     | Sin ejecutar 100K/1M                          |

## Validación y migraciones

No declarar bloque DONE hasta pasar tests, typechecks, builds y flujo real. Pruebas DB en schemas aislados; no limpiar datos operativos antes de disponer de cadena coherente. El reset está autorizado y se ejecutará al integrar el baseline.

## Pendientes

Los 30 criterios manuales del pedido permanecen pendientes de validación contra nueva arquitectura. Estado global: NO LISTO. Las capacidades del código anterior no cuentan como implementación Dataset.
