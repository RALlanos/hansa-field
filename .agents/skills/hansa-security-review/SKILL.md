---
name: hansa-security-review
description: Review Hansa Field authentication boundaries, validation, uploads, SQL, secrets and browser/API security before sensitive changes ship.
---

# Hansa security review

Use for authentication, authorization, uploads, imports, external APIs or persistent user input.

- Validate untrusted input at HTTP/file boundaries with bounded sizes and structured errors. Frontend visibility is never authorization.
- Parameterize SQL; never interpolate identifiers or values from requests. Do not store credentials, tokens or files in the repository.
- File handling needs MIME/content checks, sanitized names, controlled storage paths and no execution of imported content.
- Future permission checks must compose by action/App/Project/field and run server-side.
- Add rate limits, audit trails and object-storage authorization when those features are introduced; do not pretend they exist today.
