#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { repoRoot } from "./config.mjs";

const REQUIRED_HEADINGS = [
  "## Task Snapshot",
  "## Current State",
  "## Next Steps",
  "## Suggested Skills",
  "## References",
  "## Safety Check",
];

const SECRET_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];

function fail(message, code = 1) {
  process.stderr.write(`[handoff-evidence] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") args.file = argv[++i];
    else if (arg === "--max-lines") args.maxLines = Number(argv[++i]);
    else if (arg === "--max-bytes") args.maxBytes = Number(argv[++i]);
    else if (arg === "--json") args.json = true;
    else args._.push(arg);
  }
  return args;
}

function resolveInputPath(inputPath) {
  const absolute = resolve(repoRoot, inputPath);
  if (existsSync(absolute)) return absolute;
  if (existsSync(inputPath)) return resolve(inputPath);
  fail(`file not found: ${inputPath}`, 2);
}

function collectFindings(text, { maxLines, maxBytes }) {
  const findings = [];
  const lineCount = text.split(/\r?\n/).length;
  const byteCount = Buffer.byteLength(text, "utf8");

  for (const heading of REQUIRED_HEADINGS) {
    if (!text.includes(heading)) {
      findings.push({
        level: "error",
        code: "missing-heading",
        details: `${heading} is required.`,
      });
    }
  }

  if (lineCount > maxLines) {
    findings.push({
      level: "error",
      code: "too-many-lines",
      details: `Expected <= ${maxLines} lines, found ${lineCount}.`,
    });
  }

  if (byteCount > maxBytes) {
    findings.push({
      level: "error",
      code: "too-many-bytes",
      details: `Expected <= ${maxBytes} bytes, found ${byteCount}.`,
    });
  }

  const nextStepsBlock = text.match(/## Next Steps\s*([\s\S]*?)(?:\n## |\s*$)/);
  if (!nextStepsBlock || !/^\s*[-*]\s+/m.test(nextStepsBlock[1])) {
    findings.push({
      level: "error",
      code: "missing-next-step-bullet",
      details: "## Next Steps must include at least one bullet.",
    });
  }

  const suggestedSkillsBlock = text.match(/## Suggested Skills\s*([\s\S]*?)(?:\n## |\s*$)/);
  if (!suggestedSkillsBlock || !/^\s*[-*]\s+/m.test(suggestedSkillsBlock[1])) {
    findings.push({
      level: "error",
      code: "missing-skill-bullet",
      details: "## Suggested Skills must include at least one bullet.",
    });
  }

  const referencesBlock = text.match(/## References\s*([\s\S]*?)(?:\n## |\s*$)/);
  if (!referencesBlock || !/^\s*[-*]\s+(?:https?:\/\/|\.[^\s]+)/m.test(referencesBlock[1])) {
    findings.push({
      level: "error",
      code: "invalid-references",
      details: "## References must include at least one bullet with a repo-relative path or URL.",
    });
  }

  const safetyBlock = text.match(/## Safety Check\s*([\s\S]*?)(?:\n## |\s*$)/);
  if (!safetyBlock || !/secret/i.test(safetyBlock[1])) {
    findings.push({
      level: "error",
      code: "missing-secret-check",
      details: "## Safety Check must explicitly mention secret handling.",
    });
  }

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      findings.push({
        level: "error",
        code: "secret-like-token",
        details: `Matched forbidden token pattern: ${pattern}`,
      });
    }
  }

  return { findings, lineCount, byteCount };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (command !== "check-spec") {
    fail("usage: node scripts/harness/handoff-evidence.mjs check-spec --file <path> [--max-lines <n>] [--max-bytes <n>] [--json]", 2);
  }
  if (!args.file) fail("--file is required", 2);

  const path = resolveInputPath(args.file);
  const text = readFileSync(path, "utf8");
  const result = collectFindings(text, {
    maxLines: Number.isFinite(args.maxLines) ? args.maxLines : 220,
    maxBytes: Number.isFinite(args.maxBytes) ? args.maxBytes : 12000,
  });

  if (args.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          file: path,
          lineCount: result.lineCount,
          byteCount: result.byteCount,
          findings: result.findings,
          ok: result.findings.length === 0,
        },
        null,
        2,
      )}\n`,
    );
  } else if (result.findings.length === 0) {
    process.stdout.write("[handoff-evidence] OK\n");
  } else {
    for (const finding of result.findings) {
      process.stdout.write(
        `[handoff-evidence] ${finding.level.toUpperCase()} ${finding.code} - ${finding.details}\n`,
      );
    }
  }

  if (result.findings.length > 0) {
    process.exit(1);
  }
}

main();
