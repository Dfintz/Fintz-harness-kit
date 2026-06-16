#!/usr/bin/env node
/**
 * domain-pack — discover, inspect, run, and validate the harness's domain/industry packs.
 *
 * A domain pack adapts the (unchanged) harness engine to a non-software knowledge domain: it relabels
 * the stage machine, swaps in a domain gate set, and points the convergence checks at deterministic
 * "deliverable checks" (scripts/harness/domain-checks/*) instead of lint/type/build/test. Packs live
 * under .github/harness/domains/<name>/ and are described by a pack.json (schema: pack.schema.json).
 *
 * Usage:
 *   node scripts/harness/domain-pack.mjs --list
 *   node scripts/harness/domain-pack.mjs show <pack>
 *   node scripts/harness/domain-pack.mjs check <pack> [--deliverable <file>]
 *   node scripts/harness/domain-pack.mjs activate <pack>          # copy loops + config preset into place
 *   node scripts/harness/domain-pack.mjs --self-test              # validate every pack (fitness gate)
 *
 * --self-test is the domain-layer analogue of `run-eval --self-test`: for every pack, each "good"
 * sample must pass ALL the pack's checks and each "broken" sample must FAIL at least one. This proves
 * the checks discriminate and the samples are real, so a pack can be trusted before it ships.
 *
 * Exit codes: 0 ok / self-test passed, 1 check failure / self-test failed, 2 usage or config error.
 */
import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const domainsDir = join(repoRoot, ".github", "harness", "domains");
const loopsDir = join(repoRoot, ".github", "harness", "loops");
const configPath = join(repoRoot, "harness.config.json");

function fail(message, code = 2) {
  process.stderr.write(`[domain-pack] ${message}\n`);
  process.exit(code);
}

function listPackDirs() {
  if (!existsSync(domainsDir)) return [];
  return readdirSync(domainsDir)
    .filter((name) => !name.startsWith("_") && statSync(join(domainsDir, name)).isDirectory())
    .filter((name) => existsSync(join(domainsDir, name, "pack.json")))
    .sort();
}

function loadPack(name) {
  if (typeof name !== "string" || /[\\/]|\.\./.test(name)) {
    fail(`invalid pack name "${name}" — use a bare pack id (no path separators)`);
  }
  const dir = join(domainsDir, name);
  const manifest = join(dir, "pack.json");
  if (!existsSync(manifest)) fail(`no pack "${name}" (looked for ${manifest})`);
  let pack;
  try {
    pack = JSON.parse(readFileSync(manifest, "utf8"));
  } catch (err) {
    fail(`pack "${name}" has invalid pack.json: ${err.message}`);
  }
  return { ...pack, dir };
}

// Quote the substituted path so deliverables with spaces survive the shell, and reject paths that
// carry characters which stay active inside a double-quoted string — POSIX expands $ ` \ inside
// double quotes, Windows expands % — so a crafted --deliverable cannot inject a command. The run
// string itself is authored in pack.json (trusted); only the path is variable.
const SHELL_UNSAFE = process.platform === "win32" ? /[\n\r"%]/ : /[\n\r"$`\\]/;
function quotePath(p) {
  const s = String(p);
  if (SHELL_UNSAFE.test(s)) {
    fail(`deliverable path has shell-unsafe character(s); refusing to run: ${s}`);
  }
  return `"${s}"`;
}

function resolveDeliverable(runStr, deliverablePath) {
  return runStr.replace(/\{\{\s*deliverable\s*\}\}/g, quotePath(deliverablePath));
}

function runChecks(pack, deliverablePath) {
  const results = [];
  for (const check of pack.checks ?? []) {
    const cmd = resolveDeliverable(check.run, deliverablePath);
    let pass = true;
    let output = "";
    try {
      output = execSync(cmd, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    } catch (err) {
      pass = false;
      output = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim();
    }
    results.push({ name: check.name, pass, output, cmd });
  }
  return results;
}

function cmdList() {
  const packs = listPackDirs();
  if (packs.length === 0) {
    process.stdout.write("[domain-pack] no packs found under .github/harness/domains/\n");
    return;
  }
  for (const name of packs) {
    const pack = loadPack(name);
    process.stdout.write(`${String(pack.name).padEnd(24)} ${pack.title ?? ""}\n`);
  }
}

function cmdShow(name) {
  const pack = loadPack(name);
  process.stdout.write(`# ${pack.title} (${pack.name})\n`);
  if (pack.industry) process.stdout.write(`Industry: ${pack.industry}\n`);
  if (pack.description) process.stdout.write(`${pack.description}\n`);
  process.stdout.write(`\nStages:\n`);
  for (const s of pack.stages ?? []) process.stdout.write(`  ${s.id}. ${s.label} — ${s.purpose}\n`);
  process.stdout.write(`\nGates:\n`);
  for (const g of pack.gates ?? []) process.stdout.write(`  ${g.id}. ${g.name}: ${g.question}\n`);
  process.stdout.write(`\nChecks:\n`);
  for (const c of pack.checks ?? []) process.stdout.write(`  ${c.name}: ${c.run}\n`);
  process.stdout.write(`\nLoops: ${(pack.loops ?? []).join(", ") || "(none)"}\n`);
  if (pack.samples) process.stdout.write(`Samples: good=${pack.samples.good} broken=${pack.samples.broken}\n`);
}

function cmdCheck(name, flags) {
  const pack = loadPack(name);
  // `--deliverable` with no value parses to boolean true; treat only a real string as a path.
  if (flags.deliverable === true) fail("--deliverable needs a file path");
  const deliverable =
    typeof flags.deliverable === "string"
      ? flags.deliverable
      : pack.samples?.good
        ? join(pack.dir, pack.samples.good)
        : null;
  if (!deliverable) fail(`pack "${name}" has no samples.good and no --deliverable given`);
  const rel = deliverable.startsWith(repoRoot) ? deliverable.slice(repoRoot.length + 1) : deliverable;
  process.stdout.write(`[domain-pack] checking ${pack.name} against ${rel}\n`);
  const results = runChecks(pack, deliverable);
  let allPass = true;
  for (const r of results) {
    allPass = allPass && r.pass;
    process.stdout.write(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : `\n        ${r.output.replace(/\n/g, "\n        ")}`}\n`);
  }
  process.stdout.write(`[domain-pack] ${allPass ? "all checks green" : "checks FAILED"}\n`);
  process.exit(allPass ? 0 : 1);
}

function cmdActivate(name) {
  const pack = loadPack(name);
  // Validate every source BEFORE mutating anything, so a missing file can't leave a half-activation.
  const loopJobs = (pack.loops ?? []).map((loop) => {
    const src = join(pack.dir, "loops", `${loop}.json`);
    if (!existsSync(src)) fail(`pack "${name}" loop file missing: ${src}`);
    return { loop, src, dest: join(loopsDir, `${loop}.json`) };
  });
  let presetPath = null;
  if (pack.configPreset) {
    presetPath = join(pack.dir, pack.configPreset);
    if (!existsSync(presetPath)) fail(`pack "${name}" configPreset missing: ${presetPath}`);
  }

  mkdirSync(loopsDir, { recursive: true });
  const copied = [];
  const overwritten = [];
  for (const job of loopJobs) {
    if (existsSync(job.dest) && readFileSync(job.dest, "utf8") !== readFileSync(job.src, "utf8")) {
      overwritten.push(`${job.loop}.json`);
    }
    copyFileSync(job.src, job.dest);
    copied.push(job.loop);
  }

  let configNote = "config preset not applied (none declared)";
  if (presetPath) {
    const bak = `${configPath}.bak`;
    // Back up only the ORIGINAL — never overwrite an existing .bak on a second activation.
    if (existsSync(configPath) && !existsSync(bak)) copyFileSync(configPath, bak);
    copyFileSync(presetPath, configPath);
    configNote = existsSync(bak)
      ? `harness.config.json written from ${pack.configPreset} (original preserved at harness.config.json.bak)`
      : `harness.config.json written from ${pack.configPreset}`;
  }

  process.stdout.write(`[domain-pack] activated ${pack.name}\n`);
  process.stdout.write(`  loops copied into .github/harness/loops/: ${copied.join(", ") || "(none)"}\n`);
  if (overwritten.length) {
    process.stdout.write(`  WARNING: replaced existing loop file(s) with different content: ${overwritten.join(", ")}\n`);
  }
  process.stdout.write(`  ${configNote}\n`);
  process.stdout.write(`  Verify: node scripts/harness/run-loop.mjs --list\n`);
}

function selfTest() {
  const packs = listPackDirs();
  const checks = [];
  const add = (name, ok, detail) => checks.push({ name, ok, detail });

  if (packs.length === 0) add("at least one pack exists", false, "no packs under .github/harness/domains/");

  for (const name of packs) {
    const pack = loadPack(name);
    // Structural integrity
    add(`${name}: pack.name matches directory`, pack.name === name, `pack.name is "${pack.name}", directory is "${name}"`);
    add(`${name}: has stages`, Array.isArray(pack.stages) && pack.stages.length > 0, "stages[] required");
    add(`${name}: has gates`, Array.isArray(pack.gates) && pack.gates.length > 0, "gates[] required");
    add(`${name}: has checks`, Array.isArray(pack.checks) && pack.checks.length > 0, "checks[] required");
    const checksTarget = (pack.checks ?? []).every((c) => typeof c.run === "string" && /\{\{\s*deliverable\s*\}\}/.test(c.run));
    add(`${name}: every check targets {{deliverable}}`, checksTarget, "a check.run has no {{deliverable}} token — it would not inspect the deliverable");

    for (const ref of ["skill", "configPreset"]) {
      if (pack[ref]) {
        add(`${name}: ${ref} file exists`, existsSync(join(pack.dir, pack[ref])), `${ref}: ${pack[ref]}`);
      }
    }
    for (const loop of pack.loops ?? []) {
      const p = join(pack.dir, "loops", `${loop}.json`);
      const ok = existsSync(p);
      add(`${name}: loop ${loop} exists`, ok, p);
      if (ok) {
        try {
          JSON.parse(readFileSync(p, "utf8"));
        } catch (e) {
          add(`${name}: loop ${loop} parses`, false, e.message);
        }
      }
    }

    // Fitness: good passes all checks; broken fails at least one.
    const good = pack.samples?.good ? join(pack.dir, pack.samples.good) : null;
    const broken = pack.samples?.broken ? join(pack.dir, pack.samples.broken) : null;
    if (good && existsSync(good)) {
      const r = runChecks(pack, good);
      const allPass = r.every((x) => x.pass);
      add(`${name}: good sample passes all checks`, allPass, r.filter((x) => !x.pass).map((x) => `${x.name}: ${x.output}`).join(" | "));
    } else {
      add(`${name}: good sample present`, false, `samples.good missing: ${pack.samples?.good}`);
    }
    if (broken && existsSync(broken)) {
      const r = runChecks(pack, broken);
      const anyFail = r.some((x) => !x.pass);
      add(`${name}: broken sample fails a check`, anyFail, "broken sample passed every check — it should trip at least one");
    } else {
      add(`${name}: broken sample present`, false, `samples.broken missing: ${pack.samples?.broken}`);
    }
  }

  const passed = checks.every((c) => c.ok);
  process.stdout.write(`[domain-pack] self-test — ${packs.length} pack(s)\n`);
  for (const c of checks) {
    process.stdout.write(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : ` — ${c.detail}`}\n`);
  }
  process.stdout.write(`[domain-pack] ${passed ? "self-test PASSED" : "self-test FAILED"}\n`);
  process.exit(passed ? 0 : 1);
}

function parseFlags(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

const flags = parseFlags(process.argv.slice(2));
if (flags["self-test"]) selfTest();
const sub = flags._[0];
if (flags.list || sub === "list") cmdList();
else if (sub === "show") cmdShow(flags._[1] ?? fail("show needs a pack name"));
else if (sub === "check") cmdCheck(flags._[1] ?? fail("check needs a pack name"), flags);
else if (sub === "activate") cmdActivate(flags._[1] ?? fail("activate needs a pack name"));
else fail('usage: domain-pack.mjs [--list | show <pack> | check <pack> | activate <pack> | --self-test]');
