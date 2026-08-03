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
  'graphify',
];

function buildAllowList(options = {}) {
  return new Set(
    (Array.isArray(options.allowedExecutables)
      ? options.allowedExecutables
      : DEFAULT_ALLOWED_EXECUTABLES
    ).map(entry => String(entry).toLowerCase())
  );
}

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
  const allowList = buildAllowList(options);

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

export function validateCliArgv(argv, options = {}) {
  if (!Array.isArray(argv) || argv.length === 0) {
    return { ok: false, reason: 'argv must be a non-empty array' };
  }

  const firstToken = typeof argv[0] === 'string' ? argv[0].trim() : '';
  if (!firstToken) {
    return { ok: false, reason: 'argv[0] must be a non-empty executable string' };
  }

  const executable = resolveExecutable(firstToken);
  const allowList = buildAllowList(options);
  if (!allowList.has(executable)) {
    return {
      ok: false,
      reason: `executable "${executable}" is not in allowlist (${[...allowList].join(', ')})`,
    };
  }

  for (let i = 1; i < argv.length; i += 1) {
    if (typeof argv[i] !== 'string') {
      return { ok: false, reason: `argv[${i}] must be a string` };
    }
  }

  return { ok: true, executable };
}

export function assertSafeCliArgv(argv, opts = {}) {
  const label = opts?.label || 'CLI argv';
  const verdict = validateCliArgv(argv, opts);
  if (!verdict.ok) {
    throw new Error(`${label} rejected: ${verdict.reason}`);
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
      continue;
    }
    if (argv[i] === '--self-test') {
      flags.selfTest = true;
    }
  }
  return flags;
}

function runSelfTest() {
  const checks = [
    {
      name: 'accepts allowlisted executable',
      run: () => validateAgentCommand('node scripts/harness/plan-review.mjs').ok === true,
    },
    {
      name: 'rejects semicolon chaining',
      run: () => {
        const verdict = validateAgentCommand('node ok.mjs; rm -rf /');
        return verdict.ok === false && /semicolon/.test(verdict.reason || '');
      },
    },
    {
      name: 'rejects empty command',
      run: () => {
        const verdict = validateAgentCommand('   ');
        return verdict.ok === false && /empty/.test(verdict.reason || '');
      },
    },
    {
      name: 'respects custom allowlist',
      run: () => validateAgentCommand('mytool --version', { allowedExecutables: ['mytool'] }).ok === true,
    },
    {
      name: 'aliases mirror validator result',
      run: () => {
        const verdict = validateCliCommand('node -v');
        return verdict.ok === true && verdict.executable === 'node';
      },
    },
    {
      name: 'accepts argv with allowlisted executable',
      run: () => validateCliArgv(['node', '--version']).ok === true,
    },
    {
      name: 'rejects empty argv arrays',
      run: () => {
        const verdict = validateCliArgv([]);
        return verdict.ok === false && /non-empty array/.test(verdict.reason || '');
      },
    },
  ];

  process.stdout.write(`[command-validation] self-test - ${checks.length} check(s)\n`);
  let failed = 0;
  for (const check of checks) {
    let pass = false;
    try {
      pass = Boolean(check.run());
    } catch {
      pass = false;
    }
    process.stdout.write(`  ${pass ? 'PASS' : 'FAIL'}  ${check.name}\n`);
    if (!pass) failed += 1;
  }

  if (failed > 0) {
    process.stdout.write(`[command-validation] self-test FAILED (${failed} failing check(s))\n`);
    process.exit(1);
  }

  process.stdout.write('[command-validation] self-test PASSED\n');
  process.exit(0);
}

if (process.argv[1]?.endsWith('command-validation.mjs')) {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.selfTest) {
    runSelfTest();
  }
  const command = flags.command || process.env.HARNESS_AGENT_CMD || '';
  const verdict = validateAgentCommand(command);
  process.stdout.write(`${JSON.stringify({ command, ...verdict }, null, 2)}\n`);
  process.exit(verdict.ok ? 0 : 1);
}
