#!/usr/bin/env node
/**
 * Scores the local decision sidecar against deterministic routing on a labelled case set.
 * Read-only: never mutates harness.config.json and never changes route authority.
 */
import { randomUUID } from "node:crypto";
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { evaluateDecisionAdvisory } from "./decision-advisory.mjs";
import { planTask } from "./prompt-router.mjs";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MAX_HISTORY_BYTES = 10 * 1024 * 1024;
const MAX_REVIEW_BYTES = 1024 * 1024;
const MAX_RECORDS = 10_000;
const MAX_BATCH = 100;
const MAX_TASK_BYTES = 8 * 1024;
const MAX_PRIVATE_JSON_BYTES = 1024 * 1024;
const MAX_METADATA_BYTES = 200;
const DEFAULT_LIMIT = 25;
const FILESYSTEM_FAILURE = Symbol("filesystemFailure");
const REVIEW_STATUSES = new Set(["accepted", "deferred", "rejected", "pending"]);
const SPLITS = new Set(["train", "calibration", "held-out"]);
const VALUE_OPTION_SETTERS = new Map([
  ["--repo-root", (values, value) => { values.repoRoot = value; values.repoRootCount += 1; }],
  ["--cases", (values, value) => { values.cases = value; }],
  ["--endpoint", (values, value) => { values.endpoint = value; }],
  ["--model", (values, value) => { values.model = value; }],
  ["--revision", (values, value) => { values.revision = value; }],
  ["--timeout-ms", (values, value) => { values.timeoutMs = Number(value); }],
  ["--limit", (values, value) => { values.limit = Number(value); }],
  ["--import-reviewed", (values, value) => { values.importReviewed = value; }],
  ["--reviewed", (values, value) => { values.reviewed = value; }],
  ["--queue", (values, value) => { values.queue = value; }],
  ["--offset", (values, value) => { values.offset = Number(value); values.offsetSpecified = true; }],
]);
const FLAG_OPTION_SETTERS = new Map([
  ["--export-candidates", (values) => { values.exportCandidates = true; }],
  ["--deterministic-only", (values) => { values.deterministicOnly = true; }],
  ["--json", (values) => { values.json = true; }],
  ["--require-sidecar", (values) => { values.requireSidecar = true; }],
]);

function resolveRepoRoot(value) {
  return resolve(value ?? process.env.HARNESS_PROJECT_ROOT ?? sourceRoot);
}

function applyValueOption(values, name, next) {
  const setter = VALUE_OPTION_SETTERS.get(name);
  if (!setter) return false;
  setter(values, next());
  return true;
}

function applyFlagOption(values, name) {
  const setter = FLAG_OPTION_SETTERS.get(name);
  if (!setter) return false;
  setter(values);
  return true;
}

function parseArgs(argv) {
  const values = {
    repoRoot: null,
    repoRootCount: 0,
    cases: null,
    endpoint: process.env.HARNESS_DECISION_ENDPOINT_EVAL ?? null,
    model: process.env.HARNESS_DECISION_MODEL ?? null,
    revision: process.env.HARNESS_DECISION_REVISION ?? null,
    timeoutMs: 15000,
    json: false,
    requireSidecar: false,
    exportCandidates: false,
    deterministicOnly: false,
    importReviewed: null,
    reviewed: null,
    queue: null,
    offset: 0,
    offsetSpecified: false,
    limit: DEFAULT_LIMIT,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    const next = () => {
      const value = argv[++index];
      if (!value) throw new Error(`${name} requires a value`);
      return value;
    };
    if (applyValueOption(values, name, next) || applyFlagOption(values, name)) continue;
    throw new Error(`unknown option: ${name}`);
  }
  if (values.queue && values.reviewed) throw new Error("--queue and --reviewed cannot be used together");
  const legacyReportQueue = values.deterministicOnly && values.queue !== null;
  if (legacyReportQueue) {
    values.reviewed = values.queue;
    values.queue = null;
  }
  const offlineModes = [values.exportCandidates, values.deterministicOnly, Boolean(values.importReviewed)].filter(Boolean).length;
  if (offlineModes > 1) throw new Error("offline modes are mutually exclusive");
  if (values.repoRootCount > 1) throw new Error("--repo-root may only be provided once");
  if (!Number.isInteger(values.limit) || values.limit < 1 || values.limit > MAX_BATCH) {
    throw new Error(`--limit must be a positive integer no greater than ${MAX_BATCH}`);
  }
  if (!Number.isInteger(values.offset) || values.offset < 0) throw new Error("--offset must be a non-negative integer");
  if (values.importReviewed && values.cases) throw new Error("--cases cannot be used with --import-reviewed");
  values.legacyReportQueue = legacyReportQueue;
  return values;
}

function pathsFor(root, options) {
  const runsRoot = join(root, ".github", "harness", "runs");
  const calibrationRoot = join(runsRoot, "decision-calibration");
  return {
    cases: options.cases ? resolve(options.cases) : join(root, ".github", "harness", "eval", "decision-intent-cases.json"),
    history: join(runsRoot, "handoffs.jsonl"),
    calibrationRoot,
    candidates: join(calibrationRoot, options.offsetSpecified ? `candidates-${options.offset}.json` : "candidates.json"),
    candidateQueue: options.queue ? resolve(options.queue) : join(calibrationRoot, "candidates.json"),
  };
}

function isMissingPath(error) {
  return error && typeof error === "object" && error.code === "ENOENT";
}

function filesystemFailure(label, operation) {
  const error = new Error(`${label} ${operation} failed`);
  error[FILESYSTEM_FAILURE] = true;
  return error;
}

function isFilesystemFailure(error) {
  return error instanceof Error && error[FILESYSTEM_FAILURE] === true;
}

function lstatOrMissing(path, label, operation) {
  try {
    return lstatSync(path);
  } catch (error) {
    if (isMissingPath(error)) return null;
    throw filesystemFailure(label, operation);
  }
}

function assertNoSymbolicLinks(path, label) {
  let current = resolve(path);
  while (true) {
    const details = lstatOrMissing(current, label, "path inspection");
    if (details?.isSymbolicLink()) {
      throw new Error(`${label} must not use symbolic links or junctions`);
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

function assertContained(path, root, label) {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(path);
  const pathRelative = relative(resolvedRoot, resolvedPath);
  if (!pathRelative || pathRelative === ".." || pathRelative.startsWith(`..${sep}`) || isAbsolute(pathRelative)) {
    throw new Error(`${label} must stay inside its allowed local directory`);
  }
  assertNoSymbolicLinks(resolvedRoot, label);
  let current = resolvedRoot;
  for (const segment of pathRelative.split(sep)) {
    current = join(current, segment);
    if (lstatOrMissing(current, label, "path inspection")?.isSymbolicLink()) throw new Error(`${label} must not use symbolic links or junctions`);
  }
}

function readBounded(path, root, maxBytes, label) {
  assertContained(path, root, label);
  const linkDetails = lstatOrMissing(path, label, "read");
  if (!linkDetails) throw filesystemFailure(label, "read");
  if (linkDetails.isSymbolicLink()) throw new Error(`${label} must not use symbolic links or junctions`);
  let details;
  try {
    details = statSync(path);
  } catch {
    throw filesystemFailure(label, "read");
  }
  if (!details.isFile()) throw new Error(`${label} must be a regular file`);
  if (details.size > maxBytes) throw new Error(`${label} exceeds the ${maxBytes}-byte limit`);
  let contents;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    throw filesystemFailure(label, "read");
  }
  if (Buffer.byteLength(contents, "utf8") > maxBytes) throw new Error(`${label} exceeds the ${maxBytes}-byte limit`);
  return contents;
}

function parseBoundedJson(path, root, maxBytes, label) {
  try {
    return JSON.parse(readBounded(path, root, maxBytes, label));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} contains invalid JSON`);
    throw error;
  }
}

function loadConfig(root) {
  const configPath = join(root, "harness.config.json");
  return parseBoundedJson(configPath, root, MAX_HISTORY_BYTES, "harness config");
}

function normalizeTask(value) {
  if (typeof value !== "string") throw new Error("task must be a string");
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) throw new Error("task must not be empty");
  if (Buffer.byteLength(normalized, "utf8") > MAX_TASK_BYTES) throw new Error(`task exceeds the ${MAX_TASK_BYTES}-byte limit`);
  return normalized;
}

function serializeBounded(value, maxBytes, label) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(serialized, "utf8") > maxBytes) throw new Error(`${label} exceeds the ${maxBytes}-byte limit`);
  return serialized;
}

function closeDescriptor(descriptor) {
  if (descriptor !== null) {
    try { closeSync(descriptor); } catch {}
  }
}

function cleanUpOwnedTemporary(temporary, root, label, ownsTemporary) {
  if (!ownsTemporary) return;
  try {
    assertContained(temporary, root, label);
    const details = lstatOrMissing(temporary, label, "cleanup");
    if (details?.isFile() && !details.isSymbolicLink()) unlinkSync(temporary);
  } catch {}
}

function atomicWrite(path, serialized, root, label) {
  assertContained(path, root, label);
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    throw filesystemFailure(label, "write");
  }
  assertContained(path, root, label);
  const temporary = `${path}.${process.pid}.tmp`;
  assertContained(temporary, root, label);
  let descriptor = null;
  let ownsTemporary = false;
  try {
    if (process.env.HARNESS_DECISION_EVAL_TEST_FAIL_WRITE === "1") {
      throw filesystemFailure(label, "write");
    }
    try {
      descriptor = openSync(temporary, "wx", 0o600);
    } catch {
      throw filesystemFailure(label, "write");
    }
    ownsTemporary = true;
    try {
      writeFileSync(descriptor, serialized, "utf8");
    } catch {
      throw filesystemFailure(label, "write");
    }
    const openedDescriptor = descriptor;
    descriptor = null;
    try {
      closeSync(openedDescriptor);
    } catch {
      throw filesystemFailure(label, "write");
    }
    assertContained(temporary, root, label);
    assertContained(path, root, label);
    try {
      renameSync(temporary, path);
    } catch {
      throw filesystemFailure(label, "replace");
    }
    ownsTemporary = false;
  } catch (error) {
    closeDescriptor(descriptor);
    cleanUpOwnedTemporary(temporary, root, label, ownsTemporary);
    if (isFilesystemFailure(error) || (error instanceof Error && !("code" in error))) throw error;
    throw filesystemFailure(label, "write");
  }
}

function writeJsonIdempotent(path, value, root, label) {
  assertContained(path, root, label);
  const serialized = serializeBounded(value, MAX_PRIVATE_JSON_BYTES, label);
  if (lstatOrMissing(path, label, "write")) {
    if (readBounded(path, root, MAX_PRIVATE_JSON_BYTES, label) === serialized) return false;
    throw new Error(`${label} already exists with conflicting data`);
  }
  atomicWrite(path, serialized, root, label);
  return true;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function validTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function allowedLabels(config) {
  const labels = Object.keys(config.routing?.intentProfiles ?? {});
  if (labels.length === 0) throw new Error("harness config has no canonical intent profiles");
  return labels;
}

function requireRealCaseMetadata(item, label) {
  const confirmation = item.confirmation;
  if (typeof item.provenance !== "string" || !item.provenance.trim()
    || typeof item.reviewedBy !== "string" || !item.reviewedBy.trim()
    || !validTimestamp(item.reviewedAt) || item.publicationConsent !== true
    || confirmation?.finalTaskConfirmed !== true || confirmation?.expectedConfirmed !== true || confirmation?.publicationConfirmed !== true) {
    throw new Error(`${label} has incomplete real-case confirmation metadata`);
  }
}

function boundedMetadata(value, label) {
  if (typeof value !== "string" || !value.trim() || Buffer.byteLength(value, "utf8") > MAX_METADATA_BYTES) {
    throw new Error(`${label} must be a nonempty string no longer than ${MAX_METADATA_BYTES} bytes`);
  }
  return value.trim();
}

function validateSourceReference(item, label) {
  if (item.sourceRef !== undefined && (typeof item.sourceRef !== "string" || !item.sourceRef.trim())) {
    throw new Error(`${label} has an invalid source reference`);
  }
  const historyLinked = item.labelledBy === "history-derived" || item.sourceRef?.startsWith("handoff:");
  if (item.labelledBy === "history-derived" && !item.sourceRef) throw new Error(`${label} lacks history source linkage`);
  if (historyLinked && !isOpaqueCandidateId(item.id)) throw new Error(`${label} has a non-opaque history-linked id`);
}

function validateCaseShape(item, label, validLabels) {
  if (!item || typeof item.id !== "string" || !item.id) throw new Error(`${label} has an invalid id`);
  normalizeTask(item.task);
  if (typeof item.expected !== "string" || !validLabels.has(item.expected)) throw new Error(`${label} has an unsupported expected intent`);
  if (!validDate(item.addedAt)) throw new Error(`${label} has an invalid added date`);
  if (!['model-authored', 'human-labelled', 'history-derived'].includes(item.labelledBy)) throw new Error(`${label} has invalid provenance`);
  if (item.labelledBy !== "model-authored") requireRealCaseMetadata(item, label);
  validateSourceReference(item, label);
  if (item.split !== undefined && (typeof item.split !== "string" || !SPLITS.has(item.split))) throw new Error(`${label} has an invalid split`);
  if (item.taskFamily !== undefined) boundedMetadata(item.taskFamily, `${label} task family`);
  if (item.split === "held-out" && (!item.taskFamily || item.familySeparationConfirmed !== true)) {
    throw new Error(`${label} lacks held-out family-separation confirmation`);
  }
}

function validateFamilySeparation(cases) {
  const families = new Map();
  for (const item of cases) {
    if (!item.taskFamily || !item.split) continue;
    const existing = families.get(item.taskFamily);
    if (existing && existing !== item.split) throw new Error(`task family ${item.taskFamily} appears in multiple splits`);
    families.set(item.taskFamily, item.split);
  }
}

function validateFixture(fixture, config) {
  if (fixture?.schemaVersion !== 1 || !Array.isArray(fixture.cases) || fixture.cases.length === 0 || fixture.cases.length > MAX_RECORDS) {
    throw new Error("cases fixture must be a nonempty schema version 1 case list");
  }
  if (!Number.isInteger(fixture.promotionRequires?.minHumanLabelledCases) || fixture.promotionRequires.minHumanLabelledCases < 100) {
    throw new Error("promotionRequires.minHumanLabelledCases must be at least 100");
  }
  if (fixture.promotionRequires.maxConfidentWrong !== 0) throw new Error("promotionRequires.maxConfidentWrong must be zero");
  const validLabels = new Set(allowedLabels(config));
  const ids = new Set();
  const tasks = new Set();
  const realSourceRefs = new Set();
  for (const item of fixture.cases) {
    validateCaseShape(item, `case ${String(item?.id ?? "unknown")}`, validLabels);
    if (ids.has(item.id)) throw new Error("case ids must be unique and nonempty");
    ids.add(item.id);
    const task = normalizeTask(item.task);
    if (tasks.has(task)) throw new Error("case tasks must be unique after normalization");
    tasks.add(task);
    if (item.labelledBy !== "model-authored" && item.sourceRef) {
      if (realSourceRefs.has(item.sourceRef)) throw new Error("real case source references must be unique");
      realSourceRefs.add(item.sourceRef);
    }
  }
  validateFamilySeparation(fixture.cases);
}

function loadValidatedCases(path, root, config) {
  const fixture = parseBoundedJson(path, root, MAX_HISTORY_BYTES, "cases fixture");
  validateFixture(fixture, config);
  return fixture;
}

function parseHistoryCandidate(line, index) {
  if (!line.trim()) return { kind: "empty-line" };
  let record;
  try { record = JSON.parse(line); } catch { return { kind: "malformed" }; }
  try {
    return { kind: "candidate", task: normalizeTask(record?.task), sourceRef: `handoff:record-${index + 1}` };
  } catch (error) {
    if (error instanceof Error && error.message.includes("exceeds")) throw error;
    return { kind: "empty" };
  }
}

function selectHistoryCandidates(content, committedSourceRefs, options) {
  const lines = content.split(/\r?\n/);
  const recordCount = lines.filter((line) => line.trim()).length;
  if (recordCount > MAX_RECORDS) throw new Error(`handoff history exceeds the ${MAX_RECORDS}-record limit`);
  const candidates = [];
  const seen = new Set();
  let malformed = 0;
  let empty = 0;
  let duplicates = 0;
  for (const [index, line] of lines.entries()) {
    const parsed = parseHistoryCandidate(line, index);
    if (parsed.kind === "empty-line") continue;
    if (parsed.kind === "malformed") { malformed += 1; continue; }
    if (parsed.kind === "empty") { empty += 1; continue; }
    if (seen.has(parsed.task)) { duplicates += 1; continue; }
    seen.add(parsed.task);
    if (seen.size <= options.offset || seen.size > options.offset + options.limit || committedSourceRefs.has(parsed.sourceRef)) continue;
    candidates.push({
      id: `candidate-${randomUUID()}`,
      task: parsed.task,
      expected: null,
      reviewedBy: null,
      reviewedAt: null,
      publicationConsent: null,
      provenance: null,
      status: "pending",
      sourceRef: parsed.sourceRef,
    });
  }
  return { candidates, malformed, empty, duplicates };
}

function writeCandidateQueue(path, calibrationRoot, queue, candidates) {
  if (!lstatOrMissing(path, "candidate queue", "write")) {
    writeJsonIdempotent(path, queue, calibrationRoot, "candidate queue");
    return true;
  }
  const existing = loadReviewSubmission(path, calibrationRoot);
  const sameSelection = existing.offset === queue.offset
    && existing.candidates.length === candidates.length
    && existing.candidates.every((item, index) => item.task === candidates[index].task && item.sourceRef === candidates[index].sourceRef);
  if (!sameSelection) throw new Error("candidate queue already exists with conflicting data");
  return false;
}

function exportCandidates(root, options) {
  const paths = pathsFor(root, options);
  assertContained(paths.candidates, paths.calibrationRoot, "candidate queue");
  const config = loadConfig(root);
  const fixture = loadValidatedCases(paths.cases, root, config);
  const committedSourceRefs = new Set(fixture.cases.map((item) => item.sourceRef).filter((sourceRef) => typeof sourceRef === "string"));
  const content = readBounded(paths.history, join(root, ".github", "harness", "runs"), MAX_HISTORY_BYTES, "handoff history");
  const { candidates, malformed, empty, duplicates } = selectHistoryCandidates(content, committedSourceRefs, options);
  const queue = { schemaVersion: 1, status: "private-review-queue", offset: options.offset, candidates };
  const wrote = writeCandidateQueue(paths.candidates, paths.calibrationRoot, queue, candidates);
  return { mode: "export-candidates", candidatePath: paths.candidates, candidates: candidates.length, malformed, empty, duplicates, wrote };
}

function scoreDeterministic(cases, config, labels) {
  const tallies = new Map(labels.map((label) => [label, { correct: 0, wrong: 0, abstained: 0 }]));
  const report = { total: 0, correct: 0, wrong: 0, abstained: 0, accuracy: null };
  for (const item of cases) {
    const intent = planTask(item.task, config, {}).intent ?? null;
    const category = tallies.get(item.expected);
    if (!category) throw new Error("cases fixture has an unsupported expected intent");
    report.total += 1;
    if (intent === null) {
      report.abstained += 1;
      category.abstained += 1;
    } else if (intent === item.expected) {
      report.correct += 1;
      category.correct += 1;
    } else {
      report.wrong += 1;
      category.wrong += 1;
    }
  }
  report.accuracy = report.total === 0 ? null : report.correct / report.total;
  return { ...report, confusion: Object.fromEntries(labels.map((label) => [label, tallies.get(label)])) };
}

function splitCounts(cases) {
  const counts = { train: 0, calibration: 0, "held-out": 0, unassigned: 0 };
  for (const item of cases) counts[item.split ?? "unassigned"] += 1;
  return counts;
}

function deterministicBaseline(root, options) {
  const paths = pathsFor(root, options);
  const config = loadConfig(root);
  const fixture = loadValidatedCases(paths.cases, root, config);
  const labels = allowedLabels(config);
  const real = fixture.cases.filter((item) => item.labelledBy !== "model-authored");
  const synthetic = fixture.cases.filter((item) => item.labelledBy === "model-authored");
  const coverage = Object.fromEntries(labels.map((intent) => [intent, real.filter((item) => item.expected === intent).length]));
  const review = options.reviewed
    ? loadReviewSubmission(resolve(options.reviewed), paths.calibrationRoot)
    : null;
  return {
    mode: "deterministic-only",
    smokeCases: synthetic.length,
    humanLabelled: real.length,
    required: fixture.promotionRequires.minHumanLabelledCases,
    deficit: Math.max(0, fixture.promotionRequires.minHumanLabelledCases - real.length),
    coverage,
    zeroCoverage: labels.filter((intent) => coverage[intent] === 0),
    splits: splitCounts(real),
    review: review
      ? {
        accepted: review.candidates.filter((item) => item?.status === "accepted").length,
        deferred: review.candidates.filter((item) => item?.status === "deferred").length,
        rejected: review.candidates.filter((item) => item?.status === "rejected").length,
      }
      : { accepted: "unmeasured", deferred: "unmeasured", rejected: "unmeasured" },
    deterministic: scoreDeterministic(fixture.cases, config, labels),
    syntheticDeterministic: scoreDeterministic(synthetic, config, labels),
    realDeterministic: scoreDeterministic(real, config, labels),
    promotionEligible: false,
    readiness: false,
    readinessStatus: "not established",
    sidecarMetrics: "not measured",
  };
}

function loadReviewSubmission(path, calibrationRoot) {
  const submission = parseBoundedJson(path, calibrationRoot, MAX_PRIVATE_JSON_BYTES, "reviewed submission");
  if (submission?.schemaVersion !== 1 || !Array.isArray(submission.candidates) || submission.candidates.length > MAX_BATCH) {
    throw new Error("reviewed submission must be a bounded versioned candidate queue");
  }
  for (const item of submission.candidates) {
    if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.id !== "string" || !item.id || !REVIEW_STATUSES.has(item.status)) {
      throw new Error("reviewed submission contains an invalid review entry");
    }
  }
  return submission;
}

function sameCase(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isOpaqueCandidateId(value) {
  return typeof value === "string" && /^candidate-[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateReviewedEntries(entries, sourceById) {
  const ids = new Set();
  for (const item of entries) {
    if (!isOpaqueCandidateId(item.id)) throw new Error("reviewed submission contains a non-UUID candidate id");
    if (ids.has(item.id)) throw new Error("reviewed submission contains duplicate candidate ids");
    ids.add(item.id);
    const source = sourceById.get(item.id);
    if (!source || source.sourceRef !== item.sourceRef) throw new Error(`reviewed case ${item.id} does not match the local candidate queue`);
    const task = normalizeTask(item.task);
    if (item.status !== "accepted" && task !== source.task) {
      throw new Error(`non-accepted case ${item.id} must retain its original candidate task`);
    }
  }
}

function projectAcceptedCase(item, source, task, allowedIntents) {
  if (!allowedIntents.has(item.expected)) throw new Error(`accepted case ${item.id} has an unsupported expected intent`);
  if (!["human-labelled", "history-derived"].includes(item.labelledBy)) throw new Error(`accepted case ${item.id} must have real-case provenance`);
  boundedMetadata(item.provenance, `accepted case ${item.id} provenance`);
  boundedMetadata(item.reviewedBy, `accepted case ${item.id} reviewer`);
  if (item.taskFamily !== undefined) boundedMetadata(item.taskFamily, `accepted case ${item.id} task family`);
  requireRealCaseMetadata(item, `accepted case ${item.id}`);
  const imported = {
    id: item.id,
    task,
    expected: item.expected,
    labelledBy: item.labelledBy,
    addedAt: item.reviewedAt.slice(0, 10),
    provenance: item.provenance.trim(),
    reviewedBy: item.reviewedBy.trim(),
    reviewedAt: item.reviewedAt,
    publicationConsent: true,
    confirmation: {
      finalTaskConfirmed: true,
      expectedConfirmed: true,
      publicationConfirmed: true,
    },
    sourceRef: source.sourceRef,
  };
  if (item.taskFamily !== undefined) imported.taskFamily = item.taskFamily;
  if (item.split !== undefined) imported.split = item.split;
  if (item.familySeparationConfirmed === true) imported.familySeparationConfirmed = true;
  return imported;
}

function collectReviewedAdditions(accepted, sourceById, fixture, allowedIntents) {
  const existingById = new Map(fixture.cases.map((item) => [item.id, item]));
  const existingBySourceRef = new Map(fixture.cases
    .filter((item) => typeof item.sourceRef === "string")
    .map((item) => [item.sourceRef, item]));
  const existingTasks = new Set(fixture.cases.map((item) => normalizeTask(item.task)));
  const ids = new Set();
  const tasks = new Set();
  const sourceRefs = new Set();
  const additions = [];

  for (const item of accepted) {
    const source = sourceById.get(item.id);
    const task = normalizeTask(item.task);
    if (ids.has(item.id) || tasks.has(task) || sourceRefs.has(source.sourceRef)) throw new Error("reviewed submission contains duplicate accepted cases");
    ids.add(item.id);
    tasks.add(task);
    sourceRefs.add(source.sourceRef);
    const imported = projectAcceptedCase(item, source, task, allowedIntents);

    const existing = existingById.get(imported.id);
    if (existing) {
      if (!sameCase(existing, imported)) throw new Error(`accepted case ${imported.id} conflicts with an existing fixture case`);
      continue;
    }
    const existingSource = existingBySourceRef.get(imported.sourceRef);
    if (existingSource) throw new Error(`accepted case ${imported.id} conflicts with an existing fixture source`);
    if (existingTasks.has(task)) throw new Error(`accepted case ${imported.id} conflicts with an existing fixture task`);
    existingTasks.add(task);
    existingBySourceRef.set(imported.sourceRef, imported);
    additions.push(imported);
  }
  return additions;
}

function importReviewed(root, options) {
  const paths = pathsFor(root, options);
  const config = loadConfig(root);
  const fixture = loadValidatedCases(paths.cases, root, config);
  const queue = loadReviewSubmission(paths.candidateQueue, paths.calibrationRoot);
  const reviewed = loadReviewSubmission(resolve(options.importReviewed), paths.calibrationRoot);
  const sourceById = new Map(queue.candidates.map((item) => [item.id, item]));
  validateReviewedEntries(reviewed.candidates, sourceById);
  const accepted = reviewed.candidates.filter((item) => item?.status === "accepted");
  if (accepted.length === 0) throw new Error("reviewed submission contains no accepted cases");
  const allowedIntents = new Set(allowedLabels(config));
  const additions = collectReviewedAdditions(accepted, sourceById, fixture, allowedIntents);

  const nextFixture = { ...fixture, cases: [...fixture.cases, ...additions] };
  validateFixture(nextFixture, config);
  if (additions.length > 0) {
    atomicWrite(paths.cases, serializeBounded(nextFixture, MAX_HISTORY_BYTES, "cases fixture"), root, "cases fixture");
  }
  return { mode: "import-reviewed", imported: additions.length, noOp: additions.length === 0 };
}

// The fixture is scored against a transient policy so the committed config stays disabled.
function evaluationConfig(options, config) {
  config = structuredClone(config);
  const policy = config.modelPolicy?.localDecisionSidecar;
  if (!policy) throw new Error("modelPolicy.localDecisionSidecar is missing from harness.config.json");
  policy.enabled = true;
  policy.timeoutMs = options.timeoutMs;
  if (options.endpoint) policy.endpoint = options.endpoint;
  if (options.model) policy.model = options.model;
  if (options.revision) policy.revision = options.revision;
  return config;
}

function emptyTally() {
  return { correct: 0, wrong: 0, abstained: 0 };
}

function classifySidecarRow(row) {
  if (row.status === "unavailable") {
    if (row.selected !== null || row.probability !== null) throw new Error("unavailable rows must not report a selection or probability");
    return { observed: false, unavailable: true };
  }
  if (!['matched', 'uncertain'].includes(row.status)) throw new Error("summary rows have an unknown sidecar status");
  if (typeof row.selected !== "string" || !row.selected || !Number.isFinite(row.probability) || row.probability < 0 || row.probability > 1) {
    throw new Error(`${row.status} rows require a finite selected probability`);
  }
  return { observed: true, abstained: row.status === "uncertain", selected: row.selected, probability: row.probability };
}

function tallyDeterministicRow(row, tally) {
  if (row.deterministic === null) tally.abstained += 1;
  else if (row.deterministic === row.expected) tally.correct += 1;
  else tally.wrong += 1;
}

function tallySidecarRow(row, minProbability, tally) {
  const sidecarRow = classifySidecarRow(row);
  if (!sidecarRow.observed) {
    tally.abstained += 1;
    return { confidentWrong: 0, unavailable: 1 };
  }
  const confidentWrong = sidecarRow.selected !== row.expected && sidecarRow.probability >= minProbability ? 1 : 0;
  if (sidecarRow.abstained) tally.abstained += 1;
  else if (sidecarRow.selected === row.expected) tally.correct += 1;
  else tally.wrong += 1;
  return { confidentWrong, unavailable: 0 };
}

export function summarise(rows, minProbability) {
  if (!Number.isFinite(minProbability) || minProbability < 0 || minProbability > 1) {
    throw new Error("minimum probability must be a finite value between zero and one");
  }
  const deterministic = emptyTally();
  const sidecar = emptyTally();
  let confidentWrong = 0;
  let unavailable = 0;

  for (const row of rows) {
    if (!row || typeof row.expected !== "string" || !row.expected) throw new Error("summary rows require an expected intent");
    tallyDeterministicRow(row, deterministic);
    const result = tallySidecarRow(row, minProbability, sidecar);
    confidentWrong += result.confidentWrong;
    unavailable += result.unavailable;
  }

  return { total: rows.length, deterministic, sidecar, confidentWrong, unavailable, minProbability };
}

export function promotionDecision({ summary, fixture, policy }) {
  const reasons = [];
  const requirements = fixture.promotionRequires;
  const realCases = fixture.cases.filter((item) => item.labelledBy !== "model-authored");
  const allMatched = summary.total === fixture.cases.length
    && summary.unavailable === 0
    && summary.sidecar.abstained === 0;

  if (policy.freeze?.status === "frozen") reasons.push("frozen");
  if (!allMatched) reasons.push("incomplete-sidecar-observations");
  if (realCases.length < requirements.minHumanLabelledCases) reasons.push("insufficient-real-cases");
  if (summary.confidentWrong > requirements.maxConfidentWrong) reasons.push("confident-wrong");
  reasons.push("held-out-evidence-not-established", "family-separation-not-established");

  return { promotionEligible: false, reasons: reasons.length > 0 ? reasons : ["independent-unfreeze-gates-not-satisfied"] };
}

function provenance(cases) {
  const counts = {};
  for (const item of cases) {
    const level = item.labelledBy ?? "unspecified";
    counts[level] = (counts[level] ?? 0) + 1;
  }
  return counts;
}

function runOfflineMode(root, options) {
  if (options.exportCandidates) return exportCandidates(root, options);
  if (options.deterministicOnly) return deterministicBaseline(root, options);
  if (options.importReviewed) return importReviewed(root, options);
  return null;
}

async function evaluateLiveReport(root, options) {
  const paths = pathsFor(root, options);
  const config = evaluationConfig(options, loadConfig(root));
  const fixture = loadValidatedCases(paths.cases, root, config);
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
  const promotion = promotionDecision({ summary, fixture, policy });
  return { summary, levels, humanLabelled, required, promotion, rows };
}

function writeLiveText({ summary, levels, humanLabelled, required, promotion, rows }) {
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
  process.stdout.write(`confident-wrong:    ${summary.confidentWrong} (wrong at p >= ${summary.minProbability})\n`);
  process.stdout.write(`sidecar unavailable:${String(summary.unavailable).padStart(2)}\n`);
  process.stdout.write(`label provenance:   ${JSON.stringify(levels)}\n`);
  process.stdout.write(`promotion eligible: ${promotion.promotionEligible ? "yes" : "no"} (${humanLabelled}/${required} human-labelled; ${promotion.reasons.join(", ")})\n`);
}

function writeLiveReport(result, json) {
  if (json) {
    const { summary, levels, humanLabelled, required, promotion, rows } = result;
    process.stdout.write(`${JSON.stringify({ summary, levels, humanLabelled, required, promotionEligible: promotion.promotionEligible, promotionReasons: promotion.reasons, rows }, null, 2)}\n`);
    return;
  }
  writeLiveText(result);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.legacyReportQueue) {
    process.stderr.write("[decision-eval] --queue with --deterministic-only is deprecated; use --reviewed instead.\n");
  }
  const root = resolveRepoRoot(options.repoRoot);
  const offlineOutput = runOfflineMode(root, options);
  if (offlineOutput) {
    process.stdout.write(`${JSON.stringify(offlineOutput, null, options.json ? 2 : 0)}\n`);
    return;
  }
  const result = await evaluateLiveReport(root, options);
  writeLiveReport(result, options.json);
  if (options.requireSidecar && result.summary.unavailable > 0) {
    const { unavailable } = result.summary;
    process.stderr.write(`[decision-eval] sidecar unavailable for ${unavailable} case(s)\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) {
  try {
    await main();
  } catch (error) {
    let message = "operation failed";
    if (error instanceof Error) message = error.message;
    process.stderr.write(`[decision-eval] ${message}\n`);
    process.exitCode = 1;
  }
}
