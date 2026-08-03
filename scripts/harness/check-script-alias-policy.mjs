#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "./config.mjs";

const packageJsonPath = join(repoRoot, "package.json");

function loadScripts() {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return pkg.scripts ?? {};
}

function findExactDuplicateBodies(scripts) {
  const byBody = new Map();
  for (const [name, body] of Object.entries(scripts)) {
    if (typeof body !== "string") continue;
    const names = byBody.get(body) ?? [];
    names.push(name);
    byBody.set(body, names);
  }

  return [...byBody.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([body, names]) => ({ body, names }));
}

function printResult(duplicates) {
  if (duplicates.length === 0) {
    process.stdout.write("[script-alias-policy] OK\n");
    return;
  }

  process.stdout.write("[script-alias-policy] ERROR duplicate script bodies detected\n");
  for (const dup of duplicates) {
    process.stdout.write(`- body: ${dup.body}\n`);
    process.stdout.write(`  scripts: ${dup.names.join(", ")}\n`);
  }
  process.stdout.write(
    "Hint: keep one canonical command body and point aliases to it via `npm run <canonical> --`.\n",
  );
}

function main() {
  const scripts = loadScripts();
  const duplicates = findExactDuplicateBodies(scripts);
  printResult(duplicates);
  process.exit(duplicates.length === 0 ? 0 : 1);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[script-alias-policy] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
