"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordAdminAuthorization = void 0;
const database_1 = require("../config/database");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const GuildOrganizationService_1 = require("../services/discord/GuildOrganizationService");
const auditLogger_1 = require("../utils/auditLogger");
const logger_1 = require("../utils/logger");
const roleUtils_1 = require("../utils/roleUtils");
const discordAdminAuthorization = async (req, res, next) => {
    try {
        if (!req.user) {
            res.status(401).json({
                success: false,
                error: 'Authentication required',
            });
            return;
        }
        const { orgId, guildId } = req.params;
        if (!orgId) {
            res.status(400).json({
                success: false,
                error: 'Organization ID is required',
            });
            return;
        }
        if (req.user.role === 'admin') {
            logger_1.logger.debug(`Admin user ${req.user.id} accessing Discord settings for org ${orgId}`);
            next();
            return;
        }
        const hasOrgInJwt = req.user.organizationIds?.includes(orgId);
        const membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const membership = await membershipRepo.findOne({
            where: {
                userId: req.user.id,
                organizationId: orgId,
                isActive: true,
            },
        });
        if (!membership) {
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            (0, auditLogger_1.logAuthorizationFailure)(req.user.id, req.user.username, req.user.role, `discord:organization:${orgId}`, req.method, ipAddress, userAgent);
            logger_1.logger.warn(`Unauthorized Discord settings access attempt by user ${req.user.id} for org ${orgId}`, {
                userId: req.user.id,
                orgId,
                path: req.path,
                hasOrgInJwt,
            });
            res.status(403).json({
                success: false,
                error: 'Not authorized to manage Discord settings for this organization',
                code: 'ORG_MEMBERSHIP_REQUIRED',
            });
            return;
        }
        const isOrgOwner = (0, roleUtils_1.getRoleName)(membership.role) === 'owner' || (0, roleUtils_1.getRoleName)(membership.role) === 'founder';
        const isOrgAdmin = (0, roleUtils_1.getRoleName)(membership.role) === 'admin';
        if (!isOrgOwner && !isOrgAdmin) {
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            (0, auditLogger_1.logAuthorizationFailure)(req.user.id, req.user.username, req.user.role, `discord:organization:${orgId}:admin-required`, req.method, ipAddress, userAgent);
            logger_1.logger.warn(`Discord settings access denied - insufficient role (${(0, roleUtils_1.getRoleName)(membership.role)}) for user ${req.user.id} in org ${orgId}`);
            res.status(403).json({
                success: false,
                error: 'Only organization owners and admins can manage Discord settings',
                code: 'INSUFFICIENT_ROLE',
                requiredRole: 'owner or admin',
                currentRole: (0, roleUtils_1.getRoleName)(membership.role),
            });
            return;
        }
        if (guildId) {
            const guildOrgService = GuildOrganizationService_1.GuildOrganizationService.getInstance();
            const guildOwnerOrgId = await guildOrgService.resolveOrganization(guildId);
            if (!guildOwnerOrgId || guildOwnerOrgId !== orgId) {
                const ipAddress = req.ip ?? req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                (0, auditLogger_1.logAuthorizationFailure)(req.user.id, req.user.username, req.user.role, `discord:guild:${guildId}:org-mismatch`, req.method, ipAddress, userAgent);
                logger_1.logger.warn(`Discord guild ${guildId} does not belong to org ${orgId} - access denied for user ${req.user.id}`);
                res.status(403).json({
                    success: false,
                    error: 'This Discord guild is not linked to the specified organization',
                    code: 'GUILD_ORG_MISMATCH',
                });
                return;
            }
        }
        logger_1.logger.debug(`Discord settings access granted for user ${req.user.id} (role: ${(0, roleUtils_1.getRoleName)(membership.role)}) in org ${orgId}${guildId ? ` for guild ${guildId}` : ''}`);
        next();
    }
    catch (error) {
        logger_1.logger.error('Discord authorization check failed', { error });
        res.status(500).json({
            success: false,
            error: 'Authorization check failed',
        });
    }
};
exports.discordAdminAuthorization = discordAdminAuthorization;
//# sourceMappingURL=discordAuthorization.js.map