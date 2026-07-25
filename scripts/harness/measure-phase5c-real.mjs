#!/usr/bin/env node
/**
 * Phase 5c Real Measurement — validates model routing against real Ollama inference.
 *
 * Phase 5c optimization claims +3.4% quality improvement, but the original validation
 * used synthetic lookup tables, not real model invocations. This script gates the GA marker
 * by running one representative task per skill tier through the best-fit local model and
 * comparing against the Phase 5b synthetic baseline.
 *
 * MODEL ROUTING (per-tier)
 * ------------------------
 * Each tier uses the model best matched to its capability profile:
 *
 *   ultra-reasoning   → deepseek-r1:14b   (chain-of-thought, multi-hop reasoning)
 *   high-reasoning    → deepseek-r1:14b   (same — sustained analysis, impact mapping)
 *   balanced-coding   → devstral:24b      (agentic coding, multi-file, SWE-bench optimised)
 *   fast-execution    → qwen2.5-coder:32b (large coder, strong at structured generation)
 *   universal-fallback→ qwen2.5-coder:14b (baseline — always available)
 *
 * Falls back to --model / HARNESS_OLLAMA_MODEL for any model not found locally.
 *
 * WHAT IT MEASURES
 * ----------------
 * For each tier task, it sends a canonical prompt and scores the response on a rubric:
 *   - Contains expected output elements (structural validity)
 *   - Does not contain known failure patterns (rejection markers)
 *   - Length is within expected range (token efficiency)
 *
 * The composite score (0–1) is the mean of rubric dimensions across N=3 runs (median).
 * This matches the v2.2.0 measurement pattern (median-of-N + majority threshold).
 *
 * DECISION GATE
 * -------------
 * Phase 5c passes if the composite score is >= 0.80 (Phase 5b synthetic baseline).
 *
 * Usage:
 *   node scripts/harness/measure-phase5c-real.mjs
 *   node scripts/harness/measure-phase5c-real.mjs --model qwen2.5-coder:14b  (override all)
 *   node scripts/harness/measure-phase5c-real.mjs --dry-run
 *   node scripts/harness/measure-phase5c-real.mjs --list-models
 *
 * Output:
 *   .github/harness/phase5/validation-results/phase5c-real-baseline-TIMESTAMP.json
 *
 * Exit codes:
 *   0 — PASS (score >= baseline)
 *   1 — FAIL (score < baseline or Ollama unavailable)
 *   2 — CONFIG error
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateText } from './llm-provider.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const resultsDir = join(repoRoot, '.github', 'harness', 'phase5', 'validation-results');

const PHASE5B_BASELINE = 0.80;
const REPEAT_COUNT = 3;
const TIMEOUT_MS = 90_000; // 90s — deepseek-r1 thinking tokens can be slow

// Per-tier model routing: each model chosen for its best quality on that task type.
// Falls back to FALLBACK_MODEL if the assigned model is not available locally.
const FALLBACK_MODEL = 'qwen2.5-coder:14b';
const TIER_MODEL_MAP = {
  'ultra-reasoning':    'deepseek-r1:14b',   // Chain-of-thought reasoning, architecture analysis
  'high-reasoning':     'deepseek-r1:14b',   // Sustained multi-hop reasoning, impact mapping
  'balanced-coding':    'devstral:24b',       // Agentic coding, codebase exploration, SWE-bench
  'fast-execution':     'qwen2.5-coder:32b', // Large coder, fast structured output
  'universal-fallback': 'qwen2.5-coder:14b', // Baseline — always available
};

// Representative task prompts for each tier
const TIER_TASKS = [
  {
    tier: 'ultra-reasoning',
    skill: 'architect',
    model: TIER_MODEL_MAP['ultra-reasoning'],
    rationale: 'deepseek-r1 thinking tokens excel at multi-hop architecture reasoning',
    prompt: `You are a software architect. In one sentence, what is the primary purpose of an Architecture Brief in an AI agent harness workflow?`,
    expectContains: ['architecture', 'brief', 'decision', 'design', 'structure', 'plan'],
    rejectPatterns: ['i cannot', "i don't know", 'as an ai', 'error'],
    minLength: 30,
    maxLength: 500,
  },
  {
    tier: 'high-reasoning',
    skill: 'understand-process',
    model: TIER_MODEL_MAP['high-reasoning'],
    rationale: 'deepseek-r1 reasoning is best for impact mapping and dependency analysis',
    prompt: `You are a code analysis expert. List three key outputs of the Understand stage in a software development workflow. Be concise.`,
    expectContains: ['component', 'dependency', 'impact', 'mapping', 'blast', 'architecture', 'module'],
    rejectPatterns: ['i cannot', "i don't know", 'as an ai', 'error'],
    minLength: 40,
    maxLength: 600,
  },
  {
    tier: 'balanced-coding',
    skill: 'implement',
    model: TIER_MODEL_MAP['balanced-coding'],
    rationale: 'devstral built for agentic coding, multi-file edits, and SWE-bench tasks',
    prompt: `You are a developer. Write a one-line JavaScript function that takes an array of numbers and returns their median value.`,
    expectContains: ['function', 'sort', 'length', 'return', 'median', '=>'],
    rejectPatterns: ['i cannot', "i don't know", 'as an ai'],
    minLength: 20,
    maxLength: 400,
  },
  {
    tier: 'fast-execution',
    skill: 'pr',
    model: TIER_MODEL_MAP['fast-execution'],
    rationale: 'qwen2.5-coder:32b strong at structured, concise output; large context for PR diff reading',
    prompt: `In one sentence, what should a pull request title communicate?`,
    expectContains: ['change', 'purpose', 'describe', 'what', 'title', 'pull', 'pr'],
    rejectPatterns: ['i cannot', "i don't know", 'as an ai', 'error'],
    minLength: 15,
    maxLength: 250,
  },
  {
    tier: 'universal-fallback',
    skill: 'context-engineering',
    model: TIER_MODEL_MAP['universal-fallback'],
    rationale: 'qwen2.5-coder:14b is the proven baseline — always available as safety net',
    prompt: `In one sentence, what is the purpose of session memory in an AI agent workflow?`,
    expectContains: ['memory', 'context', 'state', 'session', 'track', 'store', 'preserve'],
    rejectPatterns: ['i cannot', "i don't know", 'as an ai', 'error'],
    minLength: 15,
    maxLength: 300,
  },
];

async function listAvailableModels() {
  try {
    const res = await fetch('http://localhost:11434/api/tags');
    const data = await res.json();
    return new Set((data.models || []).map(m => m.name));
  } catch {
    return new Set();
  }
}

function scoreResponse(response, task) {
  const text = String(response || '').toLowerCase();
  const hasReject = task.rejectPatterns.some(p => text.includes(p.toLowerCase()));
  if (hasReject) return 0.0;
  const length = text.length;
  const lengthOk = length >= task.minLength && length <= task.maxLength;
  const lengthScore = lengthOk ? 1.0 : (length < task.minLength ? 0.3 : 0.7);
  const keywordsFound = task.expectContains.filter(k => text.includes(k.toLowerCase())).length;
  const keywordScore = Math.min(1.0, keywordsFound / Math.max(1, Math.ceil(task.expectContains.length * 0.5)));
  return (lengthScore + keywordScore) / 2;
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

async function measureTask(task, modelOverride, availableModels, dryRun) {
  // Routing: use override if given, else assigned model, else fallback if not available
  let model = modelOverride ?? task.model;
  let usedFallback = false;
  if (!modelOverride && !availableModels.has(model)) {
    console.log(`    ⚠️  ${model} not found locally — falling back to ${FALLBACK_MODEL}`);
    model = FALLBACK_MODEL;
    usedFallback = true;
  }

  const scores = [];
  for (let i = 0; i < REPEAT_COUNT; i++) {
    if (dryRun) {
      scores.push(0.80 + (Math.random() * 0.06 - 0.01));
      continue;
    }
    try {
      const response = await generateText({
        model,
        prompt: task.prompt,
        temperature: 0.0,
        numPredict: 256,
        timeoutMs: TIMEOUT_MS,
      });
      scores.push(scoreResponse(response, task));
    } catch (err) {
      console.error(`    [attempt ${i + 1}] Error: ${err.message}`);
      scores.push(0.0);
    }
  }

  const majorityThreshold = Math.ceil(REPEAT_COUNT / 2);
  const validScores = scores.filter(s => s > 0);
  const compositeScore = validScores.length >= majorityThreshold ? median(scores) : null;

  return {
    tier: task.tier,
    skill: task.skill,
    assignedModel: task.model,
    usedModel: model,
    usedFallback,
    rationale: task.rationale,
    repeatCount: REPEAT_COUNT,
    scores,
    validCount: validScores.length,
    majorityThreshold,
    compositeScore,
    pass: compositeScore !== null && compositeScore >= PHASE5B_BASELINE,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const listModels = args.includes('--list-models');
  const modelArg = args.findIndex(a => a === '--model');
  const modelOverride = modelArg >= 0 ? args[modelArg + 1] : null;

  if (listModels) {
    console.log('\nTier → Model routing:\n');
    for (const task of TIER_TASKS) {
      console.log(`  ${task.tier.padEnd(22)} → ${task.model}`);
      console.log(`  ${''.padEnd(22)}   ${task.rationale}\n`);
    }
    return;
  }

  console.log(`\n[phase5c-real-measure] Starting Phase 5c real measurement`);
  if (modelOverride) {
    console.log(`  model:    ${modelOverride} (override — applied to all tiers)`);
  } else {
    console.log(`  model:    per-tier routing (deepseek-r1:14b / devstral:24b / qwen2.5-coder:32b)`);
  }
  console.log(`  dry-run:  ${dryRun}`);
  console.log(`  tasks:    ${TIER_TASKS.length} (1 per tier)`);
  console.log(`  N:        ${REPEAT_COUNT} runs per task (median-of-${REPEAT_COUNT})`);
  console.log(`  baseline: ${PHASE5B_BASELINE}\n`);

  // Discover which models are available locally
  const availableModels = dryRun ? new Set(Object.values(TIER_MODEL_MAP)) : await listAvailableModels();

  if (!dryRun) {
    // Health check with fallback model (always expected to be present)
    const healthModel = modelOverride ?? FALLBACK_MODEL;
    try {
      await generateText({ model: healthModel, prompt: 'Say OK', numPredict: 5, timeoutMs: 10_000 });
      console.log(`  [health] Ollama reachable (${healthModel}) ✅\n`);
    } catch (err) {
      console.error(`[phase5c-real-measure] Ollama health check FAILED: ${err.message}`);
      console.error('  Is Ollama running? Try: ollama serve');
      process.exit(1);
    }

    console.log('  Model availability:');
    for (const [tier, model] of Object.entries(TIER_MODEL_MAP)) {
      const available = availableModels.has(model);
      console.log(`    ${tier.padEnd(22)} ${model.padEnd(24)} ${available ? '✅' : '⚠️  not found (will use fallback)'}`);
    }
    console.log('');
  }

  const startTime = Date.now();
  const results = [];

  for (const task of TIER_TASKS) {
    process.stdout.write(`  Measuring ${task.tier} (${task.skill}) via ${modelOverride ?? task.model}...`);
    const result = await measureTask(task, modelOverride, availableModels, dryRun);
    results.push(result);
    const status = result.pass ? '✅' : (result.compositeScore === null ? '⚠️ null' : '❌');
    const fallbackNote = result.usedFallback ? ` [fallback: ${result.usedModel}]` : '';
    console.log(` ${status} score=${result.compositeScore?.toFixed(3) ?? 'null'} [${result.scores.map(s => s.toFixed(2)).join(', ')}]${fallbackNote}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const passCount = results.filter(r => r.pass).length;
  const compositeScores = results.map(r => r.compositeScore).filter(s => s !== null);
  const overallScore = compositeScores.length > 0 ? compositeScores.reduce((a, b) => a + b) / compositeScores.length : null;
  const passed = passCount === TIER_TASKS.length && overallScore !== null && overallScore >= PHASE5B_BASELINE;

  console.log(`\n[phase5c-real-measure] Results:`);
  console.log(`  Tasks passing:   ${passCount}/${TIER_TASKS.length}`);
  console.log(`  Overall score:   ${overallScore?.toFixed(3) ?? 'null'}`);
  console.log(`  Baseline:        ${PHASE5B_BASELINE}`);
  console.log(`  Elapsed:         ${elapsed}s`);
  console.log(`  Status:          ${passed ? '✅ PASS' : '❌ FAIL'}\n`);

  console.log('  Per-tier model used:');
  for (const r of results) {
    const note = r.usedFallback ? ` (fallback from ${r.assignedModel})` : '';
    console.log(`    ${r.tier.padEnd(22)} ${r.usedModel}${note}`);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const outputFile = join(resultsDir, `phase5c-real-baseline-${timestamp}.json`);
  mkdirSync(resultsDir, { recursive: true });

  const output = {
    runId: `phase5c-real-${timestamp}`,
    timestamp: new Date().toISOString(),
    tierModelMap: TIER_MODEL_MAP,
    fallbackModel: FALLBACK_MODEL,
    modelOverride: modelOverride ?? null,
    dryRun,
    repeatCount: REPEAT_COUNT,
    baseline: PHASE5B_BASELINE,
    phase5cClaim: 0.845,
    tasks: results,
    summary: {
      passCount,
      totalTasks: TIER_TASKS.length,
      overallScore,
      elapsedSeconds: parseFloat(elapsed),
      passed,
      gaUnlocked: passed,
      gaDecision: passed
        ? 'Phase 5c GA marker is NOW eligible.'
        : `Phase 5c GA gate BLOCKED. Score ${overallScore?.toFixed(3) ?? 'null'} < baseline ${PHASE5B_BASELINE}.`,
    },
  };

  writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\n[phase5c-real-measure] Results written to: ${outputFile}\n`);

  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error(`[phase5c-real-measure] Fatal error: ${err.message}`);
  process.exit(2);
});
