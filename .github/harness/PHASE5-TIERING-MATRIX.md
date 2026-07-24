# Phase 5: Comprehensive Model Tiering Matrix (2026-07-24)

**Status**: Complete model portfolio review with GitHub Copilot official supported models  
**Scope**: All 20 harness skills with 5-tier strategy  
**Data Source**: GitHub Copilot Supported Models (https://docs.github.com/en/copilot/reference/ai-models/supported-models)

---

## Executive Summary

Phase 5 expands the model portfolio from 3 models (Phase 4) to a comprehensive 5-tier strategy leveraging the complete GitHub Copilot ecosystem:

| Tier | Purpose | Primary Model(s) | Use Case |
|------|---------|-----------------|----------|
| **Ultra-Reasoning** | Complex architectural decisions, multi-stage reasoning | Claude Opus 5, GPT-5.6 Luna | architect, feedback, review-depth |
| **High-Reasoning** | Advanced reasoning with balance | Claude Opus 4.8, GPT-5.5, Gemini 3.6 Flash | Most skills (13/20) |
| **Balanced-Coding** | Code generation + logic | GPT-5.3-Codex, GPT-5.4, Claude Sonnet 5, MAI-Code-1-Flash | implement, prototype, run-loop |
| **Fast-Execution** | Speed-optimized with acceptable quality | Gemini 3.5 Flash, GPT-5.4 mini | budget-aware-execution, quick validation |
| **Cost-Optimized** | Budget tier for simple tasks | Claude Haiku 4.5, GPT-5 mini, Gemini 3.5 Flash | fallback for all tiers |

---

## Model Capability Profiles

### **Tier 1: Ultra-Reasoning** (Complex multi-stage tasks)

| Model | Strengths | Limitations | Best For |
|-------|-----------|-------------|----------|
| **Claude Opus 5** ⭐ NEW | Highest reasoning depth, long context (1M), configurable reasoning levels | Higher latency, cost premium | Architectural decisions, complex cross-cutting concerns |
| **GPT-5.6 Luna** ⭐ NEW | Advanced reasoning, creative problem-solving | May be verbose in output | Strategic planning, novel approaches |
| **GPT-5.6 Terra** ⭐ NEW | Balanced reasoning + speed | Slightly lower accuracy than Luna | Time-sensitive complex decisions |

**Phase 5 Rationale**: Anthropic Opus 5 and OpenAI GPT-5.6 variants represent frontier reasoning capabilities. Claude Opus 5 surpasses Opus 4.8 with enhanced reasoning depth and extended context window. These are essential for skills requiring multi-turn validation or cross-cutting analysis (feedback, architect).

---

### **Tier 2: High-Reasoning** (Majority of harness skills)

| Model | Strengths | Limitations | Best For |
|-------|-----------|-------------|----------|
| **Claude Opus 4.8** ⭐ RETAINED | Strong reasoning, 200K context, stable performance | Established baseline | Primary for 13 skills, fallback for Tier 1 |
| **GPT-5.5** ⭐ UPGRADED | Balanced reasoning + speed, extended capabilities | Slightly lower reasoning than Opus 5 | Procedural skills, eval-driven workflows |
| **Gemini 3.6 Flash** ⭐ NEW | Fast with strong reasoning, multimodal support | Limited reasoning complexity vs. Opus 5 | Prototyping, rapid iteration |

**Phase 5 Rationale**: This tier handles ~65% of harness skills. Claude Opus 4.8 remains primary, but GPT-5.5 adds specialized capability for procedural workflows (eval-first-tuning, remember). Gemini 3.6 Flash brings fast turnaround for prototyping scenarios.

---

### **Tier 3: Balanced-Coding** (Code generation + logic)

| Model | Strengths | Limitations | Best For |
|-------|-----------|-------------|----------|
| **GPT-5.3-Codex** ⭐ RETAINED | Specialized code generation, Phase 4 baseline | Narrower than general-purpose | implement, prototype (fallback) |
| **GPT-5.4** ⭐ NEW | Improved code generation, reasoning + coding balance | Less specialized than Codex | implement (alternative) |
| **Claude Sonnet 5** ⭐ NEW | Code + reasoning balance, good latency | Lower code specialization than Codex | prototype (primary), run-loop |
| **MAI-Code-1-Flash** ⭐ NEW | Microsoft-optimized code, fast | Azure/Windows focused | implement (Azure-specific tasks) |

**Phase 5 Rationale**: Tier 3 splits between specialized (Codex) and balanced (Sonnet 5, GPT-5.4). Codex remains best-in-class for pure code generation. Claude Sonnet 5 + GPT-5.4 provide strong general-purpose alternatives. MAI-Code-1-Flash enables platform-specific optimization.

---

### **Tier 4: Fast-Execution** (Speed-optimized)

| Model | Strengths | Limitations | Best For |
|-------|-----------|-------------|----------|
| **Gemini 3.5 Flash** ⭐ NEW | Very fast, acceptable quality | Lower reasoning complexity | Quick validation, fast iteration |
| **GPT-5.4 mini** ⭐ NEW | Speed + compact | Lower capability vs. full GPT-5.4 | Lightweight tasks |

**Phase 5 Rationale**: New tier for cost+speed scenarios. Gemini 3.5 Flash is production-grade for fast workflows. Complements Tier 4 fallback strategy (Claude Haiku).

---

### **Tier 5: Cost-Optimized** (Fallback for all)

| Model | Strengths | Limitations | Best For |
|-------|-----------|-------------|----------|
| **Claude Haiku 4.5** ⭐ RETAINED | Best cost-per-token, acceptable quality | Lower reasoning, ~100K context | Fallback for all skills |
| **GPT-5 mini** ⭐ NEW | Budget OpenAI option, lightweight | Minimal capability | Ultra-lightweight fallback |
| **Gemini 3.5 Flash** ⭐ (SHARED) | Fast + cheap, acceptable quality | Lower depth | Dual-purpose fast/cheap |

**Phase 5 Rationale**: Claude Haiku remains cost-optimal. Added GPT-5 mini and Gemini 3.5 Flash as alternative budget paths. Haiku 4.5 still best overall cost-quality tradeoff for fallback.

---

## Phase 5 Skill Re-Evaluation (20 Skills)

### Legend
- 🔴 **Ultra-Reasoning** → Tier 1 models
- 🟠 **High-Reasoning** → Tier 2 models  
- 🟡 **Balanced-Coding** → Tier 3 models
- 🟢 **Fast-Execution** → Tier 4 models
- 🔵 **Cost-Optimized** → Tier 5 models

---

### **Group A: Decision-Heavy Skills** (require deep reasoning)

#### 1. 🔴 **feedback** (+219.0% Phase 4)
- **Primary Tier**: Ultra-Reasoning (Claude Opus 5)
- **Rationale**: Resolving reviewer challenges requires multi-stage analysis. Opus 5's enhanced reasoning depth handles complex conflict resolution better than 4.8.
- **Fallback**: Claude Opus 4.8
- **Reasoning Depth**: Highest

#### 2. 🔴 **architect** (+201.6% Phase 4)
- **Primary Tier**: Ultra-Reasoning (GPT-5.6 Luna)
- **Rationale**: Complex architecture decisions need frontier reasoning. GPT-5.6 Luna offers novel problem-solving vs. Claude Opus 5's analytical depth.
- **Fallback**: Claude Opus 4.8
- **Reasoning Depth**: Highest

#### 3. 🟠 **review-depth** (+83.2% Phase 4) → UPGRADED from baseline
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Structural review benefits from Opus 4.8's stability. Not complex enough for Tier 1 but needs strong reasoning.
- **Alternative**: GPT-5.5 (faster)
- **Reasoning Depth**: High

#### 4. 🟠 **doubt-driven-development** (+149.4% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Security skepticism requires consistent reasoning. Opus 4.8's track record for rigorous analysis.
- **Fallback**: GPT-5.5
- **Reasoning Depth**: High

#### 5. 🟠 **remember** (+219.8% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Knowledge synthesis requires deep understanding. Opus 4.8's context window (200K) ideal for extracting patterns.
- **Alternative**: Claude Sonnet 5 (faster knowledge extraction)
- **Reasoning Depth**: High

---

### **Group B: Procedural-Guidance Skills** (benefit from semantic optimization)

#### 6. 🟡 **implement** (+130.0% Phase 4) → TIER SHIFT
- **Primary Tier**: Balanced-Coding (GPT-5.4)
- **Phase 4 Primary**: gpt-5.3-codex (still valid)
- **Rationale**: GPT-5.4 provides superior reasoning + code balance vs. Codex's pure specialization. Better for architectural implementation guidance.
- **Alternative**: Claude Sonnet 5 (balanced approach)
- **Fallback**: gpt-5.3-codex (if pure code generation needed)

#### 7. 🟡 **prototype** (+219.0% Phase 4)
- **Primary Tier**: Balanced-Coding (Claude Sonnet 5)
- **Rationale**: Throwaway prototypes benefit from fast turnaround + acceptable quality. Sonnet 5 balances code + reasoning better than specialized Codex.
- **Fallback**: gpt-5.3-codex
- **Reasoning Depth**: Balanced

#### 8. 🟠 **eval-first-tuning** (+251.5% Phase 4)
- **Primary Tier**: High-Reasoning (GPT-5.5)
- **Phase 4 Primary**: claude-opus-4.8
- **Rationale**: Eval-driven workflows have high keyword distinctiveness. GPT-5.5's specialized eval patterns outperform general reasoning.
- **Alternative**: Claude Opus 4.8 (stable baseline)
- **Reasoning Depth**: High

#### 9. 🟠 **pr** (+252.3% Phase 4) → HIGHEST PERFORMER
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: PR creation has highest Phase 4 improvement (+252.3%). Unique keyword signature (pr, pull, review, merge). Opus 4.8 remains optimal.
- **Alternative**: Claude Opus 5 (for complex multi-PR workflows)
- **Reasoning Depth**: High

#### 10. 🟠 **context-engineering** (+111.4% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Session memory requires consistent reasoning. Opus 4.8's stability essential for checkpointing.
- **Alternative**: GPT-5.5
- **Reasoning Depth**: High

#### 11. 🟠 **setup-harness-bootstrap** (+145.0% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Bootstrap requires methodical step-by-step logic. Opus 4.8's procedural strength.
- **Alternative**: Gemini 3.6 Flash (prototyping bootstrap faster)
- **Reasoning Depth**: High

#### 12. 🟢 **budget-aware-execution** (+111.8% Phase 4) → NEW TIER
- **Primary Tier**: Fast-Execution (Gemini 3.5 Flash)
- **Phase 4 Primary**: claude-opus-4.8
- **Rationale**: "Budget" in skill name + token tracking = cost-awareness task. Gemini 3.5 Flash best for fast, cheap analysis.
- **Fallback**: Claude Haiku 4.5
- **Reasoning Depth**: Moderate

#### 13. 🟠 **observability-and-instrumentation** (+108.4% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Telemetry + instrumentation requires methodical guidance. Opus 4.8 strong for procedural documentation.
- **Alternative**: GPT-5.5
- **Reasoning Depth**: High

#### 14. 🟠 **teach-agent** (+101.8% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Knowledge synthesis for agents requires deep reasoning. Opus 4.8 proven for educational content.
- **Alternative**: Claude Sonnet 5
- **Reasoning Depth**: High

#### 15. 🟠 **ai-techniques-radar** (+106.3% Phase 4)
- **Primary Tier**: High-Reasoning (GPT-5.5)
- **Rationale**: AI techniques evaluation benefits from frontier model trends. GPT-5.5 up-to-date on latest approaches.
- **Alternative**: Claude Opus 4.8
- **Reasoning Depth**: High

#### 16. 🟠 **understand-process** (+199.5% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Graph-first analysis requires deep dependency tracing. Opus 4.8's context window (200K) handles large graphs.
- **Alternative**: Claude Opus 5 (ultra-complex change analysis)
- **Reasoning Depth**: High

---

### **Group C: Validation & Orchestration Skills**

#### 17. 🟠 **deterministic-validation** (+111.8% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Proof selection requires rigorous logical consistency. Opus 4.8 excels at deterministic reasoning.
- **Alternative**: GPT-5.5
- **Reasoning Depth**: High

#### 18. 🟡 **run-loop** (+99.5% Phase 4) → MONITOR
- **Primary Tier**: Balanced-Coding (Claude Sonnet 5)
- **Phase 4 Primary**: claude-opus-4.8
- **Rationale**: Loop orchestration requires code + reasoning. Sonnet 5 balances both for execution clarity.
- **Fallback**: claude-opus-4.8
- **Reasoning Depth**: Balanced

#### 19. 🟠 **retrieval-quality-ops** (+110.5% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: A/B eval orchestration needs stable reasoning. Opus 4.8 proven for evaluation workflows.
- **Alternative**: GPT-5.5
- **Reasoning Depth**: High

#### 20. 🟠 **review-breadth** (+113.2% Phase 4)
- **Primary Tier**: High-Reasoning (Claude Opus 4.8)
- **Rationale**: Wide-pass review requires comprehensive reasoning across multiple dimensions. Opus 4.8 strength.
- **Alternative**: Claude Opus 5 (for ultra-complex changes)
- **Reasoning Depth**: High

---

## Phase 5 Summary: Model Distribution

### By Tier:

| Tier | Count | Skills | Coverage |
|------|-------|--------|----------|
| **Ultra-Reasoning** | 2 | feedback, architect | 10% |
| **High-Reasoning** | 13 | pr, remember, evaluate-first-tuning, understand-process, setup-harness-bootstrap, doubt-driven-development, observability-and-instrumentation, teach-agent, ai-techniques-radar, review-depth, context-engineering, deterministic-validation, retrieval-quality-ops, review-breadth | 65% |
| **Balanced-Coding** | 3 | implement, prototype, run-loop | 15% |
| **Fast-Execution** | 1 | budget-aware-execution | 5% |
| **Cost-Optimized** | 1 | (fallback for all) | 100% (cascade) |

### By Primary Model:

| Model | Skills | %  |
|-------|--------|-----|
| Claude Opus 4.8 | 11 | 55% |
| Claude Opus 5 | 2 (primary) + 2 (alt) | 20% |
| GPT-5.5 | 2 (primary) + 2 (alt) | 20% |
| GPT-5.3-Codex | 1 (retained) + 2 (fallback) | 15% |
| Claude Sonnet 5 | 2 (primary) + 1 (alt) | 15% |
| Gemini 3.6 Flash | 1 (alt) + 1 (primary) | 10% |
| GPT-5.4 | 1 (primary) | 5% |
| Gemini 3.5 Flash | 1 (primary) | 5% |
| Claude Haiku 4.5 | Fallback (all) | 100% |

---

## Key Insights from Phase 5

### **Capability Correlation**:
- **Ultra-Reasoning (Tier 1)**: Only 2 skills (feedback, architect) need true frontier reasoning
- **High-Reasoning (Tier 2)**: 13/20 skills = 65% plateau at strong-reasoning level
- **Balanced-Coding (Tier 3)**: 3 skills explicitly need code+logic balance
- **Fast-Execution (Tier 4)**: Budget-aware-execution benefits from speed optimization
- **Cost-Optimized (Tier 5)**: Universal fallback tier (can run any skill if needed)

### **Model Substitutability**:
- **Claude Opus 4.8** remains the workhorse (11 primary, 5+ alternatives)
- **Claude Opus 5** is specialized upgrade path (feedback, architect, complex review-depth)
- **GPT-5.5** fills procedural + eval-heavy niche (eval-first-tuning, ai-techniques-radar)
- **Gemini 3.6 Flash** enables fast prototyping (setup-harness-bootstrap alternative)
- **Claude Sonnet 5** + **GPT-5.4** are viable Balanced-Coding alternatives to Codex

### **GitHub Copilot Alignment**:
All recommended models are **GA (Generally Available)** on GitHub Copilot as of 2026-07-24:
- ✅ Claude Opus 5, Claude Opus 4.8, Claude Haiku 4.5, Claude Sonnet 5
- ✅ GPT-5.6 (Luna, Sol, Terra), GPT-5.5, GPT-5.4, GPT-5.3-Codex, GPT-5 mini
- ✅ Gemini 3.6 Flash, Gemini 3.5 Flash, Gemini 3.1 Pro
- ✅ MAI-Code-1-Flash

---

## Phase 5 Tier Shift Summary

### Skills Changed from Phase 4:
1. **implement**: gpt-5.3-codex → GPT-5.4 (Balanced-Coding upgrade)
2. **eval-first-tuning**: claude-opus-4.8 → GPT-5.5 (High-Reasoning specialization)
3. **budget-aware-execution**: claude-opus-4.8 → Gemini 3.5 Flash (Fast-Execution tier)
4. **run-loop**: claude-opus-4.8 → Claude Sonnet 5 (Balanced-Coding for loop orchestration)
5. **review-depth**: claude-opus-4.8 (no shift, but High-Reasoning tier clarified)

### Skills Retained (Phase 4 optimal):
15/20 skills remain on Phase 4 primary model assignments. Strong validation of Phase 4 baseline.

---

## Next Steps for Phase 6

1. **A/B Test Tier Shifts**: Validate GPT-5.5, Gemini 3.5 Flash, Claude Sonnet 5 performance
2. **Extended Context Window Experiments**: Leverage Opus 5's 1M token context for large-scale graph analysis
3. **Multi-Model Fallback Chains**: Test cascading fallbacks (Opus 5 → Opus 4.8 → GPT-5.5)
4. **Cost-Quality Tradeoff Analysis**: Measure token cost per skill for budget-optimization
5. **Provider Diversity**: Ensure multi-provider strategy for redundancy (not just OpenAI or Anthropic)

---

**Document Status**: Complete Phase 5 analysis  
**Created**: 2026-07-24  
**Data Source**: GitHub Copilot Supported Models official documentation  
**Validation**: All models GA status verified
