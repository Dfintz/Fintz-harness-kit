#!/usr/bin/env node
/**
 * run-experiment-parallel.mjs — worktree-parallel beam experiments (Proposal B).
 *
 * Two parallelism axes over the SAME single-experiment engine (run-experiment.mjs), unchanged:
 *
 *   beam   : node scripts/harness/run-experiment-parallel.mjs <name> --candidates K
 *            K candidate edits per step in K worktrees; keep the single best, apply it back.
 *   fanout : node scripts/harness/run-experiment-parallel.mjs --fanout a,b,c
 *            Different experiments concurrently, each in its own worktree; apply each that improved.
 *
 * Each candidate runs in its OWN git worktree (total isolation — safer than the in-memory snapshot,
 * and it cannot touch the user's uncommitted work). We invoke the WORKTREE'S OWN copy of
 * run-experiment.mjs, because run-experiment derives repoRoot from import.meta.url (NOT cwd) — so the
 * metric command then measures the worktree, not the main tree. Only a winner's DECLARED target
 * files are copied back to the main tree (clean and conflict-free, because experiments are
 * contractually confined to loop.target).
 *
 * Node built-ins only. --self-test exercises the pure winner-selection / improvement logic; the live
 * path needs git + an apply-agent and is not exercised by the self-test.
 *
 * Exit codes: 0 at least one improvement applied, 1 no improvement, 2 configuration error,
 *             3 self-test failure.
 */
import { execFileSync, spawn } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeCliCommand } from "./command-validation.mjs";
import { notifyTransition } from "./notify.mjs";
import { addWorktree, pruneWorktrees, removeWorktree } from "./worktree.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const loopsDir = join(repoRoot, ".github", "harness", "loops");

function fail(message) {
  console.error(`[run-experiment-parallel] ${message}`);
  process.exit(2);
}

// ---------- pure, self-testable logic ----------

export function improvedOver(direction, candidate, baseline) {
  if (!Number.isFinite(candidate) || !Number.isFinite(baseline)) return false;
  return direction === "minimize" ? candidate < baseline : candidate > baseline;
}

export function pickWinner(results, direction) {
  const valid = results.filter((r) => Number.isFinite(r.value));
  if (valid.length === 0) return null;
  return valid.reduce((best, r) => {
    const better =
      direction === "minimize" ? r.value < best.value : r.value > best.value;
    return better ? r : best;
  });
}

// Bounded-concurrency pool over an async worker (dependency-free p-limit).
export async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(concurrency, items.length));
  const runners = Array.from({ length: width }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

// ---------- loop + git helpers ----------

function parseArgs(argv) {
  const args = {
    name: undefined,
    candidates: undefined,
    maxIterations: 1,
    agent: undefined,
    concurrency: undefined,
    fanout: undefined,
    keepWorktrees: false,
    linkNodeModules: true,
    selfTest: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") args.selfTest = true;
    else if (a === "--candidates") args.candidates = Number(argv[++i]);
    else if (a === "--max-iterations") args.maxIterations = Number(argv[++i]);
    else if (a === "--agent") args.agent = argv[++i];
    else if (a === "--concurrency") args.concurrency = Number(argv[++i]);
    else if (a === "--fanout")
      args.fanout = String(argv[++i] ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    else if (a === "--keep-worktrees") args.keepWorktrees = true;
    else if (a === "--no-link-node-modules") args.linkNodeModules = false;
    else if (a.startsWith("--")) fail(`Unknown option: ${a}`);
    else if (args.name) fail(`Unexpected argument: ${a}`);
    else args.name = a;
  }
  return args;
}

function loadLoopDef(name) {
  if (!/^[A-Za-z0-9._-]+$/.test(name))
    fail(`invalid experiment name ${JSON.stringify(name)}`);
  const path = join(loopsDir, `${name}.json`);
  if (!existsSync(path)) fail(`no loop named "${name}" in ${loopsDir}`);
  const loop = JSON.parse(readFileSync(path, "utf8"));
  if (loop.kind !== "experiment")
    fail(`loop "${name}" is kind "${loop.kind}", not "experiment"`);
  if (!Array.isArray(loop.target) || loop.target.length === 0)
    fail(`loop "${name}" needs target[]`);
  if (
    loop.metric?.direction !== "minimize" &&
    loop.metric?.direction !== "maximize"
  ) {
    fail(`loop "${name}" metric.direction must be "minimize" or "maximize"`);
  }
  return loop;
}

function headCommit() {
  return execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  }).trim();
}

function linkNodeModules(worktreePath) {
  const target = join(repoRoot, "node_modules");
  const link = join(worktreePath, "node_modules");
  if (!existsSync(target) || existsSync(link)) return;
  try {
    symlinkSync(
      target,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (err) {
    console.warn(
      `[run-experiment-parallel] could not link node_modules into the worktree: ${err.message}. ` +
        "The metric command may fail; install deps in the worktree or pass --no-link-node-modules.",
    );
  }
}

function resolveTargetsIn(rootDir, patterns) {
  const files = new Set();
  for (const pattern of patterns) {
    try {
      const out = execFileSync("git", ["ls-files", "--", pattern], {
        cwd: rootDir,
        encoding: "utf8",
      }).trim();
      for (const line of out.split(/\r?\n/))
        if (line.trim()) files.add(line.trim());
    } catch {
      // ignore — pattern may match nothing in this worktree
    }
  }
  return [...files];
}

// Copy a worktree's declared target files back into the main tree (the apply-back guarantee).
function applyTargetsFromWorktree(worktreePath, patterns) {
  const files = resolveTargetsIn(worktreePath, patterns);
  const applied = [];
  for (const rel of files) {
    const src = join(worktreePath, rel);
    const dst = join(repoRoot, rel);
    if (existsSync(src)) {
      mkdirSync(dirname(dst), { recursive: true });
      copyFileSync(src, dst);
      applied.push(rel);
    }
  }
  return applied;
}

function findJournalPath(stdout, worktreePath, loopName) {
  const m = /journal:\s*(.+\.json)\s*$/im.exec(stdout ?? "");
  if (m && existsSync(m[1].trim())) return m[1].trim();
  // Fallback: newest <loop>-*.json in the worktree's runs dir.
  const runsDir = join(worktreePath, ".github", "harness", "runs");
  if (!existsSync(runsDir)) return null;
  const candidates = readdirSync(runsDir)
    .filter((f) => f.startsWith(`${loopName}-`) && f.endsWith(".json"))
    .sort();
  return candidates.length ? join(runsDir, candidates.at(-1)) : null;
}

function readMetric(journalPath) {
  try {
    const j = JSON.parse(readFileSync(journalPath, "utf8"));
    return {
      best: j.metric?.best ?? null,
      baseline: j.metric?.baseline ?? null,
    };
  } catch {
    return { best: null, baseline: null };
  }
}

function runExperimentInWorktree(worktreePath, loopName, agentCmd, maxIter) {
  return new Promise((resolvePromise) => {
    // Invoke the WORKTREE'S OWN copy so its repoRoot (import.meta.url-derived) is the worktree.
    const script = join(
      worktreePath,
      "scripts",
      "harness",
      "run-experiment.mjs",
    );
    const childArgs = [script, loopName, "--max-iterations", String(maxIter)];
    if (agentCmd) childArgs.push("--agent", agentCmd);
    const child = spawn(process.execPath, childArgs, { cwd: worktreePath });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) =>
      resolvePromise({ code: null, stdout, stderr: String(err) }),
    );
    child.on("close", (code) => resolvePromise({ code, stdout, stderr }));
  });
}

async function runOneCandidate(
  slug,
  loopName,
  loopDef,
  baseline,
  agentCmd,
  maxIter,
  linkDeps,
) {
  const worktreePath = addWorktree(slug, baseline);
  try {
    if (linkDeps) linkNodeModules(worktreePath);
    const { stdout, stderr, code } = await runExperimentInWorktree(
      worktreePath,
      loopName,
      agentCmd,
      maxIter,
    );
    const journalPath = findJournalPath(stdout, worktreePath, loopName);
    const metric = journalPath
      ? readMetric(journalPath)
      : { best: null, baseline: null };
    if (code !== 0 && !journalPath) {
      console.warn(
        `[run-experiment-parallel] ${slug}: child exited ${code}; ${stderr.slice(-200)}`,
      );
    }
    return {
      slug,
      loop: loopName,
      worktreePath,
      value: Number.isFinite(metric.best) ? metric.best : null,
      baseline: metric.baseline,
      direction: loopDef.metric.direction,
      targets: loopDef.target,
    };
  } catch (err) {
    console.warn(
      `[run-experiment-parallel] ${slug} failed: ${err instanceof Error ? err.message : err}`,
    );
    return {
      slug,
      loop: loopName,
      worktreePath,
      value: null,
      targets: loopDef.target,
    };
  }
}

function cleanupWorktrees(slugs, keep) {
  if (keep) {
    console.log(
      "[run-experiment-parallel] --keep-worktrees set; leaving worktrees in place.",
    );
    return;
  }
  for (const slug of slugs) {
    try {
      removeWorktree(slug);
    } catch {
      // best-effort
    }
  }
  try {
    pruneWorktrees();
  } catch {
    // best-effort
  }
}

async function runBeam(args) {
  const loopDef = loadLoopDef(args.name);
  const k =
    Number.isInteger(args.candidates) && args.candidates > 0
      ? args.candidates
      : (loopDef.candidates ?? 2);
  const baseline = headCommit();
  const slugs = Array.from({ length: k }, (_, i) => `${args.name}-cand-${i}`);
  console.log(
    `[run-experiment-parallel] beam "${args.name}" — ${k} candidate(s) from ${baseline.slice(0, 12)} (direction ${loopDef.metric.direction})`,
  );
  const concurrency = args.concurrency ?? k;
  let exitCode = 1;
  try {
    const results = await runPool(slugs, concurrency, (slug) =>
      runOneCandidate(
        slug,
        args.name,
        loopDef,
        baseline,
        args.agent,
        args.maxIterations,
        args.linkNodeModules,
      ),
    );
    for (const r of results) {
      console.log(
        `  ${r.slug.padEnd(28)} ${r.value === null ? "unmeasurable" : r.value}`,
      );
    }
    const winner = pickWinner(results, loopDef.metric.direction);
    if (
      winner &&
      improvedOver(loopDef.metric.direction, winner.value, winner.baseline)
    ) {
      const applied = applyTargetsFromWorktree(
        winner.worktreePath,
        winner.targets,
      );
      console.log(
        `[run-experiment-parallel] winner ${winner.slug} (${winner.value}) — applied ${applied.length} target file(s) back: ${applied.join(", ")}`,
      );
      exitCode = 0;
    } else {
      console.log(
        "[run-experiment-parallel] no candidate beat the baseline — main tree unchanged.",
      );
    }
    notifyParallel(
      args.name,
      "beam",
      exitCode === 0 ? "converged" : "exhausted",
      winner?.value,
    );
  } finally {
    cleanupWorktrees(slugs, args.keepWorktrees);
  }
  return exitCode;
}

async function runFanout(args) {
  const names = args.fanout;
  const defs = names.map((n) => ({ name: n, def: loadLoopDef(n) }));
  const baseline = headCommit();
  console.log(
    `[run-experiment-parallel] fanout — ${names.length} experiment(s) from ${baseline.slice(0, 12)}: ${names.join(", ")}`,
  );
  const concurrency = args.concurrency ?? names.length;
  const slugs = names.map((n) => `${n}-fanout`);
  let anyApplied = false;
  try {
    const results = await runPool(defs, concurrency, ({ name, def }, idx) =>
      runOneCandidate(
        slugs[idx],
        name,
        def,
        baseline,
        args.agent,
        def.maxIterations ?? args.maxIterations,
        args.linkNodeModules,
      ),
    );
    for (const r of results) {
      const improved = improvedOver(r.direction, r.value, r.baseline);
      if (improved) {
        const applied = applyTargetsFromWorktree(r.worktreePath, r.targets);
        anyApplied = anyApplied || applied.length > 0;
        console.log(
          `  ${r.loop.padEnd(24)} ${r.value} — IMPROVED, applied ${applied.length} file(s)`,
        );
      } else {
        console.log(
          `  ${r.loop.padEnd(24)} ${r.value === null ? "unmeasurable" : r.value} — no improvement`,
        );
      }
    }
    notifyParallel(
      names.join(","),
      "fanout",
      anyApplied ? "converged" : "exhausted",
    );
  } finally {
    cleanupWorktrees(slugs, args.keepWorktrees);
  }
  return anyApplied ? 0 : 1;
}

function notifyParallel(loop, mode, state, metric) {
  try {
    notifyTransition({
      loop: `${loop} (${mode})`,
      kind: "experiment",
      state,
      metric: metric ?? "",
    });
  } catch {
    /* best-effort */
  }
}

// ---------- self-test ----------

function runSelfTest() {
  const checks = [];
  const ok = (name, cond) => checks.push({ name, pass: !!cond });

  ok(
    "pickWinner minimizes",
    pickWinner([{ value: 5 }, { value: 2 }, { value: 9 }], "minimize").value ===
      2,
  );
  ok(
    "pickWinner maximizes",
    pickWinner([{ value: 5 }, { value: 2 }, { value: 9 }], "maximize").value ===
      9,
  );
  ok(
    "pickWinner ignores nulls",
    pickWinner([{ value: null }, { value: 3 }], "minimize").value === 3,
  );
  ok(
    "pickWinner all-null => null",
    pickWinner([{ value: null }, { value: Number.NaN }], "minimize") === null,
  );
  ok("improvedOver minimize true", improvedOver("minimize", 4, 5) === true);
  ok("improvedOver minimize false", improvedOver("minimize", 6, 5) === false);
  ok("improvedOver maximize true", improvedOver("maximize", 6, 5) === true);
  ok(
    "improvedOver guards non-finite",
    improvedOver("minimize", null, 5) === false,
  );

  // runPool preserves order and respects width.
  return (async () => {
    const order = await runPool([10, 20, 30], 2, async (x) => x * 2);
    ok("runPool maps in order", order.join(",") === "20,40,60");
    let active = 0;
    let maxActive = 0;
    await runPool([1, 2, 3, 4, 5], 2, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
    });
    ok("runPool caps concurrency", maxActive <= 2);

    const passed = checks.filter((c) => c.pass).length;
    for (const c of checks) if (!c.pass) console.error(`  ✗ ${c.name}`);
    console.log(
      `[run-experiment-parallel] self-test: ${passed}/${checks.length} passed`,
    );
    return passed === checks.length;
  })();
}

// ---------- main ----------

const args = parseArgs(process.argv.slice(2));

if (args.selfTest) {
  const pass = await runSelfTest();
  process.exit(pass ? 0 : 3);
} else {
  if (args.agent) {
    try {
      assertSafeCliCommand(args.agent, {
        label: "run-experiment-parallel agent command",
      });
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    }
  }
  const run =
    Array.isArray(args.fanout) && args.fanout.length > 0 ? runFanout : runBeam;
  if (run === runBeam && !args.name) {
    fail(
      "usage: run-experiment-parallel.mjs <name> --candidates K | --fanout a,b,c",
    );
  }
  try {
    const code = await run(args);
    process.exit(code);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }
}
