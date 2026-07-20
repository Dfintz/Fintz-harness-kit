#!/usr/bin/env node
/**
 * Codemod: migrate `onSuccess: () => queryClient.invalidateQueries(...)` to
 * declarative `meta: { invalidates: [...] }`.
 *
 * Safety rules:
 *   - Only transforms a useMutation block when EVERY statement inside its
 *     onSuccess handler is a `queryClient.invalidateQueries({ queryKey: ... })`
 *     call. Anything else (toast, router push, setQueryData, conditional, etc.)
 *     is left untouched.
 *   - Never touches blocks that contain onMutate / onError / onSettled.
 *   - After all mutations in a file are converted, removes the now-unused
 *     `const queryClient = useQueryClient();` declarations and the
 *     `useQueryClient` import (only if there are no remaining usages).
 *
 * Dry-run: pass --dry-run to print modified files without writing.
 *
 * Usage:
 *   node scripts/codemod-meta-invalidates.mjs --dry-run src/hooks/queries/useAllianceQueries.ts
 *   node scripts/codemod-meta-invalidates.mjs src/hooks/queries
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const targets = process.argv.slice(2).filter(a => !a.startsWith('--'));

if (targets.length === 0) {
  console.error('usage: codemod-meta-invalidates.mjs [--dry-run] <file|dir> ...');
  process.exit(1);
}

async function collect(target) {
  const stat = await fs.stat(target);
  if (stat.isFile()) return [target];
  const out = [];
  for (const entry of await fs.readdir(target, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      out.push(...(await collect(path.join(target, entry.name))));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      out.push(path.join(target, entry.name));
    }
  }
  return out;
}

/**
 * Find the matching closing brace for an opening brace.
 * @param {string} src
 * @param {number} openIdx index of the opening '{'
 * @returns {number} index of the matching '}' or -1
 */
function findMatching(src, openIdx, open = '{', close = '}') {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Parse a single onSuccess body into { argsList, invalidateExprs } or null
 * if the body contains anything other than queryClient.invalidateQueries calls.
 */
function parseOnSuccess(src, headerStart, bodyStart, bodyEnd) {
  const header = src.slice(headerStart, bodyStart).trim();
  // header looks like: onSuccess: (a, b) => OR onSuccess: () => OR onSuccess(arg, arg2) {
  const arrowMatch = header.match(/^onSuccess\s*:\s*(?:async\s*)?(\(([^)]*)\))?\s*=>\s*$/);
  const methodMatch = header.match(/^onSuccess\s*\(([^)]*)\)\s*$/);
  let args;
  if (arrowMatch) args = (arrowMatch[2] ?? '').trim();
  else if (methodMatch) args = methodMatch[1].trim();
  else return null;

  const body = src.slice(bodyStart + 1, bodyEnd).trim();
  if (!body) return { args, invalidateExprs: [] };

  // Split by ';' at depth 0.
  const stmts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i++;
      while (i < body.length && body[i] !== q) {
        if (body[i] === '\\') i++;
        i++;
      }
      continue;
    }
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ';' && depth === 0) {
      const s = body.slice(start, i).trim();
      if (s) stmts.push(s);
      start = i + 1;
    }
  }
  const tail = body.slice(start).trim();
  if (tail) stmts.push(tail);

  const exprs = [];
  for (const s of stmts) {
    // accept: queryClient.invalidateQueries({ queryKey: X })
    const m = s.match(
      /^queryClient\s*\.\s*invalidateQueries\s*\(\s*\{\s*queryKey\s*:\s*([\s\S]+?)\s*\}\s*\)$/
    );
    if (!m) return null; // unsupported statement
    exprs.push(m[1].trim());
  }
  return { args, invalidateExprs: exprs };
}

/**
 * Process a single useMutation({ ... }) block. Returns the new block text or
 * null if no change was made.
 */
function processMutationBlock(blockSrc) {
  // Bail if onMutate/onError/onSettled present — these need human review.
  if (/\bon(Mutate|Error|Settled)\s*[:(]/.test(blockSrc)) return null;
  // Bail if setQueryData present.
  if (/setQueryData\s*\(/.test(blockSrc)) return null;

  const onSuccessRe = /\bonSuccess\s*[:(]/g;
  let match;
  let result = blockSrc;
  let changed = false;
  // Use index tracking instead of regex iteration to handle replacements.
  let idx = 0;
  while ((match = onSuccessRe.exec(result)) !== null) {
    const headerStart = match.index;
    // find the '{' of the body
    const arrowIdx = result.indexOf('=>', headerStart);
    const parenIdx = result.indexOf('(', headerStart);
    let bodyStart;
    if (arrowIdx !== -1 && (parenIdx === -1 || arrowIdx < result.indexOf('{', parenIdx))) {
      // arrow form: onSuccess: (...) => { body }
      bodyStart = result.indexOf('{', arrowIdx);
    } else {
      // method form: onSuccess(...) { body }
      bodyStart = result.indexOf('{', parenIdx);
    }
    if (bodyStart === -1) return null;
    const bodyEnd = findMatching(result, bodyStart);
    if (bodyEnd === -1) return null;

    const parsed = parseOnSuccess(result, headerStart, bodyStart, bodyEnd);
    if (!parsed) return null; // unsupported

    let replacement;
    const argsTrimmed = parsed.args.replace(/\s+/g, ' ').trim();
    const isVariadic = argsTrimmed && argsTrimmed !== '' && !/^_+$/.test(argsTrimmed);
    if (parsed.invalidateExprs.length === 0) return null; // empty handler — let human handle

    if (!argsTrimmed || /^_+$/.test(argsTrimmed)) {
      // static array
      replacement = `meta: { invalidates: [${parsed.invalidateExprs.join(', ')}] }`;
    } else {
      // function form — preserve original arg destructuring
      replacement = `meta: {\n      invalidates: (${argsTrimmed}) => [${parsed.invalidateExprs.join(', ')}],\n    }`;
    }

    // Skip trailing comma after the closing brace if present
    let endIdx = bodyEnd + 1;
    while (endIdx < result.length && /\s/.test(result[endIdx])) endIdx++;
    if (result[endIdx] === ',') endIdx++;
    // Insert trailing comma in our replacement
    replacement += ',';

    result = result.slice(0, headerStart) + replacement + result.slice(endIdx);
    changed = true;
    onSuccessRe.lastIndex = headerStart + replacement.length;
  }

  return changed ? result : null;
}

function processFile(src) {
  let result = src;
  let mutated = false;

  // Find each `useMutation({ ... })` block.
  const useMutRe = /\buseMutation\s*\(\s*\{/g;
  let m;
  const blocks = [];
  while ((m = useMutRe.exec(result)) !== null) {
    const openBrace = m.index + m[0].length - 1;
    const closeBrace = findMatching(result, openBrace);
    if (closeBrace === -1) continue;
    blocks.push({ open: openBrace, close: closeBrace });
  }

  // Process from end to start so indices remain valid.
  for (let i = blocks.length - 1; i >= 0; i--) {
    const { open, close } = blocks[i];
    const block = result.slice(open, close + 1);
    const newBlock = processMutationBlock(block);
    if (newBlock != null) {
      result = result.slice(0, open) + newBlock + result.slice(close + 1);
      mutated = true;
    }
  }

  if (!mutated) return null;

  // After all transforms, drop now-unused `const queryClient = useQueryClient();`
  // declarations IFF there are no remaining `queryClient.` references.
  if (!/queryClient\s*\./.test(result)) {
    result = result.replace(
      /^\s*const\s+queryClient\s*=\s*useQueryClient\s*\(\s*\)\s*;?\s*\n/gm,
      ''
    );
    // Drop import if unused.
    if (!/\buseQueryClient\b/.test(result.replace(/['"][^'"]*useQueryClient[^'"]*['"]/g, ''))) {
      // remove from named imports list
      result = result.replace(
        /import\s*\{([^}]*)\}\s*from\s*['"]@tanstack\/react-query['"];?/g,
        (full, names) => {
          const cleaned = names
            .split(',')
            .map(s => s.trim())
            .filter(s => s && s !== 'useQueryClient')
            .join(', ');
          return cleaned ? `import { ${cleaned} } from '@tanstack/react-query';` : '';
        }
      );
    }
  }

  return result;
}

const allFiles = (await Promise.all(targets.map(collect))).flat();
let touched = 0;
for (const file of allFiles) {
  const src = await fs.readFile(file, 'utf8');
  if (!/useQueryClient/.test(src)) continue;
  const next = processFile(src);
  if (next == null) continue;
  if (DRY) {
    console.log(`[dry] would update: ${file}`);
  } else {
    await fs.writeFile(file, next, 'utf8');
    console.log(`updated: ${file}`);
  }
  touched++;
}
console.log(`\n${DRY ? '[dry] ' : ''}touched ${touched}/${allFiles.length} files`);
