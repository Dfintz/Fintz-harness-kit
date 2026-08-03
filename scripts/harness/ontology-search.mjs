#!/usr/bin/env node
/**
 * ontology-search — concept lookup and cross-reference against harness ontology and memory.
 *
 * The ontology (core.json) is a lightweight concept taxonomy: not RDF/OWL, just structured JSON.
 * Each concept has related concepts, aliases, and memoryHints for cross-referencing to lessons/briefs.
 *
 * Usage:
 *   node scripts/harness/ontology-search.mjs search --query "approval"
 *   node scripts/harness/ontology-search.mjs concept --id stage-machine
 *   node scripts/harness/ontology-search.mjs related --id memory-system
 *   node scripts/harness/ontology-search.mjs list
 *   npm run harness:ontology -- search --query "document"
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const ontologyPath = join(repoRoot, '.github', 'harness', 'memory', 'ontology', 'core.json');
const memorySearchPath = join(harnessDir, 'mcp-tools.mjs');

// ---------------------------------------------------------------------------
// Ontology loader
// ---------------------------------------------------------------------------

function loadOntology() {
  if (!existsSync(ontologyPath)) {
    throw new Error(`Ontology not found at ${ontologyPath}. Run: node scripts/harness/ontology-search.mjs list`);
  }
  return JSON.parse(readFileSync(ontologyPath, 'utf8'));
}

function buildIndex(ontology) {
  const byId = new Map();
  const byAlias = new Map();

  for (const concept of ontology.concepts || []) {
    byId.set(concept.id, concept);
    for (const alias of concept.aliases || []) {
      byAlias.set(alias.toLowerCase(), concept);
    }
    byAlias.set(concept.label.toLowerCase(), concept);
    byAlias.set(concept.id.toLowerCase(), concept);
  }

  return { byId, byAlias };
}

function scoreMatch(concept, query) {
  const q = query.toLowerCase();
  let score = 0;
  if (concept.id.toLowerCase().includes(q)) score += 10;
  if (concept.label.toLowerCase().includes(q)) score += 8;
  if (concept.definition.toLowerCase().includes(q)) score += 4;
  for (const alias of concept.aliases || []) {
    if (alias.toLowerCase().includes(q)) score += 6;
  }
  for (const hint of concept.memoryHints || []) {
    if (hint.toLowerCase().includes(q)) score += 3;
  }
  return score;
}

function searchConcepts(concepts, query) {
  return concepts
    .map(c => ({ concept: c, score: scoreMatch(c, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ concept }) => concept);
}

// ---------------------------------------------------------------------------
// Memory cross-reference
// ---------------------------------------------------------------------------

function findMemoryMatches(memoryHints) {
  if (!memoryHints || memoryHints.length === 0) return [];

  const results = [];
  for (const hint of memoryHints.slice(0, 3)) {
    const r = spawnSync(process.execPath, [memorySearchPath, 'memory-search', '--query', hint, '--limit', '3'], {
      cwd: repoRoot, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    });
    if (r.status !== 0 || !r.stdout) continue;
    try {
      const payload = JSON.parse(r.stdout);
      const entries = payload.entries || payload.result?.entries || [];
      for (const entry of entries.slice(0, 2)) {
        if (!results.find(x => x.name === entry.name)) results.push(entry);
      }
    } catch { /* skip */ }
  }
  return results;
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

function printJson(payload) {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
}

function showHelp() {
  printJson({
    usage: 'node scripts/harness/ontology-search.mjs <command> [options]',
    commands: {
      'search --query <text>': 'Find concepts matching a query string',
      'concept --id <id>': 'Show a specific concept with related concept details',
      'related --id <id>': 'Show all related concepts for a concept',
      'list': 'List all concepts with IDs and labels',
      'memory --id <id>': 'Find memory items (lessons/briefs) related to a concept',
    },
    flags: { '--cross-ref': 'Include memory cross-references in search results (slower)' },
    ontologyPath: ontologyPath.replace(repoRoot, '.'),
    examples: [
      'node scripts/harness/ontology-search.mjs search --query "approval"',
      'node scripts/harness/ontology-search.mjs concept --id stage-machine',
      'node scripts/harness/ontology-search.mjs related --id memory-system',
      'node scripts/harness/ontology-search.mjs search --query "document" --cross-ref',
      'npm run harness:ontology -- search --query "SSE"',
    ],
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const command = flags._[0];

  if (flags.help || !command) { showHelp(); return; }

  const ontology = loadOntology();
  const { byId } = buildIndex(ontology);
  const concepts = ontology.concepts || [];

  if (command === 'list') {
    printJson({
      ok: true,
      count: concepts.length,
      concepts: concepts.map(c => ({ id: c.id, label: c.label, related: c.related })),
    });
    return;
  }

  if (command === 'search') {
    const query = flags.query;
    if (!query) { process.stderr.write('[ontology-search] --query required\n'); process.exit(2); }
    const matches = searchConcepts(concepts, query);
    const result = matches.slice(0, 10).map(c => ({
      id: c.id,
      label: c.label,
      definition: c.definition,
      aliases: c.aliases,
      related: c.related,
      ...(flags['cross-ref'] ? { memoryMatches: findMemoryMatches(c.memoryHints) } : {}),
    }));
    printJson({ ok: true, query, count: result.length, concepts: result });
    return;
  }

  if (command === 'concept') {
    const id = flags.id;
    if (!id) { process.stderr.write('[ontology-search] --id required\n'); process.exit(2); }
    const concept = byId.get(id);
    if (!concept) { printJson({ ok: false, error: `Concept "${id}" not found`, available: [...byId.keys()] }); process.exit(1); }
    const relatedDetails = (concept.related || []).map(rid => {
      const r = byId.get(rid);
      return r ? { id: r.id, label: r.label, definition: r.definition } : { id: rid, label: rid };
    });
    printJson({ ok: true, concept, relatedDetails });
    return;
  }

  if (command === 'related') {
    const id = flags.id;
    if (!id) { process.stderr.write('[ontology-search] --id required\n'); process.exit(2); }
    const concept = byId.get(id);
    if (!concept) { printJson({ ok: false, error: `Concept "${id}" not found` }); process.exit(1); }
    const related = (concept.related || []).map(rid => byId.get(rid)).filter(Boolean);
    printJson({ ok: true, id, label: concept.label, relatedCount: related.length, related });
    return;
  }

  if (command === 'memory') {
    const id = flags.id;
    if (!id) { process.stderr.write('[ontology-search] --id required\n'); process.exit(2); }
    const concept = byId.get(id);
    if (!concept) { printJson({ ok: false, error: `Concept "${id}" not found` }); process.exit(1); }
    const memoryMatches = findMemoryMatches(concept.memoryHints);
    printJson({ ok: true, concept: { id, label: concept.label }, memoryMatchCount: memoryMatches.length, memoryMatches });
    return;
  }

  process.stderr.write(`[ontology-search] Unknown command: ${command}\n`);
  showHelp();
  process.exit(2);
}

main().catch(err => {
  process.stderr.write(`[ontology-search] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
