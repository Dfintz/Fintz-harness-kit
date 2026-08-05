#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

import { loadConfig, repoRoot } from "./config.mjs";
import { loadRegistry } from "./registry.mjs";

const packageJsonPath = join(repoRoot, "package.json");
const skillsRoot = join(repoRoot, ".github", "skills");
const sidecarSchemaPath = join(repoRoot, ".github", "harness", "schemas", "skill-openai-sidecar.schema.json");
const userInvokedPilotSkills = new Set(["wait-what", "to-questionnaire"]);

function getModelInvokedAllowlist() {
  const config = loadConfig();
  const configured = config?.sidecarPolicy?.modelInvokedEligibleSkills;
  if (!Array.isArray(configured)) return new Set();
  const normalized = configured
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return new Set(normalized);
}

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
    sidecarOnly: false,
    strictPilotPolicy: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--changed-surface-warnings") {
      flags.changedSurfaceWarnings = true;
    } else if (arg === "--sidecar-only") {
      flags.sidecarOnly = true;
    } else if (arg === "--strict-pilot-policy") {
      flags.strictPilotPolicy = true;
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

function coerceYamlScalar(rawValue) {
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

function parseStrictTwoLevelYaml(yamlText, subject, findings) {
  const root = {};
  let currentSection = null;
  const lines = yamlText.split(/\r?\n/);

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber += 1) {
    const rawLine = lines[lineNumber];
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) {
      continue;
    }

    if (rawLine.includes("\t")) {
      addError(
        findings,
        "invalid-sidecar-yaml",
        subject,
        `Tabs are not allowed in sidecar YAML (line ${lineNumber + 1}).`,
      );
      return null;
    }

    if (/^\S[^:]*:\s*$/.test(rawLine)) {
      const sectionName = rawLine.slice(0, rawLine.indexOf(":"));
      if (Object.hasOwn(root, sectionName)) {
        addError(
          findings,
          "duplicate-sidecar-key",
          subject,
          `Duplicate top-level key "${sectionName}" in sidecar YAML.`,
        );
        return null;
      }
      root[sectionName] = {};
      currentSection = sectionName;
      continue;
    }

    if (/^\s{2}\S[^:]*:\s*.+$/.test(rawLine)) {
      if (!currentSection) {
        addError(
          findings,
          "invalid-sidecar-yaml",
          subject,
          `Nested key appears before any top-level section (line ${lineNumber + 1}).`,
        );
        return null;
      }
      const trimmed = rawLine.trim();
      const separator = trimmed.indexOf(":");
      const key = trimmed.slice(0, separator).trim();
      const value = coerceYamlScalar(trimmed.slice(separator + 1));
      if (Object.hasOwn(root[currentSection], key)) {
        addError(
          findings,
          "duplicate-sidecar-key",
          subject,
          `Duplicate key "${currentSection}.${key}" in sidecar YAML.`,
        );
        return null;
      }
      root[currentSection][key] = value;
      continue;
    }

    addError(
      findings,
      "invalid-sidecar-yaml",
      subject,
      `Unsupported YAML shape at line ${lineNumber + 1}; expected strict two-level mapping.`,
    );
    return null;
  }

  return root;
}

function validateSchemaValue(value, schema, path, findings, subject) {
  if (!schema || typeof schema !== "object") return;

  if (Object.hasOwn(schema, "const") && value !== schema.const) {
    addError(findings, "invalid-sidecar-contract", subject, `${path} must be ${JSON.stringify(schema.const)}.`);
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    addError(
      findings,
      "invalid-sidecar-contract",
      subject,
      `${path} must be one of: ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}.`,
    );
    return;
  }

  const expectedType = schema.type;
  if (expectedType === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      addError(findings, "invalid-sidecar-contract", subject, `${path} must be an object.`);
      return;
    }

    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const requiredKey of required) {
      if (!Object.hasOwn(value, requiredKey)) {
        addError(findings, "invalid-sidecar-contract", subject, `${path}.${requiredKey} is required.`);
      }
    }

    const properties = schema.properties && typeof schema.properties === "object" ? schema.properties : {};
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) {
          addError(findings, "invalid-sidecar-contract", subject, `${path}.${key} is not allowed by schema.`);
        }
      }
    }

    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      if (!Object.hasOwn(value, propertyName)) continue;
      validateSchemaValue(value[propertyName], propertySchema, `${path}.${propertyName}`, findings, subject);
    }
    return;
  }

  if (expectedType === "string") {
    if (typeof value !== "string") {
      addError(findings, "invalid-sidecar-contract", subject, `${path} must be a string.`);
      return;
    }
    if (typeof schema.minLength === "number" && value.length < schema.minLength) {
      addError(findings, "invalid-sidecar-contract", subject, `${path} must have length >= ${schema.minLength}.`);
    }
    if (typeof schema.maxLength === "number" && value.length > schema.maxLength) {
      addError(findings, "invalid-sidecar-contract", subject, `${path} must have length <= ${schema.maxLength}.`);
    }
    if (typeof schema.pattern === "string") {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        addError(findings, "invalid-sidecar-contract", subject, `${path} does not match required pattern.`);
      }
    }
    return;
  }

  if (expectedType === "boolean") {
    if (typeof value !== "boolean") {
      addError(findings, "invalid-sidecar-contract", subject, `${path} must be a boolean.`);
    }
  }
}

function validateSidecarPolicySemantics(parsed, skillSlug, sidecarRelPath, findings, options = {}) {
  const policy = parsed?.policy;
  if (!policy || typeof policy !== "object") return;

  const behaviorClass = policy.behavior_class;
  const allowImplicit = policy.allow_implicit_invocation;
  const modelInvokedAllowlist = options.modelInvokedAllowlist ?? new Set();

  if (behaviorClass === "model-invoked-eligible" && allowImplicit !== true) {
    addError(
      findings,
      "invalid-sidecar-policy-semantics",
      sidecarRelPath,
      "policy.behavior_class=model-invoked-eligible requires policy.allow_implicit_invocation=true.",
    );
  }

  if (
    (behaviorClass === "explicit-invocation-required" || behaviorClass === "user-invoked-only") &&
    allowImplicit !== false
  ) {
    addError(
      findings,
      "invalid-sidecar-policy-semantics",
      sidecarRelPath,
      `policy.behavior_class=${behaviorClass} requires policy.allow_implicit_invocation=false.`,
    );
  }

  if (userInvokedPilotSkills.has(skillSlug) && behaviorClass !== "user-invoked-only") {
    addError(
      findings,
      "invalid-sidecar-policy-class",
      sidecarRelPath,
      `Pilot skill "${skillSlug}" must declare policy.behavior_class=user-invoked-only.`,
    );
  }

  if (behaviorClass === "model-invoked-eligible" && !modelInvokedAllowlist.has(skillSlug)) {
    addError(
      findings,
      "invalid-model-invoked-allowlist",
      sidecarRelPath,
      `Skill "${skillSlug}" must be listed in harness.config.json sidecarPolicy.modelInvokedEligibleSkills to use model-invoked-eligible.`,
    );
  }

  if (modelInvokedAllowlist.has(skillSlug) && behaviorClass !== "model-invoked-eligible") {
    addError(
      findings,
      "allowlisted-skill-policy-mismatch",
      sidecarRelPath,
      `Allowlisted skill "${skillSlug}" must declare policy.behavior_class=model-invoked-eligible.`,
    );
  }
}

function isPilotSkill(skillText) {
  const frontmatter = parseFrontmatter(skillText) ?? {};
  const headingMatch = skillText.match(/^#\s+(.+)$/m);
  const heading = headingMatch ? headingMatch[1] : "";
  const description = String(frontmatter.description ?? "");
  if (/\(pilot\)/i.test(heading)) return true;
  if (/^optional\s+user-invoked\b/i.test(description)) return true;
  return false;
}

function validateStrictPilotPolicy(parsed, skillText, sidecarRelPath, findings) {
  if (!isPilotSkill(skillText)) return;
  const behaviorClass = parsed?.policy?.behavior_class;
  if (behaviorClass !== "user-invoked-only") {
    addError(
      findings,
      "invalid-pilot-sidecar-policy",
      sidecarRelPath,
      "Pilot skills must declare policy.behavior_class=user-invoked-only.",
    );
  }
}

function validateSkillSidecarContracts(findings, options = {}) {
  if (!existsSync(sidecarSchemaPath)) {
    addError(
      findings,
      "missing-sidecar-schema",
      ".github/harness/schemas/skill-openai-sidecar.schema.json",
      "Sidecar schema file does not exist.",
    );
    return;
  }

  const schema = readJson(sidecarSchemaPath);
  const modelInvokedAllowlist = options.modelInvokedAllowlist ?? new Set();
  if (!existsSync(skillsRoot)) {
    addWarning(findings, "missing-skills-root", ".github/skills", "Skills root not found; sidecar validation skipped.");
    return;
  }

  const skillDirs = readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const skillDir of skillDirs) {
    const skillRoot = join(skillsRoot, skillDir.name);
    const skillDoc = join(skillRoot, "SKILL.md");
    if (!existsSync(skillDoc)) continue;

    const sidecarPath = join(skillRoot, "agents", "openai.yaml");
    const sidecarRelPath = relativePath(sidecarPath);
    if (!existsSync(sidecarPath)) {
      addError(findings, "missing-sidecar", sidecarRelPath, "Every .github skill must provide agents/openai.yaml.");
      continue;
    }

    const sidecarText = readFileSync(sidecarPath, "utf8");
    const parsed = parseStrictTwoLevelYaml(sidecarText, sidecarRelPath, findings);
    if (!parsed) continue;

    validateSchemaValue(parsed, schema, "sidecar", findings, sidecarRelPath);
    validateSidecarPolicySemantics(parsed, skillDir.name, sidecarRelPath, findings, {
      modelInvokedAllowlist,
    });
    if (options.strictPilotPolicy) {
      const skillText = readFileSync(skillDoc, "utf8");
      validateStrictPilotPolicy(parsed, skillText, sidecarRelPath, findings);
    }
  }

  for (const allowlistedSkill of modelInvokedAllowlist) {
    const skillDocPath = join(skillsRoot, allowlistedSkill, "SKILL.md");
    if (!existsSync(skillDocPath)) {
      addError(
        findings,
        "missing-allowlisted-skill",
        `harness.config.json sidecarPolicy.modelInvokedEligibleSkills.${allowlistedSkill}`,
        "Allowlisted skill does not exist under .github/skills.",
      );
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
  const findings = [];
  const modelInvokedAllowlist = getModelInvokedAllowlist();
  if (!flags.sidecarOnly) {
    const registry = loadRegistry();
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
  }

  validateSkillSidecarContracts(findings, {
    strictPilotPolicy: flags.strictPilotPolicy,
    modelInvokedAllowlist,
  });

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
