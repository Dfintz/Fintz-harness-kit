---
name: review-breadth
description: Run the Review Breadth stage. Use when the changed scope needs a wide pass for correctness, standards, safety, completeness, and proof quality.
---

# /review-breadth

This is the Claude adapter for the harness **Review Breadth** stage.

The canonical contract lives in [`05-REVIEW-BREADTH.md`](../../../.github/instructions/05-REVIEW-BREADTH.md).

## Required inputs

- changed artifacts
- relevant standards and skill docs
- `architecture-brief.md`, if present
- `implementation-notes.md`

## Required output

- `.github/harness/memory/reviews/review-breadth-findings.md`
- artifact kind: **breadth-findings-ledger**

## Procedure

1. Run the context sufficiency check before judging the diff.
2. **Cover breadth requirements**: Review by lanes — requirement coverage, standards/policy,
   correctness/safety, operational soundness, proof quality, and semantic clarity. Breadth review
   catches gaps across dimensions; depth review (next stage) focuses on ownership and structure.
3. Check prose claims against shipped repo surfaces when the task touches harness docs, skills,
   loops, registry, or MCP wrappers.
4. Report findings by severity: Blocker / Major / Minor, with evidence and confidence.

---

## Recommended Models (Phase 5)

**Tier:** High-Reasoning  
**Primary:** `claude-opus-4-8` (Multi-Dimensional Analysis)  
**Fallback 1:** `claude-opus-5` (Ultra-Complex Cross-Cutting)  
**Fallback 2:** `gpt-5.5` (Fast Breadth Coverage)  
**Fallback 3:** `claude-haiku-4-5` (Universal Safety Net)

**Why?** Wide-pass review across correctness, standards, safety, completeness requires comprehensive multi-dimensional reasoning. Opus 4.8 proven strength. Alternative: Opus 5 for ultra-complex cross-cutting changes. Maintained +113.2% improvement. Phase 5 validation: consistent breadth coverage.

---

## Handoff contract

- Downstream consumers: Review Depth, Feedback
- Hand off a **findings ledger** grouped by Blocker / Major / Minor, not an unstructured review dump.

## Approval contract

Do not treat a missing approval step, weakened guardrail, or unsupported capability claim as a minor
issue; escalate it in the findings ledger.

