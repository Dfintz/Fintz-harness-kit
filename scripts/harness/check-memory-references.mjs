#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const memoryRoot = join(repoRoot, '.github', 'harness', 'memory');
const markdownLinkPattern = /!?(?:\[[^\]\r\n]{1,200}\])\(([^)\r\n]{1,1000})\)/g;
const externalUrlPattern = /^(?:https?:|mailto:|file:|vscode:)/i;

function workspacePath(filePath) {
  return relative(repoRoot, filePath).replaceAll('\\', '/');
}

function listMarkdownFiles() {
  const files = [];
  for (const entry of readdirSync(repoRoot, { withFileTypes: true })) {
    if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') {
      files.push(join(repoRoot, entry.name));
    }
  }

  function walk(directory) {
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = join(directory, entry.name);
      if (entry.isDirectory()) walk(filePath);
      else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') files.push(filePath);
    }
  }

  walk(memoryRoot);
  return files.sort((left, right) => left.localeCompare(right));
}

function resolveLocalTarget(sourcePath, rawTarget) {
  const target = rawTarget.trim().split('#')[0].split('?')[0];
  if (!target || target.startsWith('/')) return null;
  const decoded = decodeURIComponent(target);
  const resolved = decoded.startsWith('.github/') || decoded.startsWith('scripts/') || decoded.startsWith('docs/')
    ? resolve(repoRoot, decoded)
    : resolve(dirname(sourcePath), decoded);
  const relativeTarget = relative(repoRoot, resolved);
  if (relativeTarget.startsWith('..') || relativeTarget.includes(':')) return null;
  return resolved;
}

function checkReferences() {
  const errors = [];
  const external = [];
  const files = listMarkdownFiles();

  for (const sourcePath of files) {
    const content = readFileSync(sourcePath, 'utf8');
    let match = markdownLinkPattern.exec(content);
    while (match) {
      const rawTarget = match[1].trim();
      if (externalUrlPattern.test(rawTarget) || rawTarget.startsWith('.../')) {
        external.push({ source: workspacePath(sourcePath), target: rawTarget });
      } else {
        const resolvedTarget = resolveLocalTarget(sourcePath, rawTarget);
        if (resolvedTarget && !existsSync(resolvedTarget)) {
          errors.push({
            source: workspacePath(sourcePath),
            target: rawTarget,
            resolved: workspacePath(resolvedTarget),
          });
        }
      }
      match = markdownLinkPattern.exec(content);
    }
    markdownLinkPattern.lastIndex = 0;
  }

  return { filesScanned: files.length, errors, external };
}

function main() {
  const result = checkReferences();
  console.log(`[memory-references] scanned ${result.filesScanned} Markdown files`);
  console.log(`[memory-references] external URLs reported: ${result.external.length}`);
  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`[memory-references] missing local target: ${error.source} -> ${error.target} (${error.resolved})`);
    }
    process.exitCode = 1;
    return;
  }
  console.log('[memory-references] OK');
}

main();