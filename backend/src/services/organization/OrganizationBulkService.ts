import { Readable } from 'stream';

import csvParser from 'csv-parser';
import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization, OrganizationStatus, OrganizationType } from '../../models/Organization';
import { OrganizationActivity } from '../../models/OrganizationActivity';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  OrganizationPermission,
  PermissionAction,
  ResourceType,
} from '../../models/OrganizationPermission';
import { User } from '../../models/User';
import { ForbiddenError, NotFoundError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import { getRoleService } from '../security/core/RoleService';
import { domainEvents } from '../shared/DomainEventBus';

import { OrganizationPermissionService } from './OrganizationPermissionService';

interface BulkOperationResult<T = unknown> {
  successful: number;
  failed: number;
  errors: Array<{ item: T; error: string }>;
  details?: unknown[];
}

interface MemberImportData {
  username?: string;
  email: string;
  role: string;
  permissions?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Progress callback for bulk operations
 */
export type BulkOperationProgressCallback = (progress: {
  completed: number;
  total: number;
  percentage: number;
  currentItem?: unknown;
  status: 'processing' | 'completed' | 'error';
}) => void;

/**
 * Options for bulk operations with rate limiting and progress tracking
 */
export interface BulkOperationOptions {
  progressCallback?: BulkOperationProgressCallback;
  batchSize?: number; // Process items in batches to avoid overwhelming the system
  delayBetweenBatches?: number; // Delay in ms between batches (for rate limiting)
}

export class OrganizationBulkService {
  // Constants for batch processing
  private static readonly DEFAULT_BATCH_SIZE = 10;
  private static readonly DEFAULT_BATCH_DELAY_MS = 100;
  private static readonly MIN_MEMBER_COUNT_FOR_DELETION = 1; // Only owner

  private organizationRepository: Repository<Organization>;
  private membershipRepository: Repository<OrganizationMembership>;
  private permissionRepository: Repository<OrganizationPermission>;
  private activityRepository: Repository<OrganizationActivity>;
  private userRepository: Repository<User>;
  private readonly orgPermissionService = new OrganizationPermissionService();

  constructor() {
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.permissionRepository = AppDataSource.getRepository(OrganizationPermission);
    this.activityRepository = AppDataSource.getRepository(OrganizationActivity);
    this.userRepository = AppDataSource.getRepository(User);
  }

  /**
   * Bulk add members to organization
   */
  async bulkAddMembers(
    organizationId: string,
    members: Array<{
      userId: string;
      role: string;
      permissions?: string[];
      metadata?: Record<string, unknown>;
    }>,
    actorId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
      details: [],
    };

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // Verify actor has permission to manage members before processing
    const permission = await this.orgPermissionService.checkPermission(
      actorId,
      organizationId,
      ResourceType.MEMBER,
      PermissionAction.MANAGE
    );
    if (!permission.allowed) {
      logger.warn('Unauthorized bulk member addition attempt', { actorId, organizationId });
      throw new ForbiddenError(
        `You do not have permission to manage members of this organization. ${permission.reason ?? ''}`.trim()
      );
    }

    // Check for existing memberships
    const userIds = members.map(m => m.userId);
    const existingMemberships = await this.membershipRepository.find({
      where: {
        organizationId,
        userId: In(userIds),
      },
    });

    const existingUserIds = new Set(existingMemberships.map(m => m.userId));

    // Resolve role names to IDs
    const roleService = getRoleService();
    const uniqueRoles = [...new Set(members.map(m => m.role))];
    const bulkRoleIdMap = new Map<string, string>();
    for (const roleName of uniqueRoles) {
      const roleId = await roleService.getRoleIdByName(roleName, organizationId);
      if (roleId) {
        bulkRoleIdMap.set(roleName, roleId);
      }
    }

    for (const member of members) {
      try {
        // Skip if already a member
        if (existingUserIds.has(member.userId)) {
          this.recordFailure(result, member, 'User is already a member');
          continue;
        }

        // Verify user exists
        const user = await this.userRepository.findOne({
          where: { id: member.userId },
        });

        if (!user) {
          this.recordFailure(result, member, 'User not found');
          continue;
        }

        const resolvedRoleId = bulkRoleIdMap.get(member.role);
        if (!resolvedRoleId) {
          this.recordFailure(result, member, `Role '${member.role}' not found`);
          continue;
        }

        // Create membership
        const membership = this.membershipRepository.create({
          organizationId,
          userId: member.userId,
          roleId: resolvedRoleId,
          permissions: member.permissions || [],
          metadata: member.metadata,
        });

        await this.membershipRepository.save(membership);

        // Log activity
        await this.logActivity(organizationId, actorId, 'member_added', 'low', {
          userId: member.userId,
          role: member.role,
        });

        result.successful++;
        result.details?.push({
          userId: member.userId,
          username: user.username,
          role: member.role,
          status: 'success',
        });
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          item: member,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: actorId,
      resource: 'organization.members',
      action: 'bulk_add',
      message: `Bulk member addition to org ${organizationId}: ${result.successful} added, ${result.failed} failed`,
      metadata: { organizationId, successCount: result.successful, failedCount: result.failed },
    });

    return result;
  }

  /**
   * Bulk remove members from organization
   */
  async bulkRemoveMembers(
    organizationId: string,
    userIds: string[],
    actorId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // Verify actor has permission to manage members
    const permission = await this.orgPermissionService.checkPermission(
      actorId,
      organizationId,
      ResourceType.MEMBER,
      PermissionAction.MANAGE
    );
    if (!permission.allowed) {
      logger.warn('Unauthorized bulk member removal attempt', { actorId, organizationId });
      throw new ForbiddenError(
        `You do not have permission to manage members of this organization. ${permission.reason ?? ''}`.trim()
      );
    }

    // Can't remove the owner
    if (organization.ownerId && userIds.includes(organization.ownerId)) {
      result.failed++;
      result.errors.push({
        item: { userId: organization.ownerId },
        error: 'Cannot remove organization owner',
      });
      userIds = userIds.filter(id => id !== organization.ownerId);
    }

    const memberships = await this.membershipRepository.find({
      where: {
        organizationId,
        userId: In(userIds),
      },
    });

    const foundUserIds = new Set(memberships.map(m => m.userId));

    for (const userId of userIds) {
      try {
        if (!foundUserIds.has(userId)) {
          this.recordFailure(result, { userId }, 'User is not a member');
          continue;
        }

        await this.membershipRepository.delete({
          organizationId,
          userId,
        });

        // Log activity
        await this.logActivity(organizationId, actorId, 'member_removed', 'medium', { userId });

        result.successful++;
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          item: { userId },
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: actorId,
      resource: 'organization.members',
      action: 'bulk_remove',
      message: `Bulk member removal from org ${organizationId}: ${result.successful} removed, ${result.failed} failed`,
      metadata: { organizationId, successCount: result.successful, failedCount: result.failed },
    });

    return result;
  }

  /**
   * Bulk update member roles
   */
  async bulkUpdateRoles(
    organizationId: string,
    updates: Array<{ userId: string; role: string }>,
    actorId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    // Verify actor has permission to manage member roles
    const permission = await this.orgPermissionService.checkPermission(
      actorId,
      organizationId,
      ResourceType.MEMBER,
      PermissionAction.MANAGE
    );
    if (!permission.allowed) {
      logger.warn('Unauthorized bulk role update attempt', { actorId, organizationId });
      throw new ForbiddenError(
        `You do not have permission to manage member roles in this organization. ${permission.reason ?? ''}`.trim()
      );
    }

    // Batch-load all memberships to avoid N+1 queries
    const userIds = updates.map(u => u.userId);
    const memberships = await this.membershipRepository.find({
      where: { organizationId, userId: In(userIds) },
    });
    const membershipMap = new Map(memberships.map(m => [m.userId, m]));

    const toSave: OrganizationMembership[] = [];
    const activityLogs: Array<{ userId: string; oldRole: string; newRole: string }> = [];

    // Resolve role names to IDs
    const roleService = getRoleService();
    const uniqueRoleNames = [...new Set(updates.map(u => u.role))];
    const roleIdMap = new Map<string, string>();
    for (const roleName of uniqueRoleNames) {
      const roleId = await roleService.getRoleIdByName(roleName, organizationId);
      if (roleId) {
        roleIdMap.set(roleName, roleId);
      }
    }

    for (const update of updates) {
      try {
        // Can't change owner role
        if (update.userId === organization.ownerId) {
          this.recordFailure(result, update, 'Cannot change owner role');
          continue;
        }

        const membership = membershipMap.get(update.userId);

        if (!membership) {
          this.recordFailure(result, update, 'User is not a member');
          continue;
        }

        const roleId = roleIdMap.get(update.role);
        if (!roleId) {
          this.recordFailure(result, update, `Role '${update.role}' not found`);
          continue;
        }

        const oldRole = getRoleName(membership.role);
        membership.roleId = roleId;
        toSave.push(membership);
        activityLogs.push({ userId: update.userId, oldRole, newRole: update.role });

        result.successful++;
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          item: update,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Batch save all updated memberships
    if (toSave.length > 0) {
      await this.membershipRepository.save(toSave);
    }

    // Phase 3.4: Emit domain event for each successful role change so
    // bot-side listeners can mirror the role into Discord (additive only).
    for (const log of activityLogs) {
      domainEvents.emit('member:platform_role_changed', {
        timestamp: new Date().toISOString(),
        userId: log.userId,
        organizationId,
        previousRoleName: log.oldRole,
        newRoleName: log.newRole,
        performedById: actorId,
      });
    }

    // Batch log activities
    for (const log of activityLogs) {
      await this.logActivity(organizationId, actorId, 'role_updated', 'medium', {
        userId: log.userId,
        oldRole: log.oldRole,
        newRole: log.newRole,
      });
    }

    logAuditEvent({
      eventType: AuditEventType.ACTIVITY_ACTION,
      userId: actorId,
      resource: 'organization.members',
      action: 'bulk_update_roles',
      message: `Bulk role update in org ${organizationId}: ${result.successful} updated, ${result.failed} failed`,
      metadata: { organizationId, successCount: result.successful, failedCount: result.failed },
    });

    return result;
  }

  /**
   * Bulk grant permissions to members
   */
  async bulkGrantPermissions(
    organizationId: string,
    grants: Array<{ userId: string; permissions: string[] }>,
    actorId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    for (const grant of grants) {
      try {
        const membership = await this.membershipRepository.findOne({
          where: {
            organizationId,
            userId: grant.userId,
          },
        });

        if (!membership) {
          this.recordFailure(result, grant, 'User is not a member');
          continue;
        }

        // Add new permissions (deduplicate)
        const currentPermissions = new Set(membership.permissions || []);
        grant.permissions.forEach(p => currentPermissions.add(p));
        membership.permissions = Array.from(currentPermissions);

        await this.membershipRepository.save(membership);

        // Log activity
        await this.logActivity(organizationId, actorId, 'permissions_granted', 'low', {
          userId: grant.userId,
          permissions: grant.permissions,
        });

        result.successful++;
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          item: grant,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Bulk revoke permissions from members
   */
  async bulkRevokePermissions(
    organizationId: string,
    revocations: Array<{ userId: string; permissions: string[] }>,
    actorId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    for (const revocation of revocations) {
      try {
        // Can't revoke owner permissions
        if (revocation.userId === organization.ownerId) {
          this.recordFailure(result, revocation, 'Cannot revoke owner permissions');
          continue;
        }

        const membership = await this.membershipRepository.findOne({
          where: {
            organizationId,
            userId: revocation.userId,
          },
        });

        if (!membership) {
          this.recordFailure(result, revocation, 'User is not a member');
          continue;
        }

        // Remove permissions
        const permissionsToRevoke = new Set(revocation.permissions);
        membership.permissions = (membership.permissions || []).filter(
          p => !permissionsToRevoke.has(p)
        );

        await this.membershipRepository.save(membership);

        // Log activity
        await this.logActivity(organizationId, actorId, 'permissions_revoked', 'medium', {
          userId: revocation.userId,
          permissions: revocation.permissions,
        });

        result.successful++;
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          item: revocation,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Import members from CSV
   */
  async importMembersFromCSV(
    organizationId: string,
    csvContent: string,
    actorId: string
  ): Promise<BulkOperationResult> {
    const members: MemberImportData[] = [];

    // Parse CSV
    const stream = Readable.from(csvContent);
    await new Promise<void>((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on('data', (row: Record<string, string>) => {
          members.push({
            email: row.email,
            username: row.username,
            role: row.role || 'member',
            permissions: row.permissions
              ? row.permissions.split(',').map((p: string) => p.trim())
              : [],
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
          });
        })
        .on('end', () => resolve())
        .on('error', (error: Error) => reject(error));
    });

    // Find users by email
    const emails = members.map(m => m.email);
    const users = await this.userRepository.find({
      where: { email: In(emails) },
    });

    const emailToUserId = new Map(users.map(u => [u.email, u.id]));

    // Convert to bulk add format
    const membersToAdd = members
      .filter(m => emailToUserId.has(m.email))
      .map(m => ({
        userId: emailToUserId.get(m.email),
        role: m.role,
        permissions: m.permissions,
        metadata: m.metadata,
      }));

    // Track users not found
    const notFoundEmails = members.filter(m => !emailToUserId.has(m.email)).map(m => m.email);

    // @ts-expect-error - Strict mode compatibility
    const result = await this.bulkAddMembers(organizationId, membersToAdd, actorId);

    // Add not found errors
    notFoundEmails.forEach(email => {
      result.failed++;
      result.errors.push({
        item: { email },
        error: 'User not found',
      });
    });

    return result;
  }

  /**
   * Export members to CSV
   */
  async exportMembersToCSV(organizationId: string): Promise<string> {
    const memberships = await this.membershipRepository.find({
      where: { organizationId },
      relations: ['user'],
    });

    // Generate CSV
    const headers = ['user_id', 'username', 'email', 'role', 'permissions', 'joined_at'];
    const rows = memberships.map(m => [
      m.userId,
      m.user.username,
      m.user.email,
      getRoleName(m.role),
      m.permissions ? m.permissions.join(',') : '',
      m.joinedAt?.toISOString() || '',
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return csv;
  }

  /**
   * Bulk update member metadata
   */
  async bulkUpdateMetadata(
    organizationId: string,
    updates: Array<{ userId: string; metadata: Record<string, unknown> }>,
    _actorId: string
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const update of updates) {
      try {
        const membership = await this.membershipRepository.findOne({
          where: {
            organizationId,
            userId: update.userId,
          },
        });

        if (!membership) {
          this.recordFailure(result, update, 'User is not a member');
          continue;
        }

        membership.metadata = {
          ...membership.metadata,
          ...update.metadata,
        };

        await this.membershipRepository.save(membership);
        result.successful++;
      } catch (error: unknown) {
        result.failed++;
        result.errors.push({
          item: update,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Bulk create organizations
   */
  async bulkCreateOrganizations(
    orgsData: Array<{
      name: string;
      type?: OrganizationType;
      description?: string;
      status?: OrganizationStatus;
      metadata?: Record<string, unknown>;
    }>,
    creatorId: string
  ): Promise<{
    success: boolean;
    created: Organization[];
    errors: Array<{ item: (typeof orgsData)[0]; error: string }>;
  }> {
    const result = {
      success: true,
      created: [] as Organization[],
      errors: [] as Array<{ item: (typeof orgsData)[0]; error: string }>,
    };

    // Verify creator exists
    const creator = await this.userRepository.findOne({
      where: { id: creatorId },
    });

    if (!creator) {
      throw new Error('Creator not found');
    }

    for (const orgData of orgsData) {
      try {
        // Validate required fields
        if (!orgData.name || orgData.name.trim().length === 0) {
          result.errors.push({
            item: orgData,
            error: 'Organization name is required',
          });
          result.success = false;
          continue;
        }

        // Create organization
        const organizationData = {
          name: orgData.name,
          type: orgData.type || OrganizationType.ROOT,
          description: orgData.description || '',
          status: orgData.status || OrganizationStatus.ACTIVE,
          ownerId: creatorId,
          level: 0,
          memberCount: 0,
          metadata: orgData.metadata || {},
        };

        const organization = this.organizationRepository.create(organizationData);
        const savedOrg = await this.organizationRepository.save(organization);

        // Log activity
        await this.logActivity(savedOrg.id, creatorId, 'bulk_organization_created', 'medium', {
          organizationName: orgData.name,
        });

        result.created.push(savedOrg);
      } catch (error: unknown) {
        result.success = false;
        result.errors.push({
          item: orgData,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Bulk update organizations
   */
  async bulkUpdateOrganizations(
    updates: Array<{
      id: string;
      data: Partial<{
        name?: string;
        description?: string;
        status?: OrganizationStatus;
        metadata?: Record<string, unknown>;
      }>;
    }>
  ): Promise<{
    success: boolean;
    updated: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const result = {
      success: true,
      updated: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const update of updates) {
      try {
        const organization = await this.organizationRepository.findOne({
          where: { id: update.id },
        });

        if (!organization) {
          result.success = false;
          result.errors.push({
            id: update.id,
            error: 'Organization not found',
          });
          continue;
        }

        // Apply updates
        Object.assign(organization, update.data);
        await this.organizationRepository.save(organization);

        result.updated++;
      } catch (error: unknown) {
        result.success = false;
        result.errors.push({
          id: update.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Bulk delete organizations
   */
  async bulkDeleteOrganizations(orgIds: string[]): Promise<{
    success: boolean;
    deleted: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    const result = {
      success: true,
      deleted: 0,
      errors: [] as Array<{ id: string; error: string }>,
    };

    for (const orgId of orgIds) {
      try {
        const organization = await this.organizationRepository.findOne({
          where: { id: orgId },
        });

        if (!organization) {
          result.success = false;
          result.errors.push({
            id: orgId,
            error: 'Organization not found',
          });
          continue;
        }

        // Check if organization has members (shouldn't delete if it has members)
        const memberCount = await this.membershipRepository.count({
          where: { organizationId: orgId },
        });

        if (memberCount > OrganizationBulkService.MIN_MEMBER_COUNT_FOR_DELETION) {
          // More than just the owner
          result.success = false;
          result.errors.push({
            id: orgId,
            error: 'Cannot delete organization with members',
          });
          continue;
        }

        // Delete memberships first
        await this.membershipRepository.delete({ organizationId: orgId });

        // Delete organization
        await this.organizationRepository.delete({ id: orgId });

        result.deleted++;
      } catch (error: unknown) {
        result.success = false;
        result.errors.push({
          id: orgId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Get bulk operation statistics
   */
  async getBulkOperationStats(organizationId: string): Promise<{
    totalMembers: number;
    membersByRole: Record<string, number>;
    recentBulkOperations: number;
    averageOperationSize: number;
  }> {
    const memberships = await this.membershipRepository.find({
      where: { organizationId },
    });

    const membersByRole: Record<string, number> = {};
    memberships.forEach(m => {
      const roleName = getRoleName(m.role) || 'unknown';
      membersByRole[roleName] = (membersByRole[roleName] || 0) + 1;
    });

    // Get recent bulk operations from activities
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentActivities = await this.activityRepository.count({
      where: {
        organizationId,
        action: In(['bulk_add', 'bulk_remove', 'bulk_update']),
      },
    });

    return {
      totalMembers: memberships.length,
      membersByRole,
      recentBulkOperations: recentActivities,
      averageOperationSize: 0, // Would need to track operation sizes
    };
  }

  /**
   * Log activity
   */
  private async logActivity(
    organizationId: string,
    actorId: string,
    activityType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const activityData = this.activityRepository.create({
      organizationId,
      actorId,
      action: activityType,
      severity,
      metadata,
    } as Record<string, unknown>);

    const activity = Array.isArray(activityData) ? activityData[0] : activityData;
    await this.activityRepository.save(activity);
  }

  /**
   * Helper method to record a failed operation
   * DRY helper for common error recording pattern
   */
  private recordFailure<T>(result: BulkOperationResult, item: T, error: string): void {
    result.failed++;
    result.errors.push({ item, error });
  }

  /**
   * Helper method to process items in batches with progress tracking and rate limiting
   */
  private async processBatch<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    options?: BulkOperationOptions
  ): Promise<Array<{ success: boolean; result?: R; error?: string; item: T }>> {
    const batchSize = options?.batchSize || OrganizationBulkService.DEFAULT_BATCH_SIZE;
    const delayBetweenBatches =
      options?.delayBetweenBatches || OrganizationBulkService.DEFAULT_BATCH_DELAY_MS;
    const progressCallback = options?.progressCallback;
    const results: Array<{ success: boolean; result?: R; error?: string; item: T }> = [];

    const total = items.length;
    let completed = 0;

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async (item, batchIndex) => {
        const globalIndex = i + batchIndex;
        try {
          const result = await processor(item, globalIndex);
          completed++;

          // Only call progress callback after completion to reduce overhead
          if (progressCallback) {
            progressCallback({
              completed,
              total,
              percentage: Math.round((completed / total) * 100),
              currentItem: item,
              status: 'completed',
            });
          }

          return { success: true, result, item };
        } catch (error: unknown) {
          completed++;

          // Call progress callback on error for visibility
          if (progressCallback) {
            progressCallback({
              completed,
              total,
              percentage: Math.round((completed / total) * 100),
              currentItem: item,
              status: 'error',
            });
          }

          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            item,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Delay between batches (rate limiting)
      if (i + batchSize < items.length && delayBetweenBatches > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    return results;
  }

  /**
   * Bulk add members with progress tracking and rate limiting
   */
  async bulkAddMembersWithProgress(
    organizationId: string,
    members: Array<{
      userId: string;
      role: string;
      permissions?: string[];
      metadata?: Record<string, unknown>;
    }>,
    actorId: string,
    options?: BulkOperationOptions
  ): Promise<BulkOperationResult> {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
      details: [],
    };

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Check for existing memberships
    const userIds = members.map(m => m.userId);
    const existingMemberships = await this.membershipRepository.find({
      where: {
        organizationId,
        userId: In(userIds),
      },
    });

    const existingUserIds = new Set(existingMemberships.map(m => m.userId));

    // Resolve role names to IDs
    const roleService = getRoleService();
    const uniqueRoles = [...new Set(members.map(m => m.role))];
    const batchRoleIdMap = new Map<string, string>();
    for (const roleName of uniqueRoles) {
      const roleId = await roleService.getRoleIdByName(roleName, organizationId);
      if (roleId) {
        batchRoleIdMap.set(roleName, roleId);
      }
    }

    // Process with batching and progress tracking
    const results = await this.processBatch(
      members,
      async member => {
        // Skip if already a member
        if (existingUserIds.has(member.userId)) {
          throw new Error('User is already a member');
        }

        // Verify user exists
        const user = await this.userRepository.findOne({
          where: { id: member.userId },
        });

        if (!user) {
          throw new Error('User not found');
        }

        const resolvedRoleId = batchRoleIdMap.get(member.role);
        if (!resolvedRoleId) {
          throw new Error(`Role '${member.role}' not found`);
        }

        // Create membership
        const membership = this.membershipRepository.create({
          organizationId,
          userId: member.userId,
          roleId: resolvedRoleId,
          permissions: member.permissions || [],
          metadata: member.metadata,
        });

        await this.membershipRepository.save(membership);

        // Log activity
        await this.logActivity(organizationId, actorId, 'member_added', 'low', {
          userId: member.userId,
          role: member.role,
        });

        return {
          userId: member.userId,
          username: user.username,
          role: member.role,
          status: 'success',
        };
      },
      options
    );

    // Aggregate results
    results.forEach(r => {
      if (r.success) {
        result.successful++;
        result.details?.push(r.result);
      } else {
        result.failed++;
        result.errors.push({
          item: r.item,
          error: r.error || 'Unknown error',
        });
      }
    });

    return result;
  }

  /**
   * Bulk invite members (alias for bulkAddMembers for API compatibility)
   */
  async bulkInviteMembers(
    organizationId: string,
    members: Array<{
      userId: string;
      role: string;
      permissions?: string[];
      metadata?: Record<string, unknown>;
    }>,
    actorId: string,
    options?: BulkOperationOptions
  ): Promise<BulkOperationResult> {
    // Use the progress-enabled version if options are provided
    if (options && (options.progressCallback || options.batchSize || options.delayBetweenBatches)) {
      return this.bulkAddMembersWithProgress(organizationId, members, actorId, options);
    }
    return this.bulkAddMembers(organizationId, members, actorId);
  }
}
