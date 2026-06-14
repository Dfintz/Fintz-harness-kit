<!-- harness-kit: project-agnostic template. See SETUP.md and CREDITS.md. -->
> **Harness-kit template.** Loop commands resolve `{{tokens}}` from `harness.config.json`. Examples below are illustrative; adapt loops under `.github/harness/loops/` to your project. See SETUP.md.

# Loop Protocol — AI Agent Harness

> How any AI agent creates and runs bounded, goal-seeking iteration loops in this repository. Part
> of the [Agent Harness](./HARNESS.md).

A loop is the harness's answer to "keep going until it's actually done": re-run a check, fix what
failed using the project's skills, and repeat — with hard bounds so it can never spin forever.

---

## Loop Anatomy

Every loop is a JSON file in `.github/harness/loops/` with this shape:

```jsonc
{
  "name": "test-fix", // unique id, kebab-case, matches filename
  "kind": "convergence", // "convergence" | "workflow"
  "description": "…", // one sentence: what 'done' means
  "maxIterations": 5, // hard bound — loop MUST stop here
  "checks": [
    // commands that define convergence (exit 0 = pass)
    {
      "name": "backend-tests",
      "run": "npm test",
      "timeoutMs": 600000, // optional per-check timeout (default: none)
    },
  ],
  "rubric": [], // workflow loops: gradeable done-criteria (see below)
  "skills": ["testing"], // skills the fixing agent must load
  "instructions": [".github/instructions/04-IMPLEMENT.md"],
  "fixPrompt": "…", // instruction given to the agent on each failing iteration
  "guardrails": ["…"], // rules the loop may never violate while converging
  "onExhausted": "…", // what to do when maxIterations is hit without convergence
}
```

### Two kinds of loop

- **`convergence`** — done-ness is decided by shell commands (`checks`). These can be executed by
  `scripts/harness/run-loop.mjs` or natively by an agent. Order checks **cheapest first** (lint
  before type-check before build before tests) so each iteration gets the fastest possible feedback
  signal.
- **`workflow`** — done-ness is decided by agent judgment against the loop's `rubric`. `checks` may
  be empty; the `fixPrompt` describes the per-iteration procedure. These are executed natively by an
  agent only — the script runner will refuse them.
- **`experiment`** — there is no done-ness; the loop **optimizes a numeric `metric`** instead of
  converging on pass/fail. Each iteration the agent edits a focused `target`, the runner re-measures
  the metric and **keeps the edit only if it improved** (else reverts the target). Inspired by
  [karpathy/autoresearch](https://github.com/karpathy/autoresearch). Run with
  `scripts/harness/run-experiment.mjs` (use `--measure-only` to record just the baseline). Ends
  `converged` (net improvement), `exhausted` (budget spent, no gain), or `stuck` (no improvement for
  `noImprovementStop` iterations).

### Rubrics (workflow loops)

A workflow loop's `rubric` is a list of **explicit, independently gradeable criteria** — the
evaluator-optimizer pattern: the evaluation step grades each criterion separately and feeds the
specific gaps to the fix step. Write criteria that are checkable, not vibes: "no Blocker or Major
findings remain" grades cleanly; "the code looks good" produces noisy loops. The loop converges only
when **every** rubric item passes, and the iteration evaluating the rubric must be a genuine
re-examination — not a confirmation that the old findings are gone.

### Invariants (apply to every loop, no exceptions)

1. **Bounded.** `maxIterations` is mandatory. When exhausted, stop and follow `onExhausted` — which
   is always some form of "report honestly where you're stuck", never "try harder".
2. **Convergence must be real.** A check passes because the cause was fixed. Deleting a failing
   test, adding `any`, skipping a suite, loosening an assertion, or commenting out a lint rule is
   loop fraud — guardrails name the tempting shortcuts explicitly.
3. **Each iteration is informed.** Feed the failure output of iteration N _and the record of what
   iterations 1…N-1 attempted_ into the fix step of iteration N+1. A stateless retry that re-derives
   the same fix is a wasted iteration.
4. **No progress = stuck, immediately.** If two consecutive iterations produce the same failures for
   the same root cause, the loop is stuck — stop early and report, even with iterations left. The
   budget bounds the loop; it is not a quota to spend.
5. **Grounded reporting.** Every progress claim must point to evidence from this loop's run — a
   check that passed, a rubric item with its verdict, a diff that exists. "Fixed" means the check
   that failed now passes; anything not re-verified is reported as unverified, explicitly.
6. **Checkpointed.** Record the git baseline (commit + dirty state) before iteration 1, so any
   iteration's damage can be rolled back and the final report can say exactly what the loop changed.
   Never start a destructive fix from an unrecorded state.
7. **Scoped fixes.** A loop fixes what its checks cover. Discovering an unrelated bug mid-loop is
   reported, not fixed in-loop.

### Terminal states

Every loop run ends in exactly one of these, and the final report names which:

| State          | Meaning                                         | Runner exit code |
| -------------- | ----------------------------------------------- | ---------------- |
| `converged`    | All checks / rubric items pass                  | 0                |
| `exhausted`    | `maxIterations` reached with failures remaining | 1                |
| `stuck`        | No progress between consecutive iterations      | 3                |
| `blocked`      | Convergence would require violating a guardrail | report as stuck  |
| (config error) | Bad loop definition or arguments                | 2                |

---

## Native Execution (any agent)

Any agent can run any loop without the script. Treat the JSON as a protocol:

```
1. Read the loop JSON. Load every skill in `skills` and read every file in `instructions`.
2. Record the baseline: current commit, dirty/clean working tree.
3. iteration = 1; journal = []
4. Run all `checks` (or for workflow loops, grade every `rubric` item per `fixPrompt`).
5. All pass → terminal state `converged`; report and exit.
6. Any fail →
   a. If the failures match the previous iteration's (same checks, same root cause):
      terminal state `stuck`; report and exit — do not spend remaining iterations.
   b. If iteration == maxIterations: terminal state `exhausted`; follow `onExhausted`.
   c. If the only available fix violates a `guardrails` entry: terminal state `blocked`;
      report the conflict and exit.
   d. Otherwise apply `fixPrompt` to the failure output AND the journal of prior attempts.
      Append {iteration, what failed, what was changed} to the journal.
7. iteration += 1, go to 4.
```

Report at the end, every time: the terminal state, iterations used, final verdict per check or
rubric item (grounded in this run's output — nothing claimed that wasn't re-verified), what changed
per iteration (one line each, with the baseline commit for rollback), and any guardrail that
constrained a fix.

Then **record the run** so it shows up on the metrics dashboard. Convergence loops journal
themselves; for a workflow loop or stage, pipe the rubric verdicts to the recorder:

```bash
node scripts/harness/record-run.mjs --loop review-fix --state converged \
  --pass "Zero Blocker findings remain" --pass "Zero Major findings remain"
# or pipe a fuller spec (multi-iteration, per-stage) as JSON on stdin
```

**Claude Code:** the `run-loop` skill (`.claude/skills/run-loop/`) implements exactly this procedure
— invoke it with the loop name.

## Scripted Execution (convergence loops)

`scripts/harness/run-loop.mjs` runs convergence loops from any shell, delegating fixes to a
configurable agent CLI:

```bash
node scripts/harness/run-loop.mjs <loop-name> [options]

  --check-only          run checks and report; never invoke an agent
  --max-iterations N    override the loop's maxIterations (lower only)
  --agent "<cmd>"       agent command to receive the fix prompt on stdin
                        (default: $HARNESS_AGENT_CMD, else "claude -p")
  --list                list available loops
```

The runner implements the native procedure above: it records the git baseline, pipes the composed
fix prompt (fixPrompt + guardrails + skill paths + the attempt journal + truncated failure output)
to the agent command's stdin, re-runs the checks, and stops early when two consecutive iterations
fail identically. Each run writes a JSON journal (baseline, per-iteration check results and
durations, terminal state) to `.github/harness/runs/` (gitignored) for audit.

Local Ollama example (optional):

```bash
node scripts/harness/run-loop.mjs build-fix \
   --agent "node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b"
```

Exit codes: `0` converged · `1` exhausted · `2` configuration error · `3` stuck (no progress).

---

## Observability

Every run — scripted or native — leaves a JSON journal in `.github/harness/runs/` (gitignored).
Convergence loops are journalled automatically by `run-loop.mjs`; workflow loops and stages are
journalled by `scripts/harness/record-run.mjs` (the recorder refuses convergence loops, which
already self-journal). Aggregate them into a dashboard with:

```bash
npm run harness:report          # writes .github/harness/runs/report.html + a terminal summary
```

The dashboard shows per-loop convergence rates, the slowest checks (convergence loops), and rubric
pass-rates most-failed-first (workflow loops/stages) — the latter is how Understand, Architect, and
the breadth/depth review passes become measurable.

---

## Built-in Loops

| Loop                                          | Kind        | Checks / done-ness                            | Max |
| --------------------------------------------- | ----------- | --------------------------------------------- | --- |
| [`build-fix`](./loops/build-fix.json)         | convergence | lint, type-check, build all green             | 4   |
| [`test-fix`](./loops/test-fix.json)           | convergence | backend + frontend test suites green          | 5   |
| [`review-fix`](./loops/review-fix.json)       | workflow    | breadth + depth review yield no Blocker/Major | 3   |
| [`feature-cycle`](./loops/feature-cycle.json) | workflow    | stage machine 0→5 complete, reviews clean     | 2   |
| [`ci-green`](./loops/ci-green.json)           | workflow    | all PR checks green on remote                 | 5   |

`feature-cycle` is the outermost loop: it runs the whole stage machine and uses `review-fix` as its
inner loop. `ci-green` is for remote/PR babysitting sessions and relies on the agent's PR event
tooling where available (e.g. Claude Code's `subscribe_pr_activity`) instead of polling.

### Experiments

| Loop                                                        | Kind       | Metric / goal                          | Max |
| ----------------------------------------------------------- | ---------- | -------------------------------------- | --- |
| [`lint-debt-experiment`](./loops/lint-debt-experiment.json) | experiment | backend ESLint warning count, minimize | 8   |

Experiments hill-climb a number rather than converge on green. Run one with
`node scripts/harness/run-experiment.mjs <name>` (or `npm run harness:experiment <name>`); add
`--measure-only` to record just the baseline metric for the dashboard without invoking an agent. The
runner snapshots **only** the declared `target` and reverts it on regression — it never runs
`git checkout`, so it cannot clobber unrelated uncommitted work.

#### Driving experiments with a local LLM (autoresearch-style)

A convergence agent only needs to _describe_ a fix, but an experiment agent must _apply_ one — the
runner re-measures files on disk and keeps the edit only if the metric improved. Use the **apply**
adapter so a local model actually rewrites the single declared `target`:

```bash
# One bounded experiment, edits driven by local qwen2.5-coder:
node scripts/harness/run-experiment.mjs lint-debt-experiment \
  --agent "node scripts/harness/ollama-apply-agent.mjs --model qwen2.5-coder:14b"
```

`ollama-apply-agent.mjs` reads the target from `HARNESS_EXPERIMENT_TARGETS` (set by the runner),
asks the model for the complete updated file, and writes **only** that target — anything outside it
is never touched, and a bad rewrite is reverted by the keep-if-improved guard. Add `--commit` to
`run-experiment.mjs` to commit just the target after each kept improvement (a reviewable trail for
unattended runs).

For continuous overnight hill-climbing (≈ autoresearch's "100 experiments while you sleep"), the
loop runner repeatedly schedules `run-experiment.mjs` and journals every attempt to the dashboard:

```bash
# Rotate through all experiments forever, local model, commit kept wins:
npm run harness:experiment:ollama -- --commit

# Or scope + bound it explicitly:
node scripts/harness/experiment-loop.mjs --experiments lint-debt-experiment \
  --agent "node scripts/harness/ollama-apply-agent.mjs --model qwen2.5-coder:14b" \
  --interval-seconds 60 --max-cycles 50 --commit
```

It never edits code itself — it only schedules the runner, which owns the
measure → apply → keep-if-improved → journal protocol.

---

## Creating a Loop

1. Copy [`loops/_template.json`](./loops/_template.json) to `loops/<name>.json`.
2. Define **done** as commands if at all possible (`kind: "convergence"`). Only use
   `kind: "workflow"` when done-ness genuinely requires judgment — and then write a `rubric` of
   explicit, independently gradeable criteria (see Rubrics above).
3. Order `checks` cheapest-first and give long-running ones a `timeoutMs`.
4. Set `maxIterations` to the smallest number you'd accept watching by hand (2–5 is typical). Stuck
   detection ends hopeless runs early, so a generous bound costs little — but the bound is still
   mandatory.
5. Write `guardrails` for the shortcuts an agent would be tempted to take _for this specific loop_ —
   "do not delete the failing test", "do not widen the type", "do not bump the timeout".
6. Write `onExhausted` as a reporting instruction, never a retry instruction.
7. Add the loop to [`registry.json`](./registry.json) under `loops`.
8. Validate: `node scripts/harness/run-loop.mjs <name> --check-only` (convergence loops) or a dry
   read-through of the native procedure (workflow loops).

Keep loops composable: an outer workflow loop should reference inner loops by name in its
`fixPrompt` rather than duplicating their checks.
