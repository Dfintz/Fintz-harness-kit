"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactionFormat = exports.REDACTED = void 0;
exports.isSensitiveKey = isSensitiveKey;
exports.redactLogInfo = redactLogInfo;
const winston_1 = __importDefault(require("winston"));
exports.REDACTED = '[REDACTED]';
const PRESERVED_KEYS = new Set([
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
];
const MAX_DEPTH = 6;
function isSensitiveKey(key) {
    const lower = key.toLowerCase();
    return SENSITIVE_KEY_PATTERNS.some(pattern => lower.includes(pattern));
}
function isPlainObject(value) {
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function redactValue(value, seen, depth) {
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
    if (!isPlainObject(value)) {
        return value;
    }
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
        result[key] = isSensitiveKey(key) ? exports.REDACTED : redactValue(nested, seen, depth + 1);
    }
    return result;
}
function redactLogInfo(info) {
    const seen = new WeakSet();
    for (const key of Object.keys(info)) {
        if (PRESERVED_KEYS.has(key)) {
            continue;
        }
        info[key] = isSensitiveKey(key) ? exports.REDACTED : redactValue(info[key], seen, 0);
    }
    return info;
}
exports.redactionFormat = winston_1.default.format(info => {
    redactLogInfo(info);
    return info;
});
//# sourceMappingURL=logRedaction.js.map