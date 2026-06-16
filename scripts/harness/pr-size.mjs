#!/usr/bin/env node
/**
 * PR size checker for harness workflows.
 *
 * Reports diff size against configurable suggested/hard thresholds and exempt globs.
 * Default is report-only (exit 0). Use --enforce to fail when hard limit is exceeded.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const configPath = path.join(repoRoot, "harness.config.json");

function fail(message, code = 2) {
  process.stderr.write(`[pr-size] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    enforce: false,
    json: false,
    help: false,
    selfTest: false,
    base: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--enforce") args.enforce = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--self-test") args.selfTest = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--base") args.base = argv[++i] ?? null;
    else fail(`unknown option: ${arg}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write(
    [
      "Usage: node scripts/harness/pr-size.mjs [--enforce] [--json] [--base <git-ref>]",
      "",
      "Default: report-only (always exits 0).",
      "--enforce: exits 1 when hard limit is exceeded.",
      "--base: override base ref from harness.config.json (prSize.baseRef).",
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

function compileGlob(glob) {
  const escaped = glob
    .replaceAll(/[|\\{}()[\]^$+?.]/g, String.raw`\$&`)
    // **/ should match zero or more path segments.
    .replaceAll("**/", "<<<DOUBLE_STAR_SLASH>>>")
    .replaceAll("**", "<<<DOUBLE_STAR>>>")
    .replaceAll("*", "[^/]*")
    .replaceAll("<<<DOUBLE_STAR_SLASH>>>", "(?:.*/)?")
    .replaceAll("<<<DOUBLE_STAR>>>", ".*");
  return new RegExp(`^${escaped}$`);
}

function normalizePath(p) {
  return String(p).replaceAll("\\", "/").replace(/^\.\//, "");
}

function parseNumStat(output) {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      if (parts.length < 3) return null;
      const addedRaw = parts[0];
      const deletedRaw = parts[1];
      const fileRaw = parts.slice(2).join("\t");
      const file = normalizePath(fileRaw);
      const added = /^\d+$/.test(addedRaw) ? Number(addedRaw) : 0;
      const deleted = /^\d+$/.test(deletedRaw) ? Number(deletedRaw) : 0;
      return { file, added, deleted, total: added + deleted };
    })
    .filter(Boolean);
}

function resolveBaseRef(preferredBase) {
  const candidates = [
    preferredBase,
    "origin/main",
    "origin/master",
    "HEAD~1",
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execSync(`git rev-parse --verify ${candidate}`, {
        cwd: repoRoot,
        stdio: "ignore",
      });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function runNumStat(baseRef) {
  if (!baseRef) {
    return { entries: [], skipped: true, reason: "no valid base ref found" };
  }

  let diffOutput = "";
  try {
    diffOutput = execSync(`git diff --numstat ${baseRef}...HEAD`, {
      cwd: repoRoot,
      encoding: "utf8",
    });
  } catch {
    try {
      diffOutput = execSync(`git diff --numstat ${baseRef}..HEAD`, {
        cwd: repoRoot,
        encoding: "utf8",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        entries: [],
        skipped: true,
        reason: `git diff failed: ${message}`,
      };
    }
  }

  return { entries: parseNumStat(diffOutput), skipped: false, reason: null };
}

function classify(total, suggestedLimit, hardLimit) {
  if (total >= hardLimit) return "over-hard";
  if (total >= suggestedLimit) return "over-suggested";
  return "within-suggested";
}

function expect(name, condition) {
  const ok = Boolean(condition);
  process.stdout.write(`  ${ok ? "OK" : "FAIL"} ${name}\n`);
  return ok;
}

function runSelfTest() {
  process.stdout.write("[pr-size] Running 10 self-tests...\n");
  let passed = 0;

  const snapRegex = compileGlob("**/*.snap");
  passed += Number(
    expect("glob **/*.snap matches root file", snapRegex.test("foo.snap")),
  );
  passed += Number(
    expect(
      "glob **/*.snap matches nested file",
      snapRegex.test("a/b/foo.snap"),
    ),
  );

  const distRegex = compileGlob("**/dist/**");
  passed += Number(
    expect("glob **/dist/** matches root dist", distRegex.test("dist/main.js")),
  );
  passed += Number(
    expect(
      "glob **/dist/** matches nested dist",
      distRegex.test("frontend/dist/main.js"),
    ),
  );

  const entries = parseNumStat("10\t3\tsrc/a.ts\n-\t-\tbinary.bin\n");
  passed += Number(expect("numstat parses 2 rows", entries.length === 2));
  passed += Number(
    expect("numstat binary row totals to 0", entries[1].total === 0),
  );

  passed += Number(
    expect(
      "classify below suggested",
      classify(100, 500, 900) === "within-suggested",
    ),
  );
  passed += Number(
    expect(
      "classify at suggested",
      classify(500, 500, 900) === "over-suggested",
    ),
  );
  passed += Number(
    expect("classify at hard", classify(900, 500, 900) === "over-hard"),
  );

  const normalizeValue = normalizePath(String.raw`a\b\c.ts`);
  passed += Number(
    expect("normalizePath converts slashes", normalizeValue === "a/b/c.ts"),
  );

  process.stdout.write(`[pr-size] ${passed}/10 self-tests passed\n`);
  return passed === 10 ? 0 : 1;
}

function renderHumanResult({
  result,
  status,
  skipped,
  reason,
  countedTotal,
  suggestedLimit,
  hardLimit,
  exemptedTotal,
  exemptedCount,
  countedCount,
}) {
  process.stdout.write(`[pr-size] status: ${status}\n`);
  if (skipped) {
    process.stdout.write(`[pr-size] skipped: ${reason}\n`);
    return;
  }

  process.stdout.write(
    `[pr-size] counted=${countedTotal} (suggested=${suggestedLimit}, hard=${hardLimit})\n`,
  );
  process.stdout.write(
    `[pr-size] exempted=${exemptedTotal} across ${exemptedCount} files\n`,
  );
  if (countedCount === 0) {
    return;
  }

  process.stdout.write("[pr-size] top counted files:\n");
  for (const entry of result.topCounted) {
    process.stdout.write(
      `  - ${entry.file}: +${entry.added} / -${entry.deleted} (${entry.total})\n`,
    );
  }
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
  const prSize = config.prSize ?? {};
  const suggestedLimit = Number(prSize.suggestedLimit ?? 400);
  const hardLimit = Number(prSize.hardLimit ?? 800);
  const baseRef = resolveBaseRef(args.base ?? prSize.baseRef ?? null);
  const exemptGlobs = Array.isArray(prSize.exemptGlobs)
    ? prSize.exemptGlobs.map(String)
    : [];
  const exemptRegexes = exemptGlobs.map(compileGlob);

  const { entries, skipped, reason } = runNumStat(baseRef);

  const exemptedEntries = entries.filter((entry) =>
    exemptRegexes.some((re) => re.test(entry.file)),
  );
  const countedEntries = entries.filter(
    (entry) => !exemptRegexes.some((re) => re.test(entry.file)),
  );

  const countedTotal = countedEntries.reduce(
    (sum, entry) => sum + entry.total,
    0,
  );
  const exemptedTotal = exemptedEntries.reduce(
    (sum, entry) => sum + entry.total,
    0,
  );
  const status = skipped
    ? "skipped"
    : classify(countedTotal, suggestedLimit, hardLimit);

  const result = {
    status,
    skipped,
    reason,
    enforce: args.enforce,
    baseRef,
    suggestedLimit,
    hardLimit,
    countedTotal,
    exemptedTotal,
    changedFiles: entries.length,
    countedFiles: countedEntries.length,
    exemptedFiles: exemptedEntries.length,
    exemptGlobs,
    topCounted: countedEntries
      .toSorted((a, b) => b.total - a.total)
      .slice(0, 10),
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    renderHumanResult({
      result,
      status,
      skipped,
      reason,
      countedTotal,
      suggestedLimit,
      hardLimit,
      exemptedTotal,
      exemptedCount: exemptedEntries.length,
      countedCount: countedEntries.length,
    });
  }

  if (args.enforce && status === "over-hard") {
    process.exit(1);
  }
}

main();
