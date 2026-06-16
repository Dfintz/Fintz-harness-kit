/**
 * Shared helpers for domain deliverable checks.
 *
 * Domain checks are the non-code equivalent of lint/type/build/test: deterministic, dependency-free
 * scripts that read a written deliverable (a markdown memo, brief, report, runbook, …) and exit 0
 * when it satisfies a structural rule, non-zero when it does not. They are the convergence checks a
 * domain pack's loops run, and the fitness gate `domain-pack.mjs --self-test` exercises.
 *
 * Each check exports a default `run({ file, ...opts }) -> { pass, detail }` so it can be unit
 * self-tested in-process, and ships a CLI wrapper (see runCli) so loops can invoke it by exit code.
 */
import { existsSync, readFileSync } from "node:fs";

/** Read a UTF-8 file or exit(2) with a clear message — mirrors the eval runner's config-error code. */
export function loadFile(path, label = "deliverable") {
  if (!path) {
    process.stderr.write(`[domain-check] no ${label} path given\n`);
    process.exit(2);
  }
  if (!existsSync(path)) {
    process.stderr.write(`[domain-check] ${label} not found: ${path}\n`);
    process.exit(2);
  }
  return readFileSync(path, "utf8");
}

/** Minimal flag parser: positional args in `_`, `--key value` (or boolean `--key`) in flags. */
export function parseCli(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

/** Split a `"A|B|C"` style list flag into trimmed, non-empty entries. */
export function splitList(value) {
  if (typeof value !== "string") return [];
  return value
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lines that are NOT inside a fenced ``` code block, with 1-based line numbers preserved. */
export function nonCodeLines(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) out.push({ n: i + 1, line });
  }
  return out;
}

/** Markdown heading match: returns the trimmed heading text, or null. */
export function headingText(line) {
  const m = /^#{1,6}\s+(.*\S)\s*$/.exec(line);
  return m ? m[1].trim() : null;
}

/**
 * CLI wrapper shared by every check. Handles `--self-test` and `--json`, prints a uniform line, and
 * exits 0 (pass) / 1 (fail) / 2 (usage). `runner` is the check's default export; `selfTest` is an
 * array of { name, opts, expectPass } cases run against temp fixtures the check itself provides.
 */
export function runCli({ runner, selfTest, usage }) {
  const flags = parseCli(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write(`${usage}\n`);
    process.exit(0);
  }
  if (flags["self-test"]) {
    let ok = true;
    for (const c of selfTest()) {
      const res = runner(c.opts);
      const good = res.pass === c.expectPass;
      ok = ok && good;
      process.stdout.write(
        `  ${good ? "PASS" : "FAIL"}  ${c.name}${good ? "" : ` — expected pass=${c.expectPass}, got ${res.pass} (${res.detail})`}\n`,
      );
    }
    process.stdout.write(`[domain-check] self-test ${ok ? "PASSED" : "FAILED"}\n`);
    process.exit(ok ? 0 : 1);
  }
  const file = flags._[0];
  const res = runner({ file, ...flags });
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(res, null, 2)}\n`);
  } else {
    process.stdout.write(`${res.pass ? "PASS" : "FAIL"}  ${res.detail}\n`);
  }
  process.exit(res.pass ? 0 : 1);
}
