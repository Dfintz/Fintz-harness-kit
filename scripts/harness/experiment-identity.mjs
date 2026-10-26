import { createHash } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function identityDigest(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
}

export function executionIdentity(settings) {
  return { version: 1, configuration: identityDigest(settings), checkpoint: null };
}

function checkpointDigest(repoRoot, targets, record) {
  const root = realpathSync(repoRoot);
  const files = [...targets].sort().map(target => {
    const path = realpathSync(resolve(root, target));
    const local = relative(root, path);
    if (!local || local.startsWith('..') || isAbsolute(local)) {
      throw new Error('Experiment checkpoint target must remain inside the repository.');
    }
    return [target, createHash('sha256').update(readFileSync(path)).digest('hex')];
  });
  return identityDigest({ files, metric: record.metric, iterations: record.iterations });
}

export function sealExperimentCheckpoint(repoRoot, targets, record) {
  record.identity.checkpoint = {
    state: 'ready',
    digest: checkpointDigest(repoRoot, targets, record),
  };
}

export function assertExperimentResume(repoRoot, targets, record, expected) {
  if (record.identity?.version !== 1) {
    throw new Error('Resume journal has no supported execution identity; start a fresh run.');
  }
  if (record.identity.configuration !== expected.configuration) {
    throw new Error('Resume configuration changed; start a fresh run with the new settings.');
  }
  if (record.identity.checkpoint?.state !== 'ready') {
    throw new Error('Resume checkpoint is incomplete or in-flight; inspect targets and start a fresh run.');
  }
  if (!Number.isFinite(record.metric?.baseline) || !Number.isFinite(record.metric?.best)) {
    throw new Error('Resume checkpoint has invalid metric progress.');
  }
  if (!Array.isArray(record.iterations) || record.iterations.some((entry, index) =>
    entry.iteration !== index + 1 || !Number.isFinite(entry.best) || typeof entry.kept !== 'boolean')) {
    throw new Error('Resume checkpoint has invalid iteration progress.');
  }
  if (record.identity.checkpoint.digest !== checkpointDigest(repoRoot, targets, record)) {
    throw new Error('Resume checkpoint changed or targets are missing; no files were restored.');
  }
}