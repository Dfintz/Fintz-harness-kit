# Review Breadth Findings: Remediation for Coverage, Source Boundary, Graph Readiness, and Documentation Debt

## Resolved

1. Artifact: historical comprehensive review artifacts
   Finding: markdown lint debt in prior review outputs.
   Resolution: fixed heading/list spacing and newline compliance in historical artifacts.
   Evidence: diagnostics cleared for remediated files.
   Confidence: HIGH

2. Artifact: README documentation tables
   Finding: markdown table style violations in primary docs.
   Resolution: normalized affected tables to compact style.
   Evidence: diagnostics no longer report prior MD060 entries on README in this run.
   Confidence: HIGH

## Remaining Blocker

1. Artifact: frontend and apps/mobile domain surfaces
   Finding: no first-party source files available in workspace for these domains.
   Evidence: file searches return no source files under frontend/ and apps/mobile/.
   Impact: true whole-app validation remains blocked for UI/mobile correctness and security.
   Confidence: HIGH
   Recommended fix: provide or restore source trees, or narrow formal review scope.

## Remaining Major

1. Artifact: backend source-of-truth boundary
   Finding: backend/src currently shows migrations only, while runtime logic resides in backend/dist.
   Evidence: directory listing and absence of expected service source paths.
   Impact: source ownership ambiguity and elevated maintenance risk.
   Confidence: HIGH
   Recommended fix: restore canonical backend service sources and treat dist as generated output.

2. Artifact: graph refresh readiness
   Finding: graph snapshot is fresh but refresh path is degraded due to pluginRoot requirement.
   Evidence: graph status/provider-status output indicates required pluginRoot configuration.
   Impact: future Understand-stage refresh operations may fail.
   Confidence: HIGH
   Recommended fix: configure pluginRoot in operator environment/config and add preflight checks to bootstrap flow.
