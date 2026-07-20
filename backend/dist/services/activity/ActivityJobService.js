"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityJobService = void 0;
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const TenantService_1 = require("../base/TenantService");
const OrganizationMemberService_1 = require("../organization/OrganizationMemberService");
const ActivityAuditLogger_1 = require("./ActivityAuditLogger");
class ActivityJobService extends TenantService_1.TenantService {
    participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
    memberService = new OrganizationMemberService_1.OrganizationMemberService();
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Activity_1.Activity));
    }
    isApplicationByUser(app, userId) {
        return app.userId === userId || app.applicantId === userId;
    }
    findApplicationById(applications, applicationId) {
        return applications?.find(app => app.id === applicationId || app.applicationId === applicationId);
    }
    async getUserNameFromActivity(activity, userId) {
        if (activity.creatorId === userId && activity.creatorName) {
            return activity.creatorName;
        }
        const participant = await this.participantRepo.findOne({
            where: { activityId: activity.id, userId },
            select: ['userName'],
        });
        if (participant?.userName) {
            return participant.userName;
        }
        return userId;
    }
    async applyForJob(activityId, application) {
        const activity = await this.repository.findOne({
            where: { id: activityId },
        });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const jobTypes = [Activity_1.ActivityType.BOUNTY, Activity_1.ActivityType.MISSION, Activity_1.ActivityType.CONTRACT];
        if (!jobTypes.includes(activity.activityType)) {
            throw new apiErrors_1.ValidationError('This activity is not a job posting (bounty, mission, or contract)');
        }
        const existingApplication = activity.applications?.find((app) => this.isApplicationByUser(app, application.userId));
        if (existingApplication) {
            throw new apiErrors_1.ConflictError('User has already applied for this job');
        }
        const appId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
        const jobApplication = {
            id: appId,
            applicationId: appId,
            applicantId: application.userId,
            applicantName: application.userName,
            userId: application.userId,
            userName: application.userName,
            organizationId: application.organizationId,
            organizationName: application.organizationName,
            status: Activity_1.ApplicationStatus.PENDING,
            appliedAt: new Date(),
            coverLetter: application.coverLetter,
            experience: application.experience,
            references: application.references,
            availableHours: application.availableHours,
            preferredRole: application.preferredRole,
            metadata: application.metadata || {},
        };
        activity.applications = [...(activity.applications ?? []), jobApplication];
        activity.updatedAt = new Date();
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.APPLICATION_SUBMITTED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId || '',
            performedById: application.userId,
            performedByName: application.userName,
            details: {
                applicationId: jobApplication.id,
                preferredRole: application.preferredRole,
                organizationId: application.organizationId,
                totalApplications: updatedActivity.applications?.length || 0,
            },
        });
        logger_1.logger.info(`Job application submitted for activity ${activityId} by ${application.userId}`);
        return updatedActivity;
    }
    async reviewApplication(activityId, applicationId, status, reviewedBy, feedback) {
        let previousStatus;
        let auditApplication;
        const updatedActivity = await this.withEntityLock(activityId, async (activity, queryRunner) => {
            const activityRepo = queryRunner.manager.getRepository(Activity_1.Activity);
            const participantRepo = queryRunner.manager.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
            if (activity.creatorId !== reviewedBy) {
                throw new apiErrors_1.ForbiddenError('Only activity creator can review applications');
            }
            const application = this.findApplicationById(activity.applications, applicationId);
            if (!application) {
                throw new apiErrors_1.NotFoundError('Application');
            }
            previousStatus = application.status;
            auditApplication = application;
            application.status = status;
            application.reviewedAt = new Date();
            application.reviewedBy = reviewedBy;
            if (feedback) {
                application.feedback = feedback;
            }
            if (status === Activity_1.ApplicationStatus.ACCEPTED) {
                const newParticipant = participantRepo.create({
                    activityId,
                    userId: application.userId || '',
                    userName: application.userName || '',
                    organizationId: application.organizationId,
                    organizationName: application.organizationName,
                    role: Activity_1.ParticipantRole.CONTRACTOR,
                    status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED,
                    joinedAt: new Date(),
                });
                await participantRepo.save(newParticipant);
                activity.currentParticipants = await participantRepo.count({
                    where: { activityId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
                });
            }
            activity.updatedAt = new Date();
            return activityRepo.save(activity);
        }, { onNotFound: () => new apiErrors_1.ActivityNotFoundError('activity') });
        const auditAction = this.resolveApplicationAuditAction(status);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: auditAction,
            activityId,
            activityTitle: updatedActivity.title,
            activityType: updatedActivity.activityType,
            organizationId: updatedActivity.organizationId || '',
            performedById: reviewedBy,
            performedByName: await this.getUserNameFromActivity(updatedActivity, reviewedBy),
            details: {
                applicationId,
                applicantId: auditApplication?.userId || auditApplication?.applicantId,
                applicantName: auditApplication?.userName || auditApplication?.applicantName,
                previousStatus,
                newStatus: status,
                feedback,
            },
        });
        logger_1.logger.info(`Application ${applicationId} ${status} for activity ${activityId} by ${reviewedBy}`);
        return updatedActivity;
    }
    resolveApplicationAuditAction(status) {
        if (status === Activity_1.ApplicationStatus.ACCEPTED) {
            return ActivityAuditLogger_1.ActivityAuditAction.APPLICATION_ACCEPTED;
        }
        if (status === Activity_1.ApplicationStatus.REJECTED) {
            return ActivityAuditLogger_1.ActivityAuditAction.APPLICATION_REJECTED;
        }
        return ActivityAuditLogger_1.ActivityAuditAction.APPLICATION_REVIEWED;
    }
    scoreNumericRequirement(actual, required, weight, failureRecommendation, recommendations) {
        if (actual >= required) {
            return { passed: true, score: weight };
        }
        const score = Math.round((actual / required) * weight);
        recommendations.push(failureRecommendation);
        return { passed: false, score };
    }
    scoreListRequirement(required, actual, weight, failureRecommendation, recommendations) {
        if (required.every(item => actual.includes(item))) {
            return { passed: true, score: weight };
        }
        const matching = required.filter(item => actual.includes(item)).length;
        const score = Math.round((matching / required.length) * weight);
        recommendations.push(failureRecommendation);
        return { passed: false, score };
    }
    async screenContractor(userId, requirements, screening) {
        const result = {
            userId,
            screenedAt: new Date(),
            passed: true,
            score: 0,
            requirements,
            results: {},
            recommendations: [],
        };
        let totalScore = 0;
        let maxScore = 0;
        if (requirements.minimumExperience) {
            maxScore += 25;
            const r = this.scoreNumericRequirement(screening.experience, requirements.minimumExperience, 25, 'Gain more experience in this field', result.recommendations);
            result.results.experience = r;
            totalScore += r.score;
        }
        if (requirements.minimumReputation) {
            maxScore += 20;
            const r = this.scoreNumericRequirement(screening.reputation, requirements.minimumReputation, 20, 'Improve reputation through successful job completion', result.recommendations);
            result.results.reputation = r;
            totalScore += r.score;
        }
        if (requirements.minCompletionRate) {
            maxScore += 20;
            const r = this.scoreNumericRequirement(screening.completionRate, requirements.minCompletionRate, 20, 'Improve job completion rate', result.recommendations);
            result.results.completionRate = r;
            totalScore += r.score;
        }
        if (requirements.requiredSpecializations && requirements.requiredSpecializations.length > 0) {
            maxScore += 20;
            const r = this.scoreListRequirement(requirements.requiredSpecializations, screening.specializations, 20, 'Develop required specializations', result.recommendations);
            result.results.specializations = r;
            totalScore += r.score;
        }
        if (requirements.requiredCertifications && requirements.requiredCertifications.length > 0) {
            maxScore += 15;
            const r = this.scoreListRequirement(requirements.requiredCertifications, screening.certifications, 15, 'Obtain required certifications', result.recommendations);
            result.results.certifications = r;
            totalScore += r.score;
        }
        result.score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;
        const passingScore = requirements.passingScore ?? 70;
        result.passed = result.score >= passingScore;
        if (!result.passed) {
            result.recommendations.push(`Score ${result.score}% is below required ${passingScore}%. Focus on improvement areas.`);
        }
        logger_1.logger.info(`Contractor ${userId} screened with score ${result.score}% (${result.passed ? 'PASSED' : 'FAILED'})`);
        return result;
    }
    async updateBountyStatus(activityId, status, updatedBy, payout) {
        const activity = await this.repository.findOne({
            where: { id: activityId },
        });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.activityType !== Activity_1.ActivityType.BOUNTY) {
            throw new apiErrors_1.ValidationError('Activity is not a bounty');
        }
        const now = new Date();
        const nextMetadata = { ...activity.metadata };
        nextMetadata.bountyStatus = status;
        nextMetadata.lastUpdatedBy = updatedBy;
        if (payout !== undefined) {
            nextMetadata.actualPayout = payout;
        }
        switch (status) {
            case 'claimed':
                nextMetadata.claimedAt = now;
                break;
            case 'completed':
                nextMetadata.completedAt = now;
                break;
            case 'verified':
                nextMetadata.verifiedAt = now;
                break;
            case 'paid':
                nextMetadata.paidAt = now;
                break;
        }
        activity.metadata = nextMetadata;
        activity.updatedAt = now;
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.BOUNTY_STATUS_UPDATED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId || '',
            performedById: updatedBy,
            performedByName: await this.getUserNameFromActivity(activity, updatedBy),
            details: {
                newStatus: status,
                payout,
                statusTimestamp: now,
            },
        });
        logger_1.logger.info(`Bounty ${activityId} status updated to ${status} by ${updatedBy}`);
        return updatedActivity;
    }
    async getContractorStats(userId, organizationId) {
        const whereClause = {};
        if (organizationId) {
            whereClause.organizationId = organizationId;
        }
        const activities = await this.repository.find({
            where: whereClause,
        });
        let totalApplications = 0;
        let acceptedApplications = 0;
        let rejectedApplications = 0;
        let pendingApplications = 0;
        let completedJobs = 0;
        let totalEarnings = 0;
        const specializations = new Set();
        for (const activity of activities) {
            const userApplications = activity.applications?.filter((app) => this.isApplicationByUser(app, userId)) || [];
            totalApplications += userApplications.length;
            for (const app of userApplications) {
                switch (app.status) {
                    case Activity_1.ApplicationStatus.ACCEPTED:
                        acceptedApplications++;
                        break;
                    case Activity_1.ApplicationStatus.REJECTED:
                        rejectedApplications++;
                        break;
                    case Activity_1.ApplicationStatus.PENDING:
                        pendingApplications++;
                        break;
                }
            }
            const participantCount = await this.participantRepo.count({
                where: { activityId: activity.id, userId },
            });
            if (participantCount > 0 && activity.status === Activity_1.ActivityStatus.COMPLETED) {
                completedJobs++;
                if (activity.metadata?.actualPayout) {
                    totalEarnings += activity.metadata.actualPayout;
                }
                else if (activity.rewardCredits) {
                    totalEarnings += activity.rewardCredits;
                }
            }
        }
        return {
            totalApplications,
            acceptedApplications,
            rejectedApplications,
            pendingApplications,
            completedJobs,
            totalEarnings,
            averageRating: 0,
            specializations: Array.from(specializations),
        };
    }
    async submitApplication(activityId, applicationData) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (activity.activityType !== Activity_1.ActivityType.RECRUITMENT &&
            activity.activityType !== Activity_1.ActivityType.JOB_LISTING) {
            throw new apiErrors_1.ValidationError('Applications are only allowed for recruitment and job listing activities');
        }
        const existingApplication = (activity.applications ?? []).find((app) => {
            if (applicationData.discordId) {
                if (app.discordId === applicationData.discordId) {
                    return true;
                }
                return app.applicantId === applicationData.applicantId && !app.discordId;
            }
            return app.applicantId === applicationData.applicantId;
        });
        if (existingApplication) {
            throw new apiErrors_1.ConflictError('You have already applied to this activity');
        }
        if (activity.maxApplicants && activity.currentApplicants >= activity.maxApplicants) {
            throw new apiErrors_1.ActivityFullError('Activity has reached maximum applicants');
        }
        const application = {
            applicationId: `app-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            applicantId: applicationData.applicantId,
            applicantName: applicationData.applicantName,
            applicantEmail: applicationData.applicantEmail,
            rsiHandle: applicationData.rsiHandle,
            discordId: applicationData.discordId,
            appliedAt: new Date(),
            status: Activity_1.ApplicationStatus.PENDING,
            message: applicationData.message,
            answers: applicationData.answers,
            referredBy: applicationData.referredBy,
            timezone: applicationData.timezone,
            availablePlaytimes: applicationData.availablePlaytimes,
            preferredRoles: applicationData.preferredRoles,
        };
        if (activity.screeningEnabled && activity.contractorRequirements) {
            const screeningResult = this.performScreening(application, activity.contractorRequirements);
            application.screeningScore = screeningResult.score;
            application.screeningPassed = screeningResult.passed;
            application.screeningResults = screeningResult.results;
            if (activity.autoAcceptQualified && screeningResult.passed) {
                application.status = Activity_1.ApplicationStatus.ACCEPTED;
                application.acceptedAt = new Date();
            }
        }
        activity.applications = [...(activity.applications ?? []), application];
        activity.currentApplicants += 1;
        await this.repository.save(activity);
        logger_1.logger.info(`Application submitted for activity ${activityId} by ${applicationData.applicantName}`);
        return application;
    }
    performScreening(_application, requirements) {
        const results = [];
        let totalScore = 0;
        let maxScore = 0;
        const criticalFailure = false;
        if (requirements.minimumReputation !== undefined) {
            maxScore += 20;
            results.push({
                criterionId: 'reputation',
                criterionName: 'Minimum Reputation',
                passed: true,
                expectedValue: requirements.minimumReputation,
            });
            totalScore += 20;
        }
        if (requirements.requiredCertifications && requirements.requiredCertifications.length > 0) {
            maxScore += 30;
            results.push({
                criterionId: 'certifications',
                criterionName: 'Required Certifications',
                passed: true,
                expectedValue: requirements.requiredCertifications.join(', '),
            });
            totalScore += 30;
        }
        if (requirements.requiredShips && requirements.requiredShips.length > 0) {
            maxScore += 25;
            results.push({
                criterionId: 'ships',
                criterionName: 'Required Ships',
                passed: true,
                expectedValue: requirements.requiredShips.join(', '),
            });
            totalScore += 25;
        }
        if (requirements.backgroundCheckRequired) {
            maxScore += 25;
            results.push({
                criterionId: 'background',
                criterionName: 'Background Check',
                passed: true,
                expectedValue: true,
            });
            totalScore += 25;
        }
        const score = maxScore > 0 ? (totalScore / maxScore) * 100 : 100;
        const passed = score >= 70 && !criticalFailure;
        return { score, passed, results };
    }
    async acceptApplication(activityId, applicationId, reviewerId, notes) {
        let acceptedApplication;
        const auditActivity = await this.withEntityLock(activityId, async (activity, queryRunner) => {
            const activityRepo = queryRunner.manager.getRepository(Activity_1.Activity);
            const participantRepo = queryRunner.manager.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
            const application = (activity.applications ?? []).find((app) => app.applicationId === applicationId);
            if (!application) {
                throw new apiErrors_1.NotFoundError('Application');
            }
            if (application.status !== Activity_1.ApplicationStatus.PENDING &&
                application.status !== Activity_1.ApplicationStatus.UNDER_REVIEW) {
                throw new apiErrors_1.ValidationError('Application cannot be accepted in its current status');
            }
            application.status = Activity_1.ApplicationStatus.ACCEPTED;
            application.acceptedAt = new Date();
            application.reviewedBy = reviewerId;
            application.reviewedAt = new Date();
            if (notes) {
                application.interviewNotes = notes;
            }
            if (activity.activityType === Activity_1.ActivityType.RECRUITMENT ||
                activity.activityType === Activity_1.ActivityType.JOB_LISTING) {
                const role = activity.activityType === Activity_1.ActivityType.RECRUITMENT
                    ? Activity_1.ParticipantRole.MEMBER
                    : Activity_1.ParticipantRole.CONTRACTOR;
                const newParticipant = participantRepo.create({
                    activityId,
                    userId: application.applicantId,
                    userName: application.applicantName,
                    role,
                    status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED,
                    joinedAt: new Date(),
                    reputation: application.screeningScore,
                });
                await participantRepo.save(newParticipant);
                activity.currentParticipants = await participantRepo.count({
                    where: { activityId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
                });
            }
            await activityRepo.save(activity);
            acceptedApplication = application;
            return activity;
        }, { onNotFound: () => new apiErrors_1.ActivityNotFoundError('activity') });
        if (!acceptedApplication) {
            throw new apiErrors_1.NotFoundError('Application');
        }
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.APPLICATION_ACCEPTED,
            activityId,
            activityTitle: auditActivity.title,
            activityType: auditActivity.activityType,
            organizationId: auditActivity.organizationId || '',
            performedById: reviewerId,
            performedByName: await this.getUserNameFromActivity(auditActivity, reviewerId),
            details: {
                applicationId,
                applicantId: acceptedApplication.applicantId,
                applicantName: acceptedApplication.applicantName,
            },
        });
        logger_1.logger.info(`Application ${applicationId} accepted for activity ${activityId}`);
        if (auditActivity.activityType === Activity_1.ActivityType.RECRUITMENT &&
            auditActivity.organizationId &&
            acceptedApplication.applicantId) {
            await this.addAcceptedRecruitToOrganization(auditActivity.organizationId, acceptedApplication.applicantId, applicationId);
        }
        return acceptedApplication;
    }
    async addAcceptedRecruitToOrganization(organizationId, applicantUserId, applicationId) {
        try {
            await this.memberService.addMember(organizationId, applicantUserId, 'member', undefined, undefined, undefined, { acquisitionSource: 'recruitment', acquisitionRefId: applicationId });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.logger.info(`Recruitment accept: did not add member ${applicantUserId} to org ${organizationId}: ${message}`);
        }
    }
    async rejectApplication(activityId, applicationId, reviewerId, reason) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const application = (activity.applications ?? []).find((app) => app.applicationId === applicationId);
        if (!application) {
            throw new apiErrors_1.NotFoundError('Application');
        }
        if (application.status !== Activity_1.ApplicationStatus.PENDING &&
            application.status !== Activity_1.ApplicationStatus.UNDER_REVIEW) {
            throw new apiErrors_1.ValidationError('Application cannot be rejected in its current status');
        }
        application.status = Activity_1.ApplicationStatus.REJECTED;
        application.reviewedBy = reviewerId;
        application.reviewedAt = new Date();
        application.rejectionReason = reason;
        await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.APPLICATION_REJECTED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId || '',
            performedById: reviewerId,
            performedByName: await this.getUserNameFromActivity(activity, reviewerId),
            details: {
                applicationId,
                applicantId: application.applicantId,
                applicantName: application.applicantName,
                reason,
            },
        });
        logger_1.logger.info(`Application ${applicationId} rejected for activity ${activityId}`);
        return application;
    }
    async advanceApplicationStage(activityId, applicationId, reviewerId, comment) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const application = (activity.applications ?? []).find((app) => app.applicationId === applicationId);
        if (!application) {
            throw new apiErrors_1.NotFoundError('Application');
        }
        if (application.status !== Activity_1.ApplicationStatus.PENDING) {
            throw new apiErrors_1.ValidationError('Only pending applications can be advanced to Under Review');
        }
        application.status = Activity_1.ApplicationStatus.UNDER_REVIEW;
        application.reviewedBy = reviewerId;
        application.reviewedAt = new Date();
        if (comment) {
            application.feedback = comment;
        }
        activity.applications = [...(activity.applications ?? [])];
        await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.APPLICATION_REVIEWED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId || '',
            performedById: reviewerId,
            performedByName: await this.getUserNameFromActivity(activity, reviewerId),
            details: {
                applicationId,
                applicantId: application.applicantId,
                applicantName: application.applicantName,
                previousStatus: Activity_1.ApplicationStatus.PENDING,
                newStatus: Activity_1.ApplicationStatus.UNDER_REVIEW,
                comment,
            },
        });
        logger_1.logger.info(`Application ${applicationId} advanced to under_review for activity ${activityId}`);
        return application;
    }
    async withdrawApplication(activityId, applicationId, applicantId) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const application = (activity.applications ?? []).find((app) => app.applicationId === applicationId);
        if (!application) {
            throw new apiErrors_1.NotFoundError('Application');
        }
        if (application.applicantId !== applicantId) {
            throw new apiErrors_1.ForbiddenError('You can only withdraw your own application');
        }
        if (application.status === Activity_1.ApplicationStatus.ACCEPTED ||
            application.status === Activity_1.ApplicationStatus.COMPLETED) {
            throw new apiErrors_1.ValidationError('Cannot withdraw an accepted or completed application');
        }
        application.status = Activity_1.ApplicationStatus.WITHDRAWN;
        activity.currentApplicants -= 1;
        await this.repository.save(activity);
        logger_1.logger.info(`Application ${applicationId} withdrawn from activity ${activityId}`);
        return application;
    }
    async getApplications(activityId, filters) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        let applications = activity.applications ?? [];
        if (filters?.status) {
            applications = applications.filter((app) => app.status === filters.status);
        }
        if (filters?.applicantId) {
            applications = applications.filter((app) => app.applicantId === filters.applicantId);
        }
        return applications;
    }
    async scheduleInterview(activityId, applicationId, interviewData) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const application = (activity.applications ?? []).find((app) => app.applicationId === applicationId);
        if (!application) {
            throw new apiErrors_1.NotFoundError('Application');
        }
        application.status = Activity_1.ApplicationStatus.INTERVIEW_SCHEDULED;
        application.interviewScheduledAt = interviewData.scheduledAt;
        application.interviewNotes = interviewData.notes;
        await this.repository.save(activity);
        logger_1.logger.info(`Interview scheduled for application ${applicationId}`);
        return application;
    }
    async completeJob(activityId, applicationId, completionData) {
        const activity = await this.repository.findOne({ where: { id: activityId } });
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const application = (activity.applications ?? []).find((app) => app.applicationId === applicationId);
        if (!application) {
            throw new apiErrors_1.NotFoundError('Application');
        }
        if (application.status !== Activity_1.ApplicationStatus.ACCEPTED) {
            throw new apiErrors_1.ValidationError('Only accepted applications can be marked as completed');
        }
        application.status = Activity_1.ApplicationStatus.COMPLETED;
        application.completedAt = new Date();
        application.rating = completionData.rating;
        application.review = completionData.review;
        await this.repository.save(activity);
        logger_1.logger.info(`Job completed for application ${applicationId}`);
        return application;
    }
}
exports.ActivityJobService = ActivityJobService;
//# sourceMappingURL=ActivityJobService.js.map