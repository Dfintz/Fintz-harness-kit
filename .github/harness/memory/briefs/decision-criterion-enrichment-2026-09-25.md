# Decision Criterion Enrichment and Sidecar Default Restore

resource: scripts/harness/decision-advisory.mjs, scripts/harness/decision-policy.mjs, harness.config.json, scripts/harness/test/decision-advisory-test.mjs, .github/harness/memory/briefs/jev-lite-decision-sidecar-windows-wsl2-2026-09-25.md, .github/harness/memory/briefs/jev-full-decision-plane-followon-2026-09-25.md

## Architecture Brief

### Objective

Two bounded changes:

1. Send the decision sidecar the discriminative text it needs. Today `intentCandidates()` forwards
   only `description`; the `keywords` array — the same signal the deterministic router matches on —
   is dropped before the scorer ever sees it.
2. Restore `modelPolicy.localDecisionSidecar.enabled` to `false` and record the measured Jev-style
   model as a documented candidate rather than a shipped default.

### The actual defect

The earlier hypothesis was "bare labels are being sent". That is **false** — descriptions are sent.
Inspection of `intentCandidates()` shows the real asymmetry:

| Field in `routing.intentProfiles` | Used by deterministic router | Sent to decision sidecar |
|---|---|---|
| `profile` | yes | yes |
| `description` | no | yes |
| `keywords` | **yes — primary match signal** | **no** |
| `tags` | no | no |

The scorer is asked to reproduce a keyword-driven classification while being denied the keywords.
Six one-line descriptions, several of which overlap semantically ("Ship feature work in a full
harness cycle" vs "Fast code delivery"), are not separable by any model. This is an input problem,
and no change of model fixes it.

### Artifacts to modify

- `scripts/harness/decision-advisory.mjs` — `intentCandidates()` carries `keywords`; a new
  `criterionText()` composes the per-option string sent as Choice criteria.
- `harness.config.json` — `localDecisionSidecar.enabled` back to `false`; restore a neutral
  description; record the measured local model under a new `measuredCandidates` array.
- `scripts/harness/test/decision-advisory-test.mjs` — assert keywords reach the request body and
  that the disabled path stays exact.

### Key decisions

**Gate 1 — Domain/module alignment: PASS.** Criterion construction is request-shaping, owned by
`decision-advisory.mjs`, the module that already builds the System One request.

**Gate 2 — Generality: PASS.** The composition is a pure function of the existing profile shape.
No model-, provider-, or hardware-specific text is introduced.

**Gate 3 — Ownership: PASS.** `harness.config.json` remains the single source of profile text.
The advisory module composes but never invents criterion content.

**Gate 4 — Boundary integrity: PASS.** The `/v1/systemone` Choice contract is unchanged; only the
criteria string values get longer.

**Gate 5 — Reuse: PASS.** Reuses the existing candidate map, fingerprinting, and receipt path.

**Criterion composition.** `"<description> Typical phrasing: <k1>; <k2>; ...".` Keywords are
included in declared config order and bounded to the first 8 so one verbose profile cannot dominate
the prompt. A profile with no keywords degrades to its description alone.

**Fingerprint invalidation is intended.** `candidateFingerprint` is computed over the candidate map.
Adding `keywords` changes it, which invalidates every cached receipt. That is correct: the question
put to the scorer has materially changed, so prior answers must not be reused.

**Config default restore.** `enabled: false` is the shipped state. The measured Jev-style model is
recorded under `measuredCandidates` with its observed latency and the fact that it produced only
`uncertain` verdicts on this repository's profiles — evidence, not a recommendation.

### Constraints

- Do not change `/v1/systemone` request or response shapes.
- Do not alter deterministic routing, keyword matching, or `planTask` behavior.
- Do not enable the sidecar or leave shadow mode.
- Do not edit the `description` or `keywords` values themselves in this slice; overlapping profile
  semantics is a separate question.
- The disabled path must remain byte-identical to today's output.

### Validation plan

- `npm run test:harness:decision-advisory` — keywords present in the request, disabled path exact.
- `npm run test:harness:decision-sidecar` — full suite unchanged.
- `npm run harness:config:self-test` and `npm run test:harness:local-open-model-policy`.
- `npm run harness:docs:check` and `git diff --check`.
- Live re-probe of the five tasks against the Jev model to observe whether margins improve.

### Do NOT

- Do not claim the enrichment fixes accuracy until re-probed; it removes a known input deficit, and
  that is all it is entitled to claim.
- Do not rewrite profile descriptions to game the scorer.
- Do not ship `enabled: true` or a machine-specific model pin.

### Assumptions and risks

- `[KNOWN]` Several profiles overlap semantically. Keywords narrow but do not eliminate this;
  `turnkey-coding` and `coder` may remain genuinely ambiguous for many real tasks.
- `[KNOWN]` Two descriptions embed runtime hints ("Local Ollama: qwen2.5-coder"). This is noise for
  a scorer. Left untouched in this slice because the text is also operator-facing documentation;
  splitting the two audiences needs its own decision.
- Longer criteria raise prompt tokens per decision. At six options this is negligible against the
  measured ~70 ms.
