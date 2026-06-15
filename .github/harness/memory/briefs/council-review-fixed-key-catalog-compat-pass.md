# Architecture Brief: Council Review Fixed-Key Catalog Compatibility Pass

Date: 2026-06-15
Task: Preserve old prompt-file callers using a safe fixed-key prompt catalog instead of free-form path reads.

## Scope

- Target: scripts/harness/council-review.mjs
- Optional docs touch: README usage/help text for compatibility behavior.

## Impacted Components

- Council review CLI argument parsing.
- Prompt resolution and input validation flow.

## Architectural Gates

1. Domain alignment: PASS

- Prompt-option compatibility logic belongs in council-review CLI.

1. Generality: PASS

- Fixed-key catalog is reusable pattern for safe preset prompts in CLIs.

1. Data ownership: PASS

- Prompt text remains local in process; no cross-domain state mutation.

1. Layer boundaries: PASS

- Script-level parsing/dispatch only; no service/controller boundaries crossed.

1. Reuse potential: PASS

- Catalog + alias mapping can be reused by future tools needing safe backward compatibility.

## Decisions

- Keep strict safe inputs (`--prompt`, `--prompt-stdin`).
- Reintroduce compatibility parsing for `--prompt-file <value>` as alias only:
  - Interpret `<value>` as a key token (and common legacy filename forms via basename normalization).
  - Resolve from a hardcoded fixed prompt catalog.
  - Never read filesystem from this option.
- Add explicit `--prompt-key <key>` for canonical future usage.

## Constraints

- No arbitrary path/file reads for prompt ingestion.
- Preserve existing synthesis behavior and envelope output.
- Keep PowerShell-friendly CLI usage.

## Do-NOTs

- Do not reintroduce file-based prompt loading.
- Do not change stage machine behavior.

## Assumptions

- Legacy callers may pass values like `review.md`; normalization to key is acceptable.
- Preset prompt text can be concise and mode-safe defaults.
