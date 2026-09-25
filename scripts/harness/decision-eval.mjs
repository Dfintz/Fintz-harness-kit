#!/usr/bin/env node
/**
 * Scores the local decision sidecar against deterministic routing on a labelled case set.
 * Read-only: never mutates harness.config.json and never changes route authority.
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateDecisionAdvisory } from "./decision-advisory.mjs";
import { loadConfig, planTask } from "./prompt-router.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_CASES = join(repoRoot, ".github", "harness", "eval", "decision-intent-cases.json");

function parseArgs(argv) {
  const values = {
    cases: DEFAULT_CASES,
    endpoint: process.env.HARNESS_DECISION_ENDPOINT_EVAL ?? null,
    model: process.env.HARNESS_DECISION_MODEL ?? null,
    revision: process.env.HARNESS_DECISION_REVISION ?? null,
    timeoutMs: 15000,
    json: false,
    requireSidecar: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${name} requires a value`);
      return value;
    };
    if (name === "--cases") values.cases = next();
    else if (name === "--endpoint") values.endpoint = next();
    else if (name === "--model") values.model = next();
    else if (name === "--revision") values.revision = next();
    else if (name === "--timeout-ms") values.timeoutMs = Number(next());
    else if (name === "--json") values.json = true;
    else if (name === "--require-sidecar") values.requireSidecar = true;
    else throw new Error(`unknown option: ${name}`);
  }
  return values;
}

// The fixture is scored against a transient policy so the committed config stays disabled.
function evaluationConfig(options) {
  const config = structuredClone(loadConfig());
  const policy = config.modelPolicy?.localDecisionSidecar;
  if (!policy) throw new Error("modelPolicy.localDecisionSidecar is missing from harness.config.json");
  policy.enabled = true;
  policy.timeoutMs = options.timeoutMs;
  if (options.endpoint) policy.endpoint = options.endpoint;
  if (options.model) policy.model = options.model;
  if (options.revision) policy.revision = options.revision;
  return config;
}

function loadCases(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(parsed.cases) || parsed.cases.length === 0) {
    throw new Error(`${path} contains no cases`);
  }
  return parsed;
}

function emptyTally() {
  return { correct: 0, wrong: 0, abstained: 0 };
}

export function summarise(rows, minProbability) {
  const deterministic = emptyTally();
  const sidecar = emptyTally();
  let confidentWrong = 0;
  let unavailable = 0;

  for (const row of rows) {
    if (row.deterministic === null) deterministic.abstained += 1;
    else if (row.deterministic === row.expected) deterministic.correct += 1;
    else deterministic.wrong += 1;

    if (row.status === "unavailable") {
      unavailable += 1;
      sidecar.abstained += 1;
      continue;
    }
    if (row.selected === row.expected) sidecar.correct += 1;
    else sidecar.wrong += 1;
    if (row.selected !== row.expected && (row.probability ?? 0) >= minProbability) confidentWrong += 1;
  }

  return { total: rows.length, deterministic, sidecar, confidentWrong, unavailable, minProbability };
}

function provenance(cases) {
  const counts = {};
  for (const item of cases) {
    const level = item.labelledBy ?? "unspecified";
    counts[level] = (counts[level] ?? 0) + 1;
  }
  return counts;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const fixture = loadCases(options.cases);
  const config = evaluationConfig(options);
  const policy = config.modelPolicy.localDecisionSidecar;
  const minProbability = policy.minProbability ?? 0.7;

  const rows = [];
  for (const item of fixture.cases) {
    const route = planTask(item.task, config, {});
    const receipt = await evaluateDecisionAdvisory({ task: item.task, route, config });
    rows.push({
      id: item.id,
      task: item.task,
      expected: item.expected,
      labelledBy: item.labelledBy ?? "unspecified",
      deterministic: route.intent ?? null,
      deterministicSource: route.intentSource ?? null,
      selected: receipt?.selected ?? null,
      probability: receipt?.selectedProbability ?? null,
      margin: receipt?.margin ?? null,
      status: receipt?.status ?? "unavailable",
      latencyMs: receipt?.latencyMs ?? null,
    });
  }

  const summary = summarise(rows, minProbability);
  const levels = provenance(fixture.cases);
  const humanLabelled = (levels["human-labelled"] ?? 0) + (levels["history-derived"] ?? 0);
  const required = fixture.promotionRequires?.minHumanLabelledCases ?? 0;
  const promotionEligible = humanLabelled >= required && summary.confidentWrong <= (fixture.promotionRequires?.maxConfidentWrong ?? 0);

  if (options.json) {
    process.stdout.write(`${JSON.stringify({ summary, levels, humanLabelled, required, promotionEligible, rows }, null, 2)}\n`);
  } else {
    for (const row of rows) {
      process.stdout.write(
        [
          row.id.padEnd(8),
          row.task.slice(0, 40).padEnd(40),
          `want=${row.expected.padEnd(26)}`,
          `sidecar=${String(row.selected).padEnd(26)}`,
          `p=${row.probability === null ? "----" : row.probability.toFixed(2)}`,
          row.status.padEnd(10),
          `router=${row.deterministic ?? "none"}`,
        ].join(" ") + "\n",
      );
    }
    const { deterministic, sidecar } = summary;
    process.stdout.write(`\ncases:              ${summary.total}\n`);
    process.stdout.write(`deterministic:      ${deterministic.correct} correct / ${deterministic.wrong} wrong / ${deterministic.abstained} abstained\n`);
    process.stdout.write(`sidecar:            ${sidecar.correct} correct / ${sidecar.wrong} wrong / ${sidecar.abstained} abstained\n`);
    process.stdout.write(`confident-wrong:    ${summary.confidentWrong} (wrong at p >= ${minProbability})\n`);
    process.stdout.write(`sidecar unavailable:${String(summary.unavailable).padStart(2)}\n`);
    process.stdout.write(`label provenance:   ${JSON.stringify(levels)}\n`);
    process.stdout.write(`promotion eligible: ${promotionEligible ? "yes" : "no"} (${humanLabelled}/${required} human-labelled)\n`);
  }

  if (options.requireSidecar && summary.unavailable > 0) {
    process.stderr.write(`[decision-eval] sidecar unavailable for ${summary.unavailable} case(s)\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(`[decision-eval] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
