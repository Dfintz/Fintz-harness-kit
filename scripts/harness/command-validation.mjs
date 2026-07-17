#!/usr/bin/env node

const DEFAULT_ALLOWED_EXECUTABLES = [
  'claude',
  'node',
  'npm',
  'npx',
  'pnpm',
  'yarn',
  'bun',
  'ollama',
  'codex',
  'cursor',
  'python',
  'python3',
  'uvx',
];

const BLOCKED_SHELL_PATTERNS = [
  { pattern: /;/, reason: 'command chaining via semicolon is not allowed' },
  { pattern: /\|\|?|&&/, reason: 'command chaining/piping operators are not allowed' },
  { pattern: /`/, reason: 'backtick command substitution is not allowed' },
  { pattern: /\$\(/, reason: 'subshell command substitution is not allowed' },
  { pattern: /[<>]/, reason: 'shell redirection operators are not allowed' },
];

function shellSplit(command) {
  return String(command).trim().split(/\s+/).filter(Boolean);
}

function resolveExecutable(token) {
  if (!token) return '';
  const cleaned = token.replace(/^['"]|['"]$/g, '');
  const slashNormalized = cleaned.replaceAll('\\', '/');
  const basename = slashNormalized.split('/').pop() || cleaned;
  return basename.toLowerCase();
}

export function validateAgentCommand(command, options = {}) {
  const cmd = String(command || '').trim();
  if (!cmd) {
    return { ok: false, reason: 'agent command is empty' };
  }

  for (const blocked of BLOCKED_SHELL_PATTERNS) {
    if (blocked.pattern.test(cmd)) {
      return { ok: false, reason: blocked.reason };
    }
  }

  const firstToken = shellSplit(cmd)[0];
  const executable = resolveExecutable(firstToken);
  const allowList = new Set(
    (Array.isArray(options.allowedExecutables)
      ? options.allowedExecutables
      : DEFAULT_ALLOWED_EXECUTABLES
    ).map(entry => String(entry).toLowerCase())
  );

  if (!allowList.has(executable)) {
    return {
      ok: false,
      reason: `executable "${executable}" is not in allowlist (${[...allowList].join(', ')})`,
    };
  }

  return { ok: true, executable };
}

export function assertValidAgentCommand(command, context = 'agent command') {
  const verdict = validateAgentCommand(command);
  if (!verdict.ok) {
    throw new Error(`${context} rejected: ${verdict.reason}`);
  }
  return verdict;
}

// Compatibility aliases for the harness-kit API surface (validateCliCommand / assertSafeCliCommand).
// These let kit-synced scripts (e.g. plan-review.mjs) call the kit's option-object signature while
// delegating to this repo's validator. Additive only — existing callers keep using
// validateAgentCommand / assertValidAgentCommand.
export function validateCliCommand(command, opts = {}) {
  return validateAgentCommand(command, opts);
}

export function assertSafeCliCommand(command, opts = {}) {
  const label = opts?.label || 'CLI command';
  const verdict = validateAgentCommand(command, opts);
  if (!verdict.ok) {
    throw new Error(`${label} rejected: ${verdict.reason}`);
  }
  return verdict;
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--command' && argv[i + 1]) {
      flags.command = argv[i + 1];
      i += 1;
    }
  }
  return flags;
}

if (process.argv[1]?.endsWith('command-validation.mjs')) {
  const flags = parseArgs(process.argv.slice(2));
  const command = flags.command || process.env.HARNESS_AGENT_CMD || '';
  const verdict = validateAgentCommand(command);
  process.stdout.write(`${JSON.stringify({ command, ...verdict }, null, 2)}\n`);
  process.exit(verdict.ok ? 0 : 1);
}
