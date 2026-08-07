#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createManifestAllowlist } from "./manifest-allowlist.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const defaultOutputRoot = join(repoRoot, "plugins", "agent-plugins", "harness-kit");
const schemaUrl = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const allowedSkills = Object.freeze(["wait-what"]);
const packageSkillPath = "skills/wait-what/SKILL.md";
const packageSkillDirectory = "skills/wait-what";
const allowedManifestKeys = new Set([
  "$schema",
  "name",
  "version",
  "description",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "extensions",
]);

function isDirectory(path) {
  return existsSync(path) && statSync(path).isDirectory();
}

function isRegularFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function readSkillSource(skillName) {
  if (skillName !== "wait-what") throw new Error(`Unsupported pilot skill: ${skillName}`);
  const skillRoot = join(repoRoot, ".github", "skills", "wait-what");
  const allowlist = createManifestAllowlist({ rootDir: skillRoot });
  return { content: allowlist.readUtf8Relative("SKILL.md", "canonical skill wait-what") };
}

function buildManifest() {
  return {
    $schema: schemaUrl,
    name: "harness-kit",
    version: "1.0.0",
    description: "Portable skills-only Agent Plugins pilot for the harness kit.",
    license: "MIT",
    keywords: ["agent", "skills", "harness"],
  };
}

function validateManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return ["plugin.json must contain a top-level object"];
  }
  for (const key of Object.keys(manifest)) {
    if (!allowedManifestKeys.has(key)) errors.push(`unknown manifest field: ${key}`);
  }
  if (manifest.$schema !== schemaUrl) errors.push("plugin.json has an unsupported $schema");
  if (
    typeof manifest.name !== "string" ||
    manifest.name.length < 1 ||
    manifest.name.length > 64 ||
    !/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(manifest.name)
  ) {
    errors.push("plugin.json name is not a valid Agent Plugins v1 name");
  }
  if (manifest.version !== undefined && typeof manifest.version !== "string") errors.push("plugin.json version must be a string");
  if (manifest.description !== undefined && typeof manifest.description !== "string") errors.push("plugin.json description must be a string");
  if (manifest.license !== undefined && typeof manifest.license !== "string") errors.push("plugin.json license must be a string");
  if (manifest.keywords !== undefined && (!Array.isArray(manifest.keywords) || manifest.keywords.some((keyword) => typeof keyword !== "string"))) {
    errors.push("plugin.json keywords must be an array of strings");
  }
  return errors;
}

export function exportAgentPlugin({ outputRoot = defaultOutputRoot } = {}) {
  const packageRoot = resolve(outputRoot);
  mkdirSync(packageRoot, { recursive: true });
  const packageAllowlist = createManifestAllowlist({ rootDir: packageRoot });
  const skillsRoot = packageAllowlist.materializeRelativePath("skills", "package skills directory");
  mkdirSync(skillsRoot, { recursive: true });
  writeFileSync(packageAllowlist.materializeRelativePath("plugin.json", "package manifest"), `${JSON.stringify(buildManifest(), null, 2)}\n`, "utf8");

  for (const skillName of allowedSkills) {
    const source = readSkillSource(skillName);
    const targetDirectory = packageAllowlist.materializeRelativePath(packageSkillDirectory, "package skill wait-what");
    mkdirSync(targetDirectory, { recursive: true });
    writeFileSync(packageAllowlist.materializeRelativePath(packageSkillPath, "package skill wait-what"), source.content, "utf8");
  }

  const validation = validateAgentPlugin({ packageRoot });
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  return { pluginName: buildManifest().name, skills: [...allowedSkills], packageRoot };
}

function validatePackageEntries(packageRoot, skillsRoot) {
  const errors = [];
  const rootEntries = readdirSync(packageRoot).sort();
  if (rootEntries.join("\n") !== "plugin.json\nskills") {
    errors.push(`package root must contain exactly plugin.json and skills (found ${rootEntries.join(", ")})`);
  }
  const skillEntries = readdirSync(skillsRoot).sort();
  if (skillEntries.join("\n") !== allowedSkills.join("\n")) {
    errors.push(`skills directory must contain exactly ${allowedSkills.join(", ")}`);
  }
  return errors;
}

function validateSkillEntry({ sourceRoot, packageRoot, skillName }) {
  const packageAllowlist = createManifestAllowlist({ rootDir: packageRoot });
  if (skillName !== "wait-what") return [`Unsupported pilot skill: ${skillName}`];
  const skillDirectory = packageAllowlist.materializeRelativePath(packageSkillDirectory, "package skill wait-what");
  const skillPath = packageAllowlist.materializeRelativePath(packageSkillPath, "package skill wait-what");
  if (!isDirectory(skillDirectory)) return [`skill entry is not a directory: ${skillName}`];
  const errors = [];
  const entries = readdirSync(skillDirectory).sort();
  if (entries.join("\n") !== "SKILL.md") errors.push(`skill ${skillName} must contain only SKILL.md`);
  if (!isRegularFile(skillPath)) return [...errors, `skill ${skillName} is missing SKILL.md`];
  const source = readSkillSource(skillName);
  if (packageAllowlist.readUtf8Relative(packageSkillPath, "package skill wait-what") !== source.content) errors.push(`skill ${skillName} is out of date`);
  return errors;
}

export function validateAgentPlugin({ packageRoot = defaultOutputRoot } = {}) {
  const resolvedPackageRoot = resolve(packageRoot);
  const packageAllowlist = createManifestAllowlist({ rootDir: resolvedPackageRoot });
  const manifestPath = packageAllowlist.materializeRelativePath("plugin.json", "package manifest");
  const skillsRoot = packageAllowlist.materializeRelativePath("skills", "package skills directory");
  const errors = [];
  if (!isRegularFile(manifestPath)) errors.push("plugin.json is missing or not a regular file");
  if (!isDirectory(skillsRoot)) errors.push("skills is missing or not a directory");
  if (errors.length > 0) return { ok: false, errors };

  try {
    const manifest = JSON.parse(packageAllowlist.readUtf8Relative("plugin.json", "package manifest"));
    errors.push(...validateManifest(manifest));
    if (JSON.stringify(manifest) !== JSON.stringify(buildManifest())) errors.push("plugin.json is out of date");
  } catch (error) {
    errors.push(`plugin.json is not valid JSON: ${error.message}`);
  }
  errors.push(...validatePackageEntries(resolvedPackageRoot, skillsRoot));
  for (const skillName of allowedSkills) errors.push(...validateSkillEntry({ packageRoot: resolvedPackageRoot, skillName }));
  return { ok: errors.length === 0, errors };
}

function parseArgs(argv) {
  const args = { command: "validate", outputRoot: defaultOutputRoot };
  for (const arg of argv) {
    if (["export", "validate", "--help", "-h"].includes(arg)) {
      if (arg === "--help" || arg === "-h") args.help = true;
      else args.command = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write(`${JSON.stringify({
    usage: [
      "node scripts/harness/agent-plugins-export.mjs export",
      "node scripts/harness/agent-plugins-export.mjs validate",
    ],
    defaultOutput: "plugins/agent-plugins/harness-kit",
    allowlistedSkills: allowedSkills,
  }, null, 2)}\n`);
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) return printHelp();
  if (args.command === "export") {
    const result = exportAgentPlugin();
    process.stdout.write(`[agent-plugins-export] wrote ${result.packageRoot}\n`);
    return;
  }
  const validation = validateAgentPlugin();
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  process.stdout.write(`[agent-plugins-export] valid ${defaultOutputRoot}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[agent-plugins-export] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }
}