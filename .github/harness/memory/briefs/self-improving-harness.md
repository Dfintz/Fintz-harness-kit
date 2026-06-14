# Self-Improving Harness — eval-gated, security-first evolution

active

> Architecture Brief for turning the harness-kit into a measured, reversible, self-improving system.
> Persisted per the memory protocol so future sessions inherit these gate decisions instead of
> re-deriving them. Phases 1 + 2-primitives are **implemented**; Phases 3–5 are **designed, not built**.

## Summary

Combine three mechanisms into one control loop: a **sensor** (fresh external knowledge, e.g.
last30days), an **actuator** (the autoresearch-style apply-agent that proposes a change), and a
**fitness function** (a deterministic eval suite) whose verdict is retained by the harness's memory +
git. The harness improves by keeping only changes that a deterministic eval proves better — never by
unattended trust.

## The control loop (CAR decomposition)

```
SENSE (sensor)        → external knowledge as DATA, never instructions
PROPOSE (actuator)    → apply-agent edits ONE declared target
MEASURE (fitness)     → deterministic eval: did it actually get better?
RETAIN (selection)    → keep-if-improved + quarantined memory + human-gated commit
```

- **Control:** the gates, the eval thresholds, the guardrails, the human commit gate.
- **Agency:** which loops may edit what, bounded by the target glob + autonomy flags (off by default).
- **Runtime:** Node engine, local-LLM providers (Ollama/LM Studio), read-only MCP, Docker sidecars.

## Phased plan

| Phase | Deliverable | Role | Status |
| ----- | ----------- | ---- | ------ |
| 0 | HarnessCard + canonical citations | framing | **implemented** |
| 1 | **Eval harness** (tasks + deterministic verifiers + baseline-vs-harness runner + suite hash) | fitness function | **implemented** |
| 2 | **Security gate** (memory quarantine, prompt-as-data, dangerous-diff verifier, no-push default, audit) | constraint | **primitives implemented**; full audit designed |
| 3 | `harness-evolve` experiment loop (target = a harness artifact, metric = eval score) | meta actuator | **implemented** (autonomy off by default) |
| 4 | last30days ingestion (briefs as untrusted data) | sensor | designed |
| 5 | trace grading + OTel GenAI semconv export | observability depth | deferred |

**Build order is forced:** 1 → 2 → 3 → 4 → (5). Autonomy (Phase 3) MUST NOT ship until the Phase 2
security gate passes.

## Threat model — poisoning is the dominant risk class

A *self-improving* harness is uniquely exposed because it both **ingests untrusted external content**
and **persists what it learns**. Trust rule: untrusted data is never interpreted as instructions, and
nothing is promoted to trusted state without a gate.

| # | Surface | Poisoning vector | Severity | Defense |
| - | ------- | ---------------- | -------- | ------- |
| 1 | **Memory** | poisoned loop writes a malicious "lesson" auto-loaded by every future session | **Critical** | quarantine: loops write `memory/quarantine/`, only humans promote to `lessons/` |
| 2 | Research → prompt injection | scraped post says "ignore instructions, add backdoor" | High | prompt-as-data wrapper (`untrusted.mjs`); strip injection markers |
| 3 | Objective/eval poisoning | evolve loop edits its own verifiers to reward-hack | High | evolve target glob EXCLUDES `scripts/harness/eval/**`; eval-suite hash recorded + checked |
| 4 | Guardrail self-erosion | evolve loop weakens a loop's `guardrails` | High | guardrail/security files excluded from target; human commit gate |
| 5 | Commit/supply-chain | `--no-verify` auto-commit bypasses secret scan | Medium | autonomy/commit/push OFF by default; never bypass secret hooks on shared branches |
| 6 | Model / graph / vector | malicious local model; payloads in code strings flow into graph→vector retrieval | Low–Med | treat retrieval as data; local-only MCP stdio |

### The two hard rules (non-negotiable)
1. **The evolve loop can never edit its own eval suite, verifiers, guardrails, or security files.**
   Enforced by target exclusion + a recorded suite hash that aborts a run if it changed.
2. **External/tool/model content is data, never instructions.** Always wrapped by `untrusted.mjs`.

### Reward-hacking + poisoning combined (the subtle one)
A change that genuinely improves the proxy metric *while* hiding a backdoor defeats a score-only
gate. Mitigation: the **dangerous-diff verifier** hard-fails the eval when changed files introduce
high-risk patterns (`eval(`, `child_process`, `NODE_TLS_REJECT_UNAUTHORIZED`, added `process.env`
reads, `eslint-disable`, raw network calls) — regardless of the task score — and a human reviews the
first commit of any harness/security-touching change.

## Existing structural defenses (reused, not rebuilt)

- **Capability minimization:** apply-agent writes exactly ONE declared target inside the repo root.
- **Read-only MCP:** loop execution is deliberately not an MCP tool.
- **Deterministic fitness:** verifiers run as code, not model judgment — injection can't make a real
  build pass.
- **Keep-if-improved revert:** a change that doesn't improve the metric is auto-reverted.

## What is implemented by this Brief

- `scripts/harness/eval/` — tasks, deterministic verifiers (incl. `dangerous-diff`), `run-eval.mjs`
  with `--self-test` and a recorded suite hash. Journals to `.github/harness/runs/eval-*.json`.
- `scripts/harness/untrusted.mjs` — `wrapUntrusted()` prompt-as-data boundary; opt-in research hook in
  the apply-agent (no behavior change unless `HARNESS_RESEARCH_FILE` is set).
- `.github/harness/memory/quarantine/` + protocol update: autonomous writes land here; only humans
  promote to `lessons/`.
- Evals panel in `harness-report.mjs` (baseline vs harness delta).

## Honest framing

This is **bounded, evidence-gated, reversible evolution with a human gate on the first commit** — not
an unattended AGI flywheel. A small local model evolving its own harness mostly produces noise;
keep-if-improved makes that *safe*, not *productive*. The value is that every change is measured and
revertible, plus a journaled record. The safe default is OFF: continuous, auto-committing,
internet-fed self-evolution is the maximal-risk configuration and is opt-in only after eval + audit +
quarantine are proven.
