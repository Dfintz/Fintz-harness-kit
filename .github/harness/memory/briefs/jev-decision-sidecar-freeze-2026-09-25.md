# Freeze the Jev Decision Sidecar

resource: harness.config.json, scripts/harness/decision-sidecar.mjs, scripts/harness/decision-backend-openai.mjs, scripts/harness/decision-advisory.mjs, scripts/harness/decision-eval.mjs, .github/harness/eval/decision-intent-cases.json, .github/harness/memory/briefs/jev-lite-decision-sidecar-windows-wsl2-2026-09-25.md, .github/harness/memory/briefs/jev-full-decision-plane-followon-2026-09-25.md

## Architecture Brief

### Objective

Re-review the local decision sidecar against two questions — is it feasible, and do proper open
models exist — then either advance it or freeze it. This Brief concludes **FREEZE**, and makes that
freeze machine-enforced rather than a note that decays.

### Finding 1 — Technically feasible. Proven, not assumed.

| Property | Measured |
|---|---|
| Warm latency | 67–71 ms (budget 1500 ms) |
| VRAM | 2.0 GB alongside a 14B coder |
| Accuracy on 12 authored cases | 10/12 |
| Confident-wrong | **0/12** |
| Install burden | none beyond a running Ollama |
| Wire contract | `/v1/systemone` unchanged across both backends |

Feasibility is not the blocker. The machinery works end to end on the target hardware.

### Finding 2 — No *proper* open model exists. This is the blocker.

"Proper" means permissively licensed, wire-compatible, and institutionally durable. No candidate
satisfies all three.

| Candidate | Licence | Compatible | Durable | Verdict |
|---|---|---|---|---|
| `chaoliangUNSW/Jev-Style-*` (8 repos) | Apache-2.0 | yes (v1/v2) | **no** | sole blocker |
| `com-kotobalabs/open-jev-deberta-v3-large` | Apache-2.0 | **no** — encoder, not logprob-scorable | plausible | needs a different backend |
| `pngwn/system-one-qwen3.5-4b-scorer` | **CC-BY-NC** | adapter only, no base weights | unknown | licence-excluded |

The durability failure is specific and disqualifying:

- **All eight** Jev-style repos come from a single individual author.
- Every one was last modified within 48 hours of this review; the family is days old.
- Peak engagement is 12 likes.
- **v3 silently broke the v1/v2 wire contract** — it swapped letter readout for a `verdict` readout
  with its own renderer. Discovered only by inspecting returned tokens. A backend built on v2 would
  produce confident nonsense on v3 rather than failing loudly.

A decision component that gates routing cannot depend on a two-day-old single-maintainer model
family that has already broken compatibility once.

### Finding 3 — The promotion gate is unreachable on current evidence

`.github/harness/eval/decision-intent-cases.json` holds 12 cases, all `model-authored`, against a
requirement of 100 human-labelled. The instrument correctly reports `promotion eligible: no`.
Accuracy measured on cases one model wrote about itself is not evidence.

### Decision: FREEZE

Freeze means: code retained, disabled, enforced-disabled, and documented with explicit unfreeze
criteria. It does not mean delete. The work is sound and the cost of keeping it is near zero; the
risk is that a future session sees "10/12, zero confident-wrong" and enables it without reading why
it was stopped.

### Artifacts to modify

- `harness.config.json` — add `modelPolicy.localDecisionSidecar.freeze` with status, date, reason,
  and unfreeze criteria.

### Artifacts to create

- `scripts/harness/test/decision-freeze-test.mjs` — assert the freeze invariants.
- `package.json` — `test:harness:decision-freeze`, added to the core suite.

### Key decisions

**Gate 1 — Domain/module alignment: PASS.** Lifecycle status of a policy belongs beside that policy
in `harness.config.json`.

**Gate 2 — Generality: PASS.** The freeze block is plain declarative metadata; no runtime branches
on it.

**Gate 3 — Ownership: PASS.** Config owns the status; the test owns enforcement. No runtime module
reads `freeze`.

**Gate 4 — Boundary integrity: PASS.** No code path changes. `enabled: false` already short-circuits
`evaluateDecisionAdvisory` before any I/O.

**Gate 5 — Reuse: PASS.** Reuses the existing config self-test conventions and test aggregation.

**The freeze must fail CI, not just read well.** A frozen component protected only by prose gets
un-frozen by the first person who skims. `decision-freeze-test.mjs` asserts that while
`freeze.status === "frozen"`, `enabled` is `false` and `mode` is `shadow`. Enabling it without
consciously lifting the freeze breaks the build. That is the entire point of this slice.

**Do not delete the code.** The lite backend, eval instrument, fixture, and word-boundary fix are
independently valuable and already merged into shared paths. Deletion would discard a working
instrument to solve a sourcing problem.

**Unfreeze criteria are stated as conditions, not intentions.** Vague criteria ("when it's more
mature") cannot be checked. Each is independently verifiable.

### Constraints

- No runtime behavior change; `enabled` stays `false`.
- Do not delete `decision-*.mjs`, the eval fixture, or their tests.
- Do not weaken `promotionRequires` in the fixture to make the gate reachable.
- Do not pin a machine-specific local model into committed config.
- The freeze test must not require a network, GPU, or model.

### Validation plan

- `npm run test:harness:decision-freeze` — invariants hold.
- Negative check: flip `enabled` to `true` in a clone and confirm the test fails.
- `npm run test:harness:decision-sidecar` — existing suite unaffected.
- `npm run harness:config:self-test`, `npm run harness:docs:check`, `git diff --check`.
- `npm run test:harness:core`.

### Do NOT

- Do not enable the sidecar, change `mode`, or add promotion logic.
- Do not treat 10/12 on model-authored cases as adoption evidence.
- Do not add a second decision provider or failover while frozen.
- Do not silently pin `Jev-Style-*` as a default anywhere.
- Do not let the freeze exist only as documentation.

### Assumptions and risks

- `[KNOWN]` This judgement is about supply durability, not model quality. The Jev-style v2 model
  performed well; it is the sourcing that fails.
- `[KNOWN]` If the author abandons the repos, frozen work still loses its best-measured candidate.
  The DeBERTa path remains as an alternative requiring a different backend.
- `[LOW]` A freeze test adds a config-shape coupling. Accepted: that coupling is the enforcement.
