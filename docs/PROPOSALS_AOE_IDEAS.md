# Proposals: ideas adapted from Agent of Empires

Two proposals mining [Agent of Empires](https://github.com/agent-of-empires/agent-of-empires)
(AoE) — a session manager / control plane for AI agents (TUI + web dashboard, tmux persistence,
git worktrees, Docker sandboxing, multi-agent fan-out, push/remote access). AoE sits at the
**orchestration & observability** layer this kit is thin on, which is exactly why it's a good
idea-mine. Both proposals stay inside the kit's design constraints: project-agnostic, script-first,
Node built-ins only, no new heavyweight runtime, journals as the source of truth.

---

## Proposal A — Live run-state model + terminal-state notifications

### Problem

The dashboard only ever sees a run **after it finishes**. Journals are written at terminal time
(`run-experiment.mjs` → `finish()`, `record-run.mjs` at the end; `run-loop.mjs` likewise). So today
you cannot answer AoE's headline question at a glance — *"which loop is running right now, which is
waiting on me, which died?"* — and an overnight `harness:experiment:ollama --commit` run gives you
no signal when it commits an improvement, exhausts, or blocks on an approval.

`harness-report.mjs` recognizes only terminal states
(`converged | exhausted | stuck | blocked | incomplete`) and `stateOf()` collapses anything else to
`incomplete`. There is no *live* state and no notification surface.

### Proposal

Borrow AoE's status vocabulary (`running / waiting / idle / error`) as a **live lifecycle** layered
on top of the existing terminal states, plus a provider-agnostic **notify hook** fired on state
transitions.

Two cheap, high-leverage reuses make this small:

1. **"Waiting for input" already exists.** Map AoE's `waiting` onto the existing
   `approval.required && approval.status === "pending"` markers and the dashboard's Pending
   approvals section. No new concept — just surface it as a live status, not only an approval queue.
2. **"Error" is just a non-terminal crash.** Distinguish a legit terminal `exhausted`/`stuck` from a
   run whose agent failed to start or whose process died mid-iteration (today these silently leave no
   journal at all).

### Design

**Heartbeat journal.** Runners write the journal twice: once at **start** with `status:"running"`,
`startedAt`, and `pid`; then rewrite it at **finish** with the terminal state as today. A run whose
journal still says `running` but whose `pid` is no longer alive is reclassified `error` (stale) by
the reader — same trick AoE uses for crashed sessions.

Add a `status` lifecycle field, kept orthogonal to `terminalState`:

```jsonc
{
  "loop": "lint-debt-experiment",
  "kind": "experiment",
  "status": "running",          // running | waiting | done | error   (NEW, live)
  "pid": 48213,                 // (NEW) liveness check for stale-running detection
  "startedAt": "…",
  "heartbeatAt": "…",           // (NEW) rewritten each iteration
  "terminalState": null,        // unchanged: set only when status -> done
  "approval": { "required": true, "status": "pending" }  // -> status:"waiting"
}
```

Reader rule (in `harness-report.mjs`): `waiting` if pending approval; else `running` if
`status==="running"` and `pid` alive; else `error` if `status==="running"` and `pid` dead; else the
existing terminal state.

**Notify hook.** A new `scripts/harness/notify.mjs` shells out to a **user-configured command**
(matching the kit's script-first philosophy and reusing `command-validation.mjs` hardening — no new
SDK, no provider lock-in). Config in `harness.config.json`:

```jsonc
"notify": {
  "enabled": true,
  "on": ["converged", "stuck", "exhausted", "waiting", "error"],   // which transitions
  "command": "curl -s -X POST $SLACK_WEBHOOK -d {payload}"          // {tokens} substituted
}
```

`{tokens}` carry loop name, state, metric delta, journal path. Examples shipped in docs: desktop
`notify-send`, a Slack/Discord webhook `curl`, or just `echo` to a log. The kit never imports a
notification provider — it hands you the transition and you wire the sink.

> Note: this Claude Code harness exposes a `PushNotification` tool, but the *kit itself* is a
> standalone Node project, so it must own a generic shell-out sink rather than depend on a host
> agent's tools. Keep these layers separate.

### Touch-points

| File | Change |
| --- | --- |
| `scripts/harness/notify.mjs` *(new)* | resolve config, substitute tokens, `assertSafeCliCommand`, spawn |
| `scripts/harness/run-loop.mjs` | write `status:"running"` journal at start; rewrite at end; call notify on terminal |
| `scripts/harness/run-experiment.mjs` | start-journal + `heartbeatAt` per iteration; notify inside `finish()`; notify on `commitTargets` improvement |
| `scripts/harness/record-run.mjs` | notify on terminal state; emit `status:"waiting"` when `approval.status==="pending"` |
| `scripts/harness/harness-report.mjs` | extend `TERMINAL_STATES`/`stateOf` reader with live `running`/`waiting`/`error`; render a live "Active runs" panel + status column; stale-running detection via `pid` |
| `harness.config.json` + `harness.config.schema.json` | add `notify` block |
| `docs/` | notify recipes (desktop, Slack, Discord, log) |

### Effort & risk

Small–medium. The riskiest piece is **liveness detection** (don't false-positive a slow run as
`error`) — mitigate with `heartbeatAt` freshness + `process.kill(pid, 0)` rather than wall-clock
alone. Backward compatible: journals without `status` read exactly as today (legacy inference in
`kindOf`/`stateOf` is untouched).

### Out of scope

Actionable approve/reject from the dashboard (that's Proposal-A-next, needs a writer endpoint); a
persistent daemon; tmux. This proposal is read-model + fire-and-forget notify only.

---

## Proposal B — Worktree-parallel experiments (AoE's worktree pattern)

### Problem

`run-experiment.mjs` hill-climbs **serially on a single working tree**: snapshot target files in
memory → let the agent edit → re-measure → keep or revert. One candidate per iteration, one
experiment at a time. AoE's core trick — **a git worktree per agent** — is exactly what unlocks
parallelism here, and as a bonus gives stronger isolation than the current in-memory snapshot.

### Proposal

Two parallelism axes, same mechanism (`git worktree add` from the baseline commit):

1. **Fan-out across experiments** — run several different experiment loops concurrently, each in its
   own worktree, collect journals, report together.
2. **Beam hill-climbing within one experiment** — per iteration, spawn `K` candidate edits in `K`
   worktrees, measure all, **keep the single best** and seed the next iteration from it. Turns the
   current greedy 1-wide search into a `K`-wide beam — strictly better metric outcomes for the same
   wall-clock when you have cores to spare.

Both reuse the existing single-experiment engine unchanged; only the orchestration is new.

### Design

A new orchestrator `scripts/harness/run-experiment-parallel.mjs`:

```
run-experiment-parallel.mjs <name> --candidates K [--max-iterations N] [--agent "<cmd>"]
run-experiment-parallel.mjs --fanout a,b,c            # different experiments in parallel
```

Per candidate:
1. `git worktree add --detach .github/harness/worktrees/<exp>-<k> <baseline-commit>` (gitignored dir).
2. Run the **existing** per-iteration logic with `cwd` = that worktree (reuse `snapshotTargets`,
   `measureMetric`, `isImproved`, `composeImprovementPrompt` verbatim — extract them into a small
   shared module, or invoke `run-experiment.mjs --max-iterations 1` as a child with that `cwd`).
3. Collect `{value, targetContents}` from each worktree.
4. **Apply only the winner's declared target files** back to the main tree — mirroring the existing
   "commit only the declared target" guarantee (`commitTargets`). Because experiments are contractually
   confined to `loop.target`, copying the winner's target file contents is a clean, conflict-free merge —
   no `git cherry-pick` needed.
5. `git worktree remove` all candidates (unless `--keep-worktrees` for debugging).

Isolation is now **total** (separate working dirs), which is *safer* than today's in-memory snapshot
that shares the tree with the user's uncommitted work.

### Touch-points

| File | Change |
| --- | --- |
| `scripts/harness/experiment-core.mjs` *(new, refactor)* | extract `snapshotTargets`/`measureMetric`/`isImproved`/`composeImprovementPrompt`/`resolveTargets` from `run-experiment.mjs` so both runners share them (no behavior change) |
| `scripts/harness/run-experiment-parallel.mjs` *(new)* | worktree lifecycle, concurrency pool (`p-limit`-style, hand-rolled to stay dependency-free), winner selection, apply-back |
| `scripts/harness/worktree.mjs` *(new)* | `add`/`remove`/`list` helpers over `git worktree`, path-validated, auto-clean |
| loop JSON (`.github/harness/loops/*.json`) | optional `"candidates": K` default per experiment |
| `harness-report.mjs` | journal already carries `kind:"experiment"`; add a `candidates`/beam-width column so the dashboard shows it was a parallel run |
| `package.json` | `harness:experiment:parallel` script |
| `doctor.mjs` / `harness-help.mjs` | advertise the parallel runner; doctor preflight: clean-ish tree + `git worktree` available |

### Effort & risk

Medium. Real risks, all containable:

- **Dirty tree.** `git worktree add` from a commit ignores uncommitted changes — the experiment's
  baseline is the committed state. Surface this clearly (the serial runner already warns on a dirty
  tree); for beam mode, require the target files be committed or stash just them.
- **Dependencies in the worktree.** The metric command must run in the new worktree. If it needs
  `node_modules`, either symlink/reuse the root install or document a `--worktree-setup "<cmd>"`
  hook. Default to symlinking `node_modules` to avoid `K` reinstalls.
- **Disk / cleanup.** `K` worktrees cost disk; always `git worktree remove` in a `finally`, and have
  `doctor.mjs` offer `git worktree prune` if a crash leaves orphans.

### Out of scope

Docker sandboxing per candidate (AoE has it; heavier, separate proposal), cross-machine
distribution, and parallelizing convergence/workflow loops (they're pass/fail, not metric-ranked —
beam search doesn't apply).

---

## Recommended sequencing

Ship **A** first: it's smaller, it's backward-compatible, and it immediately upgrades the
overnight-autoresearch story that's already central to the kit (you find out the run blocked or
improved without watching a terminal). **B** is the bigger capability jump but wants A's live status
panel to observe `K` concurrent runs well — so A is a natural enabler for B's UX.
