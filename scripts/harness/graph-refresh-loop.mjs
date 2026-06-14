#!/usr/bin/env node
/**
 * Continuous refresh loop for deterministic graph updates.
 * Intended for optional Docker sidecar usage.
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const refreshScript = resolve(repoRoot, 'scripts', 'harness', 'refresh-graph.mjs');

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

    if (arg === '--run-once' || arg === '--commit' || arg === '--with-local-state') {
      flags[arg.slice(2)] = true;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    flags[key] = next;
    i += 1;
  }
  return flags;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'n') {
    return false;
  }
  return fallback;
}

function sleep(ms) {
  return new Promise(resolveSleep => {
    setTimeout(resolveSleep, ms);
  });
}

function runRefresh(options) {
  const args = [refreshScript, '--plugin-root', options.pluginRoot];
  if (options.commit) args.push('--commit');
  if (options.withLocalState) args.push('--with-local-state');
  if (options.commitMessage) args.push('--commit-message', options.commitMessage);

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // The graph build emits thousands of diagnostic lines on large repos. The
    // default 1 MB cap makes spawnSync SIGTERM-kill the child (surfacing as a
    // confusing "exit null"), so allow generous piped output.
    maxBuffer: 256 * 1024 * 1024,
  });

  const stamp = new Date().toISOString();
  if (result.status === 0) {
    process.stdout.write(`[graph-refresh-loop] ${stamp} refresh succeeded\n`);
    const output = (result.stdout || '').trim();
    if (output) process.stdout.write(`${output}\n`);
    return 0;
  }

  const reason =
    result.signal != null ? `signal ${result.signal}` : `exit ${result.status ?? 'unknown'}`;
  process.stderr.write(`[graph-refresh-loop] ${stamp} refresh failed (${reason})\n`);
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: {
          command: 'node scripts/harness/graph-refresh-loop.mjs --plugin-root <path> [options]',
          options: {
            '--interval-seconds <n>': 'Interval between refresh cycles (default 600).',
            '--run-once': 'Run a single refresh and exit.',
            '--commit': 'Enable auto-commit for graph file changes.',
            '--with-local-state': 'Also write meta/fingerprints local artifacts.',
            '--commit-message <text>': 'Auto-commit message override.',
          },
          envFallbacks: {
            UNDERSTAND_PLUGIN_ROOT: 'Plugin root when --plugin-root is not set.',
            GRAPH_REFRESH_INTERVAL_SECONDS: 'Default refresh interval.',
            GRAPH_REFRESH_RUN_ONCE: 'true/false toggle for one-shot mode.',
            GRAPH_REFRESH_AUTO_COMMIT: 'true/false toggle for --commit behavior.',
            GRAPH_REFRESH_COMMIT_MESSAGE: 'Commit message override.',
          },
        },
      },
      null,
      2
    )}\n`
  );
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const pluginRoot = String(
    flags['plugin-root'] || process.env.UNDERSTAND_PLUGIN_ROOT || ''
  ).trim();
  if (!pluginRoot) {
    throw new Error('Missing plugin root. Provide --plugin-root or UNDERSTAND_PLUGIN_ROOT.');
  }

  const intervalFromFlags = Number(flags['interval-seconds']);
  const intervalFromEnv = Number(process.env.GRAPH_REFRESH_INTERVAL_SECONDS || 600);
  const intervalSeconds =
    Number.isFinite(intervalFromFlags) && intervalFromFlags > 0
      ? Math.floor(intervalFromFlags)
      : Number.isFinite(intervalFromEnv) && intervalFromEnv > 0
        ? Math.floor(intervalFromEnv)
        : 600;

  const options = {
    pluginRoot,
    commit: Boolean(flags.commit) || parseBoolean(process.env.GRAPH_REFRESH_AUTO_COMMIT, false),
    withLocalState:
      Boolean(flags['with-local-state']) ||
      parseBoolean(process.env.GRAPH_REFRESH_WITH_LOCAL_STATE, false),
    commitMessage: flags['commit-message'] || process.env.GRAPH_REFRESH_COMMIT_MESSAGE || '',
  };

  const runOnce =
    Boolean(flags['run-once']) || parseBoolean(process.env.GRAPH_REFRESH_RUN_ONCE, false);

  if (runOnce) {
    const code = runRefresh(options);
    process.exit(code);
  }

  process.stdout.write(
    `[graph-refresh-loop] started (interval=${intervalSeconds}s, commit=${options.commit ? 'on' : 'off'})\n`
  );

  for (;;) {
    runRefresh(options);
    await sleep(intervalSeconds * 1000);
  }
}

main().catch(error => {
  process.stderr.write(
    `[graph-refresh-loop] fatal: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
});
