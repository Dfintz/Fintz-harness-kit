#!/usr/bin/env node
// Attribution & adaptations: see CREDITS.md. Implements the ablate-ai-layer-eval-harness-slice
// Architecture Brief (.github/harness/memory/briefs/), generalizing run-eval.mjs's whole-harness
// baseline/with-harness toggle to a single named instruction/skill artifact.
/**
 * ablate-artifact — test whether ONE instruction/skill file still earns its always-on context cost.
 *
 * For each of a set of fixed probe tasks (reused from scripts/harness/eval/tasks/), runs the agent
 * twice through the SAME sandboxed fixture, verified by the SAME deterministic verifier: once with
 * the target artifact's content inlined into the prompt, once without. If the artifact never changes
 * the verified outcome across every task the caller declares relevant, it recommends trimming it.
 *
 * The applicability gate: --relevant-tasks is REQUIRED. A zero-delta result against tasks that don't
 * exercise the artifact's domain is not evidence the artifact is safe to cut — it's just an unrelated
 * probe. Forcing an explicit, human-declared relevant-task list turns that judgment call into an
 * input the caller must make consciously, rather than a conclusion the script infers silently.
 *
 * Usage:
 *   node scripts/harness/eval/ablate-artifact.mjs --list
 *   node scripts/harness/eval/ablate-artifact.mjs --self-test
 *   node scripts/harness/eval/ablate-artifact.mjs --target <path> --relevant-tasks <id,id,...> --agent "<cmd>" [--json]
 *
 * Output: a recommendation only — "keep", "candidate-for-trim", or (when dangerous-diff fires)
 * "rejected". Never edits the target file. A human decides what to do with the recommendation.
 *
 * Exit codes: 0 ok / self-test passed, 1 self-test failed or run rejected, 2 config error.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import { copyInto, makeSandbox, removeSandbox } from "./lib/sandbox.mjs";
import { computeSuiteHash, loadTasks, loadVerifier, scanDanger, selfTestTasks } from "./lib/tasks.mjs";

const evalDir = resolve(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(evalDir, "..", "..", "..");
const tasksDir = join(evalDir, "tasks");
const verifiersDir = join(evalDir, "verifiers");
const runsDir = join(repoRoot, ".github", "harness", "runs");

function fail(message, code = 2) {
  process.stderr.write(`[ablate-artifact] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    if (a === "--self-test" || a === "--list" || a === "--json" || a === "--help") {
      flags[a.slice(2)] = true;
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
}

function invokeAgentWithPrompt(agentCmd, prompt, sandbox) {
  const startedAt = Date.now();
  const result = spawnSync(agentCmd, {
    cwd: sandbox,
    shell: true,
    input: prompt,
    stdio: ["pipe", "inherit", "inherit"],
    env: { ...process.env, HARNESS_EVAL_SANDBOX: sandbox },
  });
  return { status: result.status ?? 1, durationMs: Date.now() - startedAt };
}

// Filter the fixed task set down to the caller-declared relevant ones, failing fast on typos
// instead of silently running zero tasks.
function resolveRelevantTasks(allTasks, relevantTasks) {
  if (!relevantTasks) return allTasks;
  const known = new Set(allTasks.map((t) => t.id));
  const missing = relevantTasks.filter((id) => !known.has(id));
  if (missing.length > 0) fail(`unknown task id(s): ${missing.join(", ")}`);
  return allTasks.filter((t) => relevantTasks.includes(t.id));
}

async function runSelfTest({ json, relevantTasks }) {
  const allTasks = loadTasks(tasksDir);
  const tasks = resolveRelevantTasks(allTasks, relevantTasks);
  const checks = await selfTestTasks(tasks, verifiersDir);
  const passed = checks.every((c) => c.ok);

  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: passed, mode: "self-test", taskCount: tasks.length, checks }, null, 2)}\n`);
  } else {
    process.stdout.write(`[ablate-artifact] self-test — ${tasks.length} task(s)\n`);
    for (const c of checks) {
      const suffix = c.ok ? "" : ` -- ${c.detail}`;
      process.stdout.write(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${suffix}\n`);
    }
    process.stdout.write(`[ablate-artifact] ${passed ? "self-test PASSED" : "self-test FAILED"}\n`);
  }
  process.exit(passed ? 0 : 1);
}

async function runAblation({ target, relevantTasks, agentCmd, json }) {
  // Local CLI tool, run by a developer against their own checkout -- still refuse to read outside
  // the repo root rather than trusting --target blindly.
  const targetAbs = resolve(repoRoot, target);
  const withinRepo = targetAbs === repoRoot || targetAbs.startsWith(`${repoRoot}${sep}`);
  if (!withinRepo) fail(`--target must resolve inside the repository: ${target}`);
  let targetContent;
  try {
    targetContent = readFileSync(targetAbs, "utf8");
  } catch {
    fail(`target artifact not found: ${target}`);
  }
  const targetRel = relative(repoRoot, targetAbs).replaceAll("\\", "/");

  const allTasks = loadTasks(tasksDir);
  const tasks = resolveRelevantTasks(allTasks, relevantTasks);

  const startedAt = new Date().toISOString();
  const records = [];
  let dangerousFlagged = 0;

  for (const task of tasks) {
    const verifier = await loadVerifier(verifiersDir, task.verifier);
    const reviewArtifact = task.expected?.file ? [task.expected.file] : [];

    // Without the artifact — same task, same verifier, nothing else changes.
    const withoutSandbox = makeSandbox();
    let without;
    try {
      copyInto(join(task.dir, "workdir"), withoutSandbox);
      const run = invokeAgentWithPrompt(agentCmd, task.prompt, withoutSandbox);
      without = verifier({ workdir: withoutSandbox, task });
      without.run = run;
    } finally {
      removeSandbox(withoutSandbox);
    }

    // With the artifact inlined into the prompt — the ONE variable that changes.
    const withSandbox = makeSandbox();
    let withArm;
    let danger;
    try {
      copyInto(join(task.dir, "workdir"), withSandbox);
      const prompt = `${task.prompt}\n\n## Guidance under test (${targetRel})\n${targetContent}`;
      const run = invokeAgentWithPrompt(agentCmd, prompt, withSandbox);
      withArm = verifier({ workdir: withSandbox, task });
      withArm.run = run;
      danger = scanDanger(withSandbox, join(task.dir, "workdir"), { excludeFiles: reviewArtifact });
    } finally {
      removeSandbox(withSandbox);
    }
    if (danger.flagged) dangerousFlagged += danger.matches.length;

    records.push({
      id: task.id,
      without: { pass: without.pass, score: without.score, detail: without.detail, durationMs: without.run.durationMs },
      withArtifact: { pass: withArm.pass, score: withArm.score, detail: withArm.detail, durationMs: withArm.run.durationMs },
      dangerous: { flagged: danger.flagged, matches: danger.matches },
    });
  }

  const n = records.length || 1;
  const withoutScore = records.reduce((s, r) => s + r.without.score, 0) / n;
  const withScore = records.reduce((s, r) => s + r.withArtifact.score, 0) / n;
  const delta = Number((withScore - withoutScore).toFixed(4));
  const rejected = dangerousFlagged > 0;
  let recommendation = "candidate-for-trim";
  if (rejected) recommendation = "rejected";
  else if (delta > 0) recommendation = "keep";

  const journal = {
    kind: "ablate",
    target: targetRel,
    relevantTasks,
    startedAt,
    finishedAt: new Date().toISOString(),
    agent: agentCmd,
    suiteHash: computeSuiteHash(tasksDir, verifiersDir),
    recommendation,
    tasks: records,
    aggregate: {
      withoutScore: Number(withoutScore.toFixed(4)),
      withScore: Number(withScore.toFixed(4)),
      delta,
      dangerousFlagged,
    },
  };

  mkdirSync(runsDir, { recursive: true });
  const slug = targetRel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const out = join(runsDir, `ablate-${slug}-${startedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(out, JSON.stringify(journal, null, 2));

  if (json) {
    process.stdout.write(`${JSON.stringify(journal, null, 2)}\n`);
  } else {
    process.stdout.write(
      `[ablate-artifact] ${targetRel}: without ${journal.aggregate.withoutScore} -> with ${journal.aggregate.withScore} (delta ${delta}) => ${recommendation}\n`,
    );
    process.stdout.write(`[ablate-artifact] journal: ${out}\n`);
  }
  process.exit(rejected ? 1 : 0);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write(
      `${JSON.stringify(
        {
          usage:
            'node scripts/harness/eval/ablate-artifact.mjs [--list | --self-test | --target <path> --relevant-tasks <id,id,...> --agent "<cmd>"] [--json]',
          note: "--relevant-tasks is required for a real run -- it is the applicability gate, not optional metadata.",
        },
        null,
        2,
      )}\n`,
    );
    return;
  }

  if (flags.list) {
    const tasks = loadTasks(tasksDir);
    process.stdout.write(
      `${JSON.stringify({ count: tasks.length, tasks: tasks.map((t) => ({ id: t.id, kind: t.kind, description: t.description })) }, null, 2)}\n`,
    );
    return;
  }

  const relevantTasks = typeof flags["relevant-tasks"] === "string"
    ? flags["relevant-tasks"].split(",").map((s) => s.trim()).filter(Boolean)
    : null;

  if (flags["self-test"]) {
    await runSelfTest({ json: Boolean(flags.json), relevantTasks });
    return;
  }

  if (!flags.target) fail('missing --target <path>. See --help.');
  if (!relevantTasks || relevantTasks.length === 0) {
    fail(
      "missing --relevant-tasks <id,id,...>. This is the applicability gate: a zero-delta result " +
        "against tasks that don't exercise the artifact's domain is not evidence it's safe to trim. " +
        "Run --list to see task ids, and name only the ones this artifact plausibly affects.",
    );
  }

  const agentCmd = typeof flags.agent === "string" ? flags.agent : process.env.HARNESS_AGENT_CMD;
  if (!agentCmd) fail('no agent provided. Use --agent "<cmd>" or set HARNESS_AGENT_CMD. See --help.');

  await runAblation({ target: flags.target, relevantTasks, agentCmd, json: Boolean(flags.json) });
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error), 2));
