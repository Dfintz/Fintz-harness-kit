"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requirePermissionIPCheck = exports.requireOrgIPWhitelist = void 0;
exports.validateIPWhitelistConfig = validateIPWhitelistConfig;
const database_1 = require("../config/database");
const Organization_1 = require("../models/Organization");
const auditLogger_1 = require("../utils/auditLogger");
const ipWhitelist_1 = require("../utils/ipWhitelist");
const logger_1 = require("../utils/logger");
const requireOrgIPWhitelist = async (req, res, next) => {
    try {
        if (!req.user) {
            next();
            return;
        }
        const organizationId = req.params.organizationId ||
            req.params.orgId ||
            req.body.organizationId ||
            req.query.organizationId;
        if (!organizationId) {
            next();
            return;
        }
        const orgRepository = database_1.AppDataSource.getRepository(Organization_1.Organization);
        const organization = await orgRepository.findOne({
            where: { id: organizationId },
            select: ['id', 'name', 'settings']
        });
        if (!organization) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }
        const ipWhitelist = organization.settings?.ipWhitelist;
        if (!ipWhitelist?.enabled) {
            next();
            return;
        }
        if (ipWhitelist.bypassForAdmins && req.user.role === 'admin') {
            next();
            return;
        }
        const requestIP = req.ip || req.socket.remoteAddress;
        const normalizedIP = (0, ipWhitelist_1.normalizeIP)(requestIP);
        const ipCheck = (0, ipWhitelist_1.isIPAllowed)(normalizedIP, ipWhitelist.allowedIPs, ipWhitelist.blockedIPs);
        if (!ipCheck.allowed) {
            if (ipWhitelist.auditFailures) {
                (0, auditLogger_1.logAuditEvent)({
                    eventType: auditLogger_1.AuditEventType.AUTH_FAILURE,
                    userId: req.user.id,
                    username: req.user.username,
                    ipAddress: normalizedIP,
                    userAgent: req.headers['user-agent'],
                    message: 'IP address not whitelisted',
                    metadata: {
                        organizationId,
                        organizationName: organization.name,
                        reason: ipCheck.reason,
                        path: req.path,
                        method: req.method
                    }
                });
            }
            logger_1.logger.warn('IP whitelist check failed', {
                userId: req.user.id,
                organizationId,
                ip: normalizedIP,
                reason: ipCheck.reason,
                path: req.path
            });
            res.status(403).json({
                message: 'Access denied: IP address not authorized',
                reason: ipCheck.reason,
                code: 'IP_NOT_WHITELISTED'
            });
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('IP whitelist middleware error:', error);
        res.status(500).json({
            message: 'Error checking IP whitelist',
            code: 'IP_CHECK_ERROR'
        });
    }
};
exports.requireOrgIPWhitelist = requireOrgIPWhitelist;
const requirePermissionIPCheck = async (req, res, next) => {
    try {
        if (!req.user) {
            next();
            return;
        }
        const requestIP = req.ip || req.socket.remoteAddress;
        req.normalizedIP = (0, ipWhitelist_1.normalizeIP)(requestIP);
        next();
    }
    catch (error) {
        logger_1.logger.error('Permission IP check middleware error:', error);
        next();
    }
};
exports.requirePermissionIPCheck = requirePermissionIPCheck;
function validateIPWhitelistConfig(config) {
    const errors = [];
    if (!config) {
        return ['IP whitelist configuration is required'];
    }
    if (typeof config.enabled !== 'boolean') {
        errors.push('enabled must be a boolean');
    }
    if (config.allowedIPs && !Array.isArray(config.allowedIPs)) {
        errors.push('allowedIPs must be an array');
    }
    if (config.blockedIPs && !Array.isArray(config.blockedIPs)) {
        errors.push('blockedIPs must be an array');
    }
    if (config.bypassForAdmins && typeof config.bypassForAdmins !== 'boolean') {
        errors.push('bypassForAdmins must be a boolean');
    }
    if (config.auditFailures && typeof config.auditFailures !== 'boolean') {
        errors.push('auditFailures must be a boolean');
    }
    if (config.allowedIPs) {
        const validation = (0, ipWhitelist_1.validateIPPatterns)(config.allowedIPs);
        if (!validation.valid) {
            errors.push(...validation.errors.map((e) => `allowedIPs: ${e}`));
        }
    }
    if (config.blockedIPs) {
        const validation = (0, ipWhitelist_1.validateIPPatterns)(config.blockedIPs);
        if (!validation.valid) {
            errors.push(...validation.errors.map((e) => `blockedIPs: ${e}`));
        }
    }
    return errors;
}
//# sourceMappingURL=ipWhitelist.js.map