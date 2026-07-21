import { SystemRole, type ParticipantInfo } from '@sc-fleet-manager/shared-types';
import { In, Not, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  JobApplication,
  JobApplicationStatus,
  JobApplicationType,
} from '../../models/JobApplication';
import { PublicJobListing } from '../../models/PublicJobListing';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

// ── Status Constants ────────────────────────────────────────────────
/**
 * Terminal (closed) statuses for a given application. Applications in these
 * statuses are treated as finished and are excluded from the duplicate-check,
 * so a user may submit a new application after reaching one of them.
 */
export const TERMINAL_STATUSES = [JobApplicationStatus.REJECTED, JobApplicationStatus.WITHDRAWN];

/**
 * Non-terminal statuses: application is still active/in-progress and is
 * considered when checking for duplicate active applications.
 */
export const NON_TERMINAL_STATUSES = [
  JobApplicationStatus.PENDING,
  JobApplicationStatus.WAITLISTED,
  JobApplicationStatus.APPROVED,
];

// ── DTOs ────────────────────────────────────────────────────────────

export interface ApplyToJobInput {
  jobListingId: string;
  applicantUserId: string;
  applicantDisplayName: string;
  applicationType: JobApplicationType;
  message?: string;
  /** crew-specific */
  shipIndex?: number;
  roleIndex?: number;
  /** passenger-specific */
  passengerShipIndex?: number;
  passengerRole?: string;
  /** vehicle-specific */
  vehicleName?: string;
  /** org application form responses (questionId → answer) */
  formResponses?: Record<string, string>;
}

export interface ReviewApplicationInput {
  status:
    | JobApplicationStatus.APPROVED
    | JobApplicationStatus.REJECTED
    | JobApplicationStatus.WAITLISTED;
  reviewedBy: string;
  reviewNote?: string;
  /** Used to verify the application belongs to the expected listing */
  jobListingId?: string;
}

// ── Service ─────────────────────────────────────────────────────────

export class JobApplicationService {
  private readonly applicationRepository: Repository<JobApplication>;
  private readonly jobRepository: Repository<PublicJobListing>;

  constructor() {
    this.applicationRepository = AppDataSource.getRepository(JobApplication);
    this.jobRepository = AppDataSource.getRepository(PublicJobListing);
  }

  // ────────────────────────── Apply ──────────────────────────────

  /**
   * Submit an application to a job listing.
   *
   * Rules:
   *  - Listing must be active & not expired
   *  - User cannot apply twice to the same listing (same type+slot)
   *  - For CREW type: validates ship/role indices exist and slot is open
   *  - For PASSENGER type: validates ship index & capacity
   *  - Auto-approve mode: immediately fills the slot and returns approved status
   *  - If listing is full → auto-waitlist
   */
  async apply(input: ApplyToJobInput): Promise<JobApplication> {
    const job = await this.jobRepository.findOne({ where: { id: input.jobListingId } });
    if (!job) {
      throw new NotFoundError('Job listing');
    }
    if (!job.isActive) {
      throw new ConflictError('Job listing is no longer active');
    }
    if (job.expiresAt && new Date() > job.expiresAt) {
      throw new ConflictError('Job listing has expired');
    }

    // Duplicate-check: same user, same listing, non-terminal status
    // Terminal statuses are: REJECTED, WITHDRAWN
    // Non-terminal statuses are: PENDING, WAITLISTED, APPROVED
    const existing = await this.applicationRepository.findOne({
      where: {
        jobListingId: input.jobListingId,
        applicantUserId: input.applicantUserId,
        status: Not(In(TERMINAL_STATUSES)),
      },
    });
    if (existing) {
      throw new ConflictError('You already have an active application for this listing');
    }

    // Build application
    const app = this.applicationRepository.create({
      jobListingId: input.jobListingId,
      applicantUserId: input.applicantUserId,
      applicantDisplayName: input.applicantDisplayName,
      applicationType: input.applicationType,
      message: input.message,
      formResponses: input.formResponses,
      status: JobApplicationStatus.PENDING,
    });

    // Type-specific validation & field population
    switch (input.applicationType) {
      case JobApplicationType.CREW:
        this.populateCrewFields(app, job, input);
        break;
      case JobApplicationType.PASSENGER:
        this.populatePassengerFields(app, job, input);
        break;
      case JobApplicationType.VEHICLE:
        if (!input.vehicleName) {
          throw new ValidationError('vehicleName is required for vehicle applications');
        }
        app.vehicleName = input.vehicleName;
        break;
      case JobApplicationType.GENERAL:
        // No extra validation
        break;
    }

    // Determine if listing is full → auto-waitlist (only for capped listings)
    if (this.isListingFull(job) && input.applicationType !== JobApplicationType.VEHICLE) {
      app.status = JobApplicationStatus.WAITLISTED;
      app.waitlistPosition = await this.getNextWaitlistPosition(input.jobListingId);
    }

    const saved = await this.applicationRepository.save(app);

    logger.info(`Job application submitted: ${saved.id}`, {
      jobListingId: input.jobListingId,
      applicantUserId: input.applicantUserId,
      type: input.applicationType,
      status: saved.status,
    });

    return saved;
  }

  // ────────────────────── Review (approve / reject / waitlist) ───

  async reviewApplication(
    applicationId: string,
    input: ReviewApplicationInput
  ): Promise<JobApplication> {
    const app = await this.applicationRepository.findOne({
      where: { id: applicationId },
      relations: ['jobListing'],
    });
    if (!app) {
      throw new NotFoundError('Application', applicationId);
    }

    // Verify the application belongs to the expected job listing
    if (input.jobListingId && app.jobListingId !== input.jobListingId) {
      throw new ValidationError('Application does not belong to this job listing');
    }

    // Only pending or waitlisted applications can be reviewed
    if (
      app.status !== JobApplicationStatus.PENDING &&
      app.status !== JobApplicationStatus.WAITLISTED
    ) {
      throw new ValidationError(`Cannot review an application in "${app.status}" status`);
    }

    app.status = input.status;
    app.reviewedBy = input.reviewedBy;
    app.reviewNote = input.reviewNote ?? undefined;
    app.reviewedAt = new Date();

    // If approved → fill the slot on the listing
    if (input.status === JobApplicationStatus.APPROVED && app.jobListing) {
      await this.fillSlot(app, app.jobListing);
    }

    // If waitlisted → assign next position
    if (input.status === JobApplicationStatus.WAITLISTED && !app.waitlistPosition) {
      app.waitlistPosition = await this.getNextWaitlistPosition(app.jobListingId);
    }

    const saved = await this.applicationRepository.save(app);

    logger.info(`Application ${applicationId} reviewed: ${input.status}`, {
      reviewedBy: input.reviewedBy,
    });

    return saved;
  }

  // ────────────────────── Withdraw ──────────────────────────────

  async withdrawApplication(applicationId: string, userId: string): Promise<JobApplication> {
    const app = await this.applicationRepository.findOne({ where: { id: applicationId } });
    if (!app) {
      throw new NotFoundError('Application', applicationId);
    }
    if (app.applicantUserId !== userId) {
      throw new ForbiddenError('You can only withdraw your own application');
    }
    if (
      app.status === JobApplicationStatus.APPROVED ||
      app.status === JobApplicationStatus.WITHDRAWN
    ) {
      throw new ConflictError(`Cannot withdraw an application in "${app.status}" status`);
    }

    app.status = JobApplicationStatus.WITHDRAWN;
    const saved = await this.applicationRepository.save(app);

    logger.info(`Application ${applicationId} withdrawn by ${userId}`);
    return saved;
  }

  // ────────────────────── Queries ────────────────────────────────

  /** All applications for a listing (for the listing owner) */
  async getApplicationsForJob(
    jobListingId: string,
    status?: JobApplicationStatus
  ): Promise<JobApplication[]> {
    const where: Record<string, unknown> = { jobListingId };
    if (status) {
      where.status = status;
    }
    return this.applicationRepository.find({
      where,
      order: { createdAt: 'ASC' },
    });
  }

  /** All applications by a user */
  async getApplicationsByUser(userId: string): Promise<JobApplication[]> {
    return this.applicationRepository.find({
      where: { applicantUserId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Check if a user already applied to a listing (any non-withdrawn status) */
  async hasUserApplied(userId: string, jobListingId: string): Promise<JobApplication | null> {
    return this.applicationRepository
      .createQueryBuilder('app')
      .where('app.applicantUserId = :userId', { userId })
      .andWhere('app.jobListingId = :jobListingId', { jobListingId })
      .andWhere('app.status NOT IN (:...terminal)', {
        terminal: [JobApplicationStatus.REJECTED, JobApplicationStatus.WITHDRAWN],
      })
      .getOne();
  }

  /** Waitlist for a listing, ordered by position */
  async getWaitlist(jobListingId: string): Promise<JobApplication[]> {
    return this.applicationRepository.find({
      where: { jobListingId, status: JobApplicationStatus.WAITLISTED },
      order: { waitlistPosition: 'ASC' },
    });
  }

  /**
   * Non-breaking Phase 1 adapter for canonical participant shape.
   */
  static toParticipantInfo(application: JobApplication): ParticipantInfo {
    const statusMap: Record<JobApplicationStatus, ParticipantInfo['status']> = {
      [JobApplicationStatus.PENDING]: 'pending',
      [JobApplicationStatus.WAITLISTED]: 'waitlisted',
      [JobApplicationStatus.APPROVED]: 'active',
      [JobApplicationStatus.REJECTED]: 'inactive',
      [JobApplicationStatus.WITHDRAWN]: 'inactive',
    };

    return {
      userId: application.applicantUserId,
      organizationId: undefined,
      username: application.applicantDisplayName,
      displayName: application.applicantDisplayName,
      roles: [SystemRole.JOB_APPLICANT],
      primaryRole: application.applicationType,
      status: statusMap[application.status],
      joinedAt: application.createdAt,
      source: 'manual',
      metadata: {
        jobListingId: application.jobListingId,
        applicationId: application.id,
      },
    };
  }

  toParticipantInfo(application: JobApplication): ParticipantInfo {
    return JobApplicationService.toParticipantInfo(application);
  }

  // ────────────────────── Private helpers ────────────────────────

  private populateCrewFields(
    app: JobApplication,
    job: PublicJobListing,
    input: ApplyToJobInput
  ): void {
    if (input.shipIndex === undefined || input.roleIndex === undefined) {
      throw new ValidationError('shipIndex and roleIndex are required for crew applications');
    }
    if (!job.shipCrewBreakdown?.[input.shipIndex]) {
      throw new ValidationError('Invalid ship index');
    }
    const ship = job.shipCrewBreakdown[input.shipIndex];
    const role = ship.roles[input.roleIndex];
    if (!role) {
      throw new ValidationError('Invalid role index');
    }
    if (role.filled >= role.total) {
      // Don't block — the application will be auto-waitlisted
    }
    app.shipIndex = input.shipIndex;
    app.roleIndex = input.roleIndex;
    app.shipName = ship.shipName;
    app.roleName = role.role;
  }

  private populatePassengerFields(
    app: JobApplication,
    job: PublicJobListing,
    input: ApplyToJobInput
  ): void {
    if (input.passengerShipIndex === undefined) {
      throw new ValidationError('passengerShipIndex is required for passenger applications');
    }
    if (!job.shipCrewBreakdown?.[input.passengerShipIndex]) {
      throw new ValidationError('Invalid ship index for passenger');
    }
    const ship = job.shipCrewBreakdown[input.passengerShipIndex];
    app.passengerShipIndex = input.passengerShipIndex;
    app.shipName = ship.shipName;
    app.passengerRole = input.passengerRole ?? 'Passenger';
  }

  private isListingFull(job: PublicJobListing): boolean {
    // Uncapped listing → never full
    if (!job.crewSpotsTotal) {
      return false;
    }
    return (job.crewSpotsFilled ?? 0) >= job.crewSpotsTotal;
  }

  private async getNextWaitlistPosition(jobListingId: string): Promise<number> {
    const result: { maxPos: number | null } | undefined = await this.applicationRepository
      .createQueryBuilder('app')
      .select('MAX(app.waitlistPosition)', 'maxPos')
      .where('app.jobListingId = :jobListingId', { jobListingId })
      .andWhere('app.status = :status', { status: JobApplicationStatus.WAITLISTED })
      .getRawOne();
    return (result?.maxPos ?? 0) + 1;
  }

  /**
   * Fill the appropriate slot when an application is approved.
   * Dispatches to type-specific helpers.
   */
  private async fillSlot(app: JobApplication, job: PublicJobListing): Promise<void> {
    switch (app.applicationType) {
      case JobApplicationType.CREW:
        this.fillCrewSlot(app, job);
        break;
      case JobApplicationType.PASSENGER:
        this.fillPassengerSlot(app, job);
        break;
      default:
        // GENERAL / VEHICLE — increment aggregate
        job.crewSpotsFilled = (job.crewSpotsFilled ?? 0) + 1;

        // Track vehicle info for display on the listing card
        if (app.applicationType === JobApplicationType.VEHICLE && app.vehicleName) {
          job.approvedVehicles ??= [];
          job.approvedVehicles.push({
            vehicleName: app.vehicleName,
            applicantUserId: app.applicantUserId,
            applicantDisplayName: app.applicantDisplayName,
            applicationId: app.id,
            approvedAt: new Date().toISOString(),
          });
        }
        break;
    }

    await this.jobRepository.save(job);
  }

  /** Assign user to a specific crew role on a ship */
  private fillCrewSlot(app: JobApplication, job: PublicJobListing): void {
    if (app.shipIndex === undefined || app.roleIndex === undefined || !job.shipCrewBreakdown) {
      return;
    }
    const ship = job.shipCrewBreakdown[app.shipIndex];
    if (!ship) {
      return;
    }

    const role = ship.roles[app.roleIndex];
    if (!role) {
      return;
    }

    // Initialize arrays if they don't exist (backward compatibility)
    role.assignedUserIds ??= [];
    role.assignedUserNames ??= [];

    // Check if role has capacity and user isn't already assigned
    if (
      role.assignedUserIds.length < role.total &&
      !role.assignedUserIds.includes(app.applicantUserId)
    ) {
      // Add user to assignee arrays (supports multiple assignees)
      role.assignedUserIds.push(app.applicantUserId);
      role.assignedUserNames.push(app.applicantDisplayName);
      role.filled = role.assignedUserIds.length;

      // Legacy compatibility: set single fields to first assignee only
      // NOTE: Legacy code will only see the first assignee via assignedUserId/assignedUserName.
      // Clients must use assignedUserIds/assignedUserNames arrays to access all assignees.
      if (role.assignedUserIds.length === 1) {
        // Legacy backward-compat: write through untyped access to avoid deprecation warning
        const legacyRole = role as unknown as Record<string, unknown>;
        legacyRole.assignedUserId = app.applicantUserId;
        legacyRole.assignedUserName = app.applicantDisplayName;
      }
    }

    // Recalculate aggregate
    job.crewSpotsFilled = job.shipCrewBreakdown.reduce(
      (sum, s) => sum + s.roles.reduce((rs, r) => rs + r.filled, 0),
      0
    );
  }

  /** Fill one passenger seat on a ship */
  private fillPassengerSlot(app: JobApplication, job: PublicJobListing): void {
    if (app.passengerShipIndex === undefined || !job.shipCrewBreakdown) {
      return;
    }
    const ship = job.shipCrewBreakdown[app.passengerShipIndex];
    if (!ship?.passengers) {
      return;
    }

    for (const pSlot of ship.passengers) {
      if (pSlot.filled < pSlot.capacity) {
        pSlot.filled += 1;
        pSlot.assignedUserNames ??= [];
        pSlot.assignedUserNames.push(app.applicantDisplayName);
        break;
      }
    }
  }
}

