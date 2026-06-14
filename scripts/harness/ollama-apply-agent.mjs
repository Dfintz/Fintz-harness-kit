#!/usr/bin/env node
/**
 * Ollama APPLY adapter for harness EXPERIMENT loops (autoresearch-style).
 *
 * Unlike ollama-agent.mjs (which only prints model text to stdout), this adapter
 * actually EDITS the experiment's single declared target file so a local LLM can
 * move a numeric metric. The experiment runner (run-experiment.mjs) re-measures
 * after this exits and keeps the edit only if the metric improved — otherwise it
 * reverts the target. That keep-if-improved safety net is what makes letting a
 * small local model rewrite a whole file acceptable.
 *
 * Flow per invocation:
 *   1. Resolve the target file from HARNESS_EXPERIMENT_TARGETS (set by the runner).
 *      Exactly ONE target is required — matching autoresearch's "single file to
 *      modify" design and keeping the apply parseable and safe.
 *   2. Read the improvement prompt from stdin and the current target contents.
 *   3. Ask Ollama for the COMPLETE updated file contents in one fenced code block.
 *   4. Write the parsed contents to the target file ONLY. Never touch any other path.
 *
 * It is deliberately conservative: if the model returns no usable code block, an
 * empty file, or content identical to disk, it writes nothing and exits 0 — the
 * runner then measures "no change" and reverts, costing only one iteration.
 *
 * Usage (via the runner):
 *   node scripts/harness/run-experiment.mjs lint-debt-experiment \
 *     --agent "node scripts/harness/ollama-apply-agent.mjs --model qwen2.5-coder:14b"
 *
 * Env:
 *   HARNESS_EXPERIMENT_TARGETS  comma-separated target files (set by run-experiment.mjs)
 *   HARNESS_LLM_PROVIDER        ollama (default) or lmstudio
 *   HARNESS_LLM_MODEL           default model id (overridden by --model)
 *   HARNESS_LLM_HOST            provider base URL (default ollama :11434 / lmstudio :1234)
 *   HARNESS_LLM_NUM_PREDICT     max output tokens (default 8192 — full files need headroom)
 *   HARNESS_LLM_TEMPERATURE     sampling temperature (default 0.2 for code edits)
 *   (legacy HARNESS_OLLAMA_* / OLLAMA_HOST are still honored as fallbacks)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateText, resolveProvider } from './llm-provider.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    if (arg === '--help') {
      flags.help = true;
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
}

function parseNumber(value, fallback) {
  if (value === undefined || value === true) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: 'node scripts/harness/ollama-apply-agent.mjs --model <name> [options]',
        purpose:
          'Edits the experiment target file using a local LLM (Ollama or LM Studio) so it can move a metric.',
        options: {
          '--provider <name>': 'ollama (default) or lmstudio. Env: HARNESS_LLM_PROVIDER.',
          '--model <name>':
            'Model id (default HARNESS_LLM_MODEL/HARNESS_OLLAMA_MODEL, else qwen2.5-coder:14b for ollama / local-model for lmstudio).',
          '--host <url>':
            'Provider base URL (default ollama http://localhost:11434 / lmstudio http://localhost:1234).',
          '--num-predict <n>': 'Max output tokens (default 8192).',
          '--temperature <n>': 'Sampling temperature (default 0.2).',
        },
        env: ['HARNESS_EXPERIMENT_TARGETS (set by run-experiment.mjs)'],
      },
      null,
      2
    )}\n`
  );
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function resolveSingleTarget() {
  const raw = process.env.HARNESS_EXPERIMENT_TARGETS;
  if (!raw || !raw.trim()) {
    throw new Error(
      'HARNESS_EXPERIMENT_TARGETS is not set. This adapter must be launched by run-experiment.mjs.'
    );
  }
  const targets = raw
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  if (targets.length !== 1) {
    throw new Error(
      `Apply-agent supports exactly one target file (autoresearch-style); got ${targets.length}: ${targets.join(', ')}. ` +
        'Declare a single target[] in the experiment loop.'
    );
  }
  const rel = targets[0];
  const abs = isAbsolute(rel) ? rel : resolve(repoRoot, rel);
  // Containment guard: never allow an edit to escape the repo root.
  const within = relative(repoRoot, abs);
  if (within.startsWith('..') || isAbsolute(within)) {
    throw new Error(`Target ${rel} resolves outside the repo root — refusing to edit.`);
  }
  if (!existsSync(abs)) {
    throw new Error(`Target file does not exist: ${rel}`);
  }
  return { rel: within.split('\\').join('/'), abs };
}

/**
 * Extract the intended full-file contents from a model response. Prefers the
 * largest fenced code block (handles ```ts / ``` and stray prose around it).
 * Returns null when nothing usable is present so the caller can safely no-op.
 */
function extractFileContents(modelText) {
  if (typeof modelText !== 'string' || !modelText.trim()) return null;

  const fenceRe = /```[^\n]*\n([\s\S]*?)```/g;
  let match;
  let best = null;
  while ((match = fenceRe.exec(modelText)) !== null) {
    const body = match[1];
    if (best === null || body.length > best.length) best = body;
  }
  if (best !== null) {
    const trimmed = best.replace(/\n+$/, '\n');
    return trimmed.trim().length > 0 ? trimmed : null;
  }
  return null;
}

function buildSystemPrompt(rel) {
  return [
    'You are an autonomous code-improvement agent in a metric-optimization loop.',
    `You may edit exactly one file: ${rel}.`,
    "You will receive the goal and the file's current full contents.",
    'Respond with ONLY the complete, updated contents of that file inside a single fenced code block.',
    'Do not include explanations, comments about your changes, or multiple code blocks.',
    'Preserve all behavior except the focused improvement requested. Never disable lint rules or add any/ts-ignore to game a metric.',
  ].join('\n');
}

function buildUserPrompt(improvementPrompt, rel, currentContents) {
  return [
    improvementPrompt,
    '',
    `### Current contents of ${rel}`,
    '```',
    currentContents,
    '```',
    '',
    `Return the COMPLETE updated contents of ${rel} as a single fenced code block.`,
  ].join('\n');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const provider = resolveProvider(flags.provider);
  const fallbackModel = provider === 'lmstudio' ? 'local-model' : 'qwen2.5-coder:14b';
  const model = String(
    flags.model || process.env.HARNESS_LLM_MODEL || process.env.HARNESS_OLLAMA_MODEL || fallbackModel
  ).trim();
  const host = flags.host || process.env.HARNESS_LLM_HOST || process.env.OLLAMA_HOST;
  const numPredict = Math.trunc(
    parseNumber(
      flags['num-predict'] ?? process.env.HARNESS_LLM_NUM_PREDICT ?? process.env.HARNESS_OLLAMA_NUM_PREDICT,
      8192
    )
  );
  const temperature = parseNumber(
    flags.temperature ?? process.env.HARNESS_LLM_TEMPERATURE ?? process.env.HARNESS_OLLAMA_TEMPERATURE,
    0.2
  );

  const target = resolveSingleTarget();
  const improvementPrompt = await readStdin();
  if (!improvementPrompt) throw new Error('No improvement prompt provided on stdin.');

  const currentContents = readFileSync(target.abs, 'utf8');

  const modelResponse = await generateText({
    provider,
    host,
    model,
    system: buildSystemPrompt(target.rel),
    prompt: buildUserPrompt(improvementPrompt, target.rel, currentContents),
    temperature,
    numPredict,
  });

  const newContents = extractFileContents(modelResponse);

  if (newContents === null) {
    process.stdout.write(
      `[ollama-apply] model returned no usable code block — leaving ${target.rel} unchanged.\n`
    );
    return;
  }
  if (newContents === currentContents) {
    process.stdout.write(`[ollama-apply] model output identical to disk — no change.\n`);
    return;
  }

  writeFileSync(target.abs, newContents);
  process.stdout.write(
    `[ollama-apply] wrote ${target.rel} (${currentContents.length} -> ${newContents.length} chars) via ${model}.\n`
  );
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
