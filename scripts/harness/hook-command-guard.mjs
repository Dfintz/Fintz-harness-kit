const POSIX_SINGLE_QUOTE_ESCAPE = String.raw`'\''`;
const CMD_DOUBLE_QUOTE_ESCAPE = String.raw`\"`;

function requireArgs(args) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) {
    throw new TypeError("command arguments must be an array of strings");
  }
}

function quotePosix(value) {
  return `'${value.replaceAll("'", POSIX_SINGLE_QUOTE_ESCAPE)}'`;
}

function quoteCmd(value) {
  return `"${value.replaceAll("%", "%%").replaceAll('"', CMD_DOUBLE_QUOTE_ESCAPE)}"`;
}

function quotePowerShell(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

export function renderHookCommand(platform, args) {
  requireArgs(args);
  let quote = null;
  if (platform === "posix") quote = quotePosix;
  else if (platform === "cmd") quote = quoteCmd;
  else if (platform === "powershell") quote = quotePowerShell;
  if (!quote) throw new RangeError(`unsupported hook command platform: ${platform}`);
  return args.map(quote).join(" ");
}

function parseCliArgs(argv) {
  const args = argv.slice(2);
  const platformIndex = args.indexOf("--platform");
  const argValues = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--arg") {
      argValues.push(args[i + 1] ?? "");
      i += 1;
    }
  }

  if (platformIndex < 0 || !args[platformIndex + 1]) {
    throw new TypeError("usage: hook-command-guard --platform posix|cmd|powershell --arg <token> [--arg <token> ...]");
  }
  if (argValues.length === 0) {
    throw new TypeError("at least one --arg token is required");
  }

  return { platform: args[platformIndex + 1], args: argValues };
}

if (process.argv[1]?.endsWith("hook-command-guard.mjs")) {
  try {
    const parsed = parseCliArgs(process.argv);
    process.stdout.write(`${renderHookCommand(parsed.platform, parsed.args)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[hook-command-guard] ${message}\n`);
    process.exit(2);
  }
}
