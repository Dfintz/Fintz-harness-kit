# Decision Calibration Review

The evaluator supports a local, offline collection workflow. It does not enable the frozen decision
sidecar, change routing, contact an endpoint, or establish calibration readiness.

`--repo-root` takes precedence over `HARNESS_PROJECT_ROOT`, which takes precedence over the evaluator
source root. It is an operator-selected, stable local directory, not a sandbox for an untrusted
caller. Relative option paths still resolve from the current working directory, but cases, history,
reviewed submissions, exports, and imports are each constrained to their designated directory under
the selected root. Links and junctions anywhere in the relevant ancestry are rejected. Filesystem
failures use fixed resource-and-operation categories without exposing local paths.

Run from the target repository so `HARNESS_PROJECT_ROOT` identifies that repository:

```powershell
$env:HARNESS_PROJECT_ROOT = (Get-Location).Path
npm run harness:decision:eval -- --export-candidates --json
```

This writes the ignored private queue at `.github/harness/runs/decision-calibration/candidates.json`.
It has at most 25 candidates by default; use `--limit <1-100>` to select a smaller or larger batch.
For later, disjoint batches, use an explicit non-negative offset; this writes a separate queue and
never overwrites an earlier batch:

```powershell
npm run harness:decision:eval -- --export-candidates --offset 25 --limit 25 --json
```

The resulting queue path is `.github/harness/runs/decision-calibration/candidates-25.json`.
Offsets are applied to the immutable first-occurrence history order before previously committed
sources are excluded, so importing reviewed records does not shift a later batch. Before any import,
repeated export of the same new-format selection reuses its saved opaque candidate IDs. Once import
changes that selection, export refuses replacement and the saved queue remains the reusable record.
Candidate IDs are local UUIDs, not
hashes of task text. Standard output contains only counts and the queue path, never task text. A
legacy `candidates.json` with hash-based IDs is retained locally but cannot be imported; preserve it
for reference and export a fresh UUID batch with `--offset 0` into `candidates-0.json` instead.

Review the queue locally. An accepted candidate needs final redacted task text, one existing intent,
real-use provenance, maintainer reviewer identifier, ISO review time, and `publicationConsent: true`.
Maintainers must explicitly confirm those final values after redaction. Leave uncertain cases pending,
deferred, or rejected. Agents must not add labels, reviewer metadata, or consent. Use this minimal
shape, replacing every placeholder locally; do not put real task text or labels in committed files:

```json
{"schemaVersion":1,"candidates":[{"id":"unchanged-id-from-private-queue","sourceRef":"unchanged-source-ref-from-private-queue","task":"[final redacted task confirmed by maintainer]","expected":"[one existing intent]","status":"accepted","labelledBy":"human-labelled","provenance":"[confirmed real-use provenance]","reviewedBy":"[maintainer identifier]","reviewedAt":"2026-09-28T12:00:00.000Z","publicationConsent":true,"confirmation":{"finalTaskConfirmed":true,"expectedConfirmed":true,"publicationConfirmed":true},"split":"calibration","taskFamily":"[optional family]"}]}
```

`split` and `taskFamily` are optional for collection. A `held-out` entry additionally needs
`familySeparationConfirmed: true`; it must have been assigned before predictions were viewed.

Save the reviewed submission under the same ignored directory, then select it explicitly:

```powershell
npm run harness:decision:eval -- --import-reviewed .github/harness/runs/decision-calibration/reviewed.json --queue .github/harness/runs/decision-calibration/candidates-25.json --json
```

Import validates the complete batch before one atomic fixture update. `--queue` selects the private
candidate batch that supplied the unchanged IDs and source references. If omitted, it defaults to
`.github/harness/runs/decision-calibration/candidates.json`. Reviewed files and queues must
stay under `.github/harness/runs/decision-calibration/`; `--cases` is rejected for imports so the
canonical fixture target cannot be redirected. Pending, deferred, and rejected entries are excluded.
Empty accepted batches, missing confirmation metadata, unsupported intents, unsafe paths, oversized
metadata, and conflicts fail without changing the fixture. Repeating an identical import is a no-op.
An accepted source reference can appear only once in the fixture and once in a reviewed batch, even
when final redaction changes the task text.

Run the deterministic report after an import or with the existing smoke fixture:

```powershell
npm run harness:decision:eval -- --deterministic-only --reviewed .github/harness/runs/decision-calibration/reviewed.json --json
```

The report reads known accepted, deferred, and rejected counts from the selected local batch; without
`--reviewed`, those counts are unmeasured. The old report spelling `--queue <reviewed-file>` remains
available as a deprecated alias. It writes exactly this warning to stderr only, leaving stdout unchanged:

```text
[decision-eval] --queue with --deterministic-only is deprecated; use --reviewed instead.
```

Supplying `--queue` and `--reviewed` together rejects before reads or writes. During imports,
`--queue` continues to select the private candidate batch and is not deprecated; use
`--import-reviewed` to select the reviewed submission.

The report separates synthetic smoke cases from accepted real cases and shows collection deficit,
intent coverage, and deterministic routing abstentions. It always reports promotion as false,
readiness as not established, and sidecar metrics as not measured. A collected batch does not satisfy
the frozen sidecar's independent unfreeze requirements.
