# Implementation Summary: Radar Candidate and Parked Readiness

resource: .github/harness/memory/briefs/radar-candidate-parked-readiness-2026-09-24.md, .github/harness/memory/briefs/radar-candidate-parked-readiness-matrix-2026-09-24.md
Status: implemented

## Delivered

- Confirmed zero pending candidates across 80 radar entries.
- Evaluated all 32 parked entries against their recorded blocker and current repository evidence.
- Classified zero as ready for immediate adoption, three as ready for bounded pilots, and 29 as still blocked.
- Defined accountable pilot roles, assignment start gates, immutable inputs, bounded evidence outputs, provisional budgets, and proceed-or-repark gates.
- Preserved every radar status and Decision Log; no pilot was executed or misrepresented as adoption.

## Top Next Pilots

1. `awesome-harness-engineering-delta-feed` - two-cycle revision-pinned maintenance-yield trial.
2. `openai-codex-harness-open-source` - pinned and capped source read for concrete portable differences.
3. `twelve-factor-agents` - pinned factor-by-factor comparison against the operating contract.

The order favors the smallest operational experiment first, then bounded source comparisons. `omo-hyperplan-multi-critic` was demoted because no valid pre-review baseline or cost evidence exists.

## Proof Summary

- Provenance: working-tree snapshot; the graph is fresh only for committed HEAD `b01ec72`. The 32 evaluated parked files are pinned by `radar-candidate-parked-readiness-input-manifest-2026-09-24.txt`.
- Radar inventory: 0 candidate, 39 adopted, 32 parked, 9 rejected.
- Matrix validation: the persisted command output below proves 32 unique parked IDs, exactly 3 pilot/29 blocked, and no missing/extra/duplicate rows.
- SkillSpector check: not installed; external skill-pattern items remain blocked without waiver.
- Validation commands are rerun after the final review repairs; results are recorded below.

```text
Parked     : 32
Pilots     : 3
Blocked    : 29
PilotIds   : awesome-harness-engineering-delta-feed, openai-codex-harness-open-source, twelve-factor-agents
Missing    :
Extra      :
Duplicates :
```

Matrix command (PowerShell, repository root):

```powershell
$m = Get-Content '.github/harness/memory/briefs/radar-candidate-parked-readiness-matrix-2026-09-24.md'; $p0 = [Array]::IndexOf($m, '## Ready for Pilot'); $b0 = [Array]::IndexOf($m, '## Still Blocked'); $n0 = [Array]::IndexOf($m, '## Notes on Overlap'); $re = '^\| `([^`]+)` \|'; $pilots = @($m[($p0 + 1)..($b0 - 1)] | ForEach-Object { if ($_ -match $re) { $Matches[1] } }); $blocked = @($m[($b0 + 1)..($n0 - 1)] | ForEach-Object { if ($_ -match $re) { $Matches[1] } }); $parked = @(Get-ChildItem '.github/harness/memory/radar' -File -Filter '*.md' | Where-Object { (Get-Content $_.FullName -TotalCount 12) -match '^status:\s*parked\s*$' } | ForEach-Object BaseName | Sort-Object); $ids = @($pilots + $blocked | Sort-Object); if ($parked.Count -ne 32 -or $pilots.Count -ne 3 -or $blocked.Count -ne 29 -or @($parked | Where-Object { $_ -notin $ids }).Count -or @($ids | Where-Object { $_ -notin $parked }).Count -or @($ids | Group-Object | Where-Object Count -gt 1).Count) { throw 'readiness matrix mismatch' }
```

Manifest command (PowerShell, repository root):

```powershell
$expected = @(Get-Content '.github/harness/memory/briefs/radar-candidate-parked-readiness-input-manifest-2026-09-24.txt' | Where-Object { $_ -notmatch '^#' -and $_.Trim() }); $actual = @(Get-ChildItem '.github/harness/memory/radar' -File -Filter '*.md' | Where-Object { (Get-Content $_.FullName -TotalCount 12) -match '^status:\s*parked\s*$' } | Sort-Object Name | ForEach-Object { "$( (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() )  $([System.IO.Path]::GetRelativePath((Get-Location).Path, $_.FullName).Replace('\','/'))" }); if ($expected.Count -ne 32 -or @(Compare-Object $expected $actual).Count) { throw 'input manifest mismatch' }
```

Manifest result: `manifest_entries=32 current_entries=32 differences=0`.

## Self-Review Summary

- Requirement coverage: PASS. Answers both pending-candidate and next-parked questions.
- Evidence precision: PASS. Distinguishes adoption-ready from pilot-ready and uses dated local evidence.
- Safety: PASS. Destructive, security, sandbox, persistent-runtime and skill-pattern boundaries remain blocked.
- Scope: PASS. Assessment artifacts only; no runtime/code/status changes.
