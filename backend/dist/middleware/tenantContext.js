"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantContextMiddleware = exports.getOrganizationId = exports.getTenantContext = exports.requireSecurityLevel = exports.requireOrganizationRole = exports.requireTenantContext = exports.tenantContext = void 0;
const database_1 = require("../config/database");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const User_1 = require("../models/User");
const UserPreferencesService_1 = require("../services/user/UserPreferencesService");
const logger_1 = require("../utils/logger");
const roleUtils_1 = require("../utils/roleUtils");
const MEMBERSHIP_CACHE_TTL_MS = 60_000;
const membershipCache = new Map();
function evictExpiredMemberships() {
    if (membershipCache.size < 50) {
        return;
    }
    const now = Date.now();
    for (const [key, entry] of membershipCache) {
        if (entry.expiresAt <= now) {
            membershipCache.delete(key);
        }
    }
}
async function getCachedMembership(userId, organizationId) {
    const key = `${userId}:${organizationId}`;
    const now = Date.now();
    const cached = membershipCache.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.membership;
    }
    evictExpiredMemberships();
    const userOrgRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    const membership = await userOrgRepo
        .createQueryBuilder('membership')
        .leftJoinAndSelect('membership.organization', 'organization')
        .where('membership.userId = :userId', { userId })
        .andWhere('membership.organizationId = :organizationId', { organizationId })
        .andWhere('membership.isActive = :isActive', { isActive: true })
        .getOne();
    membershipCache.set(key, { membership, expiresAt: now + MEMBERSHIP_CACHE_TTL_MS });
    return membership;
}
const TENANT_OPTIONAL_EXACT_PATHS = new Set([
    '/users/me',
    '/users/me/preferences',
    '/users/me/organizations',
    '/users/me/ships',
    '/users/me/loadouts',
    '/users/me/activity',
    '/activities',
    '/activities/upcoming',
    '/activities/recommended',
    '/briefings',
    '/recruitments',
    '/gdpr/consent',
    '/gdpr/export',
    '/gdpr/export-request',
    '/gdpr/export-requests',
    '/gdpr/delete-account',
    '/gdpr/cancel-deletion',
    '/gdpr/deletion-status',
    '/gdpr/statistics',
    '/gdpr/dashboard',
    '/directory/federations',
    '/directory/organizations',
    '/directory/contact',
    '/federations',
    '/notifications',
    '/inbox',
    '/messages',
    '/profile',
    '/bounty',
    '/bounties',
    '/ships/catalogue',
    '/trading',
    '/organizations',
    '/rsi/verify',
    '/admin',
]);
const TENANT_OPTIONAL_PREFIX_PATHS = [
    '/auth/',
    '/activities/',
    '/trading-routes/',
    '/trading/',
    '/federations/',
    '/directory/',
    '/gdpr/',
    '/briefings/',
    '/recruitments/',
    '/bounty/',
    '/bounties/',
    '/notifications/',
    '/inbox/',
    '/messages/',
    '/organizations/',
    '/rsi/verify/',
    '/admin/',
];
const TENANT_OPTIONAL_PATTERN_PATHS = [
    /^\/users\/[^/]+\/ships$/,
    /^\/users\/[^/]+\/loadouts$/,
    /^\/users\/[^/]+\/activity$/,
];
let userPreferencesServiceInstance = null;
function getUserPreferencesService() {
    userPreferencesServiceInstance ??= new UserPreferencesService_1.UserPreferencesService();
    return userPreferencesServiceInstance;
}
function normalizePathForMatch(rawPath) {
    const trimmed = rawPath.trim();
    if (trimmed.length === 0) {
        return '/';
    }
    const withoutQuery = trimmed.split('?')[0] || '/';
    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}
function stripApiPrefix(path) {
    return path.replace(/^\/api(?:\/v\d+)?/, '') || '/';
}
function resolvePathCandidates(path, originalUrl) {
    const candidates = new Set();
    for (const rawPath of [path, originalUrl]) {
        if (typeof rawPath !== 'string' || rawPath.length === 0) {
            continue;
        }
        const normalized = normalizePathForMatch(rawPath);
        candidates.add(normalized);
        candidates.add(stripApiPrefix(normalized));
    }
    return Array.from(candidates);
}
function isTenantOptionalPath(path) {
    if (TENANT_OPTIONAL_EXACT_PATHS.has(path)) {
        return true;
    }
    if (TENANT_OPTIONAL_PREFIX_PATHS.some(prefix => path.startsWith(prefix))) {
        return true;
    }
    return TENANT_OPTIONAL_PATTERN_PATHS.some(pattern => pattern.test(path));
}
function requiresOrganization(path, originalUrl) {
    const candidates = resolvePathCandidates(path, originalUrl);
    return !candidates.some(candidate => isTenantOptionalPath(candidate));
}
async function handleStaleActiveOrganization(args) {
    const { req, res, next, dbUser, userOrg, overrideOrgId, organizationId, pathRequiresOrg } = args;
    if (userOrg || overrideOrgId) {
        return false;
    }
    logger_1.logger.warn('Active organization membership missing; clearing stale active org', {
        userId: dbUser.id,
        staleOrganizationId: organizationId,
        path: req.path,
    });
    await getUserPreferencesService().clearStaleActiveOrganization(dbUser, {
        staleOrganizationId: organizationId,
        path: req.path,
    });
    membershipCache.delete(`${dbUser.id}:${organizationId}`);
    if (req.user) {
        delete req.user.currentOrganizationId;
        delete req.user.currentOrganizationName;
    }
    if (pathRequiresOrg) {
        res.status(400).json({
            error: 'No active organization selected',
            message: 'Your active organization is no longer available. Please select an organization to continue',
            requiresOrgSelection: true,
        });
        return true;
    }
    next();
    return true;
}
const tenantContext = async (req, res, next) => {
    try {
        if (req.tenantContext) {
            return next();
        }
        const userId = req.user?.id;
        if (!userId) {
            return next();
        }
        const overrideOrgId = req.headers['x-organization-id'];
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        const dbUser = await userRepo
            .createQueryBuilder('user')
            .where('user.id = :userId', { userId })
            .getOne();
        if (!dbUser) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        const activeOrganizationId = dbUser.activeOrgId;
        const pathRequiresOrg = requiresOrganization(req.path, req.originalUrl);
        if (!activeOrganizationId && !overrideOrgId && pathRequiresOrg) {
            logger_1.logger.debug('[DEBUG] tenantContext blocking request - path:', req.path, 'user:', userId, 'activeOrgId:', activeOrganizationId);
            res.status(400).json({
                error: 'No active organization selected',
                message: 'Please select an organization to continue',
                requiresOrgSelection: true,
            });
            return;
        }
        let organizationId = activeOrganizationId || overrideOrgId || '';
        if (overrideOrgId) {
            if (dbUser.role !== 'admin') {
                res.status(403).json({
                    error: 'Insufficient permissions to override organization context',
                });
                return;
            }
            logger_1.logger.warn('Admin organization override', {
                adminId: dbUser.id,
                originalOrg: activeOrganizationId,
                overrideOrg: overrideOrgId,
            });
            organizationId = overrideOrgId;
        }
        const userOrg = await getCachedMembership(dbUser.id, organizationId);
        if (await handleStaleActiveOrganization({
            req,
            res,
            next,
            dbUser,
            userOrg,
            overrideOrgId,
            organizationId,
            pathRequiresOrg,
        })) {
            return;
        }
        req.tenantContext = {
            organizationId,
            userId: dbUser.id,
            userRole: dbUser.role,
            securityLevel: userOrg?.securityLevel,
            organizationRole: (0, roleUtils_1.getRoleName)(userOrg?.role),
        };
        if (req.user && organizationId) {
            req.user.currentOrganizationId = organizationId;
            if (userOrg?.organization?.name) {
                req.user.currentOrganizationName = userOrg.organization.name;
            }
        }
        logger_1.logger.debug('Tenant context established', {
            organizationId,
            userId: dbUser.id,
            userRole: dbUser.role,
            orgRole: (0, roleUtils_1.getRoleName)(userOrg?.role),
            securityLevel: userOrg?.securityLevel,
            path: req.path,
        });
        next();
    }
    catch (error) {
        logger_1.logger.error('Error in tenant context middleware', { error });
        next(error);
    }
};
exports.tenantContext = tenantContext;
const requireTenantContext = (req, res, next) => {
    if (!req.tenantContext) {
        res.status(401).json({
            error: 'Tenant context required',
            message: 'Authentication and organization selection required',
        });
        return;
    }
    next();
};
exports.requireTenantContext = requireTenantContext;
const requireOrganizationRole = (allowedRoles) => (req, res, next) => {
    if (!req.tenantContext) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const userRole = req.tenantContext.organizationRole;
    if (!userRole || !allowedRoles.includes(userRole)) {
        res.status(403).json({
            error: 'Insufficient permissions',
            message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
            required: allowedRoles,
            current: userRole,
        });
        return;
    }
    next();
};
exports.requireOrganizationRole = requireOrganizationRole;
const requireSecurityLevel = (minLevel) => async (req, res, next) => {
    if (!req.tenantContext) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const userLevel = req.tenantContext.securityLevel || 1;
    if (userLevel < minLevel) {
        logger_1.logger.warn('Security level check failed', {
            userId: req.tenantContext.userId,
            requiredLevel: minLevel,
            userLevel,
            path: req.path,
        });
        res.status(403).json({
            error: 'Insufficient security clearance',
            message: `This action requires security level ${minLevel} or higher`,
            required: minLevel,
            current: userLevel,
        });
        return;
    }
    next();
};
exports.requireSecurityLevel = requireSecurityLevel;
const getTenantContext = (req) => req.tenantContext || null;
exports.getTenantContext = getTenantContext;
const getOrganizationId = (req) => req.tenantContext?.organizationId || null;
exports.getOrganizationId = getOrganizationId;
exports.tenantContextMiddleware = exports.tenantContext;
//# sourceMappingURL=tenantContext.js.map