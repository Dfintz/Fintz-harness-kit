import { AppDataSource } from '../../../data-source';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { Permission } from '../../../models/Permission';
import { SecurityLevel } from '../../../models/SecurityLevel';
import { logger } from '../../../utils/logger';
import { isOwnerOrAdminRole } from '../../../utils/roleUtils';
import { AuditCategory, auditService } from '../../audit/AuditService';

export class PermissionService {
  private permissionRepository = AppDataSource.getRepository(Permission);
  private userOrgRepository = AppDataSource.getRepository(OrganizationMembership);
  private securityLevelRepository = AppDataSource.getRepository(SecurityLevel);

  /**
   * Check if user has permission for a resource
   */
  public async hasPermission(
    userId: string,
    organizationId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    // Check explicit permission grant
    const permission = await this.permissionRepository.findOne({
      where: {
        userId,
        organizationId,
        resource,
        action,
        granted: true,
      },
    });

    if (permission) {
      // Check if permission has expired
      if (permission.expiresAt && permission.expiresAt < new Date()) {
        return false;
      }
      return true;
    }

    // Check role-based permissions
    const userOrg = await this.userOrgRepository.findOne({
      where: { userId, organizationId },
    });

    if (!userOrg) {
      return false;
    }

    // Owners (including founders) and admins have all permissions
    if (isOwnerOrAdminRole(userOrg.role)) {
      return true;
    }

    // Check custom permissions
    if (userOrg.permissions?.includes(`${resource}:${action}`)) {
      return true;
    }

    return false;
  }

  /**
   * Grant permission to a user
   */
  public async grantPermission(
    userId: string,
    organizationId: string,
    resource: string,
    action: string,
    grantedBy: string,
    expiresAt?: Date
  ): Promise<Permission> {
    // Check if permission already exists
    let permission = await this.permissionRepository.findOne({
      where: { userId, organizationId, resource, action },
    });

    if (permission) {
      permission.granted = true;
      permission.grantedBy = grantedBy;
      permission.expiresAt = expiresAt;
    } else {
      permission = this.permissionRepository.create({
        userId,
        organizationId,
        resource,
        action,
        granted: true,
        grantedBy,
        expiresAt,
      });
    }

    logger.info('Granting permission', {
      userId,
      organizationId,
      resource,
      action,
      grantedBy,
      expiresAt,
    });

    const savedPermission = await this.permissionRepository.save(permission);

    // Log permission grant to audit service
    auditService.log({
      category: AuditCategory.PERMISSION,
      action: 'PERMISSION_GRANTED',
      message: `Permission granted: ${resource}:${action} to user ${userId}`,
      userId: grantedBy,
      organizationId,
      resource: `permission/${savedPermission.id}`,
      metadata: {
        grantedUserId: userId,
        resource,
        action,
        grantedBy,
        expiresAt: expiresAt?.toISOString(),
        grantedAt: new Date().toISOString(),
      },
    });

    return savedPermission;
  }

  /**
   * Revoke permission from a user
   */
  public async revokePermission(
    userId: string,
    organizationId: string,
    resource: string,
    action: string,
    revokedBy: string
  ): Promise<void> {
    const permission = await this.permissionRepository.findOne({
      where: { userId, organizationId, resource, action },
    });

    if (permission) {
      logger.info('Revoking permission', {
        userId,
        organizationId,
        resource,
        action,
        revokedBy,
      });

      permission.granted = false;
      await this.permissionRepository.save(permission);

      // Log permission revocation
      auditService.log({
        category: AuditCategory.PERMISSION,
        action: 'PERMISSION_REVOKED',
        message: `Permission revoked: ${resource}:${action} from user ${userId}`,
        userId: revokedBy,
        organizationId,
        resource: `permission/${permission.id}`,
        metadata: {
          revokedUserId: userId,
          revokedBy,
          previousResource: resource,
          previousAction: action,
          revokedAt: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Get all permissions for a user in an organization
   */
  public async getUserPermissions(userId: string, organizationId: string): Promise<Permission[]> {
    return this.permissionRepository.find({
      where: { userId, organizationId, granted: true },
    });
  }

  /**
   * Get all users with a specific permission in an organization
   */
  public async getUsersWithPermission(
    organizationId: string,
    resource: string,
    action: string
  ): Promise<Permission[]> {
    return this.permissionRepository.find({
      where: { organizationId, resource, action, granted: true },
    });
  }

  /**
   * Update security level for user in organization
   */
  public async updateSecurityLevel(
    userId: string,
    organizationId: string,
    securityLevel: number,
    updatedBy: string
  ): Promise<OrganizationMembership> {
    const userOrg = await this.userOrgRepository.findOne({
      where: { userId, organizationId },
    });

    if (!userOrg) {
      throw new Error('User is not a member of this organization');
    }

    // Validate security level
    if (securityLevel < 1 || securityLevel > 5) {
      throw new Error('Security level must be between 1 and 5');
    }

    logger.info('Updating security level', {
      userId,
      organizationId,
      newSecurityLevel: securityLevel,
      updatedBy,
    });

    const previousLevel = userOrg.securityLevel;
    userOrg.securityLevel = securityLevel;
    const updated = await this.userOrgRepository.save(userOrg);

    // Log security level change
    auditService.log({
      category: AuditCategory.SECURITY,
      action: 'SECURITY_LEVEL_UPDATED',
      message: `Security level updated for user ${userId}: ${previousLevel} → ${securityLevel}`,
      userId: updatedBy,
      organizationId,
      resource: `user/${userId}/security-level`,
      metadata: {
        updatedUserId: userId,
        previousLevel,
        newLevel: securityLevel,
        updatedBy,
        updatedAt: new Date().toISOString(),
      },
    });

    return updated;
  }

  /**
   * Set security level between organizations
   */
  public async setInterOrgSecurityLevel(
    sourceOrgId: string,
    targetOrgId: string,
    level: number,
    resourceType: string,
    accessLevel: string,
    approvedBy: string,
    restrictions?: Record<string, unknown>,
    notes?: string,
    expiresAt?: Date
  ): Promise<SecurityLevel> {
    // Validate security level range (1-10)
    if (level < 1 || level > 10) {
      throw new Error('Security level must be between 1 and 10');
    }

    // Validate access level
    const validAccessLevels = ['none', 'read', 'write', 'full'];
    if (!validAccessLevels.includes(accessLevel)) {
      throw new Error(`Access level must be one of: ${validAccessLevels.join(', ')}`);
    }

    // Prevent self-referencing security levels
    if (sourceOrgId === targetOrgId) {
      throw new Error('Cannot set security level from an organization to itself');
    }

    // Check if security level already exists
    let securityLevel = await this.securityLevelRepository.findOne({
      where: { sourceOrgId, targetOrgId, resourceType },
    });

    if (securityLevel) {
      securityLevel.level = level;
      securityLevel.accessLevel = accessLevel;
      securityLevel.approvedBy = approvedBy;
      securityLevel.updatedBy = approvedBy;
      if (restrictions !== undefined) {
        securityLevel.restrictions = restrictions;
      }
      if (notes !== undefined) {
        securityLevel.notes = notes;
      }
      if (expiresAt !== undefined) {
        securityLevel.expiresAt = expiresAt;
      }
      securityLevel.isActive = true; // Reactivate if updating
    } else {
      securityLevel = this.securityLevelRepository.create({
        sourceOrgId,
        targetOrgId,
        level,
        resourceType,
        accessLevel,
        approvedBy,
        restrictions,
        notes,
        expiresAt,
        isActive: true,
      });
    }

    const saved = await this.securityLevelRepository.save(securityLevel);

    // Log inter-org security level setting
    auditService.log({
      category: AuditCategory.SECURITY,
      action: 'SECURITY_LEVEL_SET_INTER_ORG',
      message: `Inter-org security level set: ${sourceOrgId} -> ${targetOrgId} for ${resourceType}`,
      userId: approvedBy,
      organizationId: sourceOrgId,
      resource: `inter-org/${sourceOrgId}/${targetOrgId}/${resourceType}`,
      metadata: {
        sourceOrgId,
        targetOrgId,
        resourceType,
        level,
        accessLevel,
        expiresAt: expiresAt?.toISOString(),
        restrictions,
        notes,
        approvedAt: new Date().toISOString(),
      },
    });

    return saved;
  }

  /**
   * Check cross-organization access
   */
  public async hasInterOrgAccess(
    sourceOrgId: string,
    targetOrgId: string,
    resourceType: string,
    requiredAccessLevel: string = 'read',
    requiredSecurityLevel: number = 1
  ): Promise<boolean> {
    // Check for exact resource type match
    let securityLevel = await this.securityLevelRepository.findOne({
      where: { sourceOrgId, targetOrgId, resourceType, isActive: true },
    });

    // If no exact match, check for wildcard resource type
    if (!securityLevel) {
      securityLevel = await this.securityLevelRepository.findOne({
        where: { sourceOrgId, targetOrgId, resourceType: '*', isActive: true },
      });
    }

    if (!securityLevel) {
      return false;
    }

    // Use the grantsAccess helper method from SecurityLevel model
    return securityLevel.grantsAccess(requiredSecurityLevel, requiredAccessLevel);
  }

  /**
   * Get all inter-org security levels for an organization
   * Returns both incoming and outgoing security relationships
   */
  public async getInterOrgSecurityLevels(organizationId: string): Promise<SecurityLevel[]> {
    return this.securityLevelRepository.find({
      where: [{ sourceOrgId: organizationId }, { targetOrgId: organizationId }],
      relations: ['sourceOrganization', 'targetOrganization'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all security levels (admin only)
   */
  public async getAllSecurityLevels(): Promise<SecurityLevel[]> {
    return this.securityLevelRepository.find({
      relations: ['sourceOrganization', 'targetOrganization'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Revoke/deactivate an inter-org security level
   */
  public async revokeInterOrgSecurityLevel(
    sourceOrgId: string,
    targetOrgId: string,
    resourceType: string,
    revokedBy: string
  ): Promise<void> {
    const securityLevel = await this.securityLevelRepository.findOne({
      where: { sourceOrgId, targetOrgId, resourceType },
    });

    if (securityLevel) {
      logger.info('Revoking inter-org security level', {
        sourceOrgId,
        targetOrgId,
        resourceType,
        revokedBy,
      });

      securityLevel.isActive = false;
      securityLevel.updatedBy = revokedBy;
      await this.securityLevelRepository.save(securityLevel);

      // Log revocation
      auditService.log({
        category: AuditCategory.SECURITY,
        action: 'SECURITY_LEVEL_REVOKED',
        message: `Inter-org security level revoked: ${sourceOrgId} -> ${targetOrgId} for ${resourceType}`,
        userId: revokedBy,
        resource: `inter-org-security/${sourceOrgId}/${targetOrgId}/${resourceType}`,
        metadata: {
          sourceOrgId,
          targetOrgId,
          resourceType,
          revokedBy,
          revokedAt: new Date().toISOString(),
        },
      });
    }
  }

  /**
   * Clean up expired permissions
   */
  public async cleanupExpiredPermissions(): Promise<number> {
    const result = await this.permissionRepository
      .createQueryBuilder()
      .update(Permission)
      .set({ granted: false })
      .where('expiresAt < :now', { now: new Date() })
      .andWhere('granted = :granted', { granted: true })
      .execute();

    return result.affected || 0;
  }
}
