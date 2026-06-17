# HarnessCard

> A one-page, structured description of this harness's design, following the **control–agency–runtime
> (CAR)** decomposition from the harness-engineering literature (HarnessCard, Preprints 2026). Read
> this to understand _what the harness controls, what autonomy it grants, and what it runs on_ before
> changing it. Companion to [`.github/harness/HARNESS.md`](.github/harness/HARNESS.md) (the operating
> contract) and the Architecture Brief
> [`self-improving-harness`](.github/harness/memory/briefs/self-improving-harness.md).

## Identity

| Field          | Value                                                               |
| -------------- | ------------------------------------------------------------------- |
| Name           | harness-kit                                                         |
| Kind           | Project-agnostic agent harness (orchestration layer, agent-neutral) |
| Runtime engine | Node.js ≥ 20, zero required deps (built-in `fetch`)                 |
| Distribution   | Agent Skill (`npx skills`) + Claude Code plugin                     |
| License        | MIT                                                                 |

## Control — what the harness decides

The control layer is everything that constrains the agent toward "done" and "safe."

- **Stage machine:** Understand → Architect → Architect Challenge (cross-model) → Implement →
  Review (breadth+depth) → Feedback. Feedback runs on a model distinct from the reviewer it adjudicates.
- **Five architectural gates** (at Architect + Architect Challenge + Review-Depth): Domain Alignment,
  Generality, Data Ownership, Layer Boundaries, Reuse (+ 4b Multi-Tenant Isolation where applicable).
- **Loop termination:** convergence (checks green), workflow (rubric pass), experiment
  (keep-if-improved else revert), each bounded by `maxIterations` / `noImprovementStop`.
- **Fitness function:** the deterministic eval suite (`scripts/harness/eval/`) — code, not model
  judgment — is the authority on "did this help."
- **Process scoring:** `grade-trace` deterministically grades a loop's _trajectory_ (not its outcome)
  and recommends early-stopping — advisory by default; gating is opt-in (`--min-grade`).
- **Safety controls:** the `dangerous-diff` verifier hard-fails on backdoor-shaped changes; the
  human commit gate; eval-suite immutability (hash + target exclusion); `git-guard` blocks
  irreversible git commands (force push, hard reset, hook bypass) before they run.
- **Independent verification:** the `plan-review` loop runs a _rival-provider_ model over the
  author's judgment read-only and bounded — a plan, or a code change through the breadth / depth /
  feedback lenses — breaking the single-model echo chamber.

## Agency — what autonomy the harness grants

The agency layer is the bounded authority an autonomous loop is given.

| Capability         | Bound                                                                           |
| ------------------ | ------------------------------------------------------------------------------- |
| Edit files         | apply-agent writes **exactly one declared target**, inside the repo root        |
| Run checks         | deterministic verifier commands from `harness.config.json` only                 |
| Keep a change      | only if the metric/eval improved; otherwise auto-reverted (in-memory snapshot)  |
| Write memory       | autonomous writes land in `memory/quarantine/`, never auto-loaded               |
| Commit / push      | **OFF by default**; first commit of a harness/security change is human-reviewed |
| External knowledge | treated as **data, never instructions** (`untrusted.mjs`)                       |

Autonomy is opt-in and escalates only after the eval + security gate prove out. The maximal-risk
configuration (continuous, auto-committing, internet-fed) is never the default.

## Runtime — what the harness runs on

- **Engine:** Node loop runners (`run-loop`, `run-experiment`, `experiment-loop`) + the eval runner.
- **Agents:** any CLI over stdin; local models via Ollama / LM Studio (`llm-provider.mjs`).
- **Observability:** per-run JSON journals → `harness-report` dashboard (incl. the Evals panel);
  deterministic trajectory grading (`grade-trace`) + OpenTelemetry GenAI export (`otel-export`) for
  process scoring and portable telemetry.
- **Tools:** read-only MCP stdio server (graph / memory / vector / loop catalog / metrics).
- **Isolation:** in-process controls shrink blast radius, but real isolation for untrusted/unattended
  work must come from a container/VM (see the Brief's threat model — this is an industry consensus,
  echoed by Pi's "no built-in sandbox" stance).

## Structured handoff format (context discipline)

Long or multi-session runs (and Architecture Briefs) should condense state into this structure —
adapted from Pi's compaction summary format. It keeps a resumed session grounded without replaying
the whole history:

```
## Goal
[what we're trying to accomplish]

## Constraints & Preferences
- [requirements / gate decisions that hold]

## Progress
### Done
- [x] [...]
### In Progress
- [ ] [...]
### Blocked
- [issue + diagnosis]

## Key Decisions
- **[decision]**: [rationale]

## Next Steps
1. [what should happen next]

## Critical Context
- [data needed to continue]

<read-files> … </read-files>
<modified-files> … </modified-files>
```

## Validation matrix (how "safe to ship" is judged)

| Check                   | Command                                                    |
| ----------------------- | ---------------------------------------------------------- |
| Eval suite integrity    | `node scripts/harness/eval/run-eval.mjs --self-test`       |
| Loop catalog loads      | `node scripts/harness/run-loop.mjs --list`                 |
| Report renders          | `node scripts/harness/harness-report.mjs --no-html --json` |
| Prompt-as-data boundary | `node scripts/harness/untrusted.mjs "<probe>"`             |
| Trace grader integrity  | `node scripts/harness/grade-trace.mjs --self-test`         |
| OTel export mapping     | `node scripts/harness/otel-export.mjs --self-test`         |
| Cross-model review loop | `node scripts/harness/plan-review.mjs --self-test`         |
| Dangerous-git guard     | `node scripts/harness/git-guard.mjs --self-test`           |

## Honest limits

In-process controls cannot reliably stop indirect prompt injection (industry consensus, confirmed by
Pi's security docs and the OWASP/Anthropic guidance). This harness reduces risk by **shrinking blast
radius** (single-file target, deterministic verifier, revert-on-no-improvement, quarantined memory,
human commit gate) — not by claiming injection-proof autonomy. For untrusted repositories or
unattended runs, wrap the whole process in a container/VM.
