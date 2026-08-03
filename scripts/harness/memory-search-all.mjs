#!/usr/bin/env node
/**
 * memory-search-all — unified cross-surface memory search (v3.1.0).
 *
 * Queries all harness memory surfaces in a single call:
 *   1. Ontology concepts (keyword match — fast, no Ollama needed)
 *   2. Memory link index (code cross-references)
 *   3. Vector semantic search (requires Ollama + indexed corpus)
 *
 * Surfaces 1 and 2 always work. Surface 3 falls back gracefully when Ollama is offline.
 *
 * Usage:
 *   node scripts/harness/memory-search-all.mjs --query "approval workflow"
 *   node scripts/harness/memory-search-all.mjs --query "PDF extraction" --top 5
 *   node scripts/harness/memory-search-all.mjs --query "stage machine" --no-vector
 *   npm run harness:memory:search -- --query "your question"
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const ontologyPath = join(repoRoot, '.github', 'harness', 'memory', 'ontology', 'core.json');
const vectorSearchPath = join(harnessDir, 'vector-search.mjs');
const memoryLinkPath = join(harnessDir, 'memory-link-index.mjs');
const mcpToolsPath = join(harnessDir, 'mcp-tools.mjs');

// ---------------------------------------------------------------------------
// Surface 1: Ontology keyword search (always available)
// ---------------------------------------------------------------------------

function ontologySearch(query) {
  if (!existsSync(ontologyPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(ontologyPath, 'utf8'));
    const q = query.toLowerCase();
    return (raw.concepts || [])
      .filter(c => {
        const text = [c.id, c.label, c.definition, ...(c.aliases || []), ...(c.memoryHints || [])].join(' ').toLowerCase();
        return text.includes(q);
      })
      .slice(0, 5)
      .map(c => ({
        surface: 'ontology',
        id: c.id,
        label: c.label,
        definition: c.definition,
        related: c.related || [],
        score: null,
      }));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Surface 2: Memory link index search
// ---------------------------------------------------------------------------

function memoryLinkSearch(query, top) {
  const r = spawnSync(process.execPath, [memoryLinkPath, 'search', '--query', query, '--top', String(top || 5)], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return [];
  try {
    const parsed = JSON.parse(r.stdout);
    return (parsed.results || []).slice(0, top || 5).map(item => ({
      surface: 'memory-link',
      name: item.name || item.file,
      path: item.path || item.file,
      summary: item.summary || item.snippet || '',
      score: item.score || null,
    }));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// Surface 3: Vector semantic search (requires Ollama)
// ---------------------------------------------------------------------------

function vectorSearch(query, top) {
  const r = spawnSync(process.execPath, [
    vectorSearchPath, 'search',
    '--query', query,
    '--scope', 'all',
    '--top', String(top || 8),
    '--no-auto-index',
  ], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return { results: [], error: (r.stderr || '').slice(0, 200) };
  try {
    const parsed = JSON.parse(r.stdout);
    return {
      results: (parsed.results || []).slice(0, top || 8).map(item => ({
        surface: 'vector',
        scope: item.scope,
        id: item.id,
        title: item.title,
        path: item.path,
        preview: item.preview,
        score: item.score,
      })),
      error: null,
    };
  } catch { return { results: [], error: 'parse error' }; }
}

// ---------------------------------------------------------------------------
// Memory text search (fast keyword fallback when vector unavailable)
// ---------------------------------------------------------------------------

function memoryTextSearch(query, top) {
  const r = spawnSync(process.execPath, [
    mcpToolsPath, 'memory-search', '--query', query, '--limit', String(top || 8),
  ], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0 || !r.stdout) return [];
  try {
    const parsed = JSON.parse(r.stdout);
    return (parsed.entries || []).slice(0, top || 8).map(item => ({
      surface: 'memory-text',
      scope: item.scope || 'memory',
      name: item.name,
      summary: item.summary || '',
      path: item.path || null,
      score: null,
    }));
  } catch { return []; }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { flags._.push(arg); continue; }
    if (arg === '--help') { flags.help = true; continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i += 1; } else { flags[key] = true; }
  }
  return flags;
}

function showHelp() {
  process.stdout.write(JSON.stringify({
    usage: 'node scripts/harness/memory-search-all.mjs --query <text> [options]',
    description: 'Unified cross-surface memory search: ontology (instant), memory text search, memory link index, and vector semantic search.',
    flags: {
      '--query <text>': 'Search query (required)',
      '--top <n>': 'Max results per surface (default: 5)',
      '--no-vector': 'Skip vector search (use when Ollama is offline)',
      '--only <surface>': 'Limit to one surface: ontology|links|vector|text',
      '--json': 'Output as JSON (default for piping)',
    },
    surfaces: {
      ontology: 'Concept definitions and related terms (instant, keyword)',
      'memory-text': 'Full-text keyword search over lessons and briefs',
      'memory-link': 'Code cross-references from memory-link index',
      vector: 'Semantic search via Ollama embeddings (requires running Ollama)',
    },
    examples: [
      'node scripts/harness/memory-search-all.mjs --query "approval workflow"',
      'node scripts/harness/memory-search-all.mjs --query "PDF" --no-vector --top 3',
      'npm run harness:memory:search -- --query "stage machine"',
    ],
  }, null, 2) + '\n');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) { showHelp(); return; }

  const query = flags.query;
  if (!query) {
    process.stderr.write('[memory-search-all] --query is required\n');
    process.exit(2);
  }

  const top = Number(flags.top) || 5;
  const noVector = Boolean(flags['no-vector']);
  const only = flags.only ? String(flags.only).toLowerCase() : null;

  const results = {};

  if (!only || only === 'ontology') {
    results.ontology = ontologySearch(query);
  }

  if (!only || only === 'text') {
    results.memoryText = memoryTextSearch(query, top);
  }

  if (!only || only === 'links') {
    results.memoryLinks = memoryLinkSearch(query, top);
  }

  if (!noVector && (!only || only === 'vector')) {
    const { results: vr, error } = vectorSearch(query, top);
    results.vector = vr;
    if (error) results.vectorError = error;
  }

  const totalCount = Object.values(results).reduce((sum, v) => sum + (Array.isArray(v) ? v.length : 0), 0);

  const output = {
    ok: true,
    query,
    totalResults: totalCount,
    surfaces: Object.keys(results).filter(k => !k.endsWith('Error')),
    results,
    ...(results.vectorError ? { vectorError: results.vectorError } : {}),
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');
}

main().catch(err => {
  process.stderr.write(`[memory-search-all] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
