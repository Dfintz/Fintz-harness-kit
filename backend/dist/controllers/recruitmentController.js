"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecruitmentController = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../data-source");
const Activity_1 = require("../models/Activity");
const DiscordGuildSettings_1 = require("../models/DiscordGuildSettings");
const Organization_1 = require("../models/Organization");
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const Ship_1 = require("../models/Ship");
const UserShip_1 = require("../models/UserShip");
const UserSkill_1 = require("../models/UserSkill");
const activity_1 = require("../services/activity");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const OrgApplicationService_1 = require("../services/organization/OrgApplicationService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
class RecruitmentController extends BaseController_1.BaseController {
    activityService;
    orgApplicationService;
    permissionService;
    constructor() {
        super();
        this.activityService = new activity_1.ActivityService();
        this.orgApplicationService = new OrgApplicationService_1.OrgApplicationService();
        this.permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    }
    async requireApplicationReviewAccess(userId, activity) {
        if (activity.creatorId === userId) {
            return;
        }
        if (activity.organizationId) {
            const result = await this.permissionService.checkPermission(userId, activity.organizationId, OrganizationPermission_1.ResourceType.RECRUITMENT, OrganizationPermission_1.PermissionAction.APPROVE);
            if (result.allowed) {
                return;
            }
        }
        throw new apiErrors_1.ForbiddenError('You do not have permission to review applications for this recruitment');
    }
    mapToActivityStatus(status) {
        switch (status) {
            case 'open':
                return Activity_1.ActivityStatus.RECRUITING;
            case 'closed':
                return Activity_1.ActivityStatus.COMPLETED;
            case 'paused':
                return Activity_1.ActivityStatus.DRAFT;
            default:
                return Activity_1.ActivityStatus.RECRUITING;
        }
    }
    mapToFrontendStatus(status) {
        switch (status) {
            case Activity_1.ActivityStatus.OPEN:
            case Activity_1.ActivityStatus.RECRUITING:
                return 'open';
            case Activity_1.ActivityStatus.COMPLETED:
            case Activity_1.ActivityStatus.CANCELLED:
            case Activity_1.ActivityStatus.EXPIRED:
                return 'closed';
            case Activity_1.ActivityStatus.DRAFT:
            case Activity_1.ActivityStatus.PLANNING:
                return 'paused';
            default:
                return 'closed';
        }
    }
    transformToRecruitment(activity, organizationLogoUrl, currentUserId, discordRecruitment) {
        const applications = (activity.applications ?? []);
        let hasApplied = false;
        if (currentUserId) {
            hasApplied = applications.some(app => app.applicantId === currentUserId || app.userId === currentUserId);
        }
        const pendingApplicants = applications.filter(app => app.status === Activity_1.ApplicationStatus.PENDING).length;
        return {
            id: activity.id,
            organizationId: activity.organizationId,
            organizationName: activity.organizationName,
            organizationLogoUrl: organizationLogoUrl ?? undefined,
            title: activity.title,
            description: activity.description,
            rolesNeeded: activity.rolesNeeded ?? [],
            currentApplicants: activity.currentApplicants ?? 0,
            pendingApplicants,
            maxPositions: activity.maxApplicants ?? activity.maxParticipants,
            status: this.mapToFrontendStatus(activity.status),
            requirements: activity.requirements,
            expiresAt: activity.expiresAt,
            bannerImageUrl: activity.bannerImageUrl ?? undefined,
            visibility: activity.visibility,
            tags: activity.tags ?? [],
            screeningEnabled: activity.screeningEnabled,
            autoAcceptQualified: activity.autoAcceptQualified,
            contractorRequirements: activity.contractorRequirements,
            applicationQuestions: activity.applicationQuestions ?? [],
            createdAt: activity.createdAt,
            updatedAt: activity.updatedAt,
            creatorId: activity.creatorId,
            creatorName: activity.creatorName,
            hasApplied,
            discordRecruitmentEnabled: discordRecruitment?.enabled ?? false,
            discordInviteUrl: discordRecruitment?.enabled
                ? (discordRecruitment.discordInviteUrl ?? undefined)
                : undefined,
            discordInviteFormEnabled: discordRecruitment?.enabled
                ? (discordRecruitment.inviteFormEnabled ?? false)
                : false,
        };
    }
    async getDiscordRecruitmentSettings(organizationId) {
        try {
            const guildSettingsRepo = data_source_1.AppDataSource.getRepository(DiscordGuildSettings_1.DiscordGuildSettings);
            const guildSettings = await guildSettingsRepo.findOne({
                where: { organizationId },
            });
            return guildSettings?.recruitmentSettings ?? null;
        }
        catch {
            return null;
        }
    }
    async getOrgLogoUrl(organizationId) {
        if (!organizationId) {
            return undefined;
        }
        try {
            const orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
            const org = await orgRepo.findOne({
                where: { id: organizationId },
                select: ['id', 'logoUrl'],
            });
            return org?.logoUrl ?? undefined;
        }
        catch (err) {
            logger_1.logger.warn('Failed to fetch org logo URL', {
                organizationId,
                error: err instanceof Error ? err.message : String(err),
            });
            return undefined;
        }
    }
    async getOrgLogoUrls(organizationIds) {
        const map = new Map();
        const uniqueIds = [...new Set(organizationIds.filter(Boolean))];
        if (uniqueIds.length === 0) {
            return map;
        }
        try {
            const orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
            const orgs = await orgRepo
                .createQueryBuilder('org')
                .select(['org.id', 'org.logoUrl'])
                .where('org.id IN (:...ids)', { ids: uniqueIds })
                .getMany();
            for (const org of orgs) {
                map.set(org.id, org.logoUrl ?? undefined);
            }
        }
        catch (err) {
            logger_1.logger.warn('Failed to batch-fetch org logo URLs', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        return map;
    }
    listRecruitments = async (req, res) => {
        await this.execute(req, res, async () => {
            const page = Number.parseInt(req.query.page) || 1;
            const limit = Math.min(Number.parseInt(req.query.limit) || 20, 200);
            const filters = {
                activityType: Activity_1.ActivityType.RECRUITMENT,
            };
            if (req.query.status) {
                const status = req.query.status;
                if (status === 'open') {
                    filters.status = [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING];
                }
                else if (status === 'closed') {
                    filters.status = [
                        Activity_1.ActivityStatus.COMPLETED,
                        Activity_1.ActivityStatus.CANCELLED,
                        Activity_1.ActivityStatus.EXPIRED,
                    ];
                }
                else if (status === 'paused') {
                    filters.status = [Activity_1.ActivityStatus.DRAFT, Activity_1.ActivityStatus.PLANNING];
                }
            }
            const orgId = req.query.organizationId ??
                req.tenantContext
                    ?.organizationId ??
                req.user?.currentOrganizationId;
            if (orgId) {
                filters.organizationId = orgId;
            }
            if (req.query.searchTerm) {
                filters.searchTerm = req.query.searchTerm;
            }
            if (req.query.hasOpenSlots) {
                filters.hasOpenSlots = (0, queryUtils_1.parseBooleanQuery)(req.query.hasOpenSlots);
            }
            if (req.query.tags) {
                const tagsParam = req.query.tags;
                filters.tags = Array.isArray(tagsParam) ? tagsParam : [tagsParam];
            }
            const result = await this.activityService.searchActivities(filters, page, limit);
            const orgIds = result.activities
                .map((a) => a.organizationId)
                .filter((id) => !!id);
            const logoMap = await this.getOrgLogoUrls(orgIds);
            const discordSettingsMap = new Map();
            for (const orgId of new Set(orgIds)) {
                discordSettingsMap.set(orgId, await this.getDiscordRecruitmentSettings(orgId));
            }
            const userId = req.user?.id;
            const recruitments = result.activities.map((activity) => {
                const actRecord = activity;
                const logoUrl = logoMap.get(activity.organizationId ?? '');
                const discordSettings = discordSettingsMap.get(activity.organizationId ?? '') ?? null;
                return this.transformToRecruitment(actRecord, logoUrl, userId, discordSettings);
            });
            res.json({
                data: recruitments,
                total: result.total,
                page: result.page,
                limit,
                totalPages: result.totalPages,
            });
        });
    };
    createRecruitment = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const userName = req.user?.username;
            const organizationId = req.body.organizationId || req.user?.currentOrganizationId;
            if (!userId || !userName) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID is required');
            }
            const orgRepo = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
            const org = await orgRepo.findOne({ where: { id: organizationId } });
            if (!org) {
                throw new apiErrors_1.ValidationError('Organization not found');
            }
            const organizationName = org.name;
            const snapshotQuestions = org.settings?.applicationQuestions ?? [];
            const dto = {
                title: req.body.title,
                description: req.body.description,
                activityType: Activity_1.ActivityType.RECRUITMENT,
                creatorId: userId,
                creatorName: userName,
                organizationId,
                organizationName,
                visibility: this.mapVisibility(req.body.visibility),
                maxParticipants: req.body.maxPositions,
                tags: req.body.tags ?? [],
            };
            const activity = await this.activityService.createActivity(organizationId, dto);
            const updateFields = {
                rolesNeeded: req.body.rolesNeeded ?? [],
                requirements: req.body.requirements,
                expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
                maxApplicants: req.body.maxPositions,
                screeningEnabled: req.body.screeningEnabled ?? false,
                autoAcceptQualified: req.body.autoAcceptQualified ?? false,
                contractorRequirements: req.body.contractorRequirements,
                bannerImageUrl: req.body.bannerImageUrl || undefined,
                applicationQuestions: snapshotQuestions,
                status: Activity_1.ActivityStatus.RECRUITING,
            };
            const updated = await this.activityService.updateActivity(activity.id, updateFields);
            const logoUrl = await this.getOrgLogoUrl(organizationId);
            res
                .status(201)
                .json(this.transformToRecruitment(updated, logoUrl));
        });
    };
    getRecruitment = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            const logoUrl = await this.getOrgLogoUrl(activity.organizationId);
            const discordSettings = activity.organizationId
                ? await this.getDiscordRecruitmentSettings(activity.organizationId)
                : null;
            const userId = req.user?.id;
            res.json(this.transformToRecruitment(activity, logoUrl, userId, discordSettings));
        });
    };
    updateRecruitment = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.creatorId !== userId) {
                throw new apiErrors_1.ForbiddenError('Only creator can update recruitment');
            }
            const updateFields = this.extractUpdateFields(req.body);
            const updated = await this.activityService.updateActivity(id, updateFields);
            const logoUrl = await this.getOrgLogoUrl(activity.organizationId);
            res.json(this.transformToRecruitment(updated, logoUrl));
        });
    };
    deleteRecruitment = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.creatorId !== userId) {
                throw new apiErrors_1.ForbiddenError('Only the recruitment creator can delete this posting');
            }
            await this.activityService.deleteActivity(id, userId);
            res.status(204).send();
        });
    };
    updateStatus = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const { status } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.creatorId !== userId) {
                throw new apiErrors_1.ForbiddenError('Only creator can update status');
            }
            const newStatus = this.mapToActivityStatus(status);
            const updated = await this.activityService.updateActivity(id, { status: newStatus });
            const logoUrl = await this.getOrgLogoUrl(activity.organizationId);
            res.json(this.transformToRecruitment(updated, logoUrl));
        });
    };
    submitApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            const userName = req.user?.username;
            const discordId = req.body.discordId ??
                req.body.discordUserId ??
                req.user?.discordId;
            if (!userId || !userName) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.organizationId) {
                await this.orgApplicationService.checkWatchlist(activity.organizationId, userId);
            }
            const applicantName = req.body.applicantName ??
                req.body.discordUsername ??
                userName;
            const applicationData = {
                applicantId: userId,
                applicantName,
                message: req.body.message,
                rsiHandle: req.body.rsiHandle,
                discordId,
                answers: req.body.answers,
                timezone: req.body.timezone,
                availablePlaytimes: req.body.availablePlaytimes,
                preferredRoles: req.body.preferredRoles,
            };
            const application = await this.activityService.submitApplication(id, applicationData);
            res.status(201).json(application);
        });
    };
    listApplications = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            await this.requireApplicationReviewAccess(userId, activity);
            const filters = {};
            if (req.query.status) {
                filters.status = this.mapApplicationStatus(req.query.status);
            }
            const applications = await this.activityService.getApplications(id, filters);
            const enriched = activity.organizationId
                ? await this.enrichApplicationsWithProfile(applications, activity.organizationId)
                : applications;
            res.json({
                data: enriched,
                total: enriched.length,
            });
        });
    };
    async enrichApplicationsWithProfile(applications, organizationId) {
        const applicantIds = [...new Set(applications.map(a => a.applicantId).filter(Boolean))];
        if (applicantIds.length === 0) {
            return applications;
        }
        try {
            const userSkillRepo = data_source_1.AppDataSource.getRepository(UserSkill_1.UserSkill);
            const allUserSkills = await userSkillRepo.find({
                where: { organizationId, userId: (0, typeorm_1.In)(applicantIds) },
                relations: ['skill'],
            });
            const userShipRepo = data_source_1.AppDataSource.getRepository(UserShip_1.UserShip);
            const allUserShips = await userShipRepo
                .createQueryBuilder('us')
                .leftJoinAndMapOne('us.shipRef', Ship_1.Ship, 'ship', 'ship.id = us."shipId"')
                .where('us."userId" IN (:...userIds)', { userIds: applicantIds })
                .andWhere('us."flightHours" > 0')
                .select(['us.userId', 'us.flightHours', 'ship.career'])
                .getRawMany();
            const skillsByUser = new Map();
            for (const us of allUserSkills) {
                if (!us.skill) {
                    continue;
                }
                const arr = skillsByUser.get(us.userId) ?? [];
                arr.push({ name: us.skill.name, category: us.skill.category, level: us.level });
                skillsByUser.set(us.userId, arr);
            }
            const careerHoursByUser = new Map();
            for (const row of allUserShips) {
                const career = row.ship_career || 'Unknown';
                const hours = Number(row.us_flightHours) || 0;
                if (hours <= 0) {
                    continue;
                }
                let userMap = careerHoursByUser.get(row.us_userId);
                if (!userMap) {
                    userMap = new Map();
                    careerHoursByUser.set(row.us_userId, userMap);
                }
                const existing = userMap.get(career) ?? { hours: 0, shipCount: 0 };
                existing.hours += hours;
                existing.shipCount += 1;
                userMap.set(career, existing);
            }
            return applications.map(app => ({
                ...app,
                skills: skillsByUser.get(app.applicantId) ?? [],
                careerHours: (() => {
                    const userMap = careerHoursByUser.get(app.applicantId);
                    if (!userMap) {
                        return [];
                    }
                    return Array.from(userMap.entries())
                        .map(([career, data]) => ({ career, hours: data.hours, shipCount: data.shipCount }))
                        .sort((a, b) => b.hours - a.hours);
                })(),
            }));
        }
        catch (err) {
            logger_1.logger.warn('Failed to enrich applications with profile data', {
                error: err instanceof Error ? err.message : String(err),
            });
            return applications;
        }
    }
    reviewApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id, applicationId } = req.params;
            const { action, notes, rejectionReason, interviewScheduledAt } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Unauthorized');
            }
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            await this.requireApplicationReviewAccess(userId, activity);
            let result;
            switch (action) {
                case 'accept':
                    result = await this.activityService.acceptApplication(id, applicationId, userId, notes);
                    break;
                case 'reject':
                    result = await this.activityService.rejectApplication(id, applicationId, userId, rejectionReason);
                    break;
                case 'advance':
                    result = await this.activityService.advanceApplicationStage(id, applicationId, userId, notes);
                    break;
                case 'interview':
                    if (!interviewScheduledAt) {
                        throw new apiErrors_1.ValidationError('Interview scheduled date is required');
                    }
                    result = await this.activityService.scheduleInterview(id, applicationId, {
                        scheduledAt: new Date(interviewScheduledAt),
                        interviewerId: userId,
                        notes,
                    });
                    break;
                default:
                    throw new apiErrors_1.ValidationError('Invalid action');
            }
            res.json(result);
        });
    };
    getMyApplications = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = req.user?.id;
            const discordId = req.user?.discordId;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const searchFilters = {
                activityType: Activity_1.ActivityType.RECRUITMENT,
                status: [Activity_1.ActivityStatus.OPEN, Activity_1.ActivityStatus.RECRUITING, Activity_1.ActivityStatus.COMPLETED],
            };
            const result = await this.activityService.searchActivities(searchFilters, 1, 100);
            const userApplications = [];
            for (const activity of result.activities) {
                const applications = activity.applications ?? [];
                const userApp = applications.find((app) => {
                    if (discordId && app.discordId === discordId) {
                        return true;
                    }
                    return app.applicantId === userId || app.userId === userId;
                });
                if (userApp) {
                    userApplications.push({
                        ...userApp,
                        recruitmentId: activity.id,
                        recruitmentTitle: activity.title,
                        organizationName: activity.organizationName,
                    });
                }
            }
            res.json({
                data: userApplications,
                total: userApplications.length,
            });
        });
    };
    createInviteBinding = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { bindingCode, guildId, guildName, requireApplication, createdBy } = req.body;
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.creatorId !== userId) {
                throw new apiErrors_1.ForbiddenError('Only the recruitment creator can create invite bindings');
            }
            const existingMetadata = (activity.metadata ?? {});
            const inviteBindings = existingMetadata.inviteBindings ?? [];
            const newBinding = {
                bindingCode,
                guildId,
                guildName,
                requireApplication,
                createdBy,
                createdAt: new Date().toISOString(),
                isActive: true,
            };
            inviteBindings.push(newBinding);
            const updatedMetadata = {
                ...existingMetadata,
                inviteBindings,
            };
            await this.activityService.updateActivity(id, {
                metadata: updatedMetadata,
            });
            res.status(201).json({
                success: true,
                bindingCode,
                recruitmentId: id,
                message: 'Invite binding created successfully',
            });
        });
    };
    discordApply = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const activity = await this.activityService.getActivityById(id);
            if (!activity) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT) {
                throw new apiErrors_1.NotFoundError('Recruitment');
            }
            if (activity.organizationId) {
                await this.orgApplicationService.checkWatchlist(activity.organizationId, userId);
            }
            const discordId = req.user?.discordId;
            const existingApplications = activity.applications ?? [];
            const hasExistingApplication = existingApplications.some((app) => {
                if (discordId && app.discordId === discordId) {
                    return true;
                }
                return app.applicantId === userId;
            });
            if (hasExistingApplication) {
                throw new apiErrors_1.ValidationError('You have already applied to this recruitment');
            }
            const applicantName = req.body.discordUsername ??
                req.user?.username ??
                req.body.applicantName ??
                'Unknown';
            const applicationData = {
                applicantId: userId,
                applicantName,
                discordId,
                rsiHandle: req.body.rsiHandle,
                message: req.body.motivation,
                experience: req.body.experience,
                timezone: req.body.timezone,
                availablePlaytimes: req.body.availability ? [req.body.availability] : undefined,
                metadata: {
                    source: 'discord',
                    guildId: req.user?.currentOrganizationId,
                },
            };
            const application = await this.activityService.submitApplication(id, applicationData);
            res.status(201).json({
                success: true,
                application,
                message: 'Application submitted successfully',
            });
        });
    };
    mapVisibility(visibility) {
        switch (visibility) {
            case 'public':
                return Activity_1.ActivityVisibility.PUBLIC;
            case 'organization':
                return Activity_1.ActivityVisibility.ORGANIZATION;
            case 'alliance':
                return Activity_1.ActivityVisibility.ALLIANCE;
            case 'private':
                return Activity_1.ActivityVisibility.PRIVATE;
            default:
                return Activity_1.ActivityVisibility.PUBLIC;
        }
    }
    mapApplicationStatus(status) {
        switch (status) {
            case 'pending':
                return Activity_1.ApplicationStatus.PENDING;
            case 'under_review':
                return Activity_1.ApplicationStatus.UNDER_REVIEW;
            case 'interview_scheduled':
                return Activity_1.ApplicationStatus.INTERVIEW_SCHEDULED;
            case 'accepted':
                return Activity_1.ApplicationStatus.ACCEPTED;
            case 'rejected':
                return Activity_1.ApplicationStatus.REJECTED;
            case 'withdrawn':
                return Activity_1.ApplicationStatus.WITHDRAWN;
            default:
                return Activity_1.ApplicationStatus.PENDING;
        }
    }
    extractUpdateFields(body) {
        const fields = {};
        const directFields = [
            'title',
            'description',
            'rolesNeeded',
            'requirements',
            'tags',
            'screeningEnabled',
            'autoAcceptQualified',
            'contractorRequirements',
        ];
        for (const field of directFields) {
            if (body[field] !== undefined) {
                fields[field] = body[field];
            }
        }
        if (body.maxPositions !== undefined) {
            fields.maxApplicants = body.maxPositions;
            fields.maxParticipants = body.maxPositions;
        }
        if (body.expiresAt !== undefined) {
            fields.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        }
        if (body.visibility !== undefined) {
            fields.visibility = this.mapVisibility(body.visibility);
        }
        if (body.bannerImageUrl !== undefined) {
            fields.bannerImageUrl = body.bannerImageUrl || null;
        }
        return fields;
    }
}
exports.RecruitmentController = RecruitmentController;
//# sourceMappingURL=recruitmentController.js.map