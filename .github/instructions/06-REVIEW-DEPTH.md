<!-- harness-kit template: concrete examples below reference the kit's origin project (a TypeScript/Node monorepo). Adapt them to your stack; the workflow and gates are stack-agnostic. -->

---
applyTo: '**'
---

# Code Review — Architectural Depth Pass

> **Model:** GPT-5.3-Codex  
> **Purpose:** Reason deeply about ownership, abstraction layers, domain alignment, service
> boundaries, and multi-hop design flaws that breadth-first review misses. The question is not
> whether the code is correct — it is whether the structure is right.

Your full coding standards are in `.github/copilot-instructions.md` and `CLAUDE.md`. Read these
BEFORE anything else.

**Rules of engagement:**

- Apply every gate below as a mechanical gate — do not rely on pattern recognition or organic smell
  detection. Step through each item explicitly.
- Do NOT anchor on the stated scope of the PR or ticket. Question whether the framing itself is
  correct.
- For every new method added: ask whether the class it lives on is the right owner, regardless of
  whether the method works correctly.
- For every finding: cite the specific file and code segment as evidence.
- State the confidence level of each finding.
- Do NOT mention items with a `// TODO` comment.
- Do NOT list strengths — only findings with supporting evidence and proposed fixes.
- Do NOT re-report findings already covered in the breadth pass (see bottom of this prompt).

---

## MANDATORY FIRST STEP: Context Sufficiency Check

Complete this entirely before any analysis. Do not skip any step.

### Step 1 — Inventory what you have

List every file provided, one per line:

- File path
- What it contains (one sentence)
- Its layer (`backend/service`, `backend/controller`, `backend/middleware`, `backend/model`,
  `frontend/component`, `frontend/hook`, `frontend/service`, `frontend/store`, `shared-types`,
  `test`)
- Its domain (fleet, activity, communication, trade, organization, auth, etc.)
- Scope: 🔧 Backend / 🎨 Frontend / 🔗 Full-stack

### Step 2 — Identify what you need

For architectural analysis the missing file threshold is higher than for breadth review. You cannot
reason correctly about ownership or domain alignment without seeing the services whose state is
being mutated and the types being processed.

For each new method or class in scope, list files you do NOT have for:

| Missing file                                 | Needed to verify                                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `backend/src/services/fleet/FleetService.ts` | "Does `getFleetAnalytics()` use fleet-specific state or only base class members? Gate 3 cannot be completed." |
| `backend/src/models/Fleet.ts`                | "What entity fields exist? Gate 3 data ownership cannot be verified."                                         |

### Step 3 — Decide how to proceed

**If files critical to any gate are missing:**

State explicitly:

> MISSING: `path/to/file.ts`  
> BLOCKED GATE: [Gate number and name]  
> ASSUMPTION: [what you are assuming about the missing file]  
> RISK: [what finding this assumption could hide — be specific]

Mark every place you use an unverified assumption with `[UNVERIFIED — missing context]`.

Do not produce a finding that depends entirely on an unverified assumption. Instead, produce an
explicit statement:

> CANNOT VERIFY: [specific question] without `[missing file]`. If [assumption] is correct, this is
> [finding]. If not, this is [alternative conclusion].

**If files are missing but non-critical:**

> The following files are absent but their absence only affects confidence, not the correctness of
> architectural findings. Proceeding.

### Step 4 — Request missing context

If any missing file is critical to Gates 1–5 — **stop here and list the files needed.** Do not
produce an architectural finding built on hidden assumptions. Produce an explicit information
request instead.

---

## MANDATORY: Architectural Placement Check

For **every new method and every new class** introduced, complete ALL FIVE gates. A single gate
failure is a finding. Do not skip any gate because the code "looks right".

---

### Gate 1 — Domain / Module Alignment

**Procedure:**

1. Identify the domain of the new method's containing service/class
2. Identify the domain of every entity, DTO, or type it processes
3. Compare the two

**Rule:** Services must live within their own domain or a justified shared domain.

**Failures to flag:**

- A `fleet` entity accessed/modified by a `trade` domain service without justification
- A `communication` service processing `activity` domain data directly
- A service in `backend/src/services/<domainA>/` mutating entities from `<domainB>/` without going
  through domainB's service
- Frontend components directly calling services from unrelated domains

**Finding format:**

> **GATE 1 FAILURE — Domain Misalignment**  
> Method: `[method]` on `[class]` in `[domain]`  
> Processes: `[entity/type]` from `[origin domain]`  
> Problem: Service is in a different domain than the entity it manipulates  
> Proposed fix: Move to `[correct location]` or call through `[correct domain service]`  
> Severity: 🔴/🟡/🔵

---

### Gate 2 — Generality Test

**Procedure:**

1. Take the name of each new method
2. Strip every domain-specific word (e.g. fleet, order, user, product, etc.)
3. Ask: "Does the remaining logic, as implemented, apply to other domains?"
4. Ask: "Would another domain need this exact same pattern?"

**Rule:** If the answer to either question is yes → the method belongs in a shared utility, base
service, or base controller, not the domain-specific class.

**Example:**

- `getFleetPaginatedList()` → strip "Fleet" → `getPaginatedList()` → logic is just a
  `.findAndCount()` with offset/limit, valid for any entity → misplaced in FleetService, should be
  in a shared base service

**Finding format:**

> **GATE 2 FAILURE — Misplaced Generalised Logic**  
> Method: `[original name]` on `[class]`  
> Stripped name: `[stripped name]`  
> Evidence: Method body contains no domain-specific state — only `[what it actually calls]`  
> This pattern is needed by: [other domains that would need the same thing]  
> Proposed fix: Move to `[correct location]`  
> Severity: 🔴/🟡/🔵

---

### Gate 3 — Data Ownership Verification

**Procedure:**

1. List every piece of state the new method reads or mutates
2. For each: identify which entity/model owns that state
3. Compare the owning entity's domain to the service the method is on

**Rule:** If a method primarily manipulates another service's entities → it belongs on that service
(Tell, Don't Ask).

**Rule:** If a method only uses base service members (TenantService, BaseService) and no
domain-specific state → it belongs on the base class.

**Finding format:**

> **GATE 3 FAILURE — Wrong Data Owner**  
> Method: `[method]` on `[service]`  
> State mutated: `[entity/field]` owned by `[other service/domain]`  
> Domain-specific state used: None / [list if any]  
> Proposed fix: Move to `[correct service]`  
> Severity: 🔴/🟡/🔵

---

### Gate 4 — Layer Boundary Audit

**Procedure:**

1. For every service modified, explicitly inspect its controller
2. For every controller modified, explicitly inspect its service
3. Ask: does the controller contain business logic? (calculations, data transformations, conditional
   logic, multi-step orchestration)
4. Ask: does the service handle HTTP concerns? (req/res objects, status codes, headers)
5. Ask: is the middleware chain correct for the endpoint?

**Finding format:**

> **GATE 4 FAILURE — Layer Boundary Violation**  
> Method: `[method]` on `[controller/service]`  
> Evidence: Contains `[business logic / HTTP concern]` that belongs in `[correct layer]`  
> Proposed fix: Move `[specific logic]` to `[correct layer]`  
> Severity: 🔴/🟡/🔵

---

### Gate 5 — Reuse Potential

**Procedure:**

1. Is this the first occurrence of this pattern in the codebase, or has it appeared before?
2. List other domains or contexts that would need this same structure
3. If the pattern already exists elsewhere: is it duplicated or properly extracted?

**Rule:** If this is the Nth occurrence (N > 1) or future reuse is architecturally predictable from
the codebase structure → extract to shared layer now.

**Finding format:**

> **GATE 5 FAILURE — Duplicate or Extractable Pattern**  
> Pattern: `[description]`  
> Existing occurrence: `[location]`  
> Other contexts needing this: [list]  
> Proposed fix: Extract to `[shared location]`  
> Severity: 🔴/🟡/🔵

---

## Deep Trace Analysis

For each significant new code path, trace it fully:

1. **Entry point** — where does this path begin? (HTTP request, WebSocket event, background job,
   React user action)
2. **Ownership chain** — list every service/class execution passes through, in order
3. **State mutations** — at each step, what data is changed and in which entity?
4. **Error propagation** — if failure occurs at step N, does the caller at step N−1 handle it?
5. **Tenant isolation** — at every database access point, is organizationId scoped?
6. **Termination** — where does the path end? Is cleanup guaranteed regardless of which branch is
   taken?

**Flag multi-hop bugs where:**

- An error at layer N is silently swallowed and not propagated to layer N−1
- A database transaction at layer N is not rolled back if layer N+1 fails
- A state mutation at layer N leaves the system inconsistent if the operation only partially
  completes
- A service at layer N calls another domain's repository directly instead of through that domain's
  service
- Tenant context is lost at any point in the chain

---

## Cross-Cutting Concern Detection

Look for logic in the new code that represents a concern broader than the immediate feature:

- **Validation logic** that could apply to multiple domains (generic length checks, UUID validation,
  date range validation)
- **Error handling patterns** that should use the existing custom error classes instead of ad-hoc
  Error throws
- **Logging patterns** that should be consistent across the module (using Winston, including
  context)
- **Pagination logic** that should use established patterns (PaginatedResponse<T>)
- **Type definitions** that live at the wrong level (defined in a frontend component but should be
  in shared-types, or defined in service but should be a DTO)

For any new type, DTO, or interface:

- [ ] Is it defined at the correct layer (model vs DTO vs shared type)?
- [ ] Does every consumer live at the same or higher level than the type itself?
- [ ] Are there multiple consumers that could share a common type at a higher level?
- [ ] Could it live in `packages/shared-types` to be consumed by both backend and frontend?

---

## Multi-Tenant Isolation Analysis

For every database query or data access in the new code:

- [ ] Is organizationId included in the WHERE clause?
- [ ] Is the service extending TenantService (which provides automatic scoping)?
- [ ] If using raw queries or query builders: is parameterised binding used (no string concatenation)?
- [ ] Could a malicious request scope hop to access another tenant's data?
- [ ] Are API responses filtered by tenant before sending to client?

**Flag any path where:**

- A query accesses data without organizationId scoping
- A service method accepts organizationId from the request without validation against the
  authenticated user's org
- A response could contain data from multiple tenants
- A cache key doesn't include organizationId (causing cross-tenant cache poisoning)

---

## Temporal Coupling and Ordering Dependencies

Check whether the new code introduces implicit sequencing requirements:

- Are there methods that MUST be called in a specific sequence without enforcement? (e.g.,
  `initialise()` before `execute()` with no guard)
- Could Express middleware ordering cause the new code to access uninitialised dependencies?
- Are WebSocket event handlers assuming authentication has already occurred?
- Does the code depend on database migrations having run in a specific order?
- Could race conditions arise if two concurrent requests modify the same resource?
- Are React component effects depending on data that may not be loaded yet?

---

## Dependency Direction Verification

Verify dependency flow is correct:

- Dependencies flow inward: controllers → services → repositories → models
- Frontend: components → hooks → services → apiClient
- No circular dependencies between services
- No service importing from a controller
- No model importing from a service
- No frontend service importing from backend
- Shared types flow outward: `packages/shared-types` consumed by both backend and frontend, but
  never importing from them

---

## SRP Architectural Audit

For every class that was modified or created:

1. Write one sentence describing its current responsibility. Can you do it without "and"?
2. Count the distinct concerns it now handles after this change
3. If it handles more than one concern: is this documented as technical debt? Should this change
   trigger a split?

**Flag if:**

- A service name contains "Manager", "Helper", or "Processor" and now handles unrelated
  responsibilities
- A service responsibility sentence requires "and" to be accurate
- A component is doing data fetching AND state management AND complex rendering logic

---

## Performance Architecture (structural, not micro-optimisation)

- Does the new code introduce N+1 query patterns? (loading related entities in a loop instead of
  using joins/relations)
- Are there database queries that should use indexes but none are defined?
- Is work being done at the wrong time? (per-request when it could be cached, synchronous when it
  could be a background job)
- Does the feature introduce a new cache key pattern without documenting its TTL and invalidation
  strategy?
- Are React Query staleTime/gcTime values appropriate for the data freshness requirements?
- Could large lists be paginated instead of loaded entirely?
- Are there unnecessary re-renders caused by object/array reference instability?

---

## Interface and Abstraction Necessity

For any new interface or abstraction introduced:

- [ ] Are there 2+ concrete implementations that exist NOW (not planned)?
- [ ] Is it required for mocking in tests?
- [ ] Is it required by the service architecture?

If none of the above → **YAGNI violation**

For any abstraction that was NOT introduced but arguably should have been:

- Is there a pattern repeated in 2+ places that would benefit from extraction?
- Is there a base class that should own behaviour currently duplicated across services?

---

## Comparison to Architecture Brief (if one was produced by 03-ARCHITECT)

If an Architecture Brief exists from the planning stage:

- [ ] Does the implementation match the Brief's "Files to create" list?
- [ ] Does the implementation match the Brief's "Files to modify" list?
- [ ] Were any "Do NOT" instructions violated?
- [ ] Were `[UNVERIFIED]` assumptions in the Brief confirmed or contradicted by the implementation?

List any divergence from the Brief as a finding, even if the divergence appears intentional.

---

## Findings Summary

Group all findings by category, with severity within each category:

### Architectural Placement (Gates 1–5)

[List each gate failure: 🔴 first, then 🟡, then 🔵]

### Deep Trace

[List each multi-hop issue with the full trace]

### Cross-Cutting Concerns

[List each concern that lives at the wrong level or should be centralised]

### Multi-Tenant Isolation

[List each tenant isolation gap]

### Temporal Coupling

[List each implicit ordering dependency without enforcement]

### Dependency Direction

[List each incorrect or circular dependency]

### SRP Violations

[List each class that cannot be described in one sentence without "and"]

### Performance Architecture

[List each structural performance concern]

### YAGNI Violations

[Over-abstraction (interfaces without implementations) and missing abstraction (patterns repeated
N>1 without extraction)]

### Architecture Brief Divergences (if applicable)

[Any implementation choices that contradict the Brief]

For each finding, state:

1. The specific file and method
2. Which gate or check it failed
3. The concrete code evidence
4. The recommended fix, including where the code should move and why
5. Confidence level: HIGH / MEDIUM / LOW (and reason if Medium or Low)
6. Severity: 🔴 CRITICAL / 🟡 IMPORTANT / 🔵 SUGGESTION

---

## Breadth Pass Findings (paste here to avoid duplication)

<breadth_findings>

<!-- Paste the breadth review output here so this pass doesn't re-report the same issues -->

</breadth_findings>

## Task Context

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
- `CLAUDE.md` — code patterns, conventions, and quick reference
- `docs/TESTING.md` — testing standards
- `docs/ARCHITECTURE.md` — system architecture
- `docs/DOMAINS.md` — service domain boundaries
- `docs/SECURITY.md` — security requirements
</standards>

## Architecture Brief (if available)

<brief>
<!-- Paste the Implementation Brief from 03-ARCHITECT here -->
</brief>

## Files Under Review

<files>
<!-- List all relevant files -->
</files>
