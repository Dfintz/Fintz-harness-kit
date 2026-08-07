# Strict Normalization Profile Matrix

resource: harness.config.json,.github/harness/registry.json,.github/harness/HARNESS.md

This matrix normalizes task categories to one mandatory route and one mandatory verdict schema.
Use it as a strict policy overlay for consistent operator behavior.

## Source Of Truth

- Route/profile definitions: `harness.config.json` (`routing.profiles`, `routing.intentProfiles`)
- Stage artifacts and contracts: `.github/harness/registry.json`
- Canonical stage order: `.github/harness/HARNESS.md`

## Normalization Rules

1. For non-trivial delivery intents, normalize to the full feature route.
2. Only use review-only when no implementation is requested.
3. Use assistant profile only for trivial one-shot requests.
4. Use wayfinder for multi-session planning before implementation starts.
5. If multiple intents match, choose the higher-governance route.

Governance precedence:

1. `wayfinder`
2. `feature` (including `turnkey-coding`, `multi-agent-orchestration`, `drop-in-memory`)
3. `review`
4. `coder`
5. `assistant`

## Mandatory Route + Verdict Schema

| Task category | Mandatory profile | Mandatory route | Mandatory verdict schema |
| --- | --- | --- | --- |
| Trivial one-shot Q&A / explain / summarize | `assistant` | `implement` | `ASSISTANT-VERDICT-v1` (single response verdict: `DONE` \| `BLOCKED`, with limitation note when blocked) |
| Fast code edit with light governance | `coder` | `understand -> architect-challenge -> implement -> review-breadth` | `CODER-VERDICT-v1` (challenge verdict + breadth findings summary + release decision) |
| Independent review request (no code changes) | `review` | `understand -> review-breadth -> review-depth -> feedback` | `REVIEW-VERDICT-v1` (severity findings + gate ledger + feedback adjudication) |
| Feature delivery (default non-trivial) | `feature` | `understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback` | `FEATURE-VERDICT-v1` (full stage artifacts + final feedback verdict table) |
| Turnkey coding intent | `feature` (normalized) | `understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback` | `FEATURE-VERDICT-v1` |
| Multi-agent orchestration intent | `feature` (normalized) | `understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback` | `FEATURE-VERDICT-v1` |
| Drop-in memory/state intent | `feature` (normalized) | `understand -> architect -> architect-challenge -> implement -> review-breadth -> review-depth -> feedback` | `FEATURE-VERDICT-v1` |
| Multi-session, map-first planning | `wayfinder` | `understand -> architect` | `WAYFINDER-VERDICT-v1` (planning verdict: `MAPPED` \| `REVISE` \| `BLOCKED`; no implementation closure) |

## Artifact Requirements Per Verdict Schema

| Schema | Required artifacts |
| --- | --- |
| `ASSISTANT-VERDICT-v1` | One-shot answer with explicit completion status |
| `CODER-VERDICT-v1` | `.github/harness/memory/reviews/architect-challenge-verdict.md`, breadth findings block |
| `REVIEW-VERDICT-v1` | `.github/harness/memory/reviews/review-breadth-findings.md`, `.github/harness/memory/reviews/review-depth-findings.md`, `.github/harness/memory/reviews/feedback-verdict.md` |
| `FEATURE-VERDICT-v1` | `architecture-brief.md`, `.github/harness/memory/reviews/architect-challenge-verdict.md`, `implementation-notes.md`, `.github/harness/memory/reviews/review-breadth-findings.md`, `.github/harness/memory/reviews/review-depth-findings.md`, `.github/harness/memory/reviews/feedback-verdict.md` |
| `WAYFINDER-VERDICT-v1` | Planning brief + ticket map + explicit unblock conditions |

## Consistency Enforcement

- Profile selection should be recorded in handoff telemetry.
- If a run deviates from the matrix without explicit override reason, verdict is `REVISE`.
- Matrix policy does not replace router logic; it constrains operator choice for repeatability.