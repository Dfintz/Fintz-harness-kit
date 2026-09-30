---
artifact_family: challenge
immutability: frozen
immutable_since: 2026-09-29
---

# Architect Challenge Verdict: ATDD-Style Acceptance-First Validation Planning in Architect

Brief: `.github/harness/memory/briefs/dave-farley-atdd-acceptance-first-architect-2026-09-29.md`

## VERDICT: APPROVED

## Gate-by-gate pressure test

- **Gate 1 (domain alignment):** PASS. Validation planning already lives in Architect
  (Step 4 / Output contract "Validation plan") and in `deterministic-validation`. The Brief
  reinforces existing ownership rather than introducing a new home for the concept.
- **Gate 2 (generality):** PASS. The guidance is phrased as advisory ("should") and scoped to
  "testable changes ... where no existing check already covers the exit criteria" — it does not
  target a one-off task.
- **Gate 3 (ownership):** PASS. Architect owns the Brief's Validation plan section;
  `deterministic-validation` owns proof mechanics and already lists `acceptance-gate.mjs` as one
  proof source. No ownership is being moved, only a sequencing preference stated more explicitly.
- **Gate 4 (boundary integrity):** PASS, with a note. Having Architect *draft* an acceptance-gate
  spec (scaffold + baseline) is still spec-authoring, not implementation — `acceptance-gate.mjs`
  is explicitly designed for a scaffold → baseline (red) → verify (green) lifecycle, so a
  pre-Implement scaffold/baseline is consistent with the tool's own design, not scope creep into
  execution. Confirmed by reading `scripts/harness/acceptance-gate.mjs` usage text (`scaffold`,
  `verify --file`, `baseline --file`) — the tool already assumes the spec exists before the
  red-baseline check, i.e., before Implement.
- **Gate 5 (reuse):** PASS. Verified independently: `03-ARCHITECT.md` contains no existing
  reference to `acceptance-gate.mjs` or acceptance-first sequencing (full file read, ~230 lines).
  `deterministic-validation/SKILL.md` mentions the tool only as a fallback proof source without
  stating *which stage* should draft it (full file read). The proposed edits are additive, not
  duplicative, and reuse the existing scaffold/baseline/verify tool rather than forking it.

## Redundancy / contradiction check

- No existing text in either target file states when (which stage) an acceptance-gate spec should
  be authored — confirmed by direct read of both files. The addition is a genuine gap-fill, not a
  restatement.
- No contradiction found: the Brief keeps validation-plan flexibility (tests/lint/build/approvals
  remain valid) and does not raise Architect's Step 4 "validation or proof required" language to a
  hard requirement.
- All three commands cited in the Brief's own Validation plan exist and are wired in
  `package.json`: `harness:docs:check` → `validate-doc-contracts.mjs`,
  `harness:memory:references:check` → `check-memory-references.mjs`,
  `harness:acceptance` → `acceptance-gate.mjs`. No invented tooling.
- Radar-closure discipline is correct: the Brief's own "Do NOT" section blocks marking the radar
  entry `adopted` until the doc edits land and pass Review Depth/Feedback, avoiding a premature
  status flip — checked against the current radar file's `status: candidate`.

## Blocking concerns

None. No missing context, no scope creep into code/tooling, no gate failure, no reuse violation.

## Non-blocking suggestions

1. The Brief's own Validation plan leans on a manual read-through for coherence, while
   `deterministic-validation`'s own preferred-proof table lists "Markdown diagnostics + SkillSpector
   static scan" for skill-doc changes. Implement may swap or supplement the manual step with that
   static scan if convenient — not required, since doc-contract linting already covers structural
   drift.
2. When editing `03-ARCHITECT.md`, keep the inserted language unambiguously advisory ("should
   draft," not "must draft") so Review Depth doesn't need to adjudicate whether Step 4 silently
   became a hard gate for all non-trivial tasks.
3. Confirm the radar entry's Decision Log row and `status: adopted` edit are made in the *same*
   Implement pass as the doc edits (not a separate follow-up), to avoid an interim state where the
   radar says `adopted` while the guidance isn't actually present yet, or vice versa.
