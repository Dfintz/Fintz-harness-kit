"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeErrorForUser = sanitizeErrorForUser;
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
        lower.includes('stack') ||
        lower.includes('epipe') ||
        lower.includes('socket') ||
        lower.includes('eacces') ||
        lower.includes('enoent')) {
        return 'An unexpected error occurred. Please try again later.';
    }
    return errorMsg.length > 200 ? `${errorMsg.slice(0, 200)}…` : errorMsg;
}
//# sourceMappingURL=errorSanitizer.js.map