<!-- harness-kit template: concrete examples below reference the kit's origin project (a TypeScript/Node monorepo). Adapt them to your stack; the workflow and gates are stack-agnostic. -->

---
applyTo: '**'
---

# Code Review — Breadth Pass

> **Model:** GPT-5.3-Codex  
> **Purpose:** Find as many concrete, actionable issues as possible through systematic compliance
> checking, functional correctness analysis, and test coverage assessment.

Your full coding standards are in `.github/copilot-instructions.md` and `CLAUDE.md` — those
documents are the authority. If test files are included, `docs/TESTING.md` is the authority on
testing.

**Rules of engagement:**

- Distinguish clearly between direct observations from the code and your interpretations or
  assumptions
- For every technical assertion, cite the specific evidence: file name and code segment
- When discussing architectural patterns, verify they are present in THIS codebase — do not assume
  from similar systems
- Highlight areas where additional code examination would strengthen your analysis
- State the confidence level of each key point: **HIGH** (code evidence), **MEDIUM** (strong
  inference), **LOW** (assumption)
- Do NOT mention items with a `// TODO` comment as issues
- Do NOT list strengths — only findings, proposed fixes, and test suggestions

---

## MANDATORY FIRST STEP: Context Sufficiency Check

Complete this entirely before any analysis. Do not skip any step.

### Step 1 — Inventory what you have

List every file provided, one per line:

- File path
- What it contains (one sentence)
- Its layer (`backend/service`, `backend/controller`, `backend/middleware`, `backend/model`,
  `backend/schema`, `frontend/component`, `frontend/hook`, `frontend/service`, `frontend/store`,
  `shared-types`, `test`)

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

For each file you have, list the files it references that you do NOT have but would affect finding
quality:

| Missing file      | Affects which analysis                                         |
| ----------------- | -------------------------------------------------------------- |
| `path/to/file.ts` | e.g. "Cannot verify that Joi schema matches entity definition" |

### Step 4 — Decide how to proceed

**If critical files are missing:**

> MISSING: `path/to/file.ts` — cannot complete [specific pass / check] without this.  
> ASSUMPTION: [what you are assuming]  
> RISK: [what finding could be hidden or wrong]

Mark every use of an unverified assumption with `[UNVERIFIED — missing context]`.

**If files are missing but non-critical:**

> The following files are absent but their absence only affects confidence, not correctness of
> findings. Proceeding.

---

## ZERO PASS: Pre-Review Discovery

Before evaluating any code, verify the author completed discovery:

1. Identify all files created and modified
2. For each new type: is there a source type being mirrored? Has a field-by-field comparison been
   done?
3. Identify the error handling pattern in use — does it match project conventions
   (`catch (error: unknown)`, custom error classes)?
4. Identify the service layer for each file (service, controller, middleware, component, hook)
5. Identify the execution context of each method (request handler, background job, WebSocket event,
   React lifecycle)

---

## FIRST PASS: Standards Compliance

Check each item as a checklist. Report failures only.

### TypeScript

- [ ] Strict mode: no `any` types used?
- [ ] `unknown` with type guards used for truly unknown types?
- [ ] Explicit return types on public methods?
- [ ] `catch (error: unknown)` — never `catch (error: any)`?
- [ ] No unnecessary type assertions (`as string`, `as number`) where type is already correct?
- [ ] No `@ts-ignore` or `@ts-expect-error` without justification comment?
- [ ] Union types and discriminated unions used instead of loose string types?

### Naming

- [ ] Classes, interfaces, types: PascalCase?
- [ ] Variables, parameters, functions: camelCase?
- [ ] Constants: UPPER_SNAKE_CASE?
- [ ] Collection names are plural; single-item names are singular?
- [ ] Boolean variables describe their meaning clearly (`isLoading`, `hasPermission`, not `flag`)?
- [ ] No ambiguous method verbs — no unqualified "handle", "process", "manage"?
- [ ] Type guards named `is<TypeName>` pattern?

### Backend: Service Layer

- [ ] Business logic in services, not controllers?
- [ ] Service extends TenantService for multi-tenant data access?
- [ ] Constructor follows established DI pattern (injected repositories or singleton exports)?
- [ ] Logger used for method entry and error conditions?
- [ ] Domain-specific error types thrown (NotFoundError, ValidationError, etc.)?

### Backend: Controller Layer

- [ ] Controllers handle HTTP concerns only (req/res extraction, status codes)?
- [ ] Uses BaseController.executeAndReturn() for consistent response handling?
- [ ] Joi validation applied before business logic?
- [ ] No business logic in controllers (calculations, data transformations, external calls)?
- [ ] Authentication middleware applied to protected routes?
- [ ] Permission checks applied where RBAC is required?

### Backend: Database

- [ ] All queries use TypeORM parameterised binding — no string concatenation?
- [ ] Queries scoped by organizationId for tenant isolation?
- [ ] Relations loaded explicitly (not relying on eager loading)?
- [ ] Migrations use timestamp naming convention?
- [ ] No `synchronize: true` in any configuration?

### Backend: Validation

- [ ] Joi schemas defined for all new endpoints in `backend/src/schemas/`?
- [ ] Schema field names match entity/DTO field names?
- [ ] Required fields validated as `.required()`?
- [ ] String fields have reasonable `.max()` constraints?
- [ ] UUID fields validated with `.uuid()`?
- [ ] Enum fields validated with `.valid()` against allowed values?

### Backend: Middleware

- [ ] Middleware order correct: Helmet → CORS → Rate Limiting → Auth → Tenant → Permissions →
      Validation → Controller?
- [ ] Rate limiting configured appropriately for endpoint type?
- [ ] CSRF protection on state-changing endpoints (POST, PUT, PATCH, DELETE)?

### Frontend: Components

- [ ] Functional components with hooks — no class components?
- [ ] UI framework components used — no legacy library imports?
- [ ] Props interfaces defined with `Readonly<>` wrapper?
- [ ] Named exports used — no default exports?
- [ ] `@/` path alias for all cross-directory imports — no `../../` relative paths?
- [ ] No hardcoded hex colours — MUI theme palette or utility functions (`semanticColorUtils`,
      `statusStyles`)?
- [ ] Error states handled with `<Alert severity="error">`?
- [ ] Loading states show `<CircularProgress />`?
- [ ] Charts/sparklines have explicit container dimensions (avoid Recharts -1 errors)?

### Frontend: State Management

- [ ] Server state uses React Query (TanStack) — not local useState for fetched data?
- [ ] Client-only state uses Zustand stores (auth, UI, theme)?
- [ ] React Query hooks in `hooks/queries/use<Domain>Queries.ts`?
- [ ] Query keys in `queryKeys.ts` using factory pattern?
- [ ] Mutations invalidate related query caches on success?
- [ ] `enabled` option used for conditional fetching (not manual `useEffect` fetching)?

### Frontend: API Layer

- [ ] All API calls through `apiClient` or `BaseService` — never raw `axios` imports?
- [ ] Error handling uses `isApiClientError()` (preferred) or `isAxiosError()` (legacy)?
- [ ] No `as any` for error property access?
- [ ] Service files extend `BaseService` and are exported as singletons?
- [ ] Types/interfaces co-located in the service file?

### Frontend: Routing & Navigation

- [ ] Pages are lazy-loaded with named exports?
- [ ] Protected routes wrapped with `<ProtectedRoute>`?
- [ ] Routes registered in `routeRegistry` for navigation, command palette, breadcrumbs?

### Logging

- [ ] Backend: Winston logger used — no `console.log/warn/error`?
- [ ] Frontend: `logger` from `@/utils/logger` used — no `console.log`?
- [ ] Log messages include meaningful context (IDs, keys, operation names)?
- [ ] No PII logged in plain text (email, passwords, tokens)?
- [ ] Errors logged with `err instanceof Error ? err : new Error(String(err))`?

### Error Handling

- [ ] `catch (error: unknown)` used — never `catch (error: any)`?
- [ ] Custom error classes from `apiErrors` used for expected error conditions?
- [ ] Error messages are specific and actionable (not "Something went wrong")?
- [ ] Frontend: Unknown errors wrapped: `err instanceof Error ? err : new Error(String(err))`?
- [ ] Backend: `logError(error, 'ServiceName.methodName')` pattern used?

### Documentation

- [ ] Comments explain WHY, not WHAT?
- [ ] No comments that duplicate what the code/signature already conveys?
- [ ] JSDoc on public service methods with `@param`, `@returns`, `@throws`?

### Import Guidelines

- [ ] Direct import paths used — not deprecated re-export modules?
- [ ] Service imports follow domain path conventions (`services/<domain>/<Service>`)?
- [ ] No circular imports between modules?

---

## SECOND PASS: Functional Correctness and Resource Management

Analyse:

**Logic**

- Logic errors and incorrect assumptions
- Off-by-one errors, incorrect boundary conditions
- Unsafe type assertions: `as unknown as SpecificType` chains

**Security**

- SQL injection: any string concatenation in database queries?
- XSS: user input rendered without sanitisation?
- CSRF: state-changing endpoints without CSRF protection?
- Auth bypass: endpoints missing authentication middleware?
- Tenant leakage: queries without organizationId scoping?
- Cookie-based auth: if token is `cookie-auth` placeholder, no Authorization headers sent?

**Resource Safety**

- Database connections properly managed (TypeORM handles most of this)?
- Redis connections/subscriptions cleaned up?
- Socket.io event listeners cleaned up on disconnect?
- React useEffect cleanup functions provided where needed?
- Event listeners removed on component unmount?

**Null Safety**

- All optional values checked before use?
- TypeORM query results validated (`.findOne()` can return null)?
- `req.user`, `req.params`, `req.query` values validated before use?

**Async Safety**

- All promises awaited or deliberately fire-and-forget with explicit comment?
- No unhandled promise rejections?
- No race conditions in concurrent operations?
- React Query `enabled` guards prevent fetching with undefined parameters?

**Bounds**

- Array access validated?
- Pagination parameters validated (page >= 1, pageSize within limits)?
- File upload sizes and types restricted?

---

## THIRD PASS: Test Coverage (only if test files are provided)

If coverage appears low, explain how it can be improved.

**Coverage**

- [ ] Every public service method has at least one SUCCESS path test?
- [ ] Failure paths tested as thoroughly as success paths?
- [ ] No trivial tests (checking mock returns what mock was set to)?
- [ ] Testing actual behaviour — state changes, return values, side effects?
- [ ] Error cases tested: NotFoundError, ValidationError, ForbiddenError?
- [ ] Edge cases: empty arrays, null values, maximum lengths?

**Assertions**

- [ ] `expect()` assertions are specific (`.toBe()`, `.toEqual()`, `.toThrow()`)?
- [ ] No loose assertions (`.toBeDefined()` where a specific value check is appropriate)?
- [ ] Async assertions use `await expect().rejects.toThrow()` pattern?
- [ ] Meaningful assertion messages where intent is not obvious?

**Isolation**

- [ ] Tests are independent — no shared mutable state between test cases?
- [ ] `beforeEach` resets all mocks (`jest.clearAllMocks()`)?
- [ ] External dependencies mocked (databases, APIs, services)?
- [ ] No tests that depend on execution order?

**Organisation**

- [ ] Test naming follows: `describe('ClassName/Function')` and `it('should [expected behaviour]')`?
- [ ] Related tests grouped under `describe` blocks?
- [ ] Test files co-located with source or in `__tests__/` directories?
- [ ] Arrange/Act/Assert (AAA) pattern followed?

**Frontend Test-Specific (if applicable)**

- [ ] React Testing Library used with user-centric queries (`getByRole`, `getByText`)?
- [ ] `waitFor` used for async state updates?
- [ ] `userEvent` preferred over `fireEvent` for user interactions?
- [ ] No testing implementation details (internal state, private methods)?

---

## FOURTH PASS: Semantic Analysis

For every method name and test name, verify the name accurately describes what the code actually
does.

Ask for each: "Does the name of this function/test match what it actually does?"

Look specifically for:

- Test names claiming to test one thing but asserting another
- Service method names that don't reflect their actual side effects
- Variable names that are too short or ambiguous to convey meaning
- React component names that don't reflect their actual UI purpose
- Query key factory names that don't match the data they represent

---

## FIFTH PASS: Test Redundancy Audit (only if test files are provided)

Every test must provide UNIQUE value. For each test, answer:

- [ ] Does this test invoke a different method than existing tests?
- [ ] Does this test use different input data that explores new logic branches?
- [ ] Would removing this test reduce meaningful code coverage?
- [ ] Is this testing actual behaviour rather than framework mechanics?

**Priority:**

- HIGH VALUE: success paths, failure paths, edge cases, boundary conditions, security checks
- LOW VALUE: testing that mocks return mocked values, testing framework behaviour

---

## Output Format

Group ALL findings by severity, not by pass number:

**🔴 CRITICAL** — Bugs, crashes, security vulnerabilities, data leaks, tenant isolation failures
**🟡 IMPORTANT** — Standards violations, missing error handling, test gaps, missing validation **🔵
SUGGESTION** — Improvement opportunities, minor style issues, readability enhancements

For each finding:

1. **File:Line** (or File:Method if line unknown)
2. **Finding** (what's wrong)
3. **Evidence** (code segment or reasoning)
4. **Confidence** (HIGH/MEDIUM/LOW)
5. **Fix** (specific recommendation)

---

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
</standards>

## Files Under Review

<files_created>

<!-- List files created -->

</files_created>

<files_modified>

<!-- List files modified -->

</files_modified>

<files_reference>

<!-- List files needed for context/understanding -->

</files_reference>
