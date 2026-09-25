---
artifact_family: review
immutability: frozen
immutable_since: 2026-09-25
---

# Review Depth Findings: SemIf Local Decision Sidecar

## Context

Reviewed the approved Brief, implementation summary, repaired breadth ledger, runtime modules,
router integration, tests, configuration, and operator documentation. Traced deterministic route
selection through feature-run creation, advisory identity, HTTP/worker scoring, uncertainty policy,
receipt persistence/reuse, and all documented failure paths.

## Gate ledger

| Path | Gate 1 | Gate 2 | Gate 3 | Gate 4 | Gate 4b | Gate 5 | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Router to advisory | Pass | Pass | Pass | Pass | Pass | Pass | Router owns routes; advisory only returns a receipt and cannot mutate profile, mode, stages, models, or rationale. |
| Advisory to policy | Pass | Pass | Pass | Pass | Pass | Pass | Config-driven candidates and thresholds terminate in pure policy functions. |
| HTTP to worker | Pass | Pass | Pass | Pass | Pass | Pass | Loopback, body/question/framing/queue bounds, model identity, disconnect cleanup, and explicit readiness remain inside the daemon. |
| Feature-run receipt | Pass | Pass | Pass | Pass | **Fail** | Pass | Run owns persistence, but an unavailable receipt is reusable indefinitely and can suppress recovery. |
| Promotion lifecycle | Pass | Pass | Pass | Pass | Pass | Pass | Eligibility/demotion are pure report-only functions with no authority transition caller. |

## Structural findings

### Major D1 - Unavailable receipts suppress sidecar recovery

- **Gate:** 4b, lifecycle and recovery boundary
- **Artifacts:** `scripts/harness/decision-advisory.mjs`, `scripts/harness/prompt-router.mjs`
- **Finding:** `isReusableDecisionReceipt` treats `unavailable` exactly like a scored receipt. With
  unchanged task, policy, candidates, model, and revision, a temporary outage remains sticky after
  the daemon recovers.
- **Evidence:** Router skips evaluation whenever identity fields match; receipt status is not part of
  reuse eligibility.
- **Impact:** Operators must delete the artifact or perturb policy to recover, which contradicts the
  daemon's ordinary restart lifecycle. Deterministic routing remains safe, so this is Major rather
  than Blocker for the disabled shadow slice.
- **Confidence:** HIGH
- **Recommended fix:** Persist unavailable receipts for diagnostics but never reuse them. Restrict
  sticky reuse to structurally valid `matched` and `uncertain` receipts. Update the Brief and tests.

### Minor D2 - Receipt reuse validates identity but not usable shape

- **Gate:** 4b, corrupted-state boundary
- **Artifact:** `scripts/harness/decision-advisory.mjs`
- **Finding:** A manually truncated or partially migrated receipt can satisfy identity checks while
  lacking a valid status or outcome.
- **Impact:** Router output can attach an incomplete advisory object until the artifact is removed.
- **Confidence:** HIGH
- **Recommended fix:** Require status `matched` or `uncertain`, outcome equal to status, and a finite
  selected probability and margin before reuse.

## Challenges considered and rejected

- Worker device/dtype mutation is not a structural defect in this slice: the worker constructs one
  immutable model identity after load, and the approved contract requires source/revision equality.
- Profile/distribution fields in receipts are intentional shadow evidence, while existing feature-run
  manifests already persist raw task text. The Brief's privacy promise applies to the new receipt,
  not the entire run directory.
- Active disconnect response handling is covered: the handler checks the abort signal before setting
  headers or writing, and a regression test cancels after scorer entry.

## Brief conformance

All artifact ownership, shadow-only authority, loopback, privacy, queue, worker, uncertainty,
report-only promotion, and Do NOT constraints pass. D1 exposes a recovery flaw in the Brief's broad
sticky-reuse wording and requires Feedback adjudication plus a narrow Brief update.

## Depth verdict

**REVISE.** Resolve D1 and D2, rerun the focused suite, and then repeat the affected Gate 4b path.
