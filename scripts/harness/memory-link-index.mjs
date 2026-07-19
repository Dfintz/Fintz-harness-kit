#!/usr/bin/env node
/**
 * Builds and queries a lightweight memory-link index that connects harness memory entries
 * to graph-backed workspace files using path mentions found in memory markdown.
 *
 * Usage:
 *   node scripts/harness/memory-link-index.mjs status
 *   node scripts/harness/memory-link-index.mjs build
 *   node scripts/harness/memory-link-index.mjs search --query "fleet" --top 10
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const graphPath = join(repoRoot, '.understand-anything', 'knowledge-graph.json');
const indexPath = join(
  repoRoot,
  '.understand-anything',
  'intermediate',
  'harness-memory-links.json'
);

const memoryDirs = [
  join(repoRoot, '.github', 'harness', 'memory', 'lessons'),
  join(repoRoot, '.github', 'harness', 'memory', 'briefs'),
  join(repoRoot, '.github', 'harness', 'memory', 'understanding'),
  join(repoRoot, '.github', 'harness', 'memory', 'reviews'),
  join(repoRoot, '.github', 'harness', 'memory', 'radar'),
  join(repoRoot, '.github', 'harness', 'memory', 'spotcheck'),
];

const FILE_PATH_REGEX =
  /\b(?:backend|frontend|scripts|packages|docs|azure|tests|apps)\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+\b/g;

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

function toWorkspacePath(pathValue) {
  return relative(repoRoot, pathValue).replaceAll('\\', '/');
}

function listMemoryFiles() {
  const files = [];
  for (const dir of memoryDirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md') || name === 'README.md' || name === '_template.md') continue;
      const abs = join(dir, name);
      if (!statSync(abs).isFile()) continue;
      files.push(abs);
    }
  }
  return files;
}

function getGraphFilePathSet() {
  if (!existsSync(graphPath)) {
    throw new Error('Knowledge graph not found. Run harness:graph:refresh first.');
  }

  const parsed = JSON.parse(readFileSync(graphPath, 'utf8'));
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];
  const files = new Set();
  for (const node of nodes) {
    if (typeof node?.filePath === 'string' && node.filePath.length > 0) {
      files.add(node.filePath.replaceAll('\\', '/'));
    }
  }

  return {
    fileSet: files,
    graphCommitHash: parsed?.project?.gitCommitHash || null,
    graphGeneratedAt: parsed?.project?.generatedAt || null,
  };
}

function extractMentionedPaths(markdown) {
  const content = String(markdown || '');
  const results = new Set();

  const direct = content.match(FILE_PATH_REGEX) || [];
  for (const pathValue of direct) {
    results.add(pathValue.replaceAll('\\', '/'));
  }

  const linkRegex = /\[[^\]\r\n]{1,200}\]\(([^)\r\n]{1,500})\)/g;
  const filePathNoGlobal =
    /^(?:backend|frontend|scripts|packages|docs|azure|tests|apps)\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]+$/;
  let match = linkRegex.exec(content);
  while (match) {
    const raw = String(match[1] || '').trim();
    if (/^(?:https?:|file:|vscode:)/i.test(raw)) {
      match = linkRegex.exec(content);
      continue;
    }
    const normalized = raw.split('#')[0].replace(/^\.\//, '').replaceAll('\\', '/');
    if (filePathNoGlobal.test(normalized)) {
      results.add(normalized);
    }
    match = linkRegex.exec(content);
  }

  return [...results];
}

function buildIndex() {
  const { fileSet, graphCommitHash, graphGeneratedAt } = getGraphFilePathSet();
  const memoryFiles = listMemoryFiles();
  const links = [];

  for (const absPath of memoryFiles) {
    const content = readFileSync(absPath, 'utf8');
    const memoryPath = toWorkspacePath(absPath);
    const mentions = extractMentionedPaths(content);

    for (const targetPath of mentions) {
      if (!fileSet.has(targetPath)) continue;
      links.push({
        memoryPath,
        targetPath,
      });
    }
  }

  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    graphCommitHash,
    graphGeneratedAt,
    memoryFileCount: memoryFiles.length,
    linkCount: links.length,
    links,
  };

  mkdirSync(dirname(indexPath), { recursive: true });
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  return index;
}

function loadIndex() {
  if (!existsSync(indexPath)) {
    return null;
  }

  const parsed = JSON.parse(readFileSync(indexPath, 'utf8'));
  if (!Array.isArray(parsed?.links)) {
    throw new TypeError('Invalid memory-link index shape. Rebuild the index.');
  }
  return parsed;
}

function runStatus() {
  const index = loadIndex();
  if (!index) {
    return {
      ok: false,
      exists: false,
      error: 'memory-link index not found. Run build first.',
      indexPath: toWorkspacePath(indexPath),
    };
  }

  return {
    ok: true,
    exists: true,
    indexPath: toWorkspacePath(indexPath),
    generatedAt: index.generatedAt,
    graphCommitHash: index.graphCommitHash,
    graphGeneratedAt: index.graphGeneratedAt,
    memoryFileCount: index.memoryFileCount,
    linkCount: index.linkCount,
  };
}

function runSearch(query, top) {
  const index = loadIndex();
  if (!index) {
    return {
      ok: false,
      error: 'memory-link index not found. Run build first.',
      indexPath: toWorkspacePath(indexPath),
    };
  }

  const needle = String(query || '').toLowerCase();
  const items = index.links
    .map(link => {
      const haystack = `${link.memoryPath}\n${link.targetPath}`.toLowerCase();
      return {
        ...link,
        rank: haystack.indexOf(needle),
      };
    })
    .filter(item => item.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, top)
    .map(item => ({
      memoryPath: item.memoryPath,
      targetPath: item.targetPath,
    }));

  return {
    ok: true,
    query,
    top,
    count: items.length,
    results: items,
  };
}

function print(payload, code = 0) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(code);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const command = flags._[0] || 'status';

  if (command === 'build') {
    const index = buildIndex();
    print({
      ok: true,
      action: 'build',
      indexPath: toWorkspacePath(indexPath),
      generatedAt: index.generatedAt,
      memoryFileCount: index.memoryFileCount,
      linkCount: index.linkCount,
      graphCommitHash: index.graphCommitHash,
    });
    return;
  }

  if (command === 'status') {
    const payload = runStatus();
    print(payload, payload.ok ? 0 : 1);
    return;
  }

  if (command === 'search') {
    const query = String(flags.query || '').trim();
    if (!query) {
      throw new Error('search requires --query');
    }
    const top = Math.max(1, Number.parseInt(String(flags.top || '10'), 10) || 10);
    const payload = runSearch(query, top);
    print(payload, payload.ok ? 0 : 1);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  print(
    {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    },
    2
  );
}
