"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestCorrelationMiddleware = requestCorrelationMiddleware;
exports.addBreadcrumb = addBreadcrumb;
exports.getBreadcrumbs = getBreadcrumbs;
exports.getCorrelationData = getCorrelationData;
const crypto_1 = require("crypto");
const logger_1 = require("../utils/logger");
const requestContext_1 = require("../utils/requestContext");
const securityUtils_1 = require("../utils/securityUtils");
function requestCorrelationMiddleware() {
    return (req, res, next) => {
        const correlatedReq = req;
        correlatedReq.requestId =
            req.headers['x-request-id'] ||
                (0, crypto_1.randomUUID)();
        correlatedReq.correlationId =
            req.headers['x-correlation-id'] ||
                (0, crypto_1.randomUUID)();
        correlatedReq.startTime = Date.now();
        correlatedReq.breadcrumbs = [];
        res.setHeader('X-Request-Id', correlatedReq.requestId);
        res.setHeader('X-Correlation-Id', correlatedReq.correlationId);
        logger_1.logger.debug('Request started', {
            requestId: correlatedReq.requestId,
            correlationId: correlatedReq.correlationId,
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
        addBreadcrumb(correlatedReq, {
            category: 'http',
            message: `${req.method} ${req.path}`,
            level: 'info',
            data: {
                method: req.method,
                path: req.path,
                query: (0, securityUtils_1.sanitizeQueryParams)(req.query),
            },
        });
        res.on('finish', () => {
            const duration = Date.now() - correlatedReq.startTime;
            logger_1.logger.debug('Request completed', {
                requestId: correlatedReq.requestId,
                correlationId: correlatedReq.correlationId,
                duration,
                statusCode: res.statusCode,
            });
        });
        requestContext_1.requestContextStorage.run({
            requestId: correlatedReq.requestId,
            correlationId: correlatedReq.correlationId,
            startTime: correlatedReq.startTime,
        }, next);
    };
}
function addBreadcrumb(req, breadcrumb) {
    const correlatedReq = req;
    if (!correlatedReq.breadcrumbs) {
        correlatedReq.breadcrumbs = [];
    }
    correlatedReq.breadcrumbs.push({
        timestamp: Date.now(),
        ...breadcrumb,
    });
    if (correlatedReq.breadcrumbs.length > 50) {
        correlatedReq.breadcrumbs = correlatedReq.breadcrumbs.slice(-50);
    }
}
function getBreadcrumbs(req) {
    const correlatedReq = req;
    return correlatedReq.breadcrumbs || [];
}
function getCorrelationData(req) {
    const correlatedReq = req;
    return {
        requestId: correlatedReq.requestId || 'unknown',
        correlationId: correlatedReq.correlationId || 'unknown',
        duration: correlatedReq.startTime
            ? Date.now() - correlatedReq.startTime
            : undefined,
    };
}
//# sourceMappingURL=requestCorrelation.js.map