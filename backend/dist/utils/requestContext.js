"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestContextStorage = void 0;
exports.getRequestContext = getRequestContext;
exports.getCorrelationMeta = getCorrelationMeta;
const async_hooks_1 = require("async_hooks");
exports.requestContextStorage = new async_hooks_1.AsyncLocalStorage();
function getRequestContext() {
    return exports.requestContextStorage.getStore();
}
function getCorrelationMeta() {
    const ctx = exports.requestContextStorage.getStore();
    if (!ctx) {
        return {};
    }
    return {
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        ...(ctx.userId ? { userId: ctx.userId } : {}),
    };
}
//# sourceMappingURL=requestContext.js.map