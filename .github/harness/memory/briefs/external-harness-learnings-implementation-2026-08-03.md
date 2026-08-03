---
summary: "Implementation Summary — external harness learning pass"
type: brief
status: active
source: human
created: 2026-08-03
updated: 2026-08-03
tags: [research, external-harness, implementation, 2026]
---
# Implementation Summary — external harness learning pass

resource: .github/harness/memory/briefs/external-harness-learnings-2026-08-03.md, scripts/harness/graph-provider.mjs, README.md, SETUP.md, CREDITS.md

## Implementation Summary

### Delivered

- Added a persisted Architecture Brief capturing the transferable learnings from SSSF and fusion-harness and ranking the recommended follow-up slices.
- Fixed graph refresh readiness so the harness route and handoff commands honor `UNDERSTAND_PLUGIN_ROOT` when `graph.pluginRoot` is intentionally left empty in `harness.config.json`.
- Preserved the repo's machine-agnostic config default instead of committing a workstation-specific plugin path.

### Contract adherence

- Brief followed: this task remained a research and recommendation pass, not a speculative runtime parity effort.
- External ideas were translated into local adoption slices rather than copied as code, prompts, or Pi-specific UI patterns.
- Safety preserved: no tool-permission widening, no approval-gate weakening, no direct vendoring of external repo assets.

### Proof summary

- `npm run harness:graph -- status` => refresh readiness `ready` with env-based plugin configuration.
- `node scripts/harness/prompt-router.mjs route --task "is there any learnings and improvemnts to be taken fro https://github.com/disler/super-simple-software-factory https://github.com/disler/fusion-harness" --json` => route succeeds on the full 7-stage non-trivial path.
- `get_errors` on `.github/harness/memory/briefs/external-harness-learnings-2026-08-03.md` => no errors after formatting repair.
- `get_errors` on `harness.config.json` => no errors.
- External repo evidence captured from public README surfaces for both referenced repositories.

### Change summary

CHANGES MADE:

- `.github/harness/memory/briefs/external-harness-learnings-2026-08-03.md`: new Architecture Brief with adoption decisions, risks, and follow-up slices.
- `scripts/harness/graph-provider.mjs`: env fallback for `UNDERSTAND_PLUGIN_ROOT` added to the understand-anything refresh readiness path; readiness message updated to match actual supported configuration.

THINGS I DIDN'T TOUCH (intentionally):

- `README.md`, `SETUP.md`, and `CREDITS.md`: identified as likely follow-up surfaces if any recommendation graduates into a real implementation task.
- Loop definitions and review/runtime commands: no speculative adoption work was started during this research pass.

POTENTIAL CONCERNS:

- The external comparison remains README-grounded rather than full-source grounded.
- The graph-provider file already carries pre-existing analyzer findings unrelated to this narrow env-fallback change.

### Assumptions or deviations

- [UNVERIFIED] The public READMEs for the two external repos are current enough to support architecture-level learning extraction.
- No deviation from the revised Architecture Brief after the architect-challenge correction pass.
