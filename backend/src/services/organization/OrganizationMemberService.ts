import { EntityManager, In, Not } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Invitation } from '../../models/Invitation';
import { Organization } from '../../models/Organization';
import {
  MembershipAcquisitionSource,
  OrganizationMembership,
} from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { ForbiddenError, NotFoundError } from '../../utils/apiErrors';
import { invalidateMemberStatsCache } from '../../utils/cacheInvalidation';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { cache } from '../../utils/redis';
import { getRoleName, isOwnerRole } from '../../utils/roleUtils';
import { AuditCategory, auditService } from '../audit/AuditService';
import { getRoleService } from '../security/core/RoleService';
import { domainEvents } from '../shared/DomainEventBus';

import { OrganizationPermissionService } from './OrganizationPermissionService';

/**
 * Member invitation data
 */
export interface MemberInvitation {
  email: string;
  role: string;
  title?: string;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Member statistics
 */
export interface MemberStats {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  membersByRole: Record<string, number>;
  membersByAcquisition: Record<string, number>;
  recentJoins: number;
  recentDepartures: number;
}

/**
 * Service for managing organization members
 * Handles membership operations, roles, transfers, and invitations
 */
export class OrganizationMemberService {
  private readonly membershipRepository = AppDataSource.getRepository(OrganizationMembership);
  private readonly organizationRepository = AppDataSource.getRepository(Organization);
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly invitationRepository = AppDataSource.getRepository(Invitation);
  private readonly roleService = getRoleService();
  private readonly orgPermissionService = new OrganizationPermissionService();

  // ==================== MEMBER CRUD OPERATIONS ====================

  /**
   * Add a member to organization
   * @param orgId Organization ID
   * @param userId User ID to add
   * @param role Member role
   * @param title Optional job title
   * @param metadata Additional metadata
   * @param manager Optional EntityManager for transaction support
   * @returns Created membership
   */
  async addMember(
    orgId: string,
    userId: string,
    role: string = 'member',
    title?: string,
    metadata?: Record<string, unknown>,
    manager?: EntityManager,
    options?: { acquisitionSource?: MembershipAcquisitionSource; acquisitionRefId?: string }
  ): Promise<OrganizationMembership> {
    // Use provided manager or default to repository
    const orgRepo = manager ? manager.getRepository(Organization) : this.organizationRepository;
    const userRepo = manager ? manager.getRepository(User) : this.userRepository;
    const membershipRepo = manager
      ? manager.getRepository(OrganizationMembership)
      : this.membershipRepository;

    // Check if organization exists
    const org = await orgRepo.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Check if user exists
    const user = await userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if already a member
    const existing = await membershipRepo.findOne({
      where: {
        organizationId: orgId,
        userId,
      },
    });

    if (existing?.isActive) {
      throw new Error('User is already a member of this organization');
    }

    // Validate role name. If the conventional 'member' role was renamed by the
    // org admin (e.g. to 'associate'), fall back to the lowest-priority role.
    const roleName = role || 'member';
    const resolvedRoleId = await getRoleService().resolveRoleIdWithDefaultFallback(roleName, orgId);
    if (!resolvedRoleId) {
      throw new Error(`Role '${roleName}' not found for organization ${orgId}`);
    }

    // If exists but inactive, reactivate
    if (existing && !existing.isActive) {
      existing.isActive = true;
      existing.roleId = resolvedRoleId;
      existing.title = title;
      existing.joinedAt = new Date();
      existing.leftAt = undefined;
      existing.metadata = { ...existing.metadata, ...metadata };
      if (options?.acquisitionSource) {
        existing.acquisitionSource = options.acquisitionSource;
        existing.acquisitionRefId = options.acquisitionRefId;
      }
      const reactivated = await membershipRepo.save(existing);

      // Auto-set active org if user has none
      if (!user.activeOrgId) {
        user.activeOrgId = orgId;
        await userRepo.save(user);
      }

      return reactivated;
    }

    // Create new membership
    const membership = membershipRepo.create({
      organizationId: orgId,
      userId,
      roleId: resolvedRoleId,
      title,
      isActive: true,
      joinedAt: new Date(),
      metadata,
      acquisitionSource: options?.acquisitionSource,
      acquisitionRefId: options?.acquisitionRefId,
    });

    const saved = await membershipRepo.save(membership);

    // Auto-set active org if user has none
    if (!user.activeOrgId) {
      user.activeOrgId = orgId;
      await userRepo.save(user);
    }

    // Update organization member count.
    // NOTE: When a transaction manager is provided, this method does NOT update the
    // member count. Callers that pass a manager (i.e. run this logic inside an
    // explicit transaction) are responsible for invoking `updateMemberCount(orgId)`
    // themselves after the surrounding transaction successfully commits. This avoids
    // transaction-related issues while keeping count consistency under caller control.
    if (!manager) {
      await this.updateMemberCount(orgId);
      invalidateMemberStatsCache(orgId);
    }

    logger.info('OrganizationMemberService.addMember: Member added', {
      orgId,
      userId,
      role,
      acquisitionSource: options?.acquisitionSource,
    });
    auditService.log({
      category: AuditCategory.MEMBERSHIP,
      action: 'MEMBER_ADDED',
      message: `Member ${userId} added to organization ${orgId} with role '${role}'`,
      userId,
      organizationId: orgId,
      resource: `org/${orgId}/member/${userId}`,
      metadata: { role, acquisitionSource: options?.acquisitionSource },
    });

    return saved;
  }

  /**
   * Remove a member from organization
   * @param orgId Organization ID
   * @param userId User ID to remove
   * @param permanent Whether to permanently delete (vs mark inactive)
   */
  async removeMember(orgId: string, userId: string, permanent: boolean = false): Promise<void> {
    const membership = await this.membershipRepository.findOne({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    if (permanent) {
      await this.membershipRepository.delete(membership.id);
    } else {
      membership.isActive = false;
      membership.leftAt = new Date();
      await this.membershipRepository.save(membership);
    }

    // Update organization member count
    await this.updateMemberCount(orgId);
    invalidateMemberStatsCache(orgId);

    logger.info('OrganizationMemberService.removeMember: Member removed', {
      orgId,
      userId,
      permanent,
    });
    auditService.log({
      category: AuditCategory.MEMBERSHIP,
      action: permanent ? 'MEMBER_REMOVED_PERMANENT' : 'MEMBER_REMOVED',
      message: `Member ${userId} removed from organization ${orgId} (permanent: ${permanent})`,
      userId,
      organizationId: orgId,
      resource: `org/${orgId}/member/${userId}`,
      metadata: { permanent },
    });
  }

  /**
   * Leave an organization (self-removal)
   * Validates that the user is an active member and not the owner.
   * Clears activeOrgId if the user was viewing this org.
   *
   * NOTE: UserOrganizationService also has a leaveOrganization method with its
   * own route (DELETE /users/:userId/organizations/:organizationId). This
   * implementation adds owner-check and activeOrgId cleanup. The two should be
   * consolidated in a future refactor — see TECH_DEBT.md.
   *
   * @param orgId Organization ID
   * @param userId User ID of the member leaving
   * @param authenticatedUserId The currently authenticated user — must match userId
   */
  async leaveOrganization(
    orgId: string,
    userId: string,
    authenticatedUserId: string
  ): Promise<void> {
    if (userId !== authenticatedUserId) {
      throw new ForbiddenError('You can only remove yourself from an organization');
    }

    const membership = await this.membershipRepository.findOne({
      where: { organizationId: orgId, userId, isActive: true },
      relations: ['role'],
    });

    if (!membership) {
      throw new NotFoundError('Membership');
    }

    if (isOwnerRole(membership.role)) {
      throw new ForbiddenError('Organization owners cannot leave. Transfer ownership first.');
    }

    let username = userId;
    await AppDataSource.transaction(async (manager: EntityManager) => {
      // Deactivate membership inside the transaction
      membership.isActive = false;
      membership.leftAt = new Date();
      await manager.save(membership);

      // Clear activeOrgId if the user was viewing this org
      const user = await manager.findOne(User, { where: { id: userId } });
      if (user) {
        username = user.username;
        if (user.activeOrgId === orgId) {
          user.activeOrgId = undefined;
          await manager.save(user);
        }
      }
    });

    // Post-transaction side effects
    await this.updateMemberCount(orgId);
    invalidateMemberStatsCache(orgId);

    logger.info(`User ${userId} left organization ${orgId}`);

    domainEvents.emit('member:platform_left', {
      timestamp: new Date().toISOString(),
      userId,
      organizationId: orgId,
      username,
    });
  }

  /**
   * Update member role
   * @param orgId Organization ID
   * @param userId User ID
   * @param newRole New role
   * @returns Updated membership
   */
  async updateMemberRole(
    orgId: string,
    userId: string,
    newRole?: string,
    newRoleId?: string
  ): Promise<OrganizationMembership> {
    const membership = await this.membershipRepository.findOne({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    let role = null;

    if (newRoleId) {
      role = await this.roleService.getRoleById(newRoleId);
      if (role?.organizationId !== orgId) {
        throw new Error('Role not found for this organization');
      }
    } else {
      const roleName = newRole?.trim() ?? '';
      const ALLOWED_ROLE_PATTERN = /^[a-z][a-z0-9_-]{1,49}$/i;
      if (!ALLOWED_ROLE_PATTERN.test(roleName)) {
        throw new Error(
          `Invalid role name: '${roleName}'. Only letters, numbers, hyphens, and underscores are allowed.`
        );
      }

      role = await this.roleService.getOrCreateRole(roleName, orgId);
    }

    membership.roleId = role.id;
    membership.role = role;
    return this.membershipRepository.save(membership);
  }

  /**
   * Update member title
   * @param orgId Organization ID
   * @param userId User ID
   * @param title New title
   * @returns Updated membership
   */
  async updateMemberTitle(
    orgId: string,
    userId: string,
    title: string
  ): Promise<OrganizationMembership> {
    const membership = await this.membershipRepository.findOne({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    membership.title = title;
    return this.membershipRepository.save(membership);
  }

  /**
   * Update member permissions
   * @param orgId Organization ID
   * @param userId User ID
   * @param permissions New permissions array
   * @returns Updated membership
   */
  async updateMemberPermissions(
    orgId: string,
    userId: string,
    permissions: string[]
  ): Promise<OrganizationMembership> {
    const membership = await this.membershipRepository.findOne({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    membership.permissions = permissions;
    return this.membershipRepository.save(membership);
  }

  /**
   * Update member metadata
   * @param orgId Organization ID
   * @param userId User ID
   * @param metadata Metadata to merge
   * @returns Updated membership
   */
  async updateMemberMetadata(
    orgId: string,
    userId: string,
    metadata: Record<string, unknown>
  ): Promise<OrganizationMembership> {
    const membership = await this.membershipRepository.findOne({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
      },
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    membership.metadata = { ...membership.metadata, ...metadata };
    return this.membershipRepository.save(membership);
  }

  // ==================== MEMBER QUERIES ====================

  /**
   * Get member by user ID
   * @param orgId Organization ID
   * @param userId User ID
   * @returns Membership or null
   */
  async getMember(orgId: string, userId: string): Promise<OrganizationMembership | null> {
    return this.membershipRepository.findOne({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
      },
      relations: ['user', 'organization'],
    });
  }

  /**
   * Get all members of organization
   * @param orgId Organization ID
   * @param includeInactive Include inactive members
   * @param pagination Pagination options
   * @returns Paginated members
   */
  async getMembers(
    orgId: string,
    includeInactive: boolean = false,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<OrganizationMembership>> {
    const queryBuilder = this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.user', 'user')
      .where('membership.organizationId = :orgId', { orgId });

    if (!includeInactive) {
      queryBuilder.andWhere('membership.isActive = true');
    }

    // Apply pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Apply sorting
    const sortBy = pagination?.sortBy || 'joinedAt';
    const sortOrder = pagination?.sortOrder || 'DESC';
    queryBuilder.orderBy(`membership.${sortBy}`, sortOrder);

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
   * Get members by role
   * @param orgId Organization ID
   * @param role Role to filter by
   * @returns Array of memberships
   */
  async getMembersByRole(orgId: string, role: string): Promise<OrganizationMembership[]> {
    return this.membershipRepository.find({
      where: {
        organizationId: orgId,
        role: { name: role },
        isActive: true,
      },
      relations: ['user', 'role'],
      order: { joinedAt: 'DESC' },
    });
  }

  /**
   * Check if user is member
   * @param orgId Organization ID
   * @param userId User ID
   * @returns True if active member
   */
  async isMember(orgId: string, userId: string): Promise<boolean> {
    const count = await this.membershipRepository.count({
      where: {
        organizationId: orgId,
        userId,
        isActive: true,
      },
    });

    return count > 0;
  }

  /**
   * Get user's organizations
   * @param userId User ID
   * @param includeInactive Include inactive memberships
   * @returns Array of memberships
   */
  async getUserOrganizations(
    userId: string,
    includeInactive: boolean = false
  ): Promise<OrganizationMembership[]> {
    const queryBuilder = this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.organization', 'organization')
      .where('membership.userId = :userId', { userId });

    if (!includeInactive) {
      queryBuilder.andWhere('membership.isActive = true');
    }

    return queryBuilder.orderBy('membership.joinedAt', 'DESC').getMany();
  }

  // ==================== MEMBER TRANSFERS ====================

  /**
   * Transfer member to another organization
   * @param fromOrgId Source organization ID
   * @param toOrgId Destination organization ID
   * @param userId User ID to transfer
   * @param newRole Role in new organization
   * @param keepMembership Keep membership in source org
   * @returns New membership
   */
  async transferMember(
    fromOrgId: string,
    toOrgId: string,
    userId: string,
    newRole?: string,
    keepMembership: boolean = false
  ): Promise<OrganizationMembership> {
    // Get current membership
    const currentMembership = await this.membershipRepository.findOne({
      where: { organizationId: fromOrgId, userId },
    });
    if (!currentMembership) {
      throw new Error('Member not found in source organization');
    }

    // Check if already member of target org
    const existingInTarget = await this.isMember(toOrgId, userId);
    if (existingInTarget) {
      throw new Error('User is already a member of target organization');
    }

    // Create new membership in target org
    const newMembership = await this.addMember(
      toOrgId,
      userId,
      newRole || getRoleName(currentMembership.role) || 'member',
      currentMembership.title,
      {
        ...currentMembership.metadata,
        transferredFrom: fromOrgId,
        transferredAt: new Date(),
      }
    );

    // Remove from source org unless keeping membership
    if (!keepMembership) {
      await this.removeMember(fromOrgId, userId, false);
    }

    return newMembership;
  }

  /**
   * Bulk transfer members
   * @param fromOrgId Source organization ID
   * @param toOrgId Destination organization ID
   * @param userIds Array of user IDs to transfer
   * @param newRole Optional new role for all
   * @returns Array of new memberships
   */
  async bulkTransferMembers(
    fromOrgId: string,
    toOrgId: string,
    userIds: string[],
    newRole?: string
  ): Promise<OrganizationMembership[]> {
    const transferred: OrganizationMembership[] = [];

    for (const userId of userIds) {
      try {
        const membership = await this.transferMember(fromOrgId, toOrgId, userId, newRole, false);
        transferred.push(membership);
      } catch (error: unknown) {
        // Log error but continue with other transfers
        logger.error(`Failed to transfer user ${userId}:`, error);
      }
    }

    return transferred;
  }

  // ==================== MEMBER SEARCH ====================

  /**
   * Search members
   * @param orgId Organization ID
   * @param filters Search filters
   * @param pagination Pagination options
   * @returns Paginated search results
   */
  async searchMembers(
    orgId: string,
    filters: {
      query?: string;
      role?: string;
      roles?: string[];
      joinedAfter?: Date;
      joinedBefore?: Date;
      hasPermission?: string;
    },
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<OrganizationMembership>> {
    const queryBuilder = this.membershipRepository
      .createQueryBuilder('membership')
      .leftJoinAndSelect('membership.user', 'user')
      .leftJoinAndSelect('membership.role', 'memberRole')
      .where('membership.organizationId = :orgId', { orgId })
      .andWhere('membership.isActive = true');

    // Apply filters
    if (filters.query) {
      queryBuilder.andWhere(
        '(user.username ILIKE :query OR user.email ILIKE :query OR membership.title ILIKE :query)',
        { query: `%${filters.query}%` }
      );
    }

    if (filters.role) {
      queryBuilder.andWhere('memberRole.name = :role', { role: filters.role });
    }

    if (filters.roles && filters.roles.length > 0) {
      queryBuilder.andWhere('memberRole.name IN (:...roles)', { roles: filters.roles });
    }

    if (filters.joinedAfter) {
      queryBuilder.andWhere('membership.joinedAt >= :joinedAfter', {
        joinedAfter: filters.joinedAfter,
      });
    }

    if (filters.joinedBefore) {
      queryBuilder.andWhere('membership.joinedAt <= :joinedBefore', {
        joinedBefore: filters.joinedBefore,
      });
    }

    if (filters.hasPermission) {
      queryBuilder.andWhere(':permission = ANY(membership.permissions)', {
        permission: filters.hasPermission,
      });
    }

    // Apply pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Apply sorting
    const sortBy = pagination?.sortBy || 'joinedAt';
    const sortOrder = pagination?.sortOrder || 'DESC';
    queryBuilder.orderBy(`membership.${sortBy}`, sortOrder);

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

  // ==================== MEMBER STATISTICS ====================

  /**
   * Get member statistics for organization
   * @param orgId Organization ID
   * @param daysBack Days to look back for recent joins/departures
   * @returns Member statistics
   */
  async getMemberStats(orgId: string, daysBack: number = 30): Promise<MemberStats> {
    // Redis cache: 5 min TTL (Phase 5.2)
    const cacheKey = `org:${orgId}:member:stats`;
    const cached = await cache.get<MemberStats>(cacheKey);
    if (cached) {
      return cached;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Single aggregation query: counts by role + active/inactive totals
    const roleStats = await this.membershipRepository
      .createQueryBuilder('m')
      .select('LOWER(m.role)', 'role')
      .addSelect('COUNT(*)::int', 'count')
      .where('m.organizationId = :orgId', { orgId })
      .andWhere('m.isActive = true')
      .groupBy('LOWER(m.role)')
      .getRawMany<{ role: string; count: number }>();

    // Totals + recent joins/departures in one query
    const totals = await this.membershipRepository
      .createQueryBuilder('m')
      .select('COUNT(*)::int', 'total')
      .addSelect('SUM(CASE WHEN m."isActive" = true THEN 1 ELSE 0 END)::int', 'active')
      .addSelect('SUM(CASE WHEN m."isActive" = false THEN 1 ELSE 0 END)::int', 'inactive')
      .addSelect(
        `SUM(CASE WHEN m."isActive" = true AND m."joinedAt" >= :cutoff THEN 1 ELSE 0 END)::int`,
        'recentJoins'
      )
      .addSelect(
        `SUM(CASE WHEN m."isActive" = false AND m."leftAt" >= :cutoff THEN 1 ELSE 0 END)::int`,
        'recentDepartures'
      )
      .where('m.organizationId = :orgId', { orgId })
      .setParameter('cutoff', cutoffDate)
      .getRawOne<{
        total: number;
        active: number;
        inactive: number;
        recentJoins: number;
        recentDepartures: number;
      }>();

    const membersByRole: Record<string, number> = {};
    for (const row of roleStats) {
      membersByRole[row.role || 'unknown'] = row.count;
    }

    // Acquisition funnel: how active members arrived (application/invitation/founder/…).
    const acquisitionStats = await this.membershipRepository
      .createQueryBuilder('m')
      .select("COALESCE(m.acquisitionSource, 'unknown')", 'source')
      .addSelect('COUNT(*)::int', 'count')
      .where('m.organizationId = :orgId', { orgId })
      .andWhere('m.isActive = true')
      .groupBy("COALESCE(m.acquisitionSource, 'unknown')")
      .getRawMany<{ source: string; count: number }>();

    const membersByAcquisition: Record<string, number> = {};
    for (const row of acquisitionStats) {
      membersByAcquisition[row.source] = row.count;
    }

    const result: MemberStats = {
      totalMembers: totals?.total ?? 0,
      activeMembers: totals?.active ?? 0,
      inactiveMembers: totals?.inactive ?? 0,
      membersByRole,
      membersByAcquisition,
      recentJoins: totals?.recentJoins ?? 0,
      recentDepartures: totals?.recentDepartures ?? 0,
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, result, 300);

    return result;
  }

  /**
   * Get member retention rate
   * @param orgId Organization ID
   * @param periodDays Period in days to calculate retention
   * @returns Retention percentage
   */
  async getMemberRetention(orgId: string, periodDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);

    const membersAtStart = await this.membershipRepository.count({
      where: {
        organizationId: orgId,
        joinedAt: Not(In([cutoffDate])),
      },
    });

    const stillActive = await this.membershipRepository.count({
      where: {
        organizationId: orgId,
        joinedAt: Not(In([cutoffDate])),
        isActive: true,
      },
    });

    if (membersAtStart === 0) {
      return 100;
    }

    return (stillActive / membersAtStart) * 100;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Update organization member count
   * @param orgId Organization ID
   */
  private async updateMemberCount(orgId: string): Promise<void> {
    const count = await this.membershipRepository.count({
      where: {
        organizationId: orgId,
        isActive: true,
      },
    });

    await this.organizationRepository.update({ id: orgId }, { totalMembers: count });
  }

  /**
   * Validate member exists
   * @param orgId Organization ID
   * @param userId User ID
   * @throws Error if member not found
   */
  async validateMemberExists(orgId: string, userId: string): Promise<void> {
    const exists = await this.isMember(orgId, userId);
    if (!exists) {
      throw new Error('User is not a member of this organization');
    }
  }

  /**
   * Get member count for organization
   * @param orgId Organization ID
   * @returns Number of active members
   */
  async getMemberCount(orgId: string): Promise<number> {
    return this.membershipRepository.count({
      where: {
        organizationId: orgId,
        isActive: true,
      },
    });
  }

  // ==================== BATCH OPERATIONS ====================

  /**
   * Batch add multiple members to organization
   * PERFORMANCE OPTIMIZATION: Uses single bulk insert instead of sequential adds
   *
   * @param orgId Organization ID
   * @param members Array of user IDs with roles
   * @returns Array of created memberships
   */
  async batchAddMembers(
    orgId: string,
    members: Array<{
      userId: string;
      role?: string;
      title?: string;
      metadata?: Record<string, unknown>;
      acquisitionSource?: MembershipAcquisitionSource;
      acquisitionRefId?: string;
    }>
  ): Promise<OrganizationMembership[]> {
    if (!members || members.length === 0) {
      return [];
    }

    // Verify organization exists
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get all user IDs
    const userIds = members.map(m => m.userId);

    // Verify all users exist
    const users = await this.userRepository.find({
      where: { id: In(userIds) },
    });

    if (users.length !== userIds.length) {
      const foundIds = new Set(users.map(u => u.id));
      const missingIds = userIds.filter(id => !foundIds.has(id));
      throw new Error(`Users not found: ${missingIds.join(', ')}`);
    }

    // Check for existing memberships
    const existing = await this.membershipRepository.find({
      where: {
        organizationId: orgId,
        userId: In(userIds),
      },
    });

    const existingUserIds = existing.filter(m => m.isActive).map(m => m.userId);

    if (existingUserIds.length > 0) {
      throw new Error(`Users already members: ${existingUserIds.join(', ')}`);
    }

    // Prepare memberships for batch insert
    const now = new Date();

    // Resolve role names to IDs. If the conventional 'member' role was renamed
    // by the org admin (e.g. to 'associate'), fall back to the lowest-priority
    // role for that org.
    const uniqueRoles = [...new Set(members.map(m => m.role || 'member'))];
    const roleIdMap = new Map<string, string>();
    for (const rn of uniqueRoles) {
      const rid = await getRoleService().resolveRoleIdWithDefaultFallback(rn, orgId);
      if (!rid) {
        throw new Error(`Role '${rn}' not found for organization ${orgId}`);
      }
      roleIdMap.set(rn, rid);
    }

    const membershipsToCreate = members.map(member => {
      const roleName = member.role || 'member';
      const roleId = roleIdMap.get(roleName)!;

      // Check if there's an inactive membership to reactivate
      const inactiveMembership = existing.find(e => e.userId === member.userId && !e.isActive);

      if (inactiveMembership) {
        // Reactivate existing
        return {
          ...inactiveMembership,
          isActive: true,
          roleId,
          title: member.title,
          joinedAt: now,
          leftAt: undefined,
          metadata: { ...inactiveMembership.metadata, ...member.metadata },
          acquisitionSource: member.acquisitionSource ?? inactiveMembership.acquisitionSource,
          acquisitionRefId: member.acquisitionRefId ?? inactiveMembership.acquisitionRefId,
        };
      } else {
        // Create new
        return this.membershipRepository.create({
          organizationId: orgId,
          userId: member.userId,
          roleId,
          title: member.title,
          isActive: true,
          joinedAt: now,
          metadata: member.metadata,
          acquisitionSource: member.acquisitionSource,
          acquisitionRefId: member.acquisitionRefId,
        });
      }
    });

    // Batch insert/update
    const saved = await this.membershipRepository.save(membershipsToCreate);

    // Update organization member count
    await this.updateMemberCount(orgId);
    invalidateMemberStatsCache(orgId);

    return saved;
  }

  /**
   * Batch remove multiple members from organization
   *
   * @param orgId Organization ID
   * @param userIds Array of user IDs to remove
   * @param permanent Whether to permanently delete
   */
  async batchRemoveMembers(
    orgId: string,
    userIds: string[],
    permanent: boolean = false
  ): Promise<void> {
    if (!userIds || userIds.length === 0) {
      return;
    }

    const memberships = await this.membershipRepository.find({
      where: {
        organizationId: orgId,
        userId: In(userIds),
        isActive: true,
      },
    });

    if (memberships.length === 0) {
      return;
    }

    if (permanent) {
      await this.membershipRepository.delete(memberships.map(m => m.id));
    } else {
      const now = new Date();
      memberships.forEach(m => {
        m.isActive = false;
        m.leftAt = now;
      });
      await this.membershipRepository.save(memberships);
    }

    // Update organization member count
    await this.updateMemberCount(orgId);
    invalidateMemberStatsCache(orgId);
  }

  /**
   * Batch update member roles
   *
   * @param orgId Organization ID
   * @param updates Array of userId and new role pairs
   * @returns Updated memberships
   */
  async batchUpdateMemberRoles(
    orgId: string,
    updates: Array<{ userId: string; role: string }>
  ): Promise<OrganizationMembership[]> {
    if (!updates || updates.length === 0) {
      return [];
    }

    const userIds = updates.map(u => u.userId);
    const memberships = await this.membershipRepository.find({
      where: {
        organizationId: orgId,
        userId: In(userIds),
        isActive: true,
      },
    });

    if (memberships.length === 0) {
      throw new Error('No memberships found');
    }

    // Resolve role names to IDs
    const roleService = getRoleService();
    const uniqueRoleNames = [...new Set(updates.map(u => u.role))];
    const roleIdMap = new Map<string, string>();
    for (const roleName of uniqueRoleNames) {
      const roleId = await roleService.getRoleIdByName(roleName, orgId);
      if (roleId) {
        roleIdMap.set(roleName, roleId);
      }
    }

    // Update roles
    memberships.forEach(membership => {
      const update = updates.find(u => u.userId === membership.userId);
      if (update) {
        const roleId = roleIdMap.get(update.role);
        if (roleId) {
          membership.roleId = roleId;
        }
      }
    });

    return this.membershipRepository.save(memberships);
  }
}
