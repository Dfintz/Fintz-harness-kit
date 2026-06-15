#!/usr/bin/env node
/**
 * Backfill explicit approval markers into legacy harness run journals.
 *
 * Legacy journals predate the `approval` object. This migration normalizes those
 * records so dashboard/report logic can rely on explicit approval metadata.
 *
 * Usage:
 *   node scripts/harness/migrate-approval-markers.mjs [--dry-run] [--force]
 *
 * Defaults:
 *   approval.required = false
 *   approval.status = 'not-required'
 */
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultRunsDir = join(repoRoot, ".github", "harness", "runs");

function fail(message) {
  console.error(`[migrate-approval-markers] ${message}`);
  process.exit(2);
}

function parseArgs(argv) {
  const args = { dryRun: false, force: false };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
    else fail(`Unknown option: ${arg}`);
  }
  return args;
}

function isLikelyRunJournal(json) {
  return (
    json && typeof json.loop === "string" && Array.isArray(json.iterations)
  );
}

function needsBackfill(json, force) {
  if (force) return true;
  return !(json.approval && typeof json.approval === "object");
}

function normalizedApproval() {
  return {
    required: false,
    status: "not-required",
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(defaultRunsDir)) {
    fail(`runs directory does not exist: ${defaultRunsDir}`);
  }

  const files = readdirSync(defaultRunsDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;

  for (const name of files) {
    const path = join(defaultRunsDir, name);
    if (!statSync(path).isFile()) continue;

    scanned += 1;
    let json;
    try {
      json = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      invalid += 1;
      continue;
    }

    if (!isLikelyRunJournal(json)) {
      skipped += 1;
      continue;
    }

    if (!needsBackfill(json, args.force)) {
      skipped += 1;
      continue;
    }

    const next = {
      ...json,
      approval: normalizedApproval(),
    };

    if (!args.dryRun) {
      writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
    }
    updated += 1;
  }

  const mode = args.dryRun ? "DRY RUN" : "APPLIED";
  console.log(`[migrate-approval-markers] ${mode}`);
  console.log(`[migrate-approval-markers] runsDir: ${defaultRunsDir}`);
  console.log(
    `[migrate-approval-markers] scanned=${scanned} updated=${updated} skipped=${skipped} invalid=${invalid}`,
  );
  if (args.dryRun) {
    console.log(
      "[migrate-approval-markers] Re-run without --dry-run to write changes.",
    );
  }
}

main();
