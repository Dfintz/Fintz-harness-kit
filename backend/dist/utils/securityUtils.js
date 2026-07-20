"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeQueryParams = sanitizeQueryParams;
exports.sanitizeObject = sanitizeObject;
function sanitizeQueryParams(query) {
    if (!query || typeof query !== 'object') {
        return {};
    }
    const sanitized = {};
    const sensitiveKeys = [
        'password',
        'token',
        'secret',
        'key',
        'apikey',
        'api_key',
        'auth',
        'authorization',
        'credential',
        'private',
    ];
    for (const [key, value] of Object.entries(query)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
            sanitized[key] = '[REDACTED]';
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
function sanitizeObject(obj, sensitiveFields = [
    'password',
    'token',
    'secret',
    'key',
    'apiKey',
    'api_key',
    'authorization',
    'auth',
]) {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
            sanitized[key] = '[REDACTED]';
        }
        else if (Array.isArray(value)) {
            sanitized[key] = value.map(item => item !== null && typeof item === 'object'
                ? sanitizeObject(item, sensitiveFields)
                : item);
        }
        else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeObject(value, sensitiveFields);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
//# sourceMappingURL=securityUtils.js.map