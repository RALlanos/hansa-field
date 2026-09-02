---
name: hansa-frontend-ui
description: Build or review compact, high-density Hansa Field operational UI for maps, tables, filters, App builder and record workflows.
---

# Hansa frontend UI

Use for user-facing Hansa Field changes. Favor Fulcrum-like operational density over dashboard presentation.

- Map, table and filter controls are working surfaces; preserve useful viewport area and compact hierarchy.
- Separate data fetching/state from presentational components. Do not extend an already-large route component without first identifying an extractable cohesive unit.
- Every flow needs loading, empty, error, disabled, focus and keyboard behavior. Test at desktop and narrow widths.
- Geometry/symbology are separate: an icon or color setting never alters coordinates.
- Do not claim a visual mock is a real map integration; label capability truthfully until MapLibre is implemented.
