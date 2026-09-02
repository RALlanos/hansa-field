---
name: hansa-import-engine
description: Design or review Hansa Field imports, attribute routing, CRS normalization, UUID idempotency, previews and asynchronous job safety.
---

# Hansa import engine

Use for CSV/XLSX/SHP/ZIP/KML/KMZ/GeoJSON or CAD-normalization work.

Follow the explicit pipeline: upload → inspect → detect format/CRS → normalize → route → map fields → validate → preview → explicit confirmation → persist → report.

- Large files are resumable background jobs with progress, cancellation and stable state transitions; do not block HTTP/browser.
- Known UUID means update candidate; missing UUID means new candidate; supplied unknown UUID is an error, never an automatic new record.
- Never overwrite data before preview. Return valid/invalid counts, conflicts, mappings and recoverable actions.
- CAD is normalized through GIS: blocks become points with attributes/provenance; layer/color/handle remain provenance, not proprietary geometry.
- Treat archives and source files as hostile: size, MIME, path traversal, zip bombs and malformed CRS require validation.
