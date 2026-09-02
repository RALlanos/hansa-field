---
name: hansa-app-builder
description: Evolve Hansa Field App definitions, typed field contracts, conditional visibility, UI schema and immutable schema versions.
---

# Hansa App Builder

Use for configurable Apps, fields, forms, versions and record validation.

- An App has a stable identity; a published schema version is immutable. Editing creates a new version without rewriting historical Records.
- A field type is immutable after creation. Configure label, description, required, defaults, bounds, read-only, options and visibility without silently changing its semantic type.
- Keep field types centralized and typed. Do not represent every type as free text; distinguish integer/decimal, boolean, date/time/datetime, choices, media, links and geometry.
- Conditional visibility is boolean logic over stable field IDs. Explicitly define all/any, operators and hidden-value retention.
- Define JSON Schema/UI Schema and Ajv only when the builder needs runtime schema validation; keep API validation at the boundary too.
