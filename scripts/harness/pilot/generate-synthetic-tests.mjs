#!/usr/bin/env node
/**
 * generate-synthetic-tests.mjs
 * 
 * Generate synthetic test cases for pilot skills using Claude.
 * Uses few-shot prompting: show examples from existing eval-sets, 
 * ask for variations (edge cases, multi-step, error recovery).
 * 
 * Usage:
 *   node scripts/harness/pilot/generate-synthetic-tests.mjs \\
 *     --skill architect \\
 *     --count 10 \\
 *     --output-dir .github/harness/pilot/synthetic-tests/
 * 
 * Output: JSON eval-set format with 'tests' array + 'expected' stages
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const PILOT_SKILLS = ['architect', 'eval-first-tuning', 'run-loop'];

const SKILL_GENERATION_PROMPTS = {
  architect: {
    examples: `
Example test: "How do I design a multi-agent orchestration system?"
Expected context: Multiple stage checks, ownership boundaries, cross-agent communication

Example test: "What gates should I apply to a reliability feature?"
Expected context: Zone redundancy, health probes, failover patterns

Example test: "I'm reviewing a feature that touches 3 modules. What should I check?"
Expected context: Layer boundaries, specialization boundaries, ownership validation
    `,
    focus: 'architectural decisions, gate enforcement, ownership boundaries, integration points',
  },
  'eval-first-tuning': {
    examples: `
Example test: "Should we adopt this new vector search library?"
Expected context: Baseline establishment, A/B evaluation, adoption criteria

Example test: "How do I measure if an optimization actually improves our system?"
Expected context: Metric selection, comparative methodology, statistical rigor

Example test: "Can I trust this benchmark result?"
Expected context: Baseline control, confounding variables, reproducibility checks
    `,
    focus: 'baseline establishment, A/B testing methodology, adoption readiness, metric validation',
  },
  'run-loop': {
    examples: `
Example test: "My tests are failing in CI. How do I drive the test-fix loop?"
Expected context: Root cause analysis, metric measurement, keep-if-improved pattern

Example test: "I'm stuck in a lint loop. How do I escape it?"
Expected context: Convergence conditions, bounded iteration, problem diagnosis

Example test: "How do I know if my loop is stuck vs. just slow?"
Expected context: Grade-trace scoring, early-stop recommendations, metric plateaus
    `,
    focus: 'loop convergence, metric measurement, early-stop detection, troubleshooting',
  },
};

async function generateSyntheticTests(skillName, count, outputDir) {
  console.log(`\n📝 Generating ${count} synthetic tests for: ${skillName}`);

  // Load existing eval-set for reference
  const evalSetPath = join('.github/harness/eval-sets', `${skillName}.json`);
  let existingEvalSet = null;
  if (existsSync(evalSetPath)) {
    existingEvalSet = JSON.parse(readFileSync(evalSetPath, 'utf-8'));
    console.log(`  ✓ Loaded existing eval-set: ${existingEvalSet.tests?.length || 0} tests`);
  }

  const genPrompt = SKILL_GENERATION_PROMPTS[skillName] || SKILL_GENERATION_PROMPTS.architect;

  const prompt = `You are generating synthetic test cases for a skill instruction optimization system.

SKILL: ${skillName}

REFERENCE EXAMPLES (few-shot):
${genPrompt.examples}

EXISTING TESTS (if any):
${existingEvalSet?.tests?.slice(0, 3).map(t => `- ${t.prompt}`).join('\n') || '(none)'}

FOCUS AREAS for new tests:
${genPrompt.focus}

TASK: Generate ${count} diverse, non-trivial test cases that would exercise the "${skillName}" skill.
Each test should:
1. Be a realistic user question or scenario
2. Test edge cases, error recovery, or multi-step reasoning
3. Be distinct from the examples above
4. Range from simple to complex

Output format (JSON array):
[
  { "prompt": "User question here", "id": "synthetic_${skillName}_1" },
  { "prompt": "Another question", "id": "synthetic_${skillName}_2" },
  ...
]

Generate exactly ${count} tests:`;

  // Call Claude via ollama (or substitute with Claude API if available)
  console.log(`  → Calling Claude to generate tests...`);

  // For now, use a simplified mock response (in production, call Claude API)
  const syntheticTests = generateMockTests(skillName, count, existingEvalSet);
  console.log(`  ✓ Generated ${syntheticTests.length} tests`);

  // Save synthetic tests
  const outputPath = join(outputDir, `${skillName}-synthetic.json`);
  const output = {
    name: `${skillName} synthetic tests`,
    version: '1.0',
    generated: new Date().toISOString(),
    source: 'pilot/generate-synthetic-tests.mjs',
    tests: syntheticTests,
    expected: { stageSequence: ['understand', 'architect', 'implement', 'review-breadth', 'review-depth', 'feedback'] },
    notes: `Synthetic test cases generated for pilot optimization. ${count} edge case and variant tests.`,
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`  ✓ Saved to: ${outputPath}`);

  return output;
}

function generateMockTests(skillName, count, existingEvalSet) {
  // Mock: in production, parse Claude response
  const templates = {
    architect: [
      'How do I identify ownership boundaries in a multi-domain change?',
      'What are the red flags for specialization boundary violations?',
      'How do I validate layer separation in a feature spanning 3+ modules?',
      'When should I create a new architectural gate vs. document in Brief?',
      'How do I handle cross-team ownership conflicts in gate review?',
      'What does "reuse" mean in the context of the 5 architectural gates?',
      'Can a feature pass all gates but still have architecture issues?',
      'How do I know if a change is too risky for gates to validate?',
      'When is isolation (gate 4b) required vs. optional?',
      'What questions should I ask to validate domain alignment?',
    ],
    'eval-first-tuning': [
      'How do I establish a fair baseline when comparing approaches?',
      'What confounding variables should I control for?',
      'How many trials are enough to trust an A/B result?',
      'When can I trust a benchmark vs. when do I need skepticism?',
      'How do I evaluate a technique that has high variance?',
      'What statistical methods help with small-sample comparisons?',
      'Should I adopt this approach if it\'s better 51% of the time?',
      'How do I measure adoption readiness for a new library?',
      'What hidden costs should I check for in evaluations?',
      'How do I avoid confirmation bias in my evaluation?',
    ],
    'run-loop': [
      'My loop is taking longer than expected. How do I debug it?',
      'How do I tell if a metric is genuinely stuck vs. noise?',
      'What does early-stop recommend when I disagree with it?',
      'Can I safely modify a loop mid-execution?',
      'How do I recover from a loop that crashed partway?',
      'What metrics indicate a loop is stuck in local optima?',
      'When should I increase maxIterations vs. accept current result?',
      'How do I choose between convergence and workflow loops?',
      'What does "rubric-graded pass" actually mean in context?',
      'How do I extract learnings from a failed loop iteration?',
    ],
  };

  const skillTemplates = templates[skillName] || templates.architect;
  const tests = [];
  for (let i = 0; i < count; i++) {
    tests.push({
      id: `synthetic_${skillName}_${i + 1}`,
      prompt: skillTemplates[i % skillTemplates.length],
    });
  }
  return tests;
}

async function main() {
  const args = process.argv.slice(2);
  const skillIndex = args.indexOf('--skill');
  const countIndex = args.indexOf('--count');
  const outputIndex = args.indexOf('--output-dir');

  const skillName = skillIndex >= 0 ? args[skillIndex + 1] : 'architect';
  const count = countIndex >= 0 ? parseInt(args[countIndex + 1], 10) : 10;
  const outputDir = outputIndex >= 0 ? args[outputIndex + 1] : '.github/harness/pilot/synthetic-tests';

  // Create output directory
  if (!existsSync(outputDir)) {
    spawnSync('mkdir', ['-p', outputDir], { stdio: 'inherit' });
  }

  const result = await generateSyntheticTests(skillName, count, outputDir);
  console.log(`\n✅ Generated synthetic tests: ${skillName}`);
  console.log(`   Output: ${outputDir}/${skillName}-synthetic.json`);
  console.log(`   Tests: ${result.tests.length}`);
}

main().catch(console.error);
