# SemIf Local Decision Sidecar

resource: scripts/harness/prompt-router.mjs, scripts/harness/llm-provider.mjs, scripts/harness/dspy-bridge.mjs, scripts/harness/test/prompt-router-run-bundle-test.mjs, harness.config.json, package.json, .github/harness/memory/radar/semif-local-decision-sidecar.md, .github/harness/memory/radar/ollaya-local-decision-daemon-contract.md, .github/harness/memory/radar/jevcompat-sidecar-conformance-gate.md, .github/harness/memory/radar/discern-explicit-uncertainty-policy.md, .github/harness/memory/radar/switchboard-sticky-route-receipts.md, .github/harness/memory/radar/stuntd-shadow-promotion-and-drift-demotion.md

## Architecture Brief

### Objective

- Deliver an optional local SemIf decision sidecar that keeps Qwen3.5-4B resident, exposes a
  bounded System One-compatible HTTP surface, evaluates existing intent-profile candidates, and
  attaches a shadow-only, run-scoped advisory receipt for Copilot handoffs.

### Scope and boundaries

- In scope: a loopback Node daemon, a persistent Python SemIf worker, Choice/Score/Noul response
  mapping, health/readiness, request timeout and queue bounds, explicit uncertainty policy,
  disabled-by-default prompt-router advisory attachment, privacy-minimized receipts, deterministic
  mocks/tests, package commands, config, and concise operator guidance.
- In scope: shadow comparison with the deterministic intent recommendation; manual-first promotion
  eligibility and demotion signals as report-only pure policy functions.
- Out of scope: downloading model weights, installing SemIf or jevcompat, changing the selected
  Copilot UI model, proxying Copilot transport, tool approval, hosted-provider failover, automatic
  promotion, per-site distillation, a second dashboard, or replacing deterministic routing.

### Artifacts to create

- `scripts/harness/decision-sidecar.mjs` - loopback HTTP service, System One validation/mapping,
  bounded concurrency, health/readiness, and persistent worker client.
- `scripts/harness/semif-worker.py` - load one pinned SemIf model once and score JSONL requests over
  stdin/stdout.
- `scripts/harness/decision-policy.mjs` - explicit `matched | uncertain | unavailable` policy,
  redacted receipt construction, shadow windows, promotion eligibility, and demotion checks.
- `scripts/harness/decision-advisory.mjs` - build the intent-profile question, call the local
  sidecar with a timeout, compare with deterministic routing, and return a bounded advisory receipt.
- `scripts/harness/test/decision-sidecar-test.mjs` - public HTTP contract, validation, timing,
  queue/timeout, and health/readiness tests with an injected scorer.
- `scripts/harness/test/decision-policy-test.mjs` - uncertainty, deterministic short-circuit,
  receipt privacy, sticky decision, promotion, sampling, and drift-demotion tests.
- `scripts/harness/test/decision-advisory-test.mjs` - disabled, unavailable, matched, uncertain,
  and deterministic-route-preservation tests.

### Artifacts to modify

- `scripts/harness/prompt-router.mjs` - after `planTask`, optionally attach an advisory receipt;
  create/reuse the feature run first, reuse a valid run-scoped receipt, optionally attach its
  summary after `planTask`, persist its artifact reference, and never mutate profile, mode, stages,
  models, or rationale.
- `harness.config.json` - add disabled-by-default `modelPolicy.localDecisionSidecar` policy with
  loopback URL, timeout, thresholds, shadow lifecycle, receipt privacy, and RTX 5070 Ti candidate
  metadata.
- `package.json` - add sidecar start and focused test commands; include fast deterministic tests in
  the core harness suite.
- `.github/harness/HARNESS.md` - document the advisory-only local decision flow and proof gates.

### Key decisions

- Gate 1 - Domain/module alignment: PASS. Runtime transport and decision policy are new harness
  modules; deterministic stage routing remains in `prompt-router.mjs`.
- Gate 2 - Generality: PASS. The service and policy use provider-neutral typed decisions; SemIf is
  isolated behind the worker protocol.
- Gate 3 - Ownership: PASS. `planTask` owns routes, feature-run manifests own sticky run state, and
  the sidecar owns model lifetime only.
- Gate 4 - Boundary integrity: PASS. HTTP and Python details stay outside the router; the router
  receives only a bounded advisory receipt.
- Gate 4b - Isolation/safety: PASS with constraints. Bind loopback only, cap bodies and concurrency,
  omit raw prompts by default, reject malformed outputs, and fail open to deterministic routing.
- Gate 5 - Reuse: PASS. Reuse existing intent profiles, run IDs, feature-run artifacts, Python
  bridge conventions, and package test aggregation.
- Topology: Producer-Reviewer. Deterministic routing produces the authoritative route; SemIf
  independently reviews the semantic intent in shadow mode.
- The sidecar evaluates `routing.intentProfiles`; explicit profiles and deterministic task-class
  decisions are compared but never overridden.
- Receipt ownership: one `.github/harness/runs/feature-runs/<run-id>/decision-advisory.json` artifact
  per run. The feature-run manifest records it as `artifacts.decisionAdvisory`; handoff output names
  the receipt path when present. A repeated route, handoff, or prompt-pack command reuses the receipt
  without inference only when `taskHash`, `policyId`, `policyFingerprint`, `candidateFingerprint`,
  requested model, and requested revision still match. Only structurally valid `matched` and
  `uncertain` receipts are reusable; `unavailable` receipts remain diagnostic artifacts and are
  re-evaluated on the next invocation so daemon recovery needs no manual cache deletion.
- Receipt schema: `schemaVersion`, `advisoryId`, `runId`, `at`, `status`, `mode`, `site`, `taskHash`,
  `policyId`, `policyFingerprint`, `candidateFingerprint`, requested/resolved model identity,
  `outcome`, selected candidate/probability, top-two margin, bounded distribution, deterministic
  baseline identifiers, agreement, fallback reason, latency, and `sticky`. No raw task, state,
  instructions, credentials, or provider body is permitted. Serialized size is capped at 16 KiB.
- Disabled behavior: no HTTP call, no receipt, no new route field, and unchanged compact/JSON
  routing output. Enabled/unavailable behavior: preserve the deterministic route and attach/persist
  one `unavailable` receipt with a stable fallback reason; never throw from routing.
- The public compatibility surface is `/v1/systemone`; `/health` means process liveness and
  `/ready` means a scorer is loaded and accepting work.
- HTTP contract version 1: `POST /v1/systemone` accepts JSON `{model,state,questions}` with a 256 KiB
  body limit, at most 64 questions, 2-64 Choice options, and 2-10 Score levels. Success is
  `{model,answers,usage}`; validation failures are JSON 4xx, busy/expired requests are JSON 503, and
  worker failures are JSON 502. Answers preserve question and option order from the request.
- Version-1 questions are keyed by non-empty question IDs and use these exact shapes:
  - Noul: `{type:"noul", instructions?:JsonValue, criteria?:{false?:JsonValue,true?:JsonValue}}`.
  - Choice: `{type:"choice", instructions?:JsonValue, criteria:{[optionId]:JsonValue}}` with
    non-empty unique option IDs.
  - Score: `{type:"score", instructions?:JsonValue, criteria:JsonValue[]}`. Map-form Score criteria
    are rejected.
  - `state` and descriptive `JsonValue` fields accept JSON string, object, array, number, boolean,
    or null. The worker canonicalizes non-string descriptions with stable JSON serialization before
    constructing SemIf rows.
- Version-1 answers use these exact shapes and no unprefixed extension fields:
  - Noul: `{type:"noul", noul:number}` where `noul` is the probability of option `true`.
  - Choice: `{type:"choice", choice:string, probabilities:{[optionId]:number}, confidence:number}`.
  - Score: `{type:"score", score:number, legend:{[index]:JsonValue},
    probabilities:{[index]:number}, confidence:number}`.
  - `usage` is `{input_tokens:nonNegativeInteger, output_tokens:0}` and the response `model` is the
    resolved worker model identity.
- Numeric rules: all values are finite and each probability is in `[0,1]`; the sidecar normalizes
  positive worker scores and requires `abs(sum(probabilities)-1) <= 1e-6` after normalization.
  Choice is an argmax with request order breaking exact ties. Score is
  `sum(index * probability[index])`. Choice and Score confidence use
  `n == 1 ? 1 : clamp((n * maxProbability - 1) / (n - 1), 0, 1)`. Noul has no confidence field.
- Worker contract version 1: one UTF-8 JSON object per line. Input is
  `{version:1,id,row,maxTokens}`. Output is `{version:1,id,ok:true,result}` or
  `{version:1,id,ok:false,error:{code,message}}`. IDs correlate responses; duplicate or unknown IDs,
  lines over 1 MiB, malformed JSON, non-finite numbers, and out-of-order protocol violations make
  the worker unavailable.
- A successful worker `result` is
  `{option_ids:string[], probabilities:number[], input_tokens:nonNegativeInteger,
  model:{source:string,revision:string,backend:string,device:string,dtype:string},
  total_seconds?:nonNegativeNumber}`. `option_ids` must equal the submitted row option IDs in order,
  probability count must match, and model source/revision must match the ready frame.
- Worker lifecycle: startup completes only after a versioned `ready` frame containing model source,
  revision, backend, device, and dtype. Process exit or framing failure flips readiness false and
  fails queued work; there is no automatic restart in this slice. The operator restarts the daemon.
- Queue lifecycle: one model forward runs at a time, with configurable maximum queued requests and
  queue-wait timeout. A disconnected or expired queued HTTP request is removed before execution. A
  disconnect or timeout after execution starts cannot interrupt the model forward; its response is
  discarded and no receipt is emitted for that HTTP call.
- Confidence is never treated as portable. Policy uses the selected probability and top-two margin;
  calibration remains a separate workload gate.

### Constraints

- Preserve route output exactly when the sidecar is disabled.
- When enabled but unavailable, attach at most an `unavailable` advisory receipt and preserve the
  deterministic route.
- Use an abortable request timeout and a bounded in-flight queue; never wait indefinitely.
- Validate every probability as finite and in `[0, 1]`; distributions must sum to one within a
  declared tolerance.
- Do not log or persist raw task text, model input state, credentials, or full responses by default.
- The privacy statement applies to the new sidecar logs and advisory receipt only; existing harness
  route/run artifacts retain their current task-text behavior.
- Pin model source and revision in worker configuration and include resolved identity in receipts.
- Shadow mode is the only initial runtime mode. Promotion eligibility and demotion are reported,
  never enacted. Any live authority transition requires a separate Architecture Brief, labeled
  held-out evaluation, calibration, human approval, and rollback proof.
- A failed receipt write, shadow comparison, or demotion calculation must not fail routing.

### Validation plan

- Run focused sidecar, policy, and advisory tests and assert a non-zero check count.
- Test worker startup failure, process exit, malformed/oversized frames, request correlation,
  bounded queue rejection, queued expiry, disconnect-before-start, and discard-after-start.
- Test run-scoped receipt reuse and invalidation through repeated route, handoff, and prompt-pack
  calls, plus the 16 KiB allowlist bound and absence of raw task text.
- Run prompt-router run-bundle tests to prove route/manifests remain compatible.
- Run local-open-model policy and config self-tests.
- Run `npm run harness:docs:check` and `git diff --check`.
- Run `npm run test:harness:core` after focused checks pass.
- Run `jevcompat` later against a real local sidecar as an environment-gated acceptance check; do
  not make ordinary CI depend on Python packages or model weights.
- Record that real SemIf/CUDA latency, memory, calibration, and jevcompat evidence remain required
  before promotion beyond shadow mode.

### Do NOT

- Do not let SemIf select or rewrite the authoritative route in this slice.
- Do not put model loading, fetch logic, thresholds, or lifecycle state inside `prompt-router.mjs`.
- Do not spawn the Python worker per decision.
- Do not silently accept argmax, near ties, malformed distributions, or missing model identity.
- Do not install or vendor Ollaya, Discern, Switchboard, stuntd, or Jeview.
- Do not add multi-provider failover, a dashboard, public network binding, or automatic model pulls.
- Do not implement live promotion or state transitions from shadow policy calculations.
- Do not weaken graph, architecture, review, security, approval, or validation gates.

### Assumptions and risks

- `[UNVERIFIED]` SemIf's current Python API remains compatible with direct imports of
  `load_causal_model` and `direct.score`; if false, only `semif-worker.py` changes.
- `[UNVERIFIED]` Qwen3.5-4B BF16 fits and performs acceptably on the RTX 5070 Ti 16 GB; if false,
  use a measured quantized backend without changing the HTTP/policy contract.
- `[UNVERIFIED]` Python 3.11 or 3.12 with SemIf's pinned Torch stack will be installed in WSL2; if
  false, the deterministic mock still validates Node integration but live proof remains blocked.
- Intent-profile labels are sparse and may not yield useful accuracy. If the labeled shadow set
  cannot beat or complement deterministic routing, keep the sidecar advisory disabled.
- Protocol conformance and deterministic-route agreement do not prove semantic correctness; a
  labeled workload and held-out calibration remain mandatory before any authority change.
