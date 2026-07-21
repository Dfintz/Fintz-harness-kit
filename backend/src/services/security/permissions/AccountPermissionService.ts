import { AppDataSource } from '../../../data-source';
import { AccountPermission } from '../../../models/AccountPermission';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { logger } from '../../../utils/logger';
import { isOwnerOrAdminRole } from '../../../utils/roleUtils';

export class AccountPermissionService {
  private permissionRepository = AppDataSource.getRepository(AccountPermission);
  private userOrgRepository = AppDataSource.getRepository(OrganizationMembership);

  /**
   * Check if a user has permission to perform an action
   */
  async hasPermission(
    userId: string,
    organizationId: string,
    action: string,
    accountId?: string
  ): Promise<boolean> {
    try {
      // Check if user is organization admin or owner
      const userOrg = await this.userOrgRepository.findOne({
        where: { userId, organizationId, isActive: true },
      });

      if (!userOrg) {
        return false;
      }

      // Admins and owners (including founders) have all permissions
      if (isOwnerOrAdminRole(userOrg.role)) {
        return true;
      }

      // Check specific permissions
      const now = new Date();
      const permission = await this.permissionRepository.findOne({
        where: [
          {
            userId,
            organizationId,
            accountId,
            action,
            granted: true,
          },
          {
            userId,
            organizationId,
            accountId: null as unknown as string, // Organization-wide permission
            action,
            granted: true,
          },
        ],
      });

      if (!permission) {
        return false;
      }

      // Check if permission is expired
      if (permission.expiresAt && permission.expiresAt < now) {
        return false;
      }

      return true;
    } catch (error: unknown) {
      logger.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Grant permission to a user
   */
  async grantPermission(
    userId: string,
    organizationId: string,
    action: string,
    grantedBy: string,
    accountId?: string,
    expiresAt?: Date
  ): Promise<AccountPermission | null> {
    try {
      const permission = this.permissionRepository.create({
        userId,
        organizationId,
        accountId,
        action,
        granted: true,
        grantedBy,
        expiresAt,
      });

      const savedPermission = await this.permissionRepository.save(permission);
      logger.info(`Permission granted: ${action} to user ${userId} by ${grantedBy}`);
      return savedPermission;
    } catch (error: unknown) {
      logger.error('Error granting permission:', error);
      return null;
    }
  }

  /**
   * Revoke permission from a user
   */
  async revokePermission(permissionId: string): Promise<boolean> {
    try {
      const result = await this.permissionRepository.delete(permissionId);
      logger.info(`Permission revoked: ${permissionId}`);
      return result.affected !== 0;
    } catch (error: unknown) {
      logger.error('Error revoking permission:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user in an organization
   */
  async getUserPermissions(userId: string, organizationId: string): Promise<AccountPermission[]> {
    try {
      return await this.permissionRepository.find({
        where: { userId, organizationId, granted: true },
      });
    } catch (error: unknown) {
      logger.error('Error fetching user permissions:', error);
      return [];
    }
  }

  /**
   * Get all permissions for an account
   */
  async getAccountPermissions(accountId: string): Promise<AccountPermission[]> {
    try {
      return await this.permissionRepository.find({
        where: { accountId, granted: true },
      });
    } catch (error: unknown) {
      logger.error('Error fetching account permissions:', error);
      return [];
    }
  }

  /**
   * Clean up expired permissions
   */
  async cleanupExpiredPermissions(): Promise<number> {
    try {
      const now = new Date();
      const result = await this.permissionRepository
        .createQueryBuilder()
        .delete()
        .where('expiresAt < :now', { now })
        .execute();

      logger.info(`Cleaned up ${result.affected} expired permissions`);
      return result.affected || 0;
    } catch (error: unknown) {
      logger.error('Error cleaning up expired permissions:', error);
      return 0;
    }
  }
}

