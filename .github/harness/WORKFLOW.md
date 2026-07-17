# Harness Workflow Playbook (Optimized)

Purpose: make every non-trivial task run through a repeatable, high-signal workflow that uses the
new skills as operating controls, not optional extras.

This playbook complements, not replaces, [HARNESS.md](./HARNESS.md) and [LOOPS.md](./LOOPS.md).

## 0) Session Boot (Always)

Skills: `context-engineering`, `understand-process`

Run:

```bash
npm run harness:graph -- status
npm run harness:route -- --task "<task>"
```

Required outputs:

- memory consulted (lessons/briefs/radar)
- graph freshness status
- stage route decision
- clearer naming note captured when documentation-only alias language is used

If graph is stale and source code will be changed:

```bash
npm run harness:graph:refresh
```

## 1) Understand Stage

Skills: `understand-process`, `context-engineering`

Goal: produce an impact map grounded in current files and memory.

Exit proof:

- relevant files identified
- graph status recorded
- prior brief checked (if area has one)

Research-style adapter (background evidence gathering):

- Prefer primary-source evidence capture via MCP task wrappers before architectural decisions:
  - `npm run harness:mcp:find -- --query "QUESTION_TEXT"`
  - `npm run harness:mcp:impact -- --file PATH_TO_FILE --depth 2`
- Treat this as an Understand-stage evidence adapter, not as a replacement workflow.

## 2) Architect Stage

Skills: `deterministic-validation`, `doubt-driven-development`

Goal: produce a Brief that passes gates and survives adversarial review before code changes.

Required method:

- CLAIM -> EXTRACT -> DOUBT -> RECONCILE -> STOP
- include gate 4b tenant isolation verdict explicitly

Exit proof:

- Brief saved in `.github/harness/memory/briefs/`
- no unresolved Blocker/Major architectural risks

To-tickets planning adapter (for architecture outputs):

- Draft work as tracer-bullet vertical slices where each slice is independently verifiable.
- Record explicit blocker edges between slices so the frontier is visible.
- If a change is a wide refactor (high mechanical blast radius), use expand-contract sequencing:
  1. expand (new form beside old),
  2. migrate call sites in bounded batches,
  3. contract old form when callers are drained.

Recommended check:

```bash
node scripts/harness/record-run.mjs --loop spec-review --state converged --pass "Brief gates complete"
```

## 3) Implement Stage

Core skills: domain skills (`backend-service`, `frontend-component`, `full-stack-feature`,
`testing`) + `deterministic-validation`

Add-on skills by change type:

- production/runtime behavior changed -> `observability-and-instrumentation`
- security/auth/tenant boundary touched -> `doubt-driven-development`

Execution pattern:

1. implement smallest vertical slice
2. run narrow deterministic proof immediately
3. if proof fails, repair before expanding scope

Common proof commands:

```bash
npm run lint --workspace=backend
npm run lint --workspace=frontend
npm run type-check
npm test --workspace=backend -- <changed>.test.ts
npm test --workspace=frontend -- <changed>.test.tsx
```

Observability minimum for production-facing slices:

- structured entry log
- structured error log
- one measurable RED signal (rate, error, or duration)

Live-app verification (optional — load `.github/skills/pr/SKILL.md`):

1. Bring up the real stack: `docker-compose -f docker-compose.dev.yml up -d`
2. Spawn a fresh verifier sub-agent with the feature's acceptance criteria
3. Capture screenshot evidence: `npm run screenshot -- --route <route>`
4. Include `FEATURE: works | broken` verdict + evidence path in the PR body
5. Cap at 3 verification rounds; escalate if still broken

## 4) Review Stage (Breadth + Depth)

Skills: `doubt-driven-development`, `deterministic-validation`, `run-loop` (agent-native execution)

**Agent operation** (via `run-loop` skill):

Load the `run-loop` skill and execute the `review-fix` loop natively. The loop will:

1. Run the breadth review pass (05) over the current diff
2. Run the depth review pass (06) with breadth findings pasted in
3. If Blocker/Major findings remain, fix them via Implement and re-run
4. Converge when zero Blocker and zero Major findings remain

For convergence loops (e.g., `build-fix`, `test-fix`, `ci-green`), you may also use the script
runner:

```bash
npm run harness:loop build-fix  # convergence loops work via script runner
```

Exit proof:

- zero Blocker findings
- zero Major findings
- touched-scope validation matrix green

Two-axis review framing (adapter language):

- Axis A: Review Breadth validates standards compliance, functional correctness, security, and
  cross-cutting concerns.
- Axis B: Review Depth validates architectural integrity (gates 1-5 + 4b), ownership boundaries, and
  conformance to the Architecture Brief.
- Keep both axes independent; do not collapse breadth and depth into a single pass.

## 5) Feedback and Persisted Learning

Skills: `context-engineering`

Before closing:

- persist/update Brief if architecture changed
- add one lesson if a non-obvious issue was discovered
- record run outcome

## 6) Continuous Harness Improvement (Weekly or Post-Incident)

Skills: `ai-techniques-radar`, `eval-first-tuning`, `deterministic-validation`

Technique intake:

```bash
npm run harness:loop technique-triage
```

Harness optimization:

```bash
npm run harness:evolve:dry-run
npm run harness:evolve
```

Eval-first policy for quality regressions:

1. capture 5-20 failing representative prompts/tasks
2. inspect retrieval/context before prompt rewrites
3. test one variable at a time
4. choose winner on quality and cost

Wayfinder-like epic planning adapter:

- For work too large for one session, keep the harness flow but increase persistence and planning
  depth:
  1. Route with `harness:feature` (or `harness:route` + explicit feature handoff).
  2. Persist/refresh a Brief in `.github/harness/memory/briefs/` each cycle.
  3. Build the plan as frontier-ordered slices using blocker edges.
  4. Execute `spec-review` before implementation changes on each major scope update.
  5. Run `feature-cycle` until blocker/major findings converge.

## Skill Stack Matrix

| Situation                               | Required stack                                                            |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Any non-trivial task                    | `context-engineering` + `understand-process` + `deterministic-validation` |
| Security/auth/tenant changes            | add `doubt-driven-development`                                            |
| Production feature or performance work  | add `observability-and-instrumentation`                                   |
| Prompt/routing/retrieval quality issues | add `eval-first-tuning`                                                   |
| External AI technique adoption          | `ai-techniques-radar` + `technique-triage` before implementation          |
| Feature ready to ship (live proof)      | add `pr` (verify-before-ship, optional during trial)                      |

## Default Command Sequence (Route -> Plan -> Execute)

These labels are documentation-only clarity language; runtime command names remain unchanged.

```bash
npm run harness:graph -- status
npm run harness:route -- --task "<task>"
npm run harness:feature -- --task "<task>"
npm run harness:loop feature-cycle
npm run harness:report
```

## First Commands (Agent Operators, Clear Naming)

> **Note:** These commands are agent instructions via the harness skills (especially `run-loop`),
> not shell commands to copy-paste manually. Humans can use `npm run harness:doctor` to validate
> health, but workflow loop execution (review-fix, feature-cycle, spec-review) requires agent skill
> invocation.

**Convergence loops (script runner capable):**

```bash
npm run harness:loop build-fix    # Execute build-fix convergence loop until green
npm run harness:loop test-fix     # Execute test-fix convergence loop until green
npm run harness:loop ci-green     # Execute CI convergence loop until remote checks are green
```

**Workflow loops (agent-native only):** Load the `run-loop` skill and invoke natively — do not use
the script runner.

**Health and task discovery:**

```bash
npm run harness:help
npm run harness:start -- --task "<task>"
npm run harness:doctor
npm run harness:doctor:strict
npm run harness:list
```

Canonical quick-reference: `docs/harness/COMMAND_INDEX.md`

### MCP Task Wrappers

```bash
npm run harness:mcp:status
npm run harness:mcp:find -- --query "tenant isolation"
npm run harness:mcp:impact -- --file backend/src/app.ts --depth 2
```

Use these wrappers as: gather evidence (`mcp:find`) and map impact (`mcp:impact`).

Compatibility notes:

- `harness:run` aliases `harness:loop`.
- `harness:loop:list` aliases `harness:loops`.
- `harness:evolve:self` aliases `harness:evolve:self-test`.
- `harness:loops` is retained as a legacy compatibility entry and prints a runtime warning.
- `harness:evolve:test` is retained as a legacy compatibility entry and prints a runtime warning.

For review-only requests:

```bash
npm run harness:review -- --task "<task>"
# Then load run-loop skill to execute review-fix natively (workflow loops are agent-native only)
```

## Non-Negotiables

- No stage advances on model self-report alone.
- No unresolved high-impact doubt is allowed to pass into implementation.
- No production-facing change ships without observable signals.
- No adopted external technique bypasses stage-machine review.
