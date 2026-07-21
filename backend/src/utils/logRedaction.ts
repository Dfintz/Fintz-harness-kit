import winston from 'winston';

/**
 * Defense-in-depth log redaction for the Winston pipeline (SEC-04 / A4).
 *
 * The logger fans out to several transports — production container stdout
 * (Console), local files, Azure Blob, and Application Insights. Only the
 * Application Insights transport sanitises its own payload; the Console / File /
 * Blob transports emit whatever metadata the caller passed. A stray
 * `logger.info('msg', { authorization: token })` would therefore leak secrets to
 * the primary production log sink (Container Apps stdout).
 *
 * This module adds a global Winston `format` that redacts secret-bearing
 * metadata on EVERY log entry before it reaches any transport. It complements —
 * it does not replace — call-site sanitisation (`sanitizeObject`,
 * `sanitizeRedisErrorForLogging`).
 *
 * Scope is intentionally **secrets / credentials**, not PII (e.g. email, IP):
 * over-redacting identifiers harms debuggability and PII has its own
 * consent/audit framework.
 */

export const REDACTED = '[REDACTED]';

/**
 * Structural / Winston-internal string keys that are never metadata and must be
 * preserved verbatim. (Winston's finalized output also lives on Symbol keys,
 * which `Object.keys` never enumerates, so those are preserved automatically.)
 */
const PRESERVED_KEYS = new Set<string>([
  'level',
  'message',
  'timestamp',
  'service',
  'stack',
  'requestId',
  'correlationId',
  'userId',
  'ms',
  'label',
]);

/**
 * High-confidence sensitive key fragments (matched as lowercased substrings).
 *
 * Deliberately tuned to avoid the over-redaction of the call-site
 * `sanitizeObject` default list (which matches bare `key` and `auth`, hiding
 * `cacheKey`, `keyword`, `author`, `authority`, …). Here we use the specific
 * `apikey` / `api_key` / `privatekey` and `authorization` / `oauth` fragments so
 * ordinary debug context survives while real secrets are caught.
 */
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwd',
  'passphrase',
  'secret',
  'token',
  'authorization',
  'oauth',
  'apikey',
  'api_key',
  'credential',
  'cookie',
  'bearer',
  'jwt',
  'privatekey',
  'private_key',
  'sessionid',
  'session_id',
] as const;

const MAX_DEPTH = 6;

/**
 * Whether a metadata key looks like it carries a secret/credential value.
 */
export function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some(pattern => lower.includes(pattern));
}

/**
 * Plain object = created from an object literal / `Object.create(null)`.
 * Everything else (Date, Buffer, Error, RegExp, Map, Set, class instances) is
 * left untraversed so we never accidentally flatten it into `{}`.
 */
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as object | null;
  return proto === Object.prototype || proto === null;
}

/**
 * Recursively redact a metadata value. Builds new containers for plain objects
 * and arrays; returns all other values (primitives and non-plain objects)
 * unchanged. Guards against circular references and runaway depth.
 */
function redactValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (depth >= MAX_DEPTH) {
    return value;
  }

  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map(item => redactValue(item, seen, depth + 1));
  }

  // Leave non-plain objects (Date, Buffer, Error, etc.) intact.
  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactValue(nested, seen, depth + 1);
  }
  return result;
}

/**
 * Redact secret-bearing metadata on a Winston info object **in place**.
 *
 * Only own enumerable string keys are touched, so Winston's Symbol-keyed
 * internals (`Symbol.for('level')`, `Symbol.for('message')`, `Symbol.for('splat')`)
 * are preserved and the same object identity flows on to the transports.
 *
 * @returns the same `info` object (mutated).
 */
export function redactLogInfo(info: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet<object>();
  for (const key of Object.keys(info)) {
    if (PRESERVED_KEYS.has(key)) {
      continue;
    }
    info[key] = isSensitiveKey(key) ? REDACTED : redactValue(info[key], seen, 0);
  }
  return info;
}

/**
 * Winston format that applies {@link redactLogInfo} to every log entry. Place it
 * after `splat()` (so splat-merged metadata is covered) and before the
 * serialisation step (`json()` / `printf`).
 */
export const redactionFormat = winston.format(info => {
  redactLogInfo(info);
  return info;
});
