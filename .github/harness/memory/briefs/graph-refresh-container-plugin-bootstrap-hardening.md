# Architecture Brief: Graph Refresh Container Plugin Bootstrap Hardening

Date: 2026-06-15
Task: Prevent graph-refresh container regressions caused by plugin dependency resolution failures.

## Scope

- Target files:
  - scripts/harness/graph-refresh-loop.mjs
  - docker-compose.harness.yml
  - README.md

## Impacted Components

- graph-refresh loop startup path for container execution.
- Optional sidecar environment variables and runtime behavior docs.

## Architectural Gates

1. Domain alignment: PASS

- Plugin bootstrap belongs in graph-refresh loop lifecycle.

1. Generality: PASS

- Runtime bootstrap pattern is generic for read-only mounted plugin trees.

1. Data ownership: PASS

- Only ephemeral runtime copy under `/tmp` is mutated in container.

1. Layer boundaries: PASS

- Script/runtime orchestration only; no app-layer boundary crossings.

1. Reuse potential: PASS

- Same bootstrap helper can be reused for other sidecars requiring external plugin deps.

## Decisions

- Add startup bootstrap in graph-refresh loop:
  - Detect container-mounted plugin path defaults.
  - Copy plugin to writable runtime directory.
  - Run `corepack pnpm install --frozen-lockfile` in runtime directory.
  - Use runtime directory as effective plugin root for refreshes.
- Keep host execution behavior unchanged by default.

## Constraints

- Do not require mutable writes to `/opt/understand-plugin` mount.
- Preserve existing loop options and journal/report behavior.

## Do-NOTs

- Do not switch primary flow to host-only execution.
- Do not require manual plugin install inside container on every failure.

## Assumptions

- Node image includes `corepack`.
- Plugin checkout includes pnpm workspace files.
