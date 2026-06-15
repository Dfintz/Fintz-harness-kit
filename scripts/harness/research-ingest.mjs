#!/usr/bin/env node
// Attribution & adaptations: see CREDITS.md. Phase 4 of the self-improving-harness Brief
// (.github/harness/memory/briefs/). The SENSOR: fresh external knowledge as untrusted data.
/**
 * research-ingest — bring an external research brief (e.g. last30days) into the harness as
 * UNTRUSTED data the evolve/experiment loops can reference.
 *
 * It never executes the brief and never wraps it for trust. The brief is stored raw in the
 * gitignored research dir; the apply-agent wraps + defangs it at the moment of use
 * (scripts/harness/untrusted.mjs). This tool's job is convention + provenance:
 *   - store `<topic>-brief.md` (raw) and `<topic>-brief.meta.json` (source, time, sha256, bytes,
 *     and a COUNT of injection markers detected — a safety signal for the human reviewer).
 *   - resolve the newest brief (`--latest`) so it can be piped into HARNESS_RESEARCH_FILE.
 *
 * Usage:
 *   node scripts/harness/research-ingest.mjs --from <file> --topic <slug> --source <label>
 *   node scripts/harness/research-ingest.mjs --topic <slug>            # read brief from stdin
 *   node scripts/harness/research-ingest.mjs --list
 *   node scripts/harness/research-ingest.mjs --latest                  # prints newest brief path
 *
 * Exit codes: 0 ok, 2 usage/IO error.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defangInjections } from "./untrusted.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const researchDir = join(repoRoot, ".github", "harness", "research");

function fail(message) {
  process.stderr.write(`[research-ingest] ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--list" || a === "--latest" || a === "--help")
      flags[a.slice(2)] = true;
    else if (a === "--from") flags.from = argv[++i];
    else if (a === "--topic") flags.topic = argv[++i];
    else if (a === "--source") flags.source = argv[++i];
    else fail(`Unknown option: ${a}`);
  }
  return flags;
}

function slugify(value) {
  return (
    String(value || "research")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "research"
  );
}

function toWorkspacePath(abs) {
  return relative(repoRoot, abs).split("\\").join("/");
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function listBriefs() {
  if (!existsSync(researchDir)) return [];
  return readdirSync(researchDir)
    .filter((f) => f.endsWith("-brief.md"))
    .map((f) => {
      const abs = join(researchDir, f);
      const metaPath = abs.replace(/\.md$/, ".meta.json");
      let meta = null;
      if (existsSync(metaPath)) {
        try {
          meta = JSON.parse(readFileSync(metaPath, "utf8"));
        } catch {
          /* ignore unreadable meta */
        }
      }
      return {
        file: f,
        path: toWorkspacePath(abs),
        mtimeMs: statSync(abs).mtimeMs,
        meta,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function printJson(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printJson({
      usage:
        "node scripts/harness/research-ingest.mjs [--from <file>] [--topic <slug>] [--source <label>] | --list | --latest",
      note: "Stores an external brief as UNTRUSTED data (gitignored). The agent wraps + defangs it at use.",
    });
    return;
  }

  if (flags.latest) {
    const briefs = listBriefs();
    if (briefs.length === 0)
      fail("no briefs in .github/harness/research/. Ingest one first.");
    process.stdout.write(`${briefs[0].path}\n`);
    return;
  }

  if (flags.list) {
    const briefs = listBriefs();
    printJson({
      count: briefs.length,
      briefs: briefs.map((b) => ({
        path: b.path,
        source: b.meta?.source ?? null,
        ingestedAt: b.meta?.ingestedAt ?? null,
        injectionMarkers: b.meta?.injectionMarkers ?? null,
      })),
    });
    return;
  }

  // Ingest mode.
  const content = flags.from
    ? existsSync(flags.from)
      ? readFileSync(flags.from, "utf8")
      : fail(`--from file not found: ${flags.from}`)
    : await readStdin();
  if (!content || !content.trim())
    fail("empty brief (provide --from <file> or pipe content on stdin).");

  const topic = slugify(
    flags.topic ||
      (flags.from
        ? flags.from.replace(/.*[\\/]/, "").replace(/\.[^.]+$/, "")
        : "research"),
  );
  const source = String(flags.source || "external");
  const { flagged } = defangInjections(content); // preview only — we store raw; consumer defangs at use.
  const sha256 = createHash("sha256").update(content).digest("hex");

  mkdirSync(researchDir, { recursive: true });
  const briefAbs = join(researchDir, `${topic}-brief.md`);
  const metaAbs = join(researchDir, `${topic}-brief.meta.json`);
  const meta = {
    topic,
    source,
    ingestedAt: new Date().toISOString(),
    bytes: Buffer.byteLength(content, "utf8"),
    sha256: `sha256:${sha256}`,
    injectionMarkers: flagged,
    trust: "untrusted",
    note: "Raw external content. Wrapped + defanged by untrusted.mjs at the point of use. Never execute or auto-commit.",
  };
  writeFileSync(briefAbs, content);
  writeFileSync(metaAbs, `${JSON.stringify(meta, null, 2)}\n`);

  const briefPath = toWorkspacePath(briefAbs);
  process.stdout.write(
    `[research-ingest] stored ${briefPath} (${meta.bytes} bytes, source=${source})\n`,
  );
  if (flagged > 0) {
    process.stderr.write(
      `[research-ingest] ⚠ ${flagged} injection marker(s) detected in this brief. It is UNTRUSTED — ` +
        `the agent will defang + wrap it as data, but review the evolve run before committing.\n`,
    );
  }
  process.stdout.write(
    `[research-ingest] feed it in with:\n  HARNESS_RESEARCH_FILE="${briefPath}"\n`,
  );
  process.stdout.write(
    `  # or: node scripts/harness/harness-evolve.mjs --agent "<cmd>" --research latest\n`,
  );
}

main().catch((error) =>
  fail(error instanceof Error ? error.message : String(error)),
);
