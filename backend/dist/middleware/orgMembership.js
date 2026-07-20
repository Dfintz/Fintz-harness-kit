"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireOrgMembership = void 0;
const database_1 = require("../config/database");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const auditLogger_1 = require("../utils/auditLogger");
const logger_1 = require("../utils/logger");
const roleUtils_1 = require("../utils/roleUtils");
const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ORG_PATH_REGEX = new RegExp(`/organizations/(${UUID_PATTERN})`, 'i');
function extractOrgId(req) {
    if (req.params.orgId) {
        return req.params.orgId;
    }
    if (req.params.organizationId) {
        return req.params.organizationId;
    }
    const match = req.path.match(ORG_PATH_REGEX);
    if (match) {
        return match[1];
    }
    return undefined;
}
const requireOrgMembership = async (req, res, next) => {
    const orgId = extractOrgId(req);
    if (!orgId) {
        return next();
    }
    if (!req.user) {
        return next();
    }
    if (req.user.role === 'admin') {
        req.orgMembership = { organizationId: orgId };
        return next();
    }
    if (req.user.organizationIds?.includes(orgId)) {
        req.orgMembership = { organizationId: orgId };
        return next();
    }
    try {
        const membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const membership = await membershipRepo.findOne({
            where: {
                userId: req.user.id,
                organizationId: orgId,
                isActive: true,
            },
            relations: ['role'],
        });
        if (!membership) {
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            (0, auditLogger_1.logAuthorizationFailure)(req.user.id, req.user.username, req.user.role, `organization:${orgId}`, req.method, ipAddress, userAgent);
            logger_1.logger.warn('Org membership check failed', {
                userId: req.user.id,
                orgId,
                path: req.path,
                method: req.method,
            });
            res.status(403).json({
                message: 'You are not a member of this organization',
                code: 'ORG_MEMBERSHIP_REQUIRED',
            });
            return;
        }
        req.orgMembership = {
            organizationId: orgId,
            role: (0, roleUtils_1.getRoleName)(membership.role),
            securityLevel: membership.securityLevel,
        };
        next();
    }
    catch (error) {
        logger_1.logger.error('Error checking org membership', { error, orgId, userId: req.user.id });
        res.status(500).json({ message: 'Error validating organization membership' });
    }
};
exports.requireOrgMembership = requireOrgMembership;
//# sourceMappingURL=orgMembership.js.map