import crypto from 'node:crypto';

const ROLE_IPC_MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
const ROLE_IPC_REPLAY_TTL_MS = ROLE_IPC_MAX_TIMESTAMP_DRIFT_MS;
const MAX_ROLE_IPC_REPLAY_CACHE_SIZE = 10_000;
const replayCache = new Map<string, number>();

const resolveRoleIpcSigningSecret = (): string | null => {
  const configured = process.env.BOT_IPC_ROLE_SIGNING_SECRET ?? process.env.INTERNAL_SERVICE_SECRET;
  if (!configured) {
    return null;
  }

  const trimmed = configured.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Whether a role IPC signing secret is configured. Used at startup to fail fast
 * (with a clear log) instead of silently breaking all role sync at runtime when
 * `buildSignedRoleIpcPayload`/`verifySignedRoleIpcPayload` would throw.
 */
export function isRoleIpcSigningSecretConfigured(): boolean {
  return resolveRoleIpcSigningSecret() !== null;
}

export interface RoleIpcPayloadBase extends Record<string, unknown> {
  guildId: string;
  userId: string;
  roleId: string;
  organizationId: string;
}

export interface SignedRoleIpcPayload extends RoleIpcPayloadBase {
  issuedAt: number;
  signature: string;
}

const buildSignaturePayload = (
  action: string,
  payload: RoleIpcPayloadBase,
  issuedAt: number
): string =>
  [
    action,
    payload.organizationId,
    payload.guildId,
    payload.userId,
    payload.roleId,
    String(issuedAt),
  ].join('.');

function createSignature(action: string, payload: RoleIpcPayloadBase, issuedAt: number): string {
  const secret = resolveRoleIpcSigningSecret();
  if (!secret) {
    throw new Error('Role IPC signing secret is not configured');
  }

  const canonicalPayload = buildSignaturePayload(action, payload, issuedAt);
  return crypto.createHmac('sha256', secret).update(canonicalPayload).digest('hex');
}

function buildReplayCacheKey(action: string, payload: SignedRoleIpcPayload): string {
  return `${action}.${payload.signature}`;
}

function evictExpiredReplayEntries(now: number): void {
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

export function buildSignedRoleIpcPayload(
  action: string,
  payload: RoleIpcPayloadBase,
  issuedAt: number = Date.now()
): SignedRoleIpcPayload {
  return {
    ...payload,
    issuedAt,
    signature: createSignature(action, payload, issuedAt),
  };
}

export function isSignedRoleIpcPayload(
  data: Record<string, unknown>
): data is SignedRoleIpcPayload {
  return (
    typeof data.guildId === 'string' &&
    typeof data.userId === 'string' &&
    typeof data.roleId === 'string' &&
    typeof data.organizationId === 'string' &&
    typeof data.issuedAt === 'number' &&
    Number.isFinite(data.issuedAt) &&
    typeof data.signature === 'string'
  );
}

export function verifySignedRoleIpcPayload(
  action: string,
  payload: SignedRoleIpcPayload
): { valid: boolean; reason?: string } {
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

  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
    return { valid: false, reason: 'Invalid IPC signature' };
  }

  const drift = Math.abs(Date.now() - payload.issuedAt);
  if (drift > ROLE_IPC_MAX_TIMESTAMP_DRIFT_MS) {
    return { valid: false, reason: 'IPC message timestamp expired' };
  }

  return { valid: true };
}

export function consumeRoleIpcReplayToken(
  action: string,
  payload: SignedRoleIpcPayload
): { valid: boolean; reason?: string } {
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

export function clearRoleIpcReplayCacheForTests(): void {
  replayCache.clear();
}
