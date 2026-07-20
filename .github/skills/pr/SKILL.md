---
name: pr
description: PR creation, verification, and review-before-ship workflow. Use when opening a pull request or running a verification sub-agent before human review.
---

# Skill: /pr — Prove the Feature Works, Then Open the PR

> **Use when:** A code change is ready to ship and you need to prove the feature actually works
> before opening a PR — or whenever you hear "open a PR", "ship this", "raise a PR", "/pr".

> **Adapted from:** AI Builder Club `/pr` skill
> (https://github.com/AI-Builder-Club/skills/tree/main/skills/pr)

---

## Philosophy

Verification splits by who is best at it:

- **"Does the feature I just built do what was intended?"** → delegate to a **fresh verifier
  sub-agent** that drives the real app and judges it. Independence (it did not write the code) and
  context-isolation pay off here. Most new features have no automated spec — this is **agentic
  verification, not "run the test"**. Do it first.
- **Objective, codified checks** (type-check, lint, unit, existing e2e) → **you** run them, after,
  as a regression sweep. Delegating these buys nothing — you need the error to fix it.

---

## Preconditions

- You are on a feature branch, not `master`/`main`.
- Changes are committed (clean working tree or staged).
- The feature intent is clear — either from a plan file or inline acceptance criteria.

---

## Step 1 — Bring Up the Real Stack

The verifier sub-agent needs the app running against real services, not the mock test server.

```bash
# Real stack (required for feature verification)
docker-compose -f docker-compose.dev.yml up -d

# Confirm healthy
docker-compose -f docker-compose.dev.yml ps
```

Wait for backend (`:3000`) and frontend (`:3001`) to be healthy before spawning the verifier.

> **Fallback:** If docker-compose is unavailable, use `npm run dev` in two terminals (backend +
> frontend). Use the mock stack only for smoke-level verification and note the degraded mode in the
> PR body.

---

## Step 2 — Verify the Feature (delegate) → Fix → Re-verify

Spawn a **read-only verifier sub-agent** using the prompt below. The verifier:

- Has no memory of writing the code
- Drives the running app via Playwright or by inspecting API responses
- Returns a structured verdict only — it does not edit code

**Verifier prompt template:**

```
You are a read-only verifier. Do NOT edit any code. Do NOT modify any files.

Independently confirm THIS feature works by driving the running app.
The stack is already up (frontend: http://localhost:3001, backend: http://localhost:3000).

FEATURE (what a user should now be able to do and the observable success state):
  <intent / acceptance criteria>              (or: see plan file <path>)

HOW TO EXERCISE IT:
  <UI route + steps>  or  <API call + expected response>

AUTH (the app uses cookie-based auth — use the existing test session):
  Navigate to http://localhost:3001/login and sign in with test credentials,
  or use the existing browser session if already authenticated.

Drive it — walk the exact steps, capture the success state via screenshot:
  npm run screenshot -- --route <route> [--full]
  (writes to tests/.captures/<name>.png)

Return ONLY:

FEATURE: works | broken
  expected: <criteria>
  observed: <what actually happened>
  evidence: <screenshot path(s) or "could not capture — describe observed state">
```

**Interpretation:**

- `FEATURE: broken` → fix the implementation, then **spawn a fresh verifier** (never re-use the same
  context). Cap at **3 verification rounds**; if still broken after round 3, escalate to the human
  with the last verdict and a diagnosis.
- `FEATURE: works` → proceed to Step 3.

---

## Step 3 — Regression Sweep (you run these)

Run all codified checks directly. Do not delegate — you need the error output to fix failures.
**Never weaken an assertion or skip a check to go green.**

```bash
# Type-check
npm run type-check

# Lint (with auto-fix)
npm run lint

# Backend unit tests
npm test --workspace=backend

# Frontend unit tests
npm test --workspace=frontend

# E2E (existing suite against mock server)
npm run test:e2e
```

Triage failures:

- **Real regression** → fix directly. If the fix changes feature behavior, loop back to Step 2
  (spawn fresh verifier).
- **Stale test** (test asserted old behavior that is intentionally changed) → update the test to
  match the new contract. Never delete a test to go green.

---

## Step 4 — Open the PR

Lead with feature proof. Use `gh pr create` or the GitHub MCP tool.

**PR body template:**

```markdown
## What changed

<1–3 lines describing the change>

## Feature verified ✅ (independent verifier drove the app)

- <acceptance criteria> — observed working.
- Evidence: <screenshot path(s) or description of observed state> (attach screenshots to the PR or
  paste the path from tests/.captures/)

## Regression guardrails

- [x] type-check passed
- [x] lint passed
- [x] backend unit tests passed
- [x] frontend unit tests passed
- [x] E2E suite passed

## How to reproduce locally

docker-compose -f docker-compose.dev.yml up -d

# then: <exercise steps>
```

---

## Rules

- **The feature is the verdict** — a green suite with an unverified feature is not done.
- **"Does it actually work" → fresh verifier; objective checks → you.**
- Never open a PR until the feature is verified. Proof, not claims.
- The verifier is always a fresh sub-agent — never ask the implementer to self-verify.
- Cap at 3 verification rounds. Escalate on persistent failure; do not keep patching blindly.
- Isolates _context_, not _environment_: if the stack is single-instance/fixed-port, do not run
  multiple verifiers in parallel.

---

## Screenshot Helper Reference

```bash
# Build frontend first (the e2e-server serves frontend/dist)
npm run build --workspace=frontend

# Capture any route
npm run screenshot -- --route /fleet
npm run screenshot -- --route /org/<id>/members --full
npm run screenshot -- --route /admin --role admin
npm run screenshot -- --role member --viewport mobile --route /activities

# Output: tests/.captures/<name>.png (git-ignored)
```

Options: `--route <path>`, `--role admin|founder|council|member|guest`,
`--viewport mobile|tablet|desktop|WIDTHxHEIGHT`, `--full` (full-page), `--out <path>`.

---

## Pairing with the Harness

This skill sits **after** `implement` in the harness stage machine — it is the bridge between "the
code is green" and "the feature is verified". The standard harness review chain (review-breadth →
review-depth → feedback) reviews the code. This skill proves the running app.

Run `/pr` after Implement's self-review checklist passes, before the handoff to Review Breadth when
you want live-app proof in the PR body.

> The **harness review chain does not replace** this skill. Code review and live-app verification
> are complementary — both are required for a fully verified ship.

## Usage Scenarios

### Scenario 1: My feature is ready. How do I open a pull request?

**What this demonstrates:** Shows PR creation, branch naming, commit message conventions

### Scenario 2: How do I request a Copilot review before human review?

**What this demonstrates:** Demonstrates automated code review and feedback addressing
