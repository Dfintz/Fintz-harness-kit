#!/usr/bin/env node
// Attribution & adaptations: see CREDITS.md. Phase 3 of the self-improving-harness Brief
// (.github/harness/memory/briefs/). Meta-evolution with autonomy OFF by default.
/**
 * harness-evolve — point the autoresearch experiment machinery at the HARNESS ITSELF.
 *
 * The target is a harness artifact (a prompt/instruction fragment), the metric is the eval score
 * (scripts/harness/eval/run-eval.mjs), and keep-if-improved is delegated to run-experiment.mjs.
 * This runner adds the meta-safety layer that a normal experiment doesn't need (see evolve-guard.mjs):
 *
 *   RULE 1  Fail fast if the loop's target resolves to a forbidden path (the eval suite it is being
 *           scored by, any guardrail/security file, memory, config, or the evolve machinery itself).
 *   RULE 2  Hash the eval suite + forbidden files before the run; re-check before AND after every
 *           iteration. If that integrity changes — the agent touched the scorer or a guardrail —
 *           ABORT immediately and refuse to commit.
 *
 * Autonomy is OFF by default: nothing is committed unless --commit is passed explicitly, and even
 * then only the target file(s) are committed, only after the post-iteration integrity check passes.
 * Nothing is ever pushed.
 *
 * Usage:
 *   node scripts/harness/harness-evolve.mjs --check                 # validate guards, no agent
 *   node scripts/harness/harness-evolve.mjs --agent "<cmd>"         # evolve (no commit)
 *   node scripts/harness/harness-evolve.mjs --agent "<cmd>" --commit --max-iterations 3
 *
 * Exit codes: 0 ok / improved, 1 aborted (integrity violation or no improvement), 2 config error.
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
    computeIntegrity,
    forbiddenTargetViolations,
    integrityMatches,
    resolveTargetFiles,
} from "./evolve-guard.mjs";
import { defangInjections } from "./untrusted.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const loopsDir = join(repoRoot, ".github", "harness", "loops");
const researchDir = join(repoRoot, ".github", "harness", "research");
const runExperiment = resolve(
  repoRoot,
  "scripts",
  "harness",
  "run-experiment.mjs",
);

function fail(message, code = 2) {
  process.stderr.write(`[harness-evolve] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = {
    loop: "harness-evolve",
    check: false,
    commit: false,
    dryRun: false,
    selfTest: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--check") flags.check = true;
    else if (a === "--commit") flags.commit = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--self-test") flags.selfTest = true;
    else if (a === "--help") flags.help = true;
    else if (a === "--agent") flags.agent = argv[++i];
    else if (a === "--loop") flags.loop = argv[++i];
    else if (a === "--research") flags.research = argv[++i];
    else if (a === "--max-iterations") flags.maxIterations = Number(argv[++i]);
    else if (a === "--max-iter") flags.maxIterations = Number(argv[++i]);
    else if (a.startsWith("--")) fail(`Unknown option: ${a}`);
  }
  return flags;
}

function loadLoop(name) {
  const path = join(loopsDir, `${name}.json`);
  if (!existsSync(path)) fail(`No loop "${name}" in ${loopsDir}.`);
  const loop = JSON.parse(readFileSync(path, "utf8"));
  if (loop.kind !== "experiment")
    fail(`Loop "${name}" must be kind "experiment".`);
  if (!Array.isArray(loop.target) || loop.target.length === 0)
    fail(`Loop "${name}" needs target[].`);
  return loop;
}

// Resolve an opt-in research brief (Phase 4 sensor). 'latest' picks the newest *-brief.md; otherwise
// the value is a path. Returns an absolute path or fails. The brief is UNTRUSTED — the apply-agent
// wraps + defangs it at use via HARNESS_RESEARCH_FILE; here we only resolve it and log a safety note.
function resolveResearchFile(value) {
  if (value === "latest" || value === undefined) {
    if (!existsSync(researchDir))
      fail(
        "--research latest: no .github/harness/research/ briefs. Ingest one first.",
        2,
      );
    const briefs = readdirSync(researchDir)
      .filter((f) => f.endsWith("-brief.md"))
      .map((f) => ({
        abs: join(researchDir, f),
        mtimeMs: statSync(join(researchDir, f)).mtimeMs,
      }))
      .sort((a, b) => b.mtimeMs - a.mtimeMs);
    if (briefs.length === 0)
      fail(
        "--research latest: no briefs found. Run research-ingest.mjs first.",
        2,
      );
    return briefs[0].abs;
  }
  const abs = resolve(repoRoot, value);
  if (!existsSync(abs)) fail(`--research: file not found: ${value}`, 2);
  return abs;
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage:
          'node scripts/harness/harness-evolve.mjs [--check|--dry-run|--self-test|--agent "<cmd>"] [--commit] [--research latest|<path>] [--max-iterations n]',
        rules: [
          "RULE 1: target may never resolve to a forbidden path (eval suite / guardrails / memory / config / evolve machinery).",
          "RULE 2: eval-suite + forbidden-file integrity is checked before AND after every iteration; any change aborts the run.",
        ],
        research:
          "--research feeds an UNTRUSTED brief (Phase 4 sensor) to the agent as data (wrapped + defanged at use). Opt-in.",
        autonomy:
          "OFF by default — no commit unless --commit; never pushes; --check runs no agent.",
      },
      null,
      2,
    )}\n`,
  );
}

// Commit ONLY the resolved target files, after integrity has been re-verified. Never pushes.
function commitTargets(targetFiles, loopName, iteration) {
  try {
    execSync(`git add -- ${targetFiles.map((f) => `"${f}"`).join(" ")}`, {
      cwd: repoRoot,
      stdio: "ignore",
    });
    const staged = execSync("git diff --cached --name-only", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    if (!staged) return false;
    execSync(
      `git commit -m "chore(harness-evolve): ${loopName} iter ${iteration} (eval-gated)"`,
      {
        cwd: repoRoot,
        stdio: "ignore",
      },
    );
    process.stdout.write(
      `[harness-evolve]   committed target(s) for iteration ${iteration}\n`,
    );
    return true;
  } catch (error) {
    process.stderr.write(
      `[harness-evolve]   commit failed: ${error.message}\n`,
    );
    return false;
  }
}

function runOneExperimentIteration(loopName, agentCmd) {
  const args = [runExperiment, loopName, "--max-iterations", "1"];
  if (agentCmd) args.push("--agent", agentCmd);
  // Deliberately NOT passing --commit: this runner owns commit, gated behind the post-integrity check.
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    stdio: "inherit",
  });
  return result.status ?? 1; // run-experiment: 0 improved, 1 exhausted, 3 stuck
}

function abortOnTamper(loopName) {
  process.stderr.write(
    `[harness-evolve] ABORTED — eval-suite/guardrail integrity changed during the run.\n` +
      `[harness-evolve] Something edited a forbidden path (the scorer or a guardrail). This is exactly\n` +
      `[harness-evolve] the reward-hacking the guard exists to stop. Inspect and restore:\n` +
      `[harness-evolve]   git status && git diff -- scripts/harness/eval .github/harness/memory\n` +
      `[harness-evolve]   git checkout -- scripts/harness/eval .github/harness/memory harness.config.json\n`,
  );
  process.exit(1);
}

function runSelfTest() {
  const checks = [
    {
      name: "loop loads and is experiment",
      ok: () => loadLoop("harness-evolve").kind === "experiment",
    },
    {
      name: "target is not forbidden",
      ok: () => forbiddenTargetViolations([".github/harness/evolve/candidate-instructions.md"]).length === 0,
    },
    {
      name: "integrity hash exists",
      ok: () => typeof computeIntegrity().forbiddenHash === "string",
    },
  ];

  let passed = 0;
  for (const check of checks) {
    try {
      if (check.ok()) {
        passed += 1;
      }
    } catch {
      // ignore and count as failed
    }
  }

  const result = { ok: passed === checks.length, passed, total: checks.length };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.ok ? 0 : 1);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }
  if (flags.selfTest) {
    runSelfTest();
    return;
  }

  const loop = loadLoop(flags.loop);

  // RULE 1 — config-time fail fast.
  const violations = forbiddenTargetViolations(loop.target);
  if (violations.length > 0) {
    fail(
      `RULE 1 violation — loop "${flags.loop}" target is forbidden:\n` +
        violations
          .map(
            (v) =>
              `  - ${v.pattern}${v.file ? ` → ${v.file}` : ""}: ${v.reason}`,
          )
          .join("\n") +
        `\nAn evolve loop may not target the eval suite, guardrails, memory, config, or its own machinery.`,
      2,
    );
  }

  // RULE 2 — integrity baseline (also a health gate: refuses a broken scorer).
  const baseline = computeIntegrity();

  if (flags.check || flags.dryRun) {
    process.stdout.write(
      `${JSON.stringify(
        {
          loop: flags.loop,
          targetViolations: violations,
          integrity: baseline,
          dryRun: flags.dryRun,
          autonomy: "off (default)",
        },
        null,
        2,
      )}\n`,
    );
    const modeLabel = flags.dryRun ? "--dry-run" : "--check";
    const modeMessage = baseline.ok
      ? `[harness-evolve] ${modeLabel} PASSED — target is safe and the eval suite is healthy.\n`
      : `[harness-evolve] ${modeLabel} FAILED — ${baseline.suiteDetail}.\n`;
    process.stdout.write(modeMessage);
    process.exit(baseline.ok ? 0 : 1);
  }

  if (!baseline.ok) {
    fail(
      `refusing to evolve — eval suite is not healthy (${baseline.suiteDetail}). Fix it first.`,
      2,
    );
  }

  const agentCmd = flags.agent || process.env.HARNESS_AGENT_CMD;
  if (!agentCmd)
    fail(
      'no agent. Use --agent "<cmd>" or set HARNESS_AGENT_CMD (or use --check).',
      2,
    );

  // Phase 4 sensor (opt-in): point the apply-agent at an untrusted research brief. Children inherit
  // process.env, so setting HARNESS_RESEARCH_FILE here flows through run-experiment to the apply-agent,
  // which wraps + defangs it at use. Logged loudly to reinforce the human gate.
  if (flags.research !== undefined) {
    const researchAbs = resolveResearchFile(flags.research);
    process.env.HARNESS_RESEARCH_FILE = researchAbs;
    let markers = 0;
    try {
      markers = defangInjections(readFileSync(researchAbs, "utf8")).flagged;
    } catch {
      /* unreadable brief surfaces later */
    }
    process.stdout.write(
      `[harness-evolve] ⚠ UNTRUSTED research active: ${researchAbs}\n` +
        `[harness-evolve]   ${markers} injection marker(s) detected; the agent will defang + wrap it as data.\n` +
        `[harness-evolve]   Review the run before committing anything this brief influenced.\n`,
    );
  }

  const maxIterations = Number.isInteger(flags.maxIterations)
    ? Math.min(flags.maxIterations, loop.maxIterations ?? flags.maxIterations)
    : (loop.maxIterations ?? 5);
  const noImprovementStop = Number.isInteger(loop.noImprovementStop)
    ? loop.noImprovementStop
    : maxIterations;
  const targetFiles = resolveTargetFiles(loop.target);

  process.stdout.write(
    `[harness-evolve] "${flags.loop}" — target ${targetFiles.join(", ") || loop.target.join(", ")}\n` +
      `[harness-evolve] integrity baseline: suite ${baseline.suiteHash}, ${baseline.forbiddenFileCount} guarded files\n` +
      `[harness-evolve] autonomy: commit=${flags.commit ? "on (explicit)" : "OFF"}, push=never\n`,
  );

  let streak = 0;
  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    // Pre-gate.
    if (!integrityMatches(baseline, computeIntegrity()))
      abortOnTamper(flags.loop);

    process.stdout.write(
      `[harness-evolve] iteration ${iteration}/${maxIterations}\n`,
    );
    const status = runOneExperimentIteration(flags.loop, agentCmd);

    // Post-gate — the agent may have touched a forbidden path; verify BEFORE trusting/committing.
    if (!integrityMatches(baseline, computeIntegrity()))
      abortOnTamper(flags.loop);

    const improved = status === 0;
    if (improved) {
      streak = 0;
      if (flags.commit) commitTargets(targetFiles, flags.loop, iteration);
      else
        process.stdout.write(
          `[harness-evolve]   improvement kept on disk (commit OFF — review then commit)\n`,
        );
    } else {
      streak += 1;
      if (streak >= noImprovementStop) {
        process.stdout.write(
          `[harness-evolve] stopping — ${streak} iteration(s) without improvement.\n`,
        );
        process.exit(1);
      }
    }
  }

  process.stdout.write(
    `[harness-evolve] done — ${maxIterations} iteration(s), integrity intact.\n`,
  );
  process.exit(0);
}

main();
