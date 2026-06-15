#!/usr/bin/env node
/**
 * Council-style parallel responders for review synthesis.
 *
 * Keeps the harness stage machine intact; this utility is optional and best used
 * around review steps when you want multiple model perspectives merged into one
 * recommendation.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertSafeCliCommand } from './command-validation.mjs';
import { generateText } from './llm-provider.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outputDir = join(repoRoot, '.github', 'harness', 'runs');

const MODE_PROFILES = {
  plan: 'Focus on architecture, risks, and sequencing.',
  code: 'Focus on implementation details and correctness.',
  review: 'Focus on findings, severity, regressions, and tests.',
  refactor: 'Focus on simplification, maintainability, and boundaries.',
};

const PROMPT_CATALOG = {
  review: 'Review the proposed changes. Prioritize concrete findings, regressions, and missing tests.',
  plan: 'Evaluate architecture and sequencing. Call out risks, assumptions, and dependency impacts.',
  breadth: 'Run a breadth-first review. Enumerate severity-tagged issues across touched areas.',
  depth: 'Run a depth-first architectural review. Check ownership, boundaries, and structural regressions.',
  feedback: 'Assess review responses and propose a clear verdict with rationale and next actions.',
};

function normalizePromptKey(input) {
  const text = String(input ?? '').trim().toLowerCase();
  if (!text) return '';
  const base = text.split(/[\\/]/).at(-1) ?? text;
  return base.replace(/\.[a-z0-9]+$/i, '');
}

function resolveCatalogPrompt(input) {
  const key = normalizePromptKey(input);
  if (Object.hasOwn(PROMPT_CATALOG, key)) {
    return { key, prompt: PROMPT_CATALOG[key] };
  }
  return null;
}

function readStdinText() {
  return new Promise((resolvePromise, rejectPromise) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      text += chunk;
    });
    process.stdin.on('end', () => {
      resolvePromise(text.trim());
    });
    process.stdin.on('error', rejectPromise);
  });
}

function fail(message, code = 2) {
  process.stderr.write(`[council-review] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = {
    mode: 'review',
    engine: 'nano',
    timeoutMs: 180000,
    output: undefined,
    json: false,
    promptStdin: false,
    promptCompatToken: undefined,
    codex: process.env.HARNESS_COUNCIL_CODEX_CMD || 'codex -p',
    claude: process.env.HARNESS_COUNCIL_CLAUDE_CMD || 'claude -p',
    gemini: process.env.HARNESS_COUNCIL_GEMINI_CMD || 'gemini -p',
    provider: process.env.HARNESS_LLM_PROVIDER || 'ollama',
    host: process.env.HARNESS_COUNCIL_OLLAMA_HOST || process.env.HARNESS_OLLAMA_HOST || 'http://localhost:11434',
    model: process.env.HARNESS_COUNCIL_OLLAMA_MODEL || 'llama3.2:3b',
  };
  const valueOptions = new Set([
    '--mode',
    '--engine',
    '--prompt',
    '--prompt-key',
    '--prompt-file',
    '--timeout-ms',
    '--codex',
    '--claude',
    '--gemini',
    '--provider',
    '--host',
    '--model',
    '--output',
  ]);

  const applyValue = (option, value) => {
    switch (option) {
      case '--mode':
        flags.mode = value;
        break;
      case '--engine':
        flags.engine = value;
        break;
      case '--prompt':
        flags.prompt = value;
        break;
      case '--prompt-key':
        flags.promptKey = value;
        break;
      case '--prompt-file':
        flags.promptCompatToken = value;
        break;
      case '--timeout-ms':
        flags.timeoutMs = Number(value);
        break;
      case '--codex':
        flags.codex = value;
        break;
      case '--claude':
        flags.claude = value;
        break;
      case '--gemini':
        flags.gemini = value;
        break;
      case '--provider':
        flags.provider = value;
        break;
      case '--host':
        flags.host = value;
        break;
      case '--model':
        flags.model = value;
        break;
      case '--output':
        flags.output = value;
        break;
      default:
        fail(`Unknown option: ${option}`);
    }
  };

  for (let i = 0; i < argv.length; i += 1) {
    const option = argv[i];
    if (option === '--json') {
      flags.json = true;
      continue;
    }
    if (option === '--help') {
      flags.help = true;
      continue;
    }
    if (option === '--prompt-stdin') {
      flags.promptStdin = true;
      continue;
    }
    if (!valueOptions.has(option)) {
      fail(`Unknown option: ${option}`);
    }
    const value = argv[i + 1];
    if (typeof value !== 'string') {
      fail(`Missing value for ${option}`);
    }
    applyValue(option, value);
    i += 1;
  }
  return flags;
}

function showHelp() {
  process.stdout.write([
    'Usage: node scripts/harness/council-review.mjs [options]',
    '  --mode <plan|code|review|refactor>   Council mode profile (default: review)',
    '  --prompt "<text>"                    Prompt text',
    '  --prompt-key <key>                   Use fixed catalog prompt key (review|plan|breadth|depth|feedback)',
    '  --prompt-stdin                       Read prompt from stdin',
    '  --prompt-file <token>                Backward-compatible alias to catalog key (no file reads)',
    '  --engine <nano|ollama>              Synthesis engine (default: nano)',
    '  --codex "<cmd>"                      Codex command',
    '  --claude "<cmd>"                     Claude command',
    '  --gemini "<cmd>"                     Gemini command',
    '  --timeout-ms <n>                     Per-member timeout (default: 180000)',
    '  --json                               Print JSON envelope',
  ].join('\n') + '\n');
}

async function readPrompt(flags) {
  if (typeof flags.prompt === 'string' && flags.prompt.trim()) return flags.prompt.trim();

  if (typeof flags.promptKey === 'string' && flags.promptKey.trim()) {
    const resolved = resolveCatalogPrompt(flags.promptKey);
    if (!resolved) {
      fail(`Unknown --prompt-key value: ${flags.promptKey}`);
    }
    return resolved.prompt;
  }

  if (typeof flags.promptCompatToken === 'string' && flags.promptCompatToken.trim()) {
    const resolved = resolveCatalogPrompt(flags.promptCompatToken);
    if (!resolved) {
      fail(
        `Unknown --prompt-file token: ${flags.promptCompatToken}. ` +
        'Compatibility mode only accepts fixed catalog keys.'
      );
    }
    process.stderr.write(
      `[council-review] --prompt-file is compatibility-only and does not read files. ` +
      `Resolved key: ${resolved.key}\n`
    );
    return resolved.prompt;
  }

  if (flags.promptStdin) {
    const stdinPrompt = await readStdinText();
    if (!stdinPrompt) {
      fail('stdin prompt is empty.');
    }
    return stdinPrompt;
  }
  fail('Provide --prompt, --prompt-key, --prompt-file (compat token), or --prompt-stdin.');
}

function modeInstruction(mode) {
  const key = MODE_PROFILES[mode] ? mode : 'review';
  return { mode: key, instruction: MODE_PROFILES[key] };
}

function runMember(member, command, prompt, timeoutMs) {
  assertSafeCliCommand(command, { label: `${member} command` });

  return new Promise((resolvePromise) => {
    const started = Date.now();
    const child = spawn(command, {
      cwd: repoRoot,
      shell: true,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', error => {
      clearTimeout(timer);
      resolvePromise({
        member,
        command,
        status: 1,
        timedOut,
        durationMs: Date.now() - started,
        output: '',
        error: error.message,
      });
    });

    child.on('close', status => {
      clearTimeout(timer);
      resolvePromise({
        member,
        command,
        status: status ?? 1,
        timedOut,
        durationMs: Date.now() - started,
        output: stdout.trim(),
        error: stderr.trim() || null,
      });
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

function buildMemberPrompt(mode, instruction, userPrompt) {
  return [
    `You are participating in a multi-agent council (${mode} mode).`,
    instruction,
    'Respond with concrete findings and actionable recommendations.',
    '',
    userPrompt,
  ].join('\n');
}

function synthesizeNano(mode, responses) {
  const lines = [`# Council Synthesis (${mode})`, '', '## Member snapshots'];
  const good = responses.filter(r => r.status === 0 && r.output);

  for (const r of responses) {
    lines.push(`- ${r.member}: status=${r.status}${r.timedOut ? ' timeout' : ''} duration=${r.durationMs}ms`);
  }
  lines.push('', '## Consolidated recommendation');

  if (!good.length) {
    lines.push('- No successful member responses were available; rerun with healthier commands/auth.');
    return lines.join('\n');
  }

  const top = good.map(r => `### ${r.member}\n${r.output.slice(0, 1200)}`).join('\n\n');
  lines.push(
    '- Prioritize actions mentioned by at least two members when they conflict.',
    '- Preserve harness stage boundaries; use council output as review synthesis, not stage replacement.',
    '- Treat any high-risk suggestion as REVISE until verified by checks/tests.',
    '',
    top
  );
  return lines.join('\n');
}

async function synthesizeOllama(mode, responses, flags) {
  const context = responses
    .map(r => `## ${r.member}\nstatus=${r.status} timeout=${r.timedOut}\n${r.output || r.error || '(no output)'}`)
    .join('\n\n');

  const prompt = [
    `Synthesize council outputs for mode=${mode}.`,
    'Return one concise recommendation with: summary, key risks, and ordered next steps.',
    'Prefer consensus; call out unresolved disagreement explicitly.',
    '',
    context,
  ].join('\n');

  return generateText({
    provider: flags.provider,
    host: flags.host,
    model: flags.model,
    prompt,
    temperature: 0.2,
    numPredict: 900,
    timeoutMs: flags.timeoutMs,
  });
}

function writeEnvelope(envelope, outPath) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(envelope, null, 2)}\n`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const { mode, instruction } = modeInstruction(flags.mode);
  const userPrompt = await readPrompt(flags);
  const memberPrompt = buildMemberPrompt(mode, instruction, userPrompt);

  const members = [
    ['codex', flags.codex],
    ['claude', flags.claude],
    ['gemini', flags.gemini],
  ];

  const responses = await Promise.all(
    members.map(([member, command]) => runMember(member, command, memberPrompt, flags.timeoutMs))
  );

  let synthesis = '';
  if (flags.engine === 'ollama') {
    try {
      synthesis = await synthesizeOllama(mode, responses, flags);
    } catch (error) {
      synthesis = [
        '[ollama synthesis failed; fell back to nano]',
        error instanceof Error ? error.message : String(error),
        '',
        synthesizeNano(mode, responses),
      ].join('\n');
    }
  } else {
    synthesis = synthesizeNano(mode, responses);
  }

  const envelope = {
    mode,
    engine: flags.engine,
    generatedAt: new Date().toISOString(),
    responses,
    synthesis,
  };

  const outPath = flags.output
    ? resolve(flags.output)
    : join(outputDir, `council-review-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeEnvelope(envelope, outPath);

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
  } else {
    process.stdout.write(`${synthesis}\n`);
    process.stdout.write(`\n[council-review] envelope: ${outPath}\n`);
  }
}

try {
  await main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
