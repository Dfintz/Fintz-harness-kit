#!/usr/bin/env node
/**
 * scheduled-maintenance.mjs — portable "run without you" harness maintenance.
 *
 * The model-agnostic equivalent of a scheduled managed agent (CMA's "Run Without You"): a
 * deterministic, unattended harness health run that needs no LLM, no secrets, and no network —
 * only Node built-ins and the harness's own self-testing tools. It runs on a cron via
 * `.github/workflows/harness-maintenance.yml` and locally via `npm run harness:maintenance`.
 *
 * Task list is declared in `harness.config.json` under `schedule.tasks`, so the cadence and scope
 * are config-driven rather than buried in YAML. Each task is `{ name, run, required, description }`.
 * The run fails (exit 1) only when a `required` task fails; `optional` tasks are informational so a
 * known-flaky or environment-dependent check never makes the recurring run perpetually red.
 *
 * Usage:
 *   node scheduled-maintenance.mjs                 # Run all configured tasks, print + summarize
 *   node scheduled-maintenance.mjs --list          # Show the task plan without executing
 *   node scheduled-maintenance.mjs --json          # Machine-readable result
 *   node scheduled-maintenance.mjs --only <name>   # Run a single task by name (repeatable)
 *   node scheduled-maintenance.mjs --self-test     # Deterministic aggregation checks, no execution
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PREFIX = '[harness-maintenance]';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const configPath = path.join(repoRoot, 'harness.config.json');
const MAX_OUTPUT = 1500;

function loadTasks() {
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch (e) {
    process.stderr.write(`${PREFIX} failed to load harness.config.json: ${e.message}\n`);
    process.exit(2);
  }
  const tasks = config?.schedule?.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0) {
    process.stderr.write(`${PREFIX} no schedule.tasks declared in harness.config.json\n`);
    process.exit(2);
  }
  return tasks;
}

function runTask(task) {
  const started = Date.now();
  const r = spawnSync(task.run, {
    cwd: repoRoot,
    shell: true,
    encoding: 'utf8',
    timeout: task.timeoutMs ?? 300000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = `${r.stdout || ''}${r.stderr || ''}`.trim();
  return {
    name: task.name,
    required: task.required !== false,
    description: task.description ?? '',
    command: task.run,
    exitCode: r.status ?? (r.error ? 1 : 0),
    pass: r.status === 0,
    durationMs: Date.now() - started,
    output: output.length > MAX_OUTPUT ? `${output.slice(0, MAX_OUTPUT)}\n…(truncated)` : output,
  };
}

/** Aggregate task results into an overall verdict. Pure — exercised by --self-test. */
function summarize(results) {
  const requiredFailures = results.filter(r => r.required && !r.pass);
  const optionalFailures = results.filter(r => !r.required && !r.pass);
  return {
    ok: requiredFailures.length === 0,
    total: results.length,
    passed: results.filter(r => r.pass).length,
    requiredFailed: requiredFailures.length,
    optionalFailed: optionalFailures.length,
    results,
  };
}

function renderMarkdown(summary) {
  const lines = [
    '## Harness maintenance',
    '',
    `**${summary.ok ? '✅ healthy' : '❌ regression'}** — ${summary.passed}/${summary.total} tasks passed` +
      (summary.optionalFailed ? ` (${summary.optionalFailed} optional failing)` : ''),
    '',
    '| Task | Required | Result | Time |',
    '| ---- | -------- | ------ | ---- |',
  ];
  for (const r of summary.results) {
    const mark = r.pass ? '✅ pass' : r.required ? '❌ fail' : '⚠️ fail (optional)';
    lines.push(`| ${r.name} | ${r.required ? 'yes' : 'no'} | ${mark} | ${r.durationMs}ms |`);
  }
  const failures = summary.results.filter(r => !r.pass);
  if (failures.length > 0) {
    lines.push('', '<details><summary>Failure output</summary>', '');
    for (const f of failures) {
      lines.push(
        `#### ${f.name} (\`${f.command}\`, exit ${f.exitCode})`,
        '',
        '```',
        f.output,
        '```',
        ''
      );
    }
    lines.push('</details>');
  }
  return lines.join('\n');
}

function parseArgs(argv) {
  const args = { list: false, json: false, selfTest: false, help: false, only: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--list' || a === '--dry-run') args.list = true;
    else if (a === '--json') args.json = true;
    else if (a === '--self-test') args.selfTest = true;
    else if (a === '--only') args.only.push(argv[++i]);
    else if (a === '--help' || a === '-h') args.help = true;
    else {
      process.stderr.write(`${PREFIX} unknown option: ${a}\n`);
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    [
      'Usage: node scripts/harness/scheduled-maintenance.mjs [options]',
      '',
      'Deterministic, unattended harness maintenance. Tasks come from harness.config.json',
      '(schedule.tasks). Exits 1 only when a required task fails.',
      '',
      '  --list / --dry-run   Print the task plan without executing.',
      '  --only <name>        Run only the named task (repeatable).',
      '  --json               Machine-readable output.',
      '  --self-test          Deterministic aggregation checks (no execution).',
    ].join('\n') + '\n'
  );
}

function runSelfTest() {
  const cases = [
    {
      name: 'all pass → ok',
      results: [
        { name: 'a', required: true, pass: true },
        { name: 'b', required: false, pass: true },
      ],
      expect: s => s.ok && s.passed === 2 && s.requiredFailed === 0,
    },
    {
      name: 'required failure → not ok',
      results: [{ name: 'a', required: true, pass: false }],
      expect: s => !s.ok && s.requiredFailed === 1,
    },
    {
      name: 'optional failure stays ok',
      results: [
        { name: 'a', required: true, pass: true },
        { name: 'b', required: false, pass: false },
      ],
      expect: s => s.ok && s.optionalFailed === 1,
    },
    {
      name: 'markdown reflects verdict',
      results: [
        {
          name: 'a',
          required: true,
          pass: false,
          durationMs: 5,
          command: 'x',
          exitCode: 1,
          output: 'boom',
        },
      ],
      expect: s =>
        renderMarkdown(s).includes('❌ regression') && renderMarkdown(s).includes('boom'),
    },
    {
      name: 'empty results → ok and zero counts',
      results: [],
      expect: s => s.ok && s.total === 0 && s.passed === 0,
    },
  ];

  let passed = 0;
  process.stdout.write(`${PREFIX} Running ${cases.length} self-tests...\n`);
  for (const c of cases) {
    let ok = false;
    try {
      ok = c.expect(summarize(c.results));
    } catch (e) {
      process.stdout.write(`      ${e instanceof Error ? e.message : String(e)}\n`);
    }
    process.stdout.write(`  ${ok ? '✓' : '✗'} ${c.name}\n`);
    if (ok) passed += 1;
  }
  process.stdout.write(`\n${PREFIX} ${passed}/${cases.length} self-tests passed\n`);
  return passed === cases.length ? 0 : 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.selfTest) {
    return runSelfTest();
  }

  let tasks = loadTasks();
  if (args.only.length > 0) {
    tasks = tasks.filter(t => args.only.includes(t.name));
    if (tasks.length === 0) {
      process.stderr.write(`${PREFIX} no configured task matched --only ${args.only.join(', ')}\n`);
      return 2;
    }
  }

  if (args.list) {
    process.stdout.write(`${PREFIX} ${tasks.length} task(s):\n`);
    for (const t of tasks) {
      process.stdout.write(
        `  ${t.required === false ? '○ optional' : '● required'}  ${t.name}: ${t.run}\n`
      );
    }
    return 0;
  }

  process.stdout.write(`${PREFIX} running ${tasks.length} task(s)...\n`);
  const results = tasks.map(t => {
    const res = runTask(t);
    process.stdout.write(
      `  ${res.pass ? '✓' : res.required ? '✗' : '·'} ${res.name} (exit ${res.exitCode}, ${res.durationMs}ms)\n`
    );
    return res;
  });
  const summary = summarize(results);

  const markdown = renderMarkdown(summary);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
    } catch {
      /* best-effort summary */
    }
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } else {
    process.stdout.write(
      `${PREFIX} ${summary.ok ? 'HEALTHY' : 'REGRESSION'} — ${summary.passed}/${summary.total} passed` +
        (summary.optionalFailed ? `, ${summary.optionalFailed} optional failing\n` : '\n')
    );
  }
  return summary.ok ? 0 : 1;
}

process.exit(main());
