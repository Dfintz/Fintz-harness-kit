# Architecture Brief: Council Review Prompt Input Hardening

Date: 2026-06-15
Task: Eliminate remaining prompt-file warning by switching to stricter prompt input interface.

## Scope

- Target file: scripts/harness/council-review.mjs
- Replace arbitrary `--prompt-file <path>` ingestion with a stricter mechanism.

## Impacted Components

- Harness CLI utility: council review synthesis runner.
- Input parsing and prompt-loading path in council-review.

## Architectural Gates

1. Domain alignment: PASS

- Prompt ingestion policy belongs in council-review CLI utility.

1. Generality: PASS

- Input hardening is utility-local behavior for this command's trust boundary.

1. Data ownership: PASS

- Prompt text ownership remains within this utility; no cross-domain writes.

1. Layer boundaries: PASS

- Pure script-layer changes; no controller/service boundary crossing.

1. Reuse potential: PASS

- Pattern can later be copied to other CLI tools if needed.

## Decisions

- Remove free-form file path option from public CLI surface.
- Keep only:
  - `--prompt "..."`
  - `--prompt-stdin` (read prompt from stdin stream)
- Reject missing prompt input with clear usage error.

## Constraints

- Preserve existing council synthesis behavior and output envelope format.
- Do not modify stage machine behavior.
- Keep PowerShell-friendly usage.

## Do-NOTs

- Do not accept arbitrary filesystem paths for prompt loading.
- Do not add webview/adapter scope in this fix.

## Assumptions

- Callers can pass prompt directly or pipe text via stdin.
- Removing `--prompt-file` is acceptable for this hardening follow-up.
