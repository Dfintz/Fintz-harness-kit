# Phase 5 Model Tier Strategy: Quick Reference

## At a Glance: 5-Tier Model Classification

```
┌─────────────────────────────────────────────────────────────────────┐
│ TIER 1: ULTRA-REASONING (Frontier Models)                           │
├─────────────────────────────────────────────────────────────────────┤
│ Claude Opus 5 • GPT-5.6 Luna                                         │
│ → Complex multi-stage reasoning, novel problem-solving              │
│ → Skills: feedback, architect                                        │
│ → Use When: Cross-cutting architectural concerns, conflict resolution│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ TIER 2: HIGH-REASONING (Established Strong Reasoning)               │
├─────────────────────────────────────────────────────────────────────┤
│ Claude Opus 4.8 • GPT-5.5 • Gemini 3.6 Flash                         │
│ → Procedural guidance, multi-turn validation, deep analysis         │
│ → Skills: 13/20 harness skills (65% of workload)                    │
│ → Use When: Most harness workflows, procedural guidance              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ TIER 3: BALANCED-CODING (Code Generation + Logic)                   │
├─────────────────────────────────────────────────────────────────────┤
│ GPT-5.3-Codex • GPT-5.4 • Claude Sonnet 5                            │
│ → Code generation with architectural reasoning                      │
│ → Skills: implement, prototype, run-loop                            │
│ → Use When: Code scaffolding, loop orchestration, throwaway proof   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ TIER 4: FAST-EXECUTION (Speed-Optimized)                            │
├─────────────────────────────────────────────────────────────────────┤
│ Gemini 3.5 Flash • GPT-5.4 mini                                      │
│ → Cost + latency optimized, acceptable quality                      │
│ → Skills: budget-aware-execution                                    │
│ → Use When: Fast turnaround required, token budget tracking          │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ TIER 5: COST-OPTIMIZED (Universal Fallback)                         │
├─────────────────────────────────────────────────────────────────────┤
│ Claude Haiku 4.5 • GPT-5 mini • Gemini 3.5 Flash                     │
│ → Fallback for ALL skills, best cost-per-token                      │
│ → Use When: Cost critical, graceful degradation needed               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tier Selection Decision Tree

```
START: Which skill are you routing?
│
├─ Complex Architecture Decision?
│  └─> TIER 1: architect (GPT-5.6 Luna)
│
├─ Resolving Reviewer Conflicts?
│  └─> TIER 1: feedback (Claude Opus 5)
│
├─ Code Generation + Architecture?
│  ├─ Pure Code Focus? → TIER 3: implement (GPT-5.4)
│  ├─ Throwaway Prototype? → TIER 3: prototype (Claude Sonnet 5)
│  └─ Loop Orchestration? → TIER 3: run-loop (Claude Sonnet 5)
│
├─ Budget + Token Tracking?
│  └─> TIER 4: budget-aware-execution (Gemini 3.5 Flash)
│
├─ Procedural Guidance (Most Skills)?
│  ├─ Eval-driven workflow? → TIER 2: evaluate-first-tuning (GPT-5.5)
│  ├─ AI techniques evaluation? → TIER 2: ai-techniques-radar (GPT-5.5)
│  └─ All other procedural? → TIER 2: [13 skills] (Claude Opus 4.8)
│
└─ FALLBACK (Any skill, cost critical)?
   └─> TIER 5: Claude Haiku 4.5
```

---

## By-Skill Tier Assignment Matrix

| Skill | Tier | Primary | Fallback 1 | Fallback 2 |
|-------|------|---------|-----------|-----------|
| **architect** | 🔴 1 | GPT-5.6 Luna | Claude Opus 5 | Opus 4.8 |
| **feedback** | 🔴 1 | Claude Opus 5 | GPT-5.6 Luna | Opus 4.8 |
| **pr** | 🟠 2 | Claude Opus 4.8 | Claude Opus 5 | GPT-5.5 |
| **remember** | 🟠 2 | Claude Opus 4.8 | Claude Opus 5 | Sonnet 5 |
| **evaluate-first-tuning** | 🟠 2 | GPT-5.5 | Claude Opus 4.8 | Gemini 3.6 |
| **understand-process** | 🟠 2 | Claude Opus 4.8 | Claude Opus 5 | GPT-5.5 |
| **doubt-driven-development** | 🟠 2 | Claude Opus 4.8 | GPT-5.5 | Opus 5 |
| **setup-harness-bootstrap** | 🟠 2 | Claude Opus 4.8 | Gemini 3.6 | GPT-5.5 |
| **review-breadth** | 🟠 2 | Claude Opus 4.8 | Claude Opus 5 | GPT-5.5 |
| **deterministic-validation** | 🟠 2 | Claude Opus 4.8 | GPT-5.5 | Opus 5 |
| **context-engineering** | 🟠 2 | Claude Opus 4.8 | GPT-5.5 | Sonnet 5 |
| **retrieval-quality-ops** | 🟠 2 | Claude Opus 4.8 | GPT-5.5 | Gemini 3.6 |
| **observability-and-instrumentation** | 🟠 2 | Claude Opus 4.8 | GPT-5.5 | Sonnet 5 |
| **ai-techniques-radar** | 🟠 2 | GPT-5.5 | Claude Opus 4.8 | Opus 5 |
| **teach-agent** | 🟠 2 | Claude Opus 4.8 | Claude Sonnet 5 | GPT-5.5 |
| **review-depth** | 🟠 2 | Claude Opus 4.8 | Claude Opus 5 | GPT-5.5 |
| **implement** | 🟡 3 | GPT-5.4 | GPT-5.3-Codex | Sonnet 5 |
| **prototype** | 🟡 3 | Claude Sonnet 5 | GPT-5.3-Codex | GPT-5.4 |
| **run-loop** | 🟡 3 | Claude Sonnet 5 | Claude Opus 4.8 | Codex |
| **budget-aware-execution** | 🟢 4 | Gemini 3.5 Flash | Claude Haiku 4.5 | GPT-5 mini |

---

## Model Capability Matrix

```
                    Reasoning    Code Quality    Speed    Cost    Context
TIER 1
Claude Opus 5       ████████░░   ███████░░░░    ██░░░░░   ███░░   ██████████ (1M)
GPT-5.6 Luna        ████████░░   ███████░░░░    ██░░░░░   ███░░   ░░░░░░░░░░

TIER 2
Claude Opus 4.8     ████████░░   ███████░░░░    ████░░░░  ███░░   ██████░░░░ (200K)
GPT-5.5             ███████░░░   ████████░░░   █████░░░  ██░░░░   ░░░░░░░░░░
Gemini 3.6 Flash    ███████░░░   ███████░░░░   ██████░░  ░░░░░░   ░░░░░░░░░░

TIER 3
GPT-5.3-Codex       ██████░░░░   ██████████░   ████░░░░  ██░░░░   ░░░░░░░░░░
GPT-5.4             ███████░░░   █████████░░   ████░░░░  ███░░░   ░░░░░░░░░░
Claude Sonnet 5     ███████░░░   █████████░░   █████░░░  ███░░░   ░░░░░░░░░░

TIER 4
Gemini 3.5 Flash    ██████░░░░   ██████░░░░░   ██████░░  ░░░░░░   ░░░░░░░░░░
GPT-5.4 mini        ██████░░░░   ██████░░░░░   ██████░░  ░░░░░░   ░░░░░░░░░░

TIER 5
Claude Haiku 4.5    █████░░░░░   █████░░░░░░   ███████░░ ░░░░░░   ████░░░░░░ (100K)
GPT-5 mini          █████░░░░░   █████░░░░░░   ███████░░ ░░░░░░   ░░░░░░░░░░
```

---

## Fallback Chain Visualization

```
SKILL EXECUTION FLOW
│
├─ Try Primary Tier (100% optimal)
│  ├─ Success → Use Result ✓
│  └─ Timeout/Error → Fallback 1
│
├─ Try Fallback 1 (Adjacent Tier, 95% optimal)
│  ├─ Success → Use Result ✓
│  └─ Timeout/Error → Fallback 2
│
├─ Try Fallback 2 (Higher Tier, 90% optimal)
│  ├─ Success → Use Result ✓
│  └─ Timeout/Error → Fallback 3
│
└─ Try Fallback 3 (Universal Tier, 85% optimal)
   ├─ Success → Use Result ✓
   └─ Failure → Alert + Log
```

---

## Deployment Checklist

### **Phase 5 Rollout**:

- [ ] Update `harness.config.json` with new `skillModelMapping`
- [ ] Update all 20 `SKILL.md` files with "Recommended Models" sections
- [ ] Create routing logic in `harness:route` for tier selection
- [ ] Implement fallback chains in model executor
- [ ] Set up performance logging (latency, cost, quality)
- [ ] Run A/B test on 6 shifted skills (20 runs each)
- [ ] Validate fallback chain triggers
- [ ] Document model selection decisions in reports
- [ ] Lock assignments if validation passes

### **Monitoring**:

- [ ] Latency per tier (target: Tier 1 <10s, Tier 2 <5s, Tier 3 <3s, Tier 4 <2s)
- [ ] Cost per skill (track against Phase 4 baseline)
- [ ] Success rate per tier (target: >98%)
- [ ] Fallback frequency (target: <5% across all skills)

---

## Cost Estimation

### **Approximate Token Cost per Tier** (1000-query baseline):

| Tier | Model | Input Cost | Output Cost | Estimated |
|------|-------|-----------|-----------|-----------|
| 1 | Claude Opus 5 | $3/M | $15/M | ~$5-8 per query |
| 1 | GPT-5.6 Luna | $2.5/M | $10/M | ~$3-5 per query |
| 2 | Claude Opus 4.8 | $3/M | $15/M | ~$5-8 per query |
| 2 | GPT-5.5 | $1.5/M | $6/M | ~$2-3 per query |
| 2 | Gemini 3.6 Flash | $1/M | $4/M | ~$1-2 per query |
| 3 | GPT-5.3-Codex | $2/M | $8/M | ~$2-3 per query |
| 3 | Claude Sonnet 5 | $3/M | $15/M | ~$5-8 per query |
| 4 | Gemini 3.5 Flash | $0.5/M | $1.5/M | ~$0.5-1 per query |
| 5 | Claude Haiku 4.5 | $0.8/M | $4/M | ~$1-1.5 per query |

**Expected Phase 5 Cost vs Phase 4**:
- Phase 4: ~$5-7 per query (Opus 4.8 + Codex split)
- Phase 5: ~$4-6 per query (optimized tier distribution + fallbacks)
- **Delta**: -10-15% cost reduction with maintained performance

---

## Summary Table: Phase 4 vs Phase 5

| Aspect | Phase 4 | Phase 5 | Status |
|--------|---------|---------|--------|
| **Models** | 3 | 9+ | ✅ Expanded |
| **Tiers** | 3 | 5 | ✅ Specialized |
| **Skills Shifted** | 0 | 6 | ✅ Optimized |
| **Skills Retained** | 20 | 14 | ✅ Stable |
| **Avg Improvement** | +153.2% | +156-162% | ✅ Potential +3-9% |
| **Frontier Capability** | Limited | Full | ✅ Ultra-Reasoning tier |
| **Cost** | Baseline | -10-15% | ✅ Optimized |
| **Availability** | 3/3 GA | 9/9 GA | ✅ 100% available |

---

## Key Takeaways

1. **70% Stability**: Most skills unchanged → Phase 4 was sound
2. **30% Optimization**: Strategic shifts to frontier models + specialization
3. **5-Tier Strategy**: Each tier has clear purpose and use cases
4. **Universal Fallback**: Claude Haiku 4.5 safety net for all workflows
5. **Multi-Provider**: Reduces vendor lock-in (Anthropic, OpenAI, Google)
6. **Expected Improvement**: +156-162% (maintain baseline + 3-9% upside)
7. **Low Risk**: All models GA on GitHub Copilot, proven in production

---

**Reference Documents**:
- [`PHASE5-TIERING-MATRIX.md`](PHASE5-TIERING-MATRIX.md) — Detailed capability analysis
- [`PHASE5-MIGRATION-REPORT.md`](PHASE5-MIGRATION-REPORT.md) — Phase 4 → Phase 5 comparison
- [`PHASE5-SKILL-MODEL-MAPPING.json`](PHASE5-SKILL-MODEL-MAPPING.json) — Implementation config
