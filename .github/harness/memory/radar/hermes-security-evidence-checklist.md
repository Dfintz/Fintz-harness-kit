---
summary: Hermes deployment checklist offers a concise evidence checklist pattern for harness security workflow reviews.
status: adopted
source: https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/security.md
author_project: NousResearch Hermes Agent
captured: 2026-08-05
tags: [security, checklist, review-breadth, evidence]
---
# Hermes Security Evidence Checklist

## Technique Summary

Hermes documents layered deployment controls as a short operator checklist: authorization, approvals, isolation, secret handling, resource limits, and monitoring.

## Repository Relevance

The harness already has differential security scanning and review-breadth evidence. A checklist can make the before/after evidence consistently auditable without importing Hermes security policy or runtime behavior.

## Adoption Notes

- **Target files/domains:** `.github/instructions/05-REVIEW-BREADTH.md`, `scripts/harness/lurkr-diff.mjs`, `.github/workflows/harness-optional-security-gates.example.yml`.
- **Risks/constraints:** Checklist remains evidence-only; it must not weaken scanner behavior or imply security certification.
- **Next step:** Route a bounded documentation/workflow task to add checklist rows tied to concrete scanner and approval evidence.

## Decision Log

| Date | Status | Decision | By |
|---|---|---|
| 2026-08-05 | adopted | Adopt the checklist shape as a review-evidence enhancement, not Hermes deployment policy. | Copilot |