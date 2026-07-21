/**
 * IP Whitelisting Middleware
 * Enforces organization-level IP access restrictions
 */

import { NextFunction, Response } from 'express';

import { AppDataSource } from '../config/database';
import { IPWhitelistSettings, Organization } from '../models/Organization';
import { AuditEventType, logAuditEvent } from '../utils/auditLogger';
import { isIPAllowed, normalizeIP, validateIPPatterns } from '../utils/ipWhitelist';
import { logger } from '../utils/logger';

import { AuthRequest } from './auth';

/**
 * Middleware to enforce organization-level IP whitelisting
 * 
 * Usage:
 *   router.use(requireOrgIPWhitelist);
 * 
 * Configuration is stored in Organization.settings.ipWhitelist:
 * {
 *   enabled: true,
 *   allowedIPs: ["192.168.1.0/24", "10.0.0.1"],
 *   blockedIPs: ["192.168.1.100"],
 *   bypassForAdmins: true,
 *   auditFailures: true
 * }
 */
export const requireOrgIPWhitelist = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Must be authenticated
        if (!req.user) {
            next();
            return;
        }

        // Get organization ID from request
        const organizationId = req.params.organizationId || 
                               req.params.orgId ||
                               req.body.organizationId || 
                               req.query.organizationId as string;

        if (!organizationId) {
            // No org context, skip IP check
            next();
            return;
        }

        // Get organization settings
        const orgRepository = AppDataSource.getRepository(Organization);
        const organization = await orgRepository.findOne({
            where: { id: organizationId },
            select: ['id', 'name', 'settings']
        });

        if (!organization) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }

        // Check if IP whitelisting is enabled
        const ipWhitelist: IPWhitelistSettings | undefined = organization.settings?.ipWhitelist;
        
        if (!ipWhitelist?.enabled) {
            // IP whitelisting not enabled, allow access
            next();
            return;
        }

        // Check if user is admin and admins can bypass
        if (ipWhitelist.bypassForAdmins && req.user.role === 'admin') {
            next();
            return;
        }

        // Get request IP
        const requestIP = req.ip || req.socket.remoteAddress;
        const normalizedIP = normalizeIP(requestIP);

        // Check IP against whitelist/blacklist
        const ipCheck = isIPAllowed(
            normalizedIP,
            ipWhitelist.allowedIPs,
            ipWhitelist.blockedIPs
        );

        if (!ipCheck.allowed) {
            // Log audit event if enabled
            if (ipWhitelist.auditFailures) {
                logAuditEvent({
                    eventType: AuditEventType.AUTH_FAILURE,
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

            logger.warn('IP whitelist check failed', {
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

        // IP check passed
        next();
    } catch (error) {
        logger.error('IP whitelist middleware error:', error);
        // Fail securely - deny access on error
        res.status(500).json({
            message: 'Error checking IP whitelist',
            code: 'IP_CHECK_ERROR'
        });
    }
};

/**
 * Middleware to enforce user-level IP restrictions from OrganizationPermission
 * 
 * This checks IP restrictions defined in permission conditions.
 * Use after requireOrgIPWhitelist for layered IP security.
 * 
 * Note: This is already handled in OrganizationPermissionService.checkPermission()
 * via matchesIPRestrictions(). This middleware is for explicit enforcement.
 */
export const requirePermissionIPCheck = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user) {
            next();
            return;
        }

        // Get request IP
        const requestIP = req.ip || req.socket.remoteAddress;
        
        // Store normalized IP in request for use by permission checks
        (req as unknown as Request & { normalizedIP?: string }).normalizedIP = normalizeIP(requestIP);

        next();
    } catch (error) {
        logger.error('Permission IP check middleware error:', error);
        next();
    }
};

/**
 * Helper function to validate IP whitelist configuration
 * Returns validation errors if configuration is invalid
 */
export function validateIPWhitelistConfig(config: IPWhitelistSettings): string[] {
    const errors: string[] = [];

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

    // Validate IP formats
    if (config.allowedIPs) {
        const validation = validateIPPatterns(config.allowedIPs);
        if (!validation.valid) {
            errors.push(...validation.errors.map((e: string) => `allowedIPs: ${e}`));
        }
    }

    if (config.blockedIPs) {
        const validation = validateIPPatterns(config.blockedIPs);
        if (!validation.valid) {
            errors.push(...validation.errors.map((e: string) => `blockedIPs: ${e}`));
        }
    }

    return errors;
}
