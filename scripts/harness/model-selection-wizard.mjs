#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { loadConfig } from "./config.mjs";

const VALID_LEVELS = ["cheap", "balanced", "high"];
const DOMAIN_METADATA_KEYS = new Set(["description", "advisoryOnly"]);

function parseArgs(argv) {
  const args = { command: "wizard", json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (["wizard", "recommend", "list", "check"].includes(arg)) {
      args.command = arg;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--domain" || arg === "--mode" || arg === "--level") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      args[arg.slice(2)] = value;
      index += 1;
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

function normalizeId(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/_/g, "-")
    .replace(/\./g, ".");
}

function getWizardConfig(config = loadConfig()) {
  const modelPolicy = config.modelPolicy ?? {};
  const wizard = modelPolicy.modelSelectionWizard ?? {};
  const domainSpecialists = modelPolicy.domainSpecialists ?? {};
  const supportedModels = Array.isArray(wizard.supportedCopilotModels)
    ? wizard.supportedCopilotModels
    : [];
  const supportedById = new Map(supportedModels.map((model) => [normalizeId(model.id), model]));
  const domains = Object.keys(domainSpecialists).filter((key) => {
    const details = domainSpecialists[key];
    return !DOMAIN_METADATA_KEYS.has(key) && details && typeof details === "object" && typeof details.primary === "string";
  });

  return {
    docsSource: wizard.docsSource ?? "https://docs.github.com/en/copilot/reference/ai-models/supported-models",
    snapshotDate: wizard.snapshotDate ?? "unknown",
    levels: wizard.levels ?? {},
    modePackages: wizard.modePackages ?? {},
    domainLevelDefaults: wizard.domainLevelDefaults ?? {},
    domainSpecialists,
    domains,
    supportedModels,
    supportedById,
  };
}

function getModelAvailability(wizardConfig, modelId) {
  const normalizedId = normalizeId(modelId);
  const model = wizardConfig.supportedById.get(normalizedId);
  if (!model) {
    return {
      id: normalizedId,
      supported: false,
      releaseStatus: "not-listed",
      warning: `Not found in supported Copilot models snapshot from ${wizardConfig.snapshotDate}`,
    };
  }
  return {
    id: model.id,
    name: model.name,
    provider: model.provider,
    supported: true,
    releaseStatus: model.releaseStatus,
    vscodeMinimum: model.vscodeMinimum ?? null,
    extendedCapabilities: Array.isArray(model.extendedCapabilities) ? model.extendedCapabilities : [],
    retirementDate: model.retirementDate ?? null,
    suggestedAlternative: model.suggestedAlternative ?? null,
    notes: model.notes ?? null,
  };
}

function modelsForSelection(wizardConfig, domain, level) {
  const normalizedDomain = normalizeId(domain);
  const normalizedLevel = normalizeId(level);
  const domainDefaults = wizardConfig.domainLevelDefaults[normalizedDomain] ?? {};
  const levelDetails = wizardConfig.levels[normalizedLevel] ?? {};
  const specialist = wizardConfig.domainSpecialists[normalizedDomain] ?? {};
  const configuredModels = Array.isArray(domainDefaults[normalizedLevel]) && domainDefaults[normalizedLevel].length > 0
    ? domainDefaults[normalizedLevel]
    : [specialist.primary, ...(Array.isArray(specialist.fallback) ? specialist.fallback : [])].filter(Boolean);
  const fallbackDefaults = Array.isArray(levelDetails.defaultModels) ? levelDetails.defaultModels : [];
  return [...new Set([...configuredModels, ...fallbackDefaults])];
}

function recommendModel({ domain, level, config = loadConfig() }) {
  const wizardConfig = getWizardConfig(config);
  const normalizedDomain = normalizeId(domain);
  const normalizedLevel = normalizeId(level);

  if (!wizardConfig.domains.includes(normalizedDomain)) {
    throw new Error(`Unknown domain "${domain}". Choose one of: ${wizardConfig.domains.join(", ")}`);
  }
  if (!VALID_LEVELS.includes(normalizedLevel)) {
    throw new Error(`Unknown level "${level}". Choose one of: ${VALID_LEVELS.join(", ")}`);
  }

  const levelDetails = wizardConfig.levels[normalizedLevel] ?? {};
  const candidates = modelsForSelection(wizardConfig, normalizedDomain, normalizedLevel).map((modelId) =>
    getModelAvailability(wizardConfig, modelId),
  );
  const selected = candidates.find((candidate) => candidate.supported && candidate.releaseStatus === "GA") ?? candidates[0];

  return {
    domain: normalizedDomain,
    level: normalizedLevel,
    levelLabel: levelDetails.label ?? normalizedLevel,
    costRank: levelDetails.costRank ?? null,
    qualityRank: levelDetails.qualityRank ?? null,
    performance: levelDetails.performance ?? "No performance note configured.",
    selected,
    candidates,
    docsSource: wizardConfig.docsSource,
    snapshotDate: wizardConfig.snapshotDate,
  };
}

function recommendModePackage({ mode, level, config = loadConfig() }) {
  const wizardConfig = getWizardConfig(config);
  const normalizedMode = normalizeId(mode);
  const normalizedLevel = normalizeId(level);
  const modeDetails = wizardConfig.modePackages[normalizedMode];

  if (!modeDetails) {
    throw new Error(`Unknown mode "${mode}". Choose one of: ${Object.keys(wizardConfig.modePackages).join(", ")}`);
  }
  if (!VALID_LEVELS.includes(normalizedLevel)) {
    throw new Error(`Unknown level "${level}". Choose one of: ${VALID_LEVELS.join(", ")}`);
  }

  const levelDetails = wizardConfig.levels[normalizedLevel] ?? {};
  const packageDetails = modeDetails[normalizedLevel] ?? {};
  const cloudModels = Array.isArray(packageDetails.cloud) ? packageDetails.cloud : [];
  const candidates = cloudModels.map((modelId) => getModelAvailability(wizardConfig, modelId));
  const selected = candidates.find((candidate) => candidate.supported && candidate.releaseStatus === "GA") ?? candidates[0] ?? null;

  return {
    mode: normalizedMode,
    level: normalizedLevel,
    levelLabel: levelDetails.label ?? normalizedLevel,
    costRank: levelDetails.costRank ?? null,
    qualityRank: levelDetails.qualityRank ?? null,
    performance: levelDetails.performance ?? "No performance note configured.",
    selected,
    candidates,
    localModel: packageDetails.local ?? null,
    context: packageDetails.context ?? null,
    docsSource: wizardConfig.docsSource,
    snapshotDate: wizardConfig.snapshotDate,
  };
}

function checkConfiguredModels(config = loadConfig()) {
  const wizardConfig = getWizardConfig(config);
  const referenced = new Set();

  for (const details of Object.values(wizardConfig.domainSpecialists)) {
    if (!details || typeof details !== "object") continue;
    if (typeof details.primary === "string") referenced.add(details.primary);
    if (Array.isArray(details.fallback)) details.fallback.forEach((model) => referenced.add(model));
  }
  for (const details of Object.values(wizardConfig.levels)) {
    if (Array.isArray(details?.defaultModels)) details.defaultModels.forEach((model) => referenced.add(model));
  }
  for (const domainDefaults of Object.values(wizardConfig.domainLevelDefaults)) {
    if (!domainDefaults || typeof domainDefaults !== "object") continue;
    for (const models of Object.values(domainDefaults)) {
      if (Array.isArray(models)) models.forEach((model) => referenced.add(model));
    }
  }
  for (const modePackages of Object.values(wizardConfig.modePackages)) {
    if (!modePackages || typeof modePackages !== "object") continue;
    for (const packageDetails of Object.values(modePackages)) {
      if (!packageDetails || typeof packageDetails !== "object") continue;
      if (Array.isArray(packageDetails.cloud)) packageDetails.cloud.forEach((model) => referenced.add(model));
    }
  }

  const checks = [...referenced].sort().map((modelId) => getModelAvailability(wizardConfig, modelId));
  return {
    ok: checks.every((check) => check.supported),
    docsSource: wizardConfig.docsSource,
    snapshotDate: wizardConfig.snapshotDate,
    checkedModels: checks,
  };
}

function renderRecommendation(result) {
  const subject = result.domain ? `Domain: ${result.domain}` : `Mode: ${result.mode}`;
  const lines = [
    subject,
    `Level: ${result.levelLabel} (cost ${result.costRank}/3, quality ${result.qualityRank}/3)`,
    `Performance: ${result.performance}`,
    `Selected: ${result.selected?.name ?? result.selected?.id ?? "none"} (${result.selected?.provider ?? "unknown"}, ${result.selected?.releaseStatus ?? "not listed"})`,
    result.localModel ? `Local model: ${result.localModel}` : null,
    result.context ? `Context: ${result.context}` : null,
    `VS Code minimum: ${result.selected?.vscodeMinimum ?? "not listed"}`,
    `Supported snapshot: ${result.snapshotDate} ${result.docsSource}`,
    "Candidates:",
    ...result.candidates.map((candidate) => {
      const status = candidate.supported ? candidate.releaseStatus : "not listed";
      const retirement = candidate.retirementDate ? `; retires ${candidate.retirementDate}` : "";
      return `- ${candidate.name ?? candidate.id}: ${status}${retirement}`;
    }),
  ].filter(Boolean);
  return `${lines.join("\n")}\n`;
}

function renderModelList(wizardConfig) {
  const lines = [
    `Supported Copilot model snapshot: ${wizardConfig.snapshotDate}`,
    `Source: ${wizardConfig.docsSource}`,
    "",
    ...wizardConfig.supportedModels.map((model) => {
      const vscode = model.vscodeMinimum ? `; VS Code >= ${model.vscodeMinimum}` : "";
      const retirement = model.retirementDate ? `; retires ${model.retirementDate}` : "";
      return `- ${model.name} (${model.provider}, ${model.releaseStatus}${vscode}${retirement})`;
    }),
  ];
  return `${lines.join("\n")}\n`;
}

function renderCheck(result) {
  const failures = result.checkedModels.filter((check) => !check.supported);
  const lines = [
    `Model availability check: ${result.ok ? "OK" : "FAILED"}`,
    `Snapshot: ${result.snapshotDate}`,
    `Source: ${result.docsSource}`,
    "",
    ...result.checkedModels.map((check) => `- ${check.id}: ${check.supported ? check.releaseStatus : check.warning}`),
  ];
  if (failures.length > 0) {
    lines.push("", `Missing: ${failures.map((failure) => failure.id).join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

async function runInteractive() {
  const wizardConfig = getWizardConfig();
  const rl = createInterface({ input, output });
  try {
    const domains = wizardConfig.domains;
    const domainAnswer = await rl.question(`Domain (${domains.join("/")}): `);
    const levelAnswer = await rl.question("Cost/quality level (cheap/balanced/high): ");
    const result = recommendModel({ domain: domainAnswer || domains[0], level: levelAnswer || "balanced" });
    output.write(renderRecommendation(result));
  } finally {
    rl.close();
  }
}

function printHelp() {
  output.write(`Usage:\n  node scripts/harness/model-selection-wizard.mjs wizard\n  node scripts/harness/model-selection-wizard.mjs recommend --domain frontend --level balanced [--json]\n  node scripts/harness/model-selection-wizard.mjs recommend --mode dev --level high [--json]\n  node scripts/harness/model-selection-wizard.mjs list [--json]\n  node scripts/harness/model-selection-wizard.mjs check [--json]\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  if (args.command === "wizard") {
    await runInteractive();
    return;
  }

  const wizardConfig = getWizardConfig();
  if (args.command === "list") {
    if (args.json) output.write(`${JSON.stringify(wizardConfig.supportedModels, null, 2)}\n`);
    else output.write(renderModelList(wizardConfig));
    return;
  }

  if (args.command === "check") {
    const result = checkConfiguredModels();
    if (args.json) output.write(`${JSON.stringify(result, null, 2)}\n`);
    else output.write(renderCheck(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (args.command === "recommend") {
    if (!args.level || (!args.domain && !args.mode)) {
      throw new Error("recommend requires --level plus either --domain or --mode");
    }
    const result = args.mode
      ? recommendModePackage({ mode: args.mode, level: args.level })
      : recommendModel({ domain: args.domain, level: args.level });
    if (args.json) output.write(`${JSON.stringify(result, null, 2)}\n`);
    else output.write(renderRecommendation(result));
  }
}

if (process.argv[1] && process.argv[1].endsWith("model-selection-wizard.mjs")) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`[model-selection-wizard] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(2);
  }
}

export {
  checkConfiguredModels,
  getModelAvailability,
  getWizardConfig,
  recommendModePackage,
  recommendModel,
};
