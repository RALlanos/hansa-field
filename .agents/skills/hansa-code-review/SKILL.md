---
name: hansa-code-review
description: Perform the final Hansa Field review for correctness, architecture, types, tests, security, GIS scale and operational UX.
---

# Hansa code review

Use before declaring a significant Hansa Field implementation complete.

Review three passes:

1. **Implementer:** requirement and public contract are actually fulfilled.
2. **Reviewer:** module boundary, type safety, duplication, migrations, backward compatibility, security and performance risks.
3. **Tester:** errors, empty states, malformed input, API failures, large data and regression tests.

Reject completion if it relies on `any`, silent catches, fake data, frontend-only security, unbounded dataset retrieval, untested migration, or undocumented contract change. Report remaining limitations honestly with the next safe increment.
