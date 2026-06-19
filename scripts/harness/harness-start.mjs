#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

function parseTask(argv) {
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--task" && argv[i + 1]) {
      return argv[i + 1];
    }
  }
  return "";
}

function runNodeScript(scriptPath, args) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    stdio: "inherit",
  });
}

const task = parseTask(process.argv.slice(2));

if (!task) {
  process.stderr.write('[harness:start] missing --task "<task description>"\n');
  process.exit(2);
}

process.stdout.write("[harness:start] Step 1/2: graph freshness\n");
const graphResult = runNodeScript("scripts/harness/graph.mjs", ["status"]);

process.stdout.write("[harness:start] Step 2/2: route recommendation\n");
const routeResult = runNodeScript("scripts/harness/prompt-router.mjs", [
  "route",
  "--task",
  task,
]);

process.stdout.write("\n[harness:start] Next commands:\n");
process.stdout.write(`  npm run harness:feature -- --task "${task}"\n`);
process.stdout.write(`  npm run harness:handoff:review -- --task "${task}"\n`);

if (routeResult.status && routeResult.status !== 0) {
  process.exit(routeResult.status);
}
if (graphResult.status && graphResult.status > 1) {
  process.exit(graphResult.status);
}
