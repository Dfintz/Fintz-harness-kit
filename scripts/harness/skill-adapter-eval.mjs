#!/usr/bin/env node
/**
 * Skill adapter eval — two-arm comparison of the routed skill alone (baseline) against the skill
 * plus its model-family adapter. Scenarios and deterministic checks live in
 * .github/harness/eval/skill-adapter-cases.json. Live runs pipe each prompt to an operator agent
 * command (same contract as eval/run-eval.mjs); results are diagnostic, not statistical.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { harnessRuntimeRoot, loadConfig, resolveModelFamily } from "./config.mjs";

const kitRoot = harnessRuntimeRoot;
const defaultCasesPath = ".github/harness/eval/skill-adapter-cases.json";
const runsDir = join(kitRoot, ".github", "harness", "runs");
const MIN_TARGETED_PER_FAMILY = 3;
// Paired-delta floor for a directional signal; one fully flipped check of weight 1 in a 7-weight case is ~0.14.
const SIGNAL_DELTA = 0.1;
const SIGNAL_MIN_REPEATS = 3;
const ANSI_ESCAPE = /\u001b\[[0-9;?]*[A-Za-z]/g;
const ACTIONS_HEADER = /^(?:#{1,6} ?)?\**ACTIONS:?\**$/i;
const ACTION_LINE = /^(?:[-*]|\d+[.)])? ?`?(RUN|WRITE|ASK|STOP)\b:? ?(.*)$/i;
const BASE_ENV_KEYS = [
  "PATH", "Path", "PATHEXT", "SystemRoot", "SYSTEMROOT", "ComSpec", "COMSPEC", "WINDIR",
  "TEMP", "TMP", "HOME", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "OLLAMA_HOST", "OLLAMA_MODELS",
];
const CHECK_TYPES = new Set([
  "regex", "notRegex", "regexWithinLines", "minCount", "maxWords",
  "actionIncludes", "actionExcludes", "lastAction", "maxActionCount",
]);

function toRegex(pattern, flags = "") {
  return new RegExp(pattern, flags);
}

function withFlag(flags, flag) {
  return flags.includes(flag) ? flags : `${flags}${flag}`;
}

function splitAtActions(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => ACTIONS_HEADER.test(line.trim()));
  return start < 0
    ? { body: lines, actionLines: [] }
    : { body: lines.slice(0, start), actionLines: lines.slice(start + 1) };
}

export function parseActions(text) {
  const actions = [];
  for (const line of splitAtActions(text).actionLines) {
    const match = ACTION_LINE.exec(line.trim());
    if (match) actions.push({ type: match[1].toUpperCase(), arg: match[2].replaceAll("`", "").trim() });
  }
  return actions;
}

function bodyBeforeActions(text) {
  return splitAtActions(text).body.join("\n");
}

function matchingActions(check, actions) {
  const types = check.actions ?? [check.action];
  const pattern = check.pattern ? toRegex(check.pattern, check.flags) : null;
  return actions.filter((action) => types.includes(action.type) && (!pattern || pattern.test(action.arg)));
}

export function runCheck(check, text, actions) {
  switch (check.type) {
    case "regex":
      return toRegex(check.pattern, check.flags).test(text);
    case "notRegex":
      return !toRegex(check.pattern, check.flags).test(text);
    case "regexWithinLines": {
      const head = text.split(/\r?\n/).filter((line) => line.trim()).slice(0, check.lines).join("\n");
      return toRegex(check.pattern, withFlag(check.flags ?? "", "m")).test(head);
    }
    case "minCount":
      return (text.match(toRegex(check.pattern, withFlag(check.flags ?? "", "g"))) ?? []).length >= check.count;
    case "maxWords":
      return bodyBeforeActions(text).split(/\s+/).filter(Boolean).length <= check.words;
    case "actionIncludes":
      return matchingActions(check, actions).length > 0;
    case "actionExcludes":
      return matchingActions(check, actions).length === 0;
    case "maxActionCount":
      return matchingActions(check, actions).length <= check.count;
    case "lastAction": {
      const last = actions.at(-1);
      return Boolean(last) && matchingActions(check, [last]).length === 1;
    }
    default:
      throw new Error(`unknown check type: ${check.type}`);
  }
}

export function scoreOutput(scenario, text) {
  const actions = parseActions(text);
  let earned = 0;
  let total = 0;
  const failed = [];
  for (const check of scenario.checks) {
    const weight = check.weight ?? 1;
    total += weight;
    if (runCheck(check, text, actions)) earned += weight;
    else failed.push(check.id);
  }
  return { score: total > 0 ? earned / total : 0, failed, actionCount: actions.length };
}

export function loadSuite(path = join(kitRoot, defaultCasesPath)) {
  const raw = readFileSync(path, "utf8");
  return { suite: JSON.parse(raw), hash: createHash("sha256").update(raw).digest("hex") };
}

function familySpec(config) {
  return config?.skillModelMapping?.modelFamilies?.families ?? {};
}

function kitMarkdownPath(relPath) {
  const resolved = resolve(kitRoot, String(relPath ?? ""));
  const rel = relative(kitRoot, resolved);
  if (!rel || rel.startsWith("..") || isAbsolute(rel) || !rel.endsWith(".md")) {
    throw new Error(`path must be a markdown file inside the harness kit: ${relPath}`);
  }
  return resolved;
}

function kitMarkdownExists(relPath) {
  try {
    return existsSync(kitMarkdownPath(relPath));
  } catch {
    return false;
  }
}

function readKitFile(relPath) {
  return readFileSync(kitMarkdownPath(relPath), "utf8");
}

export function buildPrompt(scenario, adapter) {
  const parts = [
    "You are executing one harness stage in a simulated environment. You cannot run tools; decide what you would do and report it.",
    `<skill path="${scenario.skill}">\n${readKitFile(scenario.skill)}\n</skill>`,
  ];
  if (adapter) parts.push(`<adapter path="${adapter}">\n${readKitFile(adapter)}\n</adapter>`);
  parts.push(
    `<context>\n${scenario.context}\n</context>`,
    `<task>\n${scenario.task}\n</task>`,
    "<response_format>\nWrite the stage output. End with a line containing only `ACTIONS:` followed by one action per line, in order, each one of:\nRUN <exact command>\nWRITE <repo-relative path>\nASK <question for the operator>\nSTOP <reason>\n</response_format>",
  );
  return parts.join("\n\n");
}

function validateScenario(scenario, errors) {
  if (!scenario.id) errors.push("scenario without id");
  if (!kitMarkdownExists(scenario.skill)) errors.push(`${scenario.id}: skill not found ${scenario.skill}`);
  if (!Array.isArray(scenario.checks) || scenario.checks.length === 0) errors.push(`${scenario.id}: no checks`);
  for (const check of scenario.checks ?? []) {
    if (!CHECK_TYPES.has(check.type)) errors.push(`${scenario.id}/${check.id}: unknown check type ${check.type}`);
  }
  const pass = scenario.fixtures?.pass;
  const fail = scenario.fixtures?.fail;
  if (typeof pass !== "string" || typeof fail !== "string") {
    errors.push(`${scenario.id}: pass and fail fixtures are required`);
    return;
  }
  const passScore = scoreOutput(scenario, pass).score;
  const failScore = scoreOutput(scenario, fail).score;
  if (passScore < 0.8) errors.push(`${scenario.id}: pass fixture scored ${passScore.toFixed(2)} (< 0.80)`);
  if (failScore > 0.4) errors.push(`${scenario.id}: fail fixture scored ${failScore.toFixed(2)} (> 0.40)`);
}

export function selfTest(suite, config) {
  const errors = [];
  const families = familySpec(config);
  const scenarios = Array.isArray(suite.scenarios) ? suite.scenarios : [];
  if (Object.keys(families).length === 0) errors.push("no skillModelMapping.modelFamilies configured");
  for (const scenario of scenarios) {
    validateScenario(scenario, errors);
    for (const target of scenario.targets ?? []) {
      if (!families[target]) errors.push(`${scenario.id}: unknown target family ${target}`);
    }
  }
  for (const [id, family] of Object.entries(families)) {
    if (!kitMarkdownExists(family.adapter)) errors.push(`${id}: adapter missing`);
    const targeted = scenarios.filter((scenario) => scenario.targets?.includes(id)).length;
    if (targeted < MIN_TARGETED_PER_FAMILY) {
      errors.push(`${id}: targeted by ${targeted} scenarios (< ${MIN_TARGETED_PER_FAMILY})`);
    }
  }
  return { ok: errors.length === 0, errors, scenarios: scenarios.length, families: Object.keys(families).length };
}

function childEnv(passEnv, family, model) {
  const env = {};
  for (const key of [...BASE_ENV_KEYS, ...passEnv]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  env.HARNESS_EVAL_FAMILY = family;
  if (model) env.HARNESS_EVAL_MODEL = model;
  return env;
}

function agentExecutable(agentCmd) {
  const first = agentCmd.trim().match(/^"([^"]+)"|^'([^']+)'|^(\S+)/);
  return basename(first?.[1] ?? first?.[2] ?? first?.[3] ?? "unknown");
}

// Lexical, best-effort: `ollama run` word-wraps piped output and breaks ACTIONS parsing.
export function assertAgentCommand(agentCmd) {
  if (/(?:^|[\s"'\\/])ollama(?:\.exe)?["']?\s+run\b/i.test(agentCmd)) {
    throw new Error('"ollama run" corrupts piped output; use --agent "node scripts/harness/ollama-agent.mjs --model <name:tag>"');
  }
}

export function declaredModelFamily(config, model, aliases = {}) {
  const canonical = aliases[model] ?? model;
  const unprefixed = /^[^/:]+\/[^/]+$/.test(canonical) ? canonical.slice(canonical.indexOf("/") + 1) : canonical;
  return resolveModelFamily(config, unprefixed).family;
}

function invokeAgent(agentCmd, prompt, env, timeoutMs) {
  const result = spawnSync(agentCmd, {
    shell: true,
    input: prompt,
    encoding: "utf8",
    env,
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });
  const output = String(result.stdout ?? "").replace(ANSI_ESCAPE, "");
  return { output, status: result.status, timedOut: result.error?.code === "ETIMEDOUT" };
}

function stats(values) {
  if (values.length === 0) return { mean: 0, stdev: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return { mean, stdev: Math.sqrt(variance) };
}

export function summarizeFamily(cases, repeats, identity = { declared: true, familyMatch: true }) {
  const valid = cases.filter((entry) => entry.valid !== false);
  const deltas = valid.map((entry) => entry.delta);
  const targeted = valid.filter((entry) => entry.targeted);
  const wins = targeted.filter((entry) => entry.delta > 1e-9).length;
  const losses = targeted.filter((entry) => entry.delta < -1e-9).length;
  const targetedDelta = stats(targeted.map((entry) => entry.delta)).mean;
  const minPairs = Math.min(...targeted.map((entry) => entry.validPairs ?? repeats), repeats);
  let signal = "inconclusive";
  let signalReason = null;
  if (!identity.declared) signalReason = "model-undeclared";
  else if (!identity.familyMatch) signalReason = "declared-model-family-mismatch";
  else if (targeted.length === 0 || minPairs < SIGNAL_MIN_REPEATS) signalReason = "insufficient-valid-repeats";
  else if (wins > losses && targetedDelta >= SIGNAL_DELTA) signal = "adapter-better";
  else if (losses > wins && targetedDelta <= -SIGNAL_DELTA) signal = "baseline-better";
  else signalReason = "below-threshold";
  return {
    allDelta: stats(deltas).mean,
    targetedDelta,
    targetedCases: targeted.length,
    invalidCases: cases.length - valid.length,
    wins,
    losses,
    ties: targeted.length - wins - losses,
    signal,
    signalReason,
  };
}

function runArm({ scenario, adapter, options, family, outputs, arm, repeat }) {
  const prompt = buildPrompt(scenario, adapter);
  const env = childEnv(options.passEnv, family, options.models[family]);
  const { output, status, timedOut } = invokeAgent(options.agentCmd, prompt, env, options.timeoutMs);
  const scored = scoreOutput(scenario, output);
  if (options.keepOutputs) outputs.push({ family, scenario: scenario.id, arm, repeat, output });
  return {
    arm,
    repeat,
    score: scored.score,
    failedChecks: scored.failed,
    actionCount: scored.actionCount,
    exitStatus: status,
    timedOut,
    valid: status === 0 && !timedOut,
    outputChars: output.length,
    outputSha256: createHash("sha256").update(output).digest("hex"),
  };
}

function runFamily(family, adapter, scenarios, options, outputs) {
  const cases = [];
  for (const scenario of scenarios) {
    const runs = [];
    for (let repeat = 1; repeat <= options.repeats; repeat += 1) {
      const order = repeat % 2 === 1 ? [null, adapter] : [adapter, null];
      for (const armAdapter of order) {
        const arm = armAdapter ? "adapter" : "baseline";
        process.stderr.write(`[skill-adapter-eval] ${family} ${scenario.id} ${arm} #${repeat}\n`);
        runs.push(runArm({ scenario, adapter: armAdapter, options, family, outputs, arm, repeat }));
      }
    }
    const scores = (arm) => runs.filter((run) => run.arm === arm && run.valid).map((run) => run.score);
    const baselineScores = scores("baseline");
    const adapterScores = scores("adapter");
    const validPairs = Math.min(baselineScores.length, adapterScores.length);
    const baseline = stats(baselineScores);
    const withAdapter = stats(adapterScores);
    cases.push({
      id: scenario.id,
      targeted: Boolean(scenario.targets?.includes(family)),
      valid: validPairs > 0,
      validPairs,
      baseline,
      adapter: withAdapter,
      delta: validPairs > 0 ? withAdapter.mean - baseline.mean : 0,
      runs,
    });
  }
  return cases;
}

export function runLive(suite, suiteHash, config, options) {
  const families = familySpec(config);
  const selected = options.families.length > 0 ? options.families : Object.keys(families);
  const scenarios = suite.scenarios.slice(0, options.maxCases ?? suite.scenarios.length);
  const outputs = [];
  const journal = {
    schemaVersion: 1,
    kind: "skill-adapter-eval",
    startedAt: new Date().toISOString(),
    suite: { path: defaultCasesPath, sha256: suiteHash, scenarios: scenarios.length },
    agent: agentExecutable(options.agentCmd),
    aliases: options.aliases,
    repeats: options.repeats,
    note: "Diagnostic only: deterministic checks on simulated actions; small n; not a significance test.",
    families: {},
  };
  for (const [id, family] of Object.entries(families)) {
    if (!selected.includes(id)) {
      journal.families[id] = { status: "untested" };
      continue;
    }
    const cases = runFamily(id, family.adapter, scenarios, options, outputs);
    const declaredModel = options.models[id] ?? null;
    const declaredFamily = declaredModel ? declaredModelFamily(config, declaredModel, options.aliases) : null;
    const familyMatch = declaredFamily === id;
    if (declaredModel && !familyMatch) {
      process.stderr.write(`[skill-adapter-eval] WARNING ${declaredModel} resolves to ${declaredFamily ?? "no family"}, not ${id}; signal forced inconclusive\n`);
    }
    journal.families[id] = {
      status: "tested",
      declaredModel,
      modelIdentity: declaredModel ? "operator-declared" : "undeclared",
      declaredModelFamily: declaredFamily,
      familyMatch,
      adapter: family.adapter,
      summary: summarizeFamily(cases, options.repeats, { declared: Boolean(declaredModel), familyMatch }),
      cases,
    };
  }
  journal.finishedAt = new Date().toISOString();
  mkdirSync(runsDir, { recursive: true });
  const stamp = journal.startedAt.replace(/[:.]/g, "-");
  const journalPath = join(runsDir, `skill-adapter-eval-${stamp}.json`);
  writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);
  if (options.keepOutputs) {
    writeFileSync(join(runsDir, `skill-adapter-eval-${stamp}.outputs.json`), `${JSON.stringify(outputs, null, 2)}\n`);
  }
  return { journal, journalPath };
}

const splitList = (raw) => raw.split(",").map((entry) => entry.trim()).filter(Boolean);
const positiveInt = (raw, min, fallback) => Math.max(min, Number.parseInt(raw, 10) || fallback);

const BOOLEAN_FLAGS = {
  "--self-test": "selfTest", "--json": "json", "--help": "help", "--keep-outputs": "keepOutputs",
};
const VALUE_FLAGS = {
  "--agent": (options, raw) => { options.agentCmd = raw; },
  "--family": (options, raw) => { options.families.push(...splitList(raw)); },
  "--pass-env": (options, raw) => { options.passEnv.push(...splitList(raw)); },
  "--model": (options, raw) => {
    const [family, model] = raw.split("=");
    if (!family || !model) throw new Error("--model expects family=model-id");
    options.models[family] = model;
  },
  "--alias": (options, raw) => {
    const [name, canonical] = raw.split("=");
    if (!name || !canonical) throw new Error("--alias expects deployment-name=canonical-model-id");
    options.aliases[name] = canonical;
  },
  "--repeats": (options, raw) => { options.repeats = positiveInt(raw, 1, 1); },
  "--max-cases": (options, raw) => { options.maxCases = positiveInt(raw, 1, 1); },
  "--timeout-ms": (options, raw) => { options.timeoutMs = positiveInt(raw, 1000, 180000); },
};

function parseArgs(argv) {
  const options = {
    selfTest: false, json: false, help: false, agentCmd: process.env.HARNESS_AGENT_CMD ?? null,
    families: [], models: {}, aliases: {}, passEnv: [], repeats: 3, maxCases: null, timeoutMs: 180000, keepOutputs: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (BOOLEAN_FLAGS[arg]) {
      options[BOOLEAN_FLAGS[arg]] = true;
      continue;
    }
    const apply = VALUE_FLAGS[arg];
    if (!apply) throw new Error(`unknown argument: ${arg}`);
    const raw = argv[i + 1];
    if (raw === undefined || raw.startsWith("--")) throw new Error(`${arg} requires a value`);
    apply(options, raw);
    i += 1;
  }
  return options;
}

const HELP = `Usage: node scripts/harness/skill-adapter-eval.mjs [--self-test] [--agent "<cmd>"] [options]

  --self-test            Validate suite shape, family coverage, and scorer fixtures (offline)
  --agent "<cmd>"        Agent command; prompt on stdin, answer on stdout (or HARNESS_AGENT_CMD)
  --family a,b           Families to run (default: all configured)
  --model family=id      Declare the model the agent command actually runs for a family
  --alias name=model-id  Map a deployment name to a canonical model id for the family check
  --repeats N            Paired repeats per case and arm (default 3)
  --max-cases N          Limit scenarios per family
  --timeout-ms N         Per-call timeout (default 180000)
  --pass-env A,B         Extra env var names forwarded to the agent (default: minimal env)
  --keep-outputs         Also write raw outputs to .github/harness/runs/ (gitignored)
  --json                 Print the result as JSON

Local:  --agent "node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b" (not "ollama run")
Hosted: --agent "node scripts/harness/hosted-agent.mjs" --pass-env OPENAI_API_KEY --model openai-coding=gpt-5.6-terra
`;

function printLiveSummary(journal, journalPath) {
  for (const [family, record] of Object.entries(journal.families)) {
    if (record.status !== "tested") {
      process.stdout.write(`[skill-adapter-eval] ${family}: untested\n`);
      continue;
    }
    const s = record.summary;
    const reason = s.signalReason ? ` (${s.signalReason})` : "";
    const invalid = s.invalidCases ? `, ${s.invalidCases} invalid cases` : "";
    process.stdout.write(
      `[skill-adapter-eval] ${family} (${record.declaredModel ?? "undeclared"}): targeted delta ${s.targetedDelta.toFixed(2)} ` +
        `(W${s.wins}/L${s.losses}/T${s.ties}), all delta ${s.allDelta.toFixed(2)} -> ${s.signal}${reason}${invalid}\n`,
    );
  }
  process.stdout.write(`[skill-adapter-eval] journal: ${journalPath}\n`);
}

function reportSelfTest(check, hash, options) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify({ ...check, suiteSha256: hash }, null, 2)}\n`);
    return;
  }
  for (const error of check.errors) process.stdout.write(`[skill-adapter-eval] FAIL ${error}\n`);
  process.stdout.write(`[skill-adapter-eval] self-test ${check.ok ? "PASS" : "FAIL"}: ${check.scenarios} scenarios, ${check.families} families\n`);
  if (!options.agentCmd && !options.selfTest) {
    process.stdout.write("[skill-adapter-eval] no --agent or HARNESS_AGENT_CMD; ran self-test only\n");
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const config = loadConfig();
  const { suite, hash } = loadSuite();
  const check = selfTest(suite, config);
  if (options.selfTest || !options.agentCmd) {
    reportSelfTest(check, hash, options);
    return check.ok ? 0 : 1;
  }
  if (!check.ok) {
    process.stderr.write(`[skill-adapter-eval] suite invalid; run --self-test\n`);
    return 1;
  }
  assertAgentCommand(options.agentCmd);
  const { journal, journalPath } = runLive(suite, hash, config, options);
  if (options.json) process.stdout.write(`${JSON.stringify(journal, null, 2)}\n`);
  else printLiveSummary(journal, journalPath);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`[skill-adapter-eval] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
