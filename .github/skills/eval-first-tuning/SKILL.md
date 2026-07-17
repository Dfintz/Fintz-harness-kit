# Skill: Eval-First Tuning

> Use when: You are considering prompt, model, routing, retrieval, or memory changes because output
> quality is poor, inconsistent, or too expensive.

Derived from recent radar research and aligned to this repo's harness self-improvement goals.

---

## Objective

Improve agent quality by measuring the real bottleneck first, then changing one variable at a time.
Do not treat prompt tweaks as the default fix.

---

## Principles

- **Diagnose retrieval before generation**: inspect what context the model actually received.
- **Use judged evals over vibes**: define a rubric and score the same cases across variants.
- **Change one variable at a time**: prompt, model, retrieval threshold, reranker, or policy.
- **Track quality and cost together**: better output at worse cost is not automatically a win.

---

## Process

### Step 1 — Capture representative failures

Build a small eval set before tuning:

- 5 to 20 real prompts or tasks
- expected outcome or judging rubric
- current baseline output

If possible, include both easy and failure-prone cases.

### Step 2 — Inspect retrieved context first

Before touching prompts or models, confirm:

- Did retrieval return anything useful?
- Were the returned chunks relevant?
- Was context duplicated, stale, or missing critical identifiers?

If retrieval is wrong, fix retrieval first. Do not blame generation for empty or noisy context.

### Step 3 — Run a controlled sweep

Test one variable at a time:

| Variable              | Example                                    |
| --------------------- | ------------------------------------------ |
| Model                 | current default vs cheaper or stronger one |
| Retrieval threshold   | stricter vs looser similarity cutoffs      |
| Context policy        | dedupe on/off, top-K change                |
| Prompt/policy wording | baseline vs one targeted revision          |

Hold everything else constant during each comparison.

### Step 4 — Judge with an explicit rubric

Score outputs on the dimensions that matter for the task, for example:

- relevance
- factuality
- helpfulness
- actionability
- cost per run

LLM judges are acceptable for triage, but spot-check them manually before adopting a conclusion.

### Step 5 — Record the decision

Write down:

- winning variant
- quality delta
- cost delta
- what changed
- what was rejected and why

This should go in the relevant brief, experiment note, or radar follow-up.

---

## This Repo's Likely Eval Targets

| Surface                    | Likely unit of evaluation                 |
| -------------------------- | ----------------------------------------- |
| Harness prompts            | loop convergence, rubric pass rate        |
| Memory / retrieval changes | answer relevance and missing-context rate |
| Routing decisions          | correct stage or skill selection          |
| Model swaps                | quality per cost at fixed task set        |

---

## Anti-Rationalization Table

| Excuse                                    | Counter                                                              |
| ----------------------------------------- | -------------------------------------------------------------------- |
| "I'll just try a better prompt first."    | Not until you know whether retrieval or routing is the real failure. |
| "The expensive model is probably better." | Measure it. Defaults are often not on the Pareto frontier.           |
| "The judge score looks good enough."      | Spot-check the rubric. Bad judges create precise-looking nonsense.   |
| "I changed three things and it improved." | Then you do not know what helped. Re-run with isolated variables.    |

---

## Verification

Eval-first tuning is complete when:

- [ ] A baseline eval set exists
- [ ] Retrieved context was inspected before generation changes
- [ ] Variants were compared one variable at a time
- [ ] Quality and cost were both recorded
- [ ] The chosen variant and rationale were written down

## Usage Scenarios

### Scenario 1: Should I adopt this new library or stick with the current approach?

**What this demonstrates:** Shows baseline establishment and comparative evaluation methodology

### Scenario 2: How do I measure if an optimization actually improves our system?

**What this demonstrates:** Demonstrates adoption readiness checks and metric selection
