#!/usr/bin/env node
/**
 * Script to convert relative parent imports (../) to alias imports (@/)
 *
 * Usage: node scripts/fix-imports.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const DRY_RUN = process.argv.includes('--dry-run');

// Match import/export statements with relative parent paths
const IMPORT_REGEX = /(from\s+['"])(\.\.\/)([^'"]+)(['"])/g;

function getAllFiles(dir, extensions = ['.ts', '.tsx']) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => item.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }
  return files;
}

function resolveToAlias(filePath, relativePath) {
  // Get the directory of the current file relative to src
  const fileDir = path.dirname(filePath);

  // Resolve the relative path to an absolute path
  const absolutePath = path.resolve(fileDir, relativePath);

  // Convert to path relative to src
  const relativeToSrc = path.relative(SRC_DIR, absolutePath);

  // Convert to alias format with forward slashes
  return '@/' + relativeToSrc.replace(/\\/g, '/');
}

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  let changes = [];

  const newContent = content.replace(IMPORT_REGEX, (match, prefix, dots, importPath, suffix) => {
    // Build the full relative path
    const fullRelativePath = dots + importPath;
    const aliasPath = resolveToAlias(filePath, fullRelativePath);

    changes.push({ from: fullRelativePath, to: aliasPath });
    modified = true;

    return prefix + aliasPath + suffix;
  });

  if (modified) {
    const relativePath = path.relative(SRC_DIR, filePath);
    console.log(`\n${relativePath}:`);
    changes.forEach(c => console.log(`  ${c.from} → ${c.to}`));

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, newContent, 'utf8');
    }
  }

  return changes.length;
}

// Main
console.log(DRY_RUN ? '=== DRY RUN (no files will be modified) ===' : '=== Fixing imports ===');
console.log(`Source directory: ${SRC_DIR}\n`);

const files = getAllFiles(SRC_DIR);
let totalChanges = 0;
let filesModified = 0;

for (const file of files) {
  const changes = processFile(file);
  if (changes > 0) {
    totalChanges += changes;
    filesModified++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Files scanned: ${files.length}`);
console.log(`Files modified: ${filesModified}`);
console.log(`Total import changes: ${totalChanges}`);

if (DRY_RUN) {
  console.log('\nRun without --dry-run to apply changes.');
}
