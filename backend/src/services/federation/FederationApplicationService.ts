import type {
  ApplicationQuestion,
  FederationApplicationMode,
} from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Federation } from '../../models/Federation';
import { FederationMember } from '../../models/FederationMember';
import {
  ApplicantType,
  ApplicationTargetType,
  OrgApplication,
  OrgApplicationStatus,
} from '../../models/OrgApplication';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

import { FederationAmbassadorService } from './FederationAmbassadorService';
import { requireFederationPermission } from './federationPermissions';

// ─── Types ────────────────────────────────────────────────────

export interface FederationApplicationModeResponse {
  mode: FederationApplicationMode;
  questions?: ApplicationQuestion[];
}

export interface FederationApplicationData {
  id: string;
  federationId: string;
  applicantOrgId: string;
  applicantOrgName: string;
  applicantUserId: string;
  message: string | null;
  formResponses: Record<string, string> | null;
  source: string | null;
  status: string;
  reviewedBy: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

// ─── Service ──────────────────────────────────────────────────

/**
 * FederationApplicationService
 *
 * Manages org-to-federation membership applications using the existing
 * OrgApplication entity with targetType='federation' and applicantType='organization'.
 *
 * Reuses the adaptive application question system from org settings.
 */
export class FederationApplicationService {
  private static instance: FederationApplicationService;
  private readonly applicationRepository: Repository<OrgApplication>;
  private readonly federationRepository: Repository<Federation>;
  private readonly memberRepository: Repository<FederationMember>;
  private readonly ambassadorService: FederationAmbassadorService;

  constructor() {
    this.applicationRepository = AppDataSource.getRepository(OrgApplication);
    this.federationRepository = AppDataSource.getRepository(Federation);
    this.memberRepository = AppDataSource.getRepository(FederationMember);
    this.ambassadorService = FederationAmbassadorService.getInstance();
  }

  public static getInstance(): FederationApplicationService {
    if (!FederationApplicationService.instance) {
      FederationApplicationService.instance = new FederationApplicationService();
    }
    return FederationApplicationService.instance;
  }

  // ─── Helpers ───────────────────────────────────────────────

  private toData(app: OrgApplication): FederationApplicationData {
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

  // ─── Application Mode ─────────────────────────────────────

  /**
   * Determine the application mode for a federation (public endpoint).
   */
  async getApplicationMode(federationId: string): Promise<FederationApplicationModeResponse> {
    const federation = await this.federationRepository.findOne({
      where: { id: federationId },
    });
    if (!federation) {
      throw new NotFoundError('Federation', federationId);
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

  // ─── Submit Application ───────────────────────────────────

  /**
   * Submit an application to join a federation on behalf of an organization.
   */
  async applyToFederation(
    federationId: string,
    applicantUserId: string,
    applicantOrgId: string,
    applicantOrgName: string,
    data: {
      message?: string;
      formResponses?: Record<string, string>;
      source?: string;
    }
  ): Promise<FederationApplicationData> {
    // 1. Verify federation exists and accepts applications
    const modeResponse = await this.getApplicationMode(federationId);
    if (modeResponse.mode === 'disabled') {
      throw new ForbiddenError('This federation does not accept applications');
    }

    // 2. Check for existing membership
    const existingMember = await this.memberRepository.findOne({
      where: { federationId, organizationId: applicantOrgId },
    });
    if (existingMember) {
      throw new ConflictError('Your organization is already a member of this federation');
    }

    // 3. Check for duplicate pending application
    const existingApp = await this.applicationRepository.findOne({
      where: {
        organizationId: federationId,
        applicantOrgId,
        targetType: ApplicationTargetType.FEDERATION,
        status: OrgApplicationStatus.PENDING,
      },
    });
    if (existingApp) {
      throw new ConflictError(
        'Your organization already has a pending application to this federation'
      );
    }

    // 4. Validate form responses if custom mode
    let sanitizedFormResponses = data.formResponses;
    if (modeResponse.mode === 'custom' && modeResponse.questions) {
      sanitizedFormResponses = this.validateFormResponses(
        data.formResponses ?? {},
        modeResponse.questions
      );
    }

    // 5. Create application
    const application = this.applicationRepository.create({
      organizationId: federationId,
      applicantUserId,
      applicantOrgId,
      applicantOrgName,
      targetType: ApplicationTargetType.FEDERATION,
      applicantType: ApplicantType.ORGANIZATION,
      message: data.message?.trim() || undefined,
      formResponses: sanitizedFormResponses,
      source: (data.source as 'web' | 'discord' | 'api') ?? 'web',
      status: OrgApplicationStatus.PENDING,
    });

    const saved = await this.applicationRepository.save(application);

    logger.info('Federation application submitted', {
      federationId,
      applicantOrgId,
      applicationId: saved.id,
    });

    return this.toData(saved);
  }

  // ─── List Applications ────────────────────────────────────

  /**
   * List applications for a federation (requires settings permission).
   */
  async listApplications(
    federationId: string,
    userId: string,
    filters?: { status?: string }
  ): Promise<FederationApplicationData[]> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'settings',
      'Ambassador settings permission required to view federation applications'
    );

    const where: Record<string, unknown> = {
      organizationId: federationId,
      targetType: ApplicationTargetType.FEDERATION,
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

  // ─── Review Application ───────────────────────────────────

  /**
   * Review (approve/reject) a federation application.
   * If approved, atomically creates a FederationMember.
   */
  async reviewApplication(
    federationId: string,
    applicationId: string,
    reviewerUserId: string,
    decision: 'approved' | 'rejected',
    note?: string
  ): Promise<FederationApplicationData> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      reviewerUserId,
      'settings',
      'Ambassador settings permission required to review federation applications'
    );

    const application = await this.applicationRepository.findOne({
      where: {
        id: applicationId,
        organizationId: federationId,
        targetType: ApplicationTargetType.FEDERATION,
      },
    });
    if (!application) {
      throw new NotFoundError('Application', applicationId);
    }
    if (application.status !== OrgApplicationStatus.PENDING) {
      throw new ValidationError('Only pending applications can be reviewed');
    }

    // Update application status
    application.status =
      decision === 'approved' ? OrgApplicationStatus.APPROVED : OrgApplicationStatus.REJECTED;
    application.reviewedBy = reviewerUserId;
    application.reviewNote = note ?? undefined;
    application.reviewedAt = new Date();

    const saved = await this.applicationRepository.save(application);

    // If approved, create federation member atomically
    if (decision === 'approved' && application.applicantOrgId) {
      const member = this.memberRepository.create({
        federationId,
        organizationId: application.applicantOrgId,
        organizationName: application.applicantOrgName ?? 'Unknown',
        role: 'member' as const,
        status: 'active' as const,
        votingPower: 1,
        contributions: 0,
      });
      await this.memberRepository.save(member);

      logger.info('Federation application approved — member created', {
        federationId,
        applicationId,
        newMemberOrgId: application.applicantOrgId,
      });
    } else {
      logger.info('Federation application rejected', {
        federationId,
        applicationId,
      });
    }

    return this.toData(saved);
  }

  // ─── Withdraw Application ─────────────────────────────────

  /**
   * Withdraw a pending application (by the applicant org's user).
   */
  async withdrawApplication(
    federationId: string,
    applicationId: string,
    userId: string
  ): Promise<void> {
    const application = await this.applicationRepository.findOne({
      where: {
        id: applicationId,
        organizationId: federationId,
        targetType: ApplicationTargetType.FEDERATION,
        applicantUserId: userId,
      },
    });
    if (!application) {
      throw new NotFoundError('Application', applicationId);
    }
    if (application.status !== OrgApplicationStatus.PENDING) {
      throw new ValidationError('Only pending applications can be withdrawn');
    }

    application.status = OrgApplicationStatus.WITHDRAWN;
    await this.applicationRepository.save(application);

    logger.info('Federation application withdrawn', {
      federationId,
      applicationId,
      userId,
    });
  }

  // ─── Validation ────────────────────────────────────────────

  private validateFormResponses(
    responses: Record<string, string>,
    questions: ApplicationQuestion[]
  ): Record<string, string> {
    // Check required questions
    for (const q of questions) {
      if (q.required && !responses[q.id]?.trim()) {
        throw new ValidationError(`Question "${q.label}" is required`);
      }
    }

    // Return filtered copy — only configured question IDs (prevents data injection)
    const validIds = new Set(questions.map(q => q.id));
    return Object.fromEntries(Object.entries(responses).filter(([key]) => validIds.has(key)));
  }
}

