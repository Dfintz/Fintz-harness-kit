## Review Depth Gate Ledger

### Gate ledger
1. Path: scripts/harness command execution boundary
   Gates run: 1, 3, 4, 4b, 5
   Result: FAIL (Gate 4, 4b)
   Evidence: command validator first-token allowlist plus shell:true execution permits separator bypass patterns.

2. Path: MCP task contracts (docs -> registry -> script)
   Gates run: 1, 3, 4, 5
   Result: FAIL (Gate 3, 4)
   Evidence: ownership contract surfaces (registry/docs) diverge from implementation flags.

3. Path: backend backup-code migration + runtime verification
   Gates run: 1, 3, 4, 4b, 5
   Result: FAIL (Gate 3, 4b)
   Evidence: migration text claims phased enforcement owned by env switch, runtime does not implement that control.

4. Path: frontend/mobile workspace surfaces
   Gates run: 1, 3, 4
   Result: BLOCKED
   Evidence: first-party source absent; ownership and boundary quality cannot be structurally evaluated.

5. Path: setup-harness-bootstrap skill validation step
   Gates run: 1, 3, 4
   Result: FAIL (Gate 3)
   Evidence: skill-owned deterministic validation command points to missing package script.

### Structural findings ledger

#### Blocker
1. Artifact or path: scripts/harness/command-validation.mjs -> run-loop.mjs / run-experiment.mjs
   Gate/depth check failed: Gate 4b isolation/safety boundary
   Evidence: validator and runner execution model mismatch (partial sanitization + shell execution).
   Why structure is wrong: safety boundary is split across two components with incompatible guarantees.
   Recommended fix: centralize command execution policy into a single argv-safe command builder and require all runners to consume it.
   Confidence: HIGH

#### Major
1. Artifact or path: MCP contract chain (.github/harness/registry.json, .github/harness/MCP-INTEGRATION.md, scripts/harness/harness-mcp-tasks.mjs)
   Gate/depth check failed: Gate 3 ownership, Gate 4 boundary integrity
   Evidence: contract owner docs publish incompatible syntax with tool owner implementation.
   Why structure is wrong: source-of-truth boundaries are unclear; generated and human docs drift independently.
   Recommended fix: designate script usage output as canonical contract and derive docs/registry examples from it.
   Confidence: HIGH

2. Artifact or path: backup-code migration and verifier
   Gate/depth check failed: Gate 3 ownership, Gate 4b isolation/safety
   Evidence: migration artifact claims phased rejection control that runtime verifier does not enforce.
   Why structure is wrong: policy decision is documented in migration layer but enforcement ownership belongs to auth verification layer.
   Recommended fix: move policy contract ownership to auth runtime docs/code and reduce migration to data-shape-only responsibilities.
   Confidence: HIGH

3. Artifact or path: .github/skills/setup-harness-bootstrap/SKILL.md vs package.json
   Gate/depth check failed: Gate 3 ownership
   Evidence: skill references validation script key absent from package command owner.
   Why structure is wrong: skill lifecycle contract is detached from executable command surface.
   Recommended fix: add a validation command contract test that resolves every npm script reference in skill docs.
   Confidence: HIGH

#### Minor
1. Artifact or path: dual MCP docs
   Gate/depth check failed: Gate 5 reuse
   Evidence: overlapping docs with split references.
   Why structure is wrong: duplicate documentation surfaces increase drift and reduce reliability.
   Recommended fix: collapse into one canonical guide and keep a minimal pointer/redirect file for compatibility.
   Confidence: HIGH

2. Artifact or path: frontend/ and apps/mobile
   Gate/depth check failed: blocked by missing evidence
   Evidence: only dependency/cache folders in workspace.
   Why structure is wrong: repository shape suggests app modules but lacks reviewable ownership artifacts.
   Recommended fix: either remove dead module folders or restore tracked manifests/source.
   Confidence: HIGH

### Brief divergence
- No divergence from architecture brief for this review cycle (review-only execution, no structural edits performed).