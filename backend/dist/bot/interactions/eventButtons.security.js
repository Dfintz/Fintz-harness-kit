"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeDiscordInput = sanitizeDiscordInput;
exports.truncate = truncate;
exports.sanitizeErrorForUser = sanitizeErrorForUser;
const MAX_DISPLAY_LENGTH = 100;
function sanitizeDiscordInput(input) {
    return input
        .replaceAll(/@(everyone|here)/gi, '@\u200b$1')
        .replaceAll(/[`*_~|>]/g, '')
        .slice(0, MAX_DISPLAY_LENGTH);
}
function truncate(value, maxLength) {
    return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}
function sanitizeErrorForUser(errorMsg) {
    const lower = errorMsg.toLowerCase();
    if (lower.includes('econnrefused') ||
        lower.includes('enotfound') ||
        lower.includes('sql') ||
        lower.includes('query') ||
        lower.includes('relation') ||
        lower.includes('column') ||
        lower.includes('password') ||
        lower.includes('timeout') ||
        lower.includes('stack')) {
        return 'An unexpected error occurred. Please try again later.';
    }
    return errorMsg.length > 200 ? `${errorMsg.slice(0, 200)}…` : errorMsg;
}
//# sourceMappingURL=eventButtons.security.js.map