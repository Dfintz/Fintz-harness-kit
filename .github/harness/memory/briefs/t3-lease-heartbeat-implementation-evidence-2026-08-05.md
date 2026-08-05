---
summary: "T3 implementation evidence - deterministic local takeover and blocked-terminal proofs"
type: brief
status: active
source: human
created: 2026-08-05
updated: 2026-08-05
tags: [t3, evidence, lease, heartbeat, reaper, deterministic]
---
# T3 implementation evidence - deterministic local takeover and blocked-terminal proofs
resource: .github/harness/memory/briefs/t3-lease-heartbeat-loop-envelope-2026-08-05.md, scripts/harness/run-loop.mjs, scripts/harness/lease-envelope.mjs, .github/harness/runs/t3-lease-proof-stale.json, .github/harness/runs/t3-lease-proof-2026-08-05T11-33-03-204Z.json

## Scope
- Prove stale-lease takeover path produces deterministic lease handoff evidence.
- Prove lease-expiry path produces deterministic blocked terminal state evidence.

## Scenario A - stale lease takeover proof
### Setup
- Seeded resumable journal with terminalState null and an expired foreign owner lease at [.github/harness/runs/t3-lease-proof-stale.json](.github/harness/runs/t3-lease-proof-stale.json).
- Command:

```powershell
$env:HARNESS_LOOP_LEASE_TTL_MS=60000
$env:HARNESS_LOOP_HEARTBEAT_INTERVAL_MS=1000
node scripts/harness/run-loop.mjs t3-lease-proof --resume .github/harness/runs/t3-lease-proof-stale.json --max-iterations 1
```

### Deterministic outcome
- Runner completed successfully with converged terminal state.
- Journal remained at [.github/harness/runs/t3-lease-proof-stale.json](.github/harness/runs/t3-lease-proof-stale.json) and shows:
  - leaseHistory contains event reaped with previousOwner and reason expired-lease.
  - lease owner changed from foreign owner to current deterministic owner tuple host:pid:startedAt.
  - terminalState converged with released lease state.

## Scenario B - blocked terminal proof
### Setup
- Ran one slow passing check with short lease TTL to force expiry before terminal write.
- Command:

```powershell
$env:HARNESS_LOOP_LEASE_TTL_MS=60
$env:HARNESS_LOOP_HEARTBEAT_INTERVAL_MS=20
node scripts/harness/run-loop.mjs t3-lease-proof --max-iterations 1
```

### Deterministic outcome
- Runner exited with code 1 and message indicating blocked terminal due to lease expiry before terminal write.
- Journal captured at [.github/harness/runs/t3-lease-proof-2026-08-05T11-33-03-204Z.json](.github/harness/runs/t3-lease-proof-2026-08-05T11-33-03-204Z.json) with:
  - terminalState blocked.
  - leaseHistory includes expired event and terminal event with reason lease-expired.
  - final lease state expired.

## Acceptance alignment
- Terminal precedence rule demonstrated: expiry before terminal write forces blocked.
- Takeover auditability demonstrated: reaped event includes prior owner and reason.
- Deterministic owner identity demonstrated: owner persisted in host:pid:startedAt shape.

## Notes
- The deterministic proof loop file was temporary and removed after runs; evidence journals remain for audit traceability.
