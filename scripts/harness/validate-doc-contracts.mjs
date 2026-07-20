#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

import { repoRoot } from "./config.mjs";
import { loadRegistry } from "./registry.mjs";

const packageJsonPath = join(repoRoot, "package.json");

function walkFiles(startPath, matcher, results = []) {
  if (!existsSync(startPath)) return results;
  const stats = statSync(startPath);
  if (stats.isFile()) {
    if (matcher(startPath)) results.push(startPath);
    return results;
  }
  for (const entry of readdirSync(startPath, { withFileTypes: true })) {
    const entryPath = join(startPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, matcher, results);
    } else if (matcher(entryPath)) {
      results.push(entryPath);
    }
  }
  return results;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function relativePath(path) {
  return relative(repoRoot, path).replace(/\\/g, "/");
}

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return null;
  const frontmatter = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    frontmatter[key] = value.replace(/^["']|["']$/g, "");
  }
  return frontmatter;
}

function collectMarkdownFiles() {
  const roots = [
    "AGENTS.md",
    ".github/harness",
    ".github/instructions",
    ".claude/skills",
    "skills/harness/SKILL.md",
  ].map((path) => join(repoRoot, path));
  const files = [];
  for (const root of roots) {
    walkFiles(
      root,
      (path) => path.endsWith(".md"),
      files,
    );
  }
  return files;
}

function addError(list, code, subject, details) {
  list.push({ level: "error", code, subject, details });
}

function addWarning(list, code, subject, details) {
  list.push({ level: "warning", code, subject, details });
}

function validateWorkflowStages(registry, findings) {
  const stageOrder = Array.isArray(registry.workflow?.order) ? registry.workflow.order : [];
  const stages = registry.workflow?.stages ?? {};

  for (const stageName of stageOrder) {
    const stage = stages[stageName];
    if (!stage) {
      addError(findings, "missing-stage", stageName, "workflow.order references a stage that is not defined.");
      continue;
    }

    for (const key of ["instruction", "skill", "claudeSkill", "agent"]) {
      if (!stage[key]) continue;
      const resolved = join(repoRoot, stage[key]);
      if (!existsSync(resolved)) {
        addError(findings, "missing-stage-path", `${stageName}.${key}`, `${stage[key]} does not exist.`);
      }
    }

    if (stage.tool) {
      const scriptMatch = stage.tool.match(/scripts\/[^\s"']+/);
      if (scriptMatch) {
        const scriptPath = join(repoRoot, scriptMatch[0]);
        if (!existsSync(scriptPath)) {
          addError(findings, "missing-stage-tool", `${stageName}.tool`, `${scriptMatch[0]} does not exist.`);
        }
      }
    }

    const metadata = stage.stageMetadata;
    if (!metadata) {
      addError(findings, "missing-stage-metadata", stageName, "stageMetadata is required.");
      continue;
    }

    if (typeof metadata.title !== "string" || !metadata.title.trim()) {
      addError(findings, "missing-stage-title", stageName, "stageMetadata.title must be a non-empty string.");
    }

    if (!metadata.promptPack?.outputFile || !metadata.promptPack?.deliverable) {
      addError(findings, "missing-prompt-pack", stageName, "stageMetadata.promptPack.outputFile and deliverable are required.");
    }
    if (!Array.isArray(metadata.promptPack?.instructions) || metadata.promptPack.instructions.length === 0) {
      addError(findings, "missing-prompt-instructions", stageName, "stageMetadata.promptPack.instructions must be a non-empty array.");
    }

    if (!metadata.contract?.outputArtifact?.file || !metadata.contract?.outputArtifact?.kind) {
      addError(findings, "missing-output-artifact", stageName, "stageMetadata.contract.outputArtifact.file and kind are required.");
    }
    if (!Array.isArray(metadata.contract?.requiredArtifacts)) {
      addError(findings, "missing-required-artifacts", stageName, "stageMetadata.contract.requiredArtifacts must be an array.");
    }
    if (!metadata.contract?.approval || !Array.isArray(metadata.contract.approval.requiredFor)) {
      addError(findings, "missing-approval-contract", stageName, "stageMetadata.contract.approval.requiredFor must be an array.");
    }
  }
}

function validateLoopReferences(registry, findings) {
  const loops = Array.isArray(registry.loops) ? registry.loops : [];
  for (const loop of loops) {
    if (!loop?.path) {
      addError(findings, "missing-loop-path", loop?.name ?? "<unknown>", "Loop path is required.");
      continue;
    }
    const loopPath = join(repoRoot, loop.path);
    if (!existsSync(loopPath)) {
      addWarning(findings, "missing-loop-file", loop.name ?? loop.path, `${loop.path} does not exist.`);
      continue;
    }
    try {
      const loopJson = readJson(loopPath);
      if (loopJson.name !== loop.name) {
        addWarning(findings, "loop-name-mismatch", loop.name, `Loop file declares "${loopJson.name}" instead of "${loop.name}".`);
      }
    } catch (error) {
      addWarning(findings, "invalid-loop-json", loop.name ?? loop.path, error instanceof Error ? error.message : String(error));
    }
  }
}

function validateSkillEntries(registry, findings) {
  const skills = Array.isArray(registry.skills) ? registry.skills : [];
  for (const skill of skills) {
    const paths = Array.isArray(skill.paths) ? skill.paths : [];
    if (paths.length === 0) {
      addError(findings, "missing-skill-paths", skill.name ?? "<unknown>", "registry skill entry must declare at least one path.");
      continue;
    }

    const existingPaths = paths
      .map((path) => ({ path, resolved: join(repoRoot, path) }))
      .filter((entry) => existsSync(entry.resolved));
    if (existingPaths.length === 0) {
      addWarning(findings, "missing-skill-files", skill.name ?? "<unknown>", "None of the declared skill paths exist; registry entry may be ahead of the checked-in skill surfaces.");
      continue;
    }

    for (const entry of existingPaths) {
      const text = readFileSync(entry.resolved, "utf8");
      const frontmatter = parseFrontmatter(text);
      if (!frontmatter) {
        addWarning(findings, "missing-frontmatter", entry.path, "SKILL.md has no YAML frontmatter; metadata validation skipped.");
        continue;
      }

      const expectedName = entry.resolved.split(/[/\\]/).slice(-2, -1)[0];
      if (!frontmatter.name) {
        addError(findings, "missing-skill-name", entry.path, "Frontmatter must declare name.");
      } else if (frontmatter.name !== expectedName) {
        addError(findings, "skill-name-mismatch", entry.path, `Frontmatter name "${frontmatter.name}" does not match directory "${expectedName}".`);
      }

      if (!frontmatter.description) {
        addError(findings, "missing-skill-description", entry.path, "Frontmatter must declare description.");
      }
    }
  }
}

function validateCitedScripts(findings) {
  const pkg = readJson(packageJsonPath);
  const packageScripts = pkg.scripts ?? {};
  const markdownFiles = collectMarkdownFiles();

  const npmPattern = /npm run ([a-zA-Z0-9:_-]+)/g;
  const scriptPathPattern = /\b(?:\.\/)?(scripts\/[A-Za-z0-9._/-]+\.(?:mjs|js|ps1|py|sh))\b/g;

  for (const markdownPath of markdownFiles) {
    const text = readFileSync(markdownPath, "utf8");
    for (const match of text.matchAll(npmPattern)) {
      const scriptName = match[1];
      if (!Object.hasOwn(packageScripts, scriptName)) {
        addWarning(
          findings,
          "missing-package-script",
          relativePath(markdownPath),
          `References npm script "${scriptName}" which is not defined in package.json.`,
        );
      }
    }

    for (const match of text.matchAll(scriptPathPattern)) {
      const citedPath = match[1];
      const resolved = join(repoRoot, citedPath);
      if (!existsSync(resolved)) {
        addWarning(
          findings,
          "missing-cited-script",
          relativePath(markdownPath),
          `References ${citedPath} which does not exist.`,
        );
      }
    }
  }
}

function renderFindings(findings) {
  if (findings.length === 0) {
    return "[docs-contracts] OK\n";
  }
  const lines = findings.map(
    (finding) =>
      `[docs-contracts] ${finding.level.toUpperCase()} ${finding.code} ${finding.subject} - ${finding.details}`,
  );
  return `${lines.join("\n")}\n`;
}

function main() {
  const registry = loadRegistry();
  const findings = [];
  validateWorkflowStages(registry, findings);
  validateLoopReferences(registry, findings);
  validateSkillEntries(registry, findings);
  validateCitedScripts(findings);

  process.stdout.write(renderFindings(findings));
  if (findings.some((finding) => finding.level === "error")) {
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `[docs-contracts] ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(2);
}
