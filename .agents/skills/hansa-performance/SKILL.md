---
name: hansa-performance
description: Assess Hansa Field performance for large GIS datasets, React rendering, API payloads, tables, caching and background work.
---

# Hansa performance

Use when a feature can process many records, files, geometries or render large tables/maps.

- Measure before optimizing. State the dataset size, request shape, query plan and UI bottleneck.
- Paginate tables and bound API payloads. Query the map viewport, cluster/simplify features and avoid thousands of DOM markers.
- Avoid N+1 queries and repeated schema fetches. Use indexes that match actual filters.
- Imports/exports/image transformations run as background jobs when the foreground request would be long or memory-heavy.
- Use memoization and cache only with a demonstrated rendering or request benefit; document invalidation/consistency.
