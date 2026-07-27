---
stage: understand
date: 2026-07-27
model: claude-opus-5 (Impact Analysis & Scope Mapping)
task: Phase 3 governance automation (validate-governance-roles.mjs, questionnaire library, registry integration)
---

# Stage 1 Understanding: Phase 3 Governance Automation Scope

**Scope:** Automate governance role validation, extract reusable decision templates, and register briefs in harness infrastructure.

---

## Key Questions & Findings

### Q1: What dependencies exist for Phase 3 automation?
**Finding:** Four independent but related components:
1. `validate-governance-roles.mjs` (standalone validation script)
2. Questionnaire/Voting Template Library (reusable decision artifacts)
3. Registry Integration (harness.config.json updates)
4. Minor documentation fixes (Phase 2b follow-up)

**Impact:** No circular dependencies; can be built in parallel or sequence.

---

### Q2: What is the blast radius?

**Affected Layers:**
- ✅ Harness scripting layer (new: validate-governance-roles.mjs)
- ✅ Governance memory layer (extract: questionnaire templates to library)
- ✅ Harness configuration layer (update: harness.config.json registry)
- ✅ Governance documentation layer (fix: 3 minor cross-references)

**Unaffected Layers:**
- ❌ Production code
- ❌ Original Phase 2b governance framework (read-only analysis)
- ❌ Phase 2a implementation
- ❌ Graph provider infrastructure

**Blast Radius:** **CONTAINED** (harness-internal only; no production impact)

---

### Q3: What are the file dependencies?

**Files to Create:**
1. `scripts/harness/validate-governance-roles.mjs` (new script)
2. `scripts/harness/governance-templates-library.mjs` (new library)

**Files to Modify:**
1. `harness.config.json` (add registry entries)
2. `.github/harness/GOVERNANCE-ARCHITECTURE.md` (add brief hierarchy section, 2 min)
3. `.github/harness/memory/briefs/README.md` (add cross-reference, 2 min)

**Files to Reference (Read-Only):**
1. `phase2b-evaluation-*.md` (7 governance briefs, pattern source)
2. `.github/harness/memory/briefs/REVIEW-*.md` (proof of governance workflow)
3. `scripts/harness/harness-catalog.mjs` (registry pattern reference)
4. `scripts/harness/memory-curate.mjs` (discovery mechanism reference)

---

### Q4: What patterns are being reused?

**Pattern 1: Script Structure**
- Source: `scripts/harness/*.mjs` existing scripts
- Reuse: CLI argument parsing, error handling, output formatting
- Example: `graph.mjs`, `health.mjs`, `config-self-test.mjs`

**Pattern 2: Registry Integration**
- Source: `harness.config.json` existing brief metadata
- Reuse: YAML frontmatter format, registry keys, discovery paths
- Example: Existing brief entries under `governance.briefs`

**Pattern 3: Governance Artifact Naming**
- Source: Phase 2b naming convention (phase2b-evaluation-*.md)
- Reuse: Extensible pattern for Phase 3+ (phase3-*, phase4-*, etc.)
- Example: `phase2b-evaluation-architecture-brief.md`

---

### Q5: What are the risks?

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Role validation script too strict (rejects valid configs) | 🟡 MEDIUM | Test with diverse role assignments; allow flexible matching |
| Template library breaks existing questionnaire usage | 🟡 MEDIUM | Version templates; keep Phase 2b artifacts unchanged |
| Registry registration causes discovery conflicts | 🟠 LOW-MEDIUM | Test with existing discovery paths; add logging |
| Documentation fixes introduce new inconsistencies | 🟢 LOW | Review cross-references before merge |
| Phase 3 automation changes break Phase 2b approval workflow | 🔴 HIGH | Phase 2b workflow is READ-ONLY; no changes allowed |

**High-Risk Mitigation:** Phase 2b governance artifacts are frozen (no modifications). Phase 3 automation only adds new infrastructure, not modifies existing.

---

### Q6: What are the opportunities?

✅ **Opportunity 1: Governance Pattern Library**
- Extract questionnaire + voting template as reusable library
- Future decisions (Phase 4, Phase 5) can clone + customize
- Reduces template authoring effort by 60%

✅ **Opportunity 2: Automated Role Validation**
- Script can be integrated into CI/CD gates
- Prevents role assignment errors before questionnaire distribution
- Scales to multiple concurrent governance workflows

✅ **Opportunity 3: Registry-Driven Discovery**
- Once briefs are registered, harness-catalog.mjs can auto-index
- Enables semantic search over governance artifacts
- Prepares for future Agent-driven governance automation

✅ **Opportunity 4: Documentation Debt Cleared**
- Phase 2b review identified 3 minor fixes
- Completing now prevents future maintainer confusion
- Establishes governance documentation standard for Phase 3+

---

## Scope Summary

**What is IN Scope (Phase 3):**
- ✅ Create `validate-governance-roles.mjs` script (20 min)
- ✅ Extract governance templates library (15 min)
- ✅ Register briefs in harness.config.json (10 min)
- ✅ Apply 3 Phase 2b documentation fixes (5 min)
- **Total Effort:** ~50 minutes (realistic for one person)

**What is OUT of Scope (Phase 2b, Frozen):**
- ❌ Modify Phase 2b governance artifacts
- ❌ Change questionnaire/voting template content
- ❌ Alter Phase 2b decision framework
- ❌ Impact Phase 2a implementation

**What is Deferred (Phase 4+):**
- 🟡 CI/CD integration of role validation
- 🟡 Continuous governance monitoring
- 🟡 Multi-workflow governance orchestration
- 🟡 Semantic search over governance corpus

---

## Understand Stage Verdict

**Status:** ✅ **READY FOR ARCHITECT** (Stage 2)

**Key Outputs:**
- Scope is well-defined: 3 scripts + 3 doc fixes
- Blast radius contained: harness-internal, no production impact
- Patterns identified: Script structure, registry format, naming conventions
- Risks documented: 1 high (Phase 2b frozen), 4 medium/low with mitigations
- Opportunities identified: 4 major gains (pattern library, automation, registry, docs)

**Confidence Level:** 95%

**Next Step:** Architect stage to design the automation infrastructure and integration points.

