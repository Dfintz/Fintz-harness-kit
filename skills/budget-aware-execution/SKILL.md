# Skill: Budget-Aware Execution

> Use when: Starting substantial multi-stage, loop-driven, or parallel-wave work; running a harness
> loop that could exhaust its iteration budget; or a long session is approaching context-window,
> token, or usage-window limits and risks stalling mid-task.

Adapted from [BuilderIO/skills](https://github.com/BuilderIO/skills) — `stay-within-limits` skill.
Re-authored to the harness conventions (concept adoption, no vendor package). It adds a **resource
gate** that complements a correctness gate (proof before advancing) and session-start context
loading.

---

## Objective

Never exhaust an execution budget mid-task and leave partial, hard-to-resume state. Assess headroom
before and between waves of work, and when a threshold is reached, stop cleanly at a checkpoint the
next session can resume from — instead of running out of room halfway through an edit or a loop.

---

## When to Use It

- Before kicking off a harness loop (`build-fix`, `test-fix`, `review-fix`, `feature-cycle`,
  `ci-green`) or a wide multi-file change.
- Between parallel waves or loop iterations.
- When context is getting long, a loop is nearing its `maxIterations`, or the runtime signals the
  usage window (5-hour / weekly / token budget) is running low.

Skip it for single-file, single-step, obviously bounded work.

## The Discipline: ASSESS → THRESHOLD → CHECKPOINT

### ASSESS

Before a substantial wave, estimate the three headroom axes that apply to the current runtime:

- **Iteration budget** — how many loop iterations remain against the loop's `maxIterations` (see
  `.github/harness/LOOPS.md` and `scripts/harness/run-loop.mjs`).
- **Context headroom** — is the working context long enough that quality is starting to degrade?
- **Usage window** — where the runtime exposes it, remaining session/token/rate budget.

### THRESHOLD

Set a stop line **before** starting, not after hitting the wall. Defaults unless evidence says
otherwise:

- Pause new execution at roughly **90–95%** of a known hard budget.
- Do not begin a wave you cannot both finish and validate within the remaining headroom.
- Treat "one more iteration" near a loop's `maxIterations` as a stop signal, not a free action.

### CHECKPOINT

When the threshold is reached, stop and write a **self-contained** checkpoint so the next session
resumes without re-deriving state:

- Record the current plan, what is done, and the exact next step in your session/working memory (or
  the runtime's own scratch note).
- For architecture-level work, reconcile the active brief in `.github/harness/memory/briefs/`.
- Leave the tree in a validated or clearly-marked-partial state — never a silently broken edit.
- End with an explicit status signal (e.g. a yellow "paused at N% budget; resume at step X").

## Stop Signals (any one is enough)

- A loop is one or two iterations from its `maxIterations`.
- Output quality is visibly degrading from context length.
- The runtime reports the usage/token window near its limit.
- Remaining headroom is smaller than the estimated cost to finish **and** validate the current wave.

## Integration With Existing Harness Surfaces

- **`run-loop` / LOOPS.md** — loops are already bounded by `maxIterations`; this skill adds the
  discipline of stopping _before_ the bound with a resumable checkpoint rather than burning the last
  iteration on unfinishable work.
- **Session-start context loading** — that discipline loads committed memory at session start; this
  one writes the resume checkpoint at session end, so the pair covers both ends of a session.
- **Correctness validation** — pair the two: never advance a phase without proof (correctness) _and_
  never start a wave you cannot finish within budget (resource).
- **Run metrics / observability** — record the pause/threshold event in run metrics so budget stalls
  are visible over time.

## Common Traps

- Discovering the budget is gone _after_ an edit is half-applied.
- Spending the final loop iteration on a change that cannot also be validated.
- Treating a degrading-quality long context as free because no hard error fired yet.
- Writing a vague checkpoint ("continue the feature") instead of the exact next step.
- Building an automated budget-guard script against a usage window the local runtime cannot query —
  keep this a behavioral discipline until a real budget signal exists.

## Exit Checklist

- Headroom on the applicable axes was assessed before the wave.
- A threshold/stop line was set before starting, not improvised at the wall.
- If paused: the session/working memory (and any active brief) hold a self-contained resume point.
- The tree is validated or explicitly marked partial — no silently broken edits.
- The response ends with a clear work-state signal (done / paused-with-next-step / blocked).
