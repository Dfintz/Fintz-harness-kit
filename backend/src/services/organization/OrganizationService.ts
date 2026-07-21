import { randomUUID } from 'node:crypto';

import NodeCache from 'node-cache';
import { QueryDeepPartialEntity, QueryFailedError, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization, OrganizationStatus, OrganizationType } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { PermissionAction, ResourceType } from '../../models/OrganizationPermission';
import { OrgPrimaryFocus, PublicOrgProfile } from '../../models/PublicOrgProfile';
import { User } from '../../models/User';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { addFullTextSearch } from '../../utils/query/fullTextSearch';
import { getRoleName } from '../../utils/roleUtils';
import { AuditCategory, auditService } from '../audit/AuditService';
import { rsiCrawlerService } from '../external/RsiCrawlerService';

// Import domain services
import { OrganizationActivityService } from './OrganizationActivityService';
import { OrganizationDeletionService } from './OrganizationDeletionService';
import { OrganizationHierarchyService } from './OrganizationHierarchyService';
import { OrganizationMemberService } from './OrganizationMemberService';
import { OrganizationPermissionService } from './OrganizationPermissionService';
import { OrganizationSettingsService } from './OrganizationSettingsService';
import { getOrgDefaultsService } from './OrgDefaultsService';

/**
 * Core Organization Service
 * Handles basic CRUD operations and coordinates with domain-specific services
 * Follows the Domain-Driven Design pattern established in Phase 4.1
 *
 * Note: Organizations themselves are tenants, not tenant-scoped entities,
 * so this service does not extend TenantService.
 */
export class OrganizationService {
  private readonly organizationRepository: Repository<Organization>;
  private readonly membershipRepository: Repository<OrganizationMembership>;
  private readonly userRepository: Repository<User>;
  private readonly cache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });

  // Domain-specific services
  private readonly hierarchyService = new OrganizationHierarchyService();
  private readonly permissionService = new OrganizationPermissionService();
  private readonly memberService = new OrganizationMemberService();
  private readonly activityService = new OrganizationActivityService();
  private readonly settingsService = new OrganizationSettingsService();
  private readonly deletionService = new OrganizationDeletionService();

  constructor() {
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.userRepository = AppDataSource.getRepository(User);
  }

  // ==================== CORE CRUD OPERATIONS ====================

  /**
   * Get all organizations with advanced filtering and pagination
   * @param filters Search and filter criteria
   * @param pagination Pagination options
   * @returns Paginated organizations
   */
  /**
   * Apply query filters to organization query builder
   */
  private applyOrgFilters(
    queryBuilder: ReturnType<Repository<Organization>['createQueryBuilder']>,
    filters?: {
      name?: string;
      type?: OrganizationType;
      status?: OrganizationStatus;
      parentOrgId?: string;
      level?: number;
      tags?: string[];
      hasMembers?: boolean;
      memberCount?: { min?: number; max?: number };
      createdAfter?: Date;
      createdBefore?: Date;
    }
  ): void {
    if (!filters) {
      return;
    }

    this.applyBasicOrgFilters(queryBuilder, filters);
    this.applyMemberFilters(queryBuilder, filters);
    this.applyDateFilters(queryBuilder, filters);
  }

  private applyBasicOrgFilters(
    qb: ReturnType<Repository<Organization>['createQueryBuilder']>,
    f: {
      name?: string;
      type?: OrganizationType;
      status?: OrganizationStatus;
      parentOrgId?: string;
      level?: number;
      tags?: string[];
    }
  ): void {
    if (f.name) {
      addFullTextSearch(qb, 'org', f.name, ['name'], 'search_vector', 'orgName');
    }
    if (f.type) {
      qb.andWhere('org.type = :type', { type: f.type });
    }
    if (f.status) {
      qb.andWhere('org.status = :status', { status: f.status });
    }
    if (f.parentOrgId !== undefined) {
      if (f.parentOrgId === null) {
        qb.andWhere('org.parentOrgId IS NULL');
      } else {
        qb.andWhere('org.parentOrgId = :parentOrgId', { parentOrgId: f.parentOrgId });
      }
    }
    if (f.level !== undefined) {
      qb.andWhere('org.level = :level', { level: f.level });
    }
    if (f.tags && f.tags.length > 0) {
      qb.andWhere('org.tags && :tags', { tags: f.tags });
    }
  }

  private applyMemberFilters(
    qb: ReturnType<Repository<Organization>['createQueryBuilder']>,
    f: { hasMembers?: boolean; memberCount?: { min?: number; max?: number } }
  ): void {
    if (f.hasMembers === true) {
      qb.andWhere('org.memberCount > 0');
    } else if (f.hasMembers === false) {
      qb.andWhere('(org.memberCount = 0 OR org.memberCount IS NULL)');
    }
    if (f.memberCount?.min !== undefined) {
      qb.andWhere('org.memberCount >= :minMembers', { minMembers: f.memberCount.min });
    }
    if (f.memberCount?.max !== undefined) {
      qb.andWhere('org.memberCount <= :maxMembers', { maxMembers: f.memberCount.max });
    }
  }

  private applyDateFilters(
    qb: ReturnType<Repository<Organization>['createQueryBuilder']>,
    f: { createdAfter?: Date; createdBefore?: Date }
  ): void {
    if (f.createdAfter) {
      qb.andWhere('org.createdAt >= :createdAfter', { createdAfter: f.createdAfter });
    }
    if (f.createdBefore) {
      qb.andWhere('org.createdAt <= :createdBefore', { createdBefore: f.createdBefore });
    }
  }

  /**
   * Get all organizations with advanced filtering and pagination
   */
  async getOrganizations(
    filters?: {
      name?: string;
      type?: OrganizationType;
      status?: OrganizationStatus;
      parentOrgId?: string;
      level?: number;
      tags?: string[];
      hasMembers?: boolean;
      memberCount?: { min?: number; max?: number };
      createdAfter?: Date;
      createdBefore?: Date;
    },
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<Organization>> {
    const queryBuilder = this.organizationRepository.createQueryBuilder('org');

    this.applyOrgFilters(queryBuilder, filters);

    // Apply pagination and sorting
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    const sortBy = pagination?.sortBy || 'name';
    const sortOrder = pagination?.sortOrder || 'ASC';
    queryBuilder.orderBy(`org.${sortBy}`, sortOrder);

    // Execute query
    const [data, total] = await queryBuilder.getManyAndCount();

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
   * Get organization by ID with optional related data
   * @param id Organization ID
   * @param options Loading options
   * @returns Organization or null
   */
  async getOrganizationById(
    id: string,
    options?: {
      includeHierarchy?: boolean;
      includeMembers?: boolean;
      includeSettings?: boolean;
      includePermissions?: boolean;
      includeStats?: boolean;
    }
  ): Promise<Organization | null> {
    // Use cache for simple lookups (no relations)
    const hasOptions = options && Object.values(options).some(Boolean);
    if (!hasOptions) {
      const cached = this.cache.get<Organization>(`org:${id}`);
      if (cached) {
        return cached;
      }
    }

    const queryBuilder = this.organizationRepository
      .createQueryBuilder('organization')
      .where('organization.id = :id', { id });

    if (options?.includeHierarchy) {
      queryBuilder
        .leftJoinAndSelect('organization.parent', 'parent')
        .leftJoinAndSelect('organization.children', 'children');
    }

    if (options?.includeMembers) {
      queryBuilder
        .leftJoinAndSelect('organization.memberships', 'memberships')
        .leftJoinAndSelect('memberships.user', 'membershipUser');
    }

    const organization = await queryBuilder.getOne();

    if (!organization) {
      return null;
    }

    // Load additional data if requested
    if (options?.includeSettings) {
      organization.settings = await this.settingsService.getEffectiveSettings(id);
    }

    if (options?.includeStats) {
      // Add statistics (member count, etc.)
      const memberStats = await this.memberService.getMemberStats(id);
      (organization as Organization & { stats: typeof memberStats }).stats = memberStats;
    }

    return organization;
  }

  /**
   * Create new organization
   * @param orgData Organization data
   * @param creatorId User creating the organization
   * @param parentId Optional parent organization ID
   * @returns Created organization
   */
  async createOrganization(
    orgData: Partial<Organization>,
    creatorId: string,
    parentId?: string
  ): Promise<Organization> {
    logger.info('Creating organization', {
      organizationName: orgData.name,
      creatorId,
      parentId,
      type: orgData.type,
    });

    let organization!: Organization;

    // Reusable helper: translate a DB unique-constraint violation into a friendly ValidationError.
    const throwIfDuplicateOrgName = (err: unknown): never => {
      if (err instanceof QueryFailedError && err.driverError?.code === '23505') {
        throw new ValidationError(`An organization named "${orgData.name}" already exists`);
      }
      throw err;
    };

    // Check org name uniqueness (case-insensitive) for a friendly error message.
    // A DB unique index on LOWER(name) is the hard safety net against TOCTOU races.
    if (orgData.name) {
      const existing = await this.organizationRepository
        .createQueryBuilder('org')
        .where('LOWER(org.name) = LOWER(:name)', { name: orgData.name })
        .getOne();
      if (existing) {
        throw new ValidationError(`An organization named "${orgData.name}" already exists`);
      }
    }

    if (parentId) {
      // Create as sub-organization
      try {
        organization = await this.hierarchyService.createSubOrganization(parentId, {
          ...orgData,
          ownerId: creatorId,
        });
      } catch (err: unknown) {
        throwIfDuplicateOrgName(err);
      }
    } else {
      // Create as root organization
      organization = this.organizationRepository.create({
        ...orgData,
        id: orgData.id || randomUUID(),
        ownerId: creatorId,
        type: orgData.type || OrganizationType.ROOT,
        level: 0,
        status: orgData.status || OrganizationStatus.ACTIVE,
        memberCount: 0,
      } as Partial<Organization>);

      try {
        organization = await this.organizationRepository.save(organization);
      } catch (err: unknown) {
        throwIfDuplicateOrgName(err);
      }
    }

    // Seed default roles, teams, and hierarchy BEFORE adding the creator
    // (addMember resolves role by name, so the 'owner' role must exist first)
    try {
      await getOrgDefaultsService().seedDefaults(organization.id);
    } catch (seedError: unknown) {
      // Non-fatal: defaults seeding is optional
      logger.warn('Failed to seed organization defaults', {
        organizationId: organization.id,
        error: seedError instanceof Error ? seedError.message : String(seedError),
      });
    }

    // Add creator as founder member
    await this.memberService.addMember(
      organization.id,
      creatorId,
      'founder',
      'Founder',
      undefined,
      undefined,
      { acquisitionSource: 'founder' }
    );

    // Apply default permissions for owner
    await this.permissionService.applyPermissionTemplate(
      organization.id,
      creatorId,
      'OWNER',
      creatorId
    );

    // Log creation activity
    await this.activityService.logOrgCreated(organization.id, creatorId, organization);

    // Auto-create a public profile stub (isPublic defaults to false)
    // This ensures the org can easily opt-in to the public directory later
    try {
      const profileRepo = AppDataSource.getRepository(PublicOrgProfile);
      const profile = profileRepo.create({
        organizationId: organization.id,
        isPublic: false,
        primaryFocus: OrgPrimaryFocus.MIXED,
        memberCount: 1,
      });
      await profileRepo.save(profile);
    } catch (profileError) {
      // Non-fatal: public profile creation is optional
      logger.warn('Failed to auto-create public profile for organization', {
        organizationId: organization.id,
        error: profileError instanceof Error ? profileError.message : String(profileError),
      });
    }

    // Emit audit log
    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'ORG_CREATED',
      message: `Organization created: ${organization.name}`,
      userId: creatorId,
      organizationId: organization.id,
      resource: `organization/${organization.id}`,
      metadata: {
        organizationType: organization.type,
        parentId,
        ownerId: creatorId,
      },
    });

    return organization;
  }

  /**
   * Update organization
   * @param id Organization ID
   * @param updates Organization updates
   * @param actorId User performing update
   * @returns Updated organization
   */
  async updateOrganization(
    id: string,
    updates: Partial<Organization>,
    actorId: string
  ): Promise<Organization> {
    logger.info('Updating organization', {
      organizationId: id,
      actorId,
      updateFields: Object.keys(updates),
    });

    const before = await this.getOrganizationById(id);
    if (!before) {
      throw new Error('Organization not found');
    }

    // Check permissions
    const hasPermission = await this.permissionService.checkPermission(
      actorId,
      id,
      'ORGANIZATION' as ResourceType,
      'EDIT' as PermissionAction
    );

    if (!hasPermission.allowed) {
      throw new Error('Insufficient permissions to update organization');
    }

    // Strip immutable fields — the id (tag) must never change
    const { id: _stripId, ...safeUpdates } = updates;

    // Perform update
    await this.organizationRepository.update(
      id,
      safeUpdates as QueryDeepPartialEntity<Organization>
    );
    this.cache.del(`org:${id}`);
    const after = await this.getOrganizationById(id);

    if (!after) {
      throw new Error('Organization not found after update');
    }

    // Log update activity
    await this.activityService.logOrgUpdated(id, actorId, before, after);

    // Emit audit log
    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'ORG_UPDATED',
      message: `Organization updated: ${after.name}`,
      userId: actorId,
      organizationId: id,
      resource: `organization/${id}`,
      metadata: {
        updateFields: Object.keys(updates),
      },
    });

    return after;
  }

  /**
   * Rename an organization with uniqueness validation.
   * The organization id (tag) remains immutable — only the display name changes.
   */
  async renameOrganization(id: string, newName: string, actorId: string): Promise<Organization> {
    const before = await this.getOrganizationById(id);
    if (!before) {
      throw new NotFoundError('Organization');
    }

    // Check permissions
    const hasPermission = await this.permissionService.checkPermission(
      actorId,
      id,
      'ORGANIZATION' as ResourceType,
      'EDIT' as PermissionAction
    );

    if (!hasPermission.allowed) {
      throw new ForbiddenError('Insufficient permissions to rename organization');
    }

    // Check name uniqueness (case-insensitive)
    const existing = await this.organizationRepository
      .createQueryBuilder('org')
      .where('LOWER(org.name) = LOWER(:name) AND org.id != :id', { name: newName, id })
      .getOne();

    if (existing) {
      throw new ValidationError(`An organization named "${newName}" already exists`);
    }

    // Perform rename
    await this.organizationRepository.update(id, { name: newName });
    this.cache.del(`org:${id}`);
    const after = await this.getOrganizationById(id);

    if (!after) {
      throw new Error('Organization not found after rename');
    }

    // Log update activity
    await this.activityService.logOrgUpdated(id, actorId, before, after);

    logger.info('Organization renamed', {
      organizationId: id,
      oldName: before.name,
      newName,
      performedBy: actorId,
    });

    return after;
  }

  /**
   * Pull the current organization name from RSI and apply it.
   * Requires the org to have an rsiSid set (verified or not).
   */
  async syncNameFromRsi(
    id: string,
    actorId: string
  ): Promise<{ organization: Organization; rsiName: string }> {
    const org = await this.getOrganizationById(id);
    if (!org) {
      throw new NotFoundError('Organization');
    }

    if (!org.rsiSid) {
      throw new ValidationError(
        'Organization does not have an RSI SID linked. Please verify your organization with RSI first.'
      );
    }

    // Check permissions
    const hasPermission = await this.permissionService.checkPermission(
      actorId,
      id,
      'ORGANIZATION' as ResourceType,
      'EDIT' as PermissionAction
    );

    if (!hasPermission.allowed) {
      throw new ForbiddenError('Insufficient permissions to sync organization name from RSI');
    }

    // Fetch from RSI (crawl directly from robertsspaceindustries.com)
    const rsiData = await rsiCrawlerService.crawlOrganization(org.rsiSid);

    if (!rsiData.name) {
      throw new ValidationError('RSI did not return a name for this organization');
    }

    // Apply the name if it differs
    if (rsiData.name === org.name) {
      return { organization: org, rsiName: rsiData.name };
    }

    const updated = await this.renameOrganization(id, rsiData.name, actorId);

    logger.info('Organization name synced from RSI', {
      organizationId: id,
      oldName: org.name,
      rsiName: rsiData.name,
      performedBy: actorId,
    });

    return { organization: updated, rsiName: rsiData.name };
  }

  /**
   * Delete organization - Creates deletion request with admin approval workflow
   * @param id Organization ID
   * @param actorId User performing deletion
   * @param deleteDescendants Whether to delete child organizations
   * @param options Additional options for deletion request
   */
  async deleteOrganization(
    id: string,
    actorId: string,
    deleteDescendants: boolean = false,
    options?: {
      reason?: string;
      gracePeriodDays?: number;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<{ requestId: string; message: string; scheduledFor?: Date }> {
    logger.info('Requesting organization deletion', {
      organizationId: id,
      actorId,
      deleteDescendants,
      reason: options?.reason,
    });

    const organization = await this.getOrganizationById(id);
    if (!organization) {
      throw new Error('Organization not found');
    }

    // Check permissions
    const hasPermission = await this.permissionService.checkPermission(
      actorId,
      id,
      'ORGANIZATION' as ResourceType,
      'DELETE' as PermissionAction
    );

    if (!hasPermission.allowed) {
      throw new Error('Insufficient permissions to delete organization');
    }

    // Create deletion request instead of immediate deletion
    const request = await this.deletionService.createDeletionRequest(id, actorId, {
      ...options,
      deleteDescendants,
    });

    // Emit audit log (detailed audit logged by OrganizationDeletionService)
    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'ORG_DELETION_INITIATED',
      message: `Organization deletion request initiated: ${organization.name}`,
      userId: actorId,
      organizationId: id,
      resource: `organization/${id}`,
      metadata: {
        requestId: request.id,
        deleteDescendants,
        reason: options?.reason,
      },
    });

    return {
      requestId: request.id,
      message: 'Deletion request created successfully. Awaiting admin approval.',
      scheduledFor: request.scheduledFor,
    };
  }

  // ==================== SPECIALIZED OPERATIONS ====================

  /**
   * Get organization with full hierarchy tree
   * @param id Organization ID
   * @returns Organization with hierarchy tree
   */
  async getOrganizationWithHierarchy(
    id: string
  ): Promise<(Organization & { children?: Organization[] }) | null> {
    const organization = await this.getOrganizationById(id);
    if (!organization) {
      return null;
    }

    if (organization.level === 0) {
      // If it's a root organization, get the full tree
      return this.hierarchyService.getTree(id);
    } else {
      // If it's a sub-organization, get its subtree
      const tree = await this.hierarchyService.getTree(organization.rootOrgId || id);
      // Find this organization in the tree and return its subtree
      const findSubtree = (
        node: Organization & { children?: Organization[] }
      ): (Organization & { children?: Organization[] }) | null => {
        if (node.id === id) {
          return node;
        }
        if (node.children) {
          for (const child of node.children) {
            const result = findSubtree(child);
            if (result) {
              return result;
            }
          }
        }
        return null;
      };
      return findSubtree(tree);
    }
  }

  /**
   * Search organizations with advanced criteria
   * @param query Search query
   * @param filters Additional filters
   * @param pagination Pagination options
   * @returns Search results
   */
  async searchOrganizations(
    query: string,
    filters?: {
      type?: OrganizationType[];
      status?: OrganizationStatus[];
      hasPublicProfile?: boolean;
      minMembers?: number;
      maxMembers?: number;
      tags?: string[];
    },
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<Organization>> {
    const queryBuilder = this.organizationRepository.createQueryBuilder('org');

    // Text search across multiple fields
    if (query) {
      addFullTextSearch(
        queryBuilder,
        'org',
        query,
        ['name', 'description'],
        'search_vector',
        'orgSearch'
      );
    }

    // Apply filters
    if (filters?.type && filters.type.length > 0) {
      queryBuilder.andWhere('org.type IN (:...types)', { types: filters.type });
    }

    if (filters?.status && filters.status.length > 0) {
      queryBuilder.andWhere('org.status IN (:...statuses)', { statuses: filters.status });
    }

    if (filters?.hasPublicProfile !== undefined) {
      queryBuilder.andWhere('org.isPublic = :isPublic', { isPublic: filters.hasPublicProfile });
    }

    if (filters?.minMembers !== undefined) {
      queryBuilder.andWhere('org.memberCount >= :minMembers', { minMembers: filters.minMembers });
    }

    if (filters?.maxMembers !== undefined) {
      queryBuilder.andWhere('org.memberCount <= :maxMembers', { maxMembers: filters.maxMembers });
    }

    if (filters?.tags && filters.tags.length > 0) {
      queryBuilder.andWhere('org.tags && :tags', { tags: filters.tags });
    }

    // Apply pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Apply sorting (relevance-based for search)
    queryBuilder.orderBy('org.memberCount', 'DESC');
    queryBuilder.addOrderBy('org.name', 'ASC');

    const [data, total] = await queryBuilder.getManyAndCount();

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
   * Get organization statistics
   * @param id Organization ID
   * @returns Organization statistics
   */
  async getOrganizationStats(id: string): Promise<{
    memberStats: unknown;
    hierarchyStats: unknown;
    activitySummary: unknown;
    recentActivity: unknown[];
  }> {
    const [memberStats, hierarchyStats, activitySummary, recentActivity] = await Promise.all([
      this.memberService.getMemberStats(id),
      this.hierarchyService.getHierarchyStats(id),
      this.activityService.getActivitySummary(id, 30), // Last 30 days
      this.activityService.getRecentActivities(id, 10),
    ]);

    return {
      memberStats,
      hierarchyStats,
      activitySummary,
      recentActivity,
    };
  }

  /**
   * Check if user can access organization
   * @param userId User ID
   * @param orgId Organization ID
   * @returns Access check result
   */
  async canUserAccessOrganization(
    userId: string,
    orgId: string
  ): Promise<{
    canAccess: boolean;
    reason?: string;
    accessLevel?: 'owner' | 'admin' | 'member' | 'viewer' | 'none';
  }> {
    // Check if user is member
    const isMember = await this.memberService.isMember(orgId, userId);
    if (isMember) {
      const membership = await this.memberService.getMember(orgId, userId);
      return {
        canAccess: true,
        accessLevel:
          (getRoleName(membership?.role) as
            'member' | 'none' | 'admin' | 'owner' | 'viewer' | undefined) || 'member',
      };
    }

    // Check organization visibility
    const organization = await this.getOrganizationById(orgId);
    if (!organization) {
      return {
        canAccess: false,
        reason: 'Organization not found',
        accessLevel: 'none',
      };
    }

    // Check organization visibility settings
    const visibility = organization.settings?.visibility || 'private';
    if (visibility === 'public') {
      return {
        canAccess: true,
        accessLevel: 'viewer',
      };
    }

    return {
      canAccess: false,
      reason: 'Organization is private and user is not a member',
      accessLevel: 'none',
    };
  }

  // ==================== SERVICE DELEGATION ====================

  /**
   * Get hierarchy service for advanced hierarchy operations
   */
  getHierarchyService(): OrganizationHierarchyService {
    return this.hierarchyService;
  }

  /**
   * Get permission service for permission management
   */
  getPermissionService(): OrganizationPermissionService {
    return this.permissionService;
  }

  /**
   * Get member service for member management
   */
  getMemberService(): OrganizationMemberService {
    return this.memberService;
  }

  /**
   * Get activity service for activity logging and retrieval
   */
  getActivityService(): OrganizationActivityService {
    return this.activityService;
  }

  /**
   * Get settings service for settings management
   */
  getSettingsService(): OrganizationSettingsService {
    return this.settingsService;
  }
}
