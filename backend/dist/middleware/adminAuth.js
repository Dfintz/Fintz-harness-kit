"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAdminMutation = exports.requireAdmin = void 0;
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
            userAgent,
        });
        logger_1.logger.warn('Non-admin user attempted admin access', {
            userId: req.user.id,
            role: req.user.role,
            path: req.path,
        });
        res.status(403).json({
            message: 'Admin access required',
            code: 'ADMIN_ACCESS_DENIED',
        });
        return;
    }
    AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, req.user.id, `Admin accessed: ${req.method} ${req.path}`, 'success', {
        resource: 'admin_portal',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
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
                    statusCode: res.statusCode,
                },
            });
        }
        else if (req.user && res.statusCode >= 400) {
            AdminSecurityLogService_1.AdminSecurityLogService.logEvent(AdminSecurityLogService_1.SecurityEventType.ADMIN_ACTION, req.user.id, `Admin mutation failed: ${req.method} ${req.path}`, 'failure', {
                resource: req.params.id || req.body.id || 'unknown',
                details: {
                    method: req.method,
                    path: req.path,
                    statusCode: res.statusCode,
                },
            });
        }
        return originalSend.call(this, data);
    };
    next();
};
exports.logAdminMutation = logAdminMutation;
//# sourceMappingURL=adminAuth.js.map