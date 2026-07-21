"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRateLimit = exports.logAdminMutation = exports.requireAdmin = void 0;
const AdminSecurityLogService_1 = require("../services/admin/AdminSecurityLogService");
const logger_1 = require("../utils/logger");
const requireAdmin = async (req, res, next) => {
    if (!req.user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }
    if (req.user.role !== 'admin') {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.PERMISSION_DENIED, req.user.id, 'Attempted admin access without admin role', 'failure', {
            resource: 'admin_portal',
            ipAddress,
            userAgent
        });
        logger_1.logger.warn('Non-admin user attempted admin access', {
            userId: req.user.id,
            role: req.user.role,
            path: req.path
        });
        res.status(403).json({
            message: 'Admin access required',
            code: 'ADMIN_ACCESS_DENIED'
        });
        return;
    }
    AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, req.user.id, `Admin accessed: ${req.method} ${req.path}`, 'success', {
        resource: 'admin_portal',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
    });
    next();
};
exports.requireAdmin = requireAdmin;
const logAdminMutation = async (req, res, next) => {
    const originalSend = res.send;
    res.send = function (data) {
        if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, req.user.id, `Admin mutation: ${req.method} ${req.path}`, 'success', {
                resource: req.params.id || req.body.id || 'unknown',
                details: {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode
                }
            });
        }
        else if (req.user && res.statusCode >= 400) {
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, req.user.id, `Admin mutation failed: ${req.method} ${req.path}`, 'failure', {
                resource: req.params.id || req.body.id || 'unknown',
                details: {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode
                }
            });
        }
        return originalSend.call(this, data);
    };
    next();
};
exports.logAdminMutation = logAdminMutation;
const adminRateLimitStore = new Map();
const adminRateLimit = (maxRequests = 100, windowMs = 60000) => async (req, res, next) => {
    if (!req.user) {
        next();
        return;
    }
    const key = `admin:${req.user.id}`;
    const now = Date.now();
    let record = adminRateLimitStore.get(key);
    if (!record || record.resetAt < now) {
        record = { count: 0, resetAt: now + windowMs };
        adminRateLimitStore.set(key, record);
    }
    record.count++;
    if (record.count > maxRequests) {
        AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.API_RATE_LIMIT_EXCEEDED, req.user.id, 'Admin API rate limit exceeded', 'failure', {
            resource: 'admin_api',
            details: {
                limit: maxRequests,
                window: `${windowMs}ms`
            }
        });
        res.status(429).json({
            message: 'Too many requests',
            retryAfter: Math.ceil((record.resetAt - now) / 1000)
        });
        return;
    }
    res.setHeader('X-RateLimit-Limit', maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', record.resetAt.toString());
    next();
};
exports.adminRateLimit = adminRateLimit;
//# sourceMappingURL=adminAuth.js.map