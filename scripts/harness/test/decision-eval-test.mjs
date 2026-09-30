#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { promotionDecision, summarise } from "../decision-eval.mjs";

const repoRoot = process.cwd();
const evaluator = resolve(repoRoot, "scripts/harness/decision-eval.mjs");
const fixture = resolve(repoRoot, ".github/harness/eval/decision-intent-cases.json");
const config = resolve(repoRoot, "harness.config.json");
const CHILD_TIMEOUT_MS = 30_000;

function evaluatorEnv(root, endpoint = "http://127.0.0.1:1", { includeProjectRoot = true, ...overrides } = {}) {
  const environment = {
    ...process.env,
    ...overrides,
    HARNESS_DECISION_ENDPOINT_EVAL: endpoint,
  };
  if (includeProjectRoot) environment.HARNESS_PROJECT_ROOT = root;
  else delete environment.HARNESS_PROJECT_ROOT;
  return environment;
}

function run(root, args, endpoint, environment) {
  return spawnSync(process.execPath, [evaluator, "--repo-root", root, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: evaluatorEnv(root, endpoint, environment),
    timeout: CHILD_TIMEOUT_MS,
  });
}

function runWithPreload(root, args, preloadSource, overrides = {}) {
  const preloadPath = join(root, "preload.mjs");
  writeFileSync(preloadPath, preloadSource, "utf8");
  const environment = evaluatorEnv(root);
  delete environment.HARNESS_DECISION_EVAL_TEST_FAIL_WRITE;
  delete environment.NODE_OPTIONS;
  Object.assign(environment, overrides);
  const result = spawnSync(process.execPath, ["--import", pathToFileURL(preloadPath).href, evaluator, "--repo-root", root, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: environment,
    timeout: CHILD_TIMEOUT_MS,
  });
  if (result.error) throw new Error(`preloaded evaluator did not complete normally (${result.error.code ?? "spawn or timeout error"})`);
  if (result.signal !== null) throw new Error(`preloaded evaluator was terminated (${result.signal})`);
  if (!Number.isInteger(result.status)) throw new Error("preloaded evaluator returned no exit status");
  return result;
}

function assertChildOutcome(result, expectedStatus, message = result.stderr) {
  assert.equal(result.error, undefined, message);
  assert.equal(result.signal, null, message);
  assert.equal(Number.isInteger(result.status), true, message);
  assert.equal(result.status, expectedStatus, message);
}

function runAsync(root, args, endpoint) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [evaluator, "--repo-root", root, ...args], {
      cwd: repoRoot,
      env: evaluatorEnv(root, endpoint),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectRun);
    child.on("close", (status, signal) => resolveRun({ status, signal, error: undefined, stdout, stderr }));
  });
}

function parseJson(result) {
  assertChildOutcome(result, 0, `${result.stderr}\n${result.stdout}`);
  return JSON.parse(result.stdout);
}

function assertReportInputRejected(root, pathname, flag, pattern, label) {
  const result = run(root, ["--deterministic-only", flag, pathname, "--json"]);
  assert.notEqual(result.status, 0, `${label} must reject for ${flag}`);
  assert.equal(result.stdout, "", `${label} must not produce a report for ${flag}`);
  if (flag === "--reviewed") {
    assert.equal(result.stderr.includes("deprecated"), false);
    assert.match(result.stderr, pattern, `${label} must report its validation error for ${flag}`);
    return;
  }
  const warning = "[decision-eval] --queue with --deterministic-only is deprecated; use --reviewed instead.\n";
  assert.equal(result.stderr.split(warning).length - 1, 1);
  assert.match(result.stderr.slice(warning.length), pattern, `${label} must report its validation error for ${flag}`);
}

function assertReportInputRejectedForBoth(root, pathname, pattern, label) {
  for (const flag of ["--reviewed", "--queue"]) assertReportInputRejected(root, pathname, flag, pattern, label);
}

function setupRoot() {
  const root = mkdtempSync(join(tmpdir(), "harness-decision-eval-"));
  mkdirSync(join(root, ".github/harness/eval"), { recursive: true });
  mkdirSync(join(root, ".github/harness/runs"), { recursive: true });
  cpSync(config, join(root, "harness.config.json"));
  cpSync(fixture, join(root, ".github/harness/eval/decision-intent-cases.json"));
  const history = join(root, ".github/harness/runs/handoffs.jsonl");
  writeFileSync(
    history,
    [
      JSON.stringify({ task: "Repair the request timeout in the worker" }),
      JSON.stringify({ task: "Repair the request timeout in the worker" }),
      JSON.stringify({ task: "Explain the scheduler ownership boundary" }),
      "{not json}",
    ].join("\n"),
    "utf8",
  );
  return root;
}

function reviewPath(root, name = "reviewed.json") {
  return join(root, ".github/harness/runs/decision-calibration", name);
}

function queuePath(root, offset) {
  return join(root, ".github/harness/runs/decision-calibration", `candidates-${offset}.json`);
}

function fixturePath(root) {
  return join(root, ".github/harness/eval/decision-intent-cases.json");
}

function writeFixture(root, value) {
  writeFileSync(fixturePath(root), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function realCases(count, overrides = {}) {
  const labels = ["turnkey-coding", "multi-agent-orchestration", "drop-in-memory", "wayfinder", "coder", "assistant"];
  return Array.from({ length: count }, (_, index) => ({
    id: `real-${index + 1}`,
    task: `Confirmed redacted task ${index + 1}`,
    expected: labels[index % labels.length],
    labelledBy: "human-labelled",
    addedAt: "2026-09-28",
    provenance: "maintainer-confirmed-real-use",
    reviewedBy: "maintainer",
    reviewedAt: "2026-09-28T12:00:00.000Z",
    publicationConsent: true,
    confirmation: {
      finalTaskConfirmed: true,
      expectedConfirmed: true,
      publicationConfirmed: true,
    },
    ...overrides,
  }));
}

function writeReview(root, candidates) {
  const path = reviewPath(root);
  writeFileSync(path, `${JSON.stringify({ schemaVersion: 1, candidates }, null, 2)}\n`, "utf8");
  return path;
}

function reviewedCandidate(candidate, overrides = {}) {
  return {
    ...candidate,
    task: "Corrected redacted task text",
    expected: "coder",
    labelledBy: "history-derived",
    provenance: "maintainer-confirmed-real-use",
    reviewedBy: "maintainer",
    reviewedAt: "2026-09-28T12:00:00.000Z",
    publicationConsent: true,
    confirmation: {
      finalTaskConfirmed: true,
      expectedConfirmed: true,
      publicationConfirmed: true,
    },
    status: "accepted",
    ...overrides,
  };
}

function prepareChangingImport(root) {
  parseJson(run(root, ["--export-candidates", "--json"]));
  const queue = join(root, ".github/harness/runs/decision-calibration/candidates.json");
  const candidate = JSON.parse(readFileSync(queue, "utf8")).candidates[0];
  const reviewed = writeReview(root, [reviewedCandidate(candidate)]);
  return { args: ["--import-reviewed", reviewed, "--queue", queue, "--json"], candidate };
}

function expectedImportedFixture(fixtureBytes, candidate) {
  const value = JSON.parse(fixtureBytes);
  value.cases.push({
    id: candidate.id,
    task: "Corrected redacted task text",
    expected: "coder",
    labelledBy: "history-derived",
    addedAt: "2026-09-28",
    provenance: "maintainer-confirmed-real-use",
    reviewedBy: "maintainer",
    reviewedAt: "2026-09-28T12:00:00.000Z",
    publicationConsent: true,
    confirmation: {
      finalTaskConfirmed: true,
      expectedConfirmed: true,
      publicationConfirmed: true,
    },
    sourceRef: candidate.sourceRef,
  });
  return `${JSON.stringify(value, null, 2)}\n`;
}

function opaqueCandidateId(index) {
  const suffix = String(index).padStart(12, "0");
  return `candidate-00000000-0000-4000-8000-${suffix}`;
}

function generatedFixtureCase(index, padding = "") {
  return {
    id: `generated-${index}`,
    task: `Generated bounded fixture task ${index} ${padding}`,
    expected: "coder",
    labelledBy: "model-authored",
    addedAt: "2026-09-28",
  };
}

test("offline modes are bounded, blinded, and never contact the endpoint", async () => {
  const root = setupRoot();
  let requests = 0;
  const server = http.createServer((request, response) => {
    requests += 1;
    response.writeHead(500).end();
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const endpoint = `http://127.0.0.1:${server.address().port}`;
  try {

    const exported = parseJson(await runAsync(root, ["--export-candidates", "--json"], endpoint));
    assert.equal(exported.mode, "export-candidates");
    assert.equal(exported.candidates, 2);
    assert.equal(exported.duplicates, 1);
    assert.equal(exported.malformed, 1);
    assert.ok(!JSON.stringify(exported).includes("Repair the request timeout"), "stdout must not expose raw tasks");

    const queue = JSON.parse(readFileSync(join(root, ".github/harness/runs/decision-calibration/candidates.json"), "utf8"));
    assert.equal(queue.candidates.length, 2);
    assert.deepEqual(
      queue.candidates.map((candidate) => ({ expected: candidate.expected, reviewedBy: candidate.reviewedBy, status: candidate.status })),
      [
        { expected: null, reviewedBy: null, status: "pending" },
        { expected: null, reviewedBy: null, status: "pending" },
      ],
    );

    const baseline = parseJson(await runAsync(root, ["--deterministic-only", "--json"], endpoint));
    assert.equal(baseline.mode, "deterministic-only");
    assert.equal(baseline.humanLabelled, 0);
    assert.equal(baseline.promotionEligible, false);
    assert.equal(baseline.readiness, false);
    assert.equal(baseline.sidecarMetrics, "not measured");
    assert.ok(!JSON.stringify(baseline).includes("Repair the request timeout"), "baseline must not expose raw tasks");
    assert.equal(requests, 0, "offline modes must not contact the configured endpoint");

    const live = parseJson(await runAsync(root, ["--endpoint", endpoint, "--json"], endpoint));
    assert.equal(live.summary.total, 12);
    assert.ok(requests > 0, "the isolated live-mode positive control must contact the supplied endpoint");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
    rmSync(root, { recursive: true, force: true });
  }
});

test("reviewed imports require confirmed redaction and are atomic and idempotent", () => {
  const root = setupRoot();
  try {
    parseJson(run(root, ["--export-candidates", "--json"]));
    const queue = JSON.parse(readFileSync(join(root, ".github/harness/runs/decision-calibration/candidates.json"), "utf8"));
    const accepted = reviewedCandidate(queue.candidates[0]);
    const submission = writeReview(root, [accepted]);
    const defaultQueueImport = run(root, ["--import-reviewed", submission, "--json"]);
    assert.equal(defaultQueueImport.stderr, "", "imports use the default candidates.json queue without a deprecation warning");
    const imported = parseJson(defaultQueueImport);
    assert.deepEqual(imported, { mode: "import-reviewed", imported: 1, noOp: false });
    assert.equal(parseJson(run(root, ["--import-reviewed", submission, "--json"])).noOp, true);

    const before = readFileSync(join(root, ".github/harness/eval/decision-intent-cases.json"), "utf8");
    writeReview(root, [
      reviewedCandidate(queue.candidates[1], { expected: "unknown-intent" }),
      reviewedCandidate(queue.candidates[0], { task: "A second changed task", id: "candidate-conflict" }),
    ]);
    const rejected = run(root, ["--import-reviewed", reviewPath(root)]);
    assert.notEqual(rejected.status, 0, "a malformed accepted batch must reject");
    assert.equal(readFileSync(join(root, ".github/harness/eval/decision-intent-cases.json"), "utf8"), before, "rejection must not partially write the fixture");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("review metadata and non-accepted entries cannot bypass submission validation", () => {
  const root = setupRoot();
  try {
    parseJson(run(root, ["--export-candidates", "--json"]));
    const queue = JSON.parse(readFileSync(join(root, ".github/harness/runs/decision-calibration/candidates.json"), "utf8"));
    const fixtureBefore = readFileSync(join(root, ".github/harness/eval/decision-intent-cases.json"), "utf8");
    writeReview(root, [
      reviewedCandidate(queue.candidates[0], { reviewedBy: "", confirmation: { finalTaskConfirmed: true, expectedConfirmed: true, publicationConfirmed: true } }),
      { ...queue.candidates[1], status: "not-a-review-status" },
    ]);
    const rejected = run(root, ["--import-reviewed", reviewPath(root)]);
    assert.notEqual(rejected.status, 0, "unconfirmed or malformed review entries must reject the whole batch");
    assert.equal(readFileSync(join(root, ".github/harness/eval/decision-intent-cases.json"), "utf8"), fixtureBefore);

    writeReview(root, [
      reviewedCandidate(queue.candidates[0]),
      reviewedCandidate(queue.candidates[0], { task: "Different confirmed final text" }),
    ]);
    assert.notEqual(run(root, ["--import-reviewed", reviewPath(root)]).status, 0, "duplicate reviewed ids must reject the whole batch");

    writeReview(root, [reviewedCandidate(queue.candidates[0], { sourceRef: "handoff:record-999" })]);
    const mismatchedSource = run(root, ["--import-reviewed", reviewPath(root)]);
    assert.notEqual(mismatchedSource.status, 0, "accepted source mismatches must reject before import projection");
    assert.match(mismatchedSource.stderr, /does not match the local candidate queue/);
    assert.equal(readFileSync(join(root, ".github/harness/eval/decision-intent-cases.json"), "utf8"), fixtureBefore);

    writeFileSync(reviewPath(root), "{not valid json", "utf8");
    const malformed = run(root, ["--import-reviewed", reviewPath(root)]);
    assert.notEqual(malformed.status, 0);
    assert.ok(!malformed.stderr.includes("Unexpected token"), "raw JSON parser details must not be echoed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pending queues cannot import", () => {
  const root = setupRoot();
  try {
    parseJson(run(root, ["--export-candidates", "--json"]));
    const fixtureBefore = readFileSync(join(root, ".github/harness/eval/decision-intent-cases.json"), "utf8");
    const rejected = run(root, ["--import-reviewed", join(root, ".github/harness/runs/decision-calibration/candidates.json")]);
    assert.notEqual(rejected.status, 0, "a pending queue must not import");
    assert.equal(readFileSync(join(root, ".github/harness/eval/decision-intent-cases.json"), "utf8"), fixtureBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("export rejects oversized tasks rather than miscounting them as empty", () => {
  const root = setupRoot();
  try {
    writeFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), `${JSON.stringify({ task: "x".repeat(8 * 1024 + 1) })}\n`, "utf8");
    const result = run(root, ["--export-candidates", "--json"]);
    assert.notEqual(result.status, 0);
    assert.ok(!result.stdout.includes("empty"), "oversized input must reject instead of producing a partial count");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("baseline rejects weak thresholds and invalid real-case fixture fields", () => {
  const root = setupRoot();
  try {
    const original = JSON.parse(readFileSync(fixturePath(root), "utf8"));
    const scenarios = [
      (fixtureValue) => { fixtureValue.promotionRequires.minHumanLabelledCases = 99; },
      (fixtureValue) => { fixtureValue.promotionRequires.maxConfidentWrong = 1; },
      (fixtureValue) => { fixtureValue.cases[0].expected = "unknown-intent"; },
      (fixtureValue) => { fixtureValue.cases[0].addedAt = "not-a-date"; },
      (fixtureValue) => { fixtureValue.cases[0].split = "test-only"; },
      (fixtureValue) => { fixtureValue.cases[0].split = 42; },
    ];
    for (const applyInvalidity of scenarios) {
      const invalid = structuredClone(original);
      applyInvalidity(invalid);
      writeFixture(root, invalid);
      assert.notEqual(run(root, ["--deterministic-only", "--json"]).status, 0);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fixture provenance rejects duplicate sources and nonopaque history links without changing CLI inputs", () => {
  const root = setupRoot();
  try {
    const original = JSON.parse(readFileSync(fixturePath(root), "utf8"));
    const real = realCases(2, { labelledBy: "history-derived", sourceRef: "handoff:record-21" });
    real[0].id = opaqueCandidateId(21);
    real[1].id = opaqueCandidateId(22);
    writeFixture(root, { ...original, cases: [...original.cases, ...real] });
    const fixtureBefore = readFileSync(fixturePath(root), "utf8");
    const historyBefore = readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8");
    assert.notEqual(run(root, ["--deterministic-only", "--json"]).status, 0, "duplicate redacted source references must not inflate real counts");
    assert.notEqual(run(root, ["--export-candidates", "--json"]).status, 0, "export must share fixture validation");
    assert.notEqual(run(root, ["--import-reviewed", reviewPath(root), "--json"]).status, 0, "import must share fixture validation");
    assert.equal(readFileSync(fixturePath(root), "utf8"), fixtureBefore);
    assert.equal(readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8"), historyBefore);

    const missingHistorySource = realCases(1, { labelledBy: "history-derived", id: opaqueCandidateId(23) });
    writeFixture(root, { ...original, cases: [...original.cases, ...missingHistorySource] });
    assert.notEqual(run(root, ["--deterministic-only", "--json"]).status, 0, "history-derived cases require a source reference");

    const legacyHistoryId = realCases(1, { labelledBy: "history-derived", id: `candidate-${"a".repeat(16)}`, sourceRef: "handoff:record-24" });
    writeFixture(root, { ...original, cases: [...original.cases, ...legacyHistoryId] });
    assert.notEqual(run(root, ["--deterministic-only", "--json"]).status, 0, "history-linked cases require opaque UUID ids");

    const humanHandoffId = realCases(1, { id: "human-legacy", sourceRef: "handoff:record-25" });
    writeFixture(root, { ...original, cases: [...original.cases, ...humanHandoffId] });
    assert.notEqual(run(root, ["--deterministic-only", "--json"]).status, 0, "human cases carrying handoff provenance require opaque UUID ids");

    const validHistoryCases = realCases(2);
    validHistoryCases[0] = { ...validHistoryCases[0], id: opaqueCandidateId(26), labelledBy: "history-derived", sourceRef: "handoff:record-26" };
    validHistoryCases[1] = { ...validHistoryCases[1], id: opaqueCandidateId(27), task: "A separately confirmed source", labelledBy: "history-derived", sourceRef: "handoff:record-27" };
    writeFixture(root, { ...original, cases: [...original.cases, ...validHistoryCases] });
    assert.equal(parseJson(run(root, ["--deterministic-only", "--json"])).humanLabelled, 2, "distinct opaque sources remain valid");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("baseline keeps 99 and 100 real cases as collection evidence only and detects split-family leakage", () => {
  const root = setupRoot();
  try {
    const original = JSON.parse(readFileSync(fixturePath(root), "utf8"));
    writeFixture(root, { ...original, cases: [...original.cases, ...realCases(99)] });
    const ninetyNine = parseJson(run(root, ["--deterministic-only", "--json"]));
    assert.equal(ninetyNine.humanLabelled, 99);
    assert.equal(ninetyNine.deficit, 1);
    assert.equal(ninetyNine.promotionEligible, false);
    assert.equal(ninetyNine.realDeterministic.total, 99);
    assert.equal(ninetyNine.syntheticDeterministic.total, original.cases.length);
    assert.ok(ninetyNine.zeroCoverage.length < 6, "real coverage must include zero categories explicitly");

    writeFixture(root, { ...original, cases: [...original.cases, ...realCases(100)] });
    const oneHundred = parseJson(run(root, ["--deterministic-only", "--json"]));
    assert.equal(oneHundred.humanLabelled, 100);
    assert.equal(oneHundred.promotionEligible, false, "offline collection never establishes promotion");

    const leaked = {
      ...original,
      cases: [
        ...original.cases,
        ...realCases(1, { split: "train", taskFamily: "same-family" }),
        ...realCases(1, { id: "real-leak", task: "Second confirmed task", split: "calibration", taskFamily: "same-family" }),
      ],
    };
    writeFixture(root, leaked);
    assert.notEqual(run(root, ["--deterministic-only", "--json"]).status, 0, "populated family leakage must reject evidence");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("summary rejects unavailable and poisoned receipt states", () => {
  const valid = { expected: "coder", deterministic: "coder", selected: "coder", probability: 0.9, status: "matched" };
  assert.equal(summarise([valid], 0.7).sidecar.correct, 1);
  assert.equal(summarise([{ ...valid, status: "unavailable", selected: null, probability: null }], 0.7).sidecar.abstained, 1);
  for (const invalid of [
    { ...valid, status: "unknown" },
    { ...valid, selected: null },
    { ...valid, probability: Number.NaN },
    { ...valid, probability: 1.1 },
    { ...valid, status: "unavailable", selected: "coder", probability: 0.9 },
    { ...valid, status: "uncertain", selected: null },
  ]) {
    assert.throws(() => summarise([invalid], 0.7));
  }
  assert.throws(() => summarise([valid], Number.NaN));
});

test("promotion remains report-only and fail-closed for frozen, incomplete, and 99/100-case evidence", () => {
  const original = JSON.parse(readFileSync(fixture, "utf8"));
  const matched = summarise(original.cases.map((item) => ({
    expected: item.expected,
    deterministic: item.expected,
    selected: item.expected,
    probability: 0.9,
    status: "matched",
  })), 0.7);
  const fixtureWithEvidence = {
    ...original,
    cases: [...original.cases, ...realCases(100)],
    calibrationEvidence: { heldOutConfirmed: true, familySeparationConfirmed: true },
  };
  const frozen = promotionDecision({ summary: matched, fixture: fixtureWithEvidence, policy: { freeze: { status: "frozen" } } });
  assert.equal(frozen.promotionEligible, false);
  assert.ok(frozen.reasons.includes("frozen"));

  const unavailable = summarise([{ expected: "coder", deterministic: "coder", selected: null, probability: null, status: "unavailable" }], 0.7);
  const incomplete = promotionDecision({ summary: unavailable, fixture: fixtureWithEvidence, policy: { freeze: { status: "unfrozen" } } });
  assert.equal(incomplete.promotionEligible, false);
  assert.ok(incomplete.reasons.includes("incomplete-sidecar-observations"));

  const ninetyNine = { ...fixtureWithEvidence, cases: [...original.cases, ...realCases(99)] };
  const insufficient = promotionDecision({ summary: { ...matched, total: ninetyNine.cases.length, sidecar: { correct: ninetyNine.cases.length, wrong: 0, abstained: 0 } }, fixture: ninetyNine, policy: { freeze: { status: "unfrozen" } } });
  assert.equal(insufficient.promotionEligible, false);
  assert.ok(insufficient.reasons.includes("insufficient-real-cases"));

  const independent = promotionDecision({ summary: { ...matched, total: fixtureWithEvidence.cases.length, sidecar: { correct: fixtureWithEvidence.cases.length, wrong: 0, abstained: 0 } }, fixture: fixtureWithEvidence, policy: { freeze: { status: "unfrozen" } } });
  assert.equal(independent.promotionEligible, false);
  assert.ok(independent.reasons.includes("held-out-evidence-not-established"));
  assert.ok(independent.reasons.includes("family-separation-not-established"));
});

test("uncertain high-probability wrong selections remain confident-wrong", () => {
  assert.equal(summarise([{ expected: "coder", deterministic: "coder", selected: "assistant", probability: 0.95, status: "uncertain" }], 0.7).confidentWrong, 1);
  assert.equal(summarise([{ expected: "coder", deterministic: "coder", selected: "assistant", probability: 0.69, status: "uncertain" }], 0.7).confidentWrong, 0);
});

test("rooted config, repeated roots, bounded batches, and queue-selected import are isolated", () => {
  const root = setupRoot();
  try {
    const projectConfig = JSON.parse(readFileSync(join(root, "harness.config.json"), "utf8"));
    delete projectConfig.routing.intentProfiles.assistant;
    writeFileSync(join(root, "harness.config.json"), `${JSON.stringify(projectConfig, null, 2)}\n`, "utf8");
    assert.notEqual(run(root, ["--deterministic-only", "--json"], undefined, { includeProjectRoot: false }).status, 0, "target-root config must control fixture validation when HARNESS_PROJECT_ROOT is unset");

    cpSync(config, join(root, "harness.config.json"));
    assert.notEqual(run(root, ["--repo-root", root, "--deterministic-only", "--json"]).status, 0, "repeated repo roots must reject");
    writeFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), [
      JSON.stringify({ task: "Batch task one" }),
      JSON.stringify({ task: "Batch task two" }),
      JSON.stringify({ task: "Batch task three" }),
    ].join("\n"), "utf8");
    const beforeConfig = readFileSync(join(root, "harness.config.json"), "utf8");
    const beforeHistory = readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8");
    const first = parseJson(run(root, ["--export-candidates", "--offset", "0", "--limit", "1", "--json"]));
    const second = parseJson(run(root, ["--export-candidates", "--offset", "1", "--limit", "1", "--json"]));
    assert.notEqual(first.candidatePath, second.candidatePath);
    const firstQueue = JSON.parse(readFileSync(queuePath(root, 0), "utf8"));
    const secondQueue = JSON.parse(readFileSync(queuePath(root, 1), "utf8"));
    assert.notEqual(firstQueue.candidates[0].id, secondQueue.candidates[0].id);
    assert.notEqual(firstQueue.candidates[0].task, secondQueue.candidates[0].task);
    assert.match(firstQueue.candidates[0].id, /^candidate-[0-9a-f-]{36}$/i);
    const review = writeReview(root, [reviewedCandidate(secondQueue.candidates[0])]);
    const explicitQueueImport = run(root, ["--import-reviewed", review, "--queue", queuePath(root, 1), "--json"]);
    assert.equal(explicitQueueImport.stderr, "", "import --queue selects candidates without a report deprecation warning");
    assert.equal(parseJson(explicitQueueImport).imported, 1);
    assert.equal(readFileSync(join(root, "harness.config.json"), "utf8"), beforeConfig);
    assert.equal(readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8"), beforeHistory);
    const afterImport = parseJson(run(root, ["--export-candidates", "--offset", "2", "--limit", "1", "--json"]));
    assert.equal(afterImport.candidates, 1);
    assert.notEqual(JSON.parse(readFileSync(queuePath(root, 2), "utf8")).candidates[0].task, "Corrected redacted task text");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source-anchored batches remain stable and reject duplicate source references", () => {
  const root = setupRoot();
  try {
    writeFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), [
      JSON.stringify({ task: "Source task one" }),
      JSON.stringify({ task: "Source task two" }),
      JSON.stringify({ task: "Source task three" }),
      JSON.stringify({ task: "Source task four" }),
    ].join("\n"), "utf8");
    parseJson(run(root, ["--export-candidates", "--offset", "0", "--limit", "2", "--json"]));
    parseJson(run(root, ["--export-candidates", "--limit", "2", "--json"]));
    const offsetZero = JSON.parse(readFileSync(queuePath(root, 0), "utf8"));
    const defaultQueue = JSON.parse(readFileSync(reviewPath(root, "candidates.json"), "utf8"));

    const verbatimReview = writeReview(root, offsetZero.candidates.map((candidate) => reviewedCandidate(candidate, { task: candidate.task })));
    assert.equal(parseJson(run(root, ["--import-reviewed", verbatimReview, "--queue", queuePath(root, 0), "--json"])).imported, 2);
    parseJson(run(root, ["--export-candidates", "--offset", "2", "--limit", "2", "--json"]));
    const offsetTwo = JSON.parse(readFileSync(queuePath(root, 2), "utf8"));
    assert.deepEqual(offsetTwo.candidates.map((candidate) => candidate.sourceRef), ["handoff:record-3", "handoff:record-4"]);

    const fixtureBefore = readFileSync(fixturePath(root), "utf8");
    writeReview(root, [reviewedCandidate(defaultQueue.candidates[0], { task: "Differently redacted task text" })]);
    assert.notEqual(run(root, ["--import-reviewed", reviewPath(root), "--queue", reviewPath(root, "candidates.json")]).status, 0, "a second queue cannot import an existing source under a new id");
    assert.equal(readFileSync(fixturePath(root), "utf8"), fixtureBefore);

    const duplicateSourceQueue = {
      schemaVersion: 1,
      candidates: [
        offsetTwo.candidates[0],
        { ...offsetTwo.candidates[1], sourceRef: offsetTwo.candidates[0].sourceRef },
      ],
    };
    const duplicateQueuePath = reviewPath(root, "duplicate-source.json");
    writeFileSync(duplicateQueuePath, `${JSON.stringify(duplicateSourceQueue, null, 2)}\n`, "utf8");
    writeReview(root, duplicateSourceQueue.candidates.map((candidate) => reviewedCandidate(candidate, { task: `Redacted ${candidate.id}` })));
    assert.notEqual(run(root, ["--import-reviewed", reviewPath(root), "--queue", duplicateQueuePath]).status, 0, "accepted entries cannot share a source reference");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("imports reject legacy hash candidate ids without changing the fixture", () => {
  const root = setupRoot();
  try {
    parseJson(run(root, ["--export-candidates", "--offset", "0", "--limit", "1", "--json"]));
    const candidate = JSON.parse(readFileSync(queuePath(root, 0), "utf8")).candidates[0];
    const legacyCandidate = { ...candidate, id: `candidate-${"a".repeat(16)}` };
    const legacyQueuePath = reviewPath(root, "legacy-hash-queue.json");
    writeFileSync(legacyQueuePath, `${JSON.stringify({ schemaVersion: 1, candidates: [legacyCandidate] }, null, 2)}\n`, "utf8");
    const submission = writeReview(root, [reviewedCandidate(legacyCandidate)]);
    const before = readFileSync(fixturePath(root), "utf8");
    assert.notEqual(run(root, ["--import-reviewed", submission, "--queue", legacyQueuePath]).status, 0);
    assert.equal(readFileSync(fixturePath(root), "utf8"), before);
    assert.equal(JSON.parse(before).cases.some((item) => /^candidate-[0-9a-f]{16}$/i.test(item.id)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("imports reject alternate fixtures and sanitize fixed project metadata", () => {
  const root = setupRoot();
  try {
    parseJson(run(root, ["--export-candidates", "--json"]));
    const queue = JSON.parse(readFileSync(join(root, ".github/harness/runs/decision-calibration/candidates.json"), "utf8"));
    const submission = writeReview(root, [reviewedCandidate(queue.candidates[0], {
      confirmation: { finalTaskConfirmed: true, expectedConfirmed: true, publicationConfirmed: true, extra: "discard" },
      provenance: "p".repeat(201),
    })]);
    const before = readFileSync(fixturePath(root), "utf8");
    assert.notEqual(run(root, ["--import-reviewed", submission, "--cases", fixturePath(root)]).status, 0);
    assert.equal(readFileSync(fixturePath(root), "utf8"), before);
    assert.notEqual(run(root, ["--import-reviewed", submission]).status, 0, "oversized metadata must reject");

    writeReview(root, [reviewedCandidate(queue.candidates[0], {
      confirmation: { finalTaskConfirmed: true, expectedConfirmed: true, publicationConfirmed: true, extra: "discard" },
      split: "train",
      familySeparationConfirmed: { untrusted: true },
    })]);
    parseJson(run(root, ["--import-reviewed", reviewPath(root), "--json"]));
    const imported = JSON.parse(readFileSync(fixturePath(root), "utf8")).cases.at(-1);
    assert.deepEqual(imported.confirmation, { finalTaskConfirmed: true, expectedConfirmed: true, publicationConfirmed: true });
    assert.equal(imported.familySeparationConfirmed, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("critical fixture, history, and review bounds reject before publication", () => {
  const root = setupRoot();
  try {
    const oversizedBytes = 10 * 1024 * 1024 + 1;
    writeFileSync(fixturePath(root), " ".repeat(oversizedBytes), "utf8");
    assert.notEqual(run(root, ["--deterministic-only", "--json"]).status, 0, "fixtures above 10 MiB must reject");

    cpSync(fixture, fixturePath(root));
    writeFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "x".repeat(oversizedBytes), "utf8");
    assert.notEqual(run(root, ["--export-candidates", "--json"]).status, 0, "history above 10 MiB must reject");

    writeFileSync(fixturePath(root), `${JSON.stringify({ schemaVersion: 1, promotionRequires: { minHumanLabelledCases: 100, maxConfidentWrong: 0 }, cases: Array.from({ length: 10_001 }, (_, index) => generatedFixtureCase(index)) })}\n`, "utf8");
    assert.notEqual(run(root, ["--deterministic-only", "--json"]).status, 0, "fixtures above 10,000 records must reject");

    cpSync(fixture, fixturePath(root));
    const acceptedHistory = Array.from({ length: 10_000 }, (_, index) => JSON.stringify({ task: `Accepted history record ${index}` })).join("\n");
    writeFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), acceptedHistory, "utf8");
    assert.equal(parseJson(run(root, ["--export-candidates", "--offset", "0", "--limit", "1", "--json"])).candidates, 1, "history with exactly 10,000 logical records must export");
    assert.equal(existsSync(queuePath(root, 0)), true, "history with exactly 10,000 logical records must create its offset queue");
    rmSync(queuePath(root, 0));
    const historyRecords = Array.from({ length: 10_001 }, (_, index) => JSON.stringify({ task: `History record ${index}` }));
    for (const [label, history] of [
      ["with a final newline", `${historyRecords.join("\n")}\n`],
      ["without a final newline", historyRecords.join("\n")],
    ]) {
      writeFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), history, "utf8");
      assert.notEqual(run(root, ["--export-candidates", "--json"]).status, 0, `history above 10,000 records ${label} must reject`);
      assert.equal(existsSync(reviewPath(root, "candidates.json")), false, `history above 10,000 records ${label} must not create a queue`);
    }

    mkdirSync(join(root, ".github/harness/runs/decision-calibration"), { recursive: true });
    writeFileSync(reviewPath(root, "oversized.json"), "x".repeat(1024 * 1024 + 1), "utf8");
    assert.notEqual(run(root, ["--deterministic-only", "--queue", reviewPath(root, "oversized.json"), "--json"]).status, 0, "review files above 1 MiB must reject");
    writeFileSync(reviewPath(root, "too-many.json"), `${JSON.stringify({ schemaVersion: 1, candidates: Array.from({ length: 101 }, (_, index) => ({ id: opaqueCandidateId(index), status: "pending" })) })}\n`, "utf8");
    assert.notEqual(run(root, ["--deterministic-only", "--queue", reviewPath(root, "too-many.json"), "--json"]).status, 0, "review batches above 100 entries must reject");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("generated fixture output and failed import preserve existing bytes", () => {
  const root = setupRoot();
  try {
    const original = JSON.parse(readFileSync(fixturePath(root), "utf8"));
    const cases = Array.from({ length: 9_500 }, (_, index) => generatedFixtureCase(index));
    const bounded = { ...original, cases };
    const targetBytes = 10 * 1024 * 1024 - 200;
    const serializedBytes = Buffer.byteLength(`${JSON.stringify(bounded, null, 2)}\n`, "utf8");
    let remainingPadding = targetBytes - serializedBytes;
    for (const item of cases) {
      const padding = Math.min(1_000, remainingPadding);
      item.task += "x".repeat(padding);
      remainingPadding -= padding;
      if (remainingPadding === 0) break;
    }
    assert.equal(remainingPadding, 0, "fixture capacity must reach the generated-output boundary");
    writeFixture(root, bounded);
    parseJson(run(root, ["--export-candidates", "--offset", "0", "--limit", "1", "--json"]));
    const candidate = JSON.parse(readFileSync(queuePath(root, 0), "utf8")).candidates[0];
    const outputBefore = readFileSync(fixturePath(root), "utf8");
    writeReview(root, [reviewedCandidate(candidate)]);
    assert.notEqual(run(root, ["--import-reviewed", reviewPath(root), "--queue", queuePath(root, 0), "--json"]).status, 0, "generated output above 10 MiB must reject");
    assert.equal(readFileSync(fixturePath(root), "utf8"), outputBefore);

    cpSync(fixture, fixturePath(root));
    parseJson(run(root, ["--export-candidates", "--offset", "1", "--limit", "1", "--json"]));
    const writeCandidate = JSON.parse(readFileSync(queuePath(root, 1), "utf8")).candidates[0];
    writeReview(root, [reviewedCandidate(writeCandidate)]);
    const fixtureBefore = readFileSync(fixturePath(root), "utf8");
    const historyBefore = readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8");
    const configBefore = readFileSync(join(root, "harness.config.json"), "utf8");
    const failedImport = run(
      root,
      ["--import-reviewed", reviewPath(root), "--queue", queuePath(root, 1), "--json"],
      undefined,
      { HARNESS_DECISION_EVAL_TEST_FAIL_WRITE: "1" },
    );
    assertChildOutcome(failedImport, 1, "the failed import must reject the reviewed import");
    assert.equal(failedImport.stdout, "");
    assert.equal(failedImport.stderr, "[decision-eval] cases fixture write failed\n");
    assert.equal(existsSync(`${fixturePath(root)}.${failedImport.pid}.tmp`), false, "the legacy switch must fail before creating a temporary");
    assert.equal(readFileSync(fixturePath(root), "utf8"), fixtureBefore);
    assert.equal(readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8"), historyBefore);
    assert.equal(readFileSync(join(root, "harness.config.json"), "utf8"), configBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("atomic write preserves unowned temporary sentinel", () => {
  const root = setupRoot();
  try {
    const destination = join(root, ".github/harness/runs/decision-calibration/candidates.json");
    const sentinel = "unowned-sentinel-bytes\n";
    const receipt = join(root, "collision-receipt.json");
    const preload = [
      'import fs from "node:fs";',
      'import { dirname } from "node:path";',
      'import { syncBuiltinESMExports } from "node:module";',
      `const destination = ${JSON.stringify(destination)};`,
      "const temporary = `${destination}.${process.pid}.tmp`;",
      `const receipt = ${JSON.stringify(receipt)};`,
      `const sentinel = ${JSON.stringify(sentinel)};`,
      "const collisions = [];",
      "fs.mkdirSync(dirname(temporary), { recursive: true });",
      "fs.writeFileSync(temporary, sentinel, \"utf8\");",
      "const originalWriteFileSync = fs.writeFileSync;",
      "const originalOpenSync = fs.openSync;",
      "function recordCollision(error) {",
      "  if (error?.code === \"EEXIST\") { collisions.push(error.code); originalWriteFileSync.call(fs, receipt, JSON.stringify({ operation: \"exclusive-create\", collisions })); }",
      "}",
      "fs.openSync = function patchedOpenSync(pathname, ...args) {",
      "  try { return originalOpenSync.call(fs, pathname, ...args); }",
      "  catch (error) {",
      "    if (pathname === temporary) recordCollision(error);",
      "    throw error;",
      "  }",
      "};",
      "syncBuiltinESMExports();",
    ].join("\n");
    const result = runWithPreload(root, ["--export-candidates", "--json"], preload);
    const temporary = `${destination}.${result.pid}.tmp`;
    assertChildOutcome(result, 1, "the collision must fail the evaluator invocation");
    assert.equal(result.stdout, "", "the failed export must not emit JSON");
    assert.equal(result.stderr, "[decision-eval] candidate queue write failed\n");
    assert.equal(result.stderr.includes(root), false, "the collision must not disclose the synthetic root");
    assert.equal(existsSync(receipt), true, result.stderr);
    assert.deepEqual(JSON.parse(readFileSync(receipt, "utf8")), { operation: "exclusive-create", collisions: ["EEXIST"] });
    assert.equal(readFileSync(temporary, "utf8"), sentinel, "an unowned temporary sentinel must survive the failed write");
    assert.equal(existsSync(destination), false, "a failed collision must not create its destination");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy write switch remains a pre-create failure and preserves unowned sentinels", () => {
  for (const withSentinel of [false, true]) {
    const root = setupRoot();
    try {
      const destination = join(root, ".github/harness/runs/decision-calibration/candidates.json");
      const sentinel = "legacy-switch-sentinel\n";
      const preload = withSentinel
        ? [
          'import fs from "node:fs";',
          'import { dirname } from "node:path";',
          `const destination = ${JSON.stringify(destination)};`,
          "const temporary = `${destination}.${process.pid}.tmp`;",
          "fs.mkdirSync(dirname(temporary), { recursive: true });",
          `fs.writeFileSync(temporary, ${JSON.stringify(sentinel)}, "utf8");`,
        ].join("\n")
        : "";
      const result = runWithPreload(
        root,
        ["--export-candidates", "--json"],
        preload,
        { HARNESS_DECISION_EVAL_TEST_FAIL_WRITE: "1" },
      );
      const temporary = `${destination}.${result.pid}.tmp`;
      assertChildOutcome(result, 1, "the legacy switch must fail the write before creation");
      assert.equal(result.stdout, "", "the legacy write failure must not emit JSON");
      assert.equal(result.stderr, "[decision-eval] candidate queue write failed\n");
      assert.equal(existsSync(destination), false, "the legacy failure must not create a destination");
      if (withSentinel) assert.equal(readFileSync(temporary, "utf8"), sentinel, "the legacy switch must not delete an unowned sentinel");
      else assert.equal(existsSync(temporary), false, "the legacy failure must not create a temporary");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("atomic write closes and removes only owned temporary files after write and rename faults", () => {
  for (const scenario of ["partial-write", "rename"]) {
    const root = setupRoot();
    try {
      const destination = join(root, ".github/harness/runs/decision-calibration/candidates.json");
      const receipt = join(root, `${scenario}-receipt.json`);
      const preload = [
        'import fs from "node:fs";',
        'import { dirname } from "node:path";',
        'import { syncBuiltinESMExports } from "node:module";',
        `const destination = ${JSON.stringify(destination)};`,
        `const scenario = ${JSON.stringify(scenario)};`,
        `const receiptPath = ${JSON.stringify(receipt)};`,
        "const temporary = `${destination}.${process.pid}.tmp`;",
        "const originalOpenSync = fs.openSync;",
        "const originalWriteFileSync = fs.writeFileSync;",
        "const originalCloseSync = fs.closeSync;",
        "const originalRenameSync = fs.renameSync;",
        "const originalUnlinkSync = fs.unlinkSync;",
        "const originalFstatSync = fs.fstatSync;",
        "const originalReadFileSync = fs.readFileSync;",
        "const events = [];",
        "let descriptor = null;",
        "let partialBytes = null; let intendedBytes = null; let partialContents = null;",
        "function persist() { originalWriteFileSync.call(fs, receiptPath, JSON.stringify({ pid: process.pid, events, partialBytes, intendedBytes, partialContents })); }",
        "function injected(message) { const error = new Error(message); error.code = \"EIO\"; return error; }",
        "fs.openSync = function patchedOpenSync(pathname, ...args) {",
        "  const value = originalOpenSync.call(fs, pathname, ...args);",
        "  if (pathname === temporary) { descriptor = value; events.push(\"open\"); persist(); }",
        "  return value;",
        "};",
        "fs.writeFileSync = function patchedWriteFileSync(target, contents, ...args) {",
        "  if (scenario === \"partial-write\" && target === descriptor) {",
        "    originalWriteFileSync.call(fs, target, String(contents).slice(0, 8), ...args);",
        "    partialBytes = originalFstatSync.call(fs, target).size; intendedBytes = Buffer.byteLength(String(contents), 'utf8'); partialContents = originalReadFileSync.call(fs, temporary, 'utf8');",
        "    events.push(\"partial-write\"); persist(); throw injected(\"partial write fault\");",
        "  }",
        "  return originalWriteFileSync.call(fs, target, contents, ...args);",
        "};",
        "fs.closeSync = function patchedCloseSync(target) {",
        "  const result = originalCloseSync.call(fs, target);",
        "  if (target === descriptor) { events.push(\"close\"); persist(); }",
        "  return result;",
        "};",
        "fs.renameSync = function patchedRenameSync(source, target) {",
        "  if (scenario === \"rename\" && source === temporary && target === destination) {",
        "    let closed = false; try { originalFstatSync.call(fs, descriptor); } catch (error) { closed = error?.code === \"EBADF\"; }",
        "    events.push(closed ? \"rename-after-close\" : \"rename-before-close\"); persist(); throw injected(\"rename fault\");",
        "  }",
        "  return originalRenameSync.call(fs, source, target);",
        "};",
        "fs.unlinkSync = function patchedUnlinkSync(pathname) {",
        "  if (pathname === temporary) { events.push(\"unlink\"); persist(); }",
        "  return originalUnlinkSync.call(fs, pathname);",
        "};",
        "syncBuiltinESMExports();",
      ].join("\n");
      const result = runWithPreload(root, ["--export-candidates", "--json"], preload);
      assertChildOutcome(result, 1, `${scenario} must fail the CLI: ${result.stderr}`);
      const temporary = `${destination}.${result.pid}.tmp`;
      const lifecycle = JSON.parse(readFileSync(receipt, "utf8"));
      const { events } = lifecycle;
      assert.equal(result.stdout, "", `${scenario} must not emit JSON`);
      assert.equal(result.stderr, `[decision-eval] candidate queue ${scenario === "rename" ? "replace" : "write"} failed\n`);
      assert.equal(result.stderr.includes(root), false, `${scenario} must not disclose the synthetic root`);
      assert.equal(lifecycle.pid, result.pid, `${scenario} receipt must identify the evaluator child`);
      assert.equal(events.filter((event) => event === "open").length, 1);
      assert.equal(events.filter((event) => event === "close").length, 1, `${scenario} must close its descriptor exactly once`);
      assert.equal(events.filter((event) => event === "unlink").length, 1, `${scenario} must remove only its owned temporary once`);
      if (scenario === "partial-write") {
        assert.equal(events.filter((event) => event === "partial-write").length, 1);
        assert.ok(lifecycle.partialBytes > 0 && lifecycle.partialBytes < lifecycle.intendedBytes, "partial writes must reach the owned temporary without completing the payload");
        assert.equal(Buffer.byteLength(lifecycle.partialContents, "utf8"), lifecycle.partialBytes);
        assert.equal(lifecycle.partialContents, "{\n  \"sch", "the receipt must contain the expected serialized prefix");
      }
      else {
        assert.equal(events.filter((event) => event === "rename-after-close").length, 1, "rename must occur exactly once after the descriptor is closed");
        assert.equal(events.filter((event) => event === "rename-before-close").length, 0);
      }
      assert.equal(existsSync(temporary), false, `${scenario} must clean its owned temporary`);
      assert.equal(existsSync(destination), false, `${scenario} must keep its destination absent`);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("atomic replacement failures preserve the existing reviewed-import fixture", () => {
  for (const scenario of ["collision", "pre-open", "partial-write", "rename"]) {
    const root = setupRoot();
    try {
      const { args } = prepareChangingImport(root);
      const destination = fixturePath(root);
      const fixtureBefore = readFileSync(destination, "utf8");
      const configBefore = readFileSync(join(root, "harness.config.json"), "utf8");
      const historyBefore = readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8");
      const receipt = join(root, `${scenario}-import-receipt.json`);
      const sentinel = "unowned-import-sentinel\n";
      const preload = [
        'import fs from "node:fs";',
        'import { syncBuiltinESMExports } from "node:module";',
        `const destination = ${JSON.stringify(destination)};`,
        "const temporary = `${destination}.${process.pid}.tmp`;",
        `const scenario = ${JSON.stringify(scenario)};`,
        `const receipt = ${JSON.stringify(receipt)};`,
        "const originalOpenSync = fs.openSync;",
        "const originalWriteFileSync = fs.writeFileSync;",
        "const originalCloseSync = fs.closeSync;",
        "const originalRenameSync = fs.renameSync;",
        "const originalUnlinkSync = fs.unlinkSync;",
        "const originalFstatSync = fs.fstatSync;",
        "const originalReadFileSync = fs.readFileSync;",
        "const events = []; let descriptor = null;",
        "let partialBytes = null; let intendedBytes = null; let partialContents = null;",
        "const persist = () => originalWriteFileSync.call(fs, receipt, JSON.stringify({ pid: process.pid, events, partialBytes, intendedBytes, partialContents }));",
        "const fault = () => { const error = new Error('synthetic fault'); error.code = 'EIO'; return error; };",
        `if (scenario === "collision") { originalWriteFileSync.call(fs, temporary, ${JSON.stringify(sentinel)}, "utf8"); events.push("sentinel"); persist(); }`,
        "fs.openSync = function(pathname, ...rest) {",
        "  if (pathname === temporary && scenario === 'pre-open') { events.push('pre-open'); persist(); throw fault(); }",
        "  let value; try { value = originalOpenSync.call(fs, pathname, ...rest); } catch (error) { if (pathname === temporary && scenario === 'collision' && error?.code === 'EEXIST') { events.push('collision'); persist(); } throw error; }",
        "  if (pathname === temporary) { descriptor = value; events.push('open'); persist(); }",
        "  return value;",
        "};",
        "fs.writeFileSync = function(target, contents, ...rest) {",
        "  if (target === descriptor && scenario === 'partial-write') { originalWriteFileSync.call(fs, target, String(contents).slice(0, 8), ...rest); partialBytes = originalFstatSync.call(fs, target).size; intendedBytes = Buffer.byteLength(String(contents), 'utf8'); partialContents = originalReadFileSync.call(fs, temporary, 'utf8'); events.push('partial-write'); persist(); throw fault(); }",
        "  return originalWriteFileSync.call(fs, target, contents, ...rest);",
        "};",
        "fs.closeSync = function(target) { const result = originalCloseSync.call(fs, target); if (target === descriptor) { events.push('close'); persist(); } return result; };",
        "fs.renameSync = function(source, target) {",
        "  if (source === temporary && target === destination && scenario === 'rename') { let closed = false; try { originalFstatSync.call(fs, descriptor); } catch (error) { closed = error?.code === 'EBADF'; } events.push(closed ? 'rename-after-close' : 'rename-before-close'); persist(); throw fault(); }",
        "  return originalRenameSync.call(fs, source, target);",
        "};",
        "fs.unlinkSync = function(pathname) { if (pathname === temporary) { events.push('unlink'); persist(); } return originalUnlinkSync.call(fs, pathname); };",
        "syncBuiltinESMExports();",
      ].join("\n");
      const result = runWithPreload(root, args, preload);
      assertChildOutcome(result, 1, `${scenario} must fail the import: ${result.stderr}`);
      const lifecycle = JSON.parse(readFileSync(receipt, "utf8"));
      const { events } = lifecycle;
      assert.equal(result.stdout, "", `${scenario} must not emit JSON`);
      assert.equal(result.stderr, `[decision-eval] cases fixture ${scenario === "rename" ? "replace" : "write"} failed\n`);
      assert.equal(result.stderr.includes(root), false, `${scenario} must not disclose the synthetic root`);
      assert.equal(lifecycle.pid, result.pid, `${scenario} receipt must identify the evaluator child`);
      assert.equal(readFileSync(destination, "utf8"), fixtureBefore, `${scenario} must preserve the existing fixture`);
      assert.equal(readFileSync(join(root, "harness.config.json"), "utf8"), configBefore);
      assert.equal(readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8"), historyBefore);
      if (scenario === "collision") {
        assert.deepEqual(events, ["sentinel", "collision"]);
        assert.equal(readFileSync(`${destination}.${result.pid}.tmp`, "utf8"), sentinel, "the collision must preserve its unowned temporary sentinel");
      } else if (scenario === "pre-open") {
        assert.equal(existsSync(`${destination}.${result.pid}.tmp`), false, `${scenario} must not create a temporary`);
        assert.deepEqual(events, ["pre-open"]);
      } else {
        assert.equal(existsSync(`${destination}.${result.pid}.tmp`), false, `${scenario} must not leak an owned temporary`);
        assert.equal(events.filter((event) => event === "open").length, 1);
        assert.equal(events.filter((event) => event === "close").length, 1);
        assert.equal(events.filter((event) => event === "unlink").length, 1, `${scenario} must clean up its owned temporary once`);
        if (scenario === "partial-write") {
          assert.equal(events.filter((event) => event === "partial-write").length, 1);
          assert.ok(lifecycle.partialBytes > 0 && lifecycle.partialBytes < lifecycle.intendedBytes, "partial writes must reach the owned temporary without completing the payload");
          assert.equal(Buffer.byteLength(lifecycle.partialContents, "utf8"), lifecycle.partialBytes);
          assert.equal(lifecycle.partialContents, "{\n  \"sch", "the receipt must contain the expected serialized prefix");
        }
        else {
          assert.equal(events.filter((event) => event === "rename-after-close").length, 1, JSON.stringify({ scenario, events }));
          assert.equal(events.filter((event) => event === "rename-before-close").length, 0, JSON.stringify({ scenario, events }));
        }
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("reviewed import replaces the fixture with exact bytes and an owned descriptor lifecycle", () => {
  const root = setupRoot();
  try {
    const { args, candidate } = prepareChangingImport(root);
    const destination = fixturePath(root);
    const fixtureBefore = readFileSync(destination, "utf8");
    const configBefore = readFileSync(join(root, "harness.config.json"), "utf8");
    const historyBefore = readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8");
    const expectedBytes = expectedImportedFixture(fixtureBefore, candidate);
    const receipt = join(root, "successful-import-receipt.json");
    const preload = [
      'import fs from "node:fs";',
      'import { syncBuiltinESMExports } from "node:module";',
      `const destination = ${JSON.stringify(destination)};`,
      `const receiptPath = ${JSON.stringify(receipt)};`,
      "const temporary = `${destination}.${process.pid}.tmp`;",
      "const originalOpenSync = fs.openSync; const originalWriteFileSync = fs.writeFileSync; const originalCloseSync = fs.closeSync; const originalRenameSync = fs.renameSync; const originalUnlinkSync = fs.unlinkSync; const originalFstatSync = fs.fstatSync;",
      "const events = []; let descriptor = null; let writeBase64 = null;",
      "const persist = () => originalWriteFileSync.call(fs, receiptPath, JSON.stringify({ pid: process.pid, temporary, destination, events, writeBase64 }));",
      "fs.openSync = function(pathname, ...rest) { const value = originalOpenSync.call(fs, pathname, ...rest); if (pathname === temporary) { descriptor = value; events.push('open'); persist(); } return value; };",
      "fs.writeFileSync = function(target, contents, ...rest) { if (target === descriptor) { writeBase64 = Buffer.from(contents).toString('base64'); events.push('write'); persist(); } return originalWriteFileSync.call(fs, target, contents, ...rest); };",
      "fs.closeSync = function(target) { const result = originalCloseSync.call(fs, target); if (target === descriptor) { events.push('close'); persist(); } return result; };",
      "fs.renameSync = function(source, target) { if (source === temporary && target === destination) { let closed = false; try { originalFstatSync.call(fs, descriptor); } catch (error) { closed = error?.code === 'EBADF'; } if (!closed) throw new Error('descriptor remained open before rename'); const result = originalRenameSync.call(fs, source, target); events.push('rename-after-close'); persist(); return result; } return originalRenameSync.call(fs, source, target); };",
      "fs.unlinkSync = function(pathname) { if (pathname === temporary) { events.push('unlink'); persist(); } return originalUnlinkSync.call(fs, pathname); };",
      "syncBuiltinESMExports();",
    ].join("\n");
    const processResult = runWithPreload(root, args, preload);
    assertChildOutcome(processResult, 0, `${processResult.stderr}\n${processResult.stdout}`);
    const result = JSON.parse(processResult.stdout);
    const lifecycle = JSON.parse(readFileSync(receipt, "utf8"));
    assert.deepEqual(result, { mode: "import-reviewed", imported: 1, noOp: false });
    assert.equal(lifecycle.pid, processResult.pid, "receipt must identify the evaluator child");
    assert.equal(lifecycle.temporary, `${destination}.${processResult.pid}.tmp`);
    assert.deepEqual(lifecycle.events, ["open", "write", "close", "rename-after-close"]);
    assert.equal(Buffer.from(lifecycle.writeBase64, "base64").toString("utf8"), expectedBytes);
    assert.equal(readFileSync(destination, "utf8"), expectedBytes);
    assert.equal(readFileSync(join(root, "harness.config.json"), "utf8"), configBefore);
    assert.equal(readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8"), historyBefore);
    assert.equal(lifecycle.events.filter((event) => event === "unlink").length, 0, "successful replacement must not unlink its owned temporary");
    assert.equal(existsSync(lifecycle.temporary), false, "successful replacement must not leave its writer temporary file");
    assert.deepEqual(readdirSync(join(root, ".github/harness/eval")).filter((name) => name.endsWith(".tmp")), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("atomic write preserves primary failures when close or cleanup fails", () => {
  for (const scenario of ["close", "cleanup-write", "cleanup-replace"]) {
    const root = setupRoot();
    try {
      const destination = join(root, ".github/harness/runs/decision-calibration/candidates.json");
      const receipt = join(root, `${scenario}-failure-receipt.json`);
      const preload = [
        'import fs from "node:fs";',
        'import { syncBuiltinESMExports } from "node:module";',
        `const destination = ${JSON.stringify(destination)};`,
        "const temporary = `${destination}.${process.pid}.tmp`;",
        `const scenario = ${JSON.stringify(scenario)};`,
        `const receipt = ${JSON.stringify(receipt)};`,
        "const originalOpenSync = fs.openSync; const originalWriteFileSync = fs.writeFileSync; const originalCloseSync = fs.closeSync; const originalRenameSync = fs.renameSync; const originalUnlinkSync = fs.unlinkSync;",
        "let descriptor = null; const events = [];",
        "const persist = () => originalWriteFileSync.call(fs, receipt, JSON.stringify({ pid: process.pid, events }));",
        "const fault = () => { const error = new Error('synthetic fault'); error.code = 'EIO'; return error; };",
        "fs.openSync = function(pathname, ...rest) { const value = originalOpenSync.call(fs, pathname, ...rest); if (pathname === temporary) descriptor = value; return value; };",
        "fs.writeFileSync = function(target, contents, ...rest) { if (scenario === 'cleanup-write' && target === descriptor) { originalWriteFileSync.call(fs, target, String(contents).slice(0, 8), ...rest); events.push('partial-write'); persist(); throw fault(); } return originalWriteFileSync.call(fs, target, contents, ...rest); };",
        "fs.closeSync = function(target) { if (target === descriptor) { const result = originalCloseSync.call(fs, target); descriptor = null; events.push('close'); persist(); if (scenario === 'close') throw fault(); return result; } return originalCloseSync.call(fs, target); }",
        "fs.renameSync = function(source, target) { if (scenario === 'cleanup-replace' && source === temporary && target === destination) { events.push(descriptor === null && events.includes('close') ? 'rename-after-close' : 'rename-before-close'); persist(); throw fault(); } return originalRenameSync.call(fs, source, target); }",
        "fs.unlinkSync = function(pathname) { if (pathname === temporary) { events.push('unlink'); persist(); if (scenario === 'cleanup-write' || scenario === 'cleanup-replace') throw fault(); } return originalUnlinkSync.call(fs, pathname); };",
        "syncBuiltinESMExports();",
      ].join("\n");
      const result = runWithPreload(root, ["--export-candidates", "--json"], preload);
      assertChildOutcome(result, 1, result.stderr);
      const lifecycle = JSON.parse(readFileSync(receipt, "utf8"));
      const { events } = lifecycle;
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, `[decision-eval] candidate queue ${scenario === "cleanup-replace" ? "replace" : "write"} failed\n`);
      assert.equal(lifecycle.pid, result.pid, `${scenario} receipt must identify the evaluator child`);
      assert.equal(events.filter((event) => event === "close").length, 1, "a descriptor must not be closed twice after a close failure");
      assert.equal(events.filter((event) => event === "unlink").length, 1, `${scenario} must attempt cleanup exactly once`);
      if (scenario.startsWith("cleanup")) {
        if (scenario === "cleanup-write") assert.equal(events.filter((event) => event === "partial-write").length, 1);
        else {
          assert.equal(events.filter((event) => event === "rename-after-close").length, 1, JSON.stringify({ scenario, events }));
          assert.equal(events.filter((event) => event === "rename-before-close").length, 0, JSON.stringify({ scenario, events }));
        }
        assert.equal(existsSync(`${destination}.${result.pid}.tmp`), true, "only the owned temporary may remain when cleanup itself fails");
      } else {
        assert.equal(existsSync(`${destination}.${result.pid}.tmp`), false);
      }
      assert.equal(existsSync(destination), false, "failed atomic writes must leave an absent export destination absent");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

function temporaryLinkType(root, outside) {
  const probeLink = join(root, "probe-link");
  const linkTypes = process.platform === "win32" ? ["file", "junction"] : ["file"];
  let unsupportedError = null;
  for (const linkType of linkTypes) {
    const probeTarget = join(outside, `probe-target-${linkType}`);
    try {
      if (linkType === "junction") mkdirSync(probeTarget);
      else writeFileSync(probeTarget, "probe", "utf8");
      symlinkSync(probeTarget, probeLink, linkType);
      rmSync(probeLink);
      return linkType;
    } catch (error) {
      rmSync(probeLink, { recursive: true, force: true });
      rmSync(probeTarget, { recursive: true, force: true });
      if (error?.code !== "EPERM" && error?.code !== "EACCES") throw error;
      unsupportedError = error;
    }
  }
  throw unsupportedError;
}

function writeLinkTarget(target, linkType, kind) {
  const payload = linkType === "junction" ? join(target, "payload.txt") : target;
  if (kind === "existing") {
    if (linkType === "junction") mkdirSync(target);
    writeFileSync(payload, `${kind}-bytes\n`, "utf8");
  }
  return payload;
}

test("atomic write preserves unowned temporary links when the platform supports them", (context) => {
  const root = setupRoot();
  const outside = mkdtempSync(join(tmpdir(), "harness-decision-link-target-"));
  try {
    let linkType;
    try {
      linkType = temporaryLinkType(root, outside);
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") {
        context.skip("temporary symbolic-link or junction creation is unsupported by this test environment");
        return;
      }
      throw error;
    }
    context.diagnostic(`temporary link coverage: ${linkType}`);
    const destination = join(root, ".github/harness/runs/decision-calibration/candidates.json");
    for (const kind of ["existing", "dangling"]) {
      const target = join(outside, `${kind}-payload`);
      const payload = writeLinkTarget(target, linkType, kind);
      const preload = [
        'import fs from "node:fs";',
        'import { dirname } from "node:path";',
        `const destination = ${JSON.stringify(destination)};`,
        `const target = ${JSON.stringify(target)};`,
        `const linkType = ${JSON.stringify(linkType)};`,
        "const temporary = `${destination}.${process.pid}.tmp`;",
        "fs.mkdirSync(dirname(temporary), { recursive: true });",
        "fs.symlinkSync(target, temporary, linkType);",
      ].join("\n");
      const result = runWithPreload(root, ["--export-candidates", "--json"], preload);
      const temporary = `${destination}.${result.pid}.tmp`;
      assertChildOutcome(result, 1, `${kind} temporary link must be rejected: ${result.stderr}`);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "[decision-eval] candidate queue must not use symbolic links or junctions\n");
      assert.equal(lstatSync(temporary).isSymbolicLink(), true, `${kind} link must be preserved`);
      assert.equal(readlinkSync(temporary), target, `${kind} link target must be unchanged`);
      assert.equal(existsSync(destination), false, `${kind} link must not create a destination`);
      if (kind === "existing") assert.equal(readFileSync(payload, "utf8"), `${kind}-bytes\n`);
      else assert.equal(existsSync(target), false, "dangling target must remain absent");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("filesystem failures use safe resource categories without exposing synthetic paths", () => {
  const root = setupRoot();
  try {
    const marker = root.replaceAll("\\", "/");
    const cases = fixturePath(root);
    const history = join(root, ".github/harness/runs/handoffs.jsonl");
    const review = reviewPath(root, "missing-review.json");
    const configPath = join(root, "harness.config.json");
    const casesBytes = readFileSync(cases, "utf8");
    const historyBytes = readFileSync(history, "utf8");
    const configBytes = readFileSync(configPath, "utf8");
    const scenarios = [
      { name: "config", prepare: () => rmSync(configPath), args: ["--deterministic-only", "--json"], category: "harness config read failed" },
      { name: "cases", prepare: () => rmSync(cases), args: ["--deterministic-only", "--json"], category: "cases fixture read failed" },
      { name: "history", prepare: () => rmSync(history), args: ["--export-candidates", "--json"], category: "handoff history read failed" },
      { name: "review", prepare: () => {}, args: ["--deterministic-only", "--reviewed", review, "--json"], category: "reviewed submission read failed" },
    ];
    for (const scenario of scenarios) {
      writeFileSync(configPath, configBytes, "utf8");
      writeFileSync(cases, casesBytes, "utf8");
      writeFileSync(history, historyBytes, "utf8");
      scenario.prepare();
      const result = run(root, scenario.args);
      assertChildOutcome(result, 1, `${scenario.name} must fail: ${result.stderr}`);
      assert.equal(result.stdout, "", `${scenario.name} failure must not emit JSON`);
      assert.match(result.stderr, new RegExp(scenario.category));
      assert.equal(result.stderr.replaceAll("\\", "/").includes(marker), false, `${scenario.name} must not disclose its absolute root`);
    }

    const writeFailure = run(root, ["--export-candidates", "--json"], undefined, { HARNESS_DECISION_EVAL_TEST_FAIL_WRITE: "1" });
    assertChildOutcome(writeFailure, 1, `the legacy write failure must fail: ${writeFailure.stderr}`);
    assert.equal(writeFailure.stdout, "");
    assert.equal(writeFailure.stderr, "[decision-eval] candidate queue write failed\n");
    assert.equal(writeFailure.stderr.replaceAll("\\", "/").includes(marker), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reserved-looking configured labels retain exact own confusion entries", () => {
  const root = setupRoot();
  try {
    const configValue = JSON.parse(readFileSync(join(root, "harness.config.json"), "utf8"));
    const fixtureValue = JSON.parse(readFileSync(fixturePath(root), "utf8"));
    const labels = ["__proto__", "constructor", "prototype", "toString"];
    for (const label of labels) {
      Object.defineProperty(configValue.routing.intentProfiles, label, {
        value: { description: `Synthetic ${label} profile`, stages: ["implement"] },
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    fixtureValue.cases.push(...labels.map((expected, index) => ({
      id: `reserved-label-${index}`,
      task: `Synthetic reserved label route ${index}`,
      expected,
      labelledBy: "model-authored",
      addedAt: "2026-09-29",
    })));
    const configuredLabels = Object.keys(configValue.routing.intentProfiles);
    writeFileSync(join(root, "harness.config.json"), `${JSON.stringify(configValue, null, 2)}\n`, "utf8");
    writeFixture(root, fixtureValue);
    const receipt = join(root, "prototype-receipt.json");
    const preload = [
      'import fs from "node:fs";',
      `const receipt = ${JSON.stringify(receipt)};`,
      "const prototype = Object.prototype;",
      "const baselinePrototype = Object.getPrototypeOf({});",
      "const baselineDescriptors = Object.getOwnPropertyDescriptors(prototype);",
      "const baselineKeys = Object.getOwnPropertyNames(prototype).sort();",
      "function sameDescriptor(left, right) { return left && right && left.configurable === right.configurable && left.enumerable === right.enumerable && left.writable === right.writable && left.value === right.value && left.get === right.get && left.set === right.set; }",
      "process.on('exit', () => { const afterDescriptors = Object.getOwnPropertyDescriptors(prototype); const afterKeys = Object.getOwnPropertyNames(prototype).sort(); const descriptorIdentityUnchanged = baselineKeys.length === afterKeys.length && baselineKeys.every((key, index) => key === afterKeys[index] && sameDescriptor(baselineDescriptors[key], afterDescriptors[key])); fs.writeFileSync(receipt, JSON.stringify({ baselineKeys, afterKeys, descriptorIdentityUnchanged, prototypeIdentityUnchanged: Object.getPrototypeOf({}) === baselinePrototype })); });",
    ].join("\n");
    const result = parseJson(runWithPreload(root, ["--deterministic-only", "--json"], preload));
    for (const label of labels) {
      assert.equal(Object.hasOwn(result.deterministic.confusion, label), true);
      assert.deepEqual(result.deterministic.confusion[label], { correct: 0, wrong: 0, abstained: 1 });
    }
    const prototypeReceipt = JSON.parse(readFileSync(receipt, "utf8"));
    assert.deepEqual(prototypeReceipt.afterKeys, prototypeReceipt.baselineKeys);
    assert.equal(prototypeReceipt.descriptorIdentityUnchanged, true);
    assert.equal(prototypeReceipt.prototypeIdentityUnchanged, true);
    assert.equal(result.deterministic.total, fixtureValue.cases.length);
    assert.deepEqual(Object.keys(result.deterministic.confusion), configuredLabels);
    fixtureValue.cases.at(-1).expected = "not-configured";
    writeFixture(root, fixtureValue);
    const unknownLabel = run(root, ["--deterministic-only", "--json"]);
    assertChildOutcome(unknownLabel, 1, unknownLabel.stderr);
    assert.equal(unknownLabel.stdout, "");
    assert.match(unknownLabel.stderr, /has an unsupported expected intent/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("queue and reviewed flags cannot select different review files", () => {
  const root = setupRoot();
  try {
    const queue = reviewPath(root, "candidates.json");
    const reviewed = reviewPath(root);
    for (const args of [
      ["--deterministic-only", "--queue", queue, "--reviewed", reviewed],
      ["--deterministic-only", "--reviewed", reviewed, "--queue", queue],
    ]) {
      const result = run(root, args);
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "[decision-eval] --queue and --reviewed cannot be used together\n");
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("symlink or junction roots and parent escapes are rejected when the platform supports links", (context) => {
  const root = setupRoot();
  const outside = mkdtempSync(join(tmpdir(), "harness-decision-outside-"));
  try {
    const rootLink = `${root}-link`;
    const parentLink = join(root, ".github/harness/eval/escape");
    try {
      symlinkSync(root, rootLink, process.platform === "win32" ? "junction" : "dir");
      symlinkSync(outside, parentLink, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") context.skip("link creation is unsupported by this Windows test environment");
      else throw error;
      return;
    }
    assert.notEqual(run(rootLink, ["--deterministic-only", "--json"]).status, 0, "a linked allowed root must reject");
    assert.notEqual(run(root, ["--deterministic-only", "--cases", join(root, ".github/harness/eval"), "--json"]).status, 0, "a directory cannot be a case file");
    writeFileSync(join(outside, "cases.json"), readFileSync(fixturePath(root)));
    assert.notEqual(run(root, ["--deterministic-only", "--cases", join(parentLink, "cases.json"), "--json"]).status, 0, "a linked parent path must reject");
    const fixtureBefore = readFileSync(fixturePath(root), "utf8");
    const configBefore = readFileSync(join(root, "harness.config.json"), "utf8");
    assert.equal(parseJson(run(root, ["--export-candidates", "--offset", "0", "--limit", "1", "--json"])).candidates, 1, "a normal contained export is the positive control");
    assert.notEqual(run(root, ["--export-candidates", "--cases", join(outside, "cases.json"), "--json"]).status, 0, "export must reject cases outside the repository root");
    assert.equal(existsSync(reviewPath(root, "candidates.json")), false, "outside cases rejection without an offset must not create the default queue");
    assert.notEqual(run(root, ["--export-candidates", "--cases", join(parentLink, "cases.json"), "--json"]).status, 0, "export must reject linked cases before queue writes");
    assert.equal(existsSync(reviewPath(root, "candidates.json")), false, "linked cases rejection without an offset must not create the default queue");
    assert.equal(existsSync(queuePath(root, 1)), false, "rejected exports must not create a queue");
    rmSync(join(root, ".github/harness/runs"), { recursive: true, force: true });
    mkdirSync(join(root, ".github/harness/runs"), { recursive: true });
    const linkedHistory = join(outside, "handoffs.jsonl");
    mkdirSync(linkedHistory, { recursive: true });
    symlinkSync(linkedHistory, join(root, ".github/harness/runs/handoffs.jsonl"), process.platform === "win32" ? "junction" : "dir");
    const linkedHistoryResult = run(root, ["--export-candidates", "--offset", "1", "--limit", "1", "--json"]);
    assert.notEqual(linkedHistoryResult.status, 0, "export must reject a linked handoff history path before queue writes");
    assert.match(linkedHistoryResult.stderr, /handoff history must not use symbolic links or junctions/);
    assert.equal(existsSync(queuePath(root, 1)), false, "linked history rejection must not create a queue");
    assert.equal(readFileSync(fixturePath(root), "utf8"), fixtureBefore);
    assert.equal(readFileSync(join(root, "harness.config.json"), "utf8"), configBefore);
    assert.equal(existsSync(linkedHistory), true);
  } finally {
    rmSync(`${root}-link`, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("reviewed report compatibility preserves both spellings and output", () => {
  const root = setupRoot();
  try {
    mkdirSync(join(root, ".github/harness/runs/decision-calibration"), { recursive: true });
    const reviewPathname = reviewPath(root, "report-review.json");
    writeFileSync(reviewPathname, `${JSON.stringify({
      schemaVersion: 1,
      candidates: [
        { id: opaqueCandidateId(1), status: "accepted" },
        { id: opaqueCandidateId(2), status: "accepted" },
        { id: opaqueCandidateId(3), status: "deferred" },
        { id: opaqueCandidateId(4), status: "deferred" },
        { id: opaqueCandidateId(5), status: "deferred" },
        { id: opaqueCandidateId(6), status: "rejected" },
        { id: opaqueCandidateId(7), status: "rejected" },
        { id: opaqueCandidateId(8), status: "rejected" },
        { id: opaqueCandidateId(9), status: "rejected" },
        { id: opaqueCandidateId(10), status: "rejected" },
        { id: opaqueCandidateId(11), status: "pending" },
      ],
    })}\n`, "utf8");

    const successfulRunsFixture = readFileSync(fixturePath(root), "utf8");
    const successfulRunsConfig = readFileSync(join(root, "harness.config.json"), "utf8");
    const successfulRunsHistory = readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8");
    const successfulRunsFiles = readdirSync(join(root, ".github/harness/runs/decision-calibration")).sort();
    const selectedReviewBeforeReports = readFileSync(reviewPathname, "utf8");

    for (const format of [[], ["--json"]]) {
      const reviewed = run(root, ["--deterministic-only", "--reviewed", reviewPathname, ...format]);
      const legacyQueue = run(root, ["--deterministic-only", "--queue", reviewPathname, ...format]);

      assert.equal(reviewed.status, 0, reviewed.stderr);
      assert.equal(legacyQueue.status, 0, legacyQueue.stderr);
      assert.equal(legacyQueue.stdout, reviewed.stdout);
      assert.ok(reviewed.stdout.endsWith("\n"));
      assert.equal(reviewed.stderr, "");
      assert.equal(legacyQueue.stderr, "[decision-eval] --queue with --deterministic-only is deprecated; use --reviewed instead.\n");
      const report = JSON.parse(reviewed.stdout);
      assert.deepEqual(report.review, { accepted: 2, deferred: 3, rejected: 5 });
      assert.equal(report.review.pending, undefined);
      assert.equal(report.humanLabelled, 0);
      assert.equal(report.deficit, 100);
      assert.equal(report.promotionEligible, false);
      assert.equal(JSON.stringify(report).includes("task"), false);
      assert.equal(JSON.stringify(report).includes("reviewedBy"), false);
      assert.equal(JSON.stringify(report).includes("sourceRef"), false);
    }

    const compactReport = run(root, ["--deterministic-only", "--reviewed", reviewPathname]);
    const jsonReport = run(root, ["--deterministic-only", "--reviewed", reviewPathname, "--json"]);
    assert.notEqual(compactReport.stdout, jsonReport.stdout);

    const first = run(root, ["--deterministic-only", "--reviewed", reviewPathname]);
    const second = run(root, ["--deterministic-only", "--reviewed", reviewPathname]);
    assert.equal(second.stdout, first.stdout);
    assert.equal(second.stderr, "");
    assert.equal(readFileSync(fixturePath(root), "utf8"), successfulRunsFixture);
    assert.equal(readFileSync(join(root, "harness.config.json"), "utf8"), successfulRunsConfig);
    assert.equal(readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8"), successfulRunsHistory);
    assert.equal(readFileSync(reviewPathname, "utf8"), selectedReviewBeforeReports);
    assert.deepEqual(readdirSync(join(root, ".github/harness/runs/decision-calibration")).sort(), successfulRunsFiles);

    const noBatch = parseJson(run(root, ["--deterministic-only"]));
    assert.deepEqual(noBatch.review, { accepted: "unmeasured", deferred: "unmeasured", rejected: "unmeasured" });

    const pendingPathname = reviewPath(root, "all-pending.json");
    writeFileSync(pendingPathname, `${JSON.stringify({
      schemaVersion: 1,
      candidates: [{ id: opaqueCandidateId(12), status: "pending" }],
    })}\n`, "utf8");
    const pendingFilesBefore = readdirSync(join(root, ".github/harness/runs/decision-calibration")).sort();
    assert.deepEqual(parseJson(run(root, ["--deterministic-only", "--reviewed", pendingPathname])).review, { accepted: 0, deferred: 0, rejected: 0 });
    assert.equal(readFileSync(fixturePath(root), "utf8"), successfulRunsFixture);
    assert.equal(readFileSync(join(root, "harness.config.json"), "utf8"), successfulRunsConfig);
    assert.equal(readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8"), successfulRunsHistory);
    assert.equal(readFileSync(reviewPathname, "utf8"), selectedReviewBeforeReports);
    assert.deepEqual(readdirSync(join(root, ".github/harness/runs/decision-calibration")).sort(), pendingFilesBefore);

    const calibrationDir = join(root, ".github/harness/runs/decision-calibration");
    const fixtureBefore = readFileSync(fixturePath(root), "utf8");
    const configBefore = readFileSync(join(root, "harness.config.json"), "utf8");
    const historyBefore = readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8");
    const invalidReports = [
      { name: "missing", contents: null, pattern: /^\[decision-eval\] [^\n]+\n$/ },
      { name: "malformed", contents: "{not json}\n", pattern: /invalid JSON/ },
      { name: "wrong-schema", contents: `${JSON.stringify({ schemaVersion: 2, candidates: [] })}\n`, pattern: /bounded versioned candidate queue/ },
      { name: "invalid-entry", contents: `${JSON.stringify({ schemaVersion: 1, candidates: [{ id: "candidate-id", status: "unknown" }] })}\n`, pattern: /invalid review entry/ },
    ];
    for (const input of invalidReports) {
      if (input.contents !== null) writeFileSync(reviewPath(root, `${input.name}.json`), input.contents, "utf8");
    }
    const unsafePath = join(root, "outside-review.json");
    writeFileSync(unsafePath, `${JSON.stringify({ schemaVersion: 1, candidates: [] })}\n`, "utf8");
    const filesBefore = readdirSync(calibrationDir).sort();
    for (const input of invalidReports) {
      const pathname = reviewPath(root, `${input.name}.json`);
      assertReportInputRejectedForBoth(root, pathname, input.pattern, input.name);
    }
    assertReportInputRejectedForBoth(root, unsafePath, /must stay inside its allowed local directory/, "outside path");
    for (const [firstFlag, secondFlag] of [["--queue", "--reviewed"], ["--reviewed", "--queue"]]) {
      const result = run(root, ["--deterministic-only", firstFlag, reviewPathname, secondFlag, reviewPathname, "--json"]);
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, "");
      assert.equal(result.stderr, "[decision-eval] --queue and --reviewed cannot be used together\n");
    }
    assert.equal(readFileSync(fixturePath(root), "utf8"), fixtureBefore);
    assert.equal(readFileSync(join(root, "harness.config.json"), "utf8"), configBefore);
    assert.equal(readFileSync(join(root, ".github/harness/runs/handoffs.jsonl"), "utf8"), historyBefore);
    assert.deepEqual(readdirSync(calibrationDir).sort(), filesBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("report bounds and linked review inputs apply to both spellings", (context) => {
  const root = setupRoot();
  try {
    const calibrationDir = join(root, ".github/harness/runs/decision-calibration");
    mkdirSync(calibrationDir, { recursive: true });
    const oversized = reviewPath(root, "oversized-report.json");
    const tooMany = reviewPath(root, "too-many-report.json");
    writeFileSync(oversized, "x".repeat(1024 * 1024 + 1), "utf8");
    writeFileSync(tooMany, `${JSON.stringify({ schemaVersion: 1, candidates: Array.from({ length: 101 }, (_, index) => ({ id: opaqueCandidateId(index + 80), status: "pending" })) })}\n`, "utf8");

    for (const [pathname, pattern, label] of [
      [oversized, /exceeds the 1048576-byte limit/, "oversized report"],
      [tooMany, /bounded versioned candidate queue/, "101-entry report"],
    ]) {
      assertReportInputRejectedForBoth(root, pathname, pattern, label);
    }

    const linkedTarget = join(calibrationDir, "linked-target");
    const linkedReview = join(calibrationDir, "linked-review");
    mkdirSync(linkedTarget);
    writeFileSync(join(linkedTarget, "reviewed.json"), `${JSON.stringify({ schemaVersion: 1, candidates: [] })}\n`, "utf8");
    try {
      symlinkSync(linkedTarget, linkedReview, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (error?.code === "EPERM" || error?.code === "EACCES") {
        context.skip("link creation is unsupported by this Windows test environment");
        return;
      }
      throw error;
    }
    assertReportInputRejectedForBoth(
      root,
      join(linkedReview, "reviewed.json"),
      /must not use symbolic links or junctions/,
      "linked review path",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});