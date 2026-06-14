# Quarantined Memory

> Autonomous, untrusted-by-default memory writes land here. **Nothing in this directory is loaded at
> session start.** Only a human (or an explicitly trusted reviewer) promotes an entry from here into
> `../lessons/`, at which point it becomes trusted guidance.

This directory exists because a self-improving harness can write to its own memory, and memory is read
by every future session. That makes a single poisoned "lesson" a persistent, compounding attack — far
worse than a one-shot prompt injection. See
`../briefs/self-improving-harness.md` (threat surface #1).

## Who writes here

- Autonomous loops (experiment/evolve runs) that want to record a finding.
- Any flow that derived a candidate lesson from **untrusted** input (research briefs, tool/model
  output).

These write to `quarantine/`, **never** directly to `lessons/`.

## Promotion protocol (human-gated)

1. A reviewer reads the candidate in full (not a skim) and checks for:
   - embedded instructions or injection markers,
   - advice that weakens safety (disabling TLS/lint/checks, widening the apply-agent's scope,
     loosening guardrails),
   - secrets or PII.
2. If clean and genuinely useful, move the file to `../lessons/` and tag its provenance in the body
   (e.g. `origin: loop:lint-debt-experiment` or `origin: research`).
3. If not, delete it.

## Why "off by default"

The session-start read protocol in `../README.md` loads only `lessons/` and `briefs/`. Quarantine is
deliberately excluded so an unreviewed autonomous write can never silently become trusted guidance.
