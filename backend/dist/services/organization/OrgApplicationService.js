"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgApplicationService = exports.TERMINAL_STATUSES = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrgApplication_1 = require("../../models/OrgApplication");
const OrgWatchlistEntry_1 = require("../../models/OrgWatchlistEntry");
const PublicOrgProfile_1 = require("../../models/PublicOrgProfile");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const MembershipWorkflow_1 = require("../shared/MembershipWorkflow");
const MembershipAuditLogger_1 = require("./MembershipAuditLogger");
const OrganizationMemberService_1 = require("./OrganizationMemberService");
exports.TERMINAL_STATUSES = [
    OrgApplication_1.OrgApplicationStatus.APPROVED,
    OrgApplication_1.OrgApplicationStatus.REJECTED,
    OrgApplication_1.OrgApplicationStatus.WITHDRAWN,
];
class OrgApplicationService {
    applicationRepository;
    organizationRepository;
    profileRepository;
    membershipRepository;
    watchlistRepository;
    userRepository;
    memberService;
    constructor() {
        this.applicationRepository = data_source_1.AppDataSource.getRepository(OrgApplication_1.OrgApplication);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.profileRepository = data_source_1.AppDataSource.getRepository(PublicOrgProfile_1.PublicOrgProfile);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.watchlistRepository = data_source_1.AppDataSource.getRepository(OrgWatchlistEntry_1.OrgWatchlistEntry);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.memberService = new OrganizationMemberService_1.OrganizationMemberService();
    }
    async getApplicationMode(orgId) {
        const org = await this.organizationRepository.findOne({ where: { id: orgId } });
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        const settings = org.settings;
        const rawDiscordRecruitment = settings?.customFields?.discordRecruitment;
        const discordRecruitment = typeof rawDiscordRecruitment === 'object' &&
            rawDiscordRecruitment !== null &&
            'enabled' in rawDiscordRecruitment
            ? rawDiscordRecruitment
            : undefined;
        const questions = settings?.applicationQuestions && settings.applicationQuestions.length > 0
            ? settings.applicationQuestions
            : undefined;
        if (discordRecruitment?.enabled && org.metadata?.discordGuildId) {
            const profile = await this.profileRepository.findOne({
                where: { organizationId: orgId },
            });
            return {
                mode: 'discord',
                discordInviteUrl: profile?.discordInvite ?? undefined,
                questions,
            };
        }
        if (questions) {
            return {
                mode: 'custom',
                questions,
            };
        }
        return { mode: 'simple' };
    }
    async checkWatchlist(orgId, userId) {
        const user = await this.userRepository.findOne({
            where: { id: userId },
            select: ['id', 'rsiHandle'],
        });
        if (user?.rsiHandle) {
            const watchlistEntry = await this.watchlistRepository.findOne({
                where: {
                    organizationId: orgId,
                    rsiHandle: user.rsiHandle.toUpperCase(),
                },
            });
            if (watchlistEntry) {
                throw new apiErrors_1.ForbiddenError('You are unable to apply to this organization at this time');
            }
        }
    }
    validateFormResponses(questions, formResponses) {
        if (!questions || questions.length === 0) {
            return formResponses;
        }
        const responses = formResponses ?? {};
        for (const question of questions) {
            if (question.required && !responses[question.id]?.trim()) {
                throw new apiErrors_1.ValidationError(`Required question not answered: ${question.label}`);
            }
        }
        const validIds = new Set(questions.map(q => q.id));
        return Object.fromEntries(Object.entries(responses).filter(([key]) => validIds.has(key)));
    }
    async apply(orgId, userId, message, formResponses, source) {
        const org = await this.organizationRepository.findOne({ where: { id: orgId } });
        if (!org) {
            throw new apiErrors_1.NotFoundError('Organization not found');
        }
        const profile = await this.profileRepository.findOne({
            where: { organizationId: orgId },
        });
        if (!profile?.isRecruiting) {
            throw new apiErrors_1.ValidationError('This organization is not currently recruiting');
        }
        const existingMember = await this.membershipRepository.findOne({
            where: { organizationId: orgId, userId, isActive: true },
        });
        if (existingMember) {
            throw new apiErrors_1.ConflictError('You are already a member of this organization');
        }
        await this.checkWatchlist(orgId, userId);
        const existing = await this.applicationRepository.findOne({
            where: {
                organizationId: orgId,
                applicantUserId: userId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)(exports.TERMINAL_STATUSES)),
            },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('You already have an active application for this organization');
        }
        const sanitizedResponses = this.validateFormResponses(org.settings?.applicationQuestions, formResponses);
        const autoApprove = org.settings?.requireApproval === false;
        let saved;
        if (autoApprove) {
            const queryRunner = data_source_1.AppDataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                await this.memberService.addMember(orgId, userId, 'member', undefined, undefined, queryRunner.manager, { acquisitionSource: 'application' });
                const app = this.applicationRepository.create({
                    organizationId: orgId,
                    applicantUserId: userId,
                    targetType: OrgApplication_1.ApplicationTargetType.ORGANIZATION,
                    applicantType: OrgApplication_1.ApplicantType.USER,
                    message: message ?? undefined,
                    formResponses: sanitizedResponses ?? undefined,
                    source: source ?? 'web',
                    status: OrgApplication_1.OrgApplicationStatus.APPROVED,
                    reviewedAt: new Date(),
                });
                saved = await queryRunner.manager.save(app);
                await queryRunner.commitTransaction();
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
                logger_1.logger.error('Failed to auto-approve application', {
                    organizationId: orgId,
                    userId,
                    error,
                });
                throw error;
            }
            finally {
                await queryRunner.release();
            }
        }
        else {
            const app = this.applicationRepository.create({
                organizationId: orgId,
                applicantUserId: userId,
                targetType: OrgApplication_1.ApplicationTargetType.ORGANIZATION,
                applicantType: OrgApplication_1.ApplicantType.USER,
                message: message ?? undefined,
                formResponses: sanitizedResponses ?? undefined,
                source: source ?? 'web',
                status: OrgApplication_1.OrgApplicationStatus.PENDING,
            });
            saved = await this.applicationRepository.save(app);
        }
        logger_1.logger.info(`Org application submitted: ${saved.id}`, {
            organizationId: orgId,
            applicantUserId: userId,
            status: saved.status,
            autoApproved: autoApprove,
        });
        return saved;
    }
    async reviewApplication(appId, orgId, reviewerId, decision, note) {
        const app = await this.applicationRepository.findOne({
            where: { id: appId, organizationId: orgId },
        });
        if (!app) {
            throw new apiErrors_1.NotFoundError('Application not found');
        }
        MembershipWorkflow_1.MembershipWorkflow.validateTransition(MembershipWorkflow_1.APPLICATION_TRANSITIONS, app.status, decision, 'admin');
        app.reviewedBy = reviewerId;
        app.reviewNote = note ?? undefined;
        app.reviewedAt = new Date();
        if (decision === 'approved') {
            app.status = OrgApplication_1.OrgApplicationStatus.APPROVED;
            const queryRunner = data_source_1.AppDataSource.createQueryRunner();
            await queryRunner.connect();
            await queryRunner.startTransaction();
            try {
                await this.memberService.addMember(orgId, app.applicantUserId, 'member', undefined, undefined, queryRunner.manager, { acquisitionSource: 'application', acquisitionRefId: appId });
                const saved = await queryRunner.manager.save(app);
                await queryRunner.commitTransaction();
                logger_1.logger.info(`Org application ${appId} reviewed: ${decision}`, {
                    organizationId: orgId,
                    reviewedBy: reviewerId,
                });
                MembershipAuditLogger_1.membershipAuditLogger.logApplicationReviewed(appId, app.applicantUserId, orgId, reviewerId, 'approved');
                return saved;
            }
            catch (error) {
                await queryRunner.rollbackTransaction();
                logger_1.logger.error(`Failed to add member while approving application ${appId}`, {
                    organizationId: orgId,
                    reviewerId,
                    error,
                });
                throw error;
            }
            finally {
                await queryRunner.release();
            }
        }
        else {
            app.status = OrgApplication_1.OrgApplicationStatus.REJECTED;
        }
        const saved = await this.applicationRepository.save(app);
        logger_1.logger.info(`Org application ${appId} reviewed: ${decision}`, {
            organizationId: orgId,
            reviewedBy: reviewerId,
        });
        MembershipAuditLogger_1.membershipAuditLogger.logApplicationReviewed(appId, app.applicantUserId, orgId, reviewerId, 'rejected');
        return saved;
    }
    async withdrawApplication(appId, userId) {
        const app = await this.applicationRepository.findOne({
            where: { id: appId },
        });
        if (!app) {
            throw new apiErrors_1.NotFoundError('Application not found');
        }
        if (app.applicantUserId !== userId) {
            throw new apiErrors_1.ForbiddenError('You can only withdraw your own application');
        }
        MembershipWorkflow_1.MembershipWorkflow.validateTransition(MembershipWorkflow_1.APPLICATION_TRANSITIONS, app.status, 'withdrawn', 'member');
        app.status = OrgApplication_1.OrgApplicationStatus.WITHDRAWN;
        const saved = await this.applicationRepository.save(app);
        logger_1.logger.info(`Org application ${appId} withdrawn by applicant`, {
            applicantUserId: userId,
        });
        return saved;
    }
    async getApplicationsForOrg(orgId, options) {
        const page = options?.page ?? 1;
        const limit = Math.min(options?.limit ?? 20, 100);
        const skip = (page - 1) * limit;
        const where = {
            organizationId: orgId,
            targetType: OrgApplication_1.ApplicationTargetType.ORGANIZATION,
            applicantType: OrgApplication_1.ApplicantType.USER,
        };
        if (options?.status) {
            where.status = options.status;
        }
        const [rawData, total] = await this.applicationRepository.findAndCount({
            where,
            order: { createdAt: 'DESC' },
            skip,
            take: limit,
            relations: ['applicant'],
        });
        const data = rawData.map(app => ({
            ...app,
            applicant: app.applicant
                ? { id: app.applicant.id, username: app.applicant.username }
                : undefined,
        }));
        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
    static toUserView(app) {
        const { organization, ...rest } = app;
        return {
            ...rest,
            organization: organization ? { id: organization.id, name: organization.name } : undefined,
        };
    }
    async getMyApplications(userId) {
        const applications = await this.applicationRepository.find({
            where: { applicantUserId: userId },
            order: { createdAt: 'DESC' },
            relations: ['organization'],
        });
        return applications.map(OrgApplicationService.toUserView);
    }
    async hasActiveApplication(orgId, userId) {
        const count = await this.applicationRepository.count({
            where: {
                organizationId: orgId,
                applicantUserId: userId,
                status: (0, typeorm_1.Not)((0, typeorm_1.In)(exports.TERMINAL_STATUSES)),
            },
        });
        return count > 0;
    }
    async isMember(orgId, userId) {
        const count = await this.membershipRepository.count({
            where: { organizationId: orgId, userId, isActive: true },
        });
        return count > 0;
    }
}
exports.OrgApplicationService = OrgApplicationService;
//# sourceMappingURL=OrgApplicationService.js.map