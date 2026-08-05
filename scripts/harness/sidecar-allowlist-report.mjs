#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { loadConfig, repoRoot } from "./config.mjs";

const skillsRoot = join(repoRoot, ".github", "skills");

function parseArgs(argv) {
  const flags = {
    json: false,
    failOnDrift: false,
  };
  for (const arg of argv) {
    if (arg === "--json") flags.json = true;
    if (arg === "--fail-on-drift") flags.failOnDrift = true;
  }
  return flags;
}

function parseYamlScalar(rawValue) {
  const value = rawValue.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseStrictTwoLevelYaml(yamlText) {
  const root = {};
  let currentSection = null;
  const lines = yamlText.split(/\r?\n/);

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const rawLine = lines[lineNumber];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (rawLine.includes("\t")) {
      return { error: `Tabs are not allowed (line ${lineNumber + 1}).` };
    }

    if (/^\S[^:]*:\s*$/.test(rawLine)) {
      const section = rawLine.slice(0, rawLine.indexOf(":"));
      if (Object.hasOwn(root, section)) {
        return { error: `Duplicate top-level key \"${section}\".` };
      }
      root[section] = {};
      currentSection = section;
      continue;
    }

    if (/^\s{2}\S[^:]*:\s*.+$/.test(rawLine)) {
      if (!currentSection) {
        return { error: `Nested key before top-level section (line ${lineNumber + 1}).` };
      }
      const nested = rawLine.trim();
      const separator = nested.indexOf(":");
      const key = nested.slice(0, separator).trim();
      const value = parseYamlScalar(nested.slice(separator + 1));
      if (Object.hasOwn(root[currentSection], key)) {
        return { error: `Duplicate key \"${currentSection}.${key}\".` };
      }
      root[currentSection][key] = value;
      continue;
    }

    return { error: `Unsupported YAML shape at line ${lineNumber + 1}.` };
  }

  return { value: root };
}

function getAllowlistFromConfig() {
  const configured = loadConfig()?.sidecarPolicy?.modelInvokedEligibleSkills;
  if (!Array.isArray(configured)) return [];
  return [...new Set(configured.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))].sort();
}

function collectSkillSlugs() {
  if (!existsSync(skillsRoot)) return [];
  const dirs = readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  return dirs
    .map((entry) => entry.name)
    .filter((slug) => existsSync(join(skillsRoot, slug, "SKILL.md")))
    .sort();
}

function analyze() {
  const allowlist = getAllowlistFromConfig();
  const allowset = new Set(allowlist);
  const skillSlugs = collectSkillSlugs();

  const declaredModelInvoked = [];
  const drifts = [];

  for (const slug of skillSlugs) {
    const sidecarPath = join(skillsRoot, slug, "agents", "openai.yaml");
    const relSidecar = `.github/skills/${slug}/agents/openai.yaml`;

    if (!existsSync(sidecarPath)) {
      if (allowset.has(slug)) {
        drifts.push({
          code: "allowlisted-missing-sidecar",
          skill: slug,
          sidecar: relSidecar,
          details: "Allowlisted skill is missing sidecar metadata.",
        });
      }
      continue;
    }

    const parseResult = parseStrictTwoLevelYaml(readFileSync(sidecarPath, "utf8"));
    if (parseResult.error) {
      drifts.push({
        code: "invalid-sidecar-yaml",
        skill: slug,
        sidecar: relSidecar,
        details: parseResult.error,
      });
      continue;
    }

    const policy = parseResult.value?.policy ?? {};
    const behaviorClass = policy.behavior_class;
    const allowImplicit = policy.allow_implicit_invocation;

    if (behaviorClass === "model-invoked-eligible") {
      declaredModelInvoked.push(slug);
      if (!allowset.has(slug)) {
        drifts.push({
          code: "model-invoked-not-allowlisted",
          skill: slug,
          sidecar: relSidecar,
          details: "Sidecar declares model-invoked-eligible but skill is not in central allowlist.",
        });
      }
      if (allowImplicit !== true) {
        drifts.push({
          code: "model-invoked-implicit-mismatch",
          skill: slug,
          sidecar: relSidecar,
          details: "model-invoked-eligible requires allow_implicit_invocation=true.",
        });
      }
    }

    if (allowset.has(slug)) {
      if (behaviorClass !== "model-invoked-eligible") {
        drifts.push({
          code: "allowlisted-policy-mismatch",
          skill: slug,
          sidecar: relSidecar,
          details: "Allowlisted skill must declare behavior_class=model-invoked-eligible.",
        });
      }
      if (allowImplicit !== true) {
        drifts.push({
          code: "allowlisted-implicit-mismatch",
          skill: slug,
          sidecar: relSidecar,
          details: "Allowlisted skill must set allow_implicit_invocation=true.",
        });
      }
    }
  }

  for (const slug of allowlist) {
    if (!skillSlugs.includes(slug)) {
      drifts.push({
        code: "allowlisted-skill-missing",
        skill: slug,
        sidecar: `.github/skills/${slug}/agents/openai.yaml`,
        details: "Allowlisted skill does not exist under .github/skills.",
      });
    }
  }

  return {
    allowlist,
    declaredModelInvoked: [...new Set(declaredModelInvoked)].sort(),
    driftCount: drifts.length,
    drifts,
  };
}

function formatText(report) {
  const lines = [];
  lines.push("[sidecar-allowlist] Effective model-invoked allowlist");
  if (report.allowlist.length === 0) {
    lines.push("- (empty)");
  } else {
    for (const skill of report.allowlist) {
      lines.push(`- ${skill}`);
    }
  }

  lines.push("");
  lines.push("[sidecar-allowlist] Sidecars declaring model-invoked-eligible");
  if (report.declaredModelInvoked.length === 0) {
    lines.push("- (none)");
  } else {
    for (const skill of report.declaredModelInvoked) {
      lines.push(`- ${skill}`);
    }
  }

  lines.push("");
  lines.push(`[sidecar-allowlist] Drift count: ${report.driftCount}`);
  if (report.drifts.length === 0) {
    lines.push("[sidecar-allowlist] OK");
  } else {
    for (const drift of report.drifts) {
      lines.push(`[sidecar-allowlist] DRIFT ${drift.code} ${drift.sidecar} - ${drift.details}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  const report = analyze();

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(formatText(report));
  }

  if (flags.failOnDrift && report.driftCount > 0) {
    process.exit(1);
  }
}

main();
