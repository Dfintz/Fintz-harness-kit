import {
  SystemRole,
  type ParticipantInfo,
  type ShipRequirement,
} from '@sc-fleet-manager/shared-types';
import { QueryRunner, Repository, SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import {
  JobType,
  ListingCategory,
  ListingOwnerType,
  PayType,
  PublicJobListing,
  ShipCrewRoleSlot,
  type ApprovedVehicle,
} from '../../models/PublicJobListing';
import { OrgPrimaryFocus } from '../../models/PublicOrgProfile';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { addFullTextSearch } from '../../utils/query/fullTextSearch';
import { ShipService } from '../ship/ShipService';

// ── Typed raw query result shapes ───────────────────────────────
interface OrgCountRow {
  organizationId: string;
  count: string;
}
interface AllianceCountRow {
  allianceId: string;
  count: string;
}
interface JobTypeCountRow {
  type: string;
  count: string;
}
interface FocusCountRow {
  focus: string;
  count: string;
}

/**
 * Filter options for job listings
 */
export interface JobListingFilterOptions {
  /** Filter by organization ID */
  organizationId?: string;
  /** Filter by alliance ID */
  allianceId?: string;
  /** Filter by owner type (org or alliance) */
  ownerType?: ListingOwnerType;
  /** Filter by job types (multi-select) */
  jobTypes?: JobType[];
  /** Filter by focus areas (multi-select) */
  focuses?: OrgPrimaryFocus[];
  /** Filter by pay types (multi-select) */
  payTypes?: PayType[];
  /** Minimum pay filter */
  minPay?: number;
  /** Maximum pay filter */
  maxPay?: number;
  /** Maximum experience level required */
  maxExperienceLevel?: number;
  /** Search term for title/description */
  searchTerm?: string;
  /** Filter by active status */
  isActive?: boolean;
  /** Include expired listings */
  includeExpired?: boolean;
  /** Filter by listing category (job vs service) */
  listingCategory?: ListingCategory;
}

/**
 * Public job listing data for directory
 */
export interface PublicJobListItem {
  id: string;
  organizationId?: string;
  organizationName?: string;
  organizationLogoUrl?: string;
  allianceId?: string;
  allianceName?: string;
  ownerType: ListingOwnerType;
  listingCategory: ListingCategory;
  title: string;
  description?: string;
  jobType: JobType;
  focus: OrgPrimaryFocus;
  payType?: PayType;
  payMin?: number;
  payMax?: number;
  payDisplay: string;
  experienceLevel: number;
  isActive: boolean;
  postedAt: Date;
  expiresAt?: Date;
  contactInfo?: string;
  timezone?: string;
  languages?: string[];
  tags?: string[];
  crewSpotsTotal?: number;
  crewSpotsFilled?: number;
  requiredShips?: ShipRequirement[];
  shipRequirementType?: string;
  shipCrewBreakdown?: Array<{
    shipName: string;
    crewCapacity: number;
    roles: Array<{
      role: string;
      total: number;
      filled: number;
      assignedUserId?: string | null;
      assignedUserName?: string | null;
    }>;
    isLoaner?: boolean;
    contributedByUserId?: string | null;
    contributedByUserName?: string | null;
    /** Cargo capacity in SCU (enriched from ship catalog) */
    cargo?: number;
    /** Quantum fuel capacity (enriched from ship catalog) */
    quantumFuelCapacity?: number;
  }>;
  approvedVehicles?: ApprovedVehicle[];
  createdBy?: string;
  /** Total SCU across all ships in the breakdown */
  totalScu?: number;
  /** Average quantum fuel capacity across all ships */
  averageQuantumFuel?: number;
}

/**
 * Input for creating a job listing
 */
export interface CreateJobListingInput {
  organizationId?: string;
  allianceId?: string;
  ownerType: ListingOwnerType;
  listingCategory?: ListingCategory;
  title: string;
  description?: string;
  jobType: JobType;
  focus: OrgPrimaryFocus;
  payType?: PayType;
  payMin?: number;
  payMax?: number;
  experienceLevel?: number;
  expiresAt?: Date;
  createdBy?: string;
  contactInfo?: string;
  timezone?: string;
  languages?: string[];
  tags?: string[];
  crewSpotsTotal?: number;
  crewSpotsFilled?: number;
  requiredShips?: ShipRequirement[];
  shipRequirementType?: string;
}

/**
 * Input for updating a job listing
 */
export interface UpdateJobListingInput {
  listingCategory?: ListingCategory;
  title?: string;
  description?: string;
  jobType?: JobType;
  focus?: OrgPrimaryFocus;
  payType?: PayType;
  payMin?: number;
  payMax?: number;
  experienceLevel?: number;
  isActive?: boolean;
  expiresAt?: Date;
  contactInfo?: string;
  timezone?: string;
  languages?: string[];
  tags?: string[];
}

/**
 * Job listing statistics
 */
export interface JobListingStats {
  totalListings: number;
  activeListings: number;
  organizationListings: number;
  allianceListings: number;
  userListings: number;
  jobListings: number;
  serviceListings: number;
  byJobType: Record<string, number>;
  byFocus: Record<string, number>;
}

/**
 * PublicJobListingService - Service for public job listings
 *
 * Provides:
 * - Job listing CRUD operations
 * - Public job directory with filtering
 * - Job counts for organizations and alliances
 * - No authentication required for read operations
 *
 * Phase 3: Public Job Listings feature
 */
export class PublicJobListingService {
  private readonly jobRepository: Repository<PublicJobListing>;
  private readonly organizationRepository: Repository<Organization>;
  private readonly shipService: ShipService;

  constructor() {
    this.jobRepository = AppDataSource.getRepository(PublicJobListing);
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.shipService = new ShipService();
  }

  /**
   * Execute a callback with pessimistic write locking on a job listing.
   * Handles transaction setup, locking, commit/rollback, and cleanup.
   * @param jobId The job listing ID to lock
   * @param callback Callback that receives the locked job listing
   * @returns The result from the callback
   */
  private async withJobLock<T>(
    jobId: string,
    callback: (job: PublicJobListing, queryRunner: QueryRunner) => Promise<T>
  ): Promise<T> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const job = await queryRunner.manager.findOne(PublicJobListing, {
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!job) {
        throw new Error('Job listing not found');
      }

      const result = await callback(job, queryRunner);
      await queryRunner.commitTransaction();
      return result;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Get assigned user IDs from a role, handling backward compatibility.
   * Returns array from assignedUserIds if present, otherwise falls back to single assignedUserId.
   */
  private getAssignedUserIds(role: ShipCrewRoleSlot): string[] {
    if (role.assignedUserIds && Array.isArray(role.assignedUserIds)) {
      return role.assignedUserIds;
    }
    if (role.assignedUserId) {
      return [role.assignedUserId];
    }
    return [];
  }

  /**
   * Enrich a single PublicJobListItem with ship specs (cargo/SCU and quantum fuel)
   * from the Ship catalog. Delegates to the batch method for a single-item array.
   */
  private async enrichWithShipStats(item: PublicJobListItem): Promise<PublicJobListItem> {
    await this.enrichMultipleWithShipStats([item]);
    return item;
  }

  /**
   * Enrich multiple listing items with ship stats in a single batch.
   */
  private async enrichMultipleWithShipStats(
    items: PublicJobListItem[]
  ): Promise<PublicJobListItem[]> {
    const allShipNames: string[] = [];
    for (const item of items) {
      if (item.shipCrewBreakdown) {
        for (const entry of item.shipCrewBreakdown) {
          allShipNames.push(entry.shipName);
        }
      }
    }

    if (allShipNames.length === 0) {
      return items;
    }

    const specs = await this.shipService.batchGetShipSpecsByNames(allShipNames);

    for (const item of items) {
      this.applyShipStatsToItem(item, specs);
    }

    return items;
  }

  /** Apply ship specs to a single listing item and compute aggregates. */
  private applyShipStatsToItem(
    item: PublicJobListItem,
    specs: Map<string, { cargo: number; quantumFuelCapacity: number }>
  ): void {
    if (!item.shipCrewBreakdown || item.shipCrewBreakdown.length === 0) {
      return;
    }

    let totalScu = 0;
    let totalQf = 0;
    let shipCount = 0;

    for (const entry of item.shipCrewBreakdown) {
      const spec = specs.get(entry.shipName.toLowerCase());
      if (spec) {
        entry.cargo = spec.cargo;
        entry.quantumFuelCapacity = spec.quantumFuelCapacity;
        totalScu += spec.cargo;
        if (spec.quantumFuelCapacity > 0) {
          totalQf += spec.quantumFuelCapacity;
          shipCount++;
        }
      }
    }

    item.totalScu = totalScu;
    item.averageQuantumFuel = shipCount > 0 ? Math.round(totalQf / shipCount) : 0;
  }

  /**
   * Apply filter conditions to the job listings query builder.
   */
  private applyJobFilters(
    queryBuilder: SelectQueryBuilder<PublicJobListing>,
    filters?: JobListingFilterOptions
  ): void {
    // Base filter: only active and non-expired by default
    if (filters?.isActive !== false) {
      queryBuilder.andWhere('job.isActive = :isActive', { isActive: true });
    }

    if (!filters?.includeExpired) {
      queryBuilder.andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now: new Date() });
    }

    if (!filters) {
      return;
    }

    // Simple equality filters
    if (filters.organizationId) {
      queryBuilder.andWhere('job.organizationId = :organizationId', {
        organizationId: filters.organizationId,
      });
    }
    if (filters.allianceId) {
      queryBuilder.andWhere('job.allianceId = :allianceId', {
        allianceId: filters.allianceId,
      });
    }
    if (filters.ownerType) {
      queryBuilder.andWhere('job.ownerType = :ownerType', {
        ownerType: filters.ownerType,
      });
    }
    if (filters.listingCategory) {
      queryBuilder.andWhere('job.listingCategory = :listingCategory', {
        listingCategory: filters.listingCategory,
      });
    }

    // Array-based IN filters
    this.applyArrayFilters(queryBuilder, filters);

    // Range and text filters
    this.applyRangeAndTextFilters(queryBuilder, filters);
  }

  /** Apply array-based IN filters (job types, focuses, pay types) */
  private applyArrayFilters(
    queryBuilder: SelectQueryBuilder<PublicJobListing>,
    filters: JobListingFilterOptions
  ): void {
    if (filters.jobTypes && filters.jobTypes.length > 0) {
      queryBuilder.andWhere('job.jobType IN (:...jobTypes)', { jobTypes: filters.jobTypes });
    }
    if (filters.focuses && filters.focuses.length > 0) {
      queryBuilder.andWhere('job.focus IN (:...focuses)', { focuses: filters.focuses });
    }
    if (filters.payTypes && filters.payTypes.length > 0) {
      queryBuilder.andWhere('job.payType IN (:...payTypes)', { payTypes: filters.payTypes });
    }
  }

  /** Apply pay range, experience, and text search filters */
  private applyRangeAndTextFilters(
    queryBuilder: SelectQueryBuilder<PublicJobListing>,
    filters: JobListingFilterOptions
  ): void {
    if (filters.minPay !== undefined) {
      queryBuilder.andWhere('(job.payMin >= :minPay OR job.payMax >= :minPay)', {
        minPay: filters.minPay,
      });
    }
    if (filters.maxPay !== undefined) {
      queryBuilder.andWhere('(job.payMax <= :maxPay OR job.payMin <= :maxPay)', {
        maxPay: filters.maxPay,
      });
    }
    if (filters.maxExperienceLevel !== undefined) {
      queryBuilder.andWhere('job.experienceLevel <= :maxExperience', {
        maxExperience: filters.maxExperienceLevel,
      });
    }
    if (filters.searchTerm) {
      addFullTextSearch(
        queryBuilder,
        'job',
        filters.searchTerm,
        ['title', 'description'],
        'search_vector',
        'jobSearch'
      );
    }
  }

  /**
   * Get public job listings with filtering and pagination
   * No authentication required
   */
  async getPublicJobListings(
    filters?: JobListingFilterOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<PublicJobListItem>> {
    const queryBuilder = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.organization', 'org');

    // Apply all filter conditions
    this.applyJobFilters(queryBuilder, filters);

    // Apply pagination
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Sorting
    const sortBy = pagination?.sortBy ?? 'postedAt';
    const sortOrder = pagination?.sortOrder ?? 'DESC';

    // Validate sortBy to prevent SQL injection
    const allowedSortFields = ['postedAt', 'title', 'jobType', 'experienceLevel', 'payMin'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'postedAt';

    if (filters?.searchTerm) {
      queryBuilder.addOrderBy(`job.${safeSortBy}`, sortOrder);
    } else {
      queryBuilder.orderBy(`job.${safeSortBy}`, sortOrder);
    }

    // Execute query
    const [jobs, total] = await queryBuilder.getManyAndCount();

    // Transform to public list items
    const data: PublicJobListItem[] = jobs.map(job => ({
      id: job.id,
      organizationId: job.organizationId,
      organizationName: job.organization?.name,
      organizationLogoUrl: job.organization?.logoUrl,
      allianceId: job.allianceId,
      allianceName: undefined, // Will be populated if needed
      ownerType: job.ownerType,
      listingCategory: job.listingCategory,
      title: job.title,
      description: job.description,
      jobType: job.jobType,
      focus: job.focus,
      payType: job.payType,
      payMin: job.payMin,
      payMax: job.payMax,
      payDisplay: job.getPayDisplay(),
      experienceLevel: job.experienceLevel,
      isActive: job.isActive,
      postedAt: job.postedAt,
      expiresAt: job.expiresAt,
      contactInfo: job.contactInfo,
      timezone: job.timezone,
      languages: job.languages,
      tags: job.tags,
      crewSpotsTotal: job.crewSpotsTotal,
      crewSpotsFilled: job.crewSpotsFilled ?? 0,
      requiredShips: job.requiredShips,
      shipRequirementType: job.shipRequirementType ?? 'none',
      shipCrewBreakdown: job.shipCrewBreakdown ?? [],
      approvedVehicles: job.approvedVehicles ?? [],
    }));

    // Enrich with ship stats (SCU, QF) in a single batch
    await this.enrichMultipleWithShipStats(data);

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

  /**
   * Get a single job listing by ID or slug
   * No authentication required, but must be active and not expired
   */
  async getJobListing(identifier: string): Promise<PublicJobListItem | null> {
    const { isUUID } = await import('../../utils/slugify');

    let job;

    if (isUUID(identifier)) {
      job = await this.jobRepository.findOne({
        where: { id: identifier },
        relations: ['organization'],
      });
    } else {
      // Slug-based lookup — use DB-level LOWER comparison to avoid loading all records
      // Mirrors the frontend slugify() logic: collapse spaces/hyphens, trim edges
      job =
        (await this.jobRepository
          .createQueryBuilder('job')
          .leftJoinAndSelect('job.organization', 'organization')
          .where('job.isActive = :isActive', { isActive: true })
          .andWhere(
            String.raw`LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(job.title), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g'), '-+', '-', 'g'))) = LOWER(:slug)`,
            { slug: identifier }
          )
          .getOne()) ?? null;
    }

    if (!job?.isVisible()) {
      return null;
    }

    const item: PublicJobListItem = {
      id: job.id,
      organizationId: job.organizationId,
      organizationName: job.organization?.name,
      organizationLogoUrl: job.organization?.logoUrl,
      allianceId: job.allianceId,
      allianceName: undefined,
      ownerType: job.ownerType,
      listingCategory: job.listingCategory,
      title: job.title,
      description: job.description,
      jobType: job.jobType,
      focus: job.focus,
      payType: job.payType,
      payMin: job.payMin,
      payMax: job.payMax,
      payDisplay: job.getPayDisplay(),
      experienceLevel: job.experienceLevel,
      isActive: job.isActive,
      postedAt: job.postedAt,
      expiresAt: job.expiresAt,
      contactInfo: job.contactInfo,
      timezone: job.timezone,
      languages: job.languages,
      tags: job.tags,
      crewSpotsTotal: job.crewSpotsTotal,
      crewSpotsFilled: job.crewSpotsFilled ?? 0,
      requiredShips: job.requiredShips,
      shipRequirementType: job.shipRequirementType ?? 'none',
      shipCrewBreakdown: job.shipCrewBreakdown ?? [],
      approvedVehicles: job.approvedVehicles ?? [],
      createdBy: job.createdBy,
    };

    return this.enrichWithShipStats(item);
  }

  /**
   * Get a job listing by ID without visibility checks (internal use for management)
   * Used by admin/owner operations that need to access inactive/expired listings
   */
  async getJobListingInternal(jobId: string): Promise<PublicJobListing | null> {
    return this.jobRepository.findOne({
      where: { id: jobId },
      relations: ['organization'],
    });
  }

  /**
   * Create a new job listing
   * Requires authentication (handled by controller)
   */
  async createJobListing(input: CreateJobListingInput): Promise<PublicJobListing> {
    // Validate owner type and ID
    if (input.ownerType === ListingOwnerType.ORGANIZATION && !input.organizationId) {
      throw new Error('Organization ID is required for organization listings');
    }
    if (input.ownerType === ListingOwnerType.ALLIANCE && !input.allianceId) {
      throw new Error('Alliance ID is required for alliance listings');
    }
    // USER ownerType: no organizationId or allianceId required — individual posting

    // Validate organization exists if provided
    if (input.organizationId) {
      const org = await this.organizationRepository.findOne({
        where: { id: input.organizationId },
      });
      if (!org) {
        throw new Error('Organization not found');
      }
    }

    // Auto-calculate crewSpotsTotal from ship requirements when not manually provided
    if (input.requiredShips?.length && !input.crewSpotsTotal) {
      const totalCrew = PublicJobListingService.calculateCrewTotal(input.requiredShips);
      if (totalCrew > 0) {
        input.crewSpotsTotal = totalCrew;
      }
    }

    const job = this.jobRepository.create({
      ...input,
      isActive: true,
      postedAt: new Date(),
      experienceLevel: input.experienceLevel ?? 0,
    });

    const saved = await this.jobRepository.save(job);
    logger.info(`Created job listing: ${saved.title}`, {
      jobId: saved.id,
      organizationId: saved.organizationId,
      allianceId: saved.allianceId,
    });

    return saved;
  }

  /**
   * Update a job listing
   * Requires authentication (handled by controller)
   */
  async updateJobListing(
    jobId: string,
    input: UpdateJobListingInput
  ): Promise<PublicJobListing | null> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      return null;
    }

    // Merge defined input fields onto the entity
    const updatableFields = [
      'listingCategory',
      'title',
      'description',
      'jobType',
      'focus',
      'payType',
      'payMin',
      'payMax',
      'experienceLevel',
      'isActive',
      'expiresAt',
      'contactInfo',
      'timezone',
      'languages',
      'tags',
    ] as const;

    const patch: Partial<PublicJobListing> = {};
    for (const field of updatableFields) {
      if (input[field] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- safe: field keys validated above
        (patch as any)[field] = input[field];
      }
    }
    Object.assign(job, patch);

    const updated = await this.jobRepository.save(job);
    logger.info(`Updated job listing: ${updated.title}`, { jobId: updated.id });

    return updated;
  }

  /**
   * Delete a job listing
   * Requires authentication (handled by controller)
   */
  async deleteJobListing(jobId: string): Promise<boolean> {
    const result = await this.jobRepository.delete({ id: jobId });
    const deleted = (result.affected ?? 0) > 0;

    if (deleted) {
      logger.info(`Deleted job listing`, { jobId });
    }

    return deleted;
  }

  /**
   * Deactivate a job listing (soft delete)
   */
  async deactivateJobListing(jobId: string): Promise<PublicJobListing | null> {
    return this.updateJobListing(jobId, { isActive: false });
  }

  /**
   * Get job count for an organization
   * Used for displaying badge on org cards
   */
  async getOrganizationJobCount(organizationId: string): Promise<number> {
    return this.jobRepository.count({
      where: {
        organizationId,
        isActive: true,
      },
    });
  }

  /**
   * Get job count for an alliance
   * Used for displaying badge on alliance cards
   */
  async getAllianceJobCount(allianceId: string): Promise<number> {
    return this.jobRepository.count({
      where: {
        allianceId,
        isActive: true,
      },
    });
  }

  /**
   * Get job counts for multiple organizations
   * Used for batch loading in directory listings
   */
  async getOrganizationJobCounts(organizationIds: string[]): Promise<Map<string, number>> {
    if (!organizationIds || organizationIds.length === 0) {
      return new Map();
    }

    const results = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.organizationId', 'organizationId')
      .addSelect('COUNT(*)', 'count')
      .where('job.organizationId IN (:...organizationIds)', { organizationIds })
      .andWhere('job.isActive = :isActive', { isActive: true })
      .andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now: new Date() })
      .groupBy('job.organizationId')
      .getRawMany<OrgCountRow>();

    const counts = new Map<string, number>();
    for (const row of results) {
      counts.set(row.organizationId, Number.parseInt(row.count, 10));
    }

    return counts;
  }

  /**
   * Get job counts for multiple alliances
   * Used for batch loading in directory listings
   */
  async getAllianceJobCounts(allianceIds: string[]): Promise<Map<string, number>> {
    if (!allianceIds || allianceIds.length === 0) {
      return new Map();
    }

    const results = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.allianceId', 'allianceId')
      .addSelect('COUNT(*)', 'count')
      .where('job.allianceId IN (:...allianceIds)', { allianceIds })
      .andWhere('job.isActive = :isActive', { isActive: true })
      .andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now: new Date() })
      .groupBy('job.allianceId')
      .getRawMany<AllianceCountRow>();

    const counts = new Map<string, number>();
    for (const row of results) {
      counts.set(row.allianceId, Number.parseInt(row.count, 10));
    }

    return counts;
  }

  /**
   * Get listings for an organization (for management)
   * Includes inactive listings
   */
  async getOrganizationListings(
    organizationId: string,
    includeInactive: boolean = false
  ): Promise<PublicJobListing[]> {
    const where: { organizationId: string; isActive?: boolean } = { organizationId };
    if (!includeInactive) {
      where.isActive = true;
    }
    return this.jobRepository.find({ where, order: { postedAt: 'DESC' } });
  }

  /**
   * Get listings for an alliance (for management)
   * Includes inactive listings
   */
  async getAllianceListings(
    allianceId: string,
    includeInactive: boolean = false
  ): Promise<PublicJobListing[]> {
    const where: { allianceId: string; isActive?: boolean } = { allianceId };
    if (!includeInactive) {
      where.isActive = true;
    }
    return this.jobRepository.find({ where, order: { postedAt: 'DESC' } });
  }

  /**
   * Get job listing statistics (public)
   */
  async getJobListingStats(): Promise<JobListingStats> {
    const now = new Date();

    const [
      total,
      active,
      orgListings,
      allianceListings,
      userListings,
      jobCategoryCount,
      serviceCategoryCount,
    ] = await Promise.all([
      this.jobRepository.count(),
      this.jobRepository.count({
        where: { isActive: true },
      }),
      this.jobRepository.count({
        where: { ownerType: ListingOwnerType.ORGANIZATION, isActive: true },
      }),
      this.jobRepository.count({
        where: { ownerType: ListingOwnerType.ALLIANCE, isActive: true },
      }),
      this.jobRepository.count({
        where: { ownerType: ListingOwnerType.USER, isActive: true },
      }),
      this.jobRepository.count({
        where: { listingCategory: ListingCategory.JOB, isActive: true },
      }),
      this.jobRepository.count({
        where: { listingCategory: ListingCategory.SERVICE, isActive: true },
      }),
    ]);

    // Get counts by job type
    const jobTypeCounts = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.jobType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('job.isActive = :isActive', { isActive: true })
      .andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now })
      .groupBy('job.jobType')
      .getRawMany<JobTypeCountRow>();

    const byJobType: Record<string, number> = {};
    for (const row of jobTypeCounts) {
      byJobType[row.type] = Number.parseInt(row.count, 10);
    }

    // Get counts by focus
    const focusCounts = await this.jobRepository
      .createQueryBuilder('job')
      .select('job.focus', 'focus')
      .addSelect('COUNT(*)', 'count')
      .where('job.isActive = :isActive', { isActive: true })
      .andWhere('(job.expiresAt IS NULL OR job.expiresAt > :now)', { now })
      .groupBy('job.focus')
      .getRawMany<FocusCountRow>();

    const byFocus: Record<string, number> = {};
    for (const row of focusCounts) {
      byFocus[row.focus] = Number.parseInt(row.count, 10);
    }

    return {
      totalListings: total,
      activeListings: active,
      organizationListings: orgListings,
      allianceListings,
      userListings,
      jobListings: jobCategoryCount,
      serviceListings: serviceCategoryCount,
      byJobType,
      byFocus,
    };
  }

  /**
   * Get job type options for filters
   */
  getJobTypeOptions(): JobType[] {
    return Object.values(JobType);
  }

  /**
   * Get pay type options for filters
   */
  getPayTypeOptions(): PayType[] {
    return Object.values(PayType);
  }

  /**
   * Cleanup expired listings (can be run as scheduled job)
   */
  async cleanupExpiredListings(): Promise<number> {
    const result = await this.jobRepository
      .createQueryBuilder()
      .update(PublicJobListing)
      .set({ isActive: false })
      .where('expiresAt < :now', { now: new Date() })
      .andWhere('isActive = :isActive', { isActive: true })
      .execute();

    const affected = result.affected ?? 0;
    if (affected > 0) {
      logger.info(`Deactivated ${affected} expired job listings`);
    }

    return affected;
  }

  /**
   * Non-breaking Phase 1 adapter for canonical participant shape.
   */
  static toParticipantInfo(
    listing: Pick<
      PublicJobListing,
      'id' | 'organizationId' | 'createdBy' | 'postedAt' | 'isActive' | 'expiresAt'
    >,
    options?: { username?: string; displayName?: string }
  ): ParticipantInfo {
    const isExpired = !!listing.expiresAt && listing.expiresAt.getTime() < Date.now();

    return {
      userId: listing.createdBy ?? 'unknown-provider',
      organizationId: listing.organizationId,
      username: options?.username ?? listing.createdBy ?? 'unknown-provider',
      displayName: options?.displayName,
      roles: [SystemRole.JOB_PROVIDER],
      primaryRole: 'provider',
      status: listing.isActive && !isExpired ? 'active' : 'inactive',
      joinedAt: listing.postedAt,
      source: 'manual',
      metadata: {
        listingId: listing.id,
      },
    };
  }

  toParticipantInfo(
    listing: Pick<
      PublicJobListing,
      'id' | 'organizationId' | 'createdBy' | 'postedAt' | 'isActive' | 'expiresAt'
    >,
    options?: { username?: string; displayName?: string }
  ): ParticipantInfo {
    return PublicJobListingService.toParticipantInfo(listing, options);
  }

  /**
   * Assign a user to a crew role on a ship within a job listing.
   *
   * Rules:
   * - A user can only be personally assigned to ONE crew position across all ships.
   * - If the user contributes additional ships, those are marked as "loaner"
   *   (the ship is provided but the user isn't crewing it).
   * - Only the listing owner (or org admin) can assign crew.
   *
   * @param jobId     - The job listing ID
   * @param shipIndex - Index of the ship in shipCrewBreakdown
   * @param roleIndex - Index of the role within that ship's roles array
   * @param userId    - The user being assigned
   * @param userName  - Display name
   * @returns Updated job listing
   */
  async assignCrewRole(
    jobId: string,
    shipIndex: number,
    roleIndex: number,
    userId: string,
    userName: string
  ): Promise<PublicJobListing> {
    return this.withJobLock(jobId, async (job, queryRunner) => {
      if (!job.shipCrewBreakdown || job.shipCrewBreakdown.length === 0) {
        throw new Error('Job listing has no ship crew breakdown');
      }

      if (shipIndex < 0 || shipIndex >= job.shipCrewBreakdown.length) {
        throw new Error('Invalid ship index');
      }

      const ship = job.shipCrewBreakdown[shipIndex];
      if (roleIndex < 0 || roleIndex >= ship.roles.length) {
        throw new Error('Invalid role index');
      }

      const role = ship.roles[roleIndex];
      if (role.filled >= role.total) {
        throw new Error('This role is already filled to capacity');
      }

      // Initialize arrays if they don't exist (backward compatibility)
      role.assignedUserIds ??= [];
      role.assignedUserNames ??= [];

      // Check if user is already assigned to THIS specific role
      if (role.assignedUserIds.includes(userId)) {
        throw new Error('User is already assigned to this role');
      }

      // Check if user is already assigned to ANY crew position (one position rule)
      let userAlreadyAssigned = false;
      for (const s of job.shipCrewBreakdown) {
        for (const r of s.roles) {
          const assignedIds = this.getAssignedUserIds(r);
          if (assignedIds.includes(userId)) {
            userAlreadyAssigned = true;
            break;
          }
        }
        if (userAlreadyAssigned) {
          break;
        }
      }

      if (userAlreadyAssigned) {
        throw new Error(
          'User is already assigned to a crew position. A user can only crew one position.'
        );
      }

      // Add user to the role's assignee arrays (supports multiple assignees)
      role.assignedUserIds.push(userId);
      role.assignedUserNames.push(userName);
      role.filled = role.assignedUserIds.length;

      // Legacy compatibility: set single fields to first assignee only
      // NOTE: When multiple assignees are present, legacy code using assignedUserId/assignedUserName
      // will only see the FIRST assignee. Clients should migrate to using the assignedUserIds/
      // assignedUserNames arrays to see all assignees. This is a known limitation of the backward
      // compatibility layer and is by design to support gradual migration.
      if (role.assignedUserIds.length === 1) {
        role.assignedUserId = userId;
        role.assignedUserName = userName;
      }

      // Update aggregate crew filled count
      const totalFilled = job.shipCrewBreakdown.reduce(
        (sum, s) => sum + s.roles.reduce((rs, r) => rs + r.filled, 0),
        0
      );
      job.crewSpotsFilled = totalFilled;

      const saved = await queryRunner.manager.save(PublicJobListing, job);

      logger.info(`Assigned crew role: ${userName} as ${role.role} on ${ship.shipName}`, {
        jobId,
        shipIndex,
        roleIndex,
        userId,
      });

      return saved;
    });
  }

  /**
   * Unassign a user from a crew role.
   */
  async unassignCrewRole(
    jobId: string,
    shipIndex: number,
    roleIndex: number
  ): Promise<PublicJobListing> {
    return this.withJobLock(jobId, async (job, queryRunner) => {
      if (!job.shipCrewBreakdown || job.shipCrewBreakdown.length === 0) {
        throw new Error('Job listing has no ship crew breakdown');
      }

      const ship = job.shipCrewBreakdown[shipIndex];
      if (!ship) {
        throw new Error('Invalid ship index');
      }
      const role = ship.roles[roleIndex];
      if (!role) {
        throw new Error('Invalid role index');
      }

      // Initialize arrays if they don't exist (backward compatibility)
      role.assignedUserIds ??= [];
      role.assignedUserNames ??= [];

      // Clear ALL assignees from this role (maintains backward compatibility)
      // In future, API can be extended to accept userId to remove specific assignee
      role.assignedUserIds = [];
      role.assignedUserNames = [];
      role.filled = 0;

      // Legacy compatibility: also clear single fields
      role.assignedUserId = null;
      role.assignedUserName = null;

      // Update aggregate crew filled count
      const totalFilled = job.shipCrewBreakdown.reduce(
        (sum, s) => sum + s.roles.reduce((rs, r) => rs + r.filled, 0),
        0
      );
      job.crewSpotsFilled = totalFilled;

      const saved = await queryRunner.manager.save(PublicJobListing, job);

      logger.info(`Unassigned crew role: ${role.role} on ${ship.shipName}`, {
        jobId,
        shipIndex,
        roleIndex,
      });

      return saved;
    });
  }

  /**
   * Mark a ship as loaner (contributed but not personally crewed by the contributor).
   */
  async markShipAsLoaner(
    jobId: string,
    shipIndex: number,
    contributorUserId: string,
    contributorUserName: string
  ): Promise<PublicJobListing> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      throw new Error('Job listing not found');
    }
    if (!job.shipCrewBreakdown) {
      throw new Error('No ship crew breakdown');
    }

    const ship = job.shipCrewBreakdown[shipIndex];
    if (!ship) {
      throw new Error('Invalid ship index');
    }

    ship.isLoaner = true;
    ship.contributedByUserId = contributorUserId;
    ship.contributedByUserName = contributorUserName;

    const saved = await this.jobRepository.save(job);
    logger.info(`Marked ship as loaner: ${ship.shipName} by ${contributorUserName}`, {
      jobId,
      shipIndex,
    });

    return saved;
  }

  /**
   * Calculate total crew from ship requirements.
   * Pure function — no DB access, uses client-provided crew data.
   */
  private static calculateCrewTotal(requirements: ShipRequirement[]): number {
    let totalCrew = 0;
    for (const req of requirements) {
      if (req.requirementType === 'specific') {
        totalCrew += req.count * (req.crewPerShip || 1);
      } else if (req.requirementType === 'role') {
        totalCrew += req.count * (req.avgCrewPerShip || 1);
      }
    }
    return totalCrew;
  }
}
