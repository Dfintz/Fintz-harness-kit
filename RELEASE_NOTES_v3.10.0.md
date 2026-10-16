# Release Notes v3.10.0

Date: 2026-10-16

## Summary

v3.10.0 adds a hosted System One backend to the decision sidecar. Microsoft-Decision-1 on
Microsoft Foundry is the default provider, and TypeSafe Jev is selected whenever
`TYPESAFE_API_KEY` is set. The backend is for independently invoked shadow evaluation only: the
committed `modelPolicy.localDecisionSidecar` stays disabled, in shadow mode, and frozen, so routing
authority is unchanged.

## Highlights

- New `scripts/harness/decision-backend-systemone.mjs` and launcher
  `npm run harness:decision:sidecar:hosted`.
- One provider resolver chooses the provider in this order: `HARNESS_DECISION_HOSTED_PROVIDER`
  override, then `TYPESAFE_API_KEY` (Jev), then `HARNESS_DECISION_FOUNDRY_ENDPOINT` (Decision-1).
  With none set, the backend refuses to start. There is no cross-vendor failover.
- Foundry authentication prefers Entra ID through the Azure CLI. The token is acquired once at
  startup and refreshed in the background, never inside a request. If Entra is unavailable at
  startup, `AZURE_DECISION_API_KEY` is used instead. The auth mode is fixed for the session and
  recorded in metadata without the secret.
- Each row is sent as one hosted `choice` question. Responses are strictly validated: option ids
  must match exactly, values must be finite and non-negative, and total mass must be positive.
  Results are returned in row order for `choice`, `score`, and `noul`.
- Hosted endpoints must use `https:`. Upstream calls time out after 1200 ms, and an optional
  sidecar `requestDeadlineMs` (hosted default 1400 ms) bounds the whole request, including queue
  wait. Deadline and client aborts are propagated to the scorer as `{ signal }`.
- Receipts identify the provider and model as `foundry:<deployment>` or `jev:<model>`, together
  with the revision and auth mode. Unpinned hosted revisions keep promotion blocked. A pinned Jev
  model whose identity changes fails closed.

## Fixes

- `SemifWorkerClient.score` now takes an options object, so the new `{ signal }` argument cannot
  corrupt `maxTokens` on the default local backend. A regression test was proven red, then green.

## Validation

- `npm run test:harness:decision-backend-systemone` (mocked fetch and token provider, no network)
- `npm run test:harness:decision-sidecar`, including the freeze test (7 invariants plus a
  negative control)
- `npm run harness:docs:check` and staged whitespace checks
- An independent Architect Challenge and code review. Their findings and dispositions are recorded
  in `.github/harness/memory/briefs/decision-1-hosted-adapter-2026-10-16.md`.

## Compatibility And Limits

- No live Foundry or TypeSafe call was made; all tests are mocked. Decision-1 and Jev calibration
  against human-labelled cases is still outstanding, and the freeze unlock criteria are unchanged.
- Using the hosted backend sends task text to Azure or TypeSafe. The operator approved this egress
  for shadow evaluation only.
- Hosted errors other than timeouts and aborts surface as sidecar `internal_error` responses.
- No Snyk Code scan was run: the Snyk MCP was not authenticated. SonarQube findings in the new
  backend were addressed; existing complexity findings in the sidecar remain.
- Pre-existing local decision-model bakeoff work, routing-config changes, and generated artifacts
  are not part of this release.
