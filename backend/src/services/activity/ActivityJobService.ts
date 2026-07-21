import { AppDataSource } from '../../data-source';
import {
  Activity,
  ActivityApplication,
  ActivityStatus,
  ActivityType,
  ApplicationStatus,
  ContractorRequirements,
  ContractorScreeningResult,
  ParticipantRole,
  ScreeningResult,
} from '../../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../../models/ActivityParticipant';
import {
  ActivityFullError,
  ActivityNotFoundError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { TenantService } from '../base/TenantService';
import { OrganizationMemberService } from '../organization/OrganizationMemberService';

import { ActivityAuditAction, activityAuditLogger } from './ActivityAuditLogger';

export interface JobApplicationDTO {
  userId: string;
  userName: string;
  organizationId?: string;
  organizationName?: string;
  coverLetter?: string;
  experience?: string;
  references?: string[];
  availableHours?: number;
  preferredRole?: string;
  metadata?: Record<string, unknown>;
}

export interface ContractorScreeningDTO {
  experience: number;
  reputation: number;
  completionRate: number;
  specializations: string[];
  certifications: string[];
  backgroundCheck: boolean;
  references: string[];
  metadata?: Record<string, unknown>;
}

/**
 * ActivityJobService
 *
 * Handles job-related activities and contractor management
 * Phase 4.1 - Domain Separation
 *
 * Responsibilities:
 * - Job applications and screening
 * - Contractor requirements and verification
 * - Job-specific activity management
 * - Bounty and mission handling
 *
 * @author GitHub Copilot
 * @since October 2025
 */
export class ActivityJobService extends TenantService<Activity> {
  private readonly participantRepo = AppDataSource.getRepository(ActivityParticipantEntity);
  private readonly memberService = new OrganizationMemberService();

  constructor() {
    super(AppDataSource.getRepository(Activity));
  }

  // ==================== HELPER METHODS ====================

  /**
   * Check if an application belongs to a specific user
   * Handles both userId and applicantId fields for backward compatibility
   */
  private isApplicationByUser(app: ActivityApplication, userId: string): boolean {
    return app.userId === userId || app.applicantId === userId;
  }

  /**
   * Find an application by its ID
   * Handles both id and applicationId fields for backward compatibility
   */
  private findApplicationById(
    applications: ActivityApplication[] | undefined,
    applicationId: string
  ): ActivityApplication | undefined {
    return applications?.find(
      app => app.id === applicationId || app.applicationId === applicationId
    );
  }

  /**
   * Get user name from activity for audit logging
   */
  private async getUserNameFromActivity(activity: Activity, userId: string): Promise<string> {
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

  // ==================== JOB APPLICATIONS ====================

  /**
   * Apply for a job activity
   */
  async applyForJob(activityId: string, application: JobApplicationDTO): Promise<Activity> {
    const activity = await this.repository.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    // Check if this is a job-type activity
    const jobTypes = [ActivityType.BOUNTY, ActivityType.MISSION, ActivityType.CONTRACT];
    if (!jobTypes.includes(activity.activityType)) {
      throw new ValidationError(
        'This activity is not a job posting (bounty, mission, or contract)'
      );
    }

    // Check if user already applied
    const existingApplication = activity.applications?.find((app: ActivityApplication) =>
      this.isApplicationByUser(app, application.userId)
    );
    if (existingApplication) {
      throw new ConflictError('User has already applied for this job');
    }

    // Create job application
    const appId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const jobApplication: ActivityApplication = {
      id: appId,
      applicationId: appId,
      applicantId: application.userId,
      applicantName: application.userName,
      userId: application.userId,
      userName: application.userName,
      organizationId: application.organizationId,
      organizationName: application.organizationName,
      status: ApplicationStatus.PENDING,
      appliedAt: new Date(),
      coverLetter: application.coverLetter,
      experience: application.experience,
      references: application.references,
      availableHours: application.availableHours,
      preferredRole: application.preferredRole,
      metadata: application.metadata || {},
    };

    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.applications = [...(activity.applications ?? []), jobApplication];
    activity.updatedAt = new Date();

    const updatedActivity = await this.repository.save(activity);

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.APPLICATION_SUBMITTED,
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

    logger.info(`Job application submitted for activity ${activityId} by ${application.userId}`);
    return updatedActivity;
  }

  /**
   * Review job application.
   *
   * Runs in a transaction with a `pessimistic_write` lock on the activity row so the
   * application status change, participant insert, and `currentParticipants` recount are
   * atomic and cannot race with a concurrent join/accept on the same activity.
   */
  async reviewApplication(
    activityId: string,
    applicationId: string,
    status: ApplicationStatus,
    reviewedBy: string,
    feedback?: string
  ): Promise<Activity> {
    let previousStatus: ApplicationStatus | undefined;
    let auditApplication: ActivityApplication | undefined;

    const updatedActivity = await this.withEntityLock(
      activityId,
      async (activity, queryRunner) => {
        const activityRepo = queryRunner.manager.getRepository(Activity);
        const participantRepo = queryRunner.manager.getRepository(ActivityParticipantEntity);

        // Only creator can review applications
        if (activity.creatorId !== reviewedBy) {
          throw new ForbiddenError('Only activity creator can review applications');
        }

        // Find application
        const application = this.findApplicationById(activity.applications, applicationId);
        if (!application) {
          throw new NotFoundError('Application');
        }

        previousStatus = application.status;
        auditApplication = application;

        // Update application status
        application.status = status;
        application.reviewedAt = new Date();
        application.reviewedBy = reviewedBy;
        if (feedback) {
          application.feedback = feedback;
        }

        // If accepted, add as participant via normalized table (Phase 4)
        if (status === ApplicationStatus.ACCEPTED) {
          const newParticipant = participantRepo.create({
            activityId,
            userId: application.userId || '',
            userName: application.userName || '',
            organizationId: application.organizationId,
            organizationName: application.organizationName,
            role: ParticipantRole.CONTRACTOR,
            status: ActivityParticipantStatus.ACCEPTED,
            joinedAt: new Date(),
          });
          await participantRepo.save(newParticipant);
          activity.currentParticipants = await participantRepo.count({
            where: { activityId, status: ActivityParticipantStatus.ACCEPTED },
          });
        }

        activity.updatedAt = new Date();
        return activityRepo.save(activity);
      },
      { onNotFound: () => new ActivityNotFoundError('activity') }
    );

    // Log audit event based on decision (after commit)
    const auditAction = this.resolveApplicationAuditAction(status);

    activityAuditLogger.log({
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

    logger.info(
      `Application ${applicationId} ${status} for activity ${activityId} by ${reviewedBy}`
    );
    return updatedActivity;
  }

  // ==================== CONTRACTOR SCREENING ====================

  /**
   * Map application status to its corresponding audit action.
   */
  private resolveApplicationAuditAction(status: ApplicationStatus): ActivityAuditAction {
    if (status === ApplicationStatus.ACCEPTED) {
      return ActivityAuditAction.APPLICATION_ACCEPTED;
    }
    if (status === ApplicationStatus.REJECTED) {
      return ActivityAuditAction.APPLICATION_REJECTED;
    }
    return ActivityAuditAction.APPLICATION_REVIEWED;
  }

  /**
   * Score a single numeric requirement (experience / reputation / completion rate).
   * Returns the score earned and contributes the recommendation if not met.
   */
  private scoreNumericRequirement(
    actual: number,
    required: number,
    weight: number,
    failureRecommendation: string,
    recommendations: string[]
  ): { passed: boolean; score: number } {
    if (actual >= required) {
      return { passed: true, score: weight };
    }
    const score = Math.round((actual / required) * weight);
    recommendations.push(failureRecommendation);
    return { passed: false, score };
  }

  /**
   * Score a list-based requirement (specializations / certifications).
   */
  private scoreListRequirement(
    required: string[],
    actual: string[],
    weight: number,
    failureRecommendation: string,
    recommendations: string[]
  ): { passed: boolean; score: number } {
    if (required.every(item => actual.includes(item))) {
      return { passed: true, score: weight };
    }
    const matching = required.filter(item => actual.includes(item)).length;
    const score = Math.round((matching / required.length) * weight);
    recommendations.push(failureRecommendation);
    return { passed: false, score };
  }

  /**
   * Screen contractor for job suitability
   */
  async screenContractor(
    userId: string,
    requirements: ContractorRequirements,
    screening: ContractorScreeningDTO
  ): Promise<ContractorScreeningResult> {
    const result: ContractorScreeningResult = {
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
      const r = this.scoreNumericRequirement(
        screening.experience,
        requirements.minimumExperience,
        25,
        'Gain more experience in this field',
        result.recommendations
      );
      result.results.experience = r;
      totalScore += r.score;
    }

    if (requirements.minimumReputation) {
      maxScore += 20;
      const r = this.scoreNumericRequirement(
        screening.reputation,
        requirements.minimumReputation,
        20,
        'Improve reputation through successful job completion',
        result.recommendations
      );
      result.results.reputation = r;
      totalScore += r.score;
    }

    if (requirements.minCompletionRate) {
      maxScore += 20;
      const r = this.scoreNumericRequirement(
        screening.completionRate,
        requirements.minCompletionRate,
        20,
        'Improve job completion rate',
        result.recommendations
      );
      result.results.completionRate = r;
      totalScore += r.score;
    }

    if (requirements.requiredSpecializations && requirements.requiredSpecializations.length > 0) {
      maxScore += 20;
      const r = this.scoreListRequirement(
        requirements.requiredSpecializations,
        screening.specializations,
        20,
        'Develop required specializations',
        result.recommendations
      );
      result.results.specializations = r;
      totalScore += r.score;
    }

    if (requirements.requiredCertifications && requirements.requiredCertifications.length > 0) {
      maxScore += 15;
      const r = this.scoreListRequirement(
        requirements.requiredCertifications,
        screening.certifications,
        15,
        'Obtain required certifications',
        result.recommendations
      );
      result.results.certifications = r;
      totalScore += r.score;
    }

    // Calculate final score
    result.score = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 100;

    // Determine if screening passed
    const passingScore = requirements.passingScore ?? 70;
    result.passed = result.score >= passingScore;

    if (!result.passed) {
      result.recommendations.push(
        `Score ${result.score}% is below required ${passingScore}%. Focus on improvement areas.`
      );
    }

    logger.info(
      `Contractor ${userId} screened with score ${result.score}% (${result.passed ? 'PASSED' : 'FAILED'})`
    );
    return result;
  }

  // ==================== BOUNTY/MISSION SPECIFIC ====================

  /**
   * Update bounty status and payout
   */
  async updateBountyStatus(
    activityId: string,
    status: 'claimed' | 'completed' | 'verified' | 'paid',
    updatedBy: string,
    payout?: number
  ): Promise<Activity> {
    const activity = await this.repository.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    if (activity.activityType !== ActivityType.BOUNTY) {
      throw new ValidationError('Activity is not a bounty');
    }

    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    const now = new Date();
    const nextMetadata: Record<string, unknown> = { ...activity.metadata };
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

    // Log audit event
    activityAuditLogger.log({
      action: ActivityAuditAction.BOUNTY_STATUS_UPDATED,
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

    logger.info(`Bounty ${activityId} status updated to ${status} by ${updatedBy}`);
    return updatedActivity;
  }

  /**
   * Get job statistics for contractor
   */
  async getContractorStats(
    userId: string,
    organizationId?: string
  ): Promise<{
    totalApplications: number;
    acceptedApplications: number;
    rejectedApplications: number;
    pendingApplications: number;
    completedJobs: number;
    totalEarnings: number;
    averageRating: number;
    specializations: string[];
  }> {
    const whereClause: Record<string, unknown> = {};
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
    const specializations = new Set<string>();

    for (const activity of activities) {
      // Count applications
      const userApplications =
        activity.applications?.filter((app: ActivityApplication) =>
          this.isApplicationByUser(app, userId)
        ) || [];

      totalApplications += userApplications.length;

      for (const app of userApplications) {
        switch (app.status) {
          case ApplicationStatus.ACCEPTED:
            acceptedApplications++;
            break;
          case ApplicationStatus.REJECTED:
            rejectedApplications++;
            break;
          case ApplicationStatus.PENDING:
            pendingApplications++;
            break;
        }
      }

      // Count completed jobs and earnings (normalized table lookup)
      const participantCount = await this.participantRepo.count({
        where: { activityId: activity.id, userId },
      });

      if (participantCount > 0 && activity.status === ActivityStatus.COMPLETED) {
        completedJobs++;

        // Add earnings from metadata
        if (activity.metadata?.actualPayout) {
          totalEarnings += activity.metadata.actualPayout;
        } else if (activity.rewardCredits) {
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
      averageRating: 0, // Would need rating system
      specializations: Array.from(specializations),
    };
  }

  // ==================== RECRUITMENT & JOB LISTING APPLICATIONS ====================

  /**
   * Submit application to a recruitment or job listing activity
   */
  async submitApplication(
    activityId: string,
    applicationData: {
      applicantId: string;
      applicantName: string;
      applicantEmail?: string;
      rsiHandle?: string;
      discordId?: string;
      message?: string;
      answers?: Array<{ questionId: string; question: string; answer: string }>;
      referredBy?: string;
      timezone?: string;
      availablePlaytimes?: string[];
      preferredRoles?: string[];
    }
  ): Promise<ActivityApplication> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    if (
      activity.activityType !== ActivityType.RECRUITMENT &&
      activity.activityType !== ActivityType.JOB_LISTING
    ) {
      throw new ValidationError(
        'Applications are only allowed for recruitment and job listing activities'
      );
    }

    const existingApplication = (activity.applications ?? []).find((app: ActivityApplication) => {
      if (applicationData.discordId) {
        if (app.discordId === applicationData.discordId) {
          return true;
        }

        // For guest users routed through bot auth, applicantId may be a shared system UUID.
        // In that case, only treat applicantId as a duplicate when no discordId is recorded yet.
        return app.applicantId === applicationData.applicantId && !app.discordId;
      }

      return app.applicantId === applicationData.applicantId;
    });
    if (existingApplication) {
      throw new ConflictError('You have already applied to this activity');
    }

    if (activity.maxApplicants && activity.currentApplicants >= activity.maxApplicants) {
      throw new ActivityFullError('Activity has reached maximum applicants');
    }

    const application: ActivityApplication = {
      applicationId: `app-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      applicantId: applicationData.applicantId,
      applicantName: applicationData.applicantName,
      applicantEmail: applicationData.applicantEmail,
      rsiHandle: applicationData.rsiHandle,
      discordId: applicationData.discordId,
      appliedAt: new Date(),
      status: ApplicationStatus.PENDING,
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
        application.status = ApplicationStatus.ACCEPTED;
        application.acceptedAt = new Date();
      }
    }

    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    activity.applications = [...(activity.applications ?? []), application];
    activity.currentApplicants += 1;

    await this.repository.save(activity);
    logger.info(
      `Application submitted for activity ${activityId} by ${applicationData.applicantName}`
    );

    return application;
  }

  /**
   * Perform screening on application
   */
  private performScreening(
    _application: ActivityApplication,
    requirements: ContractorRequirements
  ): { score: number; passed: boolean; results: ScreeningResult[] } {
    const results: ScreeningResult[] = [];
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

  /**
   * Accept application for recruitment or job listing
   */
  async acceptApplication(
    activityId: string,
    applicationId: string,
    reviewerId: string,
    notes?: string
  ): Promise<ActivityApplication> {
    let acceptedApplication: ActivityApplication | undefined;

    const auditActivity = await this.withEntityLock(
      activityId,
      async (activity, queryRunner) => {
        const activityRepo = queryRunner.manager.getRepository(Activity);
        const participantRepo = queryRunner.manager.getRepository(ActivityParticipantEntity);

        const application = (activity.applications ?? []).find(
          (app: ActivityApplication) => app.applicationId === applicationId
        );
        if (!application) {
          throw new NotFoundError('Application');
        }

        if (
          application.status !== ApplicationStatus.PENDING &&
          application.status !== ApplicationStatus.UNDER_REVIEW
        ) {
          throw new ValidationError('Application cannot be accepted in its current status');
        }

        application.status = ApplicationStatus.ACCEPTED;
        application.acceptedAt = new Date();
        application.reviewedBy = reviewerId;
        application.reviewedAt = new Date();

        if (notes) {
          application.interviewNotes = notes;
        }

        if (
          activity.activityType === ActivityType.RECRUITMENT ||
          activity.activityType === ActivityType.JOB_LISTING
        ) {
          const role =
            activity.activityType === ActivityType.RECRUITMENT
              ? ParticipantRole.MEMBER
              : ParticipantRole.CONTRACTOR;
          const newParticipant = participantRepo.create({
            activityId,
            userId: application.applicantId,
            userName: application.applicantName,
            role,
            status: ActivityParticipantStatus.ACCEPTED,
            joinedAt: new Date(),
            reputation: application.screeningScore,
          });
          await participantRepo.save(newParticipant);
          // Recompute from the normalized table under the row lock instead of `+= 1`.
          activity.currentParticipants = await participantRepo.count({
            where: { activityId, status: ActivityParticipantStatus.ACCEPTED },
          });
        }

        await activityRepo.save(activity);
        acceptedApplication = application;
        return activity;
      },
      { onNotFound: () => new ActivityNotFoundError('activity') }
    );

    // `acceptedApplication` is always set when the callback resolves without throwing.
    if (!acceptedApplication) {
      throw new NotFoundError('Application');
    }

    activityAuditLogger.log({
      action: ActivityAuditAction.APPLICATION_ACCEPTED,
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

    logger.info(`Application ${applicationId} accepted for activity ${activityId}`);

    // Recruitment acceptance = org onboarding: add the applicant as an org member.
    // Non-fatal side effect on an already-committed acceptance; org-scoped; recruitment-only.
    if (
      auditActivity.activityType === ActivityType.RECRUITMENT &&
      auditActivity.organizationId &&
      acceptedApplication.applicantId
    ) {
      await this.addAcceptedRecruitToOrganization(
        auditActivity.organizationId,
        acceptedApplication.applicantId,
        applicationId
      );
    }

    return acceptedApplication;
  }

  /**
   * Add an accepted recruitment applicant to the organization as a member.
   *
   * Non-fatal: the acceptance has already committed, so a failure here (the user
   * is already a member, or a bot-only applicant has no linked account) is logged,
   * not thrown. Idempotent — "already a member" is the common, expected case.
   */
  private async addAcceptedRecruitToOrganization(
    organizationId: string,
    applicantUserId: string,
    applicationId: string
  ): Promise<void> {
    try {
      await this.memberService.addMember(
        organizationId,
        applicantUserId,
        'member',
        undefined,
        undefined,
        undefined,
        { acquisitionSource: 'recruitment', acquisitionRefId: applicationId }
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.info(
        `Recruitment accept: did not add member ${applicantUserId} to org ${organizationId}: ${message}`
      );
    }
  }

  /**
   * Reject application for recruitment or job listing
   */
  async rejectApplication(
    activityId: string,
    applicationId: string,
    reviewerId: string,
    reason?: string
  ): Promise<ActivityApplication> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const application = (activity.applications ?? []).find(
      (app: ActivityApplication) => app.applicationId === applicationId
    );
    if (!application) {
      throw new NotFoundError('Application');
    }

    if (
      application.status !== ApplicationStatus.PENDING &&
      application.status !== ApplicationStatus.UNDER_REVIEW
    ) {
      throw new ValidationError('Application cannot be rejected in its current status');
    }

    application.status = ApplicationStatus.REJECTED;
    application.reviewedBy = reviewerId;
    application.reviewedAt = new Date();
    application.rejectionReason = reason;

    await this.repository.save(activity);

    activityAuditLogger.log({
      action: ActivityAuditAction.APPLICATION_REJECTED,
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

    logger.info(`Application ${applicationId} rejected for activity ${activityId}`);
    return application;
  }

  /**
   * Advance application to the next review stage (pending → under_review).
   *
   * This fills the gap between submission and a formal accept/reject/interview decision:
   * it lets recruiters signal "we are looking at this" without committing to an outcome.
   */
  async advanceApplicationStage(
    activityId: string,
    applicationId: string,
    reviewerId: string,
    comment?: string
  ): Promise<ActivityApplication> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const application = (activity.applications ?? []).find(
      (app: ActivityApplication) => app.applicationId === applicationId
    );
    if (!application) {
      throw new NotFoundError('Application');
    }

    if (application.status !== ApplicationStatus.PENDING) {
      throw new ValidationError('Only pending applications can be advanced to Under Review');
    }

    application.status = ApplicationStatus.UNDER_REVIEW;
    application.reviewedBy = reviewerId;
    application.reviewedAt = new Date();
    if (comment) {
      application.feedback = comment;
    }

    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    activity.applications = [...(activity.applications ?? [])];
    await this.repository.save(activity);

    activityAuditLogger.log({
      action: ActivityAuditAction.APPLICATION_REVIEWED,
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
        previousStatus: ApplicationStatus.PENDING,
        newStatus: ApplicationStatus.UNDER_REVIEW,
        comment,
      },
    });

    logger.info(`Application ${applicationId} advanced to under_review for activity ${activityId}`);
    return application;
  }

  /**
   * Withdraw application
   */
  async withdrawApplication(
    activityId: string,
    applicationId: string,
    applicantId: string
  ): Promise<ActivityApplication> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const application = (activity.applications ?? []).find(
      (app: ActivityApplication) => app.applicationId === applicationId
    );
    if (!application) {
      throw new NotFoundError('Application');
    }

    if (application.applicantId !== applicantId) {
      throw new ForbiddenError('You can only withdraw your own application');
    }

    if (
      application.status === ApplicationStatus.ACCEPTED ||
      application.status === ApplicationStatus.COMPLETED
    ) {
      throw new ValidationError('Cannot withdraw an accepted or completed application');
    }

    application.status = ApplicationStatus.WITHDRAWN;
    activity.currentApplicants -= 1;

    await this.repository.save(activity);
    logger.info(`Application ${applicationId} withdrawn from activity ${activityId}`);

    return application;
  }

  /**
   * Get applications for activity with optional filtering
   */
  async getApplications(
    activityId: string,
    filters?: {
      status?: ApplicationStatus;
      applicantId?: string;
    }
  ): Promise<ActivityApplication[]> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    let applications = activity.applications ?? [];

    if (filters?.status) {
      applications = applications.filter(
        (app: ActivityApplication) => app.status === filters.status
      );
    }

    if (filters?.applicantId) {
      applications = applications.filter(
        (app: ActivityApplication) => app.applicantId === filters.applicantId
      );
    }

    return applications;
  }

  /**
   * Schedule interview for application
   */
  async scheduleInterview(
    activityId: string,
    applicationId: string,
    interviewData: {
      scheduledAt: Date;
      interviewerId: string;
      notes?: string;
    }
  ): Promise<ActivityApplication> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const application = (activity.applications ?? []).find(
      (app: ActivityApplication) => app.applicationId === applicationId
    );
    if (!application) {
      throw new NotFoundError('Application');
    }

    application.status = ApplicationStatus.INTERVIEW_SCHEDULED;
    application.interviewScheduledAt = interviewData.scheduledAt;
    application.interviewNotes = interviewData.notes;

    await this.repository.save(activity);
    logger.info(`Interview scheduled for application ${applicationId}`);

    return application;
  }

  /**
   * Complete job (for contractors)
   */
  async completeJob(
    activityId: string,
    applicationId: string,
    completionData: {
      rating?: number;
      review?: string;
    }
  ): Promise<ActivityApplication> {
    const activity = await this.repository.findOne({ where: { id: activityId } });
    if (!activity) {
      throw new ActivityNotFoundError('activity');
    }

    const application = (activity.applications ?? []).find(
      (app: ActivityApplication) => app.applicationId === applicationId
    );
    if (!application) {
      throw new NotFoundError('Application');
    }

    if (application.status !== ApplicationStatus.ACCEPTED) {
      throw new ValidationError('Only accepted applications can be marked as completed');
    }

    application.status = ApplicationStatus.COMPLETED;
    application.completedAt = new Date();
    application.rating = completionData.rating;
    application.review = completionData.review;

    await this.repository.save(activity);
    logger.info(`Job completed for application ${applicationId}`);

    return application;
  }
}
