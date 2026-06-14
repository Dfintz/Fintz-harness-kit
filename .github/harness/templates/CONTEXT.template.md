# CONTEXT.md — Project Shared Language

> Template from the harness-kit `grill` skill. Copy to your project root as `CONTEXT.md` and fill it
> in as terminology gets pinned down during grilling sessions. A shared, ubiquitous language keeps
> the agent naming things consistently, makes the codebase easier to navigate, and cuts tokens spent
> re-explaining jargon. Keep entries short; update them when meaning drifts.

## Domain glossary

Define every project-specific or ambiguous term. One line each: the term, then what it means **in
this project** (which may differ from its general meaning).

| Term | Meaning in this project |
| ---- | ----------------------- |
| _e.g. Tenant_ | _An organization; the unit of data isolation. Not an individual user._ |
| _e.g. Activity_ | _A scheduled, joinable event with a roster and lifecycle. Not a generic log entry._ |

## Naming conventions

- Names derived from the glossary above — variables, functions, files, and types use the shared
  terms verbatim (e.g. `organizationId`, never a synonym like `tenantId`, unless the glossary says so).
- _Add project-specific casing / prefix / suffix rules here._

## Boundaries & invariants

Short, factual statements the agent must not violate (the kind of thing that's "obvious" to the team
but invisible to a fresh agent).

- _e.g. All data access is scoped by `organizationId`; a query without it is a tenant-isolation bug._
- _e.g. New API routes live under `/api/v2/`; `/api/v1/` is deprecated and never extended._

## Pointers

- Architecture decisions: `docs/adr/` (the _why_ behind non-obvious choices).
- _Add links to the authoritative docs an agent should read before non-trivial work._
