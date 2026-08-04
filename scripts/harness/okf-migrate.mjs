#!/usr/bin/env node
/** Manifest-bound migration for missing Brief lifecycle statuses. */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readBriefMetadata } from "./memory-curate.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const briefsDir = join(repoRoot, ".github", "harness", "memory", "briefs");
const runsDir = join(repoRoot, ".github", "harness", "runs");
const VALID_STATUSES = new Set(["active", "implemented", "superseded"]);
const SKIP_FILES = new Set(["README.md", "_template.md"]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) fail(`Unknown argument: ${token}`);
    if (["--help", "--json", "--self-test", "--replace-invalid-status"].includes(token)) {
      flags[token.slice(2)] = true;
      continue;
    }
    if (token === "--apply") fail("--apply is not supported. Use --apply-manifest with an approved digest.");
    const value = argv[++index];
    if (!value || value.startsWith("--")) fail(`Missing value for ${token}`);
    flags[token.slice(2)] = value;
  }
  return flags;
}

function frontmatterInfo(content) {
  const lines = String(content).split(/\r?\n/);
  if (lines[0] !== "---") return { form: "none", lines, closingIndex: -1, statusCount: 0 };
  const closingIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closingIndex < 0) return { form: "malformed", lines, closingIndex, statusCount: 0 };
  const statusCount = lines.slice(1, closingIndex).filter((line) => /^status\s*:/i.test(line)).length;
  return { form: "frontmatter", lines, closingIndex, statusCount };
}

function extractSummary(content) {
  for (const line of String(content).split(/\r?\n/)) {
    const stripped = line.replace(/^#+\s*/, "").trim();
    if (stripped && stripped !== "---") return stripped.slice(0, 100).replace(/"/g, "'");
  }
  return "untitled";
}

function buildFrontmatter(filename, content, status) {
  const tags = filename.replace(/\.md$/i, "").split("-").filter((tag) => tag.length > 2).slice(0, 4);
  const today = new Date().toISOString().slice(0, 10);
  return [
    "---",
    `summary: "${extractSummary(content)}"`,
    "type: brief",
    `status: ${status}`,
    "source: human",
    `created: ${today}`,
    `updated: ${today}`,
    `tags: [${tags.join(", ")}]`,
    "---",
    "",
  ].join("\n");
}

function rawBodyAfterFrontmatter(content) {
  const match = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(content);
  return match ? content.slice(match[0].length) : "";
}

function artifactFamily(filename) {
  const lower = filename.toLowerCase();
  if (lower.startsWith("architect-challenge-verdict") || lower.includes("-challenge-verdict")) return "challenge";
  if (lower.startsWith("review-stage") || lower.includes("review-breadth") || lower.includes("review-depth") || lower.includes("feedback-verdict")) return "review";
  if (lower.includes("architecture-brief")) return "architect";
  return null;
}

function frontmatterValue(info, key) {
  const match = info.lines.slice(1, info.closingIndex).find((line) => new RegExp(`^${key}\\s*:`, "i").test(line));
  return match ? match.slice(match.indexOf(":") + 1).trim() : "";
}

function markerPlan(filePath, info) {
  const family = artifactFamily(filePath.split(/[\\/]/).at(-1));
  if (!family) return null;
  const declaredFamily = frontmatterValue(info, "artifact_family").toLowerCase();
  const immutability = frontmatterValue(info, "immutability").toLowerCase();
  return declaredFamily === family && ["mutable", "frozen", "append-only"].includes(immutability)
    ? null
    : { family, immutability: "frozen" };
}

function updatedFrontmatterContent(info, content, status, options = {}) {
  const body = rawBodyAfterFrontmatter(content);
  const header = info.lines.slice(0, info.closingIndex).map((line) => {
    if (options.replaceStatus && /^status\s*:/i.test(line)) return `status: ${status}`;
    if (options.marker && /^artifact_family\s*:/i.test(line)) return `artifact_family: ${options.marker.family}`;
    if (options.marker && /^immutability\s*:/i.test(line)) return `immutability: ${options.marker.immutability}`;
    return line;
  });
  if (options.addStatus) header.push(`status: ${status}`);
  if (options.marker && !frontmatterValue(info, "artifact_family")) header.push(`artifact_family: ${options.marker.family}`);
  if (options.marker && !frontmatterValue(info, "immutability")) header.push(`immutability: ${options.marker.immutability}`);
  if (options.marker && options.marker.immutability === "frozen" && !frontmatterValue(info, "immutable_since")) header.push(`immutable_since: ${new Date().toISOString().slice(0, 10)}`);
  return `${header.join("\n")}\n---\n${body}`;
}

function planEntry(filePath, status, replaceInvalidStatus = false) {
  const content = readFileSync(filePath, "utf8");
  const info = frontmatterInfo(content);
  const path = relative(repoRoot, filePath).replaceAll("\\", "/");
  if (info.form === "malformed") return { path, sha256: sha256(content), metadataForm: "malformed", action: "reject", reason: "unclosed frontmatter" };
  if (info.statusCount > 1) return { path, sha256: sha256(content), metadataForm: "frontmatter", action: "reject", reason: "duplicate status keys" };
  const metadata = readBriefMetadata(content);
  const hasValidStatus = metadata.status && VALID_STATUSES.has(metadata.status);
  const markers = info.form === "frontmatter" ? markerPlan(filePath, info) : null;
  if (hasValidStatus && !markers) return null;
  if (info.statusCount === 1 && !replaceInvalidStatus) return { path, sha256: sha256(content), metadataForm: "frontmatter", action: "reject", reason: "invalid status value" };
  const needsStatus = !hasValidStatus;
  const next = info.form === "none"
    ? buildFrontmatter(filePath.split(/[\\/]/).at(-1), content, status) + content
    : updatedFrontmatterContent(info, content, status, {
      addStatus: needsStatus && info.statusCount === 0,
      replaceStatus: needsStatus && info.statusCount === 1,
      marker: markers,
    });
  const originalBody = info.form === "none" ? content : rawBodyAfterFrontmatter(content);
  const nextBody = info.form === "none" ? content : rawBodyAfterFrontmatter(next);
  const bodyPreserved = info.form === "none"
    ? next.endsWith(content)
    : sha256(originalBody) === sha256(nextBody);
  if (!bodyPreserved) fail(`Body preservation failure while planning ${path}`);
  return {
    path,
    sha256: sha256(content),
    metadataForm: info.form,
    proposedStatus: status,
    reason: markers && !needsStatus ? "missing artifact markers" : info.form === "none" ? "missing frontmatter" : info.statusCount === 1 ? "approved replacement of invalid lifecycle status" : "missing lifecycle status",
    action: "migrate",
    bodySha256: sha256(originalBody),
  };
}

function buildManifest(status, replaceInvalidStatus, targetPaths = null) {
  const entries = readdirSync(briefsDir)
    .filter((name) => {
      if (!name.endsWith(".md") || SKIP_FILES.has(name)) return false;
      const path = `.github/harness/memory/briefs/${name}`;
      return targetPaths === null || targetPaths.has(path);
    })
    .sort()
    .map((name) => planEntry(join(briefsDir, name), status, replaceInvalidStatus))
    .filter(Boolean);
  return {
    version: 1,
    scope: "briefs",
    lifecycleDisposition: status,
    entries,
    candidateCount: entries.filter((entry) => entry.action === "migrate").length,
    rejectCount: entries.filter((entry) => entry.action === "reject").length,
  };
}

function writeManifest(manifest) {
  mkdirSync(runsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(runsDir, `brief-status-migration-${stamp}.manifest.json`);
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  writeFileSync(path, text, "utf8");
  return { path, sha256: sha256(text) };
}

function loadManifestTargets(value) {
  const path = resolveManifestPath(value);
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  if (manifest.version !== 1 || manifest.scope !== "briefs" || !Array.isArray(manifest.entries)) {
    fail("Source manifest is not a version 1 Brief migration manifest.");
  }
  return new Set(manifest.entries.map((entry) => entry.path).filter((path) => typeof path === "string"));
}

function resolveManifestPath(value) {
  const path = resolve(repoRoot, value);
  const prefix = `${runsDir}${process.platform === "win32" ? "\\" : "/"}`;
  if (!path.startsWith(prefix)) fail("Manifest must be under .github/harness/runs/");
  return path;
}

function proposedContent(target, content, status) {
  const info = frontmatterInfo(content);
  const metadata = readBriefMetadata(content);
  const hasValidStatus = metadata.status && VALID_STATUSES.has(metadata.status);
  const markers = info.form === "frontmatter" ? markerPlan(target, info) : null;
  return info.form === "none"
    ? buildFrontmatter(target.split(/[\\/]/).at(-1), content, status) + content
    : updatedFrontmatterContent(info, content, status, {
      addStatus: !hasValidStatus && info.statusCount === 0,
      replaceStatus: !hasValidStatus && info.statusCount === 1,
      marker: markers,
    });
}

function commitMigration(originals, receiptPath, manifestDigest, write = writeFileSync) {
  const written = [];
  try {
    for (const item of originals) {
      write(item.target, item.next, "utf8");
      written.push(item);
    }
    const receipt = {
      version: 1,
      manifestSha256: manifestDigest,
      entries: originals.map((item) => ({ path: item.entry.path, postMigrationSha256: sha256(item.next) })),
    };
    write(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    return { changed: written.length };
  } catch (error) {
    for (const item of written.reverse()) writeFileSync(item.target, item.content, "utf8");
    rmSync(receiptPath, { force: true });
    throw error;
  }
}

function applyManifest(manifestPathValue, approvedDigest) {
  const path = resolveManifestPath(manifestPathValue);
  const manifestText = readFileSync(path, "utf8");
  const normalizedDigest = String(approvedDigest).trim().toLowerCase();
  if (sha256(manifestText) !== normalizedDigest) fail("Manifest SHA-256 does not match the approved digest.");
  const manifest = JSON.parse(manifestText);
  if (manifest.version !== 1 || manifest.scope !== "briefs") fail("Unsupported migration manifest.");
  if (manifest.rejectCount > 0 || manifest.entries.some((entry) => entry.action !== "migrate")) fail("Manifest contains rejected entries; no files were changed.");

  const receiptPath = `${path}.receipt.json`;
  if (existsSync(receiptPath)) {
    const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
    if (receipt.manifestSha256 !== normalizedDigest) fail("Existing receipt does not match approved manifest.");
    for (const entry of receipt.entries) {
      const current = readFileSync(resolve(repoRoot, entry.path), "utf8");
      if (sha256(current) !== entry.postMigrationSha256 || readBriefMetadata(current).status !== manifest.lifecycleDisposition) fail(`Receipt replay check failed for ${entry.path}`);
    }
    return { mode: "idempotent-noop", manifestPath: path, receiptPath, changed: 0 };
  }

  const originals = manifest.entries.map((entry) => {
    const target = resolve(repoRoot, entry.path);
    const content = readFileSync(target, "utf8");
    if (sha256(content) !== entry.sha256) fail(`Source hash changed for ${entry.path}`);
    const planned = planEntry(target, manifest.lifecycleDisposition, true);
    if (!planned || planned.action !== "migrate" || planned.bodySha256 !== entry.bodySha256) fail(`Migration plan changed for ${entry.path}`);
    return { entry, target, content, next: proposedContent(target, content, manifest.lifecycleDisposition) };
  });

  const result = commitMigration(originals, receiptPath, normalizedDigest);
  return { mode: "applied", manifestPath: path, receiptPath, changed: result.changed };
}

function runSelfTest() {
  const tempDir = join(runsDir, "okf-migrate-self-test");
  mkdirSync(tempDir, { recursive: true });
  const file = join(tempDir, "brief.md");
  const original = "---\nverdict: REVISE\n---\n# Legacy\n";
  writeFileSync(file, original, "utf8");
  const planned = planEntry(file, "implemented");
  const preservesBody = planned?.action === "migrate" && planned.bodySha256 === sha256("# Legacy\n");
  const first = join(tempDir, "first.md");
  const second = join(tempDir, "second.md");
  const receipt = join(tempDir, "receipt.json");
  writeFileSync(first, "original-first", "utf8");
  writeFileSync(second, "original-second", "utf8");
  const originals = [
    { entry: { path: "first.md" }, target: first, content: "original-first", next: "next-first" },
    { entry: { path: "second.md" }, target: second, content: "original-second", next: "next-second" },
  ];
  let targetRollback = false;
  try {
    commitMigration(originals, receipt, "digest", (target, value) => {
      if (target === second) throw new Error("injected target write failure");
      writeFileSync(target, value, "utf8");
    });
  } catch {
    targetRollback = readFileSync(first, "utf8") === "original-first" && readFileSync(second, "utf8") === "original-second" && !existsSync(receipt);
  }
  let receiptRollback = false;
  try {
    commitMigration(originals, receipt, "digest", (target, value) => {
      if (target === receipt) throw new Error("injected receipt write failure");
      writeFileSync(target, value, "utf8");
    });
  } catch {
    receiptRollback = readFileSync(first, "utf8") === "original-first" && readFileSync(second, "utf8") === "original-second" && !existsSync(receipt);
  }
  rmSync(tempDir, { recursive: true, force: true });
  const cases = [
    ["frontmatter status plan preserves body bytes", preservesBody],
    ["target write failure rolls back all targets", targetRollback],
    ["receipt write failure rolls back all targets", receiptRollback],
  ];
  for (const [name, passed] of cases) console.log(`[okf-migrate] ${passed ? "PASS" : "FAIL"} ${name}`);
  return cases.every(([, passed]) => passed) ? 0 : 1;
}

function print(result, json) {
  if (json) console.log(JSON.stringify(result, null, 2));
  else console.log(`[okf-migrate] ${result.mode}: ${result.changed ?? result.candidateCount ?? 0} candidate(s)`);
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log("Usage: okf-migrate.mjs [--scope briefs] [--status implemented] [--json] | --apply-manifest <path> --manifest-sha256 <digest> [--json]");
    return;
  }
  if (flags["self-test"]) process.exit(runSelfTest());
  if (flags["apply-manifest"] || flags["manifest-sha256"]) {
    if (!flags["apply-manifest"] || !flags["manifest-sha256"]) fail("Both --apply-manifest and --manifest-sha256 are required.");
    print(applyManifest(flags["apply-manifest"], flags["manifest-sha256"]), flags.json);
    return;
  }
  const scope = flags.scope || "briefs";
  if (scope !== "briefs") fail("Only --scope briefs is supported by manifest migration.");
  const status = flags.status || "implemented";
  if (!VALID_STATUSES.has(status)) fail("--status must be active, implemented, or superseded.");
  const targets = flags["from-manifest"] ? loadManifestTargets(flags["from-manifest"]) : null;
  const manifest = buildManifest(status, flags["replace-invalid-status"] === true, targets);
  const saved = writeManifest(manifest);
  print({ mode: "dry-run", ...manifest, manifestPath: relative(repoRoot, saved.path).replaceAll("\\", "/"), manifestSha256: saved.sha256 }, flags.json);
}

try {
  main();
} catch (error) {
  process.stderr.write(`[okf-migrate] ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
