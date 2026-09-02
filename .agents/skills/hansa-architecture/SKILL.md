---
name: hansa-architecture
description: Review or design Hansa Field module boundaries, contracts, dependencies and monolith structure before changing cross-module behavior.
---

# Hansa architecture

Use for cross-module design, public API changes, or new domain modules. Read `AGENTS.md`, relevant decisions and the target module before proposing changes.

- Preserve the modular monolith: Nest module owns HTTP/service/persistence boundary; web consumes explicit API contracts.
- Reject internal repository imports across modules. Prefer a narrow interface, domain event or documented contract.
- Distinguish definition, version and instance: App definition/version/schema is not a Record or Project membership.
- Do not introduce microservices, queues or external storage without workload evidence and a reversible plan.
- Report dependency direction, contract change, migration impact and compatibility before implementation.
