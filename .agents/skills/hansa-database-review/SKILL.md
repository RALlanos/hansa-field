---
name: hansa-database-review
description: Review Hansa Field schemas, migrations, SQL, JSONB, PostGIS indexes and integrity before database-affecting work is completed.
---

# Hansa database review

Use for migrations, data models, query changes or performance issues.

- Use UUID keys, parameterized SQL, versioned reversible migrations and explicit constraints. Do not reset or destroy local data.
- Rows are persistence details; map them to domain/API types rather than returning them blindly.
- Use JSONB for flexible App values, not an EAV table per field. Add dedicated columns/indexes only after a proven query need.
- Check foreign keys, uniqueness, nullability, update/delete semantics, GIN JSONB and GiST geometry indexes.
- Examine pagination, query cardinality and N+1 behavior. Spatial list endpoints must be designed around viewport/filters before scale claims.
- Test migrations and spatial constraints against real PostGIS, including rollback.
