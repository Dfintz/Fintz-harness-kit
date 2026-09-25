---
artifact_family: review
immutability: frozen
immutable_since: 2026-09-25
---

# Feedback Verdict Record: SemIf Local Decision Sidecar

## Point-by-point verdicts

| # | Feedback point | Verdict | Evidence used | Confidence | Action |
| --- | --- | --- | --- | --- | --- |
| 1 | Unavailable receipts should remain sticky when identity is unchanged. | Challenge upheld | Depth D1 and daemon recovery lifecycle | HIGH | Persist for diagnostics but retry on every invocation. |
| 2 | Identity equality alone is sufficient for receipt reuse. | Challenge upheld | Depth D2 and corrupted-state boundary | HIGH | Require a structurally valid scored result before reuse. |
| 3 | Device/dtype must be compared on every worker response. | Current decision holds | Approved worker contract and immutable ready identity | MEDIUM | Keep source/revision response check; real runtime proof remains a promotion gate. |
| 4 | Receipt profile fields violate the stated privacy boundary. | Current decision holds | Brief limits privacy promise to raw task/state/secrets; feature-run manifests already retain task text | HIGH | No schema change. |

## Accepted changes

- Restrict sticky reuse to valid `matched` and `uncertain` receipts.
- Treat unavailable and malformed receipts as cache misses.
- Update the Brief and operator guidance to state outage retry behavior.
- Add direct reuse-shape regression tests.

## Rejected challenges

- No new mutable worker identity protocol was added without evidence of an upstream runtime mutation.
- No removal of shadow distributions or baseline profile evidence; they are required for comparison
  and do not contain raw task text.

## Deferred points

- Live SemIf import compatibility, Qwen CUDA fit, latency, VRAM, calibration, and jevcompat remain
  unverified until the WSL2/Python/model environment exists.
- Any authority transition remains a separate Brief and human approval decision.

## Brief updates

- Sticky reuse now explicitly excludes `unavailable` receipts.
- Structurally invalid receipts are cache misses.
- Constraints and Do NOT rules are otherwise unchanged.

## Response notes

The sidecar remains disabled, shadow-only, and advisory. Temporary outage evidence is retained, but
recovery no longer requires manual deletion. Deterministic routing remains authoritative on every
path.

## Final verdict

**ACCEPTED.** The implementation conforms to the updated Brief and all review findings are resolved
within the shadow slice.
