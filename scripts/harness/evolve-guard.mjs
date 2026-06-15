#!/usr/bin/env node
// Attribution & adaptations: see CREDITS.md. Meta-evolution safety per the self-improving-harness
// Brief (.github/harness/memory/briefs/). The two hard rules of meta-optimization live here.
/**
 * Evolve-guard — the safety boundary for the harness-evolve loop.
 *
 * Meta-optimization (a loop that edits the harness itself) has two failure modes a normal
 * experiment doesn't:
 *   1. The loop edits its OWN fitness function (eval tasks/verifiers) and reward-hacks instantly.
 *   2. The loop weakens its OWN guardrails / security primitives to make "improvement" easier.
 *
 * This module enforces the two hard rules from the Brief:
 *   RULE 1  The evolve target may NEVER resolve to a forbidden path (eval suite, guardrail/security
 *           files, memory, config, the evolve runner itself). Checked at config time — fail fast.
 *   RULE 2  The eval suite + forbidden files are hashed before the run; if that integrity hash
 *           changes mid-run, the run is ABORTED (something edited the scorer or a guardrail).
 *
 * It is import-only logic with a thin CLI for inspection. No agent, no network.
 */
import { execSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Paths the evolve loop must never target and that must never change during a run.
// Globs use ** (any depth) and * (within a segment).
export const FORBIDDEN_GLOBS = [
  "scripts/harness/eval/**", // the fitness function (tasks + verifiers + runner)
  "scripts/harness/evolve-guard.mjs", // this guard
  "scripts/harness/harness-evolve.mjs", // the evolve runner
  "scripts/harness/run-experiment.mjs", // the keep-if-improved engine
  "scripts/harness/run-loop.mjs", // the convergence engine
  "scripts/harness/untrusted.mjs", // prompt-as-data boundary
  "scripts/harness/llm-provider.mjs", // provider adapter
  "scripts/harness/ollama-agent.mjs", // agents
  "scripts/harness/ollama-apply-agent.mjs",
  "scripts/harness/config.mjs", // token resolver
  "scripts/harness/grade-trace.mjs", // the process critic (early-stop authority)
  "scripts/harness/otel-export.mjs", // the telemetry/audit exporter
  "scripts/harness/git-guard.mjs", // the dangerous-git safety control
  ".github/harness/memory/**", // committed memory (lessons/briefs/quarantine)
  ".github/harness/loops/harness-evolve.json", // the evolve loop's own definition
  "harness.config.json", // project commands
];

export function globToRegExp(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  const withPlaceholders = escaped
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${withPlaceholders.replace(/\u0000/g, ".*")}$`);
}

export function matchesForbidden(posixPath) {
  return FORBIDDEN_GLOBS.some((glob) => globToRegExp(glob).test(posixPath));
}

function toPosix(p) {
  return p.split(sep).join("/");
}

// Resolve a target pattern to concrete tracked/literal files (mirrors run-experiment.resolveTargets).
function resolvePattern(pattern) {
  const files = new Set();
  try {
    const out = execSync(`git ls-files -- "${pattern}"`, {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    for (const line of out.split("\n")) if (line.trim()) files.add(line.trim());
  } catch {
    // not tracked / git unavailable
  }
  const literal = join(repoRoot, pattern);
  if (existsSync(literal) && statSync(literal).isFile()) {
    files.add(toPosix(relative(repoRoot, literal)));
  }
  return [...files];
}

/** Resolve target patterns to concrete files (exported for the runner's commit step). */
export function resolveTargetFiles(patterns) {
  const files = new Set();
  for (const pattern of patterns || []) {
    for (const file of resolvePattern(pattern)) files.add(file);
  }
  return [...files];
}

/**
 * RULE 1 check. Returns a list of violations (empty = safe). A violation is either the declared
 * pattern itself matching a forbidden glob, or any file it resolves to matching one.
 * @param {string[]} targetPatterns
 */
export function forbiddenTargetViolations(targetPatterns) {
  const violations = [];
  for (const pattern of targetPatterns || []) {
    const posixPattern = toPosix(String(pattern));
    if (matchesForbidden(posixPattern)) {
      violations.push({
        pattern,
        reason: "declared target matches a forbidden path",
      });
      continue;
    }
    for (const file of resolvePattern(pattern)) {
      if (matchesForbidden(file)) {
        violations.push({
          pattern,
          file,
          reason: "target resolves to a forbidden file",
        });
      }
    }
  }
  return violations;
}

// Recursively list files under a dir as POSIX paths relative to repoRoot.
function listFilesUnder(absDir) {
  const out = [];
  if (!existsSync(absDir)) return out;
  for (const entry of readdirSync(absDir)) {
    const abs = join(absDir, entry);
    if (statSync(abs).isDirectory()) out.push(...listFilesUnder(abs));
    else out.push(toPosix(relative(repoRoot, abs)));
  }
  return out;
}

// Every existing file covered by a forbidden glob (expanded), sorted & deduped.
function forbiddenFiles() {
  const files = new Set();
  for (const glob of FORBIDDEN_GLOBS) {
    if (glob.endsWith("/**")) {
      const base = join(repoRoot, glob.slice(0, -3));
      for (const f of listFilesUnder(base)) files.add(f);
    } else {
      const abs = join(repoRoot, glob);
      if (existsSync(abs) && statSync(abs).isFile())
        files.add(toPosix(relative(repoRoot, abs)));
    }
  }
  return [...files].sort();
}

// RULE 2 baseline. Hash of all forbidden files' contents (tamper tripwire) + the eval suiteHash,
// which is ALSO a health gate: if the suite self-test fails, we refuse to evolve against a broken
// scorer. Spawns run-eval --self-test --json (deterministic, no agent, no network).
export function computeIntegrity() {
  const files = forbiddenFiles();
  const hash = createHash("sha256");
  for (const rel of files) {
    hash.update(rel);
    hash.update("\0");
    hash.update(readFileSync(join(repoRoot, rel)));
    hash.update("\0");
  }
  const forbiddenHash = `sha256:${hash.digest("hex")}`;

  const evalRunner = join(
    repoRoot,
    "scripts",
    "harness",
    "eval",
    "run-eval.mjs",
  );
  let suiteHash = null;
  let suiteOk = false;
  let suiteDetail = "eval runner not found";
  if (existsSync(evalRunner)) {
    const result = spawnSync(
      process.execPath,
      [evalRunner, "--self-test", "--json"],
      {
        cwd: repoRoot,
        encoding: "utf8",
      },
    );
    try {
      const parsed = JSON.parse(result.stdout || "{}");
      suiteOk = parsed.ok === true;
      suiteHash = parsed.suiteHash ?? null;
      suiteDetail = suiteOk
        ? "self-test passed"
        : "self-test FAILED — do not evolve against it";
    } catch {
      suiteDetail = "could not parse run-eval --self-test output";
    }
  }

  return {
    ok: suiteOk,
    forbiddenHash,
    forbiddenFileCount: files.length,
    suiteHash,
    suiteOk,
    suiteDetail,
  };
}

/** Compare a fresh integrity reading against a recorded baseline. */
export function integrityMatches(baseline, current) {
  return (
    baseline.forbiddenHash === current.forbiddenHash &&
    baseline.suiteHash === current.suiteHash &&
    current.suiteOk === true
  );
}

// CLI: `node scripts/harness/evolve-guard.mjs [--target "<pattern>"]`
if (
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`
) {
  const targetIdx = process.argv.indexOf("--target");
  const targets = targetIdx >= 0 ? [process.argv[targetIdx + 1]] : [];
  const violations = forbiddenTargetViolations(targets);
  const integrity = computeIntegrity();
  process.stdout.write(
    `${JSON.stringify(
      {
        forbiddenGlobs: FORBIDDEN_GLOBS.length,
        checkedTarget: targets[0] ?? null,
        targetViolations: violations,
        integrity,
      },
      null,
      2,
    )}\n`,
  );
  process.exit(violations.length === 0 && integrity.ok ? 0 : 1);
}
