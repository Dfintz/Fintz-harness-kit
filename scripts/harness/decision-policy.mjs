import { createHash, randomUUID } from "node:crypto";

const DISTRIBUTION_TOLERANCE = 1e-6;
const MAX_RECEIPT_BYTES = 16 * 1024;

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right))
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

export function stableDecisionJson(value) {
  return JSON.stringify(stableValue(value));
}

export function hashDecisionTask(task) {
  return sha256(String(task ?? "").trim().toLowerCase().replace(/\s+/g, " "));
}

export function fingerprintDecisionValue(value) {
  return sha256(stableDecisionJson(value));
}

function validatedEntries(probabilities) {
  if (!probabilities || typeof probabilities !== "object" || Array.isArray(probabilities)) {
    throw new TypeError("probabilities must be an object");
  }
  const entries = Object.entries(probabilities);
  if (entries.length < 2) {
    throw new RangeError("probabilities must contain at least two candidates");
  }
  let total = 0;
  for (const [candidate, probability] of entries) {
    if (!candidate) {
      throw new RangeError("candidate ids must be non-empty");
    }
    if (!Number.isFinite(probability)) {
      throw new RangeError("probabilities must be finite");
    }
    if (probability < 0 || probability > 1) {
      throw new RangeError("probabilities must be in [0, 1]");
    }
    total += probability;
  }
  if (Math.abs(total - 1) > DISTRIBUTION_TOLERANCE) {
    throw new RangeError("probabilities must sum to 1");
  }
  return entries;
}

export function evaluateCandidateDistribution({
  probabilities,
  minProbability = 0.7,
  minMargin = 0.15,
}) {
  const entries = validatedEntries(probabilities);
  if (!Number.isFinite(minProbability) || minProbability < 0 || minProbability > 1) {
    throw new RangeError("minProbability must be in [0, 1]");
  }
  if (!Number.isFinite(minMargin) || minMargin < 0 || minMargin > 1) {
    throw new RangeError("minMargin must be in [0, 1]");
  }
  const ranked = entries
    .map(([candidate, probability], index) => ({ candidate, probability, index }))
    .sort((left, right) => right.probability - left.probability || left.index - right.index);
  const selected = ranked[0];
  const margin = selected.probability - ranked[1].probability;
  return {
    outcome:
      selected.probability >= minProbability && margin >= minMargin
        ? "matched"
        : "uncertain",
    selected: selected.candidate,
    probability: selected.probability,
    margin,
  };
}

export function buildDecisionReceipt(input) {
  const distribution = input.distribution
    ? Object.fromEntries(validatedEntries(input.distribution))
    : null;
  const receipt = {
    schemaVersion: 1,
    advisoryId: input.advisoryId ?? `adv-${randomUUID()}`,
    runId: input.runId ?? null,
    at: input.at ?? new Date().toISOString(),
    status: input.status,
    mode: "shadow",
    site: input.site ?? "intent-profile",
    taskHash: input.taskHash,
    policyId: input.policyId,
    policyFingerprint: input.policyFingerprint,
    candidateFingerprint: input.candidateFingerprint,
    requestedModel: input.requestedModel,
    requestedRevision: input.requestedRevision,
    resolvedModel: input.resolvedModel ?? null,
    outcome: input.outcome ?? null,
    selected: input.selected ?? null,
    selectedProbability: input.selectedProbability ?? null,
    margin: input.margin ?? null,
    distribution,
    baseline: {
      profile: input.baseline?.profile ?? null,
      intent: input.baseline?.intent ?? null,
      intentSource: input.baseline?.intentSource ?? null,
    },
    agreement: input.agreement ?? null,
    fallbackReason: input.fallbackReason ?? null,
    latencyMs: input.latencyMs ?? null,
    sticky: true,
  };
  const serialized = JSON.stringify(receipt);
  if (Buffer.byteLength(serialized) > MAX_RECEIPT_BYTES) {
    throw new RangeError(`decision receipt exceeds ${MAX_RECEIPT_BYTES} bytes`);
  }
  return receipt;
}

export function evaluateShadowWindow(records, {
  minWindow = 20,
  targetAgreement = 0.99,
  promoted = false,
} = {}) {
  const comparable = records.filter((record) => record?.comparable === true);
  const agreements = comparable.filter((record) => record.agreement === true).length;
  const agreement = comparable.length === 0 ? null : agreements / comparable.length;
  const enough = comparable.length >= minWindow;
  return {
    compared: comparable.length,
    agreements,
    agreement,
    promotionEligible: !promoted && enough && agreement >= targetAgreement,
    demotionRecommended: promoted && enough && agreement < targetAgreement,
  };
}

export function shouldSampleDecisionCheck(key, share) {
  if (!Number.isFinite(share) || share < 0 || share > 1) {
    throw new RangeError("share must be in [0, 1]");
  }
  if (share === 0) return false;
  if (share === 1) return true;
  const bucket = createHash("sha256").update(String(key)).digest().readUInt32BE(0) / 4_294_967_296;
  return bucket < share;
}
