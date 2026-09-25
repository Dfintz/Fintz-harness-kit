# Word-Boundary Keyword Matching in Prompt Router

resource: scripts/harness/prompt-router.mjs, harness.config.json, .github/harness/eval/decision-intent-cases.json, scripts/harness/test/prompt-router-run-bundle-test.mjs, .github/harness/memory/briefs/decision-criterion-enrichment-2026-09-25.md

## Architecture Brief

### Objective

Replace naive substring keyword matching in `prompt-router.mjs` with word-boundary matching, so a
keyword only matches a whole word or whole phrase.

### Evidence the bug is live, not theoretical

`normalizeText()` lowercases and trims; every keyword check is then a bare `text.includes()`.

| Keyword | List | Falsely matches |
|---|---|---|
| `ci` | nonTrivialKeywords | de**ci**sion, effi**ci**ency, spe**ci**fic, pre**ci**sion |
| `api` | nonTrivialKeywords | r**api**d |
| `auth` | nonTrivialKeywords | **auth**or |
| `route` | nonTrivialKeywords | **route**r |
| `copy` | trivialKeywords | **copy**right |
| `comment` | trivialKeywords | **comment**ed |
| `find` | assistant intentProfile | **find**ings |

This fired during the session that produced this Brief: a route for a task about *decisions*
printed `non-trivial-keyword-hit:ci`. The `find`/`findings` case is already captured as fixture
case `mao-001`.

### Affected call sites

All four are in `prompt-router.mjs`:

1. `scoreIntent()` — intent profile `keywords` (+3 each).
2. `scoreIntent()` — intent name tokens (+1 each).
3. `matchesTaskClass()` — `taskClassMatrix[].matchAnyKeywords`.
4. `planTask()` — `trivialKeywords` and `nonTrivialKeywords`.

Out of scope: the manifest task-similarity check near the end of the file. It compares whole task
strings for run reuse, not keywords, and bidirectional containment is intended there.

### Artifacts to modify

- `scripts/harness/prompt-router.mjs` — add a cached `matchesKeyword()` helper; route all four
  call sites through it.

### Artifacts to create

- `scripts/harness/test/prompt-router-keyword-matching-test.mjs` — false-positive regressions,
  true-positive preservation, phrase and hyphen handling, punctuation adjacency.

### Key decisions

**Gate 1 — Domain/module alignment: PASS.** Keyword matching is routing logic and stays inside the
router. No config schema change.

**Gate 2 — Generality: PASS.** One helper serves all four sites; no per-list special casing.

**Gate 3 — Ownership: PASS.** `harness.config.json` still owns keyword vocabulary; the router owns
match semantics only.

**Gate 4 — Boundary integrity: PASS.** Function signatures and return shapes are unchanged.
`planTask` output keys are untouched.

**Gate 5 — Reuse: PASS.** A single helper replaces four ad-hoc `includes()` calls.

**Matching rule.** Lookaround rather than `\b`:
`(?<![a-z0-9])<escaped keyword>(?![a-z0-9])`. Text is already lowercased by `normalizeText`.
Lookarounds are chosen over `\b` because many keywords contain hyphens (`multi-agent`,
`shared type`, `small doc`); `\b` around a hyphen behaves unintuitively, lookarounds do not.
Regex metacharacters in keywords are escaped. Compiled regexes are cached in a module-level `Map`
keyed by keyword, since the same vocabulary is matched on every route.

**Deliberately NOT stemming.** `route` will no longer match `router`; `comment` will no longer
match `commented`. This is a behavior change and it is intended: the rule becomes predictable and
operator-controllable. If an operator wants `router`, they add `router` to the list. Fuzzy or
stemmed matching would reintroduce exactly the unpredictability this Brief removes.

**The safety-relevant direction, stated plainly.** `resolveTrivialEligibility()` is
`!profile && trivialHit && !nonTrivialHit && textLength < 180`. Removing a *false* non-trivial hit
can therefore flip a task from non-trivial to **trivial**, and trivial routes to a single
`implement` stage — skipping Understand, Architect, and both Reviews.

Worked example: `"rename the copyright header in the specific file"` currently hits
`trivial=rename` and `nonTrivial=ci` (inside "spe**ci**fic"), so it routes non-trivially. After the
fix, `ci` no longer matches and the task becomes trivial.

This is accepted, for three reasons:
1. The trivial gate still requires an explicit trivial keyword and a sub-180-character task; it is
   not a blanket downgrade.
2. The opposite error shrinks too — `copy`/`copyright` and `comment`/`commented` currently cause
   *false trivial* hits, which is the genuinely dangerous direction.
3. Routing accidentally correct because `ci` appears inside `decision` is not a safety property.
   It is a coincidence, and depending on it is worse than fixing it.

**Before/after delta is mandatory proof, not optional.** A sample of representative tasks must be
routed under both behaviors and every mode change enumerated in the Implement stage. A fix that
silently changes routing for unrelated tasks is not acceptable even if each individual change is
defensible.

### Constraints

- No change to `planTask`'s return shape, `harness.config.json` schema, or any exported signature.
- Empty, whitespace-only, and non-string keywords continue to be ignored.
- Matching stays case-insensitive via the existing `normalizeText`.
- No new dependency; `RegExp` only.
- Scoring weights (+3 keyword, +1 name token) are unchanged — only *what counts as a match* moves.

### Validation plan

- `node --test scripts/harness/test/prompt-router-keyword-matching-test.mjs` — new regressions.
- `npm run test:harness:prompt-router:run-bundle` — route/manifest compatibility.
- `npm run harness:decision:eval` — `mao-001` deterministic column must stop reporting `assistant`.
- Explicit before/after routing delta over a representative task sample, with every mode change
  listed.
- `npm run harness:config:self-test`, `npm run harness:docs:check`, `git diff --check`.
- `npm run test:harness:core`.

### Do NOT

- Do not add stemming, fuzzy matching, plural handling, or edit-distance matching.
- Do not edit keyword vocabulary in `harness.config.json` in this slice; vocabulary quality is a
  separate decision from match semantics.
- Do not change scoring weights, stage lists, or trivial-eligibility thresholds.
- Do not touch the manifest task-similarity comparison.
- Do not suppress or hide routing changes the delta check surfaces.

### Assumptions and risks

- `[KNOWN]` Some keywords exist *because* substring behavior made them work. `ci` may have been
  intended to catch "CI/CD"; after this change it matches only standalone `ci`. Vocabulary repair
  is explicitly deferred, and the delta check is what will expose any such case.
- `[KNOWN]` Lookbehind requires Node 16+. The repo already runs Node 24.
- `[LOW]` Regex construction from config strings is a ReDoS surface in principle. Keywords are
  literal and fully escaped, so the compiled patterns contain no quantifiers and cannot backtrack.
