import type {
  ApplicationMode,
  ApplicationModeResponse,
  ApplicationSource,
} from '@sc-fleet-manager/shared-types';
import { In, Not, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  ApplicantType,
  ApplicationTargetType,
  OrgApplication,
  OrgApplicationStatus,
} from '../../models/OrgApplication';
import { OrgWatchlistEntry } from '../../models/OrgWatchlistEntry';
import { PublicOrgProfile } from '../../models/PublicOrgProfile';
import { User } from '../../models/User';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { APPLICATION_TRANSITIONS, MembershipWorkflow } from '../shared/MembershipWorkflow';

import { membershipAuditLogger } from './MembershipAuditLogger';
import { OrganizationMemberService } from './OrganizationMemberService';

// ── Status Constants ────────────────────────────────────────────────

/**
 * Terminal (closed) statuses. Applications in these statuses are
 * excluded from the duplicate-check, so a user may re-apply.
 */
export const TERMINAL_STATUSES = [
  OrgApplicationStatus.APPROVED,
  OrgApplicationStatus.REJECTED,
  OrgApplicationStatus.WITHDRAWN,
];

// ── Service ─────────────────────────────────────────────────────────

export class OrgApplicationService {
  private readonly applicationRepository: Repository<OrgApplication>;
  private readonly organizationRepository: Repository<Organization>;
  private readonly profileRepository: Repository<PublicOrgProfile>;
  private readonly membershipRepository: Repository<OrganizationMembership>;
  private readonly watchlistRepository: Repository<OrgWatchlistEntry>;
  private readonly userRepository: Repository<User>;
  private readonly memberService: OrganizationMemberService;

  constructor() {
    this.applicationRepository = AppDataSource.getRepository(OrgApplication);
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.profileRepository = AppDataSource.getRepository(PublicOrgProfile);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.watchlistRepository = AppDataSource.getRepository(OrgWatchlistEntry);
    this.userRepository = AppDataSource.getRepository(User);
    this.memberService = new OrganizationMemberService();
  }

  // ────────────────────── Application Mode ────────────────────────

  /**
   * Determine the application mode for an organization.
   *
   * Priority:
   *   1. Discord mode: discordRecruitment enabled AND guild connected
   *   2. Custom form: applicationQuestions defined
   *   3. Simple: default message-only
   */
  async getApplicationMode(orgId: string): Promise<ApplicationModeResponse> {
    const org = await this.organizationRepository.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const settings = org.settings;

    // Discord mode check
    const rawDiscordRecruitment = settings?.customFields?.discordRecruitment;
    const discordRecruitment =
      typeof rawDiscordRecruitment === 'object' &&
      rawDiscordRecruitment !== null &&
      'enabled' in rawDiscordRecruitment
        ? (rawDiscordRecruitment as { enabled?: boolean })
        : undefined;
    // Collect questions regardless of mode — downstream consumers (e.g. RecruitmentApplyDialog)
    // may need them even when discord mode is primary.
    const questions =
      settings?.applicationQuestions && settings.applicationQuestions.length > 0
        ? settings.applicationQuestions
        : undefined;

    if (discordRecruitment?.enabled && org.metadata?.discordGuildId) {
      // Attempt to get the Discord invite URL from the public profile
      const profile = await this.profileRepository.findOne({
        where: { organizationId: orgId },
      });
      return {
        mode: 'discord' as ApplicationMode,
        discordInviteUrl: profile?.discordInvite ?? undefined,
        questions,
      };
    }

    // Custom form mode check
    if (questions) {
      return {
        mode: 'custom' as ApplicationMode,
        questions,
      };
    }

    // Simple mode (default)
    return { mode: 'simple' as ApplicationMode };
  }

  // ────────────────────── Watchlist Check ──────────────────────────

  /**
   * Check if a user's RSI handle is on the org's watchlist.
   * Throws ForbiddenError if the user is flagged.
   */
  async checkWatchlist(orgId: string, userId: string): Promise<void> {
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
        throw new ForbiddenError('You are unable to apply to this organization at this time');
      }
    }
  }

  // ────────────────────── Form Validation ─────────────────────────

  /**
   * Validate and sanitize formResponses against the org's configured questions.
   * - Throws ValidationError if required questions are unanswered
   * - Filters out response keys that don't match configured question IDs
   */
  private validateFormResponses(
    questions: NonNullable<Organization['settings']>['applicationQuestions'],
    formResponses?: Record<string, string>
  ): Record<string, string> | undefined {
    if (!questions || questions.length === 0) {
      return formResponses;
    }

    const responses = formResponses ?? {};
    for (const question of questions) {
      if (question.required && !responses[question.id]?.trim()) {
        throw new ValidationError(`Required question not answered: ${question.label}`);
      }
    }
    // Filter to only valid question IDs to prevent arbitrary data injection
    const validIds = new Set(questions.map(q => q.id));
    return Object.fromEntries(Object.entries(responses).filter(([key]) => validIds.has(key)));
  }

  // ────────────────────── Apply ──────────────────────────────────

  /**
   * Submit an application to join an organization.
   *
   * Rules:
   *  - Organization must exist and be recruiting (PublicOrgProfile.isRecruiting)
   *  - User cannot already be an active member
   *  - User cannot have a non-terminal application (duplicate check)
   *  - If org.settings.requireApproval === false → auto-approve + addMember()
   *  - Otherwise → create PENDING application
   *  - If custom form mode, validates formResponses against required questions
   */
  async apply(
    orgId: string,
    userId: string,
    message?: string,
    formResponses?: Record<string, string>,
    source?: ApplicationSource
  ): Promise<OrgApplication> {
    // Validate org exists
    const org = await this.organizationRepository.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    // Check isRecruiting
    const profile = await this.profileRepository.findOne({
      where: { organizationId: orgId },
    });
    if (!profile?.isRecruiting) {
      throw new ValidationError('This organization is not currently recruiting');
    }

    // Check already a member
    const existingMember = await this.membershipRepository.findOne({
      where: { organizationId: orgId, userId, isActive: true },
    });
    if (existingMember) {
      throw new ConflictError('You are already a member of this organization');
    }

    // Check org watchlist — block applicants whose RSI handle is flagged
    await this.checkWatchlist(orgId, userId);

    // Duplicate-check: same user, same org, non-terminal status
    const existing = await this.applicationRepository.findOne({
      where: {
        organizationId: orgId,
        applicantUserId: userId,
        status: Not(In(TERMINAL_STATUSES)),
      },
    });
    if (existing) {
      throw new ConflictError('You already have an active application for this organization');
    }

    // Validate and sanitize formResponses against configured questions
    const sanitizedResponses = this.validateFormResponses(
      org.settings?.applicationQuestions,
      formResponses
    );

    // Auto-approve if org doesn't require approval
    const autoApprove = org.settings?.requireApproval === false;

    let saved: OrgApplication;

    if (autoApprove) {
      // Use transaction to ensure atomicity of member creation and application approval
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Add member first to avoid a window where the app is APPROVED but the user isn't a member
        await this.memberService.addMember(
          orgId,
          userId,
          'member',
          undefined,
          undefined,
          queryRunner.manager,
          { acquisitionSource: 'application' }
        );

        const app = this.applicationRepository.create({
          organizationId: orgId,
          applicantUserId: userId,
          targetType: ApplicationTargetType.ORGANIZATION,
          applicantType: ApplicantType.USER,
          message: message ?? undefined,
          formResponses: sanitizedResponses ?? undefined,
          source: source ?? 'web',
          status: OrgApplicationStatus.APPROVED,
          reviewedAt: new Date(),
        });
        saved = await queryRunner.manager.save(app);

        await queryRunner.commitTransaction();
      } catch (error: unknown) {
        await queryRunner.rollbackTransaction();
        logger.error('Failed to auto-approve application', {
          organizationId: orgId,
          userId,
          error,
        });
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      const app = this.applicationRepository.create({
        organizationId: orgId,
        applicantUserId: userId,
        targetType: ApplicationTargetType.ORGANIZATION,
        applicantType: ApplicantType.USER,
        message: message ?? undefined,
        formResponses: sanitizedResponses ?? undefined,
        source: source ?? 'web',
        status: OrgApplicationStatus.PENDING,
      });
      saved = await this.applicationRepository.save(app);
    }

    logger.info(`Org application submitted: ${saved.id}`, {
      organizationId: orgId,
      applicantUserId: userId,
      status: saved.status,
      autoApproved: autoApprove,
    });

    return saved;
  }

  // ────────────────────── Review (approve / reject) ─────────────

  /**
   * Review (approve/reject) a pending application.
   * - Validates transition via MembershipWorkflow
   * - On APPROVED: calls OrganizationMemberService.addMember()
   * - Sets reviewedBy, reviewNote, reviewedAt
   */
  async reviewApplication(
    appId: string,
    orgId: string,
    reviewerId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ): Promise<OrgApplication> {
    const app = await this.applicationRepository.findOne({
      where: { id: appId, organizationId: orgId },
    });
    if (!app) {
      throw new NotFoundError('Application not found');
    }

    // Validate transition
    MembershipWorkflow.validateTransition(APPLICATION_TRANSITIONS, app.status, decision, 'admin');

    app.reviewedBy = reviewerId;
    app.reviewNote = note ?? undefined;
    app.reviewedAt = new Date();

    if (decision === 'approved') {
      app.status = OrgApplicationStatus.APPROVED;

      // Use transaction to ensure atomicity of member creation and application approval
      const queryRunner = AppDataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await this.memberService.addMember(
          orgId,
          app.applicantUserId,
          'member',
          undefined,
          undefined,
          queryRunner.manager,
          { acquisitionSource: 'application', acquisitionRefId: appId }
        );
        const saved = await queryRunner.manager.save(app);
        await queryRunner.commitTransaction();

        logger.info(`Org application ${appId} reviewed: ${decision}`, {
          organizationId: orgId,
          reviewedBy: reviewerId,
        });

        membershipAuditLogger.logApplicationReviewed(
          appId,
          app.applicantUserId,
          orgId,
          reviewerId,
          'approved'
        );

        return saved;
      } catch (error: unknown) {
        await queryRunner.rollbackTransaction();
        logger.error(`Failed to add member while approving application ${appId}`, {
          organizationId: orgId,
          reviewerId,
          error,
        });
        throw error;
      } finally {
        await queryRunner.release();
      }
    } else {
      app.status = OrgApplicationStatus.REJECTED;
    }

    const saved = await this.applicationRepository.save(app);

    logger.info(`Org application ${appId} reviewed: ${decision}`, {
      organizationId: orgId,
      reviewedBy: reviewerId,
    });

    membershipAuditLogger.logApplicationReviewed(
      appId,
      app.applicantUserId,
      orgId,
      reviewerId,
      'rejected'
    );

    return saved;
  }

  // ────────────────────── Withdraw ──────────────────────────────

  /**
   * Withdraw own pending application.
   * - Validates caller is the applicant
   * - Validates transition via MembershipWorkflow
   */
  async withdrawApplication(appId: string, userId: string): Promise<OrgApplication> {
    const app = await this.applicationRepository.findOne({
      where: { id: appId },
    });
    if (!app) {
      throw new NotFoundError('Application not found');
    }

    if (app.applicantUserId !== userId) {
      throw new ForbiddenError('You can only withdraw your own application');
    }

    // Validate transition
    MembershipWorkflow.validateTransition(
      APPLICATION_TRANSITIONS,
      app.status,
      'withdrawn',
      'member'
    );

    app.status = OrgApplicationStatus.WITHDRAWN;

    const saved = await this.applicationRepository.save(app);

    logger.info(`Org application ${appId} withdrawn by applicant`, {
      applicantUserId: userId,
    });

    return saved;
  }

  // ────────────────────── Queries ───────────────────────────────

  /**
   * Get paginated applications for an org (admin view).
   * Supports status filter.
   */
  async getApplicationsForOrg(
    orgId: string,
    options?: { status?: OrgApplicationStatus; page?: number; limit?: number }
  ): Promise<{
    data: OrgApplication[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options?.page ?? 1;
    const limit = Math.min(options?.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId: orgId,
      targetType: ApplicationTargetType.ORGANIZATION,
      applicantType: ApplicantType.USER,
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

    // NOSONAR — PII stripping uses spread + whitelist pattern; acceptable for this scope
    // Strip PII from applicant relation — only expose id + username
    const data = rawData.map(app => ({
      ...app,
      applicant: app.applicant
        ? ({ id: app.applicant.id, username: app.applicant.username } as typeof app.applicant)
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

  /** Application with minimal org info for user-facing responses. */
  private static toUserView(
    app: OrgApplication
  ): Omit<OrgApplication, 'organization'> & { organization?: { id: string; name: string } } {
    const { organization, ...rest } = app;
    return {
      ...rest,
      organization: organization ? { id: organization.id, name: organization.name } : undefined,
    };
  }

  /**
   * Get the authenticated user's own applications.
   * Returns applications with minimal org info (PII-safe).
   */
  async getMyApplications(
    userId: string
  ): Promise<
    Array<Omit<OrgApplication, 'organization'> & { organization?: { id: string; name: string } }>
  > {
    const applications = await this.applicationRepository.find({
      where: { applicantUserId: userId },
      order: { createdAt: 'DESC' },
      relations: ['organization'],
    });

    // Strip internal org fields — only expose id + name (PII-safe)
    return applications.map(OrgApplicationService.toUserView);
  }

  /**
   * Check if user has a non-terminal application for an org.
   */
  async hasActiveApplication(orgId: string, userId: string): Promise<boolean> {
    const count = await this.applicationRepository.count({
      where: {
        organizationId: orgId,
        applicantUserId: userId,
        status: Not(In(TERMINAL_STATUSES)),
      },
    });
    return count > 0;
  }

  /**
   * Check if user is an active member of the organization.
   */
  async isMember(orgId: string, userId: string): Promise<boolean> {
    const count = await this.membershipRepository.count({
      where: { organizationId: orgId, userId, isActive: true },
    });
    return count > 0;
  }
}

