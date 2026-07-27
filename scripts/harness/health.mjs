#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const npmExecPath =
  typeof process.env.npm_execpath === "string" &&
  process.env.npm_execpath.trim().length > 0
    ? process.env.npm_execpath.trim()
    : null;

function parseArgs(argv) {
  const flags = {
    fast: false,
    json: false,
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--fast") {
      flags.fast = true;
      continue;
    }
    if (arg === "--json") {
      flags.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return flags;
}

function buildChecks(fastMode) {
  const checks = [
    {
      id: "docs-contracts",
      label: "Docs contracts",
      required: true,
      script: "harness:docs:check",
      args: [],
    },
    {
      id: "config-self-test",
      label: "Config self-test",
      required: true,
      script: "harness:config:self-test",
      args: [],
    },
  ];

  if (!fastMode) {
    checks.push({
      id: "graph-status",
      label: "Graph status",
      required: false,
      script: "harness:graph",
      args: ["status"],
    });
  }

  return checks;
}

function runScriptCheck(check) {
  const npmArgs = ["run", check.script];
  if (check.args.length > 0) {
    npmArgs.push("--", ...check.args);
  }

  const executable = npmExecPath ? process.execPath : npmExecutable;
  const args = npmExecPath ? [npmExecPath, ...npmArgs] : npmArgs;

  const result = spawnSync(executable, args, {
    cwd: repoRoot,
    encoding: "utf8",
    shell: process.platform === "win32" && !npmExecPath,
  });

  const statusCode = Number.isInteger(result.status) ? result.status : 1;
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const spawnError =
    result.error instanceof Error ? result.error.message : null;
  const argSuffix = check.args.length > 0 ? ` -- ${check.args.join(" ")}` : "";
  const command = `npm run ${check.script}${argSuffix}`;

  return {
    id: check.id,
    label: check.label,
    required: check.required,
    ok: statusCode === 0,
    statusCode,
    command,
    stdout,
    stderr,
    spawnError,
  };
}

function firstNonEmptyLine(text) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "";
}

function summarizeResult(result) {
  if (result.spawnError) return `spawn error: ${result.spawnError}`;
  const primary = firstNonEmptyLine(result.stderr) || firstNonEmptyLine(result.stdout);
  if (primary) return primary;
  return result.ok ? "ok" : `exit code ${result.statusCode}`;
}

function computeOverall(results) {
  const requiredFailures = results.filter((item) => item.required && !item.ok);
  const warnings = results.filter((item) => !item.required && !item.ok);
  return {
    ok: requiredFailures.length === 0,
    requiredFailures,
    warnings,
  };
}

function printUsage() {
  const usage = {
    usage: [
      "node scripts/harness/health.mjs",
      "node scripts/harness/health.mjs --fast",
      "node scripts/harness/health.mjs --json",
      "node scripts/harness/health.mjs --fast --json",
    ],
    checks: {
      fast: ["harness:docs:check", "harness:config:self-test"],
      default: [
        "harness:docs:check",
        "harness:config:self-test",
        "harness:graph -- status (warning-only)",
      ],
    },
    exitRule: "non-zero only when required checks fail",
  };
  process.stdout.write(`${JSON.stringify(usage, null, 2)}\n`);
}

function printTextReport(results, overall, flags) {
  process.stdout.write(`Harness health (${flags.fast ? "fast" : "default"}): ${overall.ok ? "PASS" : "FAIL"}\n`);

  for (const result of results) {
    let level = "WARN";
    if (result.ok) {
      level = "PASS";
    } else if (result.required) {
      level = "FAIL";
    }
    const requirement = result.required ? "required" : "warning";
    process.stdout.write(`- [${level}] ${result.label} (${requirement})\n`);
    process.stdout.write(`  command: ${result.command}\n`);
    process.stdout.write(`  detail: ${summarizeResult(result)}\n`);
  }

  if (overall.requiredFailures.length > 0) {
    const names = overall.requiredFailures.map((item) => item.id).join(", ");
    process.stdout.write(`Required check failures: ${names}\n`);
  }

  if (overall.warnings.length > 0) {
    const names = overall.warnings.map((item) => item.id).join(", ");
    process.stdout.write(`Warning checks: ${names}\n`);
  }
}

function printJsonReport(results, overall, flags) {
  const payload = {
    ok: overall.ok,
    mode: flags.fast ? "fast" : "default",
    exitRule: "non-zero only when required checks fail",
    summary: {
      total: results.length,
      requiredFailures: overall.requiredFailures.length,
      warnings: overall.warnings.length,
    },
    checks: results.map((result) => ({
      id: result.id,
      label: result.label,
      required: result.required,
      ok: result.ok,
      statusCode: result.statusCode,
      command: result.command,
      detail: summarizeResult(result),
      stdout: result.stdout,
      stderr: result.stderr,
      spawnError: result.spawnError,
    })),
  };

  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printUsage();
    process.exit(0);
  }

  const checks = buildChecks(flags.fast);
  const results = checks.map(runScriptCheck);
  const overall = computeOverall(results);

  if (flags.json) {
    printJsonReport(results, overall, flags);
  } else {
    printTextReport(results, overall, flags);
  }

  process.exit(overall.ok ? 0 : 1);
}

try {
  main();
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2)}\n`,
  );
  process.exit(2);
}
