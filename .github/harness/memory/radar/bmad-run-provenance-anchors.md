---
summary: Record baseline and final revision anchors for each unattended run to make produced commit ranges audit-friendly and deterministic
status: adopted
source: https://github.com/bmad-code-org/BMAD-METHOD/blob/main/docs/reference/dev-auto.md
author_project: bmad-code-org/BMAD-METHOD
captured: 2026-07-26
tags: [provenance, git, auditability, autonomous-loops]
---

# Run Provenance Anchors

## Technique Summary

BMAD persists `baseline_revision` and `final_revision` for autonomous runs so operators can identify exactly what each run produced via a bounded commit range. This improves traceability, troubleshooting, and safe rollback targeting.

## Repository Relevance

The harness records loop outcomes but does not yet expose a universally consistent per-run commit-range anchor in all operator-facing artifacts. Adding this provenance pair would tighten evidence quality for reports and review handoffs.

## Adoption Notes

- **Target files/domains:**
  - `scripts/harness/record-run.mjs` (capture and persist anchors)
  - `scripts/harness/harness-report.mjs` (display anchors)
  - `.github/harness/runs/*.jsonl` (anchor fields in run records)
- **Risks/constraints:** Must handle non-git and detached-head environments safely without producing misleading anchors.
- **Next step:** Add optional anchor fields to run records with `NO_VCS` fallback and update report rendering.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|---|
| 2026-07-26 | candidate | Initial capture from BMAD radar pass | radar-pass |
| 2026-07-26 | adopted | High-leverage auditability improvement with low implementation risk and clear file targets. | radar-pass |