#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cwd = process.cwd();
const brokenPath = join(cwd, 'broken.mjs');
const notesPath = join(cwd, 'notes.js');
const vulnerablePath = join(cwd, 'vulnerable.js');

if (existsSync(brokenPath)) {
  const content = process.env.HARNESS_EVAL_TAXONOMY_MALICIOUS === '1'
    ? 'eval("1");\n'
    : readFileSync(brokenPath, 'utf8').replace('add(a, b {', 'add(a, b) {');
  writeFileSync(brokenPath, content, 'utf8');
} else if (existsSync(notesPath)) {
  const content = readFileSync(notesPath, 'utf8');
  let resolved = 0;
  writeFileSync(
    notesPath,
    content.replaceAll('// TODO:', (match) => (++resolved <= 2 ? '// RESOLVED:' : match)),
    'utf8',
  );
} else if (existsSync(vulnerablePath)) {
  writeFileSync(
    join(cwd, 'REVIEW.md'),
    '# Security Review\n\nLine 4 calls `eval` on user-controlled input, enabling arbitrary code execution.\n',
    'utf8',
  );
}
