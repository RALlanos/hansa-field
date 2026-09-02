---
name: hansa-gis-postgis
description: Design, implement or review PostGIS and map behavior for Hansa Field, including CRS, spatial queries, geometry validation and scale.
---

# Hansa GIS/PostGIS

Use for geometry, map, spatial query, import CRS or GIS performance work.

- PostGIS is authoritative. Geometry has explicit type and SRID; never serialize arbitrary coordinate strings as the canonical value.
- Support the GeoJSON family deliberately: Point/MultiPoint, LineString/MultiLineString, Polygon/MultiPolygon. Reject unsupported geometry explicitly.
- Before a viewport feature, define CRS, bbox query (`ST_Intersects`/`ST_Within` as appropriate), GiST index and payload limit.
- At scale, use clustering, simplification or vector tiles; never DOM-render or ship the whole data universe.
- Validate geometry validity, empty geometry behavior and coordinate order in integration tests against real PostGIS.
