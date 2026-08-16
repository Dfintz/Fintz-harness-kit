#!/usr/bin/env node
// Attribution & adaptations: see CREDITS.md. Eval harness per the self-improving-harness Brief
// (.github/harness/memory/briefs/). The fitness function for measured, reversible self-improvement.
/**
 * Harness eval runner — the fitness function.
 *
 * Scores whether the harness actually helps an agent, with DETERMINISTIC verifiers (code, not model
 * judgment) so prompt injection cannot fake a pass. Two modes:
 *
 *   --self-test         Validate the suite itself, no agent: for each task, the verifier must FAIL
 *                       on the unsolved fixture and PASS on the solved overlay; the dangerous-diff
 *                       control must stay quiet on a benign probe and FIRE on a malicious one.
 *                       Also prints the suite hash. This is what you run to trust the suite.
 *
 *   --agent "<cmd>"     Real run: per task, run the agent WITHOUT harness context (baseline) and
 *                       WITH it (harness), verify each, scan changed CODE files with dangerous-diff,
 *                       and journal baseline-vs-harness deltas to .github/harness/runs/eval-*.json.
 *
 * Security invariants (see the Brief's threat model):
 *   - A run is REJECTED if dangerous-diff flags any candidate change, regardless of score.
 *   - The recorded suiteHash lets the evolve loop detect tampering with tasks/verifiers.
 *
 * Exit codes: 0 ok / self-test passed, 1 self-test failed or run rejected, 2 config error.
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  copyInto,
  makeSandbox,
  readIfExists,
  removeSandbox,
} from "./lib/sandbox.mjs";
import { computeSuiteHash, loadTasks, loadVerifier, scanDanger, selfTestTasks } from "./lib/tasks.mjs";
import dangerousDiff from "./verifiers/dangerous-diff.mjs";

const evalDir = resolve(dirname(fileURLToPath(import.meta.url)));
const repoRoot = resolve(evalDir, "..", "..", "..");
const tasksDir = join(evalDir, "tasks");
const verifiersDir = join(evalDir, "verifiers");
const probesDir = join(evalDir, "probes");
const runsDir = join(repoRoot, ".github", "harness", "runs");

function fail(message, code = 2) {
  process.stderr.write(`[run-eval] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      flags._.push(a);
      continue;
    }
    if (
      a === "--self-test" ||
      a === "--list" ||
      a === "--json" ||
      a === "--help"
    ) {
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

async function runSelfTest({ json }) {
  const tasks = loadTasks(tasksDir);
  const checks = await selfTestTasks(tasks, verifiersDir);

  // Security control must stay quiet on benign and FIRE on malicious.
  const benign = dangerousDiff({
    files: [
      {
        path: "benign.js",
        content: readIfExists(join(probesDir, "benign.js")) || "",
      },
    ],
  });
  checks.push({
    name: "dangerous-diff quiet on benign probe",
    ok: benign.flagged === false,
    detail: benign.detail,
  });
  const malicious = dangerousDiff({
    files: [
      {
        path: "malicious.js",
        content: readIfExists(join(probesDir, "malicious.js")) || "",
      },
    ],
  });
  checks.push({
    name: "dangerous-diff fires on malicious probe",
    ok: malicious.flagged === true,
    detail: malicious.detail,
  });

  const passed = checks.every((c) => c.ok);
  const suiteHash = computeSuiteHash(tasksDir, verifiersDir);
  const result = {
    ok: passed,
    mode: "self-test",
    suiteHash,
    taskCount: tasks.length,
    checks,
  };

  if (json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`[run-eval] self-test — ${tasks.length} task(s)\n`);
    for (const c of checks) {
      process.stdout.write(
        `  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : ` — ${c.detail}`}\n`,
      );
    }
    process.stdout.write(`  suiteHash ${suiteHash}\n`);
    process.stdout.write(
      `[run-eval] ${passed ? "self-test PASSED" : "self-test FAILED"}\n`,
    );
  }
  process.exit(passed ? 0 : 1);
}

// Run an agent command against a prepared sandbox. The task prompt is piped on stdin; when
// withHarness, the harness contract files are referenced so the agent can load them. If an
// evolvable candidate-instructions file exists, its content is included in the harness arm — this
// is what closes the meta-loop: harness-evolve edits that file, and the eval score reflects it.
function invokeAgent(agentCmd, task, sandbox, withHarness) {
  let harnessNote = "";
  if (withHarness) {
    harnessNote =
      "\n\n(Harness context: load skills/harness/SKILL.md and .github/harness/HARNESS.md for the " +
      "stage machine, gates, and guardrails before acting.)";
    const candidatePath = join(
      repoRoot,
      ".github",
      "harness",
      "evolve",
      "candidate-instructions.md",
    );
    if (existsSync(candidatePath)) {
      harnessNote += `\n\n## Harness guidance\n${readFileSync(candidatePath, "utf8")}`;
    }
  }
  const prompt = `${task.prompt}${harnessNote}`;
  const metricsFile = join(sandbox, ".harness-eval-metrics.jsonl");
  const startedAt = Date.now();
  const result = spawnSync(agentCmd, {
    cwd: sandbox,
    shell: true,
    input: prompt,
    stdio: ["pipe", "inherit", "inherit"],
    env: {
      ...process.env,
      HARNESS_EVAL_SANDBOX: sandbox,
      HARNESS_EVAL_METRICS_FILE: metricsFile,
    },
  });
  let usage = null;
  if (existsSync(metricsFile)) {
    const lines = readFileSync(metricsFile, "utf8").trim().split(/\r?\n/).filter(Boolean);
    if (lines.length > 0) usage = JSON.parse(lines.at(-1));
    unlinkSync(metricsFile);
  }
  return { status: result.status ?? 1, durationMs: Date.now() - startedAt, usage };
}

async function runWithAgent({ agentCmd, json }) {
  const tasks = loadTasks(tasksDir);
  const startedAt = new Date().toISOString();
  const records = [];
  let dangerousFlagged = 0;

  for (const task of tasks) {
    const verifier = await loadVerifier(verifiersDir, task.verifier);
    const reviewArtifact = task.expected?.file ? [task.expected.file] : [];

    // Baseline — no harness context.
    const baseSandbox = makeSandbox();
    let baseline;
    try {
      copyInto(join(task.dir, "workdir"), baseSandbox);
      const baselineRun = invokeAgent(agentCmd, task, baseSandbox, false);
      baseline = verifier({ workdir: baseSandbox, task });
      baseline.run = baselineRun;
    } finally {
      removeSandbox(baseSandbox);
    }

    // Harness — with harness context.
    const harnessSandbox = makeSandbox();
    let harness;
    let danger;
    try {
      copyInto(join(task.dir, "workdir"), harnessSandbox);
      const harnessRun = invokeAgent(agentCmd, task, harnessSandbox, true);
      harness = verifier({ workdir: harnessSandbox, task });
      harness.run = harnessRun;
      danger = scanDanger(harnessSandbox, join(task.dir, "workdir"), {
        excludeFiles: reviewArtifact,
      });
    } finally {
      removeSandbox(harnessSandbox);
    }
    if (danger.flagged) dangerousFlagged += danger.matches.length;

    records.push({
      id: task.id,
      kind: task.kind,
      baseline: {
        pass: baseline.pass,
        score: baseline.score,
        detail: baseline.detail,
        durationMs: baseline.run.durationMs,
        usage: baseline.run.usage,
      },
      harness: {
        pass: harness.pass,
        score: harness.score,
        detail: harness.detail,
        durationMs: harness.run.durationMs,
        usage: harness.run.usage,
      },
      dangerous: { flagged: danger.flagged, matches: danger.matches },
    });
  }

  const n = records.length || 1;
  const baselineScore = records.reduce((s, r) => s + r.baseline.score, 0) / n;
  const harnessScore = records.reduce((s, r) => s + r.harness.score, 0) / n;
  const sum = (arm, field) => records.reduce((total, record) => {
    const value = record[arm]?.[field];
    return total + (Number.isFinite(value) ? value : 0);
  }, 0);
  const sumTokens = (arm, field) => {
    const values = records
      .map(record => record[arm]?.usage?.[field])
      .filter(value => Number.isFinite(value));
    return values.length === records.length ? values.reduce((total, value) => total + value, 0) : null;
  };
  const rejected = dangerousFlagged > 0;
  const journal = {
    kind: "eval",
    startedAt,
    finishedAt: new Date().toISOString(),
    agent: agentCmd,
    suiteHash: computeSuiteHash(tasksDir, verifiersDir),
    verdict: rejected ? "rejected" : "ok",
    tasks: records,
    aggregate: {
      baselineScore: Number(baselineScore.toFixed(4)),
      harnessScore: Number(harnessScore.toFixed(4)),
      delta: Number((harnessScore - baselineScore).toFixed(4)),
      baselineDurationMs: sum("baseline", "durationMs"),
      harnessDurationMs: sum("harness", "durationMs"),
      durationDeltaMs: sum("harness", "durationMs") - sum("baseline", "durationMs"),
      baselinePromptTokens: sumTokens("baseline", "promptTokens"),
      harnessPromptTokens: sumTokens("harness", "promptTokens"),
      baselineCompletionTokens: sumTokens("baseline", "completionTokens"),
      harnessCompletionTokens: sumTokens("harness", "completionTokens"),
      baselineTotalTokens: sumTokens("baseline", "totalTokens"),
      harnessTotalTokens: sumTokens("harness", "totalTokens"),
      dangerousFlagged,
    },
  };

  mkdirSync(runsDir, { recursive: true });
  const out = join(runsDir, `eval-${startedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(out, JSON.stringify(journal, null, 2));

  if (json) {
    process.stdout.write(`${JSON.stringify(journal, null, 2)}\n`);
  } else {
    process.stdout.write(
      `[run-eval] baseline ${journal.aggregate.baselineScore} → harness ${journal.aggregate.harnessScore} (Δ ${journal.aggregate.delta})\n`,
    );
    if (rejected)
      process.stdout.write(
        `[run-eval] REJECTED — dangerous-diff flagged ${dangerousFlagged} risk(s)\n`,
      );
    process.stdout.write(`[run-eval] journal: ${out}\n`);
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
            'node scripts/harness/eval/run-eval.mjs [--self-test | --agent "<cmd>"] [--json]',
          modes: {
            "--self-test":
              "validate the suite deterministically (no agent); also prints suiteHash",
            '--agent "<cmd>"':
              "baseline-vs-harness run of an agent; journals to .github/harness/runs/",
            "--list": "list tasks",
          },
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

  if (flags["self-test"]) {
    await runSelfTest({ json: Boolean(flags.json) });
    return;
  }

  const agentCmd =
    typeof flags.agent === "string"
      ? flags.agent
      : process.env.HARNESS_AGENT_CMD;
  if (!agentCmd) {
    fail(
      'no mode selected. Use --self-test (no agent) or --agent "<cmd>". See --help.',
      2,
    );
  }
  await runWithAgent({ agentCmd, json: Boolean(flags.json) });
}

main().catch((error) =>
  fail(error instanceof Error ? error.message : String(error), 2),
);
