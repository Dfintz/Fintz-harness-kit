#!/usr/bin/env node
/**
 * prompt-middleware — harness routing layer for any incoming prompt.
 *
 * Reads a prompt from stdin (or --task), routes it through the harness stage machine
 * via prompt-router.mjs planTask(), and writes a structured JSON handoff to stdout.
 *
 * Use this as a pre-processing layer in any pipeline where you want every prompt
 * to automatically receive a stage/model plan before being executed.
 *
 * Usage:
 *   echo "add authentication to the API" | node scripts/harness/prompt-middleware.mjs
 *   node scripts/harness/prompt-middleware.mjs --task "add file search" --json
 *   node scripts/harness/prompt-middleware.mjs --task "fix lint" --pretty
 *
 * Exit codes: 0 ok, 1 error.
 *
 * Integration patterns:
 *   # Pipe any prompt through the harness before sending to an agent:
 *   PLAN=$(echo "$PROMPT" | node scripts/harness/prompt-middleware.mjs --json)
 *   STAGE=$(echo "$PLAN" | node -e "process.stdout.write(JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).stages[0])")
 *
 *   # Use as an npm script wrapper:
 *   npm run harness:prompt:route -- --task "implement OAuth"
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig, planTask } from './prompt-router.mjs';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const graphCliPath = join(repoRoot, 'scripts', 'harness', 'graph.mjs');

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    if (arg === '--help' || arg === '-h') { flags.help = true; continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) { flags[key] = true; continue; }
    flags[key] = next;
    i += 1;
  }
  return flags;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

function buildHandoffTable(plan) {
  const lines = [
    `[harness] task: ${plan.task}`,
    `[harness] mode: ${plan.mode}  why: ${plan.why}`,
  ];
  for (let i = 0; i < plan.stages.length; i += 1) {
    const stage = plan.stages[i];
    lines.push(`[harness] ${i + 1}. ${stage} -> ${plan.models[stage] || 'auto'}`);
  }
  if (plan.crossModelReview) {
    lines.push(`[harness] cross-model review: ${plan.crossModelReview}`);
  }
  return lines.join('\n');
}

function showHelp() {
  process.stdout.write(
    JSON.stringify(
      {
        usage: 'node scripts/harness/prompt-middleware.mjs [options]',
        description:
          'Routes any incoming prompt through the harness stage machine and returns a structured handoff plan. ' +
          'Acts as a middleware layer so every prompt automatically receives stage/model routing.',
        flags: {
          '--task <text>': 'Prompt text to route (alternative to stdin)',
          '--profile <name>': 'Force a specific harness profile (feature, review, etc.)',
          '--intent <name>': 'Force a specific intent classification',
          '--json': 'Output full JSON plan (default)',
          '--pretty': 'Output human-readable stage table instead of JSON',
          '--help': 'Show this help',
        },
        outputs: {
          task: 'Original prompt text',
          profile: 'Selected profile or null',
          intent: 'Detected intent or null',
          mode: '"trivial" | "non-trivial"',
          stages: 'Ordered array of harness stages',
          models: 'Stage-to-model mapping',
          crossModelReview: 'Cross-model review summary',
          handoff: 'Human-readable stage table (always included)',
        },
        examples: [
          'echo "implement OAuth login" | node scripts/harness/prompt-middleware.mjs',
          'node scripts/harness/prompt-middleware.mjs --task "fix flaky test" --pretty',
          'npm run harness:prompt:route -- --task "add rate limiting"',
        ],
        integrationNote:
          'Set HARNESS_MIDDLEWARE=1 in your shell profile and wrap your agent invocation with ' +
          'this script to auto-route every prompt through the harness stage machine.',
      },
      null,
      2
    ) + '\n'
  );
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    showHelp();
    return;
  }

  let task = flags.task ? String(flags.task).trim() : '';
  if (!task) {
    const stdin = await readStdin();
    task = stdin.trim();
  }

  if (!task) {
    process.stderr.write('[prompt-middleware] No prompt provided. Pass --task <text> or pipe via stdin.\n');
    process.exit(1);
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    process.stderr.write(`[prompt-middleware] Failed to load harness config: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }

  const plan = planTask(task, config, {
    profile: flags.profile || null,
    intent: flags.intent || null,
  });

  let contextPack = null;
  if (flags.symbol) {
    const result = spawnSync(process.execPath, [
      graphCliPath,
      'context-pack',
      String(flags.symbol),
      '--json',
      ...(flags.preset ? ['--preset', String(flags.preset)] : []),
    ], { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    if (result.status === 0) {
      try { contextPack = JSON.parse(result.stdout).content ?? null; } catch { contextPack = null; }
    }
  }

  const handoff = buildHandoffTable(plan);
  const output = { ...plan, handoff, contextPack };

  if (flags.pretty) {
    process.stdout.write(handoff + '\n');
  } else {
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
  }
}

main().catch(err => {
  process.stderr.write(`[prompt-middleware] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
