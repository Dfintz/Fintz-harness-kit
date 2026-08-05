## Architecture Brief
resource: .github/harness/memory/briefs/skills-v1-2-0-validation-understand-2026-08-05.md, .github/skills/, .github/harness/HARNESS.md, .github/harness/registry.json, harness.config.json, https://github.com/mattpocock/skills/releases/tag/v1.2.0

### Objective
- Validate local skills coverage against mattpocock/skills v1.2.0 and integrate the highest-value, lowest-risk compatibility pattern for cross-harness skill metadata.

### Scope and boundaries
- In scope:
  - Add `agents/openai.yaml` sidecar metadata under each `.github/skills/<skill>/` directory.
  - Add one operator-facing validation/integration report artifact in harness memory briefs.
  - Add one concise harness-doc note that these sidecars exist as compatibility metadata only.
- Out of scope:
  - Importing new external behavior skills (`wizard`, `to-questionnaire`, `wait-what`) into the core harness flow.
  - Changing prompt-router decision logic.
  - Enforcing new policy behavior from sidecar metadata at runtime.

### Artifacts to create
- `.github/skills/*/agents/openai.yaml` - Codex-facing skill metadata sidecar (display name + short description), additive and non-executable.
- `.github/harness/memory/briefs/skills-v1-2-0-validation-implementation-2026-08-05.md` - implementation and evidence summary.
- `.github/harness/memory/briefs/skills-v1-2-0-validation-review-breadth-2026-08-05.md` - breadth findings ledger.
- `.github/harness/memory/briefs/skills-v1-2-0-validation-review-depth-2026-08-05.md` - depth gate ledger.
- `.github/harness/memory/briefs/skills-v1-2-0-validation-feedback-2026-08-05.md` - feedback verdict record.

### Artifacts to modify
- `.github/harness/HARNESS.md` - note the optional Codex metadata sidecar convention for local `.github/skills/*` folders.

### Key decisions
- Decision: Integrate only metadata sidecars from v1.2.0 now.
  - Evidence/reasoning: additive, low-risk, directly relevant to cross-harness support, and currently absent.
- Decision: Do not import new behavioral skills in this pass.
  - Evidence/reasoning: this repo curates harness-stage/domain skills; generic behavior skills need separate adoption criteria and can change interaction style.
- Decision: Keep sidecars informational.
  - Evidence/reasoning: avoid silently changing routing/invocation policy semantics without dedicated design and tests.

### Constraints
- No runtime behavior change in router or stage sequencing.
- Sidecar content must stay concise and match each local skill's purpose.
- Preserve existing file layout and naming conventions.
- Validate docs/contracts after edits using `npm run harness:docs:check`.

### Validation plan
- Deterministic checks:
  - `npm run harness:docs:check`
  - `git diff --check`
- Coverage checks:
  - verify each `.github/skills/*` directory includes `agents/openai.yaml`.
  - confirm HARNESS note is accurate and non-contradictory.

### Do NOT
- Do NOT modify `harness.config.json` routing profiles in this pass.
- Do NOT add policy flags that alter implicit invocation behavior yet.
- Do NOT add new skills from external repo without separate architecture brief.

### Assumptions and risks
- [UNVERIFIED] Codex metadata sidecars are consumed by all downstream toolchains used by this repo.
  - Affects: immediate practical impact of metadata files.
  - Risk if wrong: low; sidecars remain harmless documentation metadata.
- [UNVERIFIED] Current user intent is compatibility validation rather than broad skill-surface expansion.
  - Affects: exclusion of importing additional behavior skills.
  - Risk if wrong: medium; user may request a follow-up pass for specific skill imports.
