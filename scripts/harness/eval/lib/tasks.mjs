// Attribution & adaptations: see CREDITS.md. Shared task/verifier/security machinery extracted
// from run-eval.mjs so run-eval.mjs and ablate-artifact.mjs share one implementation instead of two
// (per deterministic-validation's self-mutation-audit principle: don't let the harness for the
// harness drift into independently-maintained copies).
/**
 * Shared eval-harness primitives: task loading, verifier loading, suite hashing, verifier
 * self-test (unsolved must fail / solved must pass), and the dangerous-diff changed-file scan.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { applyOverlay, copyInto, listFiles, makeSandbox, readIfExists, removeSandbox } from "./sandbox.mjs";
import dangerousDiff from "../verifiers/dangerous-diff.mjs";

export function loadTasks(tasksDir) {
  if (!existsSync(tasksDir)) return [];
  const tasks = [];
  for (const id of readdirSync(tasksDir)) {
    const dir = join(tasksDir, id);
    if (!statSync(dir).isDirectory()) continue;
    const taskFile = join(dir, "task.json");
    if (!existsSync(taskFile)) continue;
    const task = JSON.parse(readFileSync(taskFile, "utf8"));
    tasks.push({ ...task, dir });
  }
  return tasks.sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export async function loadVerifier(verifiersDir, name) {
  const path = join(verifiersDir, `${name}.mjs`);
  if (!existsSync(path)) throw new Error(`verifier not found: ${name}`);
  const mod = await import(pathToFileURL(path).href);
  if (typeof mod.default !== "function")
    throw new Error(`verifier ${name} has no default export`);
  return mod.default;
}

// Hash of every file under tasksDir + verifiersDir (sorted) — tamper-evidence for the evolve loop
// and for ablation runs (records which suite version an ablation ran against).
export function computeSuiteHash(tasksDir, verifiersDir) {
  const hash = createHash("sha256");
  for (const root of [tasksDir, verifiersDir]) {
    for (const rel of listFiles(root).sort()) {
      hash.update(rel);
      hash.update("\0");
      hash.update(readFileSync(join(root, rel)));
      hash.update("\0");
    }
  }
  return `sha256:${hash.digest("hex")}`;
}

// dangerous-diff scans only files CHANGED or ADDED relative to the original fixture. Prose/review
// (.md) files and a task's declared review artifact are excluded (they legitimately quote risky
// constructs).
export function scanDanger(workdir, originalDir, { excludeFiles = [] } = {}) {
  const exclude = new Set(excludeFiles);
  const files = listFiles(workdir)
    .filter((rel) => !rel.endsWith(".md") && !exclude.has(rel))
    .map((rel) => ({ rel, content: readIfExists(join(workdir, rel)) || "" }))
    .filter(({ rel, content }) => {
      const before = readIfExists(join(originalDir, rel));
      return before === null || before !== content; // new or modified only
    })
    .map(({ rel, content }) => ({ path: rel, content }));
  return dangerousDiff({ files });
}

// Proves each task's verifier FAILS on the unsolved fixture and PASSES on the solved overlay.
// Shared by run-eval.mjs's --self-test and ablate-artifact.mjs's --self-test.
export async function selfTestTasks(tasks, verifiersDir) {
  const checks = [];
  for (const task of tasks) {
    const verifier = await loadVerifier(verifiersDir, task.verifier);
    const sandbox = makeSandbox();
    try {
      copyInto(join(task.dir, "workdir"), sandbox);
      const unsolved = verifier({ workdir: sandbox, task });
      checks.push({
        name: `${task.id}: verifier fails on unsolved`,
        ok: unsolved.pass === false,
        detail: unsolved.detail,
      });

      const solvedDir = task.selfTest?.solvedDir ? join(task.dir, task.selfTest.solvedDir) : null;
      applyOverlay(solvedDir, sandbox);
      const solved = verifier({ workdir: sandbox, task });
      checks.push({
        name: `${task.id}: verifier passes on solved`,
        ok: solved.pass === true,
        detail: solved.detail,
      });
    } finally {
      removeSandbox(sandbox);
    }
  }
  return checks;
}
