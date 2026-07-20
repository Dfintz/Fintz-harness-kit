"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationApplicationService = void 0;
const data_source_1 = require("../../data-source");
const Federation_1 = require("../../models/Federation");
const FederationMember_1 = require("../../models/FederationMember");
const OrgApplication_1 = require("../../models/OrgApplication");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const FederationAmbassadorService_1 = require("./FederationAmbassadorService");
const federationPermissions_1 = require("./federationPermissions");
class FederationApplicationService {
    static instance;
    applicationRepository;
    federationRepository;
    memberRepository;
    ambassadorService;
    constructor() {
        this.applicationRepository = data_source_1.AppDataSource.getRepository(OrgApplication_1.OrgApplication);
        this.federationRepository = data_source_1.AppDataSource.getRepository(Federation_1.Federation);
        this.memberRepository = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
    }
    static getInstance() {
        if (!FederationApplicationService.instance) {
            FederationApplicationService.instance = new FederationApplicationService();
        }
        return FederationApplicationService.instance;
    }
    toData(app) {
        return {
            id: app.id,
            federationId: app.organizationId,
            applicantOrgId: app.applicantOrgId ?? '',
            applicantOrgName: app.applicantOrgName ?? '',
            applicantUserId: app.applicantUserId,
            message: app.message ?? null,
            formResponses: app.formResponses ?? null,
            source: app.source ?? null,
            status: app.status,
            reviewedBy: app.reviewedBy ?? null,
            reviewNote: app.reviewNote ?? null,
            reviewedAt: app.reviewedAt ?? null,
            createdAt: app.createdAt,
        };
    }
    async getApplicationMode(federationId) {
        const federation = await this.federationRepository.findOne({
            where: { id: federationId },
        });
        if (!federation) {
            throw new apiErrors_1.NotFoundError('Federation', federationId);
        }
        if (!federation.isPublic) {
            return { mode: 'disabled' };
        }
        const allowSelf = federation.settings?.allowSelfApplication ?? true;
        if (!allowSelf) {
            return { mode: 'disabled' };
        }
        const questions = federation.settings?.applicationQuestions;
        if (questions && questions.length > 0) {
            return { mode: 'custom', questions };
        }
        return { mode: 'simple' };
    }
    async applyToFederation(federationId, applicantUserId, applicantOrgId, applicantOrgName, data) {
        const modeResponse = await this.getApplicationMode(federationId);
        if (modeResponse.mode === 'disabled') {
            throw new apiErrors_1.ForbiddenError('This federation does not accept applications');
        }
        const existingMember = await this.memberRepository.findOne({
            where: { federationId, organizationId: applicantOrgId },
        });
        if (existingMember) {
            throw new apiErrors_1.ConflictError('Your organization is already a member of this federation');
        }
        const existingApp = await this.applicationRepository.findOne({
            where: {
                organizationId: federationId,
                applicantOrgId,
                targetType: OrgApplication_1.ApplicationTargetType.FEDERATION,
                status: OrgApplication_1.OrgApplicationStatus.PENDING,
            },
        });
        if (existingApp) {
            throw new apiErrors_1.ConflictError('Your organization already has a pending application to this federation');
        }
        let sanitizedFormResponses = data.formResponses;
        if (modeResponse.mode === 'custom' && modeResponse.questions) {
            sanitizedFormResponses = this.validateFormResponses(data.formResponses ?? {}, modeResponse.questions);
        }
        const application = this.applicationRepository.create({
            organizationId: federationId,
            applicantUserId,
            applicantOrgId,
            applicantOrgName,
            targetType: OrgApplication_1.ApplicationTargetType.FEDERATION,
            applicantType: OrgApplication_1.ApplicantType.ORGANIZATION,
            message: data.message?.trim() || undefined,
            formResponses: sanitizedFormResponses,
            source: data.source ?? 'web',
            status: OrgApplication_1.OrgApplicationStatus.PENDING,
        });
        const saved = await this.applicationRepository.save(application);
        logger_1.logger.info('Federation application submitted', {
            federationId,
            applicantOrgId,
            applicationId: saved.id,
        });
        return this.toData(saved);
    }
    async listApplications(federationId, userId, filters) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'settings', 'Ambassador settings permission required to view federation applications');
        const where = {
            organizationId: federationId,
            targetType: OrgApplication_1.ApplicationTargetType.FEDERATION,
        };
        if (filters?.status) {
            where.status = filters.status;
        }
        const applications = await this.applicationRepository.find({
            where,
            order: { createdAt: 'DESC' },
            take: 100,
        });
        return applications.map(a => this.toData(a));
    }
    async reviewApplication(federationId, applicationId, reviewerUserId, decision, note) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, reviewerUserId, 'settings', 'Ambassador settings permission required to review federation applications');
        const application = await this.applicationRepository.findOne({
            where: {
                id: applicationId,
                organizationId: federationId,
                targetType: OrgApplication_1.ApplicationTargetType.FEDERATION,
            },
        });
        if (!application) {
            throw new apiErrors_1.NotFoundError('Application', applicationId);
        }
        if (application.status !== OrgApplication_1.OrgApplicationStatus.PENDING) {
            throw new apiErrors_1.ValidationError('Only pending applications can be reviewed');
        }
        application.status =
            decision === 'approved' ? OrgApplication_1.OrgApplicationStatus.APPROVED : OrgApplication_1.OrgApplicationStatus.REJECTED;
        application.reviewedBy = reviewerUserId;
        application.reviewNote = note ?? undefined;
        application.reviewedAt = new Date();
        const saved = await this.applicationRepository.save(application);
        if (decision === 'approved' && application.applicantOrgId) {
            const member = this.memberRepository.create({
                federationId,
                organizationId: application.applicantOrgId,
                organizationName: application.applicantOrgName ?? 'Unknown',
                role: 'member',
                status: 'active',
                votingPower: 1,
                contributions: 0,
            });
            await this.memberRepository.save(member);
            logger_1.logger.info('Federation application approved — member created', {
                federationId,
                applicationId,
                newMemberOrgId: application.applicantOrgId,
            });
        }
        else {
            logger_1.logger.info('Federation application rejected', {
                federationId,
                applicationId,
            });
        }
        return this.toData(saved);
    }
    async withdrawApplication(federationId, applicationId, userId) {
        const application = await this.applicationRepository.findOne({
            where: {
                id: applicationId,
                organizationId: federationId,
                targetType: OrgApplication_1.ApplicationTargetType.FEDERATION,
                applicantUserId: userId,
            },
        });
        if (!application) {
            throw new apiErrors_1.NotFoundError('Application', applicationId);
        }
        if (application.status !== OrgApplication_1.OrgApplicationStatus.PENDING) {
            throw new apiErrors_1.ValidationError('Only pending applications can be withdrawn');
        }
        application.status = OrgApplication_1.OrgApplicationStatus.WITHDRAWN;
        await this.applicationRepository.save(application);
        logger_1.logger.info('Federation application withdrawn', {
            federationId,
            applicationId,
            userId,
        });
    }
    validateFormResponses(responses, questions) {
        for (const q of questions) {
            if (q.required && !responses[q.id]?.trim()) {
                throw new apiErrors_1.ValidationError(`Question "${q.label}" is required`);
            }
        }
        const validIds = new Set(questions.map(q => q.id));
        return Object.fromEntries(Object.entries(responses).filter(([key]) => validIds.has(key)));
    }
}
exports.FederationApplicationService = FederationApplicationService;
//# sourceMappingURL=FederationApplicationService.js.map