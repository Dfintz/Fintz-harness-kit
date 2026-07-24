# Skill-to-Model Mapping

**Effective Date:** 2026-07-24  
**Methodology:** Phase 4 semantic evaluation results + skill purpose analysis  
**Models:** GitHub Copilot (claude-opus-4.8, gpt-5.3-codex, claude-haiku-4.5)

---

## Executive Summary

Each harness skill has been mapped to optimal GitHub Copilot models based on:
1. **Phase 4 semantic evaluation benchmarks** — actual performance scores
2. **Skill category & reasoning depth** — inferred model fit from purpose
3. **Bidirectional alignment** — skill requirements ↔ model strengths

**Key Findings:**
- **Reasoning-heavy skills** (architect, understand-process, deterministic-validation) → `claude-opus-4.8`
- **Code-implementation skills** (implement, review-breadth, review-depth) → `gpt-5.3-codex` (primary) + `claude-opus-4.8` (fallback)
- **Workflow/procedural skills** (pr, eval-first-tuning, remember, feedback) → `claude-opus-4.8` (structured guidance)
- **Lightweight/documentation** (teach-agent, ai-techniques-radar, prototype) → `claude-opus-4.8` (primary) or `claude-haiku-4.5` (cost-optimized)

---

## Skill-Model Matrix

| Skill | Category | Primary Model | Reason | Phase 4 Score | Fallback | Why Fallback |
|-------|----------|---|---------|--------|----------|---|
| **pr** | Workflow | claude-opus-4.8 | PR discipline requires structured reasoning + review gates | +252.3% | gpt-5.3-codex | Code-review focus |
| **eval-first-tuning** | Workflow | claude-opus-4.8 | Baseline + comparison logic = multi-step reasoning | +251.5% | claude-haiku-4.5 | Simpler eval patterns |
| **remember** | Workflow | claude-opus-4.8 | Persistence + reuse requires architectural judgment | +219.8% | gpt-5.3-codex | Cross-file context |
| **feedback** | Workflow | claude-opus-4.8 | Challenge resolution = structured verdict logic | +219.0% | gpt-5.3-codex | Code context fallback |
| **prototype** | Implementation | gpt-5.3-codex | Throwaway logic validation = code-focused | +219.0% | claude-opus-4.8 | Complex state reasoning |
| **architect** | Reasoning | claude-opus-4.8 | Architecture Brief = sustained reasoning + boundaries | +201.6% | claude-haiku-4.5 | Simpler architectures |
| **understand-process** | Reasoning | claude-opus-4.8 | Graph-first dependency mapping = multi-hop reasoning | +199.5% | gpt-5.3-codex | Code dependency analysis |
| **doubt-driven-development** | Reasoning | claude-opus-4.8 | Security skepticism + correctness = deep analysis | +149.4% | gpt-5.3-codex | Code security focus |
| **setup-harness-bootstrap** | System | claude-opus-4.8 | Complete stage structure = comprehensive orchestration | +145.0% | claude-haiku-4.5 | Simple bootstraps |
| **implement** | Implementation | gpt-5.3-codex | Code generation + deliverables = coding specialist | +130.0% | claude-opus-4.8 | Complex logic flows |
| **review-breadth** | Review | claude-opus-4.8 | Coverage dimension = broad scope reasoning | +113.2% | gpt-5.3-codex | Code patterns review |
| **budget-aware-execution** | System | claude-opus-4.8 | Resource boundary discipline = constraint reasoning | +111.8% | claude-haiku-4.5 | Simple budget tracking |
| **context-engineering** | System | claude-opus-4.8 | Memory hygiene + task switching = context preservation | +111.4% | claude-haiku-4.5 | Simpler sessions |
| **retrieval-quality-ops** | Evaluation | claude-opus-4.8 | A/B evaluation framework = rigorous comparison logic | +110.5% | gpt-5.3-codex | Metric computation |
| **observability-and-instrumentation** | System | claude-opus-4.8 | Telemetry + RED metrics = comprehensive guidance | +108.4% | claude-haiku-4.5 | Basic telemetry |
| **teach-agent** | Teaching | claude-opus-4.8 | Machine-executable guidance = procedural clarity | +101.8% | claude-haiku-4.5 | Tutorial documentation |
| **ai-techniques-radar** | Teaching | claude-opus-4.8 | Technique triage + adoption = decision reasoning | +106.3% | claude-haiku-4.5 | Simple evaluations |
| **deterministic-validation** | Verification | claude-opus-4.8 | Proof gates (CLAIM→EXTRACT→DOUBT→RECONCILE) = strict logic | +111.8% | gpt-5.3-codex | Code assertions |
| **run-loop** | Verification | claude-opus-4.8 | Loop contracts + guardrails = deterministic enforcement | +99.5% | gpt-5.3-codex | Code loop analysis |
| **review-depth** | Review | claude-opus-4.8 | Ownership + boundaries + reuse = structural depth | +83.2% | gpt-5.3-codex | Code structure focus |

---

## Model Capability Profile

### claude-opus-4.8
**Tier:** High-Reasoning  
**Strengths:**
- Sustained multi-hop reasoning over large contexts
- Architectural judgment and cross-cutting analysis
- Structured decision logic (verdicts, gates, proofs)
- Complex state transitions and constraint reasoning
- Teaching and procedural guidance

**Use For:**
- Understand, Architect, Review Breadth, Review Depth, Feedback
- Eval-first-tuning, deterministic-validation, run-loop
- Teaching skills (teach-agent, ai-techniques-radar)
- System orchestration (observability, budget-aware-execution, context-engineering)

**Benchmarks:** GPQA Diamond, MMLU-Pro, long-context SWE-bench  
**Cost:** Standard tier

---

### gpt-5.3-codex
**Tier:** Balanced-Coding  
**Strengths:**
- Fast, accurate code generation
- Code-focused implementation and refactoring
- Debugging and code-pattern analysis
- Implementation details and concrete examples
- Strong instruction-following

**Use For:**
- Implement, build-fix, test-fix
- Code-heavy review (review-breadth, review-depth)
- Prototype validation (logic implementation)
- Fallback for understand-process (dependency analysis)

**Benchmarks:** SWE-bench coding tasks  
**Cost:** Balanced (faster than opus)

---

### claude-haiku-4.5
**Tier:** Lightweight  
**Strengths:**
- Fast, low-cost guidance
- Documentation and simple explanations
- Fallback for straightforward tasks
- Good for cost-optimized workflows

**Use For:**
- Lightweight documentation tasks
- Cost-optimized fallbacks for evaluation, setup, system guidance
- NOT recommended for architecture gates, security review, proof verification

**Benchmarks:** Coding tasks, short-context tasks  
**Cost:** Lowest tier

---

## Skill-Model Justification (Detailed)

### Workflow Skills (claude-opus-4.8)

**pr (+252.3%)**
- **Need:** PR discipline requires understanding review gates, verification flow, release process
- **Why Opus:** Multi-step reasoning (creation → verification → review → merge gate)
- **Fallback:** gpt-5.3-codex handles code-specific review patterns

**eval-first-tuning (+251.5%)**
- **Need:** Baseline establishment + rigorous variant comparison + decision gates
- **Why Opus:** Comparison logic and metric-driven reasoning
- **Fallback:** claude-haiku-4.5 for simpler A/B patterns

**remember (+219.8%)**
- **Need:** Determine what's reusable, when to persist, how to integrate with harness memory surfaces
- **Why Opus:** Architectural judgment (what warrants persistence vs. what's ephemeral)
- **Fallback:** gpt-5.3-codex for cross-file context stitching

**feedback (+219.0%)**
- **Need:** Point-by-point challenge resolution with clear verdicts
- **Why Opus:** Structured decision logic + evidence reconciliation
- **Fallback:** gpt-5.3-codex for code-context fallback

---

### Implementation Skills (gpt-5.3-codex primary, opus fallback)

**implement (+130.0%)**
- **Need:** Code generation, deliverables, proof artifacts
- **Why Codex:** Coding specialist, fast turnaround
- **Fallback:** claude-opus-4.8 for complex state transitions or multi-module logic

**prototype (+219.0%)**
- **Need:** Throwaway logic validation (state models, data shapes)
- **Why Codex:** Code-focused prototyping, rapid iteration
- **Fallback:** claude-opus-4.8 for intricate state logic or cross-domain design

---

### Reasoning-Heavy Skills (claude-opus-4.8)

**architect (+201.6%)**
- **Need:** Architecture Brief with explicit boundary specifications and reuse patterns
- **Why Opus:** Sustained architectural reasoning across design trade-offs
- **Fallback:** claude-haiku-4.5 for simpler, straightforward designs

**understand-process (+199.5%)**
- **Need:** Graph-first dependency discovery and blast-radius analysis
- **Why Opus:** Multi-hop dependency reasoning
- **Fallback:** gpt-5.3-codex for pure code-dependency analysis

**doubt-driven-development (+149.4%)**
- **Need:** Security skepticism, correctness discipline, high-stakes change review
- **Why Opus:** Deep analysis, cross-model review capability
- **Fallback:** gpt-5.3-codex for code-security focus

**deterministic-validation (+111.8%)**
- **Need:** CLAIM→EXTRACT→DOUBT→RECONCILE→STOP proof gates
- **Why Opus:** Strict logical reasoning, objective proof validation
- **Fallback:** gpt-5.3-codex for code assertions and test validation

**review-breadth (+113.2%)**
- **Need:** Correctness, standards, safety, completeness coverage
- **Why Opus:** Broad-scope reasoning across dimensions
- **Fallback:** gpt-5.3-codex for code-pattern coverage

**review-depth (+83.2%)**
- **Need:** Ownership, boundaries, reuse pattern conformance
- **Why Opus:** Structural depth analysis
- **Fallback:** gpt-5.3-codex for code structure focus

---

### System & Operations Skills (claude-opus-4.8)

**observability-and-instrumentation (+108.4%)**
- **Need:** Telemetry patterns, RED metrics, structured logging guidance
- **Why Opus:** Comprehensive system reasoning
- **Fallback:** claude-haiku-4.5 for basic telemetry setup

**budget-aware-execution (+111.8%)**
- **Need:** Resource boundary discipline, checkpoint reasoning, budget preservation
- **Why Opus:** Constraint reasoning and guardrail enforcement
- **Fallback:** claude-haiku-4.5 for simple budget tracking

**context-engineering (+111.4%)**
- **Need:** Session memory hygiene, task-switch checkpointing
- **Why Opus:** Context preservation and recovery reasoning
- **Fallback:** claude-haiku-4.5 for simpler sessions

**setup-harness-bootstrap (+145.0%)**
- **Need:** Complete stage structure initialization, deterministic workflow setup
- **Why Opus:** Comprehensive orchestration reasoning
- **Fallback:** claude-haiku-4.5 for simpler bootstrap scenarios

**run-loop (+99.5%)**
- **Need:** Loop JSON contract enforcement, bounds adherence, guardrail non-negotiability
- **Why Opus:** Deterministic constraint enforcement
- **Fallback:** gpt-5.3-codex for code-loop analysis

---

### Evaluation & Ops Skills (claude-opus-4.8)

**eval-first-tuning** → See Workflow Skills above

**retrieval-quality-ops (+110.5%)**
- **Need:** A/B evaluation framework with recall@K, token cost, task success metrics
- **Why Opus:** Rigorous comparison methodology reasoning
- **Fallback:** gpt-5.3-codex for metric computation and data handling

---

### Teaching Skills (claude-opus-4.8 primary, haiku fallback)

**teach-agent (+101.8%)**
- **Need:** Machine-executable guidance (not prose), procedural clarity
- **Why Opus:** Structured procedural reasoning, agent-first mindset
- **Fallback:** claude-haiku-4.5 for simpler tutorial documentation

**ai-techniques-radar (+106.3%)**
- **Need:** Technique triage, adoption decisions, repository-specific routing
- **Why Opus:** Decision reasoning and comparative analysis
- **Fallback:** claude-haiku-4.5 for simple evaluation tasks

---

## Cross-Model Review Strategy

**Rule:** Implementer model ≠ Reviewer model

**Recommended Pairings:**
- Implement (gpt-5.3-codex) → Review (claude-opus-4.8) ✓
- Implement (claude-opus-4.8) → Review (gpt-5.3-codex) ✓ (code-heavy changes)
- Both on Copilot Auto → Explicitly select distinct models for review-fix pass

---

## Integration with harness.config.json

```json
"skillModelMapping": {
  "pr": {
    "primary": "claude-opus-4.8",
    "fallback": "gpt-5.3-codex",
    "reason": "PR discipline requires structured workflow reasoning"
  },
  "eval-first-tuning": {
    "primary": "claude-opus-4.8",
    "fallback": "claude-haiku-4.5",
    "reason": "Baseline + comparison logic requires multi-step reasoning"
  },
  ... (one entry per skill)
}
```

---

## Usage Guidelines

1. **For Human-Initiated Skill Invocation:**
   - Use primary model by default
   - Switch to fallback only if cost constraints or latency require it
   - Never use fallback for architecture gates (Understand, Architect, Feedback)

2. **For Harness Routing:**
   - harness:route command respects skillModelMapping from config
   - Cross-model review enforced via models.implementer !== models.reviewer

3. **For Evaluation & Testing:**
   - Phase 4 baseline uses these mappings
   - Future optimizer runs should validate model fidelity against benchmarks

---

## Maintenance

- **Update Frequency:** Quarterly or when new models become available
- **Trigger:** New benchmark data, model updates, or cost analysis
- **Process:** Re-run Phase 4 evaluator on subset of skills with new model candidates
