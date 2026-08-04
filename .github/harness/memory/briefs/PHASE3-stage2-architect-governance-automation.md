---
stage: architect
date: 2026-07-27
model: gpt-5.6-luna (Architecture Design)
resource: PHASE3-stage1-understand-governance-automation.md, .github/harness/memory/briefs/REVIEW-stage7-feedback-phase2b-fullreview.md
status: implemented
---

# Stage 2 Architecture Brief: Phase 3 Governance Automation

**resource:** [PHASE3-stage1-understand-governance-automation.md](PHASE3-stage1-understand-governance-automation.md), [Phase 2b governance review artifacts](./)

---

## Architecture Overview

**Objective:** Build three complementary governance automation systems:
1. **Role Validation System** — Prevent manual role-assignment errors
2. **Templates Library** — Extract reusable decision frameworks
3. **Registry Integration** — Enable automated governance artifact discovery

---

## Architectural Decisions

### Decision 1: Role Validation Script Architecture

**Design Pattern:** Standalone validation script (similar to `health.mjs`, `config-self-test.mjs`)

**Components:**
```
validate-governance-roles.mjs
├─ Input: governance roles object or config file path
├─ Validation Rules:
│  ├─ Check all 4 required roles present (Tech Lead, Product Lead, Eng Manager, Decision Authority)
│  ├─ Check role values are non-empty strings
│  ├─ Check contact info (email preferred, at minimum name + contact method)
│  └─ Optional: Cross-check with organizational records (Phase 4+)
├─ Output: 
│  ├─ Validation result (PASS/FAIL/WARN)
│  ├─ Error messages for missing/invalid fields
│  └─ Suggestions for fixes
└─ Exit Codes:
   ├─ 0 = All validations passed
   ├─ 1 = Validation failed (blocking issue)
   └─ 2 = Validation warning (missing optional fields)
```

**Integration Points:**
- Can be called from governance orchestration workflows (Phase 4)
- Can be integrated into pre-distribution CI gate (Phase 4+)
- Can be called programmatically: `validateGovernanceRoles(rolesObject) → { passed, errors, warnings }`

**Phase 3 Scope Clarification:** Script is library-ready (export functions) and runnable as CLI. **Phase 3 does NOT integrate into CI gates.** CI/CD integration is Phase 4+ work. Role validation in Phase 3 is opt-in and manual.

**Dependencies:** None (zero external dependencies; pure validation logic)

---

### Decision 2: Governance Templates Library Architecture

**Design Pattern:** Extractable, composable decision templates (similar to `phase2b-evaluation-*.md` briefs)

**Library Structure:**
```
governance-templates-library.mjs
├─ Template 1: Decision Questionnaire
│  ├─ Source: phase2b-evaluation-questionnaire.md
│  ├─ Schema: { questions[], gateMapping, scoringRubric }
│  └─ Reuse: clone for Phase 3 + customize Q1, Q2, Q7
│
├─ Template 2: Voting Template  
│  ├─ Source: phase2b-decision-voting-template.md
│  ├─ Schema: { responseAggregation, decisionMatrix, conditionalRoadmap }
│  └─ Reuse: clone for Phase 3 + update decision criteria
│
├─ Template 3: Conditional Roadmap
│  ├─ Source: phase2b-conditional-roadmap.md
│  ├─ Schema: { deferredScope[], parallelActivities, timeline }
│  └─ Reuse: clone for Phase 3 + add phase-specific backlog items
│
└─ Export Functions:
   ├─ getTemplate(templateName, phase) → template object
   ├─ cloneTemplate(templateName, phase, customizations) → new template
   ├─ validateTemplate(template) → { valid, errors }
   └─ exportToMarkdown(template) → markdown string
```

**Integration Points:**
- Used by future governance workflows (Phase 3, 4, 5)
- Can be accessed from harness CLI or programmatically
- Integrates with memory curation for template versioning

**Template Versioning:** Phase 2b templates are frozen (v1.0). Phase 3+ templates derive from v1.0 but allow customization of questions, gate mapping, and roadmap items. Template schema includes `version` field and `readOnly` markers to enable safe co-existence of multiple governance versions:
```javascript
// Phase 2b Template (Frozen)
{ questionnaireVersion: "2b", questions: [...], gateMapping: {...}, readOnly: true }

// Phase 3+ Template (Customizable)
{ questionnaireVersion: "3+", questions: [...], gateMapping: {...}, customFields: {...}, readOnly: false }
```

**Dependencies:** None (pure data structures + utility functions)

---

### Decision 3: Registry Integration Architecture

**Design Pattern:** Minimal registry entries in `harness.config.json` under `governance` key

**Current harness.config.json Structure:**
```json
{
  "project": { ... },
  "scripts": { ... },
  "models": { ... },
  "governance": {
    "briefs": [
      {
        "key": "phase2b-evaluation-architecture-brief",
        "name": "Phase 2b Decision Framework",
        "path": ".github/harness/memory/briefs/phase2b-evaluation-architecture-brief.md",
        "discoveryPattern": "phase2b-evaluation-*",
        "phase": "2b"
      },
      ...
    ]
  }
}
```

**Proposed Addition (Phase 3):**
```json
{
  "governance": {
    "briefs": [
      // ... Phase 2b entries above ...
    ],
    "automation": {
      "scripts": [
        {
          "name": "validate-governance-roles",
          "path": "scripts/harness/validate-governance-roles.mjs",
          "description": "Validate governance role assignments"
        },
        {
          "name": "governance-templates-library",
          "path": "scripts/harness/governance-templates-library.mjs",
          "description": "Reusable decision templates"
        }
      ],
      "templates": {
        "questionnaire": ".../governance-templates-library.mjs#getTemplate('questionnaire')",
        "votingTemplate": ".../governance-templates-library.mjs#getTemplate('voting')",
        "conditionalRoadmap": ".../governance-templates-library.mjs#getTemplate('roadmap')"
      }
    }
  }
}
```

**Integration Points:**
- Registered in harness-catalog.mjs discovery index (Phase 2)
- Accessible via `harness-catalog.mjs --key governance.automation`
- Used by memory-curate.mjs for governance artifact filtering

**Discovery Chain:**
```
User Query: "governance automation"
↓
harness-catalog.mjs (registry lookup)
↓
Found: validate-governance-roles.mjs + governance-templates-library.mjs
↓
Execute: npm scripts/harness/validate-governance-roles.mjs --roles <config>
```

---

### Decision 4: Documentation Fixes Scope

**Fix 1: GOVERNANCE-ARCHITECTURE.md Brief Hierarchy** (2 min)
- Add section dividers between GOVERNANCE briefs (phase2b-evaluation-*) and REVIEW briefs (REVIEW-stage*)
- Purpose: Clarify layering for future maintainers

**Fix 2: briefs/README.md Cross-Reference** (2 min)
- Add link to GOVERNANCE-ARCHITECTURE.md at top of directory guide
- Purpose: Improve navigation between governance docs

**Fix 3: Phase 3 Documentation Note** (1 min)
- Add note in GOVERNANCE-ARCHITECTURE.md about Phase 3+ automation (brief mention)
- Purpose: Establish governance automation context for future readers

**Total Effort:** 5 minutes

---

## Architectural Constraints (Do-NOTs)

❌ **Do NOT modify Phase 2b governance artifacts** — They are frozen as stakeholder-facing documents

❌ **Do NOT add external dependencies** — All scripts must be pure Node.js (no npm packages beyond existing harness deps)

❌ **Do NOT change harness command structure** — Scripts must follow existing harness script patterns (routing, error codes, output format)

❌ **Do NOT expose questionnaire templates before Phase 3 planning** — Templates are internal until Phase 3 decision framework is approved

❌ **Do NOT require role validation for Phase 2b questionnaire** — Only for Phase 3+ workflows (Phase 2b is already distributed)

---

## Implementation Checkpoints

**Pre-Implementation Checklist:**
- [ ] Phase 2b governance artifacts remain read-only (verify in implementation)
- [ ] All new scripts follow harness script structure (main.mjs pattern)
- [ ] No new npm dependencies introduced
- [ ] Registry entries documented with discovery pattern
- [ ] Templates library can be imported as module and run as CLI

**Post-Implementation Checklist:**
- [ ] `validate-governance-roles.mjs` runs without errors; returns correct exit codes
- [ ] `governance-templates-library.mjs` exports all three template functions
- [ ] `harness.config.json` loads without errors; registry entries validate
- [ ] Documentation fixes applied; cross-references working
- [ ] All 4 components (2 scripts + 2 docs + 1 registry) integrated

---

## Architecture Verdict

**Status:** ✅ **READY FOR CHALLENGE** (Stage 3)

**Key Design Decisions:**
1. Standalone, dependency-free script architecture (matches harness patterns)
2. Extractable templates library (enables Phase 3+ reuse)
3. Minimal registry additions (curation-only approach)
4. Read-only Phase 2b (governance artifacts frozen)

**Architectural Risks Addressed:**
- ✅ Role validation won't break existing workflows (Phase 2b-only gate)
- ✅ Templates library isolated from questionnaire usage (new export functions)
- ✅ Registry doesn't conflict with existing discovery (additive, not modifying)
- ✅ Documentation fixes are additive (new sections, not rewrites)

**Confidence Level:** 94%

**Next Step:** Challenge stage to pressure-test this architecture design.

