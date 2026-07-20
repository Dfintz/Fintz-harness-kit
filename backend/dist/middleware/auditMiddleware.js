"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditSensitiveDataAccess = void 0;
const auditLogger_1 = require("../utils/auditLogger");
const SENSITIVE_RESOURCES = [
    '/api/users',
    '/api/organizations',
    '/api/fleets',
    '/api/events',
    '/api/discord',
    '/api/orgRelationships',
    '/api/userShips',
];
const auditSensitiveDataAccess = (req, res, next) => {
    if (!req.user) {
        next();
        return;
    }
    const path = req.path;
    const isSensitiveResource = SENSITIVE_RESOURCES.some(resource => path.startsWith(resource));
    if (isSensitiveResource) {
        const shouldLog = req.method !== 'GET' ||
            path.match(/\/users\/[^/]+$/) ||
            path.match(/\/organizations\/[^/]+$/) ||
            path.match(/\/fleets\/[^/]+$/);
        if (shouldLog) {
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            let action = req.method;
            if (req.method === 'GET') {
                action = 'READ';
            }
            if (req.method === 'POST') {
                action = 'CREATE';
            }
            if (req.method === 'PUT' || req.method === 'PATCH') {
                action = 'UPDATE';
            }
            if (req.method === 'DELETE') {
                action = 'DELETE';
            }
            (0, auditLogger_1.logSensitiveDataAccess)(req.user.id, req.user.username, path, action, ipAddress, userAgent, {
                method: req.method,
                params: req.params,
            });
        }
    }
    next();
};
exports.auditSensitiveDataAccess = auditSensitiveDataAccess;
//# sourceMappingURL=auditMiddleware.js.map