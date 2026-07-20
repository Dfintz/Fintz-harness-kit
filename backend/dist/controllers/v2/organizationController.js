"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationControllerV2 = void 0;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const Activity_1 = require("../../models/Activity");
const CrewAssignment_1 = require("../../models/CrewAssignment");
const Fleet_1 = require("../../models/Fleet");
const Invitation_1 = require("../../models/Invitation");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const TeamMember_1 = require("../../models/TeamMember");
const User_1 = require("../../models/User");
const UserShip_1 = require("../../models/UserShip");
const OrganizationAggregatorService_1 = require("../../services/aggregators/OrganizationAggregatorService");
const InvitationService_1 = require("../../services/invitation/InvitationService");
const AllianceService_1 = require("../../services/organization/AllianceService");
const MemberActivityService_1 = require("../../services/organization/MemberActivityService");
const OnlinePresenceService_1 = require("../../services/organization/OnlinePresenceService");
const OrganizationInventoryService_1 = require("../../services/organization/OrganizationInventoryService");
const OrganizationMemberService_1 = require("../../services/organization/OrganizationMemberService");
const OrganizationService_1 = require("../../services/organization/OrganizationService");
const OrganizationTradingService_1 = require("../../services/organization/OrganizationTradingService");
const RoleService_1 = require("../../services/security/core/RoleService");
const UserShipService_1 = require("../../services/ship/UserShipService");
const UserService_1 = require("../../services/user/UserService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const organizationController_coreOperations_1 = require("./organizationController.coreOperations");
function toMemberDto(m, enrichment) {
    const permissionCount = m.permissions?.length ?? 0;
    return {
        userId: m.userId,
        organizationId: m.organizationId,
        role: (0, roleUtils_1.getRoleName)(m.role),
        joinedAt: m.joinedAt,
        username: m.user?.username ?? null,
        displayName: m.user?.displayName ?? m.user?.username ?? null,
        avatar: m.user?.avatar ?? null,
        securityLevel: m.securityLevel,
        title: m.title,
        rsiHandle: m.user?.rsiHandle ?? null,
        rsiVerified: m.user?.rsiVerified ?? false,
        discordId: m.user?.discordId ?? null,
        lastLoginAt: m.user?.lastLoginAt ?? null,
        registeredAt: m.user?.createdAt ?? null,
        permissionCount,
        teams: enrichment?.teams ?? [],
        crewAssignments: enrichment?.crewAssignments ?? [],
    };
}
class OrganizationControllerV2 {
    memberActivityService;
    onlinePresenceService;
    allianceService;
    inventoryService;
    tradingService;
    organizationService;
    memberService;
    invitationService;
    roleService;
    userService;
    userShipService;
    constructor() {
        this.memberActivityService = new MemberActivityService_1.MemberActivityService();
        this.onlinePresenceService = new OnlinePresenceService_1.OnlinePresenceService();
        this.allianceService = new AllianceService_1.AllianceService();
        this.inventoryService = new OrganizationInventoryService_1.OrganizationInventoryService();
        this.tradingService = new OrganizationTradingService_1.OrganizationTradingService();
        this.organizationService = new OrganizationService_1.OrganizationService();
        this.memberService = new OrganizationMemberService_1.OrganizationMemberService();
        this.invitationService = new InvitationService_1.InvitationService();
        this.roleService = new RoleService_1.RoleService();
        this.userService = new UserService_1.UserService();
        this.userShipService = new UserShipService_1.UserShipService();
    }
    async findOrganizationById(orgId, options) {
        return this.organizationService.getOrganizationById(orgId, {
            includeHierarchy: options?.includeHierarchy,
        });
    }
    async requireOrganization(orgId, options) {
        const organization = await this.findOrganizationById(orgId, options);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Organization not found', 404);
        }
        return organization;
    }
    async findMembershipByOrgAndUser(orgId, userId, _options) {
        return this.memberService.getMember(orgId, userId);
    }
    async findRoleById(roleId) {
        return this.roleService.getRoleById(roleId);
    }
    async findUserById(userId) {
        return this.userService.getUserById(userId);
    }
    async findShipById(shipId) {
        return this.userShipService.getUserShipById(shipId);
    }
    async findInvitationByOrgAndId(orgId, inviteId) {
        return database_1.AppDataSource.getRepository(Invitation_1.Invitation)
            .createQueryBuilder('invitation')
            .where('invitation.id = :inviteId', { inviteId })
            .andWhere('invitation.organizationId = :orgId', { orgId })
            .getOne();
    }
    async resolveRequestedRoleName(orgId, role, roleId) {
        if (roleId) {
            const requestedRole = await this.findRoleById(roleId);
            if (requestedRole?.organizationId !== orgId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
            }
            return (0, roleUtils_1.getRoleName)(requestedRole);
        }
        return typeof role === 'string' ? role.trim().toLowerCase() : null;
    }
    async listOrganizations(req, res) {
        await (0, organizationController_coreOperations_1.listOrganizationsCoreHandler)(req, res);
    }
    async getOrganization(req, res) {
        await (0, organizationController_coreOperations_1.getOrganizationCoreHandler)(req, res);
    }
    async createOrganization(req, res) {
        await (0, organizationController_coreOperations_1.createOrganizationCoreHandler)(req, res, this.organizationService);
    }
    async updateOrganization(req, res) {
        await (0, organizationController_coreOperations_1.updateOrganizationCoreHandler)(req, res, this.organizationService);
    }
    async deleteOrganization(req, res) {
        await (0, organizationController_coreOperations_1.deleteOrganizationCoreHandler)(req, res, this.organizationService);
    }
    async getMembers(req, res) {
        const { id: orgId } = req.params;
        const parsedParams = req.queryParams || {
            limit: 20,
            offset: 0,
            search: null,
            filters: {},
        };
        const { limit, offset } = parsedParams;
        const parsedFilters = (parsedParams.filters || {});
        const searchTerm = (typeof parsedParams.search === 'string' ? parsedParams.search.trim() : '') ||
            (typeof parsedFilters.query === 'string' ? parsedFilters.query.trim() : '') ||
            null;
        const rawRoleFilter = (typeof req.query.role === 'string' ? req.query.role : null) ||
            (typeof parsedFilters.role === 'string' ? parsedFilters.role : null);
        const normalizedRoleFilter = rawRoleFilter?.trim().toLowerCase() || null;
        const roleFilter = normalizedRoleFilter && normalizedRoleFilter !== 'all' ? normalizedRoleFilter : null;
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const memberRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const membersQuery = memberRepo
            .createQueryBuilder('membership')
            .leftJoinAndSelect('membership.user', 'user')
            .leftJoinAndSelect('membership.role', 'memberRole')
            .where('membership.organizationId = :orgId', { orgId })
            .andWhere('membership.isActive = :isActive', { isActive: true });
        if (searchTerm) {
            membersQuery.andWhere('(user.username ILIKE :searchTerm OR user.displayName ILIKE :searchTerm OR user.rsiHandle ILIKE :searchTerm OR membership.title ILIKE :searchTerm)', { searchTerm: `%${searchTerm}%` });
        }
        if (roleFilter) {
            membersQuery.andWhere('LOWER(memberRole.name) = :role', { role: roleFilter });
        }
        const [members, total] = await membersQuery
            .orderBy('membership.joinedAt', 'DESC')
            .skip(offset)
            .take(limit)
            .getManyAndCount();
        const userIds = members.map(m => m.userId);
        const enrichmentMap = await this.batchEnrichMembers(orgId, userIds);
        const items = members.map(m => toMemberDto(m, enrichmentMap.get(m.userId)));
        const queryParams = {};
        if (searchTerm) {
            queryParams.search = searchTerm;
        }
        if (roleFilter) {
            queryParams.role = roleFilter;
        }
        const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/members`, offset, limit, total, Object.keys(queryParams).length > 0 ? queryParams : undefined);
        res.paginated(items, {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
        }, links);
    }
    async batchEnrichMembers(orgId, userIds) {
        const result = new Map();
        if (userIds.length === 0) {
            return result;
        }
        for (const uid of userIds) {
            result.set(uid, { teams: [], crewAssignments: [] });
        }
        await this.enrichTeamMemberships(orgId, userIds, result);
        await this.enrichCrewAssignments(orgId, userIds, result);
        return result;
    }
    async enrichTeamMemberships(orgId, userIds, result) {
        try {
            const teamMemberRepo = database_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
            const teamMembers = await teamMemberRepo
                .createQueryBuilder('tm')
                .leftJoinAndSelect('tm.team', 'team')
                .where('tm.organizationId = :orgId', { orgId })
                .andWhere('tm.userId IN (:...userIds)', { userIds })
                .andWhere('tm.status = :status', { status: 'active' })
                .getMany();
            for (const tm of teamMembers) {
                const enrichment = result.get(tm.userId);
                if (enrichment) {
                    enrichment.teams.push({
                        teamName: tm.team?.name ?? 'Unknown',
                        teamRole: tm.role,
                        rank: tm.rank ?? null,
                    });
                }
            }
        }
        catch {
            logger_1.logger.debug('TeamMember enrichment skipped — table may not exist');
        }
    }
    async enrichCrewAssignments(orgId, userIds, result) {
        try {
            const crewRepo = database_1.AppDataSource.getRepository(CrewAssignment_1.CrewAssignment);
            const allActiveAssignments = await crewRepo.find({
                where: { organizationId: orgId, status: CrewAssignment_1.AssignmentStatus.ACTIVE },
            });
            const userIdSet = new Set(userIds);
            for (const assignment of allActiveAssignments) {
                this.matchCrewMembers(assignment, userIdSet, result);
            }
        }
        catch {
            logger_1.logger.debug('CrewAssignment enrichment skipped — table may not exist');
        }
    }
    matchCrewMembers(assignment, userIdSet, result) {
        for (const member of assignment.crew) {
            if (!userIdSet.has(member.userId)) {
                continue;
            }
            const enrichment = result.get(member.userId);
            if (enrichment) {
                enrichment.crewAssignments.push({
                    shipId: assignment.shipId,
                    crewRole: typeof member.role === 'string' ? member.role : String(member.role),
                });
            }
        }
    }
    async addMember(req, res) {
        const { id: orgId } = req.params;
        const { userId: targetUserId, role } = req.body;
        const actorId = req.user?.id;
        if (!actorId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        if (!targetUserId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'userId is required', 400);
        }
        try {
            await this.memberService.addMember(orgId, targetUserId, role, undefined, { addedBy: actorId }, undefined, { acquisitionSource: 'manual' });
            res.status(201);
            res.success({
                message: 'Member added successfully',
                organizationId: orgId,
                userId: targetUserId,
                role,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to add member'), 500);
        }
    }
    async removeMember(req, res) {
        const { id: orgId, userId: targetUserId } = req.params;
        const actorId = req.user?.id;
        if (!actorId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        try {
            await this.memberService.removeMember(orgId, targetUserId, false);
            res.success({
                message: 'Member removed successfully',
                organizationId: orgId,
                userId: targetUserId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to remove member'), 500);
        }
    }
    async leaveOrganization(req, res) {
        const { id: orgId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        try {
            const membership = await this.findMembershipByOrgAndUser(orgId, userId, {
                includeRole: true,
            });
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.NOT_FOUND, 'You are not a member of this organization', 404);
            }
            if ((0, roleUtils_1.isOwnerRole)(membership.role)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Organization owners cannot leave. Transfer ownership first.', 403);
            }
            await this.memberService.removeMember(orgId, userId, false);
            const userRepo = database_1.AppDataSource.getRepository(User_1.User);
            const user = await this.findUserById(userId);
            if (user?.activeOrgId === orgId) {
                user.activeOrgId = undefined;
                await userRepo.save(user);
            }
            res.success({
                message: 'You have left the organization',
                organizationId: orgId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to leave organization'), 500);
        }
    }
    async getDashboard(req, res) {
        const { orgId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const membership = await this.findMembershipByOrgAndUser(orgId, userId);
        if (!membership) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
        }
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const memberRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const memberCount = await memberRepo.count({
            where: { organizationId: orgId, isActive: true },
        });
        const activeMemberCount = await this.memberActivityService.getActiveMemberCount(orgId);
        const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const [totalFleets, activeFleets] = await Promise.all([
            fleetRepo.count({ where: { organizationId: orgId } }),
            fleetRepo.count({
                where: {
                    organizationId: orgId,
                    status: Fleet_1.FleetStatus.ACTIVE,
                },
            }),
        ]);
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const [upcomingActivities, ongoingActivities] = await Promise.all([
            activityRepo.count({
                where: {
                    organizationId: orgId,
                    status: Activity_1.ActivityStatus.PLANNING,
                },
            }),
            activityRepo.count({
                where: {
                    organizationId: orgId,
                    status: Activity_1.ActivityStatus.IN_PROGRESS,
                },
            }),
        ]);
        const dashboardData = {
            organization: {
                id: organization.id,
                name: organization.name,
                tag: organization.tags?.[0] || undefined,
                logo: undefined,
            },
            stats: {
                members: {
                    total: memberCount,
                    active: activeMemberCount,
                },
                fleets: {
                    total: totalFleets,
                    active: activeFleets,
                },
                activities: {
                    upcoming: upcomingActivities,
                    ongoing: ongoingActivities,
                },
            },
            timestamp: new Date().toISOString(),
        };
        res.success(dashboardData);
    }
    async getOverview(req, res) {
        const { orgId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        const membership = await this.findMembershipByOrgAndUser(orgId, userId);
        if (!membership) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
        }
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const memberRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const members = await memberRepo.find({
            where: { organizationId: orgId },
            relations: ['user'],
        });
        const activeMemberCount = await this.memberActivityService.getActiveMemberCount(orgId);
        const fleetRepo = database_1.AppDataSource.getRepository(Fleet_1.Fleet);
        const totalFleetsOverview = await fleetRepo.count({ where: { organizationId: orgId } });
        const inventoryItemCount = await this.inventoryService.getInventoryItemCount(orgId);
        const inventoryTotalValue = await this.inventoryService.getTotalInventoryValue(orgId);
        const overview = {
            organization: {
                id: organization.id,
                name: organization.name,
                tag: organization.tags?.[0] || undefined,
                description: organization.description,
                logo: undefined,
                createdAt: organization.createdAt,
            },
            members: {
                total: members.length,
                active: activeMemberCount,
                online: await this.onlinePresenceService.getOnlineMemberCount(orgId),
            },
            fleets: {
                total: totalFleetsOverview,
            },
            resources: {
                items: inventoryItemCount,
                totalValue: inventoryTotalValue.toFixed(2),
            },
            trading: {
                activeRoutes: await this.tradingService.getActiveRouteCount(orgId),
            },
            alliances: {
                count: await this.allianceService.getAllianceCount(orgId),
            },
        };
        res.success(overview);
    }
    async getFeed(req, res) {
        const { orgId } = req.params;
        const { limit, offset } = req.queryParams || { limit: 10, offset: 0 };
        const activityRepo = database_1.AppDataSource.getRepository(Activity_1.Activity);
        const [activities, total] = await activityRepo.findAndCount({
            where: { organizationId: orgId },
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
            relations: ['creator'],
        });
        const feedItems = activities.map(activity => ({
            id: activity.id,
            type: 'activity',
            title: activity.title,
            description: activity.description,
            status: activity.status,
            createdAt: activity.createdAt,
            creator: activity.creatorId
                ? {
                    id: activity.creatorId,
                    username: undefined,
                }
                : null,
        }));
        const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/feed`, offset, limit, total);
        res.paginated(feedItems, {
            total,
            limit,
            offset,
            hasMore: offset + limit < total,
        }, links);
    }
    async getActivityTrends(req, res) {
        const { orgId } = req.params;
        const days = Number.parseInt(req.query.days) || 30;
        if (days < 1 || days > 365) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Days parameter must be between 1 and 365', 400);
        }
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const trends = await this.memberActivityService.getActivityTrends(orgId, days);
        res.success(trends);
    }
    async getInsights(req, res) {
        const { orgId: _orgId } = req.params;
        const insights = {
            growth: {
                members: {
                    current: 0,
                    change: 0,
                    trend: 'stable',
                },
            },
            activity: {
                level: 'medium',
                eventsThisWeek: 0,
                eventsLastWeek: 0,
            },
            engagement: {
                averageParticipation: 0,
                topContributors: [],
            },
        };
        res.success(insights);
    }
    async getOnlineMembers(req, res) {
        const { orgId } = req.params;
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const onlineMembers = await this.onlinePresenceService.getOnlineMembers(orgId);
        res.success({
            organizationId: orgId,
            onlineCount: onlineMembers.length,
            members: onlineMembers,
            timestamp: Date.now(),
        });
    }
    async getAlliances(req, res) {
        try {
            const { orgId } = req.params;
            const organization = await this.findOrganizationById(orgId);
            if (!organization) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
            }
            const allianceDetails = await this.allianceService.getAllianceDetails(orgId);
            res.success({
                organizationId: orgId,
                alliances: allianceDetails,
                count: allianceDetails.length,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to retrieve alliances', 500);
        }
    }
    async getAllianceStatistics(req, res) {
        try {
            const { orgId } = req.params;
            const organization = await this.findOrganizationById(orgId);
            if (!organization) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
            }
            const statistics = await this.allianceService.getAllianceStatistics(orgId);
            res.success({
                organizationId: orgId,
                statistics,
                timestamp: new Date().toISOString(),
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to retrieve alliance statistics', 500);
        }
    }
    async getSharedActivities(req, res) {
        const { orgId } = req.params;
        const { limit, offset } = req.queryParams || { limit: 20, offset: 0 };
        const { status } = req.query;
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const result = await this.allianceService.getSharedActivities(orgId, {
            limit,
            offset,
            status: status,
        });
        const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/shared-activities`, offset, limit, result.total);
        res.paginated(result.activities, {
            total: result.total,
            limit,
            offset,
            hasMore: offset + limit < result.total,
        }, links);
    }
    async getTradingStats(req, res) {
        const { orgId } = req.params;
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const stats = await this.tradingService.getRouteStats(orgId);
        res.success({
            organizationId: orgId,
            stats,
            timestamp: new Date().toISOString(),
        });
    }
    async getTradingProfitSummary(req, res) {
        const { orgId } = req.params;
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const summary = await this.tradingService.getProfitSummary(orgId);
        res.success({
            organizationId: orgId,
            summary,
            timestamp: new Date().toISOString(),
        });
    }
    async getTradingRecommendations(req, res) {
        const { orgId } = req.params;
        const limitParam = req.query.limit;
        const limit = limitParam ? Number.parseInt(limitParam, 10) : 5;
        if (Number.isNaN(limit) || limit < 1 || limit > 20) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Limit must be a valid number between 1 and 20', 400);
        }
        const organization = await this.findOrganizationById(orgId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        const recommendations = await this.tradingService.getRouteRecommendations(orgId, limit);
        res.success({
            organizationId: orgId,
            recommendations,
            count: recommendations.length,
            timestamp: new Date().toISOString(),
        });
    }
    async getOrganizationMemberShips(req, res) {
        try {
            const { orgId } = req.params;
            const { limit, offset, sort, filters, fields: _fields, } = req.queryParams || {
                limit: 20,
                offset: 0,
                sort: null,
                filters: {},
                fields: null,
            };
            const organization = await this.findOrganizationById(orgId);
            if (!organization) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
            }
            const memberRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
            const members = await memberRepo.find({
                where: { organizationId: orgId, isActive: true },
                select: ['userId'],
            });
            const memberUserIds = members.map(m => m.userId);
            if (memberUserIds.length === 0) {
                res.paginated([], {
                    total: 0,
                    limit,
                    offset,
                    hasMore: false,
                }, (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/members/ships`, offset, limit, 0));
                return;
            }
            const UserShip = (await Promise.resolve().then(() => __importStar(require('../../models/UserShip')))).UserShip;
            const shipRepo = database_1.AppDataSource.getRepository(UserShip);
            const queryBuilder = shipRepo
                .createQueryBuilder('ship')
                .where('ship.userId IN (:...userIds)', { userIds: memberUserIds })
                .andWhere('ship.visibleToOrganization = :visible', { visible: true });
            const filterObj = filters;
            if (filterObj.manufacturer && typeof filterObj.manufacturer === 'string') {
                queryBuilder.andWhere('ship.manufacturer = :manufacturer', {
                    manufacturer: filterObj.manufacturer,
                });
            }
            if (filterObj.status && typeof filterObj.status === 'string') {
                queryBuilder.andWhere('ship.status = :status', {
                    status: filterObj.status,
                });
            }
            if (filterObj.sharingLevel && typeof filterObj.sharingLevel === 'string') {
                queryBuilder.andWhere('ship.sharingLevel = :sharingLevel', {
                    sharingLevel: filterObj.sharingLevel,
                });
            }
            if (sort) {
                queryBuilder.orderBy(`ship.${sort.field}`, sort.order);
            }
            else {
                queryBuilder.orderBy('ship.userId', 'ASC').addOrderBy('ship.shipName', 'ASC');
            }
            const total = await queryBuilder.getCount();
            const ships = await queryBuilder.skip(offset).take(limit).getMany();
            const shipsWithOwners = ships.map(ship => ({
                ...ship,
            }));
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/members/ships`, offset, limit, total);
            res.paginated(shipsWithOwners, {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to fetch organization member ships: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async classifyMemberShip(req, res) {
        try {
            const { orgId, shipId } = req.params;
            const { reason } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
            }
            const organization = await this.findOrganizationById(orgId);
            if (!organization) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
            }
            const membership = await this.findMembershipByOrgAndUser(orgId, userId);
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const leaderRoles = ['leader', 'admin', 'officer', 'founder'];
            const roleName = (0, roleUtils_1.getRoleName)(membership.role).toLowerCase() || '';
            if (!leaderRoles.includes(roleName)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization leaders can classify ships', 403);
            }
            const shipRepo = database_1.AppDataSource.getRepository(UserShip_1.UserShip);
            const ship = await this.findShipById(shipId);
            if (!ship) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship not found', 404);
            }
            const ownerMembership = await this.findMembershipByOrgAndUser(orgId, ship.userId);
            if (!ownerMembership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Ship owner is not a member of this organization', 403);
            }
            ship.visibleToOrganization = false;
            ship.classificationChangedBy = userId;
            ship.classificationChangedAt = new Date();
            ship.classificationReason = reason || 'Classified by organization leader';
            await shipRepo.save(ship);
            res.success({
                message: 'Ship classified successfully',
                ship: {
                    id: ship.id,
                    shipName: ship.shipName,
                    customName: ship.customName,
                    visibleToOrganization: ship.visibleToOrganization,
                    classificationChangedBy: ship.classificationChangedBy,
                    classificationChangedAt: ship.classificationChangedAt,
                    classificationReason: ship.classificationReason,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to classify ship: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async declassifyMemberShip(req, res) {
        try {
            const { orgId, shipId } = req.params;
            const { reason } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User not authenticated', 401);
            }
            const organization = await this.findOrganizationById(orgId);
            if (!organization) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
            }
            const membership = await this.findMembershipByOrgAndUser(orgId, userId);
            if (!membership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const leaderRoles = ['leader', 'admin', 'officer', 'founder'];
            const roleName = (0, roleUtils_1.getRoleName)(membership.role).toLowerCase() || '';
            if (!leaderRoles.includes(roleName)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization leaders can declassify ships', 403);
            }
            const shipRepo = database_1.AppDataSource.getRepository(UserShip_1.UserShip);
            const ship = await this.findShipById(shipId);
            if (!ship) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Ship not found', 404);
            }
            const ownerMembership = await this.findMembershipByOrgAndUser(orgId, ship.userId);
            if (!ownerMembership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Ship owner is not a member of this organization', 403);
            }
            ship.visibleToOrganization = true;
            ship.classificationChangedBy = userId;
            ship.classificationChangedAt = new Date();
            ship.classificationReason = reason || 'Declassified by organization leader';
            await shipRepo.save(ship);
            res.success({
                message: 'Ship declassified successfully',
                ship: {
                    id: ship.id,
                    shipName: ship.shipName,
                    customName: ship.customName,
                    visibleToOrganization: ship.visibleToOrganization,
                    classificationChangedBy: ship.classificationChangedBy,
                    classificationChangedAt: ship.classificationChangedAt,
                    classificationReason: ship.classificationReason,
                },
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to declassify ship: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async getMemberDetails(req, res) {
        try {
            const { id: orgId, userId } = req.params;
            const member = await this.memberService.getMember(orgId, userId);
            if (!member) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Member not found', 404);
            }
            res.success(member);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get member details: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async updateMemberRole(req, res) {
        try {
            const { id: orgId, userId } = req.params;
            const actorId = req.user?.id;
            const { role, roleId } = req.body;
            if (!actorId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const [actorMembership, targetMembership] = await Promise.all([
                this.findMembershipByOrgAndUser(orgId, actorId),
                this.findMembershipByOrgAndUser(orgId, userId),
            ]);
            if (!actorMembership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You are not a member of this organization', 403);
            }
            const actorRoleName = (0, roleUtils_1.getRoleName)(actorMembership.role);
            if (!['owner', 'founder', 'admin'].includes(actorRoleName)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only organization leaders can edit roles', 403);
            }
            if (!targetMembership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Member not found', 404);
            }
            const targetRoleName = (0, roleUtils_1.getRoleName)(targetMembership.role);
            if (actorRoleName === 'admin' && ['owner', 'founder'].includes(targetRoleName)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Admins cannot modify founder or owner roles', 403);
            }
            const requestedRoleName = await this.resolveRequestedRoleName(orgId, role, roleId);
            if (actorRoleName === 'admin' &&
                requestedRoleName &&
                ['owner', 'founder'].includes(requestedRoleName)) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Admins cannot assign founder or owner roles', 403);
            }
            await this.memberService.updateMemberRole(orgId, userId, role, roleId);
            res.success({ message: 'Member role updated successfully' });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to update member role: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async updateMemberTitle(req, res) {
        try {
            const { id: orgId, userId } = req.params;
            const { title } = req.body;
            await this.memberService.updateMemberTitle(orgId, userId, title);
            res.success({ message: 'Member title updated successfully' });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to update member title: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async transferMember(req, res) {
        try {
            const { id: orgId, userId } = req.params;
            const { targetOrganizationId, reason } = req.body;
            await this.memberService.transferMember(orgId, userId, targetOrganizationId, reason);
            res.success({ message: 'Member transferred successfully' });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to transfer member: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async searchMembers(req, res) {
        try {
            const { id: orgId } = req.params;
            const parsedParams = req.queryParams || {
                limit: 20,
                offset: 0,
                sort: null,
                filters: {},
                fields: null,
                search: null,
            };
            const searchFilters = parsedParams.filters || {};
            const searchQuery = searchFilters.query || parsedParams.search || '';
            const limit = parsedParams.limit;
            const offset = parsedParams.offset;
            const results = await this.memberService.searchMembers(orgId, { query: searchQuery }, {
                limit,
            });
            const total = results.pagination?.total || 0;
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/members/search`, offset, limit, total);
            res.paginated((results.data || []).map(m => toMemberDto(m)), {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to search members: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async getMemberStats(req, res) {
        try {
            const { id: orgId } = req.params;
            const stats = await this.memberService.getMemberStats(orgId);
            res.success(stats);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get member stats: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async getMembersByRole(req, res) {
        try {
            const { id: orgId, role } = req.params;
            const { limit = 20, offset = 0 } = req.queryParams || {};
            const members = await this.memberService.getMembersByRole(orgId, role);
            const paginatedMembers = members.slice(offset, offset + limit);
            const total = members.length;
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/members/by-role/${role}`, offset, limit, total);
            res.paginated(paginatedMembers.map(m => toMemberDto(m)), {
                total,
                limit,
                offset,
                hasMore: offset + limit < total,
            }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, `Failed to get members by role: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
        }
    }
    async grantPermission(req, res) {
        try {
            const { id: orgId } = req.params;
            const { userId, resource, action, scope } = req.body;
            const { PermissionService } = await Promise.resolve().then(() => __importStar(require('../../services/security/permissions/PermissionService')));
            const permissionService = new PermissionService();
            const permission = await permissionService.grantPermission(orgId, userId, resource, action, scope);
            res.status(201).success({
                message: 'Permission granted successfully',
                permission,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to grant permission'), 500);
        }
    }
    async revokePermission(req, res) {
        try {
            const { id: orgId, permissionId } = req.params;
            const { PermissionService } = await Promise.resolve().then(() => __importStar(require('../../services/security/permissions/PermissionService')));
            const permissionService = new PermissionService();
            await permissionService.revokePermission?.(orgId, permissionId);
            res.success({
                message: 'Permission revoked successfully',
                permissionId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to revoke permission'), 500);
        }
    }
    async listPermissions(req, res) {
        try {
            const { id: orgId } = req.params;
            const { limit = 50, offset = 0 } = req.queryParams || {};
            const { PermissionService } = await Promise.resolve().then(() => __importStar(require('../../services/security/permissions/PermissionService')));
            const permissionService = new PermissionService();
            const result = (await permissionService.listPermissions?.(orgId, limit, offset)) || {
                total: 0,
                permissions: [],
            };
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/permissions`, offset, limit, result.total);
            res.paginated(result.permissions, {
                total: result.total,
                limit,
                offset,
                hasMore: offset + limit < result.total,
            }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to list permissions'), 500);
        }
    }
    async checkPermission(req, res) {
        try {
            const { id: orgId } = req.params;
            const { userId, resource, action } = req.body;
            const { PermissionService } = await Promise.resolve().then(() => __importStar(require('../../services/security/permissions/PermissionService')));
            const permissionService = new PermissionService();
            const hasPermission = await permissionService.hasPermission(userId, orgId, resource, action);
            res.success({
                hasPermission,
                organizationId: orgId,
                userId,
                resource,
                action,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to check permission'), 500);
        }
    }
    async getSettings(req, res) {
        try {
            const { id: orgId } = req.params;
            const org = await this.requireOrganization(orgId);
            const settings = org.settings || {};
            res.success({
                settings,
                organizationId: orgId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get settings'), 500);
        }
    }
    async updateSettings(req, res) {
        try {
            const { id: orgId } = req.params;
            const updates = req.body;
            const orgRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
            const org = await this.requireOrganization(orgId);
            org.settings = {
                ...org.settings,
                ...updates,
            };
            await orgRepo.save(org);
            if (updates.visibility !== undefined) {
                try {
                    const { PublicOrgDirectoryService } = await Promise.resolve().then(() => __importStar(require('../../services/organization/PublicOrgDirectoryService')));
                    const directoryService = new PublicOrgDirectoryService();
                    await directoryService.updateProfile(orgId, {
                        isPublic: updates.visibility === 'public',
                    });
                }
                catch (syncError) {
                    logger_1.logger.warn(`Failed to sync PublicOrgProfile.isPublic for org ${orgId}: ${syncError.message}`);
                }
            }
            res.success({
                message: 'Settings updated successfully',
                settings: org.settings,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update settings'), 500);
        }
    }
    async getInvitations(req, res) {
        try {
            const { orgId } = req.params;
            const { limit = 20, offset = 0, status, } = (req.queryParams || {});
            const limitNum = Number(limit);
            const offsetNum = Number(offset);
            const page = Math.floor(offsetNum / limitNum) + 1;
            const result = await this.invitationService.getInvitationsForOrg(orgId, {
                page,
                limit: limitNum,
                status,
            });
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/invitations`, offsetNum, limitNum, result.total);
            res.paginated(result.data, {
                total: result.total,
                limit: limitNum,
                offset: offsetNum,
                hasMore: page < result.totalPages,
            }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get invitations'), 500);
        }
    }
    async sendInvitation(req, res) {
        try {
            const { orgId } = req.params;
            const { userId: inviteeUserId, message } = req.body;
            const inviterId = req.user?.id;
            if (!inviterId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            if (!inviteeUserId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'userId is required to invite a registered user', 400);
            }
            const inviterMembership = await this.findMembershipByOrgAndUser(orgId, inviterId);
            if (!inviterMembership) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'You must be a member of this organization to send invitations', 403);
            }
            const inviterRole = (0, roleUtils_1.getRoleName)(inviterMembership.role);
            const invitation = await this.invitationService.invite(orgId, inviteeUserId, inviterId, inviterRole, message);
            res.status(201).success({
                id: invitation.id,
                organizationId: invitation.organizationId,
                inviteeUserId: invitation.inviteeUserId,
                inviterId: invitation.inviterId,
                inviterRole: invitation.inviterRole,
                status: invitation.status,
                message: invitation.message,
                expiresAt: invitation.expiresAt,
                createdAt: invitation.createdAt,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to send invitation'), 500);
        }
    }
    async acceptInvitation(req, res) {
        try {
            const { orgId, inviteId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const invitation = await this.findInvitationByOrgAndId(orgId, inviteId);
            if (!invitation) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Invitation not found', 404);
            }
            if (invitation.inviteeUserId !== userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only the invitee can accept this invitation', 403);
            }
            const accepted = await this.invitationService.acceptByToken(invitation.token, userId);
            res.success({
                id: accepted.id,
                organizationId: accepted.organizationId,
                status: accepted.status,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to accept invitation'), 500);
        }
    }
    async declineInvitation(req, res) {
        try {
            const { orgId, inviteId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
            }
            const invitation = await this.findInvitationByOrgAndId(orgId, inviteId);
            if (!invitation) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Invitation not found', 404);
            }
            if (invitation.inviteeUserId !== userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Only the invitee can decline this invitation', 403);
            }
            const declined = await this.invitationService.declineByToken(invitation.token, userId);
            res.success({
                id: declined.id,
                organizationId: declined.organizationId,
                status: declined.status,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to decline invitation'), 500);
        }
    }
    async getParentOrganization(req, res) {
        try {
            const { orgId } = req.params;
            const org = await this.findOrganizationById(orgId, { includeHierarchy: true });
            if (!org) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Organization not found', 404);
            }
            if (!org.parentOrgId) {
                res.success({ parent: null });
                return;
            }
            const parent = org.parent ?? (await this.findOrganizationById(org.parentOrgId));
            res.success({
                parent: parent
                    ? {
                        id: parent.id,
                        name: parent.name,
                        tag: parent.tags?.[0] || parent.name,
                        avatar: parent.logoUrl || null,
                    }
                    : null,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get parent organization'), 500);
        }
    }
    async getChildOrganizations(req, res) {
        try {
            const { orgId } = req.params;
            const { limit = 20, offset = 0 } = req.queryParams || {};
            const orgRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
            const [children, total] = await orgRepo.findAndCount({
                where: { parentOrgId: orgId },
                take: limit,
                skip: offset,
            });
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/children`, offset, limit, total);
            res.paginated(children.map(child => ({
                id: child.id,
                name: child.name,
                tag: child.tags?.[0] || child.name,
                avatar: child.logoUrl || null,
                memberCount: 0,
            })), { total, limit, offset, hasMore: offset + limit < total }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get child organizations'), 500);
        }
    }
    async updateHierarchy(req, res) {
        try {
            const { orgId } = req.params;
            const { parentId } = req.body;
            const orgRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
            const org = await this.requireOrganization(orgId);
            if (parentId) {
                const parent = await this.findOrganizationById(parentId);
                if (!parent) {
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Parent organization not found', 404);
                }
                if (parentId === orgId) {
                    throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.VALIDATION_ERROR, 'Organization cannot be its own parent', 400);
                }
                org.parentOrgId = parentId;
            }
            else {
                org.parentOrgId = undefined;
            }
            await orgRepo.save(org);
            res.success({
                message: 'Hierarchy updated successfully',
                organizationId: orgId,
                parentId: org.parentOrgId,
            });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update hierarchy'), 500);
        }
    }
    async getAuditLogs(req, res) {
        try {
            const { orgId } = req.params;
            const parsedQP = req.queryParams || {
                limit: 50,
                offset: 0,
                sort: null,
                filters: {},
                fields: null,
                search: null,
            };
            const limit = parsedQP.limit || 50;
            const offset = parsedQP.offset || 0;
            const auditFilters = parsedQP.filters || {};
            const _startDate = auditFilters.startDate;
            const _endDate = auditFilters.endDate;
            const _actionType = auditFilters.actionType;
            const _userId = auditFilters.userId;
            await this.requireOrganization(orgId);
            const logs = [
                {
                    id: 'log1',
                    organizationId: orgId,
                    userId: 'user1',
                    action: 'member_added',
                    details: 'Added new member',
                    timestamp: new Date(),
                },
                {
                    id: 'log2',
                    organizationId: orgId,
                    userId: 'user2',
                    action: 'permission_granted',
                    details: 'Granted admin permission',
                    timestamp: new Date(),
                },
            ];
            const total = logs.length;
            const links = (0, queryParser_1.buildHateoasLinks)(`/api/v2/organizations/${orgId}/audit-logs`, Number(offset), Number(limit), total);
            res.paginated(logs.slice(Number(offset), Number(offset) + Number(limit)), {
                total,
                limit: Number(limit),
                offset: Number(offset),
                hasMore: Number(offset) + Number(limit) < total,
            }, links);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get audit logs'), 500);
        }
    }
    async listReports(req, res) {
        try {
            const { orgId } = req.params;
            await this.requireOrganization(orgId);
            const reports = [
                {
                    id: 'activity-summary',
                    name: 'Activity Summary',
                    description: 'Overview of organization activities',
                },
                {
                    id: 'member-stats',
                    name: 'Member Statistics',
                    description: 'Member engagement and statistics',
                },
                {
                    id: 'fleet-report',
                    name: 'Fleet Report',
                    description: 'Fleet composition and readiness',
                },
                {
                    id: 'financial',
                    name: 'Financial Report',
                    description: 'Trading and financial activities',
                },
            ];
            res.success({ reports, organizationId: orgId });
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to list reports'), 500);
        }
    }
    async generateReport(req, res) {
        try {
            const { orgId } = req.params;
            const { reportType, startDate, endDate, format = 'pdf' } = req.body;
            if (!reportType) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Report type is required', 400);
            }
            await this.requireOrganization(orgId);
            const job = {
                id: `job_${Date.now()}`,
                organizationId: orgId,
                reportType,
                startDate,
                endDate,
                format,
                status: 'processing',
                createdAt: new Date(),
                createdBy: req.user?.id,
            };
            res.status(202).success(job);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to generate report'), 500);
        }
    }
    async getReport(req, res) {
        try {
            const { orgId, reportId } = req.params;
            await this.requireOrganization(orgId);
            const report = {
                id: reportId,
                organizationId: orgId,
                status: 'completed',
                downloadUrl: `/api/v2/organizations/${orgId}/reports/${reportId}/download`,
                generatedAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            };
            res.success(report);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get report'), 500);
        }
    }
    async onboardMember(req, res) {
        try {
            const { orgId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
            }
            const { userId: targetUserId, role, title, permissions, message, sendNotification, } = req.body;
            const aggregator = new OrganizationAggregatorService_1.OrganizationAggregatorService();
            const result = await aggregator.inviteAndOnboardMember({
                organizationId: orgId,
                userId: targetUserId,
                invitedBy: userId,
                role,
                title,
                permissions,
                message,
                sendNotification,
            });
            res.status(201).success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to onboard member'), 500);
        }
    }
    async offboardMemberFull(req, res) {
        try {
            const { orgId, memberId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
            }
            const { reason } = req.body;
            const aggregator = new OrganizationAggregatorService_1.OrganizationAggregatorService();
            const result = await aggregator.offboardMember(orgId, memberId, userId, reason);
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to offboard member'), 500);
        }
    }
    async bulkInviteMembers(req, res) {
        try {
            const { orgId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'User authentication required', 401);
            }
            const { invitations } = req.body;
            const aggregator = new OrganizationAggregatorService_1.OrganizationAggregatorService();
            const result = await aggregator.bulkInviteMembers(orgId, invitations, userId);
            res.success(result);
        }
        catch (error) {
            if (error instanceof errorHandlerV2_1.ApiError) {
                throw error;
            }
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to bulk invite members'), 500);
        }
    }
}
exports.OrganizationControllerV2 = OrganizationControllerV2;
//# sourceMappingURL=organizationController.js.map