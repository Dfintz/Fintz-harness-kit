#!/usr/bin/env node
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const flags = {
    required: false,
    command: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--required") {
      flags.required = true;
    } else if (arg === "--command") {
      flags.command = argv[i + 1] ?? null;
      i += 1;
    }
  }
  return flags;
}

function fail(message, code = 1) {
  process.stderr.write(`[lurkr] ${message}\n`);
  process.exit(code);
}

function shellCommandFromFlags(flags) {
  if (typeof flags.command === "string" && flags.command.trim().length > 0) {
    return flags.command.trim();
  }
  const envCommand = process.env.HARNESS_LURKR_COMMAND;
  if (typeof envCommand === "string" && envCommand.trim().length > 0) {
    return envCommand.trim();
  }
  return null;
}

function parseCommandLine(commandLine) {
  const tokens = String(commandLine ?? "")
    .trim()
    .match(/(?:"[^"]*"|'[^']*'|[^\s]+)/g);
  if (!tokens || tokens.length === 0) {
    return null;
  }
  const normalized = tokens.map((token) => token.replace(/^['"]|['"]$/g, ""));
  const executable = normalized[0];
  const args = normalized.slice(1);
  if (!executable || executable.trim().length === 0) {
    return null;
  }
  return { executable, args };
}

function isSafeToken(token) {
  return /^[A-Za-z0-9_./:@-]+$/.test(token);
}

function assertSafeCommand(parsed) {
  const tokens = [parsed.executable, ...parsed.args];
  for (const token of tokens) {
    if (!isSafeToken(token)) {
      throw new Error(
        `unsafe token in configured command: ${JSON.stringify(token)}. Use plain executable/args only.`,
      );
    }
  }
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

  const child = spawnSync(parsed.executable, parsed.args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

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
