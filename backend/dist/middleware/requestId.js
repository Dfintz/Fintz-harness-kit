"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestIdMiddleware = void 0;
const crypto_1 = require("crypto");
const requestIdMiddleware = (req, res, next) => {
    req.id = (0, crypto_1.randomUUID)();
    res.setHeader('X-Request-Id', req.id);
    req.startTime = Date.now();
    next();
};
exports.requestIdMiddleware = requestIdMiddleware;
//# sourceMappingURL=requestId.js.map