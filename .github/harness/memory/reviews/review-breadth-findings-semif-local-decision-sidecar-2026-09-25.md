---
artifact_family: review
immutability: frozen
immutable_since: 2026-09-25
---

# Review Breadth Findings: SemIf Local Decision Sidecar

## Coverage

Reviewed requirement coverage, repository policy, HTTP and worker correctness, privacy and denial of
service boundaries, operator lifecycle, Brief conformance, and proof quality. Inspected the approved
Brief, implementation summary, runtime modules, prompt-router integration, config, package commands,
documentation, and focused tests. An independent read-only reviewer pressure-tested the same scope.

## Blocker

### B1 - Receipt persistence could terminate deterministic routing

- **Artifact:** `scripts/harness/prompt-router.mjs`
- **Finding:** Advisory receipt read/write errors could escape or invoke the manifest allowlist's
  terminating failure path.
- **Evidence:** A receipt path replaced with a directory initially caused the router integration test
  to exit non-zero.
- **Impact:** Violated the Brief requirement that advisory persistence must never fail routing.
- **Confidence:** HIGH
- **Resolution:** FIXED. Non-file receipts are cache misses; receipt writes are guarded; attachment
  occurs only after persistence succeeds. The integration test now forces an `EISDIR` write failure
  and proves route exit zero with no advisory field.

## Major

### M1 - Late worker response poisoned readiness

- **Artifact:** `scripts/harness/decision-sidecar.mjs`
- **Finding:** Request timeout removed the correlation ID, so the legitimate late response was
  classified as an unknown ID and failed the worker.
- **Evidence:** Worker correlation and timeout paths used one pending map with no expired-ID state.
- **Impact:** Contradicted the Brief's discard-after-start lifecycle and caused unnecessary daemon
  restart.
- **Confidence:** HIGH
- **Resolution:** FIXED. A bounded expired-ID tombstone set discards one late response while still
  failing truly unknown or duplicate IDs. Regression test proves readiness and a later request.

### M2 - HTTP connection close did not cancel or discard work

- **Artifact:** `scripts/harness/decision-sidecar.mjs`
- **Finding:** Only incoming request abort was observed; response-side connection close after body
  upload was not connected to the queue signal.
- **Evidence:** The original handler installed `req.once("aborted")` after reading the body and did
  not inspect connection state before writing the result.
- **Impact:** Disconnected queued calls could consume capacity and active calls attempted a response
  the client could no longer receive.
- **Confidence:** HIGH
- **Resolution:** FIXED. Abort tracking begins before body parsing, observes response close, removes
  queued work, and discards completed active work. Regression test proves a later request proceeds.

## Minor

### N1 - Contract edge cases lacked direct proof

- **Artifacts:** focused sidecar and router tests
- **Finding:** Exact tie ordering, confidence on ties, resolved-model mismatch, disabled router
  exactness, and receipt write failure had no direct regression assertions.
- **Impact:** Correct behavior existed in some paths but could drift without detection.
- **Confidence:** HIGH
- **Resolution:** FIXED with focused HTTP and end-to-end assertions.

## Missing context

- Real SemIf packages and Qwen model weights are not installed in this Windows workspace.
- No live CUDA/VRAM/latency measurement, workload calibration, or jevcompat run was possible.
- These are explicit promotion gates, not blockers for the disabled shadow implementation.

## Breadth verdict

**PASS after repair.** No unresolved Blocker, Major, or Minor findings remain in the implemented
shadow slice. Live-model capability and semantic quality remain deliberately unclaimed.
