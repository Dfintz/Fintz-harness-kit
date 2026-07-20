"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationService = void 0;
const node_crypto_1 = require("node:crypto");
const node_cache_1 = __importDefault(require("node-cache"));
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const fullTextSearch_1 = require("../../utils/query/fullTextSearch");
const roleUtils_1 = require("../../utils/roleUtils");
const AuditService_1 = require("../audit/AuditService");
const RsiCrawlerService_1 = require("../external/RsiCrawlerService");
const OrganizationActivityService_1 = require("./OrganizationActivityService");
const OrganizationDeletionService_1 = require("./OrganizationDeletionService");
const OrganizationHierarchyService_1 = require("./OrganizationHierarchyService");
const OrganizationMemberService_1 = require("./OrganizationMemberService");
const OrganizationPermissionService_1 = require("./OrganizationPermissionService");
const OrganizationSettingsService_1 = require("./OrganizationSettingsService");
const OrgDefaultsService_1 = require("./OrgDefaultsService");
class OrganizationService {
    organizationRepository;
    membershipRepository;
    userRepository;
    cache = new node_cache_1.default({ stdTTL: 300, checkperiod: 60, useClones: false });
    hierarchyService = new OrganizationHierarchyService_1.OrganizationHierarchyService();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    memberService = new OrganizationMemberService_1.OrganizationMemberService();
    activityService = new OrganizationActivityService_1.OrganizationActivityService();
    settingsService = new OrganizationSettingsService_1.OrganizationSettingsService();
    deletionService = new OrganizationDeletionService_1.OrganizationDeletionService();
    constructor() {
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    }
    applyOrgFilters(queryBuilder, filters) {
        if (!filters) {
            return;
        }
        this.applyBasicOrgFilters(queryBuilder, filters);
        this.applyMemberFilters(queryBuilder, filters);
        this.applyDateFilters(queryBuilder, filters);
    }
    applyBasicOrgFilters(qb, f) {
        if (f.name) {
            (0, fullTextSearch_1.addFullTextSearch)(qb, 'org', f.name, ['name'], 'search_vector', 'orgName');
        }
        if (f.type) {
            qb.andWhere('org.type = :type', { type: f.type });
        }
        if (f.status) {
            qb.andWhere('org.status = :status', { status: f.status });
        }
        if (f.parentOrgId !== undefined) {
            if (f.parentOrgId === null) {
                qb.andWhere('org.parentOrgId IS NULL');
            }
            else {
                qb.andWhere('org.parentOrgId = :parentOrgId', { parentOrgId: f.parentOrgId });
            }
        }
        if (f.level !== undefined) {
            qb.andWhere('org.level = :level', { level: f.level });
        }
        if (f.tags && f.tags.length > 0) {
            qb.andWhere('org.tags && :tags', { tags: f.tags });
        }
    }
    applyMemberFilters(qb, f) {
        if (f.hasMembers === true) {
            qb.andWhere('org.memberCount > 0');
        }
        else if (f.hasMembers === false) {
            qb.andWhere('(org.memberCount = 0 OR org.memberCount IS NULL)');
        }
        if (f.memberCount?.min !== undefined) {
            qb.andWhere('org.memberCount >= :minMembers', { minMembers: f.memberCount.min });
        }
        if (f.memberCount?.max !== undefined) {
            qb.andWhere('org.memberCount <= :maxMembers', { maxMembers: f.memberCount.max });
        }
    }
    applyDateFilters(qb, f) {
        if (f.createdAfter) {
            qb.andWhere('org.createdAt >= :createdAfter', { createdAfter: f.createdAfter });
        }
        if (f.createdBefore) {
            qb.andWhere('org.createdAt <= :createdBefore', { createdBefore: f.createdBefore });
        }
    }
    async getOrganizations(filters, pagination) {
        const queryBuilder = this.organizationRepository.createQueryBuilder('org');
        this.applyOrgFilters(queryBuilder, filters);
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        queryBuilder.skip((page - 1) * limit).take(limit);
        const sortBy = pagination?.sortBy || 'name';
        const sortOrder = pagination?.sortOrder || 'ASC';
        queryBuilder.orderBy(`org.${sortBy}`, sortOrder);
        const [data, total] = await queryBuilder.getManyAndCount();
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async getOrganizationById(id, options) {
        const hasOptions = options && Object.values(options).some(Boolean);
        if (!hasOptions) {
            const cached = this.cache.get(`org:${id}`);
            if (cached) {
                return cached;
            }
        }
        const queryBuilder = this.organizationRepository
            .createQueryBuilder('organization')
            .where('organization.id = :id', { id });
        if (options?.includeHierarchy) {
            queryBuilder
                .leftJoinAndSelect('organization.parent', 'parent')
                .leftJoinAndSelect('organization.children', 'children');
        }
        if (options?.includeMembers) {
            queryBuilder
                .leftJoinAndSelect('organization.memberships', 'memberships')
                .leftJoinAndSelect('memberships.user', 'membershipUser');
        }
        const organization = await queryBuilder.getOne();
        if (!organization) {
            return null;
        }
        if (options?.includeSettings) {
            organization.settings = await this.settingsService.getEffectiveSettings(id);
        }
        if (options?.includeStats) {
            const memberStats = await this.memberService.getMemberStats(id);
            organization.stats = memberStats;
        }
        return organization;
    }
    async createOrganization(orgData, creatorId, parentId) {
        logger_1.logger.info('Creating organization', {
            organizationName: orgData.name,
            creatorId,
            parentId,
            type: orgData.type,
        });
        let organization;
        const throwIfDuplicateOrgName = (err) => {
            if (err instanceof typeorm_1.QueryFailedError && err.driverError?.code === '23505') {
                throw new apiErrors_1.ValidationError(`An organization named "${orgData.name}" already exists`);
            }
            throw err;
        };
        if (orgData.name) {
            const existing = await this.organizationRepository
                .createQueryBuilder('org')
                .where('LOWER(org.name) = LOWER(:name)', { name: orgData.name })
                .getOne();
            if (existing) {
                throw new apiErrors_1.ValidationError(`An organization named "${orgData.name}" already exists`);
            }
        }
        if (parentId) {
            try {
                organization = await this.hierarchyService.createSubOrganization(parentId, {
                    ...orgData,
                    ownerId: creatorId,
                });
            }
            catch (err) {
                throwIfDuplicateOrgName(err);
            }
        }
        else {
            organization = this.organizationRepository.create({
                ...orgData,
                id: orgData.id || (0, node_crypto_1.randomUUID)(),
                ownerId: creatorId,
                type: orgData.type || Organization_1.OrganizationType.ROOT,
                level: 0,
                status: orgData.status || Organization_1.OrganizationStatus.ACTIVE,
                memberCount: 0,
            });
            try {
                organization = await this.organizationRepository.save(organization);
            }
            catch (err) {
                throwIfDuplicateOrgName(err);
            }
        }
        try {
            await (0, OrgDefaultsService_1.getOrgDefaultsService)().seedDefaults(organization.id);
        }
        catch (seedError) {
            logger_1.logger.warn('Failed to seed organization defaults', {
                organizationId: organization.id,
                error: seedError instanceof Error ? seedError.message : String(seedError),
            });
        }
        await this.memberService.addMember(organization.id, creatorId, 'founder', 'Founder', undefined, undefined, { acquisitionSource: 'founder' });
        await this.permissionService.applyPermissionTemplate(organization.id, creatorId, 'OWNER', creatorId);
        await this.activityService.logOrgCreated(organization.id, creatorId, organization);
        try {
            const profileRepo = data_source_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile);
            const profile = profileRepo.create({
                organizationId: organization.id,
                isPublic: false,
                primaryFocus: PublicOrgProfile_1.OrgPrimaryFocus.MIXED,
                memberCount: 1,
            });
            await profileRepo.save(profile);
        }
        catch (profileError) {
            logger_1.logger.warn('Failed to auto-create public profile for organization', {
                organizationId: organization.id,
                error: profileError instanceof Error ? profileError.message : String(profileError),
            });
        }
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'ORG_CREATED',
            message: `Organization created: ${organization.name}`,
            userId: creatorId,
            organizationId: organization.id,
            resource: `organization/${organization.id}`,
            metadata: {
                organizationType: organization.type,
                parentId,
                ownerId: creatorId,
            },
        });
        return organization;
    }
    async updateOrganization(id, updates, actorId) {
        logger_1.logger.info('Updating organization', {
            organizationId: id,
            actorId,
            updateFields: Object.keys(updates),
        });
        const before = await this.getOrganizationById(id);
        if (!before) {
            throw new Error('Organization not found');
        }
        const hasPermission = await this.permissionService.checkPermission(actorId, id, 'ORGANIZATION', 'EDIT');
        if (!hasPermission.allowed) {
            throw new Error('Insufficient permissions to update organization');
        }
        const { id: _stripId, ...safeUpdates } = updates;
        await this.organizationRepository.update(id, safeUpdates);
        this.cache.del(`org:${id}`);
        const after = await this.getOrganizationById(id);
        if (!after) {
            throw new Error('Organization not found after update');
        }
        await this.activityService.logOrgUpdated(id, actorId, before, after);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'ORG_UPDATED',
            message: `Organization updated: ${after.name}`,
            userId: actorId,
            organizationId: id,
            resource: `organization/${id}`,
            metadata: {
                updateFields: Object.keys(updates),
            },
        });
        return after;
    }
    async renameOrganization(id, newName, actorId) {
        const before = await this.getOrganizationById(id);
        if (!before) {
            throw new apiErrors_1.NotFoundError('Organization');
        }
        const hasPermission = await this.permissionService.checkPermission(actorId, id, 'ORGANIZATION', 'EDIT');
        if (!hasPermission.allowed) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to rename organization');
        }
        const existing = await this.organizationRepository
            .createQueryBuilder('org')
            .where('LOWER(org.name) = LOWER(:name) AND org.id != :id', { name: newName, id })
            .getOne();
        if (existing) {
            throw new apiErrors_1.ValidationError(`An organization named "${newName}" already exists`);
        }
        await this.organizationRepository.update(id, { name: newName });
        this.cache.del(`org:${id}`);
        const after = await this.getOrganizationById(id);
        if (!after) {
            throw new Error('Organization not found after rename');
        }
        await this.activityService.logOrgUpdated(id, actorId, before, after);
        logger_1.logger.info('Organization renamed', {
            organizationId: id,
            oldName: before.name,
            newName,
            performedBy: actorId,
        });
        return after;
    }
    async syncNameFromRsi(id, actorId) {
        const org = await this.getOrganizationById(id);
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization');
        }
        if (!org.rsiSid) {
            throw new apiErrors_1.ValidationError('Organization does not have an RSI SID linked. Please verify your organization with RSI first.');
        }
        const hasPermission = await this.permissionService.checkPermission(actorId, id, 'ORGANIZATION', 'EDIT');
        if (!hasPermission.allowed) {
            throw new apiErrors_1.ForbiddenError('Insufficient permissions to sync organization name from RSI');
        }
        const rsiData = await RsiCrawlerService_1.rsiCrawlerService.crawlOrganization(org.rsiSid);
        if (!rsiData.name) {
            throw new apiErrors_1.ValidationError('RSI did not return a name for this organization');
        }
        if (rsiData.name === org.name) {
            return { organization: org, rsiName: rsiData.name };
        }
        const updated = await this.renameOrganization(id, rsiData.name, actorId);
        logger_1.logger.info('Organization name synced from RSI', {
            organizationId: id,
            oldName: org.name,
            rsiName: rsiData.name,
            performedBy: actorId,
        });
        return { organization: updated, rsiName: rsiData.name };
    }
    async deleteOrganization(id, actorId, deleteDescendants = false, options) {
        logger_1.logger.info('Requesting organization deletion', {
            organizationId: id,
            actorId,
            deleteDescendants,
            reason: options?.reason,
        });
        const organization = await this.getOrganizationById(id);
        if (!organization) {
            throw new Error('Organization not found');
        }
        const hasPermission = await this.permissionService.checkPermission(actorId, id, 'ORGANIZATION', 'DELETE');
        if (!hasPermission.allowed) {
            throw new Error('Insufficient permissions to delete organization');
        }
        const request = await this.deletionService.createDeletionRequest(id, actorId, {
            ...options,
            deleteDescendants,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'ORG_DELETION_INITIATED',
            message: `Organization deletion request initiated: ${organization.name}`,
            userId: actorId,
            organizationId: id,
            resource: `organization/${id}`,
            metadata: {
                requestId: request.id,
                deleteDescendants,
                reason: options?.reason,
            },
        });
        return {
            requestId: request.id,
            message: 'Deletion request created successfully. Awaiting admin approval.',
            scheduledFor: request.scheduledFor,
        };
    }
    async getOrganizationWithHierarchy(id) {
        const organization = await this.getOrganizationById(id);
        if (!organization) {
            return null;
        }
        if (organization.level === 0) {
            return this.hierarchyService.getTree(id);
        }
        else {
            const tree = await this.hierarchyService.getTree(organization.rootOrgId || id);
            const findSubtree = (node) => {
                if (node.id === id) {
                    return node;
                }
                if (node.children) {
                    for (const child of node.children) {
                        const result = findSubtree(child);
                        if (result) {
                            return result;
                        }
                    }
                }
                return null;
            };
            return findSubtree(tree);
        }
    }
    async searchOrganizations(query, filters, pagination) {
        const queryBuilder = this.organizationRepository.createQueryBuilder('org');
        if (query) {
            (0, fullTextSearch_1.addFullTextSearch)(queryBuilder, 'org', query, ['name', 'description'], 'search_vector', 'orgSearch');
        }
        if (filters?.type && filters.type.length > 0) {
            queryBuilder.andWhere('org.type IN (:...types)', { types: filters.type });
        }
        if (filters?.status && filters.status.length > 0) {
            queryBuilder.andWhere('org.status IN (:...statuses)', { statuses: filters.status });
        }
        if (filters?.hasPublicProfile !== undefined) {
            queryBuilder.andWhere('org.isPublic = :isPublic', { isPublic: filters.hasPublicProfile });
        }
        if (filters?.minMembers !== undefined) {
            queryBuilder.andWhere('org.memberCount >= :minMembers', { minMembers: filters.minMembers });
        }
        if (filters?.maxMembers !== undefined) {
            queryBuilder.andWhere('org.memberCount <= :maxMembers', { maxMembers: filters.maxMembers });
        }
        if (filters?.tags && filters.tags.length > 0) {
            queryBuilder.andWhere('org.tags && :tags', { tags: filters.tags });
        }
        const page = pagination?.page || 1;
        const limit = pagination?.limit || 20;
        queryBuilder.skip((page - 1) * limit).take(limit);
        queryBuilder.orderBy('org.memberCount', 'DESC');
        queryBuilder.addOrderBy('org.name', 'ASC');
        const [data, total] = await queryBuilder.getManyAndCount();
        return {
            data,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async getOrganizationStats(id) {
        const [memberStats, hierarchyStats, activitySummary, recentActivity] = await Promise.all([
            this.memberService.getMemberStats(id),
            this.hierarchyService.getHierarchyStats(id),
            this.activityService.getActivitySummary(id, 30),
            this.activityService.getRecentActivities(id, 10),
        ]);
        return {
            memberStats,
            hierarchyStats,
            activitySummary,
            recentActivity,
        };
    }
    async canUserAccessOrganization(userId, orgId) {
        const isMember = await this.memberService.isMember(orgId, userId);
        if (isMember) {
            const membership = await this.memberService.getMember(orgId, userId);
            return {
                canAccess: true,
                accessLevel: (0, roleUtils_1.getRoleName)(membership?.role) || 'member',
            };
        }
        const organization = await this.getOrganizationById(orgId);
        if (!organization) {
            return {
                canAccess: false,
                reason: 'Organization not found',
                accessLevel: 'none',
            };
        }
        const visibility = organization.settings?.visibility || 'private';
        if (visibility === 'public') {
            return {
                canAccess: true,
                accessLevel: 'viewer',
            };
        }
        return {
            canAccess: false,
            reason: 'Organization is private and user is not a member',
            accessLevel: 'none',
        };
    }
    getHierarchyService() {
        return this.hierarchyService;
    }
    getPermissionService() {
        return this.permissionService;
    }
    getMemberService() {
        return this.memberService;
    }
    getActivityService() {
        return this.activityService;
    }
    getSettingsService() {
        return this.settingsService;
    }
}
exports.OrganizationService = OrganizationService;
//# sourceMappingURL=OrganizationService.js.map