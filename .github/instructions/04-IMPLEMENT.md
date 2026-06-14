<!-- harness-kit template: concrete examples below reference the kit's origin project (a TypeScript/Node monorepo). Adapt them to your stack; the workflow and gates are stack-agnostic. -->

---
applyTo: '**'
---

# Implementation

> **Model:** GPT-5.3-Codex  
> **Purpose:** Implement the feature described in the ticket, following the Architecture Brief
> produced by 03-ARCHITECT if one exists.

Your full coding standards are in `.github/copilot-instructions.md` and `CLAUDE.md` — those
documents are the authority on all style, naming, architecture, and pattern decisions. If tests are
in scope, `docs/TESTING.md` is the authority on test structure.

If an Architecture Brief from 03-ARCHITECT is present, follow it. Any decision it marks as
`[UNVERIFIED]` must be flagged to the user before implementing the affected code.

---

## MANDATORY FIRST STEP: Context Sufficiency Check

Complete this entirely before writing any code. Do not skip any step.

### Step 1 — Inventory what you have

List every file provided, one per line:

- File path
- What it contains (one sentence)
- Its layer (`backend/service`, `backend/controller`, `backend/middleware`, `backend/model`,
  `backend/schema`, `frontend/component`, `frontend/hook`, `frontend/service`, `frontend/store`,
  `shared-types`, `infrastructure`, `test`)

### Step 2 — Determine scope context

Examine the files to determine scope:

**🔧 Backend indicators:** Express routes, TypeORM entities/repositories, Joi schemas, middleware,
services in `backend/src/services/`, controllers in `backend/src/controllers/`

**🎨 Frontend indicators:** React components, MUI imports, Zustand stores, React Query hooks,
frontend services in `frontend/src/services/`

**🔗 Full-stack indicators:** Shared types in `packages/shared-types`, API contract changes,
real-time (Socket.io) features

State the detected scope clearly:

> **Scope: 🔧 Backend** / **🎨 Frontend** / **🔗 Full-stack**

### Step 3 — Identify what you need

For each file you have, list the files it references that you do NOT have but would need to
implement correctly:

| Missing file      | Needed to implement                                                         |
| ----------------- | --------------------------------------------------------------------------- |
| `path/to/file.ts` | e.g. "Need to know the interface of `TenantService` to extend it correctly" |

### Step 4 — Decide how to proceed

**If critical files are missing:**

State explicitly:

> MISSING: `path/to/file.ts` — cannot implement [specific method/class] without this.  
> ASSUMPTION: [what you are assuming]  
> RISK: [what could be wrong if the assumption is incorrect]

Mark every place you use an unverified assumption inline with `[UNVERIFIED — missing context]`.

**If files are missing but non-critical:**

> The following files are absent but their absence only affects confidence, not correctness.
> Proceeding.

### Step 5 — Confirm or flag the Architecture Brief

If a Brief is present:

- Confirm you will follow it
- List any `[UNVERIFIED]` assumptions in the Brief that affect what you are about to implement
- If any assumption appears to be contradicted by the files you have been given, STOP and flag it
  before writing code

---

## MANDATORY SECOND STEP: Pre-Implementation Discovery

Before writing ANY code, complete every item below. If you cannot complete an item, stop and ask.

### 1. Type Consistency Discovery

- [ ] If creating a type that mirrors another: locate the source type, compare field-by-field, match
      types EXACTLY
- [ ] Check `packages/shared-types` for existing shared types before creating new ones
- [ ] Any deviations from source types have an inline comment explaining WHY

### 2. Error Handling Discovery

- [ ] Searched for existing custom error classes in `backend/src/utils/apiErrors` or
      `backend/src/utils/errors`
- [ ] Searched for `getErrorMessage`, `logError`, `isApiClientError` patterns
- [ ] Using project error types (NotFoundError, ValidationError, ForbiddenError, UnauthorizedError)
      — NOT generic `Error` throws for expected conditions

### 3. Service Pattern Discovery

- [ ] Searched for similar services in the codebase under `backend/src/services/`
- [ ] Matching existing pattern (extends TenantService vs standalone, constructor DI vs direct
      import)
- [ ] Confirmed service file exports a singleton instance if that's the domain convention

### 4. Pattern Usage Validation

- [ ] Before copying a pattern from an adjacent file: searched for usages of that pattern
- [ ] Zero usages found → not copying it (YAGNI)
- [ ] Confirmed the pattern is the current approach (not a deprecated/legacy pattern)

### 5. Frontend Discovery (if applicable)

- [ ] Checked `frontend/src/hooks/queries/queryKeys.ts` for existing key factories
- [ ] Checked for existing React Query hooks in `frontend/src/hooks/queries/`
- [ ] Checked for existing frontend services in `frontend/src/services/`
- [ ] Confirmed MUI components used (not Adobe Spectrum — which is migrated away)
- [ ] Confirmed `@/` path alias used for all cross-directory imports

### 6. Database/Migration Discovery (if applicable)

- [ ] Checked `backend/src/models/` for existing related entities
- [ ] Checked for existing indexes and constraints that may conflict
- [ ] Migration timestamp follows convention: `YYYYMMDDHHMMSS`
- [ ] No `synchronize: true` anywhere — migrations only

### 7. Validation Schema Discovery

- [ ] Searched for existing Joi schemas in `backend/src/schemas/`
- [ ] Matching existing schema patterns (field naming, validation rules)
- [ ] Schema covers all required fields and applies appropriate constraints

---

## Implementation

Implement the task. Adhere to all standards in `.github/copilot-instructions.md`. Pay particular
attention to:

**Backend patterns:**

- Service layer handles business logic; controllers handle HTTP concerns only
- All services that access tenant-scoped data extend TenantService or scope queries by
  organizationId
- All endpoints validate inputs with Joi schemas
- Use Winston logger — never `console.log` in production code
- Error handling uses `catch (error: unknown)` — never `catch (error: any)`
- TypeORM parameterised queries only — no string concatenation in SQL
- Middleware order: Helmet → CORS → Correlation ID → Rate Limiting → Body Parsing → Auth → Tenant
  Context → Permissions → Validation → Controller

**Frontend patterns:**

- React Query for all server state (hooks in `hooks/queries/use<Domain>Queries.ts`, keys in
  `queryKeys.ts`)
- Zustand for client-only state (auth, UI preferences, theme)
- MUI v7 components exclusively (Fringe Core design system)
- `apiClient` or `BaseService` for all API calls — never raw `axios` imports
- `@/` path alias for all cross-directory imports — never `../../` relative paths
- `logger` from `@/utils/logger` — never `console.log`
- No hardcoded hex colours — use MUI theme palette or shared colour utilities
- `isApiClientError()` for error handling — never `as any` for error access
- `<CircularProgress />` for loading states
- Props interfaces use `Readonly<>` wrapper

**Type safety:**

- TypeScript strict mode — no `any` types
- Use `unknown` with type guards for truly unknown types
- Explicit return types on all public functions
- Use union types and discriminated unions over loose string types

**Async patterns:**

- Prefer async/await over raw promises or callbacks
- All promises must be awaited or explicitly voided
- No unhandled promise rejections

**Method size:**

- Methods exceeding 50–75 lines should be refactored into smaller units
- Complex conditionals extracted into well-named helpers

---

## Mandatory Self-Review (Before Marking Complete)

Work through every item. Do not submit until all pass.

### Context and Brief Compliance

- [ ] Every `[UNVERIFIED]` assumption from the Architecture Brief was either confirmed or flagged to
      the user?
- [ ] Implementation matches the Brief — no files created that were listed under "Do NOT"?

### Reference Consistency

- [ ] Found and compared against source types being mirrored?
- [ ] Field types match EXACTLY (or deviations have an inline comment)?
- [ ] Types from `packages/shared-types` used where appropriate?

### Pattern Consistency

- [ ] Searched for existing error handling patterns and used them?
- [ ] Searched for existing service/controller patterns and matched them?
- [ ] Codebase patterns take precedence over personal preference?

### YAGNI Compliance

- [ ] Every file created has at least one consumer right now?
- [ ] No abstractions without current consumers?
- [ ] No forward-looking code without current requirements?

### Backend Checks (if applicable)

- [ ] Service extends TenantService (if multi-tenant data access)?
- [ ] Controller uses BaseController.executeAndReturn() for response handling?
- [ ] Joi schema defined for all new API endpoints?
- [ ] Route registered in the appropriate routes file?
- [ ] All database queries scoped by organizationId (tenant isolation)?
- [ ] Audit logging added for sensitive operations?
- [ ] Winston logger used — no console.log/warn/error?
- [ ] Error types are domain-specific (NotFoundError, ValidationError, etc.)?

### Frontend Checks (if applicable)

- [ ] MUI v7 components used — no Adobe Spectrum imports?
- [ ] React Query hooks follow `use<Domain>Queries.ts` pattern?
- [ ] Query keys registered in `queryKeys.ts` factory?
- [ ] Loading states show `<CircularProgress />`?
- [ ] Error states show `<Alert severity="error">`?
- [ ] `@/` imports used throughout — no relative cross-directory paths?
- [ ] No `any` types — proper typing or `unknown` with guards?
- [ ] No hardcoded colours — MUI theme or utility functions?
- [ ] `apiClient` or `BaseService` for API calls — no raw axios?

### Security Checks

- [ ] No hardcoded secrets or API keys?
- [ ] Input validation via Joi schemas?
- [ ] SQL queries use TypeORM parameterised binding?
- [ ] Authentication middleware on protected routes?
- [ ] Permission checks in place for RBAC?
- [ ] No PII in log messages (or encrypted if compliance-required)?
- [ ] CSRF protection maintained on state-changing endpoints?

### Testing

- [ ] Unit tests written for new service methods?
- [ ] Test naming follows: `describe('ClassName')` and `it('should do something')`?
- [ ] External dependencies mocked (APIs, databases)?
- [ ] Both success and failure paths covered?
- [ ] Test file co-located or in `__tests__/` directory?

### Architecture

- [ ] Can I describe every class I created or modified in one sentence without "and"?
- [ ] For every new method: does it belong on the class that OWNS the data it manipulates?
- [ ] Business logic in services, HTTP concerns in controllers?
- [ ] No circular dependencies introduced?

---

## Task

<task>
<!-- Paste the ticket/issue description here -->
</task>

## Architecture Brief (if available)

<brief>
<!-- Paste the Implementation Brief from 03-ARCHITECT here -->
</brief>

## Colleague's Context (if any)

<context>
<!-- Paste any colleague comments, research, or existing code context here -->
</context>

## Standards Reference

<standards>
- `.github/copilot-instructions.md` — comprehensive project standards
- `CLAUDE.md` — code patterns, conventions, and quick reference
- `docs/TESTING.md` — testing standards
</standards>

## Files Provided

<files_created>

<!-- List files created -->

</files_created>

<files_modified>

<!-- List files modified -->

</files_modified>

<files_reference>

<!-- List files needed for understanding the existing code -->

</files_reference>
