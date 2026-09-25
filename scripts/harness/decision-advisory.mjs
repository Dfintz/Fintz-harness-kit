import {
  buildDecisionReceipt,
  evaluateCandidateDistribution,
  fingerprintDecisionValue,
  hashDecisionTask,
} from "./decision-policy.mjs";

function sidecarPolicy(config) {
  return config?.modelPolicy?.localDecisionSidecar ?? {};
}

const MAX_CRITERION_KEYWORDS = 8;

function intentCandidates(config) {
  const profiles = config?.routing?.intentProfiles ?? {};
  return Object.fromEntries(
    Object.entries(profiles).map(([id, value]) => [id, {
      profile: value?.profile ?? id,
      description: value?.description ?? id,
      keywords: Array.isArray(value?.keywords) ? value.keywords.slice(0, MAX_CRITERION_KEYWORDS) : [],
    }]),
  );
}

// Keywords are offered as sense disambiguators, not as a match rule the scorer should apply.
function criterionText(candidate) {
  if (candidate.keywords.length === 0) return candidate.description;
  return `${candidate.description} Typical phrasing: ${candidate.keywords.join("; ")}.`;
}

function policyIdentity(policy) {
  return {
    policyId: policy.policyId ?? "local-decision-shadow-v1",
    minProbability: policy.minProbability ?? 0.7,
    minMargin: policy.minMargin ?? 0.15,
    timeoutMs: policy.timeoutMs ?? 1000,
    mode: "shadow",
  };
}

export function buildDecisionAdvisoryIdentity({ task, route, config }) {
  const policy = sidecarPolicy(config);
  const candidates = intentCandidates(config);
  return {
    taskHash: hashDecisionTask(task),
    policyId: policy.policyId ?? "local-decision-shadow-v1",
    policyFingerprint: fingerprintDecisionValue(policyIdentity(policy)),
    candidateFingerprint: fingerprintDecisionValue(candidates),
    requestedModel: policy.model ?? "Qwen/Qwen3.5-4B",
    requestedRevision: policy.revision ?? "unconfigured",
    baseline: {
      profile: route?.profile ?? null,
      intent: route?.intent ?? null,
      intentSource: route?.intentSource ?? null,
    },
    candidates,
  };
}

function endpointUrl(policy) {
  const base = new URL(policy.endpoint ?? "http://127.0.0.1:11437");
  if (!/^127\.0\.0\.1$|^\[?::1\]?$|^localhost$/i.test(base.hostname)) {
    throw new Error("local decision sidecar endpoint must use a loopback host");
  }
  base.pathname = `${base.pathname.replace(/\/$/, "")}/v1/systemone`;
  return base;
}

function unavailableReceipt(identity, route, reason, latencyMs) {
  return buildDecisionReceipt({
    runId: route?.runId ?? null,
    ...identity,
    status: "unavailable",
    outcome: "unavailable",
    distribution: null,
    baseline: identity.baseline,
    agreement: null,
    fallbackReason: reason,
    latencyMs,
  });
}

export async function evaluateDecisionAdvisory({
  task,
  route,
  config,
  fetchImpl = fetch,
}) {
  const policy = sidecarPolicy(config);
  if (policy.enabled !== true) return null;
  const identity = buildDecisionAdvisoryIdentity({ task, route, config });
  if (Object.keys(identity.candidates).length < 2) {
    return unavailableReceipt(identity, route, "insufficient-candidates", 0);
  }

  const controller = new AbortController();
  const timeoutMs = policy.timeoutMs ?? 1000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetchImpl(endpointUrl(policy), {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: identity.requestedModel,
        state: { task: String(task ?? "") },
        questions: {
          intent_profile: {
            type: "choice",
            instructions: "Which existing harness intent profile best matches this task?",
            criteria: Object.fromEntries(
              Object.entries(identity.candidates).map(([id, candidate]) => [id, criterionText(candidate)]),
            ),
          },
        },
      }),
    });
    if (!response.ok) {
      return unavailableReceipt(identity, route, `sidecar-http-${response.status}`, performance.now() - started);
    }
    const payload = await response.json();
    const answer = payload?.answers?.intent_profile;
    if (answer?.type !== "choice" || !answer.probabilities) {
      return unavailableReceipt(identity, route, "invalid-sidecar-response", performance.now() - started);
    }
    const result = evaluateCandidateDistribution({
      probabilities: answer.probabilities,
      minProbability: policy.minProbability ?? 0.7,
      minMargin: policy.minMargin ?? 0.15,
    });
    const selectedProfile = identity.candidates[result.selected]?.profile ?? null;
    const status = result.outcome;
    return buildDecisionReceipt({
      runId: route?.runId ?? null,
      ...identity,
      status,
      resolvedModel: typeof payload.model === "string" ? payload.model : null,
      outcome: result.outcome,
      selected: result.selected,
      selectedProbability: result.probability,
      margin: result.margin,
      distribution: answer.probabilities,
      baseline: identity.baseline,
      agreement: status === "matched" ? selectedProfile === route?.profile : null,
      fallbackReason: status === "uncertain" ? "policy-uncertain" : null,
      latencyMs: performance.now() - started,
    });
  } catch {
    return unavailableReceipt(identity, route, "sidecar-unavailable", performance.now() - started);
  } finally {
    clearTimeout(timer);
  }
}

export function isReusableDecisionReceipt(receipt, identity) {
  const scoredStatus = receipt?.status === "matched" || receipt?.status === "uncertain";
  const usableResult = scoredStatus
    && receipt.outcome === receipt.status
    && typeof receipt.selected === "string"
    && Object.hasOwn(identity.candidates, receipt.selected)
    && Number.isFinite(receipt.selectedProbability)
    && Number.isFinite(receipt.margin)
    && receipt.distribution
    && typeof receipt.distribution === "object"
    && !Array.isArray(receipt.distribution);
  return usableResult
    && receipt.schemaVersion === 1
    && receipt.sticky === true
    && receipt.taskHash === identity.taskHash
    && receipt.policyId === identity.policyId
    && receipt.policyFingerprint === identity.policyFingerprint
    && receipt.candidateFingerprint === identity.candidateFingerprint
    && receipt.requestedModel === identity.requestedModel
    && receipt.requestedRevision === identity.requestedRevision;
}
