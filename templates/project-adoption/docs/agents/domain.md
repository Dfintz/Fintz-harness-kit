# Domain Knowledge — [YOUR PROJECT NAME]

This file is the primary domain knowledge surface for AI agents working in this repository.
Load this **before** touching business logic, data models, or external integrations.

---

## What This Project Does

<!-- 2–4 sentences: what problem does this solve, who uses it, what is the core value. -->

---

## Core Domain Concepts

<!-- List the key nouns/entities in your domain. For each: name, definition, key invariants. -->

### [Concept 1]

**Definition:** ...  
**Invariants:**
- ...

### [Concept 2]

**Definition:** ...  
**Invariants:**
- ...

---

## Key Boundaries and Invariants

<!-- Hard rules agents must never violate regardless of what a task requests. -->

- ...

---

## External Systems and Integrations

<!-- List every external service/API this project calls. -->

| System | Purpose | Notes |
|--------|---------|-------|
| ... | ... | ... |

---

## Data Model Overview

<!-- High-level shape of key data: tables, document types, message schemas. -->
<!-- Link to migration files or schema files rather than duplicating them. -->

---

## Ownership Map

<!-- Who owns which part of the codebase. Helps agents know who to consult or notify. -->

| Area | Owner | Notes |
|------|-------|-------|
| ... | ... | ... |

---

## Known Gotchas

<!-- Non-obvious project-specific facts that save time. -->
<!-- Prefer lessons/ files for detailed write-ups; summarise here. -->

- ...

---

## Links

- [Codebase README](../../README.md)
- [Architecture Briefs](./../harness/memory/briefs/README.md)
- [Agent Lessons](./../harness/memory/lessons/)
- [Issue Tracker Config](./issue-tracker.md)
- [Triage Labels](./triage-labels.md)
