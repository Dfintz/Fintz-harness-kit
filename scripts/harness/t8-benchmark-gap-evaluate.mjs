#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const DEFAULT_PACKET_PATH = '.github/harness/eval-sets/t8-hybrid-fusion-benchmark-gap-packet.json';
const DEFAULT_MANIFEST_PATH = '.github/harness/eval-sets/t8-hybrid-fusion-input-manifest.json';
const DEFAULT_SOURCE_REGISTRY_PATH = '.github/harness/eval-sets/t8-hybrid-fusion-source-registry.json';

const TRUSTED_JSON_READERS = Object.freeze({
  [DEFAULT_PACKET_PATH]: () =>
    JSON.parse(
      readFileSync(
        resolveRepoRelative(DEFAULT_PACKET_PATH, DEFAULT_PACKET_PATH),
        'utf8',
      ),
    ),
  [DEFAULT_MANIFEST_PATH]: () =>
    JSON.parse(
      readFileSync(
        resolveRepoRelative(DEFAULT_MANIFEST_PATH, DEFAULT_MANIFEST_PATH),
        'utf8',
      ),
    ),
  [DEFAULT_SOURCE_REGISTRY_PATH]: () =>
    JSON.parse(
      readFileSync(
        resolveRepoRelative(DEFAULT_SOURCE_REGISTRY_PATH, DEFAULT_SOURCE_REGISTRY_PATH),
        'utf8',
      ),
    ),
  '.github/harness/memory/briefs/t8-hybrid-fusion-benchmark-gap-input-smoke-2026-08-05.json': () =>
    JSON.parse(
      readFileSync(
        resolveRepoRelative(
          '.github/harness/memory/briefs/t8-hybrid-fusion-benchmark-gap-input-smoke-2026-08-05.json',
          '.github/harness/memory/briefs/t8-hybrid-fusion-benchmark-gap-input-smoke-2026-08-05.json',
        ),
        'utf8',
      ),
    ),
  '.github/harness/eval-sets/fixtures/t8-eval-go.json': () =>
    JSON.parse(
      readFileSync(
        resolveRepoRelative(
          '.github/harness/eval-sets/fixtures/t8-eval-go.json',
          '.github/harness/eval-sets/fixtures/t8-eval-go.json',
        ),
        'utf8',
      ),
    ),
  '.github/harness/eval-sets/fixtures/t8-eval-park.json': () =>
    JSON.parse(
      readFileSync(
        resolveRepoRelative(
          '.github/harness/eval-sets/fixtures/t8-eval-park.json',
          '.github/harness/eval-sets/fixtures/t8-eval-park.json',
        ),
        'utf8',
      ),
    ),
  '.github/harness/eval-sets/fixtures/t8-eval-invalid.json': () =>
    JSON.parse(
      readFileSync(
        resolveRepoRelative(
          '.github/harness/eval-sets/fixtures/t8-eval-invalid.json',
          '.github/harness/eval-sets/fixtures/t8-eval-invalid.json',
        ),
        'utf8',
      ),
    ),
});

function resolveRepoRelative(pathInput, defaultValue) {
  const raw = String(pathInput || defaultValue || '').trim();
  if (!raw) {
    throw new Error('Path cannot be empty');
  }
  if (/^[a-zA-Z]:[\\/]/.test(raw) || raw.startsWith('\\\\') || raw.startsWith('/')) {
    throw new Error(`Absolute paths are not allowed: ${raw}`);
  }
  const normalized = raw.replaceAll('\\', '/');
  if (normalized.split('/').includes('..')) {
    throw new Error(`Path traversal is not allowed: ${raw}`);
  }
  return join(repoRoot, normalized);
}

function normalizeRepoRelativePath(pathInput, label) {
  const normalized = String(pathInput || '').trim().replaceAll('\\', '/');
  if (!normalized) {
    throw new Error(`${label} path cannot be empty`);
  }
  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || normalized.startsWith('\\\\')) {
    throw new Error(`${label} must be repository-relative: ${pathInput}`);
  }
  if (normalized.split('/').includes('..')) {
    throw new Error(`${label} cannot include path traversal: ${pathInput}`);
  }
  if (!normalized.endsWith('.json')) {
    throw new Error(`${label} must be a .json file: ${pathInput}`);
  }
  return normalized;
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      flags._.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
}

function readRepoJson(relativePath, label) {
  const normalized = normalizeRepoRelativePath(relativePath, label);
  const reader = TRUSTED_JSON_READERS[normalized];
  if (!reader) {
    throw new Error(`${label} file is not in trusted literal reader registry: ${normalized}`);
  }
  try {
    const payload = reader();
    const absolutePath = resolveRepoRelative(normalized, normalized);
    return { relativePath: normalized, absolutePath, payload };
  } catch {
    throw new Error(`${label} file is invalid JSON: ${normalized}`);
  }
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function aggregateCaseHits(variant) {
  const byCase = new Map();
  const runRows = Array.isArray(variant?.caseRows) ? variant.caseRows : [];
  for (const runRow of runRows) {
    const cases = Array.isArray(runRow?.cases) ? runRow.cases : [];
    for (const item of cases) {
      const key = String(item?.id || item?.query || '').trim();
      if (!key) continue;
      const current = byCase.get(key) || { hits: 0, seen: 0 };
      current.hits += Number(item?.hitAtK || 0) > 0 ? 1 : 0;
      current.seen += 1;
      byCase.set(key, current);
    }
  }
  return byCase;
}

function summarizeEval(payload) {
  if (payload?.action !== 'eval-pilot' || !Array.isArray(payload?.variants)) {
    return null;
  }
  const variants = Array.isArray(payload?.variants) ? payload.variants : [];
  const baseline = variants.find(item => item?.variant === 'baseline') || null;
  const contextual = variants.find(item => item?.variant === 'contextual') || null;

  const baselineHit = toNumber(baseline?.aggregate?.medianHitRateAtK, 0);
  const contextualHit = toNumber(contextual?.aggregate?.medianHitRateAtK, 0);
  const baselinePrecision = toNumber(baseline?.aggregate?.medianAvgPrecisionAtK, 0);
  const contextualPrecision = toNumber(contextual?.aggregate?.medianAvgPrecisionAtK, 0);

  const bestHitRateAtK = Math.max(baselineHit, contextualHit);
  const bestPrecisionAtK = Math.max(baselinePrecision, contextualPrecision);

  const baselineCaseHits = aggregateCaseHits(baseline);
  const contextualCaseHits = aggregateCaseHits(contextual);
  const allCaseKeys = new Set([...baselineCaseHits.keys(), ...contextualCaseHits.keys()]);

  let persistentMissCount = 0;
  for (const key of allCaseKeys) {
    const baselineData = baselineCaseHits.get(key) || { hits: 0 };
    const contextualData = contextualCaseHits.get(key) || { hits: 0 };
    if (baselineData.hits === 0 && contextualData.hits === 0) {
      persistentMissCount += 1;
    }
  }

  return {
    sourceVerdict: payload?.verdict || null,
    bestHitRateAtK,
    bestPrecisionAtK,
    persistentMissCount,
    variantsSeen: variants.length,
  };
}

function evaluate(packet, evalSummaries) {
  const thresholds = packet?.thresholds || {};
  const minBestHitRateAtK = toNumber(thresholds.minBestHitRateAtK, 0.85);
  const minBestPrecisionAtK = toNumber(thresholds.minBestPrecisionAtK, 0.55);
  const minPersistentMissCount = toNumber(thresholds.minPersistentMissCount, 2);

  const sourceCount = evalSummaries.length;
  const bestHitRateAtK = sourceCount
    ? Math.max(...evalSummaries.map(item => item.bestHitRateAtK))
    : 0;
  const bestPrecisionAtK = sourceCount
    ? Math.max(...evalSummaries.map(item => item.bestPrecisionAtK))
    : 0;
  const persistentMissCount = sourceCount
    ? Math.max(...evalSummaries.map(item => item.persistentMissCount))
    : 0;

  const lowHitRateGap = bestHitRateAtK < minBestHitRateAtK;
  const lowPrecisionGap = bestPrecisionAtK < minBestPrecisionAtK;
  const persistentMissGap = persistentMissCount >= minPersistentMissCount;

  const benchmarkGapDetected = lowHitRateGap || lowPrecisionGap || persistentMissGap;
  const decision = benchmarkGapDetected ? 'GO_RESEARCH' : 'PARK';

  return {
    benchmarkGapDetected,
    decision,
    decisionReason: benchmarkGapDetected
      ? 'Semantic-only stack shows benchmark gap against T8 thresholds; hybrid fusion research may proceed.'
      : 'Current semantic stack does not breach T8 benchmark-gap thresholds; keep T8 parked.',
    thresholds: {
      minBestHitRateAtK,
      minBestPrecisionAtK,
      minPersistentMissCount,
    },
    measured: {
      sourceCount,
      bestHitRateAtK,
      bestPrecisionAtK,
      persistentMissCount,
    },
    gapChecks: {
      lowHitRateGap,
      lowPrecisionGap,
      persistentMissGap,
    },
  };
}

function showHelp() {
  process.stdout.write(
    JSON.stringify(
      {
        usage: 'node scripts/harness/t8-benchmark-gap-evaluate.mjs [--input-set <id>] [--output <path>] [--fail-on-park]',
        defaults: {
          packet: DEFAULT_PACKET_PATH,
          manifest: DEFAULT_MANIFEST_PATH,
          inputSet: 'from packet.inputs.defaultInputSet',
        },
      },
      null,
      2,
    ) + '\n',
  );
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(2);
}

function loadPacket() {
  try {
    const { absolutePath, payload } = readRepoJson(DEFAULT_PACKET_PATH, 'packet');
    return { packetPath: absolutePath, packet: payload };
  } catch (error) {
    fail(`[t8-benchmark-gap-evaluate] ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadManifest(packet) {
  const manifestPath =
    typeof packet?.inputs?.manifestPath === 'string' ? packet.inputs.manifestPath : DEFAULT_MANIFEST_PATH;
  try {
    const { absolutePath, payload } = readRepoJson(manifestPath, 'manifest');
    return { manifestPath: absolutePath, manifest: payload };
  } catch (error) {
    fail(`[t8-benchmark-gap-evaluate] ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadSourceRegistry(packet) {
  const sourceRegistryPath =
    typeof packet?.inputs?.sourceRegistryPath === 'string'
      ? packet.inputs.sourceRegistryPath
      : DEFAULT_SOURCE_REGISTRY_PATH;
  try {
    const { absolutePath, payload } = readRepoJson(sourceRegistryPath, 'source registry');
    return { sourceRegistryPath: absolutePath, sourceRegistry: payload };
  } catch (error) {
    fail(`[t8-benchmark-gap-evaluate] ${error instanceof Error ? error.message : String(error)}`);
  }
}

function selectInputSetId(flags, packet) {
  const fromFlag = typeof flags['input-set'] === 'string' ? flags['input-set'].trim() : '';
  if (fromFlag) return fromFlag;
  const fromPacket = typeof packet?.inputs?.defaultInputSet === 'string' ? packet.inputs.defaultInputSet.trim() : '';
  if (fromPacket) return fromPacket;
  fail('[t8-benchmark-gap-evaluate] no input set selected; pass --input-set <id> or set packet.inputs.defaultInputSet');
}

function resolveSourcesFromManifest(manifest, sourceRegistry, inputSetId) {
  const sets = Array.isArray(manifest?.sets) ? manifest.sets : [];
  const selected = sets.find(item => String(item?.id || '') === inputSetId);
  if (!selected) {
    fail(`[t8-benchmark-gap-evaluate] input set not found: ${inputSetId}`);
  }
  const sourceIds = Array.isArray(selected.sourceIds) ? selected.sourceIds : [];
  if (sourceIds.length === 0) {
    fail(`[t8-benchmark-gap-evaluate] input set has no sources: ${inputSetId}`);
  }
  const registryEntries = Array.isArray(sourceRegistry?.sources) ? sourceRegistry.sources : [];
  const registryMap = new Map(
    registryEntries.map(entry => [String(entry?.id || ''), String(entry?.path || '').trim()]),
  );

  return sourceIds.map(sourceId => {
    const id = String(sourceId || '').trim();
    const sourcePath = registryMap.get(id);
    if (!sourcePath) {
      fail(`[t8-benchmark-gap-evaluate] source id not found in registry: ${id}`);
    }
    const normalizedPath = normalizeRepoRelativePath(sourcePath, `source:${id}`);
    if (!existsSync(resolveRepoRelative(normalizedPath, normalizedPath))) {
      return { sourceId: id, relativePath: normalizedPath, missing: true };
    }
    return { sourceId: id, relativePath: normalizedPath, missing: false };
  });
}

function collectEvalSummaries(sourceFiles) {
  const evalSummaries = [];
  const invalidInputs = [];

  for (const sourceFile of sourceFiles) {
    if (sourceFile.missing) {
      invalidInputs.push({ inputPath: sourceFile.relativePath, sourceId: sourceFile.sourceId, reason: 'missing' });
      continue;
    }
    let payload;
    try {
      payload = readRepoJson(sourceFile.relativePath, `source:${sourceFile.sourceId}`).payload;
    } catch {
      invalidInputs.push({ inputPath: sourceFile.relativePath, sourceId: sourceFile.sourceId, reason: 'invalid-json' });
      continue;
    }
    const summary = summarizeEval(payload);
    if (!summary) {
      invalidInputs.push({ inputPath: sourceFile.relativePath, sourceId: sourceFile.sourceId, reason: 'unsupported-format' });
      continue;
    }
    evalSummaries.push({ sourceId: sourceFile.sourceId, inputPath: sourceFile.relativePath, ...summary });
  }

  if (evalSummaries.length === 0) {
    fail('[t8-benchmark-gap-evaluate] no valid eval input files found in selected input set');
  }

  return { evalSummaries, invalidInputs };
}

function maybeWriteOutput(flags, result) {
  if (typeof flags.output !== 'string' || !flags.output.trim()) {
    return;
  }
  const outputPath = resolveRepoRelative(flags.output.trim(), '.github/harness/memory/briefs/t8-benchmark-gap-eval-result.json');
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  result.output = outputPath;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  const { packetPath, packet } = loadPacket();
  const { manifestPath, manifest } = loadManifest(packet);
  const { sourceRegistryPath, sourceRegistry } = loadSourceRegistry(packet);
  const inputSetId = selectInputSetId(flags, packet);
  const sourceFiles = resolveSourcesFromManifest(manifest, sourceRegistry, inputSetId);
  const { evalSummaries, invalidInputs } = collectEvalSummaries(sourceFiles);

  const evaluation = evaluate(packet, evalSummaries);
  const result = {
    ok: true,
    ticket: packet.ticket || 'T8',
    packet: packetPath,
    manifest: manifestPath,
    sourceRegistry: sourceRegistryPath,
    inputSetId,
    evaluatedAt: new Date().toISOString(),
    inputs: evalSummaries,
    invalidInputs,
    evaluation,
  };

  maybeWriteOutput(flags, result);

  process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  if (flags['fail-on-park'] && evaluation.decision !== 'GO_RESEARCH') {
    process.exit(1);
  }
  process.exit(0);
}

main();
