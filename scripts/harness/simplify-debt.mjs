#!/usr/bin/env node
/**
 * Lists `simplify-debt:` markers — inline comments documenting a deliberately
 * minimal/expedient implementation choice (the harness anti-over-engineering
 * doctrine) so deferred shortcuts stay discoverable instead of silently aging.
 * Report-only; always exits 0.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const configPath = path.join(repoRoot, "harness.config.json");

function fail(message, code = 2) {
  process.stderr.write(`[simplify-debt] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { json: false, help: false, selfTest: false };
  for (const arg of argv) {
    if (arg === "--json") args.json = true;
    else if (arg === "--self-test") args.selfTest = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else fail(`unknown option: ${arg}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/harness/simplify-debt.mjs [--json]",
      "",
      "Lists `simplify-debt:` markers across tracked source files.",
      "Convention: `// simplify-debt: <reason>` next to a deliberately minimal",
      "implementation, so the shortcut is discoverable later instead of silent.",
      "--self-test: run deterministic unit-style checks and exit.",
    ].join("\n") + "\n",
  );
}

function loadConfig() {
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`failed to load harness.config.json: ${message}`);
  }
}

function parseGrepLine(line) {
  const match = /^([^:]+):(\d+):(.*)$/.exec(line);
  if (!match) return null;
  const [, file, lineNo, content] = match;
  return { file, line: Number(lineNo), content };
}

function extractMessage(content, marker) {
  const index = content.indexOf(marker);
  if (index === -1) return "";
  return content
    .slice(index + marker.length)
    .trim()
    .replace(/\s*\*\/\s*$/, "")
    .replace(/\s*-->\s*$/, "");
}

function groupRoot(file) {
  if (file.startsWith("backend/")) return "backend";
  if (file.startsWith("frontend/")) return "frontend";
  const packageMatch = /^packages\/([^/]+)\//.exec(file);
  if (packageMatch) return `packages/${packageMatch[1]}`;
  return "other";
}

function runGrep(marker, pathGlobs) {
  // execFileSync (no shell): marker/globs are passed as argv, so there is no shell-escaping to get
  // wrong and no interpolation footgun even if the committed config changes. git interprets the
  // globs as pathspecs directly.
  const args = [
    "grep",
    "-n",
    "-I",
    "--untracked",
    "--fixed-strings",
    "-e",
    marker,
    "--",
    ...pathGlobs,
  ];
  try {
    const output = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
    });
    return { output, skipped: false, reason: null };
  } catch (error) {
    // git grep exits 1 when there are zero matches — not a failure.
    if (error.status === 1 && !error.stderr?.toString().trim()) {
      return { output: "", skipped: false, reason: null };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { output: "", skipped: true, reason: `git grep failed: ${message}` };
  }
}

function expect(name, condition) {
  const ok = Boolean(condition);
  process.stdout.write(`  ${ok ? "OK" : "FAIL"} ${name}\n`);
  return ok;
}

function runSelfTest() {
  process.stdout.write("[simplify-debt] Running 8 self-tests...\n");
  let passed = 0;

  const grepFile = "backend/src/services/fleet/FleetService.ts";
  const grepLine = `${grepFile}:42:  // simplify-debt: linear scan, revisit if fleets exceed 500 ships`;
  const parsed = parseGrepLine(grepLine);
  passed += Number(
    expect("parseGrepLine extracts file", parsed?.file === grepFile),
  );
  passed += Number(
    expect("parseGrepLine extracts line number", parsed?.line === 42),
  );

  passed += Number(
    expect(
      "parseGrepLine rejects malformed input",
      parseGrepLine("not-a-grep-line") === null,
    ),
  );

  const lineComment =
    "  // simplify-debt: linear scan, revisit if fleets exceed 500 ships";
  const message = extractMessage(lineComment, "simplify-debt:");
  passed += Number(
    expect(
      "extractMessage trims leading/trailing whitespace",
      message === "linear scan, revisit if fleets exceed 500 ships",
    ),
  );

  const blockComment =
    "/* simplify-debt: hardcoded limit until config UI exists */";
  const blockMessage = extractMessage(blockComment, "simplify-debt:");
  passed += Number(
    expect(
      "extractMessage strips trailing block-comment close",
      blockMessage === "hardcoded limit until config UI exists",
    ),
  );

  passed += Number(
    expect(
      "extractMessage returns empty string when marker absent",
      extractMessage("no marker here", "simplify-debt:") === "",
    ),
  );

  passed += Number(
    expect(
      "groupRoot classifies backend path",
      groupRoot("backend/src/app.ts") === "backend",
    ),
  );
  passed += Number(
    expect(
      "groupRoot classifies packages path",
      groupRoot("packages/shared-types/src/index.ts") ===
        "packages/shared-types",
    ),
  );

  process.stdout.write(`[simplify-debt] ${passed}/8 self-tests passed\n`);
  return passed === 8 ? 0 : 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) {
    process.exit(runSelfTest());
  }
  if (args.help) {
    printHelp();
    return;
  }

  const config = loadConfig();
  const simplifyDebt = config.simplifyDebt ?? {};
  const marker = String(simplifyDebt.marker ?? "simplify-debt:");
  const pathGlobs = Array.isArray(simplifyDebt.pathGlobs)
    ? simplifyDebt.pathGlobs.map(String)
    : ["*.ts", "*.tsx", "*.js", "*.jsx"];

  const { output, skipped, reason } = runGrep(marker, pathGlobs);

  const items = output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parsed = parseGrepLine(line);
      if (!parsed) return null;
      const message = extractMessage(parsed.content, marker);
      return { ...parsed, message, area: groupRoot(parsed.file) };
    })
    .filter(Boolean);

  const result = { marker, skipped, reason, count: items.length, items };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  if (skipped) {
    process.stdout.write(`[simplify-debt] skipped: ${reason}\n`);
    return;
  }

  process.stdout.write(
    `[simplify-debt] ${items.length} open marker(s) for "${marker}"\n`,
  );
  for (const item of items) {
    process.stdout.write(
      `  - [${item.area}] ${item.file}:${item.line} — ${item.message}\n`,
    );
  }
}

main();
