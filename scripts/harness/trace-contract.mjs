export function normalizeTraceEvent(event) {
  if (typeof event === "string") return { stage: event };
  if (!event || typeof event !== "object") return {};
  return event;
}

export function assertStageSequence(events, expectedStages) {
  const actual = events.map((event) => normalizeTraceEvent(event).stage).filter(Boolean);
  let cursor = 0;
  for (const stage of expectedStages) {
    const index = actual.indexOf(stage, cursor);
    if (index === -1) {
      throw new Error(`trace missing stage ${JSON.stringify(stage)} after index ${cursor}`);
    }
    cursor = index + 1;
  }
  return { actual, expected: [...expectedStages] };
}

export function assertExactStageSequence(actualStages, expectedStages) {
  const actual = [...actualStages];
  const expected = [...expectedStages];
  if (actual.length !== expected.length || actual.some((stage, index) => stage !== expected[index])) {
    throw new Error(`trace stage sequence mismatch: expected ${expected.join(" -> ")}, got ${actual.join(" -> ")}`);
  }
  return { actual, expected };
}

export function assertArtifactHandoffs(stagePrompts) {
  const produced = new Set();
  for (const stage of stagePrompts) {
    for (const required of stage.requiredArtifacts ?? []) {
      if (!produced.has(required)) {
        throw new Error(`stage ${stage.stage} requires unavailable artifact ${required}`);
      }
    }
    if (typeof stage.outputFile !== "string" || stage.outputFile.length === 0) {
      throw new Error(`stage ${stage.stage} has no output file`);
    }
    produced.add(stage.outputFile);
  }
  return { produced: [...produced] };
}

export function assertPromptContains(prompt, fragments, label = "prompt") {
  const text = String(prompt ?? "");
  const missing = fragments.filter((fragment) => !text.includes(fragment));
  if (missing.length > 0) {
    throw new Error(`${label} is missing contract fragments: ${missing.join(", ")}`);
  }
  return { label, checked: [...fragments] };
}

export function assertRequiredContext(events, requiredContextKeys) {
  const normalized = events.map(normalizeTraceEvent);
  const missing = requiredContextKeys.filter((key) =>
    !normalized.some((event) => event.context?.[key] !== undefined || event[key] !== undefined),
  );
  if (missing.length > 0) {
    throw new Error(`trace missing required context: ${missing.join(", ")}`);
  }
  return { required: [...requiredContextKeys], missing: [] };
}

export function validateRouteTrace(events, expectedStages, requiredContextKeys = []) {
  return {
    sequence: assertStageSequence(events, expectedStages),
    context: assertRequiredContext(events, requiredContextKeys),
  };
}
