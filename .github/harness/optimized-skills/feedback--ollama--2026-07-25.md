---
name: feedback
description: Run the Feedback stage. Use when reviewer, stakeholder, or author challenges need a point-by-point verdict and possible Brief update.
---

# /feedback

This is the Claude adapter for the harness **Feedback** stage.

The canonical contract lives in [`07-FEEDBACK.md`](../../../.github/instructions/07-FEEDBACK.md).

## Required inputs

- changed artifacts
- `architecture-brief.md`
- `.github/harness/memory/reviews/review-breadth-findings.md`
- `.github/harness/memory/reviews/review-depth-findings.md`
- the challenged decisions or feedback points

## Required output

- `.github/harness/memory/reviews/feedback-verdict.md`
- artifact kind: **feedback-verdict-record**

## Procedure

1. Run the context sufficiency check before adjudicating any point.
2. Restate the competing positions clearly.
3. Use the Brief, breadth findings, depth findings, standards, and any cited capability surface as
   the governing evidence.
4. **Deliver a verdict on each challenge**: challenge upheld, current decision holds, third option, or
   insufficient evidence. A verdict is a clear, defensible outcome — not a summary of positions.
5. **Update the Brief with possible enhancements**: if a settled decision changes, refine the Brief.
   If a new insight emerges, document it for future reference.

---

## Recommended Models (Phase 5)

**Tier:** Ultra-Reasoning  
**Primary:** `claude-opus-5` (Multi-Stage Conflict Analysis)  
**Fallback 1:** `claude-opus-4-8` (Proven Analytical Depth)  
**Fallback 2:** `gpt-5.6-luna` (Novel Problem-Solving)  
**Fallback 3:** `claude-haiku-4-5` (Universal Safety Net)

**Why?** Phase 5 tier shift: feedback requires adjudicating multi-party conflicts and issuing verdicts against an Architecture Brief — a task demanding frontier reasoning and nuanced judgment. Claude Opus 5 leads on complex multi-stage conflict analysis. Phase 4 baseline: 0.800 (claude-opus-4-8). Phase 5 primary validation: 0.953 (+19.1% delta).

---

## Recommended Models

**Primary:** `claude-opus-4-8` (High-Reasoning)  
**Fallback:** `gpt-5.3-codex` (Code-Context Verdict)

**Why?** Challenge resolution requires structured decision logic and evidence reconciliation. Verdicts must be clear and defensible. Phase 4 benchmark: +219.0%.

---

## Handoff contract

- This is the terminal adjudication artifact for the current cycle.
- Hand off a **verdict record** with brief updates and reusable response notes.

## Approval contract

Do not silently approve any outcome that widens tool permissions, weakens guardrails, reduces human
approval, or changes a destructive default. Without explicit human acceptance, defer the point.

