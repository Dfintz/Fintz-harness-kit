#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

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
  return relative(repoRoot, path).replaceAll("\\", "/");
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
  // Runtime artifacts in runs/ and committed memory records in memory/ are not
  // operator-facing documentation. Exclude them from script-reference checks to
  // keep validator output focused on harness source files.
  const excludedPrefixes = [
    join(repoRoot, ".github", "harness", "runs"),
    join(repoRoot, ".github", "harness", "memory"),
  ];
  const files = [];
  for (const root of roots) {
    walkFiles(
      root,
      (path) => path.endsWith(".md") && !excludedPrefixes.some((ex) => path.startsWith(ex)),
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

function isGeneratedOptimizedSkillDoc(markdownPath) {
  const rel = relativePath(markdownPath);
  if (!rel.startsWith(".github/harness/optimized-skills/")) return false;
  const filename = rel.split("/").pop() ?? "";
  return /--ollama--\d{4}-\d{2}-\d{2}\.md$/i.test(filename);
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

function validateRegistryPath(findings, code, subject, relativeRepoPath, level = "error") {
  if (/[*?]/.test(relativeRepoPath)) {
    const parentPath = relativeRepoPath.replace(/[\\/][^\\/]*[*?][^\\/]*$/, "");
    if (!parentPath || existsSync(join(repoRoot, parentPath))) return;
  }
  const resolved = join(repoRoot, relativeRepoPath);
  if (existsSync(resolved)) return;
  if (level === "warning") {
    addWarning(findings, code, subject, `${relativeRepoPath} does not exist.`);
    return;
  }
  addError(findings, code, subject, `${relativeRepoPath} does not exist.`);
}

function validateRegistryTooling(registry, findings) {
  const optimizer = registry.optimizer ?? {};
  for (const [key, value] of Object.entries(optimizer)) {
    if (typeof value !== "string") continue;
    if (!/[./\\]/.test(value)) continue;
    if (!/\.(?:mjs|js|ps1|py|md|json)$/i.test(value)) continue;
    validateRegistryPath(findings, "missing-optimizer-path", `optimizer.${key}`, value);
  }

  const memory = registry.memory ?? {};
  for (const key of ["protocol", "writeSkill", "migrateScript"]) {
    if (typeof memory[key] === "string") {
      validateRegistryPath(findings, "missing-memory-path", `memory.${key}`, memory[key]);
    }
  }

  const tooling = registry.tooling ?? {};
  for (const [key, value] of Object.entries(tooling)) {
    if (typeof value !== "string") continue;
    if (!/\.(?:mjs|js|ps1|py|json)$/i.test(value)) continue;
    validateRegistryPath(findings, "missing-tooling-path", `tooling.${key}`, value);
  }

  const evals = registry.evals ?? {};
  for (const [name, record] of Object.entries(evals)) {
    if (typeof record?.path === "string") {
      validateRegistryPath(findings, "missing-eval-path", `evals.${name}.path`, record.path);
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
    const skipGeneratedCitationWarnings = isGeneratedOptimizedSkillDoc(markdownPath);
    for (const match of text.matchAll(npmPattern)) {
      const scriptName = match[1];
      if (!Object.hasOwn(packageScripts, scriptName)) {
        if (skipGeneratedCitationWarnings) continue;
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
        if (skipGeneratedCitationWarnings) continue;
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

function validateNoExactDuplicateScriptBodies(findings) {
  const pkg = readJson(packageJsonPath);
  const scripts = pkg.scripts ?? {};
  const byBody = new Map();

  for (const [name, body] of Object.entries(scripts)) {
    if (typeof body !== "string") continue;
    const names = byBody.get(body) ?? [];
    names.push(name);
    byBody.set(body, names);
  }

  for (const [body, names] of byBody.entries()) {
    if (names.length < 2) continue;
    addError(
      findings,
      "duplicate-script-body",
      "package.json",
      `Scripts share an identical command body (${names.join(", ")}): ${body}`,
    );
  }
}

function parseArgs(argv) {
  const flags = {
    changedSurfaceWarnings: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--changed-surface-warnings") {
      flags.changedSurfaceWarnings = true;
    } else if (arg === "--changed-surface-base") {
      flags.changedSurfaceBase = argv[i + 1];
      i += 1;
    }
  }
  return flags;
}

function listChangedFiles(baseRef) {
  const relPaths = new Set();
  const collect = (args) => {
    const output = execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length > 0) relPaths.add(trimmed.replaceAll("\\", "/"));
    }
  };

  if (baseRef && String(baseRef).trim().length > 0) {
    collect(["diff", "--name-only", "--diff-filter=ACMR", `${baseRef}...HEAD`]);
    return [...relPaths];
  }

  collect(["diff", "--name-only", "--diff-filter=ACMR"]);
  collect(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  collect(["ls-files", "--others", "--exclude-standard"]);
  return [...relPaths];
}

function looksLikeCapabilitySurface(relPath) {
  return (
    relPath === ".github/harness/registry.json" ||
    relPath.startsWith("scripts/harness/") ||
    relPath.startsWith(".github/instructions/") ||
    relPath.startsWith(".github/skills/") ||
    relPath.startsWith(".claude/skills/")
  );
}

function collectMarkdownTextMap() {
  const map = new Map();
  for (const markdownPath of collectMarkdownFiles()) {
    map.set(relativePath(markdownPath), readFileSync(markdownPath, "utf8"));
  }
  return map;
}

function hasCitation(markdownTextMap, surfacePath) {
  const surfaceBasename = surfacePath.split("/").pop() ?? surfacePath;
  for (const text of markdownTextMap.values()) {
    if (text.includes(surfacePath) || text.includes(surfaceBasename)) {
      return true;
    }
  }
  return false;
}

function validateChangedSurfaceCitations(findings, options = {}) {
  let changedFiles;
  try {
    changedFiles = listChangedFiles(options.baseRef);
  } catch (error) {
    addWarning(
      findings,
      "changed-surface-scan-failed",
      "git",
      `Unable to inspect changed files for warning-mode surface checks: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  const surfaces = changedFiles.filter(looksLikeCapabilitySurface);
  if (surfaces.length === 0) {
    return;
  }

  const markdownTextMap = collectMarkdownTextMap();
  for (const surface of surfaces) {
    if (!hasCitation(markdownTextMap, surface)) {
      addWarning(
        findings,
        "missing-surface-citation",
        surface,
        "Changed capability surface has no citation in checked harness markdown docs (warning mode).",
      );
    }
  }
}

function classifyArtifactFamily(relPath) {
  const normalized = relPath.replaceAll("\\", "/");
  const lower = normalized.toLowerCase();
  const filename = lower.split("/").pop() ?? lower;

  if (lower.startsWith(".github/agents/")) {
    return null;
  }

  if (filename.startsWith("architect-challenge-verdict") || filename.includes("-challenge-verdict")) {
    return "challenge";
  }
  if (
    filename.startsWith("review-stage") ||
    filename.includes("review-breadth") ||
    filename.includes("review-depth") ||
    filename.includes("feedback-verdict")
  ) {
    return "review";
  }
  if (filename.includes("architecture-brief")) {
    return "architect";
  }
  return null;
}

function validateImmutabilityMarkers(findings, options = {}) {
  let changedFiles;
  try {
    changedFiles = listChangedFiles(options.baseRef);
  } catch (error) {
    addWarning(
      findings,
      "immutability-scan-failed",
      "git",
      `Unable to inspect changed files for immutability markers: ${error instanceof Error ? error.message : String(error)}`,
    );
    return;
  }

  for (const relPath of changedFiles) {
    if (!relPath.toLowerCase().endsWith(".md")) continue;
    const family = classifyArtifactFamily(relPath);
    if (!family) continue;

    const absolutePath = join(repoRoot, relPath);
    if (!existsSync(absolutePath)) continue;

    const text = readFileSync(absolutePath, "utf8");
    const frontmatter = parseFrontmatter(text);
    if (!frontmatter) {
      addError(
        findings,
        "missing-artifact-frontmatter",
        relPath,
        `Artifact family "${family}" requires frontmatter markers (artifact_family, immutability).`,
      );
      continue;
    }

    const declaredFamily = String(frontmatter.artifact_family ?? "").trim().toLowerCase();
    if (declaredFamily !== family) {
      addError(
        findings,
        "artifact-family-mismatch",
        relPath,
        `artifact_family must be "${family}" for this file pattern (found "${declaredFamily || "<missing>"}").`,
      );
    }

    const immutability = String(frontmatter.immutability ?? "").trim().toLowerCase();
    if (!["mutable", "frozen", "append-only"].includes(immutability)) {
      addError(
        findings,
        "invalid-immutability-marker",
        relPath,
        'immutability must be one of: "mutable", "frozen", "append-only".',
      );
      continue;
    }

    if (immutability === "frozen") {
      const immutableSince = String(frontmatter.immutable_since ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(immutableSince)) {
        addError(
          findings,
          "missing-immutable-since",
          relPath,
          'immutable_since is required in YYYY-MM-DD format when immutability is "frozen".',
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
  const flags = parseArgs(process.argv.slice(2));
  const registry = loadRegistry();
  const findings = [];
  validateWorkflowStages(registry, findings);
  validateLoopReferences(registry, findings);
  validateRegistryTooling(registry, findings);
  validateSkillEntries(registry, findings);
  validateCitedScripts(findings);
  validateNoExactDuplicateScriptBodies(findings);
  validateImmutabilityMarkers(findings, {
    baseRef: flags.changedSurfaceBase,
  });
  if (flags.changedSurfaceWarnings) {
    validateChangedSurfaceCitations(findings, {
      baseRef: flags.changedSurfaceBase,
    });
  }

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
