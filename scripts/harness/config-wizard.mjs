#!/usr/bin/env node
/**
 * config-wizard — pick the model for each harness stage, validate the independence rules, and write
 * routing.stageModels (+ the active stage list) into harness.config.json.
 *
 * Interactive:
 *   node scripts/harness/config-wizard.mjs                 # guided prompts
 *
 * Scriptable / CI (no prompts):
 *   node scripts/harness/config-wizard.mjs --preset best --dry-run
 *   node scripts/harness/config-wizard.mjs --set implement=claude-fable-5 --set feedback=gpt-5.5 --yes
 *   node scripts/harness/config-wizard.mjs --preset best --stages understand,architect,implement,feedback
 *   node scripts/harness/config-wizard.mjs --self-test
 *
 * The model-separation rules are imported from prompt-router.mjs so the wizard and the router can
 * never disagree. No deps, no network — Node built-ins only.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stageSeparationErrors } from "./prompt-router.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const configPath = join(repoRoot, "harness.config.json");

// Canonical stage order. The wizard preserves this order in the written stage list.
export const STAGE_ORDER = [
  "understand",
  "architect",
  "architect-challenge",
  "implement",
  "review-breadth",
  "review-depth",
  "feedback",
];

// Curated model catalog with the job each is strongest at (2026-06 benchmarks). Users may also type
// any other model id at the prompt.
export const MODEL_CATALOG = [
  { id: "claude-opus-4.8", provider: "anthropic", note: "architecture · code review · adjudication" },
  { id: "claude-fable-5", provider: "anthropic", note: "top agentic coder (verify availability)" },
  { id: "gemini-3.1-pro", provider: "google", note: "long-context · abstract reasoning · cheapest" },
  { id: "gpt-5.5", provider: "openai", note: "terminal agent · lowest hallucination" },
];

// Per-stage recommendation, shown as the default in the wizard.
export const RECOMMENDED = {
  understand: "gemini-3.1-pro",
  architect: "claude-opus-4.8",
  "architect-challenge": "gemini-3.1-pro",
  implement: "claude-fable-5",
  "review-breadth": "claude-opus-4.8",
  "review-depth": "gemini-3.1-pro",
  feedback: "gpt-5.5",
};

// Named presets. Each is a complete, separation-valid stage->model map.
export const PRESETS = {
  best: { ...RECOMMENDED },
  "two-provider": {
    understand: "claude-opus-4.8",
    architect: "claude-opus-4.8",
    "architect-challenge": "gpt-5.5",
    implement: "gpt-5.5",
    "review-breadth": "claude-opus-4.8",
    "review-depth": "claude-opus-4.8",
    feedback: "gpt-5.5",
  },
  budget: {
    understand: "gemini-3.1-pro",
    architect: "gemini-3.1-pro",
    "architect-challenge": "gpt-5.5",
    implement: "gpt-5.5",
    "review-breadth": "gemini-3.1-pro",
    "review-depth": "gemini-3.1-pro",
    feedback: "gpt-5.5",
  },
};

function fail(message, code = 2) {
  process.stderr.write(`[config-wizard] ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const flags = { _: [], set: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run" || arg === "--yes" || arg === "--strict" || arg === "--json" || arg === "--self-test" || arg === "--help") {
      flags[arg.slice(2)] = true;
    } else if (arg === "--preset") {
      flags.preset = argv[++i];
    } else if (arg === "--stages") {
      flags.stages = argv[++i];
    } else if (arg === "--out") {
      flags.out = argv[++i];
    } else if (arg === "--set") {
      const [stage, model] = String(argv[++i] ?? "").split("=");
      if (stage && model) flags.set[stage] = model;
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

/**
 * Build selections (stages + per-stage models) from non-interactive flags.
 * @returns {{ stages: string[], models: Record<string,string> }}
 */
export function selectionsFromFlags(flags) {
  const models = {};
  if (flags.preset) {
    if (!PRESETS[flags.preset]) {
      fail(`unknown preset: ${flags.preset} (choose: ${Object.keys(PRESETS).join(", ")})`);
    }
    Object.assign(models, PRESETS[flags.preset]);
  }
  Object.assign(models, flags.set);

  let stages;
  if (flags.stages) {
    stages = flags.stages.split(",").map((s) => s.trim()).filter(Boolean);
    const unknown = stages.filter((s) => !STAGE_ORDER.includes(s));
    if (unknown.length) fail(`unknown stage(s): ${unknown.join(", ")}`);
  } else {
    // Default to every stage that has a model assigned, in canonical order.
    stages = STAGE_ORDER.filter((s) => models[s]);
  }
  // Keep only models for the active stages, in canonical order.
  const orderedStages = STAGE_ORDER.filter((s) => stages.includes(s));
  const activeModels = {};
  for (const s of orderedStages) if (models[s]) activeModels[s] = models[s];
  return { stages: orderedStages, models: activeModels };
}

// Stages whose absence is worth flagging, with the consequence of leaving them out.
const RECOMMENDED_PRESENCE = {
  "architect-challenge": "the Brief won't be cross-model challenged before Implement",
  "review-breadth": "the implementation won't get a breadth review",
  "review-depth": "the architectural gates won't be re-run on the diff",
  feedback: "reviewer challenges won't be adjudicated",
};

/**
 * Compute non-blocking warnings for a selection. The wizard never refuses a choice — it lets you
 * build whatever pipeline you want (even a single stage) and surfaces the trade-offs. Note: the
 * runtime router still ENFORCES the independence rules, so a separation warning here will become a
 * hard error when the config is actually used.
 */
export function selectionWarnings({ stages, models }) {
  const warnings = [];
  for (const s of stages) {
    if (!models[s]) warnings.push(`stage "${s}" is active but has no model assigned.`);
  }
  for (const e of stageSeparationErrors(models)) {
    warnings.push(`independence: ${e} — the router will reject this at runtime.`);
  }
  if (stages.length === 0) {
    warnings.push("no stages selected — this clears the per-stage routing.");
  } else if (stages.length === 1) {
    warnings.push(
      `only one stage ("${stages[0]}") selected — the gated pipeline and cross-model independence don't apply.`,
    );
  }
  for (const [s, why] of Object.entries(RECOMMENDED_PRESENCE)) {
    if (stages.length > 1 && !stages.includes(s)) {
      warnings.push(`stage "${s}" excluded — ${why}.`);
    }
  }
  const distinct = new Set(stages.map((s) => models[s]).filter(Boolean));
  if (stages.length > 1 && distinct.size === 1) {
    warnings.push(`all stages use the same model (${[...distinct][0]}) — no cross-model independence.`);
  }
  return warnings;
}

/** @returns {{ ok: boolean, warnings: string[] }} ok means "no warnings", never "refused". */
export function validateSelections(sel) {
  const warnings = selectionWarnings(sel);
  return { ok: warnings.length === 0, warnings };
}

/** Build the harness.config.json patch from a selection (pure). */
export function buildConfigPatch({ stages, models }) {
  return {
    routing: {
      stageModels: { ...models },
      nonTrivialStages: [...stages],
      profiles: { feature: { stages: [...stages] } },
    },
  };
}

/** Apply the patch onto an existing config object (shallow-merge at the keys we own). */
export function applyPatch(config, patch) {
  const next = { ...config };
  const routing = { ...(config.routing ?? {}) };
  routing.stageModels = patch.routing.stageModels;
  routing.nonTrivialStages = patch.routing.nonTrivialStages;
  const profiles = { ...(routing.profiles ?? {}) };
  profiles.feature = { ...(profiles.feature ?? {}), stages: patch.routing.profiles.feature.stages };
  routing.profiles = profiles;
  next.routing = routing;
  return next;
}

function renderSummary({ stages, models }) {
  const lines = ["[config-wizard] selected per-stage models:"];
  for (const s of stages) {
    const tag = models[s] === RECOMMENDED[s] ? " (recommended)" : "";
    lines.push(`  ${s} -> ${models[s]}${tag}`);
  }
  return lines.join("\n");
}

// ---- interactive ----------------------------------------------------------

function catalogMenu() {
  return MODEL_CATALOG.map((m, i) => `    ${i + 1}. ${m.id}  — ${m.note}`).join("\n");
}

async function runInteractive(flags) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (q, def) => {
    const a = (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim();
    return a || def || "";
  };

  process.stdout.write(
    "Harness stage-model wizard.\n" +
      "You'll choose which stages to include and the model for each. Nothing is blocked — unusual\n" +
      "choices just print a warning.\n",
  );

  // A preset only PREFILLS the suggested default per stage; you still confirm each stage and model.
  const seedName = (await ask(`Prefill defaults from a preset? (${Object.keys(PRESETS).join("/")}/none)`, "best")).toLowerCase();
  const seed = PRESETS[seedName] ?? RECOMMENDED;

  const models = {};
  const stages = [];
  for (const stage of STAGE_ORDER) {
    const include = (await ask(`Include stage "${stage}"? (Y/n)`, "y")).toLowerCase();
    if (include.startsWith("n")) continue;
    stages.push(stage);
    process.stdout.write(`  Models:\n${catalogMenu()}\n  (enter a number, type any model id, or accept the default)\n`);
    const pick = await ask(`  Model for "${stage}"`, seed[stage] ?? RECOMMENDED[stage]);
    const byNum = MODEL_CATALOG[Number(pick) - 1];
    models[stage] = byNum ? byNum.id : pick;
  }
  const selection = selectionsFromFlags({ set: models, stages: stages.join(","), _: [] });

  process.stdout.write(`${renderSummary(selection)}\n`);
  const { warnings } = validateSelections(selection);
  if (warnings.length) {
    process.stdout.write(`[config-wizard] warnings (not blocking):\n  - ${warnings.join("\n  - ")}\n`);
  }
  const write = (await ask("Write to harness.config.json? (y/n)", "y")).toLowerCase();
  rl.close();
  if (!write.startsWith("y")) {
    process.stdout.write("[config-wizard] no changes written.\n");
    return;
  }
  writeConfig(selection, flags.out);
}

// ---- write / non-interactive ---------------------------------------------

function writeConfig(selection, outPath) {
  const target = outPath ? resolve(repoRoot, outPath) : configPath;
  if (!existsSync(target)) fail(`config not found: ${target}`);
  const config = JSON.parse(readFileSync(target, "utf8"));
  const next = applyPatch(config, buildConfigPatch(selection));
  writeFileSync(target, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  process.stdout.write(`[config-wizard] wrote ${target}\n`);
}

function runNonInteractive(flags) {
  const selection = selectionsFromFlags(flags);
  if (selection.stages.length === 0) {
    fail("no stages selected — pass --preset, --set, or run interactively (no flags).");
  }
  const { ok, warnings } = validateSelections(selection);
  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ ...selection, ok, warnings }, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderSummary(selection)}\n`);
    if (warnings.length) {
      process.stdout.write(`[config-wizard] warnings (not blocking):\n  - ${warnings.join("\n  - ")}\n`);
    }
  }
  // Warnings never block by default; --strict turns them into a hard failure (for CI gates).
  if (!ok && flags.strict) {
    fail("aborting due to warnings (--strict).", 1);
  }
  if (flags["dry-run"]) {
    if (!flags.json) {
      process.stdout.write(
        `[config-wizard] dry run — would write routing.stageModels + active stages. Re-run with --yes to apply.\n`,
      );
    }
    return;
  }
  if (!flags.yes) {
    fail("refusing to write without confirmation — pass --yes (or use --dry-run).", 1);
  }
  writeConfig(selection, flags.out);
}

// ---- self-test ------------------------------------------------------------

function runSelfTest() {
  const cases = [];
  for (const [name, models] of Object.entries(PRESETS)) {
    const sel = selectionsFromFlags({ preset: name, set: {} });
    const { warnings } = validateSelections(sel);
    cases.push({ name: `preset "${name}" has no warnings`, pass: warnings.length === 0, detail: warnings.join("; ") });
  }
  // A deliberate conflict must be warned about (not blocked).
  const conflict = validateSelections({
    stages: ["implement", "review-breadth"],
    models: { implement: "m", "review-breadth": "m" },
  });
  cases.push({
    name: "conflict (implement == breadth) is warned",
    pass: conflict.warnings.some((w) => w.startsWith("independence:")),
  });
  // Picking a single stage warns but is allowed.
  const single = validateSelections({ stages: ["architect"], models: { architect: "m" } });
  cases.push({
    name: "single-stage selection warns but is allowed",
    pass: single.warnings.some((w) => w.includes("only one stage")),
  });

  // Flag parsing: --set overrides preset; --stages subsets.
  const sel = selectionsFromFlags({
    preset: "best",
    set: { feedback: "gpt-5.5" },
    stages: "understand,architect,implement,feedback",
  });
  cases.push({
    name: "stages subset + set override applied",
    pass:
      sel.stages.join(",") === "understand,architect,implement,feedback" &&
      sel.models.feedback === "gpt-5.5" &&
      !("review-depth" in sel.models),
  });

  // Patch shape + apply round-trips stageModels.
  const patched = applyPatch({ routing: { defaultMode: "x" } }, buildConfigPatch(sel));
  cases.push({
    name: "applyPatch sets stageModels + preserves other routing keys",
    pass: patched.routing.defaultMode === "x" && patched.routing.stageModels.architect === "claude-opus-4.8",
  });

  const failed = cases.filter((c) => !c.pass);
  for (const c of cases) process.stdout.write(`  ${c.pass ? "✓" : "✗"} ${c.name}\n`);
  process.stdout.write(`[config-wizard] self-test ${failed.length === 0 ? "PASSED" : "FAILED"}\n`);
  return failed.length === 0;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    process.stdout.write(
      "usage: config-wizard [--preset best|two-provider|budget] [--set stage=model]... " +
        "[--stages a,b,c] [--dry-run|--yes] [--strict] [--json] [--self-test]\n" +
        "  run with no flags for the interactive wizard. warnings never block unless --strict.\n",
    );
    return;
  }
  if (flags["self-test"]) {
    process.exit(runSelfTest() ? 0 : 1);
  }
  const nonInteractive = flags.preset || Object.keys(flags.set).length > 0 || flags.stages;
  if (nonInteractive) {
    runNonInteractive(flags);
  } else {
    await runInteractive(flags);
  }
}

await main();
