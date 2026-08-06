function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }
  return value;
}

function stableSerialize(value) {
  const serialized = JSON.stringify(stableValue(value));
  return serialized === undefined ? String(value) : serialized;
}

function hookEntries(manifest, source, findings) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) return [];
  if (!Object.hasOwn(manifest, "hooks")) return [];
  if (!Array.isArray(manifest.hooks)) {
    findings.push({
      code: "invalid-hooks-container",
      source,
      details: "hooks must be an array when present",
    });
    return [];
  }
  return manifest.hooks;
}

export function hookIdentity(entry, fallbackProvider = "unknown") {
  const provider = String(entry?.provider ?? fallbackProvider);
  const event = String(entry?.event ?? entry?.type ?? "");
  const command = String(entry?.command ?? entry?.run ?? "");
  return `${provider}\u0000${event}\u0000${command}`;
}

export function mergeHookManifests(base = {}, incoming = {}, options = {}) {
  const provider = options.provider ?? "unknown";
  const findings = [];
  const merged = { ...base, ...incoming };
  const seen = new Set();
  const hooks = [];
  for (const [source, manifest] of [["base", base], ["incoming", incoming]]) {
    for (const entry of hookEntries(manifest, source, findings)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        findings.push({ code: "invalid-hook-entry", source, entry });
        continue;
      }
      const identity = hookIdentity(entry, provider);
      if (seen.has(identity)) {
        findings.push({ code: "duplicate-hook", source, identity });
        const existing = hooks.find((candidate) => hookIdentity(candidate, provider) === identity);
        if (existing && stableSerialize(existing) !== stableSerialize(entry)) {
          findings.push({ code: "hook-payload-conflict", source, identity });
        }
        continue;
      }
      seen.add(identity);
      hooks.push({ ...entry });
    }
  }
  for (const key of Object.keys(base).filter((key) => key !== "hooks" && Object.hasOwn(incoming, key)).sort()) {
    if (stableSerialize(base[key]) !== stableSerialize(incoming[key])) {
      findings.push({ code: "metadata-conflict", key, source: "incoming" });
    }
  }
  merged.hooks = hooks;
  return { manifest: merged, findings };
}

export function stripHooks(manifest = {}, predicate = () => false) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { manifest, removed: [], findings: [] };
  }
  if (Object.hasOwn(manifest, "hooks") && !Array.isArray(manifest.hooks)) {
    return {
      manifest: { ...manifest },
      removed: [],
      findings: [{ code: "invalid-hooks-container", source: "manifest", details: "hooks must be an array when present" }],
    };
  }
  const removed = [];
  const kept = [];
  for (const entry of hookEntries(manifest, "manifest", [])) {
    if (entry && typeof entry === "object" && predicate(entry)) removed.push(entry);
    else kept.push(entry);
  }
  return { manifest: { ...manifest, hooks: kept }, removed, findings: [] };
}
