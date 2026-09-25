# Architect Challenge — Jev Lite Decision Sidecar (Windows + WSL2 + GPU)

Brief under review: `.github/harness/memory/briefs/jev-lite-decision-sidecar-windows-wsl2-2026-09-25.md`
Parent brief: `.github/harness/memory/briefs/semif-local-decision-sidecar-2026-09-25.md`
Challenger role: distinct from the architect role per the printed route.

## Challenges

| # | Challenge | Severity | Resolution |
|---|---|---|---|
| 1 | A 20-option ceiling makes `/v1/systemone` behavior backend-dependent while the contract advertises 64 Choice options. | MEDIUM | Accepted. The ceiling is a `top_logprobs` limit of the upstream API, not a harness choice. It fails loudly with `unsupported_option_count`, the router fails open, and the limit is published as a config capability field so an operator can see it before enabling. |
| 2 | `revision: "local-unpinned"` contradicts the parent brief constraint "pin model source and revision in worker configuration". | HIGH | Accepted with condition. It must be explicit, carried in the receipt, and named a promotion blocker — all three are already in the brief. Condition added: the lite backend must emit a one-line startup warning when revision is unpinned, so the operator cannot acquire it silently. |
| 3 | `/ready` semantics diverge from the parent brief, which defines ready as "a scorer is loaded and accepting work". A `/v1/models` probe proves reachability, not residency. | MEDIUM | **REVISE.** Silent divergence on a readiness contract is not acceptable. Fix: add an opt-in `--warmup` flag that issues one 1-token scoring request at startup so `/ready` regains its parent meaning, keep it **off by default** so the sidecar never forces a model load, and state the divergence in `/ready` output rather than leaving it implicit. |
| 4 | Single-token label scoring has uncorrected position bias, so probabilities are not calibrated. | LOW (in this slice) | Accepted. The parent brief already makes labeled calibration a precondition for leaving shadow mode, and this brief adds no authority. The bias is recorded as a known risk, not hidden. |
| 5 | Sharing one model server between the coding loop and the decision sidecar creates head-of-line blocking. | LOW | Accepted at shadow volumes. The existing bounded queue plus 1500 ms advisory timeout degrade to an `unavailable` receipt rather than stalling routing. |
| 6 | Does the lite edition justify existing at all, or is it duplicate machinery? | — | Justified. It removes the Python/Torch/CUDA install, the second resident model, and the weights download — the three things that actually blocked local adoption. It adds one module and reuses every validator, mapper, policy, and test path. |

## Required revisions

1. Add opt-in `--warmup` (default off) and make `/ready` state whether residency was verified.
2. Emit a startup warning when `revision` is unpinned.
3. Publish the option ceiling as a config capability field.

## VERDICT: REVISE

Blocking concern is #3. Concerns #1, #2, and #6 are resolved. #4 and #5 are accepted risks already
governed by the parent brief's shadow-mode constraints. Apply the three required revisions and the
brief is approved for Implement.
