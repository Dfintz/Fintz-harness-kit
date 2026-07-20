"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.intelVisibilityService = exports.IntelVisibilityService = exports.UserRoleInOrg = exports.IntelVisibilityLevel = void 0;
const data_source_1 = require("../../data-source");
const IntelAuditLog_1 = require("../../models/IntelAuditLog");
const IntelEntry_1 = require("../../models/IntelEntry");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const IntelAuditLogger_1 = require("./IntelAuditLogger");
var IntelVisibilityLevel;
(function (IntelVisibilityLevel) {
    IntelVisibilityLevel["PUBLIC"] = "PUBLIC";
    IntelVisibilityLevel["ORG"] = "ORG";
    IntelVisibilityLevel["PRIVATE"] = "PRIVATE";
})(IntelVisibilityLevel || (exports.IntelVisibilityLevel = IntelVisibilityLevel = {}));
var UserRoleInOrg;
(function (UserRoleInOrg) {
    UserRoleInOrg["ADMIN"] = "admin";
    UserRoleInOrg["OFFICER"] = "officer";
    UserRoleInOrg["MEMBER"] = "member";
    UserRoleInOrg["GUEST"] = "guest";
})(UserRoleInOrg || (exports.UserRoleInOrg = UserRoleInOrg = {}));
class IntelVisibilityService {
    static instance;
    intelRepo;
    membershipRepo;
    auditLogRepo;
    userRoleCache = new Map();
    ROLE_CACHE_TTL_MS = 3600000;
    constructor() {
        this.intelRepo = data_source_1.AppDataSource.getRepository(IntelEntry_1.IntelEntry);
        this.membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.auditLogRepo = data_source_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
    }
    static getInstance() {
        if (!IntelVisibilityService.instance) {
            IntelVisibilityService.instance = new IntelVisibilityService();
        }
        return IntelVisibilityService.instance;
    }
    async getUserRoleInOrganization(userId, organizationId) {
        const cacheKey = `${userId}:${organizationId}`;
        const cached = this.userRoleCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.ROLE_CACHE_TTL_MS) {
            return cached.role;
        }
        try {
            const membership = await this.membershipRepo.findOne({
                where: { userId, organizationId },
                relations: ['userRole'],
            });
            if (!membership) {
                return UserRoleInOrg.GUEST;
            }
            let role = UserRoleInOrg.MEMBER;
            if (membership.userRole?.name) {
                const roleName = membership.userRole.name.toLowerCase();
                if (roleName.includes('admin')) {
                    role = UserRoleInOrg.ADMIN;
                }
                else if (roleName.includes('officer') || roleName.includes('commander')) {
                    role = UserRoleInOrg.OFFICER;
                }
            }
            this.userRoleCache.set(cacheKey, { role, timestamp: Date.now() });
            return role;
        }
        catch (error) {
            logger_1.logger.warn('Failed to get user role', { userId, organizationId, error });
            return UserRoleInOrg.GUEST;
        }
    }
    clearRoleCache(userId, organizationId) {
        const cacheKey = `${userId}:${organizationId}`;
        this.userRoleCache.delete(cacheKey);
    }
    async canViewIntel(userId, intelId, organizationId) {
        try {
            const intel = await this.intelRepo.findOne({
                where: { id: intelId, organizationId },
            });
            if (!intel) {
                logger_1.logger.warn('Intel record not found or cross-org attempt', {
                    userId,
                    intelId,
                    organizationId,
                });
                return { canView: false, reason: 'Intel not found' };
            }
            const visibility = intel.visibilityLevel ||
                IntelVisibilityLevel.ORG;
            if (visibility === IntelVisibilityLevel.PUBLIC) {
                return { canView: true, visibilityLevel: visibility };
            }
            const userRole = await this.getUserRoleInOrganization(userId, organizationId);
            if (visibility === IntelVisibilityLevel.ORG) {
                const canView = userRole === UserRoleInOrg.ADMIN ||
                    userRole === UserRoleInOrg.OFFICER ||
                    userRole === UserRoleInOrg.MEMBER;
                if (canView) {
                    return { canView: true, visibilityLevel: visibility };
                }
                else {
                    return { canView: false, reason: 'Insufficient role for ORG-level intel' };
                }
            }
            if (visibility === IntelVisibilityLevel.PRIVATE) {
                const isCreator = intel.createdBy === userId;
                const isAdmin = userRole === UserRoleInOrg.ADMIN;
                if (isCreator || isAdmin) {
                    return { canView: true, visibilityLevel: visibility };
                }
                else {
                    return { canView: false, reason: 'PRIVATE intel accessible to creator and admin only' };
                }
            }
            return { canView: false, reason: 'Unknown visibility level' };
        }
        catch (error) {
            logger_1.logger.error('Error checking Intel visibility', {
                userId,
                intelId,
                organizationId,
                error,
            });
            throw error;
        }
    }
    async getVisibleIntelEntries(organizationId, userId, filters) {
        try {
            const userRole = await this.getUserRoleInOrganization(userId, organizationId);
            let query = this.intelRepo
                .createQueryBuilder('intel')
                .where('intel.organizationId = :orgId', { orgId: organizationId });
            let visibilityConditions = `intel.visibilityLevel = :public`;
            const params = { public: IntelVisibilityLevel.PUBLIC };
            if (userRole === UserRoleInOrg.MEMBER ||
                userRole === UserRoleInOrg.OFFICER ||
                userRole === UserRoleInOrg.ADMIN) {
                visibilityConditions += ` OR intel.visibilityLevel = :org`;
                params.org = IntelVisibilityLevel.ORG;
            }
            if (userRole === UserRoleInOrg.ADMIN) {
                visibilityConditions += ` OR intel.visibilityLevel = :private`;
                params.private = IntelVisibilityLevel.PRIVATE;
            }
            else {
                visibilityConditions += ` OR (intel.visibilityLevel = :private AND intel.createdBy = :userId)`;
                params.private = IntelVisibilityLevel.PRIVATE;
                params.userId = userId;
            }
            query = query.andWhere(`(${visibilityConditions})`);
            Object.entries(params).forEach(([key, value]) => {
                query = query.setParameter(key, value);
            });
            if (filters?.search) {
                query = query.andWhere(`(intel.title ILIKE :search OR intel.content ILIKE :search)`, {
                    search: `%${filters.search}%`,
                });
            }
            query = query.orderBy('intel.createdAt', 'DESC');
            if (filters?.limit) {
                query = query.limit(filters.limit);
            }
            if (filters?.offset) {
                query = query.offset(filters.offset);
            }
            const [entries, total] = await query.getManyAndCount();
            IntelAuditLogger_1.intelAuditLogger.log({
                action: IntelAuditLog_1.IntelAuditAction.INTEL_LIST_ACCESSED,
                userId,
                organizationId,
                details: { count: entries.length, total },
                severity: 'info',
                performedById: userId,
            });
            return { entries, total };
        }
        catch (error) {
            logger_1.logger.error('Error fetching visible intel entries', {
                organizationId,
                userId,
                error,
            });
            throw error;
        }
    }
    async getIntelDetails(intelId, organizationId, userId) {
        const canView = await this.canViewIntel(userId, intelId, organizationId);
        if (!canView.canView) {
            IntelAuditLogger_1.intelAuditLogger.log({
                action: IntelAuditLog_1.IntelAuditAction.INTEL_ACCESS_DENIED,
                userId,
                organizationId,
                resourceId: intelId,
                details: { reason: canView.reason },
                severity: 'warning',
                performedById: userId,
            });
            throw new apiErrors_1.ForbiddenError(`You do not have permission to view this intel: ${canView.reason}`);
        }
        const intel = await this.intelRepo.findOne({
            where: { id: intelId, organizationId },
        });
        if (!intel) {
            throw new apiErrors_1.NotFoundError('Intel record not found');
        }
        IntelAuditLogger_1.intelAuditLogger.log({
            action: IntelAuditLog_1.IntelAuditAction.INTEL_ACCESSED,
            userId,
            organizationId,
            resourceId: intelId,
            details: { visibility: canView.visibilityLevel },
            severity: 'info',
            performedById: userId,
        });
        return intel;
    }
    async updateIntelVisibility(intelId, organizationId, userId, newVisibility) {
        const userRole = await this.getUserRoleInOrganization(userId, organizationId);
        if (userRole !== UserRoleInOrg.ADMIN) {
            throw new apiErrors_1.ForbiddenError('Only admins can update intel visibility');
        }
        const intel = await this.intelRepo.findOne({
            where: { id: intelId, organizationId },
        });
        if (!intel) {
            throw new apiErrors_1.NotFoundError('Intel record not found');
        }
        const oldVisibility = intel.visibilityLevel ||
            IntelVisibilityLevel.ORG;
        intel.visibilityLevel = newVisibility;
        const updated = await this.intelRepo.save(intel);
        IntelAuditLogger_1.intelAuditLogger.log({
            action: IntelAuditLog_1.IntelAuditAction.INTEL_VISIBILITY_CHANGED,
            userId,
            organizationId,
            resourceId: intelId,
            details: { oldVisibility, newVisibility },
            severity: 'warning',
            performedById: userId,
        });
        return updated;
    }
}
exports.IntelVisibilityService = IntelVisibilityService;
exports.intelVisibilityService = IntelVisibilityService.getInstance();
//# sourceMappingURL=IntelVisibilityService.js.map