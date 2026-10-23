---
summary: Pinned SkillSpector scan is partial with DO_NOT_INSTALL; source-only comparison designed, but adoption and pilot execution remain blocked.
status: parked
source: https://github.com/cloudflare/security-audit-skill
author_project: Cloudflare / security-audit-skill
captured: 2026-10-22
tags: [security, audit, review-breadth, evidence, external-skill]
---

# Cloudflare Security Audit Skill

## Technique Summary

The skill coordinates source reconnaissance, coverage-led investigation, independent candidate
validation, structured findings, final record verification, and reporting. It distinguishes
`confirmed`, `needs_validation`, and `rejected` records, keeps unresolved coverage visible, and
revalidates prior evidence against current source instead of assuming repeated runs are complete.
Guidance mode supports focused questions; the six-phase audit requires an explicit audit request.

## Source Evidence

- Reviewed upstream revision: [c1c8a8c1471069fb0e188eeaff69b8e8db6564a8](https://github.com/cloudflare/security-audit-skill/tree/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8).
- Inspected the README, [skill contract](https://github.com/cloudflare/security-audit-skill/blob/c1c8a8c1471069fb0e188eeaff69b8e8db6564a8/skills/security-audit/SKILL.md), AI/LLM companion, validation/reporting instructions, report schema, findings-validator source, and license. This was an integration evaluation, not a complete security audit of upstream.
- Upstream includes Node.js validators and tests. Validator success checks structure and consistency, not whether a security claim is true; upstream tests and audit agents were not executed here.
- MIT licensed. Any future redistribution of substantial upstream material must retain its license and copyright notice. The pinned source was acquired outside the workspace for scanning; no upstream skill was installed or published. A generated public-source scan report is retained as evidence.

## Repository Relevance

Existing threat modeling, cross-model review, differential scanner evidence, and security gates
already cover much of the orchestration. The useful addition is more explicit coverage and
candidate-verification evidence, especially for MCP authority, persistent memory, retrieval,
tool arguments, approval binding, and model-output handling.

| Existing owner | Potential contribution | Boundary to preserve |
| --- | --- | --- |
| [Understand](../../../instructions/02-UNDERSTAND-WORKFLOW.md) | Map principals, trust boundaries, input surfaces, and scoped coverage units. | Direct source evidence and graph freshness remain authoritative. |
| [Breadth review](../../../instructions/05-REVIEW-BREADTH.md) | Add optional security-domain coverage and source-traced candidate records. | Supplement the safety lane; do not add a replacement workflow stage. |
| [Doubt-driven development](../../../skills/doubt-driven-development/SKILL.md) and [Depth review](../../../instructions/06-REVIEW-DEPTH.md) | Use a fresh verifier to attempt to refute each candidate and its claimed impact. | Retain the harness's fixed-model and cross-model requirements; record actual verifier independence. |
| [Feedback](../../../instructions/07-FEEDBACK.md) and [security review gate](../../../../scripts/harness/security-review-gate.mjs) | Adjudicate validated evidence and keep unresolved facts separate from confirmed defects. | Preserve human approvals and existing scanner/review acceptance conditions. |

The existing [Hermes checklist](hermes-security-evidence-checklist.md) and
[differential-scanning entry](openai-codex-security-differential-scanning.md) already own scanner
evidence. Cloudflare would complement Snyk, SonarQube, and Lurkr, not replace them. Its findings
array is not the security gate's expected Lurkr checklist/report object; a future adapter must not
translate a format-valid or empty findings array into scanner success or approved review.

## Adoption Notes

- **Recommendation:** Evaluate an explicit, opt-in security-review extension. Keep ordinary PR reviews on the current path; do not globally install or auto-trigger a full multi-agent audit.
- **Target files/domains:** The existing stage and skill owners linked above; any eventual machine-readable adapter belongs beside the current security review gate and its focused tests. Keep published agent surfaces aligned if their contracts change.
- **SkillSpector gate:** On 2026-10-22, ran a commit-pinned NVIDIA SkillSpector `2.12.0` build in an isolated temporary environment against the complete pinned skill directory. Static scan exited `1`: aggregate risk `100/100`, `DO_NOT_INSTALL`, 14 findings, and partial analysis at 75% (15 fully and 5 partially inspected files). Ten matches have a provisional contextual false-positive assessment; four identify unresolved parser-limited analysis. No suppression, clean-scan claim, or human waiver. Adoption remains blocked, including a documentation-only adaptation. See the unchanged [report](../reviews/cloudflare-security-audit-skillspector-2026-10-22.json) and [scan/design Brief](../briefs/cloudflare-source-only-security-pilot.md).
- **Execution safety:** Upstream requires OS-enforced network isolation, an empty allowlisted environment, read-only source/tooling, scratch-only writes, and resource/time limits before running target-controlled code. Prompt instructions or a worktree are not that sandbox. Sandbox enforcement and race-safe parent-owned artifact promotion have not been demonstrated here; use source inspection only until they are proved.
- **Windows compatibility:** On this workstation, Node v24.15.0 reports `win32` and exposes neither `O_NOFOLLOW` nor `O_NONBLOCK`. The inspected findings-validator CLI requires both, so it is incompatible with this native runtime. A proven Linux sandbox or equivalent race-safe port needs separate validation; do not bypass the protection checks.
- **Cost and scope:** Full audits require reconnaissance, hunters, critics, and independent verifiers. Set explicit invocation, time, and resource budgets; reserve verification before hunting. Scoped or quick runs remain partial, and budget exhaustion must be reported as incomplete rather than clean coverage.
- **Data ownership:** Keep audit records parent-owned and agent scratch isolated. Full-audit output defaults outside the target repository; an in-repository path requires explicit selection and verified Git ignore coverage. No sensitive audit output belongs in committed radar memory.
- **Finding contract:** Keep security certainty separate from harness review priority. Unresolved candidates need an exact blocker and validation plan, not vulnerability severity; confirmed claims need a real boundary failure and independently established observed result. Do not automatically map upstream severity to Blocker/Major.
- **Next step:** Resolve the scan's incomplete analysis and independently adjudicate its contextual matches, then obtain an acceptable complete rescan or an explicit waiver with rationale, a named human approver, and a scan target within 14 days. Independently challenge the source-only comparison design and obtain execution/cost approval before materializing its reviewer augmentation or running it. No workflow changes or audit execution are authorized by the design.

## Bounded Pilot Proposal

1. Start with a source-only, narrowly scoped comparison against the existing security-review lane on fixed, known-issue fixtures. Measure verified expected defects, false positives, missed defects, and agent/time cost; claim no detection improvement before that comparison.
2. Compare coverage-unit accounting and independent refutation using the AI/LLM companion. Record reviewer identity and evidence provenance; do not treat a sub-agent label as proof of a distinct model.
3. Define a separate evidence artifact and explicit mapping into the existing findings ledger. Test that malformed records, missing verification, unresolved candidates, and incomplete coverage cannot produce a clean security verdict.
4. Before any target-code execution or full-audit pilot, prove sandbox and artifact-promotion controls, supported-platform validator behavior, strict budgets, and safe output placement. Keep source-only gaps visible if these prerequisites are unavailable.

The [Architecture Brief](../briefs/cloudflare-source-only-security-pilot.md) now fixes eight planned
cases, two paired repetitions, equal model/tool budgets, blinded independent verification, and
quality/cost thresholds. It records a blocked design, not an executed pilot or adopted pattern.

## Triage Evidence

- Manual triage scoped to this candidate using the `technique-triage` rubric: classified, decision logged, next step and owners named, no implementation, and no unclassified candidate within this scope. Other radar entries were not re-triaged.
- Baseline: `main` at `b7b3387fcc3e0227d5cd4cac00d013ca816d293e`, with pre-existing unrelated worktree changes preserved. Graph reports fresh at HEAD; refresh readiness is degraded by missing plugin configuration. Conclusions use direct file evidence.
- `node scripts/harness/check-memory-references.mjs`: passed across 914 Markdown files with no missing local targets. Focused Markdown diagnostics passed after formatting corrections.
- In-process assertions against `evaluateSecurityReviewGate`: the expected scanner/checklist report plus approved review passed; an upstream-style findings array failed report status, checklist presence, and checklist schema checks. No upstream code was executed.
- Native Node filesystem-constant inspection confirmed the Windows limitation above. Sandbox proof remains unavailable. SkillSpector now has a completed but failing, partial result, not a passing check.
- Scan provenance: target commit `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8`; scanner commit `d7338f58200a9ae2a24810cee08911ab68b107a7`; CPython `3.13.15`; frozen dependency lock; `--no-llm --format json --fail-on-findings --fail-on-incomplete --min-coverage 100`. No model calls, target execution, exclusions, or suppressions. A successful scanner process is distinct from a passed gate. The Brief records exact lock/report hashes and all finding dispositions.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-22 | candidate | Captured the pinned upstream skill and compared its evidence model with the current security-review owners. | GitHub Copilot |
| 2026-10-22 | parked | Good fit for an opt-in coverage/verification pilot, but SkillSpector evidence is missing, the native Windows validator is incompatible, and sandbox enforcement is unproved. No installation, workflow implementation, or automatic audit was authorized by this evaluation. | GitHub Copilot |
| 2026-10-22 | parked | Acquired pinned source and ran static SkillSpector: DO_NOT_INSTALL with partial analysis. Preserved raw evidence and designed a bounded source-only comparison; no pilot executed, skill installed, workflow changed, scan gate waived, or adoption approved. | GitHub Copilot |
