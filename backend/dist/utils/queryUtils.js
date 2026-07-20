"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseBooleanQuery = parseBooleanQuery;
function parseBooleanQuery(value, defaultValue = false) {
    if (value === undefined || value === null) {
        return defaultValue;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value === 'true';
    }
    return defaultValue;
}
//# sourceMappingURL=queryUtils.js.map