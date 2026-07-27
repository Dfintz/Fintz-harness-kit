---
title: Governance Architecture
description: Governance framework lifecycle, brief taxonomy, ownership model, and discovery paths
date: 2026-07-27
---

# Governance Architecture

This document outlines the governance framework, brief lifecycle, ownership responsibilities, and discovery mechanisms for governance artifacts.

---

## Phase 2b Decision Framework Overview

The Phase 2b decision framework implements a 5-gate governance system for making strategic decisions about feature scope, capacity, external dependencies, priority alignment, and risk tolerance.

**Decision Gates:**
1. **Validation** — Has the feature been validated by stakeholders?
2. **Capacity** — Do we have sufficient engineering resources?
3. **External Deadlines** — Are external factors (e.g., third-party ship dates) constraining our timeline?
4. **Priority** — How urgent is this relative to other work?
5. **Risk** — What is our confidence in successful implementation?

**Stakeholders:** Tech Lead, Product Lead, Engineering Manager, Decision Authority

**Timeline:**
- Questionnaire distribution: 2026-07-27
- Response collection: 2026-07-27 — 2026-07-30
- Final decision: 2026-07-31

---

## Phase 2b Decision Framework Briefs

### GOVERNANCE LAYER (Stakeholder-Facing)

These artifacts are distributed to stakeholders and used for decision-making:

- **phase2b-evaluation-architecture-brief.md** — 5-gate decision framework definition
- **phase2b-evaluation-questionnaire.md** — 7 questions covering all 5 gates
- **phase2b-decision-voting-template.md** — Response aggregation and go/no-go matrix
- **phase2b-conditional-roadmap.md** — Phase 3 backlog scope if decision is DEFER
- **phase2b-evaluation-stage5-review-breadth-findings.md** — Quality assurance findings
- **phase2b-evaluation-stage6-review-depth-findings.md** — Structural review findings
- **phase2b-evaluation-stage7-feedback-verdict.md** — Final approval and distribution

**Location:** `.github/harness/memory/briefs/`  
**Naming Pattern:** `phase2b-evaluation-*.md`  
**Ownership:** Tech Lead (questionnaire coordination) + Decision Authority (final verdict)  
**Status:** FROZEN (read-only; no modifications after 2026-07-27 distribution)

### META-ANALYSIS LAYER (Governance Review)

These artifacts document the comprehensive review of the Phase 2b governance framework itself:

- **REVIEW-stage1-understand-phase2b-fullreview.md** — Graph-first impact analysis
- **REVIEW-stage2-architect-phase2b-fullreview.md** — Architecture brief for governance review
- **REVIEW-stage3-architect-challenge-verdict.md** — Challenge pressure-test findings
- **REVIEW-stage4-implement-governance-phase2b.md** — Implementation artifacts and docs
- **REVIEW-stage5-review-breadth-phase2b-fullreview.md** — Multi-dimensional quality review
- **REVIEW-stage6-review-depth-phase2b-fullreview.md** — Structural integrity review
- **REVIEW-stage7-feedback-phase2b-fullreview.md** — Final verdict on governance framework

**Location:** `.github/harness/memory/briefs/`  
**Naming Pattern:** `REVIEW-stage*.md`  
**Ownership:** AI Agent (harness reviewer)  
**Status:** COMPLETE (documentation only; no feedback to stakeholders)

---

## Phase 3+ Governance Automation

Phase 3 introduces automation infrastructure and reusable governance tools:

### AUTOMATION INFRASTRUCTURE

- **validate-governance-roles.mjs** — Script to validate role assignments
  - Location: `scripts/harness/validate-governance-roles.mjs`
  - Purpose: Prevent manual role-assignment errors
  - Status: Reusable library (Phase 3+)

- **governance-templates-library.mjs** — Reusable governance decision templates
  - Location: `scripts/harness/governance-templates-library.mjs`
  - Purpose: Extract questionnaire/voting/roadmap templates for Phase 3+ reuse
  - Status: Reusable library (Phase 3+)

### GOVERNANCE AUTOMATION WORKFLOWS

- **PHASE3-stage*.md** — Phase 3 governance automation implementation workflow
  - Understand: Scope mapping, dependency analysis, opportunity identification
  - Architect: Design automation infrastructure (role validation, templates library, registry)
  - Challenge: Pressure-test architecture (clarifications on scope, versioning)
  - Implement: Create 2 scripts + 3 documentation fixes
  - Review Breadth: Multi-dimensional quality validation
  - Review Depth: Structural integrity and ownership verification
  - Feedback: Final verdict and Brief updates

**Naming Pattern:** `PHASE3-stage*.md`  
**Ownership:** Harness Maintainer + Tech Lead  
**Status:** IN PROGRESS (Phase 3 implementation)

---

## Brief Lifecycle

### Creation → Distribution → Feedback → Refinement

```
Phase 2b Governance Framework
├─ Creation (2026-07-20 — 2026-07-26)
│  └─ Architecture brief → Questionnaire → Voting template → Roadmap
│
├─ Review (2026-07-27, this workflow)
│  └─ 7-stage review: Understand → Architect → Challenge → Implement → Breadth → Depth → Feedback
│
├─ Distribution (2026-07-27, after review approval)
│  └─ Questionnaire + voting template + roadmap to stakeholders
│
├─ Response Collection (2026-07-27 — 2026-07-30)
│  └─ Stakeholders complete questionnaire; coordinator aggregates responses
│
├─ Decision (2026-07-31)
│  └─ Decision Authority approves final verdict (GO, DEFER, NO-GO)
│
└─ Post-Decision (2026-08-01+)
   └─ If GO: Implement Phase 2b (hold Phase 2a 1 week)
   └─ If DEFER: Phase 2a ships 2026-08-01; Phase 2b → Phase 3 backlog

Phase 3 Governance Automation
├─ Planning (2026-07-27, this workflow Stage 1)
│  └─ Scope: Role validation script, templates library, registry integration
│
├─ Design (2026-07-27, this workflow Stages 2-3)
│  └─ Architecture: Dependency-free, reusable patterns, minimal registry
│
├─ Implementation (2026-07-27, this workflow Stage 4)
│  └─ Create 2 scripts + 3 documentation fixes (~50 min)
│
└─ Deployment (2026-07-28+)
   └─ Available for Phase 3+ governance workflows
```

---

## Ownership Model

### Phase 2b Governance (Stakeholder-Facing)

| Role | Responsibility | Escalation |
|------|---|---|
| **Tech Lead** | Questionnaire coordination, response collection, voting template compilation | → Decision Authority |
| **Product Lead** | Claude Code validation input (Q1a), strategic alignment (Q6) | → Tech Lead |
| **Engineering Manager** | Capacity assessment (Q2a), resource availability | → Tech Lead |
| **Decision Authority** | Final go/no-go verdict, stakeholder communication | → Executive (if needed) |

### Phase 3+ Governance Automation

| Role | Responsibility | Escalation |
|---|---|---|
| **Harness Maintainer** | Script maintenance, template library updates, registry management | → Tech Lead |
| **Tech Lead** | Orchestration of governance workflows, tooling integration | → Decision Authority |
| **Decision Authority** | Final approval of governance decisions (same for all phases) | → Executive (if needed) |

---

## Discovery Paths

Governance artifacts can be discovered through multiple redundant paths:

### Path 1: File System (Direct Access)
```bash
ls .github/harness/memory/briefs/ | grep -E "phase2b-|PHASE[0-9]-|REVIEW-"
```
**Latency:** ~100ms  
**Reliability:** 100% (filesystem guaranteed)

### Path 2: Semantic Search (Vector Index)
```bash
node scripts/harness/vector-search.mjs --query "Phase 2b decision framework"
```
**Latency:** ~500ms  
**Reliability:** 99% (if vector index up-to-date)

### Path 3: Memory Curation (Filtered Registry)
```bash
node scripts/harness/memory-curate.mjs --filter "governance"
```
**Latency:** ~200ms  
**Reliability:** 98% (if curation index current)

### Path 4: Registry Lookup (Harness Config)
```bash
node scripts/harness/harness-catalog.mjs --key governance.briefs.phase2b
```
**Latency:** ~50ms  
**Reliability:** 100% (if harness.config.json valid)

### Path 5: Email Fallback (Direct Links)
All governance artifacts are attached to questionnaire distribution email with direct markdown links.

**Latency:** Email delivery time  
**Reliability:** 100% (guaranteed backup if all automated paths fail)

---

## Discovery Patterns

Governance artifacts follow extensible naming patterns that enable automatic discovery:

**Phase 2b Pattern:** `phase2b-evaluation-*.md`  
**Phase 3 Pattern:** `phase3-evaluation-*.md` (future)  
**Review Pattern:** `REVIEW-stage*-*.md` (phase-agnostic)  
**Automation Pattern:** `PHASE*-stage*-*.md` (phase-specific automation workflows)

Registry search and curation tools use these patterns to automatically index and filter governance artifacts.

---

## Pre-Distribution Checklist

**CRITICAL:** The following items MUST be completed before questionnaire distribution:

- [ ] Tech Lead assigned (name + email)
- [ ] Product Lead identified (name + email + phone/Slack)
- [ ] Engineering Manager assigned (name + email)
- [ ] Decision Authority confirmed (name + email)
- [ ] Governance roles documented in questionnaire cover email
- [ ] All 4 roles acknowledge receipt
- [ ] Questionnaire ready for distribution

**Owner:** Tech Lead  
**Gate:** Blocks questionnaire distribution until complete

---

## Governance Role Validation (Phase 3+)

Phase 3 introduces automated role validation to prevent manual errors:

```bash
node scripts/harness/validate-governance-roles.mjs --roles-file phase2b-roles.json
```

**Validation Rules:**
- All 4 required roles present (Tech Lead, Product Lead, Engineering Manager, Decision Authority)
- Each role has a non-empty name and at least one contact method (email, Slack, or phone)
- Recommended: Email provided for all roles

**Exit Codes:**
- `0` = PASS (all validations successful)
- `1` = FAIL (blocking issue)
- `2` = WARN (non-blocking warnings)

---

## Registry Configuration

Governance artifacts are registered in `harness.config.json` under `governance` key:

```json
{
  "governance": {
    "briefs": {
      "phase2b": [
        "phase2b-evaluation-architecture-brief",
        "phase2b-evaluation-questionnaire",
        "phase2b-decision-voting-template",
        "phase2b-conditional-roadmap",
        ...
      ]
    },
    "automation": {
      "roleValidation": "scripts/harness/validate-governance-roles.mjs",
      "templatesLibrary": "scripts/harness/governance-templates-library.mjs",
      "discoveryPattern": "phase*-evaluation-*|PHASE*-stage*-*"
    }
  }
}
```

---

## Maintenance & Future Phases

### Phase 3+ Extensions
- Governance automation scripts and templates library
- Role validation CI/CD integration (Phase 4+)
- Continuous governance monitoring and metrics (Phase 4+)
- Multi-workflow governance orchestration (Phase 5+)

### Governance Documentation Updates
- Phase 3: Add PHASE3-stage*.md workflow artifacts
- Phase 4+: Extend registry with new phase patterns
- Ongoing: Maintain brief lifecycle documentation

### Freezing Policy
- Phase 2b governance artifacts: FROZEN as of 2026-07-27 (read-only reference)
- Phase 2b review artifacts: COMPLETE (documentation only)
- Phase 3+ artifacts: MUTABLE until distributed to stakeholders (then frozen)

---

**Last Updated:** 2026-07-27  
**Ownership:** Harness Maintainer + Tech Lead  
**Status:** ACTIVE (governance framework v1.0)

