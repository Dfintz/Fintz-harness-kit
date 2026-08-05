import { spawnSync } from "node:child_process";
import { basename, dirname, join } from "node:path";

export function parseArgs(argv) {
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

export function shellCommandFromFlags(flags) {
  if (typeof flags.command === "string" && flags.command.trim().length > 0) {
    return flags.command.trim();
  }
  const envCommand = process.env.HARNESS_LURKR_COMMAND;
  if (typeof envCommand === "string" && envCommand.trim().length > 0) {
    return envCommand.trim();
  }
  return null;
}

export function parseCommandLine(commandLine) {
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

export function assertSafeCommand(parsed) {
  const tokens = [parsed.executable, ...parsed.args];
  for (const token of tokens) {
    if (!isSafeToken(token)) {
      throw new Error(
        `unsafe token in configured command: ${JSON.stringify(token)}. Use plain executable/args only.`,
      );
    }
  }
}

function resolveWindowsExecutable(executable) {
  if (process.platform !== "win32") return executable;
  if (/[\\/]/.test(executable)) return executable;

  const candidates = [`${executable}.cmd`, `${executable}.exe`, `${executable}.bat`, executable];
  for (const candidate of candidates) {
    const probe = spawnSync("where", [candidate], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (probe.status === 0 && typeof probe.stdout === "string") {
      const first = probe.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.length > 0);
      if (first) return first;
    }
  }

  return executable;
}

function toNpmExecInvocation(parsed) {
  const name = basename(parsed.executable).toLowerCase();
  const isNpx = name === "npx" || name === "npx.cmd" || name === "npx.exe" || name === "npx.bat";
  if (!isNpx) {
    return null;
  }

  const nodeDir = dirname(process.execPath);
  const npmCli = join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js");
  return {
    executable: process.execPath,
    args: [npmCli, "exec", "--", ...parsed.args],
  };
}

export function runScanner(parsed, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const npxRewrite = toNpmExecInvocation(parsed);
  const normalized = npxRewrite ?? {
    executable: resolveWindowsExecutable(parsed.executable),
    args: parsed.args,
  };

  return spawnSync(normalized.executable, normalized.args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
  });
}
