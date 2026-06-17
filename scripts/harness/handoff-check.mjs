#!/usr/bin/env node
/**
 * handoff-check — validate a compact handoff document against HANDOFF_SPEC.md.
 *
 * The handoff format lets a different agent (or a later session) resume work without re-deriving
 * context. It is most valuable on the stage machine's loop BACK-EDGES, where control crosses a model
 * boundary: Architect Challenge -> Architect (a dispute) and Review -> Implement (the review-fix
 * loop). This checker is the executable form of the spec so those handoffs are enforceable, not
 * just documented.
 *
 *   node scripts/harness/handoff-check.mjs <handoff.md>   # validate a file (exit 0 pass / 1 fail)
 *   node scripts/harness/handoff-check.mjs --self-test     # deterministic regression check
 *
 * No deps, no network, no install — Node built-ins only, so it runs in selftest-all.
 */
import { existsSync, readFileSync } from "node:fs";

export const REQUIRED_SECTIONS = [
  "Task Snapshot",
  "Current State",
  "Next Steps",
  "Suggested Skills",
  "References",
  "Safety Check",
];

export const MAX_LINES = 220;
export const MAX_BYTES = 12000;

// Obvious secret shapes that must never appear in a committed handoff.
const SECRET_PATTERNS = [
  { name: "AWS access key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: "private key block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

const isBullet = (line) => /^\s*[-*]\s+\S/.test(line);
// A reference is concrete if it carries a URL or a repo-relative path (a/b token).
const isConcreteRef = (line) =>
  /https?:\/\//.test(line) || /[\w.-]+\/[\w./-]+/.test(line);

/**
 * Parse a markdown handoff into a map of `## Heading` -> array of body lines.
 */
function parseSections(text) {
  const sections = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const m = /^##\s+(.*\S)\s*$/.exec(raw);
    if (m) {
      current = m[1].trim();
      sections.set(current, []);
    } else if (current) {
      sections.get(current).push(raw);
    }
  }
  return sections;
}

/**
 * Validate handoff text. Pure (no I/O) so it is deterministically self-testable.
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function checkHandoff(text) {
  const errors = [];
  const lines = text.split(/\r?\n/);
  const bytes = Buffer.byteLength(text, "utf8");

  if (lines.length > MAX_LINES) {
    errors.push(`too long: ${lines.length} lines (max ${MAX_LINES})`);
  }
  if (bytes > MAX_BYTES) {
    errors.push(`too large: ${bytes} bytes (max ${MAX_BYTES})`);
  }

  const sections = parseSections(text);
  for (const name of REQUIRED_SECTIONS) {
    if (!sections.has(name)) {
      errors.push(`missing required section: ## ${name}`);
    }
  }
  // "Exactly these section headings" — flag unexpected top-level sections.
  for (const heading of sections.keys()) {
    if (!REQUIRED_SECTIONS.includes(heading)) {
      errors.push(`unexpected section: ## ${heading}`);
    }
  }

  const bulletsIn = (name) => (sections.get(name) ?? []).filter(isBullet);
  if (sections.has("Next Steps") && bulletsIn("Next Steps").length < 1) {
    errors.push("## Next Steps must include at least one bullet");
  }
  if (sections.has("Suggested Skills") && bulletsIn("Suggested Skills").length < 1) {
    errors.push("## Suggested Skills must include at least one bullet");
  }
  if (sections.has("References")) {
    const refs = bulletsIn("References");
    if (refs.length < 1) {
      errors.push("## References must include at least one bullet");
    } else if (!refs.some(isConcreteRef)) {
      errors.push(
        "## References must include a bullet with a repo-relative path or an absolute URL",
      );
    }
  }
  if (sections.has("Safety Check")) {
    const body = (sections.get("Safety Check") ?? []).join("\n").toLowerCase();
    if (!/secret/.test(body)) {
      errors.push("## Safety Check must explicitly address secret handling");
    }
  }

  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(text)) {
      errors.push(`possible ${name} present — handoffs must not contain secrets`);
    }
  }

  return { ok: errors.length === 0, errors };
}

const GOOD_SAMPLE = `# Handoff: dispute on entity-api Brief

## Task Snapshot
Architect Challenge disputed Gate 3 (Data Ownership) on the entity-api Brief.

## Current State
Brief at .github/harness/memory/briefs/entity-api.md places getStats() on EntityService.

## Next Steps
- Move getStats() to the StatsService base class per Gate 3.
- Re-run plan-review --lens plan to confirm APPROVED.

## Suggested Skills
- backend-service

## References
- .github/harness/memory/briefs/entity-api.md
- https://example.com/ticket/123

## Safety Check
No secrets included.
`;

const BROKEN_SAMPLE = `# Handoff

## Task Snapshot
Something happened.

## Next Steps
- do the thing

## References
- see the brief
`;

function runSelfTest() {
  const good = checkHandoff(GOOD_SAMPLE);
  const broken = checkHandoff(BROKEN_SAMPLE);
  const goodSecret = checkHandoff(
    GOOD_SAMPLE.replace("No secrets included.", "token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"),
  );

  const cases = [
    { name: "good sample passes", pass: good.ok },
    { name: "broken sample fails", pass: !broken.ok },
    { name: "secret is rejected", pass: !goodSecret.ok },
  ];
  const failed = cases.filter((c) => !c.pass);
  for (const c of cases) {
    process.stdout.write(`  ${c.pass ? "✓" : "✗"} ${c.name}\n`);
  }
  if (!good.ok) {
    process.stdout.write(`  (good sample errors: ${good.errors.join("; ")})\n`);
  }
  process.stdout.write(
    `[handoff-check] self-test ${failed.length === 0 ? "PASSED" : "FAILED"}\n`,
  );
  return failed.length === 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) {
    process.exit(runSelfTest() ? 0 : 1);
  }
  const file = args.find((a) => !a.startsWith("--"));
  if (!file) {
    process.stderr.write(
      "[handoff-check] usage: handoff-check <handoff.md> | --self-test\n",
    );
    process.exit(2);
  }
  if (!existsSync(file)) {
    process.stderr.write(`[handoff-check] file not found: ${file}\n`);
    process.exit(2);
  }
  const { ok, errors } = checkHandoff(readFileSync(file, "utf8"));
  if (ok) {
    process.stdout.write(`[handoff-check] OK: ${file}\n`);
    process.exit(0);
  }
  process.stderr.write(`[handoff-check] FAIL: ${file}\n`);
  for (const e of errors) process.stderr.write(`  - ${e}\n`);
  process.exit(1);
}

main();
