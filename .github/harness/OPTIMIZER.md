# Skill Optimization Workflow

> **Purpose:** Document the DSPy-based skill optimizer that improves instruction text through
> iterative refinement and evaluation.  
> **Status:** Production-ready (verified 2026-07-17: 11/38 skills optimized, 27/38 at 100%
> baseline)  
> **Model:** Local Ollama (`qwen2.5:latest`) or cloud models (Claude, GPT, Gemini)

---

## Overview

The skill optimization system automatically improves agent skill instructions by:

1. **Baseline evaluation** — Run skill through eval set; measure task completion rate
2. **Trial-based optimization** — Run 10 improvement trials, each suggesting refined instructions
3. **Scoring** — Re-evaluate on each trial; track improvement over baseline
4. **Output** — Save optimized instruction to `.github/harness/optimized-skills/`

Optimization is **optional and non-blocking**: skills with 100% baseline evaluation are marked
"no-improvement" (already optimal) and skip trials.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ optimize-all-skills.mjs (Node.js Orchestrator)         │
│  • Discovers skills (.github/skills/, .claude/skills/)  │
│  • Detects available model (Ollama, Claude, GPT, etc.)  │
│  • Invokes dspy-bridge.mjs per skill                    │
│  • Aggregates results into JSON + markdown report       │
└───────┬─────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ dspy-bridge.mjs (Node.js/Python Bridge)                │
│  • Receives: skill path, eval set path, output path     │
│  • Auto-detects model (priority: Ollama > Claude > ...) │
│  • Invokes: dspy-optimize.py (full DSPy) or fallback   │
│  • Returns: JSON result { status, duration, details }   │
└───────┬─────────────────────────────────────────────────┘
        │
        ▼ (Full DSPy available)
    ┌───────────────┐
    │ dspy-optimize │ (imports DSPy MIPROv2, LMQL, etc.)
    │ .py (full)    │ [slower but comprehensive]
    └───────────────┘
        │
        ▼ (Fallback: DSPy unavailable)
┌─────────────────────────────────────────────────────────┐
│ dspy-optimize-ollama.py (Simplified Fallback)           │
│  • Direct Ollama REST API (localhost:11434)             │
│  • Keyword-based evaluation (40% match threshold)       │
│  • Trial loop: 10 suggestions per skill                 │
│  • Streaming: writes progress to stdout                 │
└─────────────────────────────────────────────────────────┘
```

---

## Execution Flow

### 1. Skill Discovery

```powershell
# Scripts/optimize-all-skills.mjs discovers:
# - .github/skills/*/SKILL.md      (Copilot/generic skills)
# - .claude/skills/*/SKILL.md      (Claude Code skills)
# Total: 38 skill files

# Matched with eval sets:
# - .github/harness/eval-sets/[skill-name].json
```

**Output:** Array of skill objects `{ skillPath, evalSetPath, skillName, outputPath }`

### 2. Model Auto-Detection

Priority order:

1. **Local Ollama** — `http://localhost:11434` (fastest, offline-capable)
2. **Claude (Anthropic)** — `ANTHROPIC_API_KEY` env var
3. **GPT (OpenAI)** — `OPENAI_API_KEY` env var
4. **Gemini (Google)** — `GOOGLE_API_KEY` env var

Selected model passed to `dspy-bridge.mjs` as `model` parameter.

### 3. Per-Skill Optimization

For each skill:

**a) Load Instruction & Eval Set**

```
Instruction: Read SKILL.md header section (typically 100-500 words)
Eval Set:   Load JSON { tasks: [ {input, expectedOutput}, ... ] }
            (typically 4-5 tasks per skill)
```

**b) Baseline Evaluation**

```
For each task in eval set:
  1. Invoke model with: instruction + task.input
  2. Compare output to task.expectedOutput (keyword-based matching, 40% threshold)
  3. Count successes: baseline = successes / total_tasks

Result: baseline_score (0.0 to 1.0)
```

**c) Trial-Based Optimization** (if baseline < 1.0)

```
For trial = 1 to 10:
  1. Call optimizer with instruction + eval set
  2. Optimizer suggests refinement (e.g., "Add clarity on X", "Include example Y")
  3. Generate new instruction incorporating suggestion
  4. Re-evaluate on full eval set
  5. Track: trial_score, improvement

Keep: best_score from all trials
Store: improvement_delta = best_score - baseline_score
```

**d) Output Decision**

```
If improvement_delta > 0:
  status = "success" (or "optimized")
  Save optimized instruction to .github/harness/optimized-skills/[skill]--ollama--[date].md
Else:
  status = "no-improvement"
  (baseline already optimal; no optimization needed)
```

---

## Evaluation Logic

### Keyword Matching (40% Threshold)

**ExpectedOutput Format:**

```
"Should mention: keyword1, keyword2; also include: keyword3, keyword4"
```

**Parsing:**

1. Strip prefix: "Should mention:" → remaining text
2. Split on comma/semicolon → phrases
3. Extract significant words: length > 2 chars, exclude stop words (the, a, an, is, etc.)
4. Normalize to lowercase

**Evaluation:**

```
Significant words needed: [word1, word2, word3, word4, ...]
Words found in model output: [word1, word2, word3, ...]

Match % = words_found / significant_words_needed
Pass = Match % >= 40%
```

**Examples:**

| Expected                                  | Extracted Keywords          | Model Output                        | Match | Pass? |
| ----------------------------------------- | --------------------------- | ----------------------------------- | ----- | ----- |
| "Should mention: TypeScript, strict mode" | [typescript, strict, mode]  | "Use TypeScript in strict mode"     | 100%  | ✅    |
| "Should mention: error handling, logging" | [error, handling, logging]  | "Implement try-catch blocks"        | 33%   | ❌    |
| "Must include: testing, coverage report"  | [testing, coverage, report] | "Write tests and generate coverage" | 66%   | ✅    |

---

## Data Files

### Eval Sets (`.github/harness/eval-sets/*.json`)

**Schema:**

```json
{
  "skill": "skill-name",
  "description": "What this skill teaches",
  "tasks": [
    {
      "input": "Concrete question or scenario",
      "expectedOutput": "Should mention: keyword1, keyword2; also consider: keyword3"
    }
  ]
}
```

**Example:**

```json
{
  "skill": "remember",
  "description": "Recording lessons to persistent harness memory",
  "tasks": [
    {
      "input": "How do I save a hard-won debugging lesson so future sessions rediscover it?",
      "expectedOutput": "Should mention: remember skill, .github/harness/memory/, hard-won lesson, persistent"
    },
    {
      "input": "What format should I use for memory files?",
      "expectedOutput": "Should mention: markdown, YAML frontmatter, brief summary, clear filename"
    }
  ]
}
```

### Optimization Output (`.github/harness/optimized-skills/[skill]--ollama--[date].md`)

**Naming:** `{skill-name}--{model}--{YYYY-MM-DD}.md`

**Format:**

```markdown
# Optimized Instruction: {Skill Name}

**Model:** ollama | claude | gpt-4 | gemini  
**Date:** 2026-07-17  
**Baseline Score:** 5/5 (100%)  
**Best Trial Score:** 5/5 (100%)  
**Improvement:** +0% (already optimal)

## Original Instruction

[Original skill instruction text]

## Suggested Improvements

[If improvement_delta > 0:]

- Trial 1: Add clarity on X (score: 4/5)
- Trial 3: Include example Y (score: 5/5) ✅ BEST
- Trial 7: Restructure section Z (score: 4/5)

[If improvement_delta = 0:]

- No improvements found. Baseline already optimal at 100%.

## Optimized Instruction

[Full optimized text, or note if no changes]

---

**Recommendation:**

- If improvement >= 10%: Consider applying to source SKILL.md
- If improvement < 10%: Baseline already strong; archive for reference
```

### Reports (`.github/harness/optimization-reports/optimization-report--[date].md` / `.json`)

**Markdown Report:**

- Summary table (total skills, optimized, no-improvement, errors)
- Per-skill status, duration, output path
- Archive location for full JSON

**JSON Report:**

```json
{
  "model": "ollama",
  "timestamp": "2026-07-17T11:30:05.158Z",
  "dryRun": false,
  "totalSkills": 38,
  "byStatus": {
    "success": 11,
    "no-improvement": 27,
    "error": 0
  },
  "results": [
    {
      "skill": "ai-techniques-radar",
      "status": "no-improvement",
      "duration": 31201,
      "baselineScore": 0.0,
      "bestScore": 0.0,
      "improvement": 0.0
    }
  ]
}
```

---

## Running the Optimizer

### Full Batch (All 38 Skills)

```powershell
# Discover model automatically
node scripts/harness/optimize-all-skills.mjs

# Or specify model
OLLAMA_MODEL=qwen2.5 node scripts/harness/optimize-all-skills.mjs

# Dry-run (no output files written)
node scripts/harness/optimize-all-skills.mjs --dry-run
```

### Single Skill (Debugging)

```bash
# Run optimizer on one skill
node scripts/harness/dspy-bridge.mjs \
  --skill ".github/skills/remember/SKILL.md" \
  --evalSet ".github/harness/eval-sets/remember.json" \
  --output ".github/harness/optimized-skills/remember--debug.md" \
  --model "ollama_chat/qwen2.5"
```

### Expected Output

```
[optimize-skills] Optimizing ai-techniques-radar with Local Ollama...
  Skill: C:\...\AI-techniques-radar\SKILL.md
  Eval set: C:\...\ai-techniques-radar.json
  Output: C:\...\optimized-skills\ai-techniques-radar--ollama--2026-07-17.md

✓ Optimization complete!
📊 Results saved to: .github/harness/optimization-reports/

Total skills: 38
Optimized: 11
No improvement: 27
Errors: 0
```

---

## Performance Metrics

**Single Skill Optimization Times** (Local Ollama, qwen2.5):

| Skill              | Baseline   | Trials      | Total Time | Status         |
| ------------------ | ---------- | ----------- | ---------- | -------------- |
| remember           | 100% (5/5) | 0 (skipped) | 31s        | no-improvement |
| understand-process | 60% (3/5)  | 10          | 327s       | success        |
| review-depth       | 80% (4/5)  | 10          | 401s       | success        |

**Pattern:** ~30s overhead per skill (load SKILL.md, invoke model); ~33s per trial if optimization
needed.

**Full Batch Estimate:** 38 skills × 31s + (11 optimized × 10 trials × 33s) ≈ 77 minutes

---

## Troubleshooting

### Issue: "Full DSPy unavailable, using fallback"

**Cause:** DSPy library not installed or Python environment misconfigured

**Fix:**

```bash
pip install dspy-ai dspy-clients
# or within venv:
cd scripts/harness && pip install -r requirements.txt
```

### Issue: Ollama connection refused

**Cause:** `http://localhost:11434` unreachable

**Fix:**

```bash
# Check Ollama running
ollama serve

# Or switch to cloud model
ANTHROPIC_API_KEY="sk-..." node scripts/harness/optimize-all-skills.mjs --model claude
```

### Issue: Eval set parsing error

**Cause:** Task JSON structure malformed

**Fix:** Compare the eval set against nearby checked-in examples, then re-run the bridge command:

```bash
node scripts/harness/dspy-bridge.mjs --evalSet ".github/harness/eval-sets/<skill>.json" --self-test
```

### Issue: Model timeout (10s+ with no output)

**Cause:** Model too slow or overloaded

**Fix:**

```bash
# Increase timeout in dspy-optimize-ollama.py
# or use smaller model:
OLLAMA_MODEL=phi node scripts/harness/optimize-all-skills.mjs
```

---

## Best Practices

1. **Eval Set Quality:** Each task should have 4-5 distinct keywords; avoid single-keyword eval sets
2. **Baseline Inspection:** Before running full batch, test one skill to verify eval logic
3. **Model Selection:** Ollama (qwen2.5) balances speed and quality; Claude for higher quality but
   slower
4. **Schedule:** Run optimization during off-hours or low-load periods (est. 1.5-2 hours per batch)
5. **Archive:** Keep optimization reports in git history; useful for tracking skill improvements
   over time

---

## Related Documentation

- [Skill Registry](./registry.json) — Metadata for all 38 skills
- [MCP Integration](./MCP-INTEGRATION.md) — How MCP tools integrate with harness
- [HARNESS.md](./HARNESS.md) — Master workflow spec
