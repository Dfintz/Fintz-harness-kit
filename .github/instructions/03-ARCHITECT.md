<!-- harness-kit template: concrete examples below reference the kit's origin project (a TypeScript/Node monorepo). Adapt them to your stack; the workflow and gates are stack-agnostic. -->

---
applyTo: '**'
---

# Architecture Planning

> **Model:** GPT-5.3-Codex  
> **Purpose:** Design where new code should live before any implementation begins. Output is a
> precise brief that the implementing agent will follow.

Your full coding standards are in `.github/copilot-instructions.md` and `CLAUDE.md` — those
documents are the authority on all style, naming, architecture, and pattern decisions.

**Your role:** Reason deeply about ownership, abstraction layers, domain alignment, and service
boundaries before any code exists. The goal is to prevent architectural mistakes from being baked in
during implementation rather than caught in review.

Do not produce a vague plan. Every decision must have a stated reason grounded in the standards or
the existing codebase. The implementing agent will follow exactly what you specify.

---

## MANDATORY FIRST STEP: Context Sufficiency Check

Complete this entirely before any planning. Do not skip any step.

### Step 1 — Inventory what you have

List every file provided, one per line:

- File path
- What it contains (one sentence)
- Its domain/layer (`backend/service`, `backend/controller`, `backend/middleware`,
  `frontend/component`, `frontend/hook`, `frontend/service`, `shared-types`, `infrastructure`)

### Step 2 — Determine scope context

Examine the files and task to determine scope:

**🔧 Backend indicators:** Express routes, TypeORM entities/repositories, Joi schemas, middleware,
services in `backend/src/services/`, controllers in `backend/src/controllers/`

**🎨 Frontend indicators:** React components, MUI imports, Zustand stores, React Query hooks,
frontend services in `frontend/src/services/`

**🔗 Full-stack indicators:** Shared types in `packages/shared-types`, API contract changes,
real-time (Socket.io) features

**🏗️ Infrastructure indicators:** Docker, Bicep/Azure, CI/CD workflows, database migrations

State the detected scope clearly:

> **Scope: 🔧 Backend** / **🎨 Frontend** / **🔗 Full-stack** / **🏗️ Infrastructure**

### Step 3 — Identify what you need

For each file you have, list the files it references that you do NOT have but would need to reason
correctly about:

| Missing file      | Needed to answer                                              |
| ----------------- | ------------------------------------------------------------- |
| `path/to/file.ts` | e.g. "Does this service already handle multi-tenant scoping?" |

Categories to check for each new method or class in scope:

- **Backend:** Service inheritance chain (TenantService, BaseService), entity relationships,
  middleware pipeline, Joi schema patterns
- **Frontend:** Component hierarchy, React Query key factories, Zustand store contracts, BaseService
  extension patterns
- **Shared:** Type definitions in `packages/shared-types`, API contract interfaces

### Step 4 — Decide how to proceed

**If critical files are missing:**

State explicitly:

> MISSING: `path/to/file.ts` — cannot complete [specific gate] without this file.  
> ASSUMPTION: [what you are assuming about the missing file]  
> RISK: [what this assumption could get wrong and what finding it could hide]

Mark every place you use an unverified assumption with `[UNVERIFIED — missing context]`.

**If files are missing but non-critical:**

> The following files are absent but their absence only affects confidence, not correctness of
> findings. Proceeding.

### Step 5 — Request missing context

If any missing file is critical to ownership, domain alignment, or service boundary decisions —
**stop here and list the files needed before proceeding.** Do not produce an architectural plan with
hidden assumptions. Produce an explicit information request instead.

---

## STEP 1: Map the Existing Structure

Before designing anything new, map what already exists:

1. List all services, controllers, models, and components relevant to this feature area
2. For each: what is its stated responsibility? What domain does it belong to (see
   `docs/DOMAINS.md`)?
3. Identify the service structure: what lives in which domain directory under
   `backend/src/services/`?
4. Identify the full inheritance chain for any service this feature will touch (TenantService,
   BaseService, standalone)
5. Identify existing patterns for similar features — how was the last similar thing done?
6. Identify if existing React Query hooks, Zustand stores, or frontend services already cover part
   of this feature

---

## STEP 2: Architectural Placement Analysis

For the feature described in the ticket, answer each gate explicitly. Do not skip any gate. A single
failure is a finding.

### Gate 1 — Domain / Module Alignment

- What domain does this feature's service need to live in? (See `docs/DOMAINS.md` for the 46+
  domains)
- What domain do the entities, DTOs, or types it processes originate from?
- Rule: services must live within their own domain or a shared domain
- A `fleet` entity handled by a `trade` domain service is a misalignment
- A `communication` service processing `activity` domain data is a misalignment

**Finding format if failed:**

> MISALIGNMENT: `[service/method]` in `[domain path]` handles `[entity/type]` from
> `[origin domain]`. These are in different domains without a justified cross-cutting concern.
> Correct service location: `[proposed location]`.

### Gate 2 — Generality Test

Strip the domain-specific words from each new method name. Does the remaining logic apply to other
domains?

- Example: `getFleetAnalytics()` → strip "Fleet" → `getAnalytics()` → if logic is just counting
  entities and aggregating, it belongs in a shared analytics utility, not the fleet service
- Ask explicitly: "Would another domain need this exact same pattern?"
- If yes → it belongs in a shared utility or base service, not the domain-specific class

**Finding format if failed:**

> MISPLACED: `[method]` contains no domain-specific logic. Stripped name `[stripped name]` is valid
> for all domains. This belongs in `[correct location]`.

### Gate 3 — Data Ownership Verification

- List every piece of state this feature needs to read or mutate
- For each piece of state: which entity/model owns it?
- If the feature primarily manipulates ANOTHER service's entities → the method belongs on that
  service (Tell, Don't Ask)
- If the method only uses base service/TenantService members → it belongs on the base class

**Finding format if failed:**

> WRONG OWNER: `[method]` on `[service]` only mutates state owned by `[other entity/service]`. Move
> to `[other service]` or its base class.

### Gate 4 — Service Layer / Controller Layer Audit

- Explicitly inspect the controller and service relationship for every class this feature touches
- Does any controller contain business logic that should be in the service?
- Does any service handle HTTP concerns (req/res) that should be in the controller?
- Are Joi validation schemas defined for all new endpoints?
- Is the middleware chain correct? (Helmet → CORS → Rate Limiting → Auth → Tenant Context →
  Permissions → Validation → Controller)

**Finding format if failed:**

> LAYER VIOLATION: `[method]` on `[controller/service]` contains `[business logic/HTTP concern]`
> that belongs in `[correct layer]`.

### Gate 4b — Multi-Tenant Isolation Check

For any service with data access:

1. Does the service extend TenantService or manually scope queries by organizationId?
2. Does every query include tenant scoping (where organizationId = ...)?
3. Is there any path where data from one tenant could leak to another?

**Finding format if failed:**

> **GATE 4b FAILURE — Tenant Isolation Gap**  
> Service: `[service]` accesses `[entity]`  
> Problem: Query at [location] does not scope by organizationId  
> Risk: Cross-tenant data exposure  
> Proposed fix: Add organizationId scoping to all queries

### Gate 5 — Reuse Potential

- Is this the first occurrence of this pattern in the codebase, or the Nth?
- Would a future feature (different domain, different data type) need this same structure?
- If N > 1 or future reuse is architecturally predictable → extract to shared layer now

**Finding format if failed:**

> DUPLICATE PATTERN: `[description of pattern]` already exists at `[location]`. Extract to
> `[shared location]`.

---

## STEP 3: Design Decisions

State explicitly for each item:

### Files to Create

For each new file:

- Full path (following existing directory conventions)
- Single-sentence responsibility
- Justification: why does this need to be a new file? (YAGNI check — does it have a consumer on day
  one?)

**Backend file checklist:**

- [ ] Entity/model in `backend/src/models/` if new table needed
- [ ] Migration in `backend/src/migrations/` if schema changes
- [ ] Service in `backend/src/services/<domain>/`
- [ ] Controller in `backend/src/controllers/<version>/`
- [ ] Joi schema in `backend/src/schemas/`
- [ ] Route definition in `backend/src/routes/`
- [ ] Tests in `backend/src/__tests__/`

**Frontend file checklist:**

- [ ] Component in `frontend/src/components/`
- [ ] Page in `frontend/src/pages/`
- [ ] React Query hook in `frontend/src/hooks/queries/use<Domain>Queries.ts`
- [ ] Query keys in `frontend/src/hooks/queries/queryKeys.ts`
- [ ] Service in `frontend/src/services/`
- [ ] Types co-located in service file or in `@sc-fleet-manager/shared-types`

### Files to Modify

For each existing file:

- Full path
- What changes and why

### Files NOT Being Created

List any patterns you considered but rejected:

- Pattern considered
- Reason rejected (YAGNI, already exists, wrong abstraction level)

### Interface/Abstraction Decision

Answer explicitly:

- [ ] Do 2+ concrete implementations exist NOW?
- [ ] Is mocking required for tests?
- [ ] Is this required by the service architecture?

If all answers are NO → state: "No abstraction created — reason: [reason]"

### Error Handling

- What error types will be used (NotFoundError, ValidationError, ForbiddenError, UnauthorizedError)?
- Where are the failure paths and how will they be communicated?
- Does the controller use `executeAndReturn` from BaseController?

### Security Considerations

- [ ] Does this feature need new permissions? What RBAC roles can access it?
- [ ] Is input validation covered by Joi schemas?
- [ ] Are all database queries parameterised (TypeORM, no string concatenation)?
- [ ] Is audit logging needed for sensitive operations?
- [ ] Is CSRF protection maintained (state-changing endpoints)?
- [ ] Does this touch PII? If so, GDPR compliance needed (encryption, deletion support)?

### Real-Time Considerations (if applicable)

- [ ] Does this feature need WebSocket events?
- [ ] Are events scoped to the correct room (org, fleet, activity)?
- [ ] Is the event name following the `domain:action` convention?

---

## STEP 4: Risk and Assumption Register

| Assumption                                     | Affects decision                        | Risk if wrong                                  |
| ---------------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| [Assumption about missing file] `[UNVERIFIED]` | [Which design decision depends on this] | [What would change if assumption is incorrect] |

Also list:

- Files that should be reviewed before implementation begins
- Any decision that could be invalidated by information not yet seen

---

## STEP 5: Implementation Handoff

Produce a concise brief for the implementing agent. This must be specific enough that the agent
cannot make an architectural choice that contradicts your analysis.

```
## Implementation Brief

### Files to create:
- `path/to/file.ts` — [one-sentence responsibility]

### Files to modify:
- `path/to/file.ts` — [what changes and why]

### Key decisions:
- [Decision]: [Reasoning grounded in standards or codebase evidence]

### Constraints:
- [Specific pattern, type, or convention the implementation must follow]
- [e.g. "Service must extend TenantService for automatic tenant scoping"]
- [e.g. "Controller must use BaseController.executeAndReturn()"]
- [e.g. "Frontend hook must follow queryKeys factory pattern"]
- [e.g. "All API calls through apiClient, never raw axios"]

### Do NOT:
- [Anything the implementation must explicitly avoid based on architectural analysis]
- [e.g. "Do not put business logic in the controller"]
- [e.g. "Do not use console.log — use Winston logger"]
- [e.g. "Do not hardcode hex colours — use MUI theme palette"]

### Unverified assumptions (flag if implementation contradicts these):
- [Assumption] — if wrong, this affects [specific decision]
```

### Persist the Brief (mandatory)

A Brief that lives only in this transcript dies with the session. Before handing off, save it to
`.github/harness/memory/briefs/<feature-kebab-case>.md` with a first line of
`# Brief: <feature> — active`, following `.github/harness/memory/briefs/README.md`. Downstream
stages rely on it: Implement follows it, Review-Depth compares against it, Feedback updates it.

Run `npm run harness:graph -- brief-check` to confirm a non-trivial branch added or updated a
committed Brief. The brief filename should map to the branch slug (for example,
`feature/fleet-readiness-dashboard` -> `fleet-readiness-dashboard.md`; Claude run suffixes like
`-6nrbto` are tolerated). Flip the status to `implemented` when the feature ships; never delete a
Brief — it is the record of _why_ the code is shaped the way it is.

## Task

<task>
<!-- Paste the ticket/issue description here -->
</task>

## Colleague's Context (if any)

<context>
<!-- Paste any colleague comments, research, or existing code context here -->
</context>

## Standards Reference

<standards>
- `.github/copilot-instructions.md` — comprehensive project standards
- `docs/CODING_STANDARDS.md` — code patterns and conventions
- `docs/TESTING.md` — testing standards
- `docs/ARCHITECTURE.md` — system architecture
- `docs/DOMAINS.md` — service domain boundaries
</standards>

## Files Provided

<files>
<!-- List all files provided for analysis -->
</files>
