#!/usr/bin/env node
// Removes orphan `const queryClient = useQueryClient();` declarations whose
// enclosing `export function` body no longer references `queryClient.`.
// Also strips the `useQueryClient` import if no remaining usages.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function processFile(file) {
  let src = readFileSync(file, 'utf8');
  const original = src;

  // Find each `export function ... {` and pair with closing brace.
  const out = [];
  let i = 0;
  while (i < src.length) {
    const idx = src.indexOf('export function', i);
    if (idx === -1) {
      out.push(src.slice(i));
      break;
    }
    out.push(src.slice(i, idx));

    // find opening brace of the function
    const braceOpen = src.indexOf('{', idx);
    if (braceOpen === -1) {
      out.push(src.slice(idx));
      break;
    }
    // walk braces respecting strings/comments lazily — good enough for hook files
    let depth = 1;
    let j = braceOpen + 1;
    while (j < src.length && depth > 0) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '/' && src[j + 1] === '/') {
        const nl = src.indexOf('\n', j);
        j = nl === -1 ? src.length : nl;
        continue;
      } else if (c === '/' && src[j + 1] === '*') {
        const end = src.indexOf('*/', j + 2);
        j = end === -1 ? src.length : end + 2;
        continue;
      } else if (c === "'" || c === '"' || c === '`') {
        const q = c;
        j++;
        while (j < src.length && src[j] !== q) {
          if (src[j] === '\\') j++;
          j++;
        }
      }
      j++;
    }
    const blockStart = idx;
    const blockEnd = j; // points just past closing brace
    let block = src.slice(blockStart, blockEnd);

    // Within this function block, decide whether queryClient is used outside its declaration.
    const declRe = /^\s*const\s+queryClient\s*=\s*useQueryClient\(\)\s*;\s*\n/m;
    const declMatch = block.match(declRe);
    if (declMatch) {
      // Check usages of `queryClient.` or `queryClient[` or `queryClient,` etc. excluding decl.
      const withoutDecl = block.replace(declRe, '');
      if (!/\bqueryClient\b/.test(withoutDecl)) {
        block = withoutDecl;
      }
    }

    out.push(block);
    i = blockEnd;
  }

  src = out.join('');

  // Strip `useQueryClient` from imports if no remaining usage.
  if (!/\buseQueryClient\s*\(/.test(src)) {
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*['"]@tanstack\/react-query['"]\s*;/g,
      (full, inside) => {
        const names = inside
          .split(',')
          .map(s => s.trim())
          .filter(s => s && s !== 'useQueryClient');
        if (names.length === 0) return '';
        return `import { ${names.join(', ')} } from '@tanstack/react-query';`;
      }
    );
  }

  if (src !== original) {
    writeFileSync(file, src, 'utf8');
    console.log(`updated ${file}`);
  }
}

function walk(p) {
  const st = statSync(p);
  if (st.isDirectory()) {
    for (const e of readdirSync(p)) walk(join(p, e));
  } else if (p.endsWith('.ts') && !p.includes('__tests__') && !p.includes('__mocks__')) {
    processFile(p);
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: strip-unused-queryclient.mjs <file|dir> ...');
  process.exit(1);
}
for (const a of args) walk(a);
