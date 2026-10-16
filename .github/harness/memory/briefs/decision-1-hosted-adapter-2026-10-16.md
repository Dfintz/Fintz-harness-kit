# Hosted System One Decision Backend (Decision-1 default, Jev when keyed)

resource: scripts/harness/decision-backend-systemone.mjs, scripts/harness/decision-sidecar.mjs, scripts/harness/test/decision-backend-systemone-test.mjs, package.json, .github/harness/memory/radar/microsoft-decision-1-foundry-default.md, .github/harness/memory/briefs/jev-decision-sidecar-freeze-2026-09-25.md

## Architecture Brief

### Objective

Add a hosted System One scorer to the decision sidecar so the harness can evaluate
Microsoft-Decision-1 on Microsoft Foundry as the default hosted decision model, switching to
TypeSafe Jev whenever `TYPESAFE_API_KEY` is present. This slice delivers the adapter, central
provider resolution, and live-eval support. It does **not** enable the sidecar, change routing
authority, or lift the local-model freeze.

### Context sufficiency

| Artifact | Contains | Surface |
| --- | --- | --- |
| `scripts/harness/decision-sidecar.mjs` | Loopback daemon, System One request validation, scorer contract, backend selection | runtime |
| `scripts/harness/decision-backend-openai.mjs` | Reference scorer (`start`/`ready`/`metadata`/`score`/`close`) | runtime |
| `scripts/harness/decision-advisory.mjs` | Router-side client; loopback-only, no auth | runtime (unchanged) |
| `scripts/harness/decision-eval.mjs` | Live eval via `--endpoint` against a sidecar | eval (unchanged) |
| `harness.config.json` `modelPolicy.localDecisionSidecar` | Frozen, disabled, shadow | config (unchanged) |
| Decision-1 / TypeSafe API docs | `POST …/systemone`, choice/score/noul, Bearer or `api-key` | external |

> **Scope:** software (harness runtime)
> **Primary boundary:** decision sidecar backend layer

Missing: a live Foundry deployment and credentials. Live calls are `[UNVERIFIED]`; all proof in this
slice uses an injected `fetch`.

### Gate 1 — Domain alignment

The behavior is "turn one System One row into a probability distribution", which is exactly the
sidecar scorer contract. The adapter lives beside `decision-backend-openai.mjs` as
`decision-backend-systemone.mjs`. No routing or policy code changes.

### Gate 2 — Boundary / ownership

- Router → sidecar stays loopback-only (`decision-advisory.mjs` untouched). The hosted hop exists
  only inside the sidecar process, so the advisory's safety property is unchanged.
- Credentials are read only by the sidecar process from the environment, never written to receipts,
  logs, errors, or `metadata()`.
- Hosted endpoints must be `https:`; plain `http:` is accepted only for loopback (tests).

### Gate 3 — Reuse

- Reuse `rowsFromSystemOneRequest`, `normalizeWorkerResult`, and `answerFrom` in the sidecar. The
  adapter sends each row upstream as one `choice` question whose criteria are the row's option ids
  and canonical descriptions, then returns probabilities in row order. This works for
  `choice`, `score`, and `noul` rows without a type-specific upstream mapping.
- Mirror `OpenAiLogprobScorer` error and timeout shape (`BackendError` codes).

### Gate 4 — Provider resolution (single source of truth)

`resolveHostedDecisionProvider(env)` is pure and exported:

1. `HARNESS_DECISION_HOSTED_PROVIDER` set to `jev` or `foundry` → explicit override (fails closed if
   that provider's requirements are missing).
2. Non-empty `TYPESAFE_API_KEY` → `jev`.
3. `HARNESS_DECISION_FOUNDRY_ENDPOINT` set → `foundry` (Decision-1 is the default).
4. Otherwise → `null` (backend refuses to start; no silent fallback).

There is **no** runtime cross-vendor failover: a failing Jev call never falls back to Foundry or vice
versa, because that would mix two models' distributions under one receipt identity.

### Gate 5 — Auth

- Jev: `Authorization: Bearer $TYPESAFE_API_KEY`, endpoint `https://api.typesafe.ai/v1/systemone`
  (overridable by `HARNESS_DECISION_JEV_ENDPOINT`), model `HARNESS_DECISION_JEV_MODEL`
  (default `jev-latest`, which records revision `hosted-unpinned`).
- Foundry: Entra ID preferred via the Azure CLI token for scope
  `https://cognitiveservices.azure.com/.default`, acquired at `start()` and refreshed before expiry
  outside the request path where possible. If Entra is unavailable and `AZURE_DECISION_API_KEY` is
  set, fall back to the `api-key` header. Auth mode is recorded in `metadata()` (mode only, never the
  secret). Endpoint `HARNESS_DECISION_FOUNDRY_ENDPOINT` + `/providers/microsoft/v1/systemone`,
  deployment `HARNESS_DECISION_FOUNDRY_DEPLOYMENT` (default `Microsoft-Decision-1`).

### Artifacts to create

- `scripts/harness/decision-backend-systemone.mjs` — `resolveHostedDecisionProvider`,
  `HostedSystemOneScorer`.
- `scripts/harness/test/decision-backend-systemone-test.mjs` — mocked-fetch tests.

### Artifacts to modify

- `scripts/harness/decision-sidecar.mjs` — accept `--backend systemone`; construct the hosted scorer.
- `package.json` — `test:harness:decision-backend-systemone`, add it to `test:harness:decision-sidecar`,
  and `harness:decision:sidecar:hosted`.
- Radar entry decision log; operator notes for the hosted backend.

### Key decisions

- Model identity in receipts: `source` = `foundry:<deployment>` or `jev:<model>`; `revision` =
  `HARNESS_DECISION_REVISION` or `hosted-unpinned`. Unpinned hosted revisions block promotion, same
  as `local-unpinned`.
- If a Jev response reports a `model` different from a pinned (non-`latest`) configured model, the
  scorer fails closed (`model_identity_changed`). Foundry responses report the base model name rather
  than the deployment, so their `model` field is recorded but not compared.
- Default hosted request timeout is 1200 ms, below the 1500 ms advisory budget.
- Response validation: every row option id must appear in `answers.<qid>.probabilities` with a finite,
  non-negative value and positive total mass; extra ids are rejected.

### Architect-challenge resolutions (gpt-6-sol, verdict REVISE → resolved)

1. **Truthful receipt identity.** Hosted scorer `metadata()` reports `source`
   (`foundry:<deployment>` / `jev:<model>`), `revision`, `backend: "hosted-systemone"`, `provider`,
   `authMode` (`entra` / `api-key` / `bearer`), and `revisionPinned`. Hosted live eval must pass
   `--model <source> --revision <revision>` to `decision-eval` so `requestedModel` never claims Qwen.
   A configured `HARNESS_DECISION_REVISION` is an operator label, not proof of immutability;
   `revisionPinned` is true only for Jev models with an explicit non-`latest` version where the
   response `model` matches. Foundry revisions are always recorded as unpinned
   (`hosted-unpinned` unless labelled), so promotion stays blocked.
2. **End-to-end deadline.** `createDecisionSidecar` gains an optional `requestDeadlineMs`. When set,
   one timer covers the queue wait, every row, and parsing; on expiry it aborts the request
   controller and returns `504 deadline_exceeded`. The sidecar passes `{ signal }` as the second
   argument to `scorer.score(row, { signal })`; the hosted scorer links that signal into its
   `fetch`, so work cancelled by the advisory or deadline stops upstream. Hosted CLI default
   deadline: 1400 ms. The 1500 ms advisory budget is unchanged.
3. **Bounded token handling.** The Entra token is acquired once in `start()` with a 15 s bound
   (startup, not request path). It is cached with its expiry and refreshed in the background when
   within 5 minutes of expiry. If the cached token is expired at request time, `score` fails closed
   with `auth_expired` and never runs the CLI inside a request. Auth mode is fixed at `start()`;
   a refresh failure never switches mode mid-session.
4. **Row mapping proof.** Tests cover `choice`, ordinal `score`, and boolean `noul` rows through the
   sidecar HTTP surface with a mocked upstream. They also cover missing, extra, or mismatched answer
   ids, a wrong question id, and non-finite or negative values. Probabilities are returned in the
   original row order; the upstream `choice` field is ignored.
5. **Freeze boundary.** The `harness:decision:sidecar:hosted` launcher exists only for independently
   invoked shadow evaluation. It does not change `harness.config.json`, and no router code path
   selects the hosted backend. The freeze test runs unchanged in the aggregate suite.

### Operator usage (shadow evaluation only)

```powershell
# Decision-1 on Foundry (default). Entra via `az login`; api-key used only if Entra fails at startup.
$env:HARNESS_DECISION_FOUNDRY_ENDPOINT = "https://<resource>.services.ai.azure.com"
$env:HARNESS_DECISION_FOUNDRY_DEPLOYMENT = "Microsoft-Decision-1"   # optional
# $env:AZURE_DECISION_API_KEY = "<key>"                              # optional fallback

# Jev takes over automatically when a TypeSafe key exists (pin a version, not jev-latest)
# $env:TYPESAFE_API_KEY = "<key>"; $env:HARNESS_DECISION_JEV_MODEL = "jev-1.13.0"

# Force one provider regardless of keys: HARNESS_DECISION_HOSTED_PROVIDER = jev | foundry
npm run harness:decision:sidecar:hosted
```

Live eval: `npm run harness:decision:eval -- --repo-root . --endpoint http://127.0.0.1:11437 --model <source> --revision <revision>`
using the `source`/`revision` printed by the sidecar's ready line so receipts never claim the local model.

### Implementation evidence (2026-10-16)

| Check | Result |
| --- | --- |
| `npm run test:harness:decision-backend-systemone` | 11/11 pass (mocked fetch, injected token provider) |
| `npm run test:harness:decision-sidecar` | all suites pass; freeze test 7 invariants + negative control |
| Config defaults | `localDecisionSidecar` unchanged (disabled, shadow, frozen) |

### Review and feedback (2026-10-16)

| Finding | Source | Disposition |
| --- | --- | --- |
| Foundry URL missing `/providers/microsoft/v1/systemone` | Implement test | Fixed; covered by test |
| Windows `az` is `az.cmd`; `execFile` without a shell never ran it, silently forcing api-key fallback | Self-review | Fixed (`shell` on win32, constant args only) |
| `{ signal }` second argument broke `SemifWorkerClient.score(row, maxTokens)` for the default backend | Review Breadth | Fixed (options object); regression test proven red → green |
| Nested ternaries, regex backtracking, un-awaited refresh, `score` complexity | SonarQube | Fixed in new backend; complexity in pre-existing sidecar functions left as-is |
| Hosted `BackendError` codes other than timeout/abort surface as 500 `internal_error` | Self-review | Accepted for shadow slice; revisit with live receipts |
| Snyk code scan | Tooling | Not run: Snyk MCP unauthenticated |

### Constraints

- `modelPolicy.localDecisionSidecar` stays `enabled: false`, `mode: shadow`, frozen. Freeze test must
  pass unchanged.
- No new npm dependencies.
- No network in tests.

### Validation plan

- `npm run test:harness:decision-backend-systemone` — resolver precedence, both auth modes, https
  enforcement, response validation, timeout, no-secret-leak, identity pinning.
- `npm run test:harness:decision-sidecar` — full aggregate including freeze test.
- `npm run harness:docs:check`, `git diff --check`, Snyk code scan, SonarQube file analysis.

### Do NOT

- Do not touch `decision-advisory.mjs` loopback enforcement.
- Do not flip `enabled`, `mode`, or `freeze` in config.
- Do not add cross-vendor failover.
- Do not log, return, or persist credentials or raw task text.

### Assumptions and risks

- `[UNVERIFIED]` Decision-1 `choice` answers return a `probabilities` map keyed by option id, as
  documented. Mitigation: strict validation fails closed.
- Hosted latency may exceed 1200 ms from some regions; shadow receipts will show `unavailable`
  rather than wrong answers.
- Hosted egress of task text was approved by the operator for shadow evaluation on 2026-10-16.
