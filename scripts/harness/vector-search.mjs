#!/usr/bin/env node
/**
 * Harness semantic retrieval CLI.
 *
 * Builds and queries an optional local vector index over:
 * - .github/harness/memory/lessons
 * - .github/harness/memory/briefs
 * - provider-selected graph snapshot nodes (understand-anything default, graphify optional)
 * - arbitrary filesystem paths via --root and --scope fs
 *
 * Usage:
 *   node scripts/harness/vector-search.mjs status
 *   node scripts/harness/vector-search.mjs index --scope all
 *   node scripts/harness/vector-search.mjs search --query "tenant isolation" --scope all --top 10
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { embedOne, normalizeHost as resolveProviderHost, resolveProvider } from './llm-provider.mjs';
import { loadGraphForQuery, resolveGraphProviderState } from './graph-provider.mjs';
import { collectNeighborhood, recoverNodeBoundary } from './graph.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const lessonsDir = join(repoRoot, '.github', 'harness', 'memory', 'lessons');
const briefsDir = join(repoRoot, '.github', 'harness', 'memory', 'briefs');
const configPath = join(repoRoot, 'harness.config.json');
const indexPath = join(
  repoRoot,
  '.understand-anything',
  'intermediate',
  'harness-vector-index.json'
);

const INDEX_VERSION = 1;
const DEFAULT_EMBED_MODEL = process.env.HARNESS_EMBED_MODEL || 'nomic-embed-text';
const DEFAULT_OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const DEFAULT_MAX_TEXT_CHARS = Number(process.env.HARNESS_EMBED_MAX_TEXT_CHARS || 4000);
const DEFAULT_TOP = 10;
const DEFAULT_SCOPE = 'memory';
const DEFAULT_TIMEOUT_MS = Number(process.env.HARNESS_EMBED_TIMEOUT_MS || 60000);

// Filesystem indexing defaults (used when --scope fs or --root is provided)
const DEFAULT_CHUNK_SIZE = Number(process.env.HARNESS_FS_CHUNK_SIZE || 2000);
const DEFAULT_CHUNK_OVERLAP = Number(process.env.HARNESS_FS_CHUNK_OVERLAP || 200);
const DEFAULT_MAX_FILE_BYTES = Number(process.env.HARNESS_FS_MAX_FILE_BYTES || 512 * 1024);
const DEFAULT_CONTEXTUAL_FS = /^(1|true|yes|on)$/i.test(
  String(process.env.HARNESS_FS_CONTEXTUAL_EMBEDDINGS || 'false')
);
const DEFAULT_FS_EXTENSIONS = (process.env.HARNESS_FS_EXTENSIONS ||
  '.md,.txt,.js,.mjs,.ts,.py,.sh,.yaml,.yml,.json,.toml,.ini,.cfg,.log,.csv,.xml,.html,.css,.rs,.go,.java,.rb,.php,.c,.cpp,.h'
).split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
const FS_SKIP_DIRS = new Set(['.git', 'node_modules', '.understand-anything', '.graphify', 'dist', 'build', 'coverage', '__pycache__', '.venv', 'venv']);

const ALLOWED_SCOPE_TOKENS = new Set(['all', 'memory', 'lessons', 'briefs', 'graph', 'fs', 'ontology']);
const DOC_SCOPE_ORDER = ['lessons', 'briefs', 'graph', 'fs', 'ontology'];
const RETRIEVAL_PRESETS = {
  'repair-localization': { scope: 'graph', top: 8, traversal: 'bfs', depth: 1 },
  'review-risk': { scope: 'graph', top: 12, traversal: 'bfs', depth: 1 },
  'architect-blast-radius': { scope: 'graph', top: 16, traversal: 'dfs', depth: 2 },
};

function resolveRetrievalPreset(value) {
  if (value === undefined || value === null || value === true) return null;
  const name = String(value);
  const preset = RETRIEVAL_PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown retrieval preset "${name}". Expected: ${Object.keys(RETRIEVAL_PRESETS).join(', ')}.`);
  }
  return { name, ...preset };
}

function resolveGraphPathFromProvider() {
  const state = resolveGraphProviderState({ repoRoot, configPath });
  const uaPath = state.providers['understand-anything'].graphPath;
  const graphifyPath = state.providers.graphify.graphPath;

  if (state.selectedProvider === 'understand-anything') return uaPath;
  if (state.selectedProvider === 'graphify') return graphifyPath;
  if (existsSync(uaPath)) return uaPath;
  return graphifyPath;
}

function parseArgs(argv) {
  const flags = { _: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      flags._.push(token);
      continue;
    }

    if (token === '--help' || token === '-h') {
      flags.help = true;
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    index += 1;
  }

  return flags;
}

function printJson(payload, exitCode = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(exitCode);
}

function toWorkspacePath(pathValue) {
  return relative(repoRoot, pathValue).replace(/\\/g, '/');
}

function requireString(flags, key, message) {
  const value = flags[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(message);
  }
  return value.trim();
}

function toPositiveInt(value, fallback, label) {
  if (value === undefined || value === null || value === true) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return Math.floor(number);
}

function toNumber(value, fallback, label) {
  if (value === undefined || value === null || value === true) return fallback;
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a number`);
  }
  return number;
}

function firstMeaningfulLine(content) {
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.replace(/^#+\s*/, '').trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return '(empty)';
}

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(
      file => file.endsWith('.md') && file !== '_template.md' && file.toLowerCase() !== 'readme.md'
    )
    .filter(file => statSync(join(dir, file)).isFile())
    .sort((left, right) => left.localeCompare(right));
}

function parseScopeSelection(scopeValue, defaultScope = DEFAULT_SCOPE, includeFs = false) {
  const raw = String(scopeValue || defaultScope)
    .split(',')
    .map(token => token.trim().toLowerCase())
    .filter(Boolean);

  if (raw.length === 0) {
    return includeFs ? ['lessons', 'briefs', 'fs'] : ['lessons', 'briefs'];
  }

  const expanded = new Set();
  for (const token of raw) {
    if (!ALLOWED_SCOPE_TOKENS.has(token)) {
      throw new Error(
        `Invalid scope token: ${token}. Expected one of all,memory,lessons,briefs,graph,fs,ontology.`
      );
    }

    if (token === 'all') {
      expanded.add('lessons');
      expanded.add('briefs');
      expanded.add('graph');
      expanded.add('ontology');
      if (includeFs) expanded.add('fs');
      continue;
    }

    if (token === 'memory') {
      expanded.add('lessons');
      expanded.add('briefs');
      continue;
    }

    expanded.add(token);
  }

  return DOC_SCOPE_ORDER.filter(scope => expanded.has(scope));
}

function truncateText(value, maxChars) {
  const text = String(value || '')
    .replace(/\r/g, '')
    .trim();
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n...[truncated]`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readMemoryDocuments() {
  const docs = [];
  const groups = [
    { scope: 'lessons', dir: lessonsDir, idPrefix: 'lesson' },
    { scope: 'briefs', dir: briefsDir, idPrefix: 'brief' },
  ];

  for (const group of groups) {
    const files = listMarkdownFiles(group.dir);
    for (const file of files) {
      const absolutePath = join(group.dir, file);
      const content = readFileSync(absolutePath, 'utf8');
      const summary = firstMeaningfulLine(content);
      const mtimeMs = statSync(absolutePath).mtimeMs;
      const workspacePath = toWorkspacePath(absolutePath);

      const text = [
        `${group.scope.slice(0, -1)} memory entry`,
        `name: ${file}`,
        `path: ${workspacePath}`,
        `summary: ${summary}`,
        'content:',
        content,
      ].join('\n');

      docs.push({
        id: `${group.idPrefix}:${file}`,
        scope: group.scope,
        kind: 'memory',
        name: file,
        title: summary,
        summary,
        path: workspacePath,
        sourceMtimeMs: mtimeMs,
        text,
      });
    }
  }

  return docs;
}

// Returns true when the buffer contains a null byte (reliable binary skip for UTF-8 content).
function looksLikeBinary(buffer) {
  const checkLen = Math.min(buffer.length, 8192);
  for (let i = 0; i < checkLen; i += 1) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

function chunkText(text, chunkSize, overlap) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
}

function buildContextualFsEmbeddingText({ relPath, chunkIndex, chunkTotal, chunkText }) {
  return [
    'Filesystem chunk embedding context',
    `path: ${relPath}`,
    `chunk: ${chunkIndex + 1}/${chunkTotal}`,
    '',
    'content:',
    chunkText,
  ].join('\n');
}

/**
 * Walk a directory tree and produce chunk documents for the vector index.
 * Skips binaries, oversized files, and common noise directories.
 * Symlinks are followed only when they resolve within root to prevent traversal escapes.
 */
function readFilesystemDocuments(fsRoot, options = {}) {
  const chunkSize = Number(options.chunkSize || DEFAULT_CHUNK_SIZE);
  const chunkOverlap = Number(options.chunkOverlap || DEFAULT_CHUNK_OVERLAP);
  const maxFileBytes = Number(options.maxFileBytes || DEFAULT_MAX_FILE_BYTES);
  const contextualFs =
    options.contextualFs === undefined
      ? DEFAULT_CONTEXTUAL_FS
      : !['0', 'false', 'no', 'off'].includes(String(options.contextualFs).toLowerCase());
  const allowedExtensions = Array.isArray(options.extensions) ? options.extensions : DEFAULT_FS_EXTENSIONS;
  const extSet = new Set(allowedExtensions.map(e => e.startsWith('.') ? e : `.${e}`));
  const resolvedRoot = resolve(fsRoot);

  const docs = [];
  const stack = [resolvedRoot];

  while (stack.length > 0) {
    const current = stack.pop();
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.') && !entry.isDirectory()) continue;

      const fullPath = join(current, entry.name);

      if (entry.isSymbolicLink()) {
        let resolved;
        try { resolved = realpathSync(fullPath); } catch { continue; }
        // Only follow symlinks that stay within the declared root
        if (!resolved.startsWith(resolvedRoot + sep) && resolved !== resolvedRoot) continue;
      }

      if (entry.isDirectory()) {
        if (FS_SKIP_DIRS.has(entry.name)) continue;
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile() && !entry.isSymbolicLink()) continue;

      const ext = fullPath.slice(fullPath.lastIndexOf('.')).toLowerCase();
      if (!extSet.has(ext)) continue;

      let stat;
      try { stat = statSync(fullPath); } catch { continue; }
      if (stat.size > maxFileBytes) {
        process.stderr.write(`[vector-fs] skipped (too large ${stat.size}B): ${fullPath}\n`);
        continue;
      }

      let buffer;
      try { buffer = readFileSync(fullPath); } catch { continue; }
      if (looksLikeBinary(buffer)) continue;

      const text = buffer.toString('utf8').replace(/\r/g, '');
      if (text.trim().length === 0) continue;

      const relPath = relative(resolvedRoot, fullPath).replace(/\\/g, '/');
      const pathHash = sha256(fullPath);
      const chunks = chunkText(text, chunkSize, chunkOverlap);

      for (let ci = 0; ci < chunks.length; ci += 1) {
        const chunk = chunks[ci];
        const id = `fs:${pathHash}:${ci}`;
        const titleLine = firstMeaningfulLine(chunk);
        docs.push({
          id,
          scope: 'fs',
          kind: 'filesystem-chunk',
          name: chunks.length > 1 ? `${relPath}:${ci}` : relPath,
          title: titleLine,
          summary: titleLine,
          path: fullPath,
          chunkIndex: ci,
          chunkTotal: chunks.length,
          sourceMtimeMs: stat.mtimeMs,
          text: chunk,
          embeddingText: contextualFs
            ? buildContextualFsEmbeddingText({
                relPath,
                chunkIndex: ci,
                chunkTotal: chunks.length,
                chunkText: chunk,
              })
            : chunk,
          contextualized: contextualFs,
        });
      }
    }
  }

  return docs;
}

function readGraphDocuments(graphLimit) {
  const graphPath = resolveGraphPathFromProvider();
  if (!existsSync(graphPath)) {
    const state = resolveGraphProviderState({ repoRoot, configPath });
    throw new Error(
      `Knowledge graph not found at ${toWorkspacePath(graphPath)} for provider ${state.selectedProvider}.`
    );
  }

  const graphText = readFileSync(graphPath, 'utf8');
  const graph = JSON.parse(graphText);
  const graphMtimeMs = statSync(graphPath).mtimeMs;

  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const limitedNodes =
    Number.isFinite(graphLimit) && graphLimit > 0 ? nodes.slice(0, graphLimit) : nodes;

  const docs = [];
  for (const node of limitedNodes) {
    if (!node || typeof node.id !== 'string') continue;

    const tags = Array.isArray(node.tags) ? node.tags.join(', ') : '';
    const lineRange = node.lineRange ? JSON.stringify(node.lineRange) : '';
    const filePath = typeof node.filePath === 'string' ? node.filePath : undefined;
    const summary = typeof node.summary === 'string' ? node.summary : '';

    const text = [
      `graph node (${node.type || 'unknown'})`,
      `id: ${node.id}`,
      `name: ${node.name || ''}`,
      `file: ${filePath || ''}`,
      `summary: ${summary}`,
      `tags: ${tags}`,
      `lineRange: ${lineRange}`,
    ]
      .filter(Boolean)
      .join('\n');

    docs.push({
      id: `graph:${node.id}`,
      scope: 'graph',
      kind: 'graph-node',
      name: node.id,
      title: node.name || node.id,
      summary,
      path: filePath,
      boundary: recoverNodeBoundary(node),
      sourceMtimeMs: graphMtimeMs,
      text,
    });
  }

  return {
    docs,
    meta: {
      graphNodeCount: nodes.length,
      graphDocumentCount: docs.length,
      graphCommitHash: graph.project?.gitCommitHash || null,
      graphGeneratedAt: graph.project?.generatedAt || null,
    },
  };
}

/** Convert ontology concepts into vector-indexable documents (scope=ontology). */
function readOntologyDocuments() {
  const ontologyPath = join(repoRoot, '.github', 'harness', 'memory', 'ontology', 'core.json');
  if (!existsSync(ontologyPath)) return [];
  try {
    const raw = JSON.parse(readFileSync(ontologyPath, 'utf8'));
    const concepts = Array.isArray(raw.concepts) ? raw.concepts : [];
    return concepts.map(c => {
      const text = [
        `concept: ${c.label}`,
        `id: ${c.id}`,
        `definition: ${c.definition}`,
        `aliases: ${(c.aliases || []).join(', ')}`,
        `related: ${(c.related || []).join(', ')}`,
        `hints: ${(c.memoryHints || []).join(', ')}`,
      ].join('\n');
      return {
        id: `ontology:${c.id}`,
        scope: 'ontology',
        kind: 'concept',
        name: c.id,
        title: c.label,
        summary: c.definition,
        path: ontologyPath,
        sourceMtimeMs: statSync(ontologyPath).mtimeMs,
        text,
      };
    });
  } catch { return []; }
}

function buildCorpus(scopes, options) {
  const selected = new Set(scopes);
  const corpus = [];
  let graphMeta = {
    graphNodeCount: 0,
    graphDocumentCount: 0,
    graphCommitHash: null,
    graphGeneratedAt: null,
  };

  if (selected.has('lessons') || selected.has('briefs')) {
    const memoryDocs = readMemoryDocuments().filter(doc => selected.has(doc.scope));
    corpus.push(...memoryDocs);
  }

  if (selected.has('graph')) {
    const graphResult = readGraphDocuments(options.graphLimit);
    corpus.push(...graphResult.docs);
    graphMeta = graphResult.meta;
  }

  if (selected.has('fs') && options.fsRoot) {
    const fsDocs = readFilesystemDocuments(options.fsRoot, {
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      maxFileBytes: options.maxFileBytes,
      extensions: options.extensions,
      contextualFs: options.contextualFs,
    });
    corpus.push(...fsDocs);
  }

  if (selected.has('ontology')) {
    const ontologyDocs = readOntologyDocuments();
    corpus.push(...ontologyDocs);
  }

  return { docs: corpus, graphMeta };
}

function loadExistingIndex() {
  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(indexPath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.documents)) parsed.documents = [];
    return parsed;
  } catch (error) {
    throw new Error(
      `Failed to parse existing vector index at ${toWorkspacePath(indexPath)}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function saveIndex(indexData) {
  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, `${JSON.stringify(indexData, null, 2)}\n`, 'utf8');
}

function isNumberArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every(item => Number.isFinite(item));
}

// Embedding is delegated to the shared provider adapter so the vector index can
// target Ollama or LM Studio identically. `provider` is resolved by the callers.
async function fetchEmbedding(provider, host, model, input, timeoutMs) {
  return embedOne({ provider, host, model, input, timeoutMs });
}

function cosineSimilarity(vectorA, vectorB) {
  if (!isNumberArray(vectorA) || !isNumberArray(vectorB)) return null;
  if (vectorA.length !== vectorB.length) return null;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < vectorA.length; index += 1) {
    dot += vectorA[index] * vectorB[index];
    normA += vectorA[index] * vectorA[index];
    normB += vectorB[index] * vectorB[index];
  }

  if (normA === 0 || normB === 0) return null;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function summarizeDocuments(documents) {
  const byScope = { lessons: 0, briefs: 0, graph: 0 };
  for (const document of documents) {
    if (Object.prototype.hasOwnProperty.call(byScope, document.scope)) {
      byScope[document.scope] += 1;
    }
  }

  const dimensions =
    documents.find(document => isNumberArray(document.embedding))?.embedding?.length || 0;

  return {
    total: documents.length,
    byScope,
    dimensions,
  };
}

async function buildOrUpdateIndex(options) {
  const startedAtMs = Date.now();
  const hasFs = options.fsRoot || (typeof options.scope === 'string' && options.scope.includes('fs'));
  const scopes = parseScopeSelection(options.scope, options.defaultScope || DEFAULT_SCOPE, Boolean(hasFs));
  const contextualFsEnabled =
    options.contextualFs === undefined
      ? DEFAULT_CONTEXTUAL_FS
      : !['0', 'false', 'no', 'off'].includes(String(options.contextualFs).toLowerCase());
  const selectedScopes = new Set(scopes);
  const provider = resolveProvider(options.provider);
  const host = resolveProviderHost(options.host, provider);
  const model = String(options.model || DEFAULT_EMBED_MODEL);
  const maxTextChars = toPositiveInt(options.maxTextChars, DEFAULT_MAX_TEXT_CHARS, 'maxTextChars');
  const timeoutMs = toPositiveInt(options.timeoutMs, DEFAULT_TIMEOUT_MS, 'timeoutMs');
  const force = options.force === true;

  const existing = loadExistingIndex();
  const existingDocuments = existing?.documents || [];
  const existingById = new Map(existingDocuments.map(document => [document.id, document]));

  const { docs: corpusDocs, graphMeta } = buildCorpus(scopes, {
    graphLimit: options.graphLimit,
    fsRoot: options.fsRoot,
    chunkSize: options.chunkSize,
    chunkOverlap: options.chunkOverlap,
    maxFileBytes: options.maxFileBytes,
    contextualFs: contextualFsEnabled,
    extensions: options.extensions,
  });

  const selectedResults = [];
  const docsToEmbed = [];
  let reusedCount = 0;
  let selectedEmbeddingChars = 0;
  const selectedEmbeddingCharsByScope = {};
  let selectedEmbeddingCharsRaw = 0;
  const selectedEmbeddingCharsRawByScope = {};
  let selectedContextualDocCount = 0;

  for (const doc of corpusDocs) {
    const contextualizedFsText =
      contextualFsEnabled && doc.scope === 'fs'
        ? buildContextualFsEmbeddingText({
            relPath: String(doc.name || doc.path || ''),
            chunkIndex: Number(doc.chunkIndex || 0),
            chunkTotal: Number(doc.chunkTotal || 1),
            chunkText: String(doc.text || ''),
          })
        : null;
    const rawEmbeddingInput = String(contextualizedFsText || doc.embeddingText || doc.text || '')
      .replaceAll('\r', '')
      .trim();
    if (contextualizedFsText) selectedContextualDocCount += 1;
    const embeddingInput = truncateText(rawEmbeddingInput, maxTextChars);
    selectedEmbeddingChars += embeddingInput.length;
    selectedEmbeddingCharsByScope[doc.scope] = (selectedEmbeddingCharsByScope[doc.scope] || 0) + embeddingInput.length;
    selectedEmbeddingCharsRaw += rawEmbeddingInput.length;
    selectedEmbeddingCharsRawByScope[doc.scope] = (selectedEmbeddingCharsRawByScope[doc.scope] || 0) + rawEmbeddingInput.length;
    const textHash = sha256(`${doc.id}\n${embeddingInput}`);
    const existingDoc = existingById.get(doc.id);
    const canReuse =
      !force &&
      existingDoc &&
      existingDoc.model === model &&
      existingDoc.textHash === textHash &&
      isNumberArray(existingDoc.embedding);

    if (canReuse) {
      selectedResults.push({
        ...existingDoc,
        title: doc.title,
        summary: doc.summary,
        path: doc.path,
        boundary: doc.boundary ?? null,
        sourceMtimeMs: doc.sourceMtimeMs,
        contextualized: Boolean(contextualizedFsText || doc.contextualized),
      });
      reusedCount += 1;
      continue;
    }

    docsToEmbed.push({ doc, embeddingInput, textHash });
  }

  for (let index = 0; index < docsToEmbed.length; index += 1) {
    const item = docsToEmbed[index];
    const embedding = await fetchEmbedding(provider, host, model, item.embeddingInput, timeoutMs);

    selectedResults.push({
      id: item.doc.id,
      scope: item.doc.scope,
      kind: item.doc.kind,
      name: item.doc.name,
      title: item.doc.title,
      summary: item.doc.summary,
      path: item.doc.path,
      boundary: item.doc.boundary ?? null,
      sourceMtimeMs: item.doc.sourceMtimeMs,
      contextualized: Boolean(
        contextualFsEnabled && item.doc.scope === 'fs' ? true : item.doc.contextualized
      ),
      textHash: item.textHash,
      model,
      embedding,
      preview: truncateText(item.embeddingInput, 280),
      indexedAt: new Date().toISOString(),
    });

    if (options.verbose) {
      process.stderr.write(`[vector-index] embedded ${index + 1}/${docsToEmbed.length}\n`);
    }
  }

  const carryForward = existingDocuments.filter(document => !selectedScopes.has(document.scope));
  const documents = [...carryForward, ...selectedResults].sort((left, right) =>
    String(left.id).localeCompare(String(right.id))
  );

  const saved = {
    version: INDEX_VERSION,
    provider: 'ollama',
    host,
    model,
    maxTextChars,
    updatedAt: new Date().toISOString(),
    source: {
      graphCommitHash: graphMeta.graphCommitHash,
      graphGeneratedAt: graphMeta.graphGeneratedAt,
      graphNodeCount: graphMeta.graphNodeCount,
      graphDocumentCount: graphMeta.graphDocumentCount,
      fsContextualEmbeddings: contextualFsEnabled,
    },
    documents,
    stats: summarizeDocuments(documents),
  };

  saveIndex(saved);

  return {
    ok: true,
    action: 'index',
    path: toWorkspacePath(indexPath),
    host,
    model,
    scopes,
    force,
    maxTextChars,
    stats: saved.stats,
    selectedCorpusCount: corpusDocs.length,
    selectedEmbeddingChars,
    selectedEmbeddingCharsByScope,
    selectedEmbeddingCharsRaw,
    selectedEmbeddingCharsRawByScope,
    selectedContextualDocCount,
    reusedCount,
    embeddedCount: docsToEmbed.length,
    carryForwardCount: carryForward.length,
    removedFromSelectedScope: Math.max(
      0,
      existingDocuments.filter(document => selectedScopes.has(document.scope)).length -
        selectedResults.length
    ),
    indexingDurationMs: Date.now() - startedAtMs,
    graph: graphMeta,
    updatedAt: saved.updatedAt,
  };
}

function readCurrentGraphCommit() {
  const graphPath = resolveGraphPathFromProvider();
  if (!existsSync(graphPath)) return null;
  try {
    const parsed = JSON.parse(readFileSync(graphPath, 'utf8'));
    return parsed.project?.gitCommitHash || null;
  } catch {
    return null;
  }
}

function buildStatusPayload() {
  const providerState = resolveGraphProviderState({ repoRoot, configPath });
  const queryGraphPath = resolveGraphPathFromProvider();
  const exists = existsSync(indexPath);
  if (!exists) {
    return {
      ok: true,
      exists: false,
      path: toWorkspacePath(indexPath),
      message: 'No vector index exists yet. Run `npm run harness:vector -- index --scope all`.',
      graphProvider: providerState.selectedProvider,
      queryGraphPath: toWorkspacePath(queryGraphPath),
    };
  }

  const index = loadExistingIndex();
  if (!index) {
    return {
      ok: false,
      exists: true,
      path: toWorkspacePath(indexPath),
      message: 'Index file exists but could not be loaded.',
      graphProvider: providerState.selectedProvider,
      queryGraphPath: toWorkspacePath(queryGraphPath),
    };
  }

  const docs = Array.isArray(index.documents) ? index.documents : [];
  const stats = summarizeDocuments(docs);
  const currentGraphCommit = readCurrentGraphCommit();
  const graphCommitInIndex = index.source?.graphCommitHash || null;
  const graphCommitMatches =
    !currentGraphCommit || !graphCommitInIndex ? null : currentGraphCommit === graphCommitInIndex;

  return {
    ok: true,
    exists: true,
    path: toWorkspacePath(indexPath),
    version: index.version,
    host: index.host,
    model: index.model,
    maxTextChars: index.maxTextChars,
    updatedAt: index.updatedAt,
    stats,
    source: index.source || {},
    graphFreshAgainstIndex: graphCommitMatches,
    currentGraphCommit,
    graphProvider: providerState.selectedProvider,
    queryGraphPath: toWorkspacePath(queryGraphPath),
  };
}

async function runSemanticSearch(options) {
  const startedAtMs = Date.now();
  const query = String(options.query || '').trim();
  if (!query) {
    throw new Error('search requires --query');
  }

  const preset = resolveRetrievalPreset(options.preset);
  const scopes = parseScopeSelection(options.scope || preset?.scope, 'all');
  const scopeSet = new Set(scopes);
  const top = toPositiveInt(options.top, preset?.top ?? DEFAULT_TOP, 'top');
  const minScore = toNumber(options.minScore, -1, 'minScore');
  const timeoutMs = toPositiveInt(options.timeoutMs, DEFAULT_TIMEOUT_MS, 'timeoutMs');
  const provider = resolveProvider(options.provider);
  const host = resolveProviderHost(options.host, provider);
  const autoIndex = options.noAutoIndex ? false : true;

  let index = loadExistingIndex();
  const requestedModel = options.model ? String(options.model) : null;
  const targetModel = requestedModel || index?.model || DEFAULT_EMBED_MODEL;

  const hasCoverage = currentIndex => {
    if (!currentIndex || !Array.isArray(currentIndex.documents)) return false;
    return scopes.every(scope => currentIndex.documents.some(document => document.scope === scope));
  };

  const modelMatches = currentIndex =>
    !currentIndex || !currentIndex.model || currentIndex.model === targetModel;

  const shouldReindex =
    options.force ||
    !index ||
    !hasCoverage(index) ||
    !modelMatches(index) ||
    !Array.isArray(index.documents);

  if (shouldReindex) {
    if (!autoIndex) {
      throw new Error(
        'Index is missing coverage for requested scope/model. Run `npm run harness:vector -- index --scope all` or re-run with auto-index enabled.'
      );
    }

    await buildOrUpdateIndex({
      scope: options.scope || preset?.scope || 'all',
      provider,
      host,
      model: targetModel,
      force: Boolean(options.force),
      maxTextChars: options.maxTextChars,
      graphLimit: options.graphLimit,
      fsRoot: options.fsRoot,
      chunkSize: options.chunkSize,
      chunkOverlap: options.chunkOverlap,
      maxFileBytes: options.maxFileBytes,
      contextualFs: options.contextualFs,
      extensions: options.extensions,
      timeoutMs,
      verbose: options.verbose,
    });

    index = loadExistingIndex();
  }

  if (!index || !Array.isArray(index.documents) || index.documents.length === 0) {
    throw new Error('Vector index is empty. Run `npm run harness:vector -- index --scope all`.');
  }

  const queryEmbedding = await fetchEmbedding(
    provider,
    host,
    targetModel,
    truncateText(query, DEFAULT_MAX_TEXT_CHARS),
    timeoutMs
  );

  const candidates = index.documents.filter(document => scopeSet.has(document.scope));

  let skippedDimensionMismatch = 0;
  let skippedModelMismatch = 0;

  const scored = [];
  for (const candidate of candidates) {
    if (candidate.model && candidate.model !== targetModel) {
      skippedModelMismatch += 1;
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, candidate.embedding);
    if (score === null) {
      skippedDimensionMismatch += 1;
      continue;
    }

    if (score < minScore) continue;

    scored.push({
      ...candidate,
      score,
    });
  }

  scored.sort((left, right) => right.score - left.score);

  let graphForPreset = null;
  if (preset && scopeSet.has('graph')) {
    try {
      graphForPreset = loadGraphForQuery({ repoRoot, configPath }).graph;
    } catch {
      graphForPreset = null;
    }
  }

  const results = scored.slice(0, top).map((candidate, indexValue) => ({
    rank: indexValue + 1,
    score: Number(candidate.score.toFixed(6)),
    id: candidate.id,
    scope: candidate.scope,
    kind: candidate.kind,
    name: candidate.name,
    title: candidate.title,
    summary: candidate.summary,
    path: candidate.path,
    preview: candidate.preview,
    boundary: candidate.boundary ?? null,
    graphNeighborhood:
      graphForPreset && candidate.id.startsWith('graph:')
        ? collectNeighborhood(
            graphForPreset,
            candidate.id.slice('graph:'.length),
            preset.depth,
            preset.top,
            preset.traversal,
          )
        : [],
    model: candidate.model,
  }));

  return {
    ok: true,
    action: 'search',
    query,
    preset: preset?.name ?? null,
    traversal: preset?.traversal ?? null,
    depth: preset?.depth ?? null,
    scopes,
    top,
    minScore,
    host,
    model: targetModel,
    path: toWorkspacePath(indexPath),
    candidateCount: candidates.length,
    matchedCount: scored.length,
    returnedCount: results.length,
    skippedDimensionMismatch,
    skippedModelMismatch,
    searchDurationMs: Date.now() - startedAtMs,
    results,
  };
}

function showHelp() {
  printJson({
    usage: {
      command: 'node scripts/harness/vector-search.mjs <status|index|search> [--flags]',
      defaults: {
        host: DEFAULT_OLLAMA_HOST,
        model: DEFAULT_EMBED_MODEL,
        indexPath: toWorkspacePath(indexPath),
      },
    },
    commands: {
      status: 'Show whether the local vector index exists and its coverage.',
      index: 'Build or refresh embeddings for selected scopes.',
      search: 'Run semantic retrieval against indexed scopes.',
    },
    commonFlags: {
      '--scope': 'all|memory|lessons|briefs|graph|fs|ontology (comma-separated accepted). Use fs to index arbitrary filesystem paths. Use ontology to search concept definitions.',
      '--preset': 'repair-localization|review-risk|architect-blast-radius; applies deterministic graph retrieval defaults.',
      '--root': `Root directory to walk when scope includes fs (default: repo root). Env: HARNESS_FS_ROOT.`,
      '--chunk-size': `Characters per filesystem chunk (default ${DEFAULT_CHUNK_SIZE}). Env: HARNESS_FS_CHUNK_SIZE.`,
      '--chunk-overlap': `Overlap between consecutive chunks (default ${DEFAULT_CHUNK_OVERLAP}). Env: HARNESS_FS_CHUNK_OVERLAP.`,
      '--max-file-bytes': `Max file size to index, bytes (default ${DEFAULT_MAX_FILE_BYTES}). Env: HARNESS_FS_MAX_FILE_BYTES.`,
      '--contextual-fs': `Contextualize filesystem chunk embedding input (default ${DEFAULT_CONTEXTUAL_FS}). Env: HARNESS_FS_CONTEXTUAL_EMBEDDINGS.`,
      '--no-contextual-fs': 'Disable filesystem contextual embedding input for this run.',
      '--ext': 'Comma-separated extensions for fs scope (e.g. .md,.py,.js).',
      '--model': 'Embedding model name (default nomic-embed-text)',
      '--host': 'Ollama host URL (default http://localhost:11434)',
      '--max-text-chars': `Max characters per embedded document (default ${DEFAULT_MAX_TEXT_CHARS})`,
      '--timeout-ms': `Embedding request timeout in ms (default ${DEFAULT_TIMEOUT_MS})`,
      '--force': 'Force re-embedding even if cached hashes match',
      '--verbose': 'Emit embedding progress to stderr',
    },
    searchFlags: {
      '--query': 'Required query text',
      '--top': `Maximum results to return (default ${DEFAULT_TOP})`,
      '--min-score': 'Optional minimum cosine similarity threshold (default -1)',
      '--no-auto-index': 'Do not build missing index coverage automatically',
    },
    examples: [
      'npm run harness:vector -- status',
      'npm run harness:vector -- index --scope memory',
      'npm run harness:vector -- index --scope all --model nomic-embed-text',
      'npm run harness:vector -- index --scope fs --root /path/to/docs',
      'npm run harness:vector -- index --scope fs --root . --chunk-size 1500 --chunk-overlap 150',
      'npm run harness:vector -- search --query "tenant isolation middleware" --scope all --top 8',
      'npm run harness:search -- --query "error handling" --root /var/log',
    ],
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const command = flags._[0];

  if (flags.help || !command) {
    showHelp();
    return;
  }

  if (command === 'status') {
    printJson(buildStatusPayload());
    return;
  }

  if (command === 'index') {
    let contextualFs;
    if (flags['no-contextual-fs']) contextualFs = false;
    else if (flags['contextual-fs']) contextualFs = true;
    const payload = await buildOrUpdateIndex({
      scope: flags.scope,
      provider: flags.provider,
      host: flags.host,
      model: flags.model,
      force: Boolean(flags.force),
      maxTextChars: flags['max-text-chars'],
      graphLimit: toPositiveInt(flags['graph-limit'], undefined, 'graph-limit'),
      fsRoot: flags.root || (flags.scope && String(flags.scope).includes('fs') ? repoRoot : undefined),
      chunkSize: flags['chunk-size'] ? Number(flags['chunk-size']) : undefined,
      chunkOverlap: flags['chunk-overlap'] ? Number(flags['chunk-overlap']) : undefined,
      maxFileBytes: flags['max-file-bytes'] ? Number(flags['max-file-bytes']) : undefined,
      contextualFs,
      extensions: flags.ext ? String(flags.ext).split(',').map(e => e.trim()) : undefined,
      timeoutMs: flags['timeout-ms'],
      verbose: Boolean(flags.verbose),
      defaultScope: DEFAULT_SCOPE,
    });
    printJson(payload);
    return;
  }

  if (command === 'search') {
    let contextualFs;
    if (flags['no-contextual-fs']) contextualFs = false;
    else if (flags['contextual-fs']) contextualFs = true;
    const payload = await runSemanticSearch({
      query: flags.query,
      preset: flags.preset,
      scope: flags.scope,
      provider: flags.provider,
      host: flags.host,
      model: flags.model,
      top: flags.top,
      minScore: flags['min-score'],
      force: Boolean(flags.force),
      maxTextChars: flags['max-text-chars'],
      graphLimit: toPositiveInt(flags['graph-limit'], undefined, 'graph-limit'),
      fsRoot: flags.root || (flags.scope && String(flags.scope).includes('fs') ? repoRoot : undefined),
      chunkSize: flags['chunk-size'] ? Number(flags['chunk-size']) : undefined,
      chunkOverlap: flags['chunk-overlap'] ? Number(flags['chunk-overlap']) : undefined,
      maxFileBytes: flags['max-file-bytes'] ? Number(flags['max-file-bytes']) : undefined,
      contextualFs,
      extensions: flags.ext ? String(flags.ext).split(',').map(e => e.trim()) : undefined,
      timeoutMs: flags['timeout-ms'],
      noAutoIndex: Boolean(flags['no-auto-index']),
      verbose: Boolean(flags.verbose),
    });
    printJson(payload);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  await main();
} catch (error) {
  printJson(
    {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    },
    2
  );
}
