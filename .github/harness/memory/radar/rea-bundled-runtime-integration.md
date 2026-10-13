---
summary: Keep REA as an optional operator-selected analysis tool, not a bundled reverse-engineering runtime or skill in this project-agnostic harness.
status: rejected
source: https://github.com/morluto/rea/tree/747e7299141cec0b03774c427f579889d5088d20
author_project: morluto/rea
captured: 2026-10-13
tags: [mcp, reverse-engineering, scope, portability, overlap-scan]
---

# REA Bundled Runtime Integration

## Technique Summary

REA provides CLI and MCP workflows for inspecting native binaries, shipped applications, and runtime
behavior. Static JavaScript and managed-code inspection do not execute their target; runtime scenarios
can execute foreign code, interact with applications, access networks, or mutate devices. Its setup
plans client registrations and matching skills, then applies approved changes.

## Repository Relevance

Harness-kit owns reusable workflow stages, routing, code graphs, validation, and evidence transport,
not decompilation or application reconstruction. Bundling REA would add a separate analysis runtime
and domain-specific tool surface without a current harness task requiring it. The two adopted REA
patterns are intentionally implementable with local abstractions, without a package dependency.

## Evidence And Limits

- Evaluated main at `747e7299141cec0b03774c427f579889d5088d20` on 2026-10-13, not an installed release.
- [README and supported workflows](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/README.md),
  [installation and release boundary](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/docs/installation.md),
  and [tool effects](https://github.com/morluto/rea/blob/747e7299141cec0b03774c427f579889d5088d20/src/contracts/toolEffects.ts)
  ground the scope decision. No package, skill, engine, or target was run in this assessment.
- Upstream installation docs identify npm 6.4.0 as checked on 2026-10-11 and explicitly distinguish
  it from newer main functionality. Do not assume the inspected contracts exist in that tarball.
- REA-authored code is MIT; third-party material and commercial engines retain separate terms.
  This review summarizes techniques in original prose and vendors no upstream code.

## Adoption Notes

- **Target files/domains:** None for bundled adoption. An adopted project may independently select
  REA as an external MCP/CLI tool when authorized shipped-artifact analysis is actually required.
- **Risks/constraints:** Node version requirements, external engine/JDK prerequisites, platform-
  specific support, process ownership, target-data confidentiality, and vendor licensing must be
  checked for the selected operation. Windows Ghidra is explicitly experimental and scope-limited;
  native Windows historical-source import is unsupported in the inspected docs.
- **Overlap scan:** Stable catalogs and task-scoped readiness are useful reference patterns, but
  this harness already has catalog, discovery, health, and graph-provider status owners. Guided
  investigations overlap stage skills. Compact advertised schemas merit measurement only after a
  named client size-cap failure; they must never weaken canonical server-side validation.
- **Next step:** No integration task now. Reconsider only for a named authorized artifact-analysis
  requirement, pin the actual package, and verify that operation on its target host. Any external
  skill adoption must pass SkillSpector or the required human-approved waiver before adoption.
- **Skill-file gate:** No skill adoption occurred; no scan or waiver is claimed.

## Decision Log

| Date | Status | Decision | By |
| --- | --- | --- | --- |
| 2026-10-13 | candidate | Evaluated whole-runtime integration alongside individual transferable patterns. | ai-techniques-radar |
| 2026-10-13 | rejected | Domain/runtime expansion is unjustified for the kit. Preserve optional operator choice in adopted projects; pursue only the separate, locally grounded protocol ideas. | ai-techniques-radar |
