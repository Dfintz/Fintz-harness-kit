#!/usr/bin/env node
/**
 * harness-help — discovery aid: lists every `harness:*` npm script (grouped by namespace,
 * derived from package.json so it never drifts) plus the loop inventory. Discovery only —
 * health/preflight lives in `harness:doctor`.
 *
 *   node scripts/harness/harness-help.mjs            # grouped command + loop listing
 *   node scripts/harness/harness-help.mjs --json     # machine-readable
 *   node scripts/harness/harness-help.mjs --self-test
 *
 * No network, no install — Node built-ins only, so it runs in selftest-all.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PREFIX = "harness:";

// Group `harness:*` scripts by the segment after the prefix (harness:evolve:check -> "evolve").
// Output is fully sorted (groups by key, entries by name) so callers/self-tests are deterministic.
function groupHarnessScripts(scriptsObj) {
  const names = Object.keys(scriptsObj || {})
    .filter((name) => name.startsWith(PREFIX))
    .sort((a, b) => a.localeCompare(b));

  const groups = new Map();
  for (const name of names) {
    const segment = name.slice(PREFIX.length).split(":")[0] || "misc";
    if (!groups.has(segment)) groups.set(segment, []);
    groups.get(segment).push({ name, command: scriptsObj[name] });
  }

  return new Map(
    [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  );
}

function loadGroups() {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  return groupHarnessScripts(pkg.scripts);
}

function listLoops() {
  const result = spawnSync(
    process.execPath,
    ["scripts/harness/run-loop.mjs", "--list"],
    {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  return (result.stdout || "").trim();
}

function toJsonShape(groups) {
  const out = {};
  for (const [segment, entries] of groups) out[segment] = entries;
  return out;
}

function printHuman(groups) {
  process.stdout.write("Harness commands (derived from package.json)\n");
  for (const [segment, entries] of groups) {
    process.stdout.write(`\n  ${segment}\n`);
    for (const entry of entries) {
      process.stdout.write(`    npm run ${entry.name}\n`);
    }
  }

  const loops = listLoops();
  if (loops) {
    process.stdout.write("\nLoop inventory (run-loop --list)\n");
    process.stdout.write(`${loops}\n`);
  }
}

function expect(name, condition) {
  const ok = Boolean(condition);
  process.stdout.write(`  ${ok ? "OK" : "FAIL"} ${name}\n`);
  return ok;
}

function runSelfTest() {
  process.stdout.write("[harness-help] Running 4 self-tests...\n");
  let passed = 0;

  const sample = {
    build: "turbo run build",
    "harness:doctor": "node scripts/harness/doctor.mjs",
    "harness:doctor:strict": "node scripts/harness/doctor.mjs --strict",
    "harness:evolve": "node scripts/harness/harness-evolve.mjs",
    "harness:evolve:check": "node scripts/harness/evolve-guard.mjs --check",
  };
  const groups = groupHarnessScripts(sample);
  const keys = [...groups.keys()];
  const allEntries = [...groups.values()].flat().map((entry) => entry.name);

  passed += Number(
    expect("excludes non-harness scripts", !allEntries.includes("build")),
  );
  passed += Number(
    expect(
      "groups by namespace segment",
      keys.includes("doctor") && keys.includes("evolve"),
    ),
  );
  passed += Number(
    expect(
      "groups sorted deterministically",
      JSON.stringify(keys) ===
        JSON.stringify([...keys].sort((a, b) => a.localeCompare(b))),
    ),
  );
  passed += Number(
    expect(
      "entries sorted within group",
      JSON.stringify(groups.get("doctor").map((entry) => entry.name)) ===
        JSON.stringify(["harness:doctor", "harness:doctor:strict"]),
    ),
  );

  process.stdout.write(`[harness-help] ${passed}/4 self-tests passed\n`);
  return passed === 4 ? 0 : 1;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    process.exit(runSelfTest());
  }

  const groups = loadGroups();
  if (args.includes("--json")) {
    process.stdout.write(`${JSON.stringify(toJsonShape(groups), null, 2)}\n`);
    return;
  }

  printHuman(groups);
}

main();
