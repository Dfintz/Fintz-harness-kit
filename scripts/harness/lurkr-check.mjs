#!/usr/bin/env node
import {
  assertSafeCommand,
  parseArgs,
  parseCommandLine,
  runScanner,
  shellCommandFromFlags,
} from "./lurkr-core.mjs";

function fail(message, code = 1) {
  process.stderr.write(`[lurkr] ${message}\n`);
  process.exit(code);
}

function run() {
  const flags = parseArgs(process.argv.slice(2));
  const shellCommand = shellCommandFromFlags(flags);

  if (!shellCommand) {
    const hint =
      "Set HARNESS_LURKR_COMMAND or pass --command. Example: HARNESS_LURKR_COMMAND=\"npx lurkr scan .\"";
    if (flags.required) {
      fail(`required mode: no command configured. ${hint}`);
    }
    process.stdout.write(`[lurkr] skipped: no command configured. ${hint}\n`);
    return;
  }

  const parsed = parseCommandLine(shellCommand);
  if (!parsed) {
    const message = "configured command is empty after parsing.";
    if (flags.required) {
      fail(message);
    }
    process.stdout.write(`[lurkr] skipped: ${message}\n`);
    return;
  }
  assertSafeCommand(parsed);

  const child = runScanner(parsed);

  if (typeof child.stdout === "string" && child.stdout.trim().length > 0) {
    process.stdout.write(child.stdout);
    if (!child.stdout.endsWith("\n")) process.stdout.write("\n");
  }
  if (typeof child.stderr === "string" && child.stderr.trim().length > 0) {
    process.stderr.write(child.stderr);
    if (!child.stderr.endsWith("\n")) process.stderr.write("\n");
  }

  if (child.status !== 0) {
    const message = `scanner command failed with exit code ${child.status ?? "unknown"}.`;
    if (flags.required) {
      fail(message, child.status ?? 1);
    }
    process.stdout.write(`[lurkr] warning: ${message}\n`);
    process.exit(0);
  }
}

try {
  run();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
