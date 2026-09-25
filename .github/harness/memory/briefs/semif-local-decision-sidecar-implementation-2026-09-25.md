# SemIf Local Decision Sidecar Implementation Summary

## Scope

Implemented the approved shadow-only local decision advisor without changing deterministic route
authority. The delivered slice includes the loopback daemon, persistent SemIf worker protocol,
uncertainty and lifecycle policy, prompt-router advisory integration, sticky privacy-minimized
receipts, configuration, operator documentation, and deterministic tests.

## Delivered artifacts

- `scripts/harness/decision-policy.mjs`: distribution validation, uncertainty thresholds, bounded
  receipts, deterministic sampling, and report-only promotion/demotion windows.
- `scripts/harness/decision-sidecar.mjs`: loopback System One HTTP service, bounded queue, worker
  lifecycle, framing limits, disconnect handling, and Choice/Score/Noul mapping.
- `scripts/harness/semif-worker.py`: one-time pinned model load and versioned JSONL scoring worker.
- `scripts/harness/decision-advisory.mjs`: intent-profile request construction, timeout, comparison,
  and `matched | uncertain | unavailable` receipts.
- `scripts/harness/prompt-router.mjs`: disabled-by-default attachment plus run-scoped receipt
  persistence and reuse. Advisory failures do not mutate or terminate deterministic routing.
- Focused policy, HTTP, worker, advisory, and router integration tests.
- `modelPolicy.localDecisionSidecar`, package commands, and operator guidance.

## Review repairs

- Receipt read/write failures now fail open and leave the deterministic route usable.
- Timed-out worker response IDs use bounded tombstones, so a legitimate late result is discarded
  without poisoning worker readiness.
- HTTP disconnects cancel queued work; active model work completes but its response is discarded.
- Exact Choice ties, model identity mismatch, disabled-path exactness, sticky reuse, privacy bounds,
  unavailable fallback, and write failure are covered by regression tests.

## Proof summary

- `npm run test:harness:decision-sidecar`: PASS. Policy 5/5, HTTP and worker 9/9, advisory 6/6,
  plus router integration.
- `npm run test:harness:prompt-router:run-bundle`: PASS.
- `npm run harness:config:self-test`: PASS.
- `npm run test:harness:local-open-model-policy`: PASS.
- `npm run harness:docs:check`: PASS.
- `$env:HARNESS_PROJECT_ROOT=$PWD.Path; npm run test:harness:core`: PASS.
- `git diff --check`: PASS before review repair; rerun in final validation.

## Self-review

- The deterministic router remains the only route owner.
- The sidecar is loopback-only, disabled by default, and shadow-only.
- Receipts omit raw task text and are capped at 16 KiB.
- No automatic promotion, provider failover, dashboard, model download, or Copilot transport/UI
  switching was introduced.
- Real SemIf/CUDA latency, VRAM, calibration, and jevcompat conformance remain unverified and are
  still required before any authority change.
