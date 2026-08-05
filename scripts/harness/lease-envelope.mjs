import { hostname } from "node:os";

const DEFAULT_LEASE_TTL_MS = 300000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 60000;

function parseMsEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer (milliseconds).`);
  }
  return value;
}

export function loadLeaseConfig() {
  const leaseTtlMs = parseMsEnv("HARNESS_LOOP_LEASE_TTL_MS", DEFAULT_LEASE_TTL_MS);
  const heartbeatIntervalMs = parseMsEnv(
    "HARNESS_LOOP_HEARTBEAT_INTERVAL_MS",
    DEFAULT_HEARTBEAT_INTERVAL_MS,
  );
  if (heartbeatIntervalMs >= leaseTtlMs / 2) {
    throw new Error(
      "HARNESS_LOOP_HEARTBEAT_INTERVAL_MS must be less than HARNESS_LOOP_LEASE_TTL_MS / 2.",
    );
  }
  return {
    leaseTtlMs,
    heartbeatIntervalMs,
    forceReap: process.env.HARNESS_LOOP_FORCE_REAP === "true",
  };
}

export function buildLeaseOwner(startedAtIso) {
  return `${hostname()}:${process.pid}:${startedAtIso}`;
}

export function isLeaseExpired(lease, nowMs = Date.now()) {
  if (!lease || typeof lease !== "object") return false;
  const expiresAtMs = Date.parse(lease.expiresAt ?? "");
  if (!Number.isFinite(expiresAtMs)) return true;
  return nowMs >= expiresAtMs;
}

export function normalizedLease(lease) {
  if (!lease || typeof lease !== "object") return null;
  const owner = typeof lease.owner === "string" ? lease.owner : null;
  const acquiredAt = typeof lease.acquiredAt === "string" ? lease.acquiredAt : null;
  const heartbeatAt = typeof lease.heartbeatAt === "string" ? lease.heartbeatAt : acquiredAt;
  const expiresAt = typeof lease.expiresAt === "string" ? lease.expiresAt : heartbeatAt;
  const version = Number.isInteger(lease.version) && lease.version >= 1 ? lease.version : 1;
  const state = typeof lease.state === "string" ? lease.state : "active";
  if (!owner || !acquiredAt || !heartbeatAt || !expiresAt) return null;
  return {
    owner,
    acquiredAt,
    heartbeatAt,
    expiresAt,
    version,
    state,
    leaseTtlMs:
      Number.isInteger(lease.leaseTtlMs) && lease.leaseTtlMs > 0
        ? lease.leaseTtlMs
        : undefined,
    heartbeatIntervalMs:
      Number.isInteger(lease.heartbeatIntervalMs) && lease.heartbeatIntervalMs > 0
        ? lease.heartbeatIntervalMs
        : undefined,
  };
}

export function leaseSnapshot(lease) {
  const normalized = normalizedLease(lease);
  if (!normalized) return null;
  return {
    owner: normalized.owner,
    version: normalized.version,
    heartbeatAt: normalized.heartbeatAt,
    expiresAt: normalized.expiresAt,
  };
}

export function leaseSnapshotMatches(current, snapshot) {
  if (!snapshot) return true;
  const now = leaseSnapshot(current);
  if (!now) return false;
  return (
    now.owner === snapshot.owner &&
    now.version === snapshot.version &&
    now.heartbeatAt === snapshot.heartbeatAt &&
    now.expiresAt === snapshot.expiresAt
  );
}

export function ensureLeaseHistory(record) {
  if (!Array.isArray(record.leaseHistory)) {
    record.leaseHistory = [];
  }
}

export function appendLeaseEvent(record, event) {
  ensureLeaseHistory(record);
  record.leaseHistory.push(event);
}

export function acquireLease(record, owner, config, nowIso, event, metadata = {}) {
  const nowMs = Date.parse(nowIso);
  const expiresAt = new Date(nowMs + config.leaseTtlMs).toISOString();
  const priorVersion = Number.isInteger(record.lease?.version) ? record.lease.version : 0;
  record.lease = {
    owner,
    acquiredAt: nowIso,
    heartbeatAt: nowIso,
    expiresAt,
    version: priorVersion + 1,
    state: "active",
    leaseTtlMs: config.leaseTtlMs,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
  };
  appendLeaseEvent(record, {
    event,
    at: nowIso,
    owner,
    ...metadata,
  });
}

export function heartbeatLease(record, config, nowIso) {
  const lease = normalizedLease(record.lease);
  if (!lease) return false;
  const nowMs = Date.parse(nowIso);
  const expiresAt = new Date(nowMs + config.leaseTtlMs).toISOString();
  record.lease = {
    ...lease,
    heartbeatAt: nowIso,
    expiresAt,
    state: "active",
    version: lease.version + 1,
    leaseTtlMs: config.leaseTtlMs,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
  };
  appendLeaseEvent(record, {
    event: "heartbeat",
    at: nowIso,
    owner: lease.owner,
  });
  return true;
}

export function expireLease(record, reason, atIso) {
  const lease = normalizedLease(record.lease);
  if (!lease) return;
  record.lease = {
    ...lease,
    state: "expired",
    expiresAt: atIso,
    version: lease.version + 1,
  };
  appendLeaseEvent(record, {
    event: "expired",
    at: atIso,
    owner: lease.owner,
    reason,
  });
}

export function releaseLease(record, atIso) {
  const lease = normalizedLease(record.lease);
  if (!lease) return;
  record.lease = {
    ...lease,
    state: "released",
    heartbeatAt: atIso,
    expiresAt: atIso,
    version: lease.version + 1,
  };
  appendLeaseEvent(record, {
    event: "released",
    at: atIso,
    owner: lease.owner,
  });
}
