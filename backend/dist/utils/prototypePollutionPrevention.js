"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSafeKey = isSafeKey;
exports.safeAssign = safeAssign;
exports.sanitizeObject = sanitizeObject;
exports.safeSetProperty = safeSetProperty;
exports.sanitizeQueryParams = sanitizeQueryParams;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function isSafeKey(key) {
    if (typeof key !== 'string') {
        return true;
    }
    return !DANGEROUS_KEYS.has(key.toLowerCase());
}
function safeAssign(target, source) {
    if (!source || typeof source !== 'object') {
        return target;
    }
    for (const key of Object.keys(source)) {
        if (isSafeKey(key) && Object.hasOwn(source, key)) {
            target[key] = source[key];
        }
    }
    return target;
}
function sanitizeObject(input, allowedKeys) {
    const result = Object.create(null);
    if (!input || typeof input !== 'object') {
        return result;
    }
    const keys = allowedKeys ?? Object.keys(input);
    for (const key of keys) {
        if (isSafeKey(key) && Object.hasOwn(input, key) && input[key] !== undefined) {
            result[key] = input[key];
        }
    }
    return result;
}
function safeSetProperty(obj, key, value) {
    if (!isSafeKey(key)) {
        return false;
    }
    obj[key] = value;
    return true;
}
function sanitizeQueryParams(query, schema) {
    const result = Object.create(null);
    for (const [key, type] of Object.entries(schema)) {
        if (!isSafeKey(key) || !(key in query)) {
            continue;
        }
        const value = query[key];
        switch (type) {
            case 'string':
                if (typeof value === 'string') {
                    result[key] = value;
                }
                break;
            case 'number': {
                const num = Number(value);
                if (!Number.isNaN(num)) {
                    result[key] = num;
                }
                break;
            }
            case 'boolean':
                result[key] = value === 'true' || value === true;
                break;
            case 'array':
                result[key] = Array.isArray(value) ? value : [value];
                break;
        }
    }
    return result;
}
//# sourceMappingURL=prototypePollutionPrevention.js.map