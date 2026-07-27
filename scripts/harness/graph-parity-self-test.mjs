#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const providers = ['understand-anything', 'graphify', 'both'];
const composeFile = resolve(repoRoot, 'docker-compose.harness.yml');

const defaultDockerPaths = process.platform === 'win32'
  ? [
      'C:/Program Files/Docker/Docker/resources/bin/docker.exe',
      'C:/ProgramData/DockerDesktop/version-bin/docker.exe',
    ]
  : ['/usr/bin/docker', '/usr/local/bin/docker'];

function resolveDockerExecutable() {
  const override =
    typeof process.env.HARNESS_DOCKER_EXECUTABLE === 'string'
      ? process.env.HARNESS_DOCKER_EXECUTABLE.trim()
      : '';
  if (override.length > 0) {
    if (!isAbsolute(override)) return null;
    return existsSync(override) ? override : null;
  }
  for (const candidate of defaultDockerPaths) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const dockerExecutable = resolveDockerExecutable();

function parseArgs(argv) {
  const flags = { _: [] };
  for (const arg of argv) {
    if (arg === '--local-only') flags.localOnly = true;
    else if (arg === '--require-docker') flags.requireDocker = true;
    else flags._.push(arg);
  }
  return flags;
}

function runNode(args, env = {}) {
  return spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
}

function runDocker(args) {
  if (!dockerExecutable) {
    return {
      status: 1,
      stdout: '',
      stderr:
        'docker executable is not configured. Set HARNESS_DOCKER_EXECUTABLE to an absolute docker path or install docker in a standard absolute location.',
    };
  }

  return spawnSync(dockerExecutable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
}

function parseJson(stdoutText) {
  try {
    return JSON.parse(String(stdoutText || '').trim());
  } catch {
    return null;
  }
}

function validateCorePayload(payload) {
  if (!payload || typeof payload !== 'object') return 'payload is not an object';
  if (typeof payload.provider !== 'string') return 'missing provider';
  if (!Array.isArray(payload.activeProviders)) return 'missing activeProviders';
  if (!Object.hasOwn(payload, 'queryGraphPath')) return 'missing queryGraphPath';
  if (!Object.hasOwn(payload, 'refreshReadiness')) return 'missing refreshReadiness';
  if (!Object.hasOwn(payload, 'degradationReason')) return 'missing degradationReason';
  return null;
}

function runLocalMatrix(results) {
  for (const provider of providers) {
    for (const command of ['provider-status', 'genui-status']) {
      const run = runNode([
        'scripts/harness/graph.mjs',
        command,
        '--provider',
        provider,
        '--json',
        '--compact',
      ]);
      const payload = parseJson(run.stdout);
      const coreError = payload ? validateCorePayload(payload) : 'output is not JSON';
      results.push({
        target: 'local',
        provider,
        command,
        ok: run.status === 0 && coreError === null,
        status: run.status,
        error:
          run.status === 0 && coreError === null
            ? null
            : coreError || (run.stderr || run.stdout || '').trim().slice(-400),
      });
    }
  }
}

function runDockerMatrix(results) {
  const dockerVersion = runDocker(['compose', 'version']);
  if (dockerVersion.status !== 0) {
    return { available: false, reason: 'docker compose is not available' };
  }
  const dockerInfo = runDocker(['info']);
  if (dockerInfo.status !== 0) {
    return {
      available: false,
      reason: (dockerInfo.stderr || dockerInfo.stdout || 'docker daemon is not reachable')
        .trim()
        .slice(-240),
    };
  }

  for (const provider of providers) {
    const run = runDocker([
      'compose',
      '-f',
      composeFile,
      'run',
      '--rm',
      '--no-deps',
      '-e',
      `HARNESS_GRAPH_PROVIDER=${provider}`,
      'harness-dashboard',
      'node',
      'scripts/harness/graph.mjs',
      'genui-status',
      '--json',
      '--compact',
    ]);
    const payload = parseJson(run.stdout);
    const coreError = payload ? validateCorePayload(payload) : 'output is not JSON';
    const message = (run.stderr || run.stdout || '').trim();
    results.push({
      target: 'docker',
      provider,
      command: 'genui-status',
      ok: run.status === 0 && coreError === null,
      status: run.status,
      error:
        run.status === 0 && coreError === null
          ? null
          : coreError || message.slice(-400),
    });
  }
  return { available: true, reason: null };
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const results = [];
  runLocalMatrix(results);

  let docker = { available: true, reason: null };
  if (!flags.localOnly) {
    docker = runDockerMatrix(results);
    if (!docker.available && flags.requireDocker) {
      process.stdout.write(
        `${JSON.stringify(
          {
            ok: false,
            error: docker.reason,
            results,
          },
          null,
          2
        )}\n`
      );
      process.exit(1);
    }
  }

  const failed = results.filter(item => !item.ok);
  const payload = {
    ok: failed.length === 0,
    matrix: {
      providers,
      localChecksPerProvider: 2,
      dockerChecksPerProvider: flags.localOnly ? 0 : 1,
    },
    docker,
    failedCount: failed.length,
    results,
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(payload.ok ? 0 : 1);
}

main();
