"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRoleIpcSigningSecretConfigured = isRoleIpcSigningSecretConfigured;
exports.buildSignedRoleIpcPayload = buildSignedRoleIpcPayload;
exports.isSignedRoleIpcPayload = isSignedRoleIpcPayload;
exports.verifySignedRoleIpcPayload = verifySignedRoleIpcPayload;
exports.consumeRoleIpcReplayToken = consumeRoleIpcReplayToken;
exports.clearRoleIpcReplayCacheForTests = clearRoleIpcReplayCacheForTests;
const node_crypto_1 = __importDefault(require("node:crypto"));
const ROLE_IPC_MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
const ROLE_IPC_REPLAY_TTL_MS = ROLE_IPC_MAX_TIMESTAMP_DRIFT_MS;
const MAX_ROLE_IPC_REPLAY_CACHE_SIZE = 10_000;
const replayCache = new Map();
const resolveRoleIpcSigningSecret = () => {
    const configured = process.env.BOT_IPC_ROLE_SIGNING_SECRET ?? process.env.INTERNAL_SERVICE_SECRET;
    if (!configured) {
        return null;
    }
    const trimmed = configured.trim();
    return trimmed.length > 0 ? trimmed : null;
};
function isRoleIpcSigningSecretConfigured() {
    return resolveRoleIpcSigningSecret() !== null;
}
const buildSignaturePayload = (action, payload, issuedAt) => [
    action,
    payload.organizationId,
    payload.guildId,
    payload.userId,
    payload.roleId,
    String(issuedAt),
].join('.');
function createSignature(action, payload, issuedAt) {
    const secret = resolveRoleIpcSigningSecret();
    if (!secret) {
        throw new Error('Role IPC signing secret is not configured');
    }
    const canonicalPayload = buildSignaturePayload(action, payload, issuedAt);
    return node_crypto_1.default.createHmac('sha256', secret).update(canonicalPayload).digest('hex');
}
function buildReplayCacheKey(action, payload) {
    return `${action}.${payload.signature}`;
}
function evictExpiredReplayEntries(now) {
    if (replayCache.size < MAX_ROLE_IPC_REPLAY_CACHE_SIZE) {
        return;
    }
    for (const [cacheKey, expiresAt] of replayCache) {
        if (expiresAt <= now) {
            replayCache.delete(cacheKey);
        }
    }
    if (replayCache.size >= MAX_ROLE_IPC_REPLAY_CACHE_SIZE) {
        const oldestEntry = replayCache.entries().next().value;
        if (oldestEntry !== undefined) {
            const [oldestKey] = oldestEntry;
            replayCache.delete(oldestKey);
        }
    }
}
function buildSignedRoleIpcPayload(action, payload, issuedAt = Date.now()) {
    return {
        ...payload,
        issuedAt,
        signature: createSignature(action, payload, issuedAt),
    };
}
function isSignedRoleIpcPayload(data) {
    return (typeof data.guildId === 'string' &&
        typeof data.userId === 'string' &&
        typeof data.roleId === 'string' &&
        typeof data.organizationId === 'string' &&
        typeof data.issuedAt === 'number' &&
        Number.isFinite(data.issuedAt) &&
        typeof data.signature === 'string');
}
function verifySignedRoleIpcPayload(action, payload) {
    const secret = resolveRoleIpcSigningSecret();
    if (!secret) {
        return { valid: false, reason: 'Role IPC signing secret is not configured' };
    }
    if (!Number.isInteger(payload.issuedAt) || payload.issuedAt <= 0) {
        return { valid: false, reason: 'Invalid IPC timestamp' };
    }
    if (!/^[a-fA-F0-9]{64}$/.test(payload.signature)) {
        return { valid: false, reason: 'Invalid IPC signature format' };
    }
    const expectedHex = createSignature(action, payload, payload.issuedAt);
    const provided = Buffer.from(payload.signature, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    if (provided.length !== expected.length || !node_crypto_1.default.timingSafeEqual(provided, expected)) {
        return { valid: false, reason: 'Invalid IPC signature' };
    }
    const drift = Math.abs(Date.now() - payload.issuedAt);
    if (drift > ROLE_IPC_MAX_TIMESTAMP_DRIFT_MS) {
        return { valid: false, reason: 'IPC message timestamp expired' };
    }
    return { valid: true };
}
function consumeRoleIpcReplayToken(action, payload) {
    const now = Date.now();
    const replayKey = buildReplayCacheKey(action, payload);
    const cachedExpiry = replayCache.get(replayKey);
    if (cachedExpiry && cachedExpiry > now) {
        return { valid: false, reason: 'IPC message replay detected' };
    }
    evictExpiredReplayEntries(now);
    replayCache.set(replayKey, now + ROLE_IPC_REPLAY_TTL_MS);
    return { valid: true };
}
function clearRoleIpcReplayCacheForTests() {
    replayCache.clear();
}
//# sourceMappingURL=roleIpcAuth.js.map