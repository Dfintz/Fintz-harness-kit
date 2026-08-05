#!/usr/bin/env node
/**
 * file-search — filesystem-first semantic search CLI for the harness.
 *
 * Thin convenience wrapper around vector-search.mjs that defaults to --scope fs
 * so operators can index and query arbitrary directories without knowing the full
 * vector-search API.
 *
 * Usage:
 *   node scripts/harness/file-search.mjs --query "error handling" --root /path/to/docs
 *   node scripts/harness/file-search.mjs index --root /path/to/project
 *   node scripts/harness/file-search.mjs --query "auth flow" --root . --top 5
 *
 * All flags are forwarded to vector-search.mjs. Defaults changed:
 *   --scope   fs         (only filesystem chunks)
 *   --root    $CWD       (current working directory)
 *   --model   nomic-embed-text
 */
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createManifestAllowlist } from './manifest-allowlist.mjs';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const vectorSearchPath = resolve(harnessDir, 'vector-search.mjs');
const repoManifestAllowlist = createManifestAllowlist({
  rootDir: repoRoot,
  fail: message => { throw new Error(message); },
});

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
      continue;
    }
    const key = arg.slice(2);
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

function showHelp() {
  process.stdout.write(
    JSON.stringify(
      {
        usage: 'node scripts/harness/file-search.mjs [index|search|eval-pilot] --query <text> [options]',
        description:
          'Filesystem-first semantic search. Indexes and queries arbitrary directory trees via Ollama embeddings.',
        defaults: {
          scope: 'fs',
          root: 'current working directory',
          model: 'nomic-embed-text (HARNESS_EMBED_MODEL)',
          host: 'http://localhost:11434 (OLLAMA_HOST / HARNESS_LLM_HOST)',
          chunkSize: '2000 chars (HARNESS_FS_CHUNK_SIZE)',
          chunkOverlap: '200 chars (HARNESS_FS_CHUNK_OVERLAP)',
          maxFileBytes: '524288 bytes / 512 KB (HARNESS_FS_MAX_FILE_BYTES)',
        },
        flags: {
          '--query <text>': 'Semantic search query (required for search)',
          '--eval-set <path>': 'Eval set JSON path (required for eval-pilot)',
          '--root <path>': 'Directory to index/search (default: CWD)',
          '--top <n>': 'Max results to return (default: 10)',
          '--repeats <n>': 'Eval-pilot repetitions per variant (default: 3)',
          '--chunk-size <n>': 'Characters per chunk (default: 2000)',
          '--chunk-overlap <n>': 'Overlap between chunks (default: 200)',
          '--max-file-bytes <n>': 'Skip files larger than this (default: 524288)',
          '--contextual-fs': 'Enable contextual filesystem embeddings for index/search',
          '--no-contextual-fs': 'Disable contextual filesystem embeddings for this invocation',
          '--ext <.md,.js,...>': 'File extensions to include',
          '--model <name>': 'Embedding model (default: nomic-embed-text)',
          '--host <url>': 'Ollama base URL (default: http://localhost:11434)',
          '--force': 'Force re-embedding even if hash matches',
          '--verbose': 'Print embedding progress to stderr',
          '--min-score <n>': 'Minimum cosine similarity threshold',
        },
        examples: [
          'node scripts/harness/file-search.mjs index --root /path/to/docs',
          'node scripts/harness/file-search.mjs --query "authentication flow" --root .',
          'node scripts/harness/file-search.mjs eval-pilot --eval-set .github/harness/eval-sets/t2-contextual-embeddings-pilot.json --root .',
          'node scripts/harness/file-search.mjs --query "error handling" --root /var/log --ext .log,.txt',
          'npm run harness:search -- --query "chunking strategy" --root .',
        ],
        hardwareNote:
          'On a 50 GB Intel CPU server: use OLLAMA_NUM_PARALLEL=1 OLLAMA_MAX_LOADED_MODELS=1. ' +
          'Recommended models: nomic-embed-text (embed), qwen2.5:14b or llama3.1:8b (generation).',
      },
      null,
      2
    ) + '\n'
  );
}

function parsePositiveInt(value, fallback, label) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Math.floor(parsed);
}

function parseNumber(value, fallback, label) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new TypeError(`${label} must be a number`);
  }
  return parsed;
}

function runVectorJson(args) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error(
      `vector-search returned non-JSON output (exit ${result.status ?? 1}): ${stderr || stdout}`
    );
  }
  if (result.status !== 0 || payload?.ok === false) {
    throw new Error(payload?.error || stderr || `vector-search command failed with exit ${result.status ?? 1}`);
  }
  return payload;
}

function pathMatchesExpectation(resultPath, expectedMarkers) {
  if (!resultPath || !Array.isArray(expectedMarkers) || expectedMarkers.length === 0) return false;
  const normalizedPath = String(resultPath).replaceAll('\\', '/').toLowerCase();
  return expectedMarkers.some(marker =>
    normalizedPath.includes(String(marker).replaceAll('\\', '/').toLowerCase())
  );
}

function percentile95(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildIndexArgs({ flags, root, contextual }) {
  const args = [vectorSearchPath, 'index', '--scope', 'fs', '--root', root, '--force'];
  if (contextual) args.push('--contextual-fs');
  else args.push('--no-contextual-fs');

  const forwardPairs = [
    ['model', '--model'],
    ['host', '--host'],
    ['provider', '--provider'],
    ['max-text-chars', '--max-text-chars'],
    ['chunk-size', '--chunk-size'],
    ['chunk-overlap', '--chunk-overlap'],
    ['max-file-bytes', '--max-file-bytes'],
    ['ext', '--ext'],
    ['timeout-ms', '--timeout-ms'],
  ];

  for (const [key, flag] of forwardPairs) {
    if (flags[key] !== undefined && flags[key] !== true && flags[key] !== false) {
      args.push(flag, String(flags[key]));
    }
  }
  if (flags.verbose) args.push('--verbose');
  return args;
}

function buildSearchArgs({ flags, root, top, query, contextual }) {
  const args = [
    vectorSearchPath,
    'search',
    '--scope',
    'fs',
    '--root',
    root,
    '--query',
    query,
    '--top',
    String(top),
  ];
  if (contextual) args.push('--contextual-fs');
  else args.push('--no-contextual-fs');

  const forwardPairs = [
    ['model', '--model'],
    ['host', '--host'],
    ['provider', '--provider'],
    ['min-score', '--min-score'],
    ['max-text-chars', '--max-text-chars'],
    ['chunk-size', '--chunk-size'],
    ['chunk-overlap', '--chunk-overlap'],
    ['max-file-bytes', '--max-file-bytes'],
    ['ext', '--ext'],
    ['timeout-ms', '--timeout-ms'],
  ];

  for (const [key, flag] of forwardPairs) {
    if (flags[key] !== undefined && flags[key] !== true && flags[key] !== false) {
      args.push(flag, String(flags[key]));
    }
  }
  args.push('--no-auto-index');
  return args;
}

function loadEvalSet(flags) {
  const evalSetInput = flags['eval-set'] ? String(flags['eval-set']).trim() : '';
  if (!evalSetInput) {
    throw new Error('eval-pilot requires --eval-set <path>');
  }
  if (!evalSetInput.endsWith('.json')) {
    throw new Error('eval-pilot requires a .json eval set');
  }
  const evalSetPath = repoManifestAllowlist.selectPath(evalSetInput, 'eval set');
  const rawEvalSet = JSON.parse(repoManifestAllowlist.readUtf8Path(evalSetInput, 'eval set'));
  const cases = Array.isArray(rawEvalSet.cases) ? rawEvalSet.cases : [];
  if (cases.length === 0) {
    throw new Error('Eval set must include a non-empty `cases` array.');
  }
  return { evalSetPath, rawEvalSet, cases };
}

function evaluateCase({ flags, root, top, query, contextual, testCase }) {
  const searchPayload = runVectorJson(
    buildSearchArgs({
      flags,
      root,
      top,
      query,
      contextual,
    })
  );

  const expectedMarkers = Array.isArray(testCase.expectedPathMarkers)
    ? testCase.expectedPathMarkers
    : [];
  let relevant = 0;
  let hit = false;

  for (const result of searchPayload.results || []) {
    if (pathMatchesExpectation(result.path, expectedMarkers)) {
      relevant += 1;
      hit = true;
    }
  }

  return {
    id: testCase.id || null,
    query: testCase.query,
    expectedPathMarkers: expectedMarkers,
    precisionAtK: top > 0 ? relevant / top : 0,
    hitAtK: hit ? 1 : 0,
    relevant,
    returned: Number(searchPayload.returnedCount || 0),
    searchDurationMs: Number(searchPayload.searchDurationMs || 0),
  };
}

function runVariantEvaluation({ flags, root, top, repeats, cases, variant }) {
  const runMetrics = [];
  const runCaseRows = [];

  for (let run = 1; run <= repeats; run += 1) {
    const indexPayload = runVectorJson(buildIndexArgs({ flags, root, contextual: variant.contextual }));

    const caseRows = [];
    const precisions = [];
    const hits = [];
    const searchDurations = [];

    for (const testCase of cases) {
      if (!testCase || typeof testCase.query !== 'string' || testCase.query.trim().length === 0) continue;
      const caseResult = evaluateCase({
        flags,
        root,
        top,
        query: testCase.query,
        contextual: variant.contextual,
        testCase,
      });
      caseRows.push(caseResult);
      precisions.push(caseResult.precisionAtK);
      hits.push(caseResult.hitAtK);
      searchDurations.push(caseResult.searchDurationMs);
    }

    runMetrics.push({
      run,
      avgPrecisionAtK:
        precisions.length > 0
          ? precisions.reduce((sum, value) => sum + value, 0) / precisions.length
          : 0,
      hitRateAtK: hits.length > 0 ? hits.reduce((sum, value) => sum + value, 0) / hits.length : 0,
      retrievalLatencyP95Ms: percentile95(searchDurations),
      indexingChars: Number(indexPayload.selectedEmbeddingChars || 0),
      indexingCharsRaw: Number(indexPayload.selectedEmbeddingCharsRaw || indexPayload.selectedEmbeddingChars || 0),
      indexingDurationMs: Number(indexPayload.indexingDurationMs || 0),
    });

    runCaseRows.push({ run, cases: caseRows });
  }

  return {
    variant: variant.key,
    contextualFs: variant.contextual,
    runs: runMetrics,
    caseRows: runCaseRows,
    aggregate: {
      medianAvgPrecisionAtK: median(runMetrics.map(metric => metric.avgPrecisionAtK)),
      medianHitRateAtK: median(runMetrics.map(metric => metric.hitRateAtK)),
      medianRetrievalLatencyP95Ms: median(runMetrics.map(metric => metric.retrievalLatencyP95Ms)),
      medianIndexingChars: median(runMetrics.map(metric => metric.indexingChars)),
      medianIndexingCharsRaw: median(runMetrics.map(metric => metric.indexingCharsRaw)),
      medianIndexingDurationMs: median(runMetrics.map(metric => metric.indexingDurationMs)),
    },
  };
}

function executeEvalPilot(flags) {
  const { evalSetPath, rawEvalSet, cases } = loadEvalSet(flags);

  const root = flags.root || process.cwd();
  const top = parsePositiveInt(flags.top, parsePositiveInt(rawEvalSet.topK, 5, 'evalSet.topK'), 'top');
  const repeats = parsePositiveInt(flags.repeats, parsePositiveInt(rawEvalSet.repeats, 3, 'evalSet.repeats'), 'repeats');

  const criteria = {
    precisionAtKDeltaMin: parseNumber(rawEvalSet?.criteria?.precisionAtKDeltaMin, 0.1, 'criteria.precisionAtKDeltaMin'),
    hitRateAtKDeltaMin: parseNumber(rawEvalSet?.criteria?.hitRateAtKDeltaMin, 0.15, 'criteria.hitRateAtKDeltaMin'),
    indexingCharsGrowthPctMax: parseNumber(rawEvalSet?.criteria?.indexingCharsGrowthPctMax, 25, 'criteria.indexingCharsGrowthPctMax'),
    retrievalLatencyP95GrowthPctMax: parseNumber(rawEvalSet?.criteria?.retrievalLatencyP95GrowthPctMax, 20, 'criteria.retrievalLatencyP95GrowthPctMax'),
  };

  const variants = [
    { key: 'baseline', contextual: false },
    { key: 'contextual', contextual: true },
  ];

  const variantResults = variants.map(variant =>
    runVariantEvaluation({ flags, root, top, repeats, cases, variant })
  );

  const baseline = variantResults.find(result => result.variant === 'baseline');
  const contextual = variantResults.find(result => result.variant === 'contextual');
  if (!baseline || !contextual) {
    throw new Error('Failed to compute both baseline and contextual variant results.');
  }

  const safeDeltaPct = (current, prior) => {
    if (prior === 0) return current === 0 ? 0 : Number.POSITIVE_INFINITY;
    return ((current - prior) / prior) * 100;
  };

  const deltas = {
    avgPrecisionAtKDelta: contextual.aggregate.medianAvgPrecisionAtK - baseline.aggregate.medianAvgPrecisionAtK,
    hitRateAtKDelta: contextual.aggregate.medianHitRateAtK - baseline.aggregate.medianHitRateAtK,
    indexingCharsGrowthPct: safeDeltaPct(contextual.aggregate.medianIndexingCharsRaw, baseline.aggregate.medianIndexingCharsRaw),
    retrievalLatencyP95GrowthPct: safeDeltaPct(contextual.aggregate.medianRetrievalLatencyP95Ms, baseline.aggregate.medianRetrievalLatencyP95Ms),
  };

  const gateChecks = {
    precisionAtK: deltas.avgPrecisionAtKDelta >= criteria.precisionAtKDeltaMin,
    hitRateAtK: deltas.hitRateAtKDelta >= criteria.hitRateAtKDeltaMin,
    indexingChars: deltas.indexingCharsGrowthPct <= criteria.indexingCharsGrowthPctMax,
    retrievalLatencyP95: deltas.retrievalLatencyP95GrowthPct <= criteria.retrievalLatencyP95GrowthPctMax,
  };

  const verdict = Object.values(gateChecks).every(Boolean) ? 'GO' : 'NO-GO';

  return {
    ok: true,
    action: 'eval-pilot',
    evalSetPath,
    evalSetName: rawEvalSet.name || null,
    root,
    top,
    repeats,
    variants: variantResults,
    criteria,
    deltas,
    gateChecks,
    verdict,
    notes: [
      'Median aggregation is used across repeated runs for deterministic comparison.',
      'If provider is unavailable, command fails and should be treated as incomplete per brief constraints.',
    ],
    generatedAt: new Date().toISOString(),
  };
}

function buildVectorArgs(flags) {
  const positional = flags._;
  // Determine subcommand: if first positional is 'index', use index; otherwise default to search
  const subcommand = positional[0] === 'index' ? 'index' : 'search';

  const args = [vectorSearchPath, subcommand];

  // Always set scope to fs unless overridden
  if (!flags.scope) args.push('--scope', 'fs');
  else args.push('--scope', String(flags.scope));

  // Root defaults to CWD
  const root = flags.root || process.cwd();
  args.push('--root', root);

  // Forward known flags
  const forwardPairs = [
    ['query', '--query'],
    ['top', '--top'],
    ['model', '--model'],
    ['host', '--host'],
    ['provider', '--provider'],
    ['min-score', '--min-score'],
    ['max-text-chars', '--max-text-chars'],
    ['chunk-size', '--chunk-size'],
    ['chunk-overlap', '--chunk-overlap'],
    ['max-file-bytes', '--max-file-bytes'],
    ['ext', '--ext'],
    ['timeout-ms', '--timeout-ms'],
    ['graph-limit', '--graph-limit'],
  ];
  for (const [key, flag] of forwardPairs) {
    if (flags[key] !== undefined && flags[key] !== true && flags[key] !== false) {
      args.push(flag, String(flags[key]));
    }
  }
  if (flags.force) args.push('--force');
  if (flags.verbose) args.push('--verbose');
  if (flags['no-auto-index']) args.push('--no-auto-index');
  if (flags['contextual-fs']) args.push('--contextual-fs');
  if (flags['no-contextual-fs']) args.push('--no-contextual-fs');

  return { subcommand, args };
}

const flags = parseArgs(process.argv.slice(2));

if (flags.help) {
  showHelp();
  process.exit(0);
}

if (flags._[0] === 'eval-pilot') {
  try {
    const payload = executeEvalPilot(flags);
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(0);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ ok: false, action: 'eval-pilot', error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`
    );
    process.exit(1);
  }
}

const { args } = buildVectorArgs(flags);

const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
