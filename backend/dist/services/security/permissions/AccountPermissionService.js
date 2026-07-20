"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountPermissionService = void 0;
const data_source_1 = require("../../../data-source");
const AccountPermission_1 = require("../../../models/AccountPermission");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const logger_1 = require("../../../utils/logger");
const roleUtils_1 = require("../../../utils/roleUtils");
class AccountPermissionService {
    permissionRepository = data_source_1.AppDataSource.getRepository(AccountPermission_1.AccountPermission);
    userOrgRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    async hasPermission(userId, organizationId, action, accountId) {
        try {
            const userOrg = await this.userOrgRepository.findOne({
                where: { userId, organizationId, isActive: true },
            });
            if (!userOrg) {
                return false;
            }
            if ((0, roleUtils_1.isOwnerOrAdminRole)(userOrg.role)) {
                return true;
            }
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
                        accountId: null,
                        action,
                        granted: true,
                    },
                ],
            });
            if (!permission) {
                return false;
            }
            if (permission.expiresAt && permission.expiresAt < now) {
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.logger.error('Error checking permission:', error);
            return false;
        }
    }
    async grantPermission(userId, organizationId, action, grantedBy, accountId, expiresAt) {
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
            logger_1.logger.info(`Permission granted: ${action} to user ${userId} by ${grantedBy}`);
            return savedPermission;
        }
        catch (error) {
            logger_1.logger.error('Error granting permission:', error);
            return null;
        }
    }
    async revokePermission(permissionId) {
        try {
            const result = await this.permissionRepository.delete(permissionId);
            logger_1.logger.info(`Permission revoked: ${permissionId}`);
            return result.affected !== 0;
        }
        catch (error) {
            logger_1.logger.error('Error revoking permission:', error);
            return false;
        }
    }
    async getUserPermissions(userId, organizationId) {
        try {
            return await this.permissionRepository.find({
                where: { userId, organizationId, granted: true },
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching user permissions:', error);
            return [];
        }
    }
    async getAccountPermissions(accountId) {
        try {
            return await this.permissionRepository.find({
                where: { accountId, granted: true },
            });
        }
        catch (error) {
            logger_1.logger.error('Error fetching account permissions:', error);
            return [];
        }
    }
    async cleanupExpiredPermissions() {
        try {
            const now = new Date();
            const result = await this.permissionRepository
                .createQueryBuilder()
                .delete()
                .where('expiresAt < :now', { now })
                .execute();
            logger_1.logger.info(`Cleaned up ${result.affected} expired permissions`);
            return result.affected || 0;
        }
        catch (error) {
            logger_1.logger.error('Error cleaning up expired permissions:', error);
            return 0;
        }
    }
}
exports.AccountPermissionService = AccountPermissionService;
//# sourceMappingURL=AccountPermissionService.js.map