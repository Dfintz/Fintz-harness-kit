#!/usr/bin/env node
import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "../config.mjs";
import {
  assertAgentCommand,
  declaredModelFamily,
  loadSuite,
  parseActions,
  scoreOutput,
  selfTest,
  summarizeFamily,
} from "../skill-adapter-eval.mjs";

test("shipped suite passes self-test with >=3 targeted scenarios per family", () => {
  const { suite } = loadSuite();
  const result = selfTest(suite, loadConfig());
  assert.deepEqual(result.errors, []);
  assert.ok(result.families >= 8);
});

test("self-test fails when a family is under-targeted", () => {
  const { suite } = loadSuite();
  const trimmed = {
    ...suite,
    scenarios: suite.scenarios.map((scenario) => ({
      ...scenario,
      targets: (scenario.targets ?? []).filter((family) => family !== "gemini"),
    })),
  };
  const result = selfTest(trimmed, loadConfig());
  assert.ok(result.errors.some((error) => error.startsWith("gemini: targeted by 0")));
});

test("self-test rejects skill paths outside the kit or not markdown", () => {
  const { suite } = loadSuite();
  const [first, ...rest] = suite.scenarios;
  for (const skill of ["../outside/SKILL.md", "package.json"]) {
    const result = selfTest({ ...suite, scenarios: [{ ...first, skill }, ...rest] }, loadConfig());
    assert.ok(result.errors.some((error) => error.includes("skill not found")), skill);
  }
});

test("parseActions tolerates bullets, numbering, backticks, and bold headers", () => {
  const actions = parseActions("text\n**ACTIONS:**\n- RUN `npm test`\n2. WRITE src/a.mjs\nSTOP: done\nnot an action");
  assert.deepEqual(actions, [
    { type: "RUN", arg: "npm test" },
    { type: "WRITE", arg: "src/a.mjs" },
    { type: "STOP", arg: "done" },
  ]);
  assert.deepEqual(parseActions("no actions block\nRUN npm test"), []);
  assert.deepEqual(parseActions("### ACTIONS:\nSTOP done"), [{ type: "STOP", arg: "done" }]);
});

test("output without an ACTIONS block cannot pass action checks", () => {
  const { suite } = loadSuite();
  const scenario = suite.scenarios.find((entry) => entry.id === "repeated-failure-stop");
  const result = scoreOutput(scenario, "The same error happened twice, so I stop.");
  assert.ok(result.failed.includes("ends-by-handing-back"));
});

test("signal stays inconclusive below the repeat floor and needs paired wins plus delta", () => {
  const cases = [
    { targeted: true, delta: 0.3 },
    { targeted: true, delta: 0.2 },
    { targeted: true, delta: 0 },
    { targeted: false, delta: -0.5 },
  ];
  assert.equal(summarizeFamily(cases, 1).signal, "inconclusive");
  assert.equal(summarizeFamily(cases, 3).signal, "adapter-better");
  const mixed = [
    { targeted: true, delta: 0.4 },
    { targeted: true, delta: -0.1 },
    { targeted: true, delta: -0.1 },
  ];
  assert.equal(summarizeFamily(mixed, 3).signal, "inconclusive");
  const worse = mixed.map((entry) => ({ ...entry, delta: -Math.abs(entry.delta) }));
  assert.equal(summarizeFamily(worse, 3).signal, "baseline-better");
});

test("signal is forced inconclusive for undeclared, mismatched, or under-sampled runs", () => {
  const strong = [
    { targeted: true, delta: 0.3, validPairs: 3 },
    { targeted: true, delta: 0.3, validPairs: 3 },
  ];
  assert.equal(summarizeFamily(strong, 3).signal, "adapter-better");
  assert.equal(summarizeFamily(strong, 3, { declared: false, familyMatch: false }).signalReason, "model-undeclared");
  assert.equal(summarizeFamily(strong, 3, { declared: true, familyMatch: false }).signalReason, "declared-model-family-mismatch");
  const thin = [{ ...strong[0], validPairs: 2 }, strong[1]];
  assert.equal(summarizeFamily(thin, 3).signalReason, "insufficient-valid-repeats");
  const withInvalid = [...strong, { targeted: true, delta: -1, valid: false, validPairs: 0 }];
  const summary = summarizeFamily(withInvalid, 3);
  assert.equal(summary.signal, "adapter-better");
  assert.equal(summary.invalidCases, 1);
});

test("ollama run agent commands are rejected; ollama-agent.mjs is allowed", () => {
  for (const cmd of ["ollama run qwen2.5-coder:14b", '"C:\\Program Files\\Ollama\\ollama.exe" run qwen', "OLLAMA run x"]) {
    assert.throws(() => assertAgentCommand(cmd), /ollama-agent\.mjs/, cmd);
  }
  assert.doesNotThrow(() => assertAgentCommand("node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b"));
  assert.doesNotThrow(() => assertAgentCommand("node scripts/harness/hosted-agent.mjs"));
});

test("declared model family strips one publisher prefix and honors aliases", () => {
  const config = loadConfig();
  assert.equal(declaredModelFamily(config, "gpt-5.6-terra"), "openai-coding");
  assert.equal(declaredModelFamily(config, "openai/gpt-5.6-terra"), "openai-coding");
  assert.equal(declaredModelFamily(config, "qwen2.5-coder:14b"), "generic-open");
  assert.equal(declaredModelFamily(config, "terra-prod", { "terra-prod": "gpt-5.6-terra" }), "openai-coding");
  assert.notEqual(declaredModelFamily(config, "terra-prod"), "openai-coding");
});
