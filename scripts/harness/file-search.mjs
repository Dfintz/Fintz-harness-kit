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

const harnessDir = dirname(fileURLToPath(import.meta.url));
const vectorSearchPath = resolve(harnessDir, 'vector-search.mjs');

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
        usage: 'node scripts/harness/file-search.mjs [index|search] --query <text> [options]',
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
          '--root <path>': 'Directory to index/search (default: CWD)',
          '--top <n>': 'Max results to return (default: 10)',
          '--chunk-size <n>': 'Characters per chunk (default: 2000)',
          '--chunk-overlap <n>': 'Overlap between chunks (default: 200)',
          '--max-file-bytes <n>': 'Skip files larger than this (default: 524288)',
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

  return { subcommand, args };
}

const flags = parseArgs(process.argv.slice(2));

if (flags.help) {
  showHelp();
  process.exit(0);
}

const { args } = buildVectorArgs(flags);

const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
