#!/usr/bin/env node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  assertSafeCommand,
  parseArgs,
  parseCommandLine,
  runScanner,
  shellCommandFromFlags,
} from "./lurkr-core.mjs";

function parseDiffArgs(argv) {
  const flags = {
    ...parseArgs(argv),
    base: process.env.HARNESS_LURKR_BASE_REF || "HEAD~1",
    output: ".github/harness/runs/lurkr-diff-report.json",
    keepWorktree: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--base") {
      flags.base = argv[i + 1] ?? flags.base;
      i += 1;
    } else if (arg === "--output") {
      flags.output = argv[i + 1] ?? flags.output;
      i += 1;
    } else if (arg === "--keep-worktree") {
      flags.keepWorktree = true;
    }
  }

  return flags;
}

function fail(message, code = 1) {
  process.stderr.write(`[lurkr-diff] ${message}\n`);
  process.exit(code);
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr || "").trim()}`);
  }
  return (result.stdout || "").trim();
}

function normalizeLines(text) {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => !/^npm error A complete log of this run can be found in:/i.test(line))
    .filter((line) => line.length > 0);
}

function diffLines(baseLines, headLines) {
  const baseCounts = new Map();
  const headCounts = new Map();

  for (const line of baseLines) {
    baseCounts.set(line, (baseCounts.get(line) ?? 0) + 1);
  }
  for (const line of headLines) {
    headCounts.set(line, (headCounts.get(line) ?? 0) + 1);
  }

  const added = [];
  const removed = [];
  const keys = new Set([...baseCounts.keys(), ...headCounts.keys()]);
  for (const key of keys) {
    const baseCount = baseCounts.get(key) ?? 0;
    const headCount = headCounts.get(key) ?? 0;
    if (headCount > baseCount) {
      for (let i = 0; i < headCount - baseCount; i += 1) {
        added.push(key);
      }
    } else if (baseCount > headCount) {
      for (let i = 0; i < baseCount - headCount; i += 1) {
        removed.push(key);
      }
    }
  }

  return { added, removed };
}

function writeReport(outputPath, report) {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function writeSkipReport(outputPath, reason, extras = {}) {
  writeReport(outputPath, {
    generatedAt: new Date().toISOString(),
    status: "skipped",
    reason,
    outputPath,
    checklist: {
      policy: "evidence-only",
      items: [
        {
          id: "diff-report-generated",
          status: "fail",
          evidence: { outputPath },
          note: "No differential report was generated because the scanner command was not runnable.",
        },
      ],
    },
    ...extras,
  });
  process.stdout.write(`[lurkr-diff] wrote report: ${outputPath}\n`);
}

function buildEvidenceChecklist(context) {
  const {
    outputPath,
    command,
    refs,
    scans,
    drift,
    status,
    reason,
  } = context;
  const baseSucceeded = scans.base.exitCode === 0 && scans.base.spawnError === null;
  const headSucceeded = scans.head.exitCode === 0 && scans.head.spawnError === null;

  return {
    policy: "evidence-only",
    items: [
      {
        id: "diff-report-generated",
        status: status === "ok" ? "pass" : "fail",
        evidence: {
          outputPath,
          baseResolved: refs.baseResolved,
          headResolved: refs.headResolved,
        },
        note:
          status === "ok"
            ? "Before/after report exists and can be attached to review artifacts."
            : `Report generation failed: ${reason ?? "unknown"}`,
      },
      {
        id: "scanner-command-recorded",
        status: command ? "pass" : "fail",
        evidence: { command },
        note: "Record the exact scanner command used for repeatability.",
      },
      {
        id: "base-and-head-scans-recorded",
        status: baseSucceeded && headSucceeded ? "pass" : "warn",
        evidence: {
          baseExitCode: scans.base.exitCode,
          headExitCode: scans.head.exitCode,
          baseSpawnError: scans.base.spawnError,
          headSpawnError: scans.head.spawnError,
        },
        note:
          baseSucceeded && headSucceeded
            ? "Both snapshot scans completed cleanly."
            : "One or both snapshot scans were non-zero or errored; inspect report before adjudicating drift.",
      },
      {
        id: "drift-summary-captured",
        status: "pass",
        evidence: {
          addedCount: drift.addedCount,
          removedCount: drift.removedCount,
        },
        note: "Added/removed finding counts captured for differential security review.",
      },
    ],
  };
}

function runDiffScans(repoRoot, flags, parsed) {
  const baseRef = runGit(["rev-parse", flags.base], repoRoot);
  const headRef = runGit(["rev-parse", "HEAD"], repoRoot);
  const tempWorktree = mkdtempSync(join(tmpdir(), "lurkr-base-"));

  runGit(["worktree", "add", "--detach", tempWorktree, baseRef], repoRoot);

  const baseScan = runScanner(parsed, { cwd: tempWorktree });
  const headScan = runScanner(parsed, { cwd: repoRoot });

  return {
    baseRef,
    headRef,
    tempWorktree,
    baseScan,
    headScan,
  };
}

function buildDiffReport(context) {
  const {
    shellCommand,
    flags,
    repoRoot,
    tempWorktree,
    baseRef,
    headRef,
    baseScan,
    headScan,
  } = context;
  const baseOutput = `${baseScan.stdout ?? ""}${baseScan.stderr ?? ""}`;
  const headOutput = `${headScan.stdout ?? ""}${headScan.stderr ?? ""}`;
  const baseLines = normalizeLines(baseOutput);
  const headLines = normalizeLines(headOutput);
  const drift = diffLines(baseLines, headLines);

  const report = {
    generatedAt: new Date().toISOString(),
    command: shellCommand,
    refs: {
      baseInput: flags.base,
      baseResolved: baseRef,
      headResolved: headRef,
    },
    scans: {
      base: {
        exitCode: baseScan.status ?? null,
        spawnError: baseScan.error ? String(baseScan.error.message ?? baseScan.error) : null,
        lineCount: baseLines.length,
        cwd: tempWorktree,
      },
      head: {
        exitCode: headScan.status ?? null,
        spawnError: headScan.error ? String(headScan.error.message ?? headScan.error) : null,
        lineCount: headLines.length,
        cwd: repoRoot,
      },
    },
    drift: {
      addedCount: drift.added.length,
      removedCount: drift.removed.length,
      added: drift.added,
      removed: drift.removed,
    },
    notes: [
      "Diff is line-based over scanner stdout/stderr and is deterministic for stable scanner output.",
      "Use this report as an evidence artifact for pre/post security drift in review stages.",
    ],
  };

  report.checklist = buildEvidenceChecklist({
    outputPath: resolve(repoRoot, flags.output),
    command: shellCommand,
    refs: report.refs,
    scans: report.scans,
    drift: report.drift,
    status: "ok",
  });

  return report;
}

function resolveScanner(flags, outputPath) {
  const shellCommand = shellCommandFromFlags(flags);
  if (!shellCommand) {
    const hint =
      "Set HARNESS_LURKR_COMMAND or pass --command. Example: HARNESS_LURKR_COMMAND=\"npx lurkr scan .\"";
    if (flags.required) {
      fail(`required mode: no command configured. ${hint}`);
    }
    writeSkipReport(outputPath, "no-command-configured", { hint });
    process.stdout.write(`[lurkr-diff] skipped: no command configured. ${hint}\n`);
    return null;
  }

  const parsed = parseCommandLine(shellCommand);
  if (!parsed) {
    const message = "configured command is empty after parsing.";
    if (flags.required) {
      fail(message);
    }
    writeSkipReport(outputPath, "empty-command-after-parse", {
      command: shellCommand,
    });
    process.stdout.write(`[lurkr-diff] skipped: ${message}\n`);
    return null;
  }

  assertSafeCommand(parsed);
  return { shellCommand, parsed };
}

function main() {
  const flags = parseDiffArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const outputPath = resolve(repoRoot, flags.output);
  const scanner = resolveScanner(flags, outputPath);
  if (!scanner) {
    return;
  }

  let tempWorktree = null;
  let baseScan = null;
  let headScan = null;
  try {
    const scanResult = runDiffScans(repoRoot, flags, scanner.parsed);
    tempWorktree = scanResult.tempWorktree;
    baseScan = scanResult.baseScan;
    headScan = scanResult.headScan;

    const report = buildDiffReport({
      shellCommand: scanner.shellCommand,
      flags,
      repoRoot,
      tempWorktree,
      baseRef: scanResult.baseRef,
      headRef: scanResult.headRef,
      baseScan,
      headScan,
    });

    writeReport(outputPath, report);
    process.stdout.write(`[lurkr-diff] wrote report: ${outputPath}\n`);

    const nonZeroExit = (baseScan?.status ?? 1) !== 0 || (headScan?.status ?? 1) !== 0;
    if (nonZeroExit) {
      const message =
        "scanner command returned non-zero for base or head snapshot; see report for exit codes.";
      if (flags.required) {
        fail(message);
      }
      process.stdout.write(`[lurkr-diff] warning: ${message}\n`);
    }
  } finally {
    if (tempWorktree) {
      try {
        runGit(["worktree", "remove", "--force", tempWorktree], repoRoot);
      } catch {
        if (!flags.keepWorktree) {
          process.stderr.write(
            `[lurkr-diff] warning: failed to remove worktree ${tempWorktree}; cleanup may be required.\n`,
          );
        }
      }
      if (!flags.keepWorktree) {
        rmSync(tempWorktree, { recursive: true, force: true });
      }
    }
  }
}

try {
  main();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
