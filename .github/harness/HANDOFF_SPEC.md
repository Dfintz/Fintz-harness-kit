# Compact Handoff Specification

Purpose: define a deterministic, compact handoff format so another agent can resume work without
re-deriving context.

## Required sections

Handoff markdown must include exactly these section headings:

1. `## Task Snapshot`
2. `## Current State`
3. `## Next Steps`
4. `## Suggested Skills`
5. `## References`
6. `## Safety Check`

## Compactness rules

- Default maximum lines: `220`
- Default maximum bytes: `12000`
- `## Next Steps` must include at least one bullet.
- `## Suggested Skills` must include at least one bullet.
- `## References` must include at least one bullet with either:
  - a repository-relative path (for example `.github/harness/HARNESS.md`), or
  - an absolute URL (`https://...`).

## Safety rules

- `## Safety Check` must explicitly mention secret handling (for example `No secrets included`).
- Handoff must not contain obvious secret tokens (AWS key, GitHub token, private key marker).

## When to use

Required on the stage machine's **loop back-edges**, where control crosses a model boundary and the
receiving agent has no shared context:

- **Architect Challenge → Architect** — a DISPUTE bounces the Brief back for revision.
- **Review → Implement** — the `review-fix` loop sends Blocker/Major findings back.

Not needed on the forward linear path (Understand → Architect → Implement → Review), where the
persisted Architecture Brief and the prompt-pack's `next-steps.md` already carry state. Adding a
handoff there is redundant.

## Checker

This spec is enforced by `scripts/harness/handoff-check.mjs`:

```bash
npm run harness:handoff:check -- <handoff.md>     # validate a handoff (exit 0 pass / 1 fail)
npm run harness:handoff:check:self-test           # part of npm run harness:selftest
```

It checks the required sections, the compactness limits, the bullet/reference rules above, and that
no obvious secret tokens leak into a committed handoff.
