#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "./config.mjs";
import { mcpToolSpecs } from "./mcp-contracts.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const packageJsonPath = join(repoRoot, "package.json");
const catalogDir = join(repoRoot, ".github", "harness", "catalog");
const catalogJsonPath = join(catalogDir, "harness-profile.json");
const llmsPath = join(repoRoot, "llms.txt");

function parseArgs(argv) {
  const args = { command: "json" };
  for (const arg of argv) {
    if (arg === "json" || arg === "llms" || arg === "sync") {
      args.command = arg;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function readPackageVersion() {
  if (!existsSync(packageJsonPath)) return "0.0.0";
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function inferToolTags(toolName) {
  const tags = new Set(["mcp"]);
  if (toolName.startsWith("graph-")) tags.add("analysis");
  if (toolName.startsWith("memory-")) tags.add("memory");
  if (toolName.startsWith("vector-")) {
    tags.add("rag");
    tags.add("tool-discovery");
  }
  if (toolName.startsWith("harness-")) {
    tags.add("workflow");
  }
  if (toolName.includes("discover")) tags.add("tool-discovery");
  return [...tags];
}

export function buildCatalog() {
  const config = loadConfig();
  const catalog = config.catalog ?? {};
  const routing = config.routing ?? {};
  const domainSpecialists = config.modelPolicy?.domainSpecialists ?? {};
  const selectionWizard = config.modelPolicy?.modelSelectionWizard ?? {};
  const intentProfiles = routing.intentProfiles ?? {};
  const profiles = routing.profiles ?? {};
  const version = readPackageVersion();

  const intents = Object.entries(intentProfiles).map(([intent, details]) => ({
    intent,
    description: details?.description ?? "",
    profile: details?.profile ?? null,
    keywords: Array.isArray(details?.keywords) ? details.keywords : [],
    tags: Array.isArray(details?.tags) ? details.tags : [],
  }));

  const profileItems = Object.entries(profiles).map(([name, details]) => ({
    name,
    description: details?.description ?? "",
    mode: details?.mode ?? "non-trivial",
    stages: Array.isArray(details?.stages) ? details.stages : [],
  }));

  const tools = mcpToolSpecs.map((spec) => ({
    name: spec.name,
    description: spec.description,
    tags: inferToolTags(spec.name),
  }));

  const modelDomains = Object.entries(domainSpecialists)
    .filter(([, details]) => details && typeof details === "object" && typeof details.primary === "string")
    .map(([domain, details]) => ({
      domain,
      tier: typeof details.tier === "string" ? details.tier : "unspecified",
      primary: details.primary,
      fallback: Array.isArray(details.fallback) ? details.fallback : [],
      companionSkills: Array.isArray(details.companionSkills) ? details.companionSkills : [],
      advisoryOnly: domainSpecialists.advisoryOnly === true,
    }));

  const modelSelectionLevels = Object.entries(selectionWizard.levels ?? {}).map(([level, details]) => ({
    level,
    label: typeof details?.label === "string" ? details.label : level,
    costRank: typeof details?.costRank === "number" ? details.costRank : null,
    qualityRank: typeof details?.qualityRank === "number" ? details.qualityRank : null,
    defaultModels: Array.isArray(details?.defaultModels) ? details.defaultModels : [],
  }));
  const modelModePackages = Object.entries(selectionWizard.modePackages ?? {}).flatMap(([mode, packages]) =>
    Object.entries(packages ?? {}).map(([level, details]) => ({
      mode,
      level,
      cloud: Array.isArray(details?.cloud) ? details.cloud : [],
      local: typeof details?.local === "string" ? details.local : null,
      context: typeof details?.context === "string" ? details.context : null,
    })),
  );

  return {
    meta: {
      name: catalog.name ?? "harness-kit",
      version,
      description:
        catalog.description ??
        "Project-agnostic AI agent harness with stage orchestration, loops, and MCP integration.",
      url: "https://github.com/<owner>/<repo>",
      generatedAt: new Date().toISOString(),
      license: catalog.license ?? "MIT",
    },
    taxonomy: {
      autonomyTier: catalog.taxonomy?.autonomyTier ?? "bounded",
      recoveryTier: catalog.taxonomy?.recoveryTier ?? "resumable",
      simplicityTier: catalog.taxonomy?.simplicityTier ?? "slightly complex",
      tags: Array.isArray(catalog.tags) ? catalog.tags : [],
    },
    routing: {
      profiles: profileItems,
      intents,
    },
    capabilities: {
      modelPolicy: {
        domainSpecialists: modelDomains,
        selectionWizard: {
          docsSource: selectionWizard.docsSource ?? null,
          snapshotDate: selectionWizard.snapshotDate ?? null,
          levels: modelSelectionLevels,
          modePackages: modelModePackages,
          supportedModelCount: Array.isArray(selectionWizard.supportedCopilotModels)
            ? selectionWizard.supportedCopilotModels.length
            : 0,
        },
      },
      mcp: {
        toolCount: tools.length,
        tools,
      },
      loops: {
        convergence: true,
        workflow: true,
        experiment: true,
        resumableExecution: true,
      },
    },
  };
}

export function renderLlmsTxt(catalog) {
  const lines = [
    `# ${catalog.meta.name}`,
    "",
    catalog.meta.description,
    "",
    "## Capability taxonomy",
    `- Autonomy tier: ${catalog.taxonomy.autonomyTier}`,
    `- Recovery tier: ${catalog.taxonomy.recoveryTier}`,
    `- Simplicity tier: ${catalog.taxonomy.simplicityTier}`,
    `- Tags: ${catalog.taxonomy.tags.join(", ")}`,
    "",
    "## Intent profiles",
    ...catalog.routing.intents.map(
      (intent) =>
        `- ${intent.intent}: profile=${intent.profile ?? "none"}; keywords=${intent.keywords.join(", ")}`,
    ),
    "",
    "## Domain model specialists",
    ...(catalog.capabilities.modelPolicy.domainSpecialists.length > 0
      ? catalog.capabilities.modelPolicy.domainSpecialists.map(
          (entry) =>
            `- ${entry.domain}: tier=${entry.tier}; primary=${entry.primary}; fallback=${entry.fallback.join(", ")}; companionSkills=${entry.companionSkills.join(", ")}; advisoryOnly=${entry.advisoryOnly}`,
        )
      : ["- none"]),
    "",
    "## Model selection wizard",
    `- Supported model snapshot: ${catalog.capabilities.modelPolicy.selectionWizard.snapshotDate ?? "unknown"}`,
    `- Source: ${catalog.capabilities.modelPolicy.selectionWizard.docsSource ?? "not configured"}`,
    `- Supported model count: ${catalog.capabilities.modelPolicy.selectionWizard.supportedModelCount}`,
    ...catalog.capabilities.modelPolicy.selectionWizard.levels.map(
      (entry) =>
        `- ${entry.level}: cost=${entry.costRank ?? "?"}/3; quality=${entry.qualityRank ?? "?"}/3; defaults=${entry.defaultModels.join(", ")}`,
    ),
    "### Mode packages",
    ...catalog.capabilities.modelPolicy.selectionWizard.modePackages.map(
      (entry) =>
        `- ${entry.mode}/${entry.level}: cloud=${entry.cloud.join(", ")}; local=${entry.local ?? "none"}; context=${entry.context ?? "not configured"}`,
    ),
    "",
    "## MCP tool discovery",
    `- Tool count: ${catalog.capabilities.mcp.toolCount}`,
    ...catalog.capabilities.mcp.tools.map(
      (tool) => `- ${tool.name}: tags=${tool.tags.join(", ")}`,
    ),
    "",
    "## Notes",
    "- Use `npm run harness:profile -- --task \"<task>\" --json` to map a task to an intent profile.",
    "- Use `npm run harness:mcp -- harness-tool-discover --intent <intent>` for on-demand tool routing.",
  ];
  return `${lines.join("\n")}\n`;
}

function printHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: [
          "node scripts/harness/harness-catalog.mjs json",
          "node scripts/harness/harness-catalog.mjs llms",
          "node scripts/harness/harness-catalog.mjs sync",
        ],
        outputs: {
          sync: [
            ".github/harness/catalog/harness-profile.json",
            "llms.txt",
          ],
        },
      },
      null,
      2,
    )}\n`,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const catalog = buildCatalog();
  const llms = renderLlmsTxt(catalog);
  if (args.command === "json") {
    process.stdout.write(`${JSON.stringify(catalog, null, 2)}\n`);
    return;
  }
  if (args.command === "llms") {
    process.stdout.write(llms);
    return;
  }

  mkdirSync(catalogDir, { recursive: true });
  writeFileSync(catalogJsonPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
  writeFileSync(llmsPath, llms, "utf8");
  process.stdout.write(
    `[harness-catalog] wrote ${catalogJsonPath}\n[harness-catalog] wrote ${llmsPath}\n`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `[harness-catalog] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(2);
  }
}
