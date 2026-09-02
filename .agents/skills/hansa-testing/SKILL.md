---
name: hansa-testing
description: Add or assess Hansa Field unit, integration and E2E tests with real PostGIS where behavior crosses the database boundary.
---

# Hansa testing

Use when changing behavior, fixing bugs or preparing a feature as complete.

- First create a failing focused regression test for a demonstrated bug; then make it pass.
- Unit tests verify domain/service behavior. Integration tests use real PostgreSQL/PostGIS for migrations, constraints and spatial SQL. E2E validates critical browser flows.
- Prefer state assertions over implementation call sequences. Mocks only isolate genuine external boundaries.
- UI tests cover loading, empty, error and user-visible outcomes. Do not add data fixtures to a user database merely to demonstrate a feature.
- Run `pnpm quality`; add integration/E2E/build as required by the changed risk boundary.
