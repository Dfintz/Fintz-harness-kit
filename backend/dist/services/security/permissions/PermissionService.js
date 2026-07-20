"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionService = void 0;
const data_source_1 = require("../../../data-source");
const OrganizationMembership_1 = require("../../../models/OrganizationMembership");
const Permission_1 = require("../../../models/Permission");
const SecurityLevel_1 = require("../../../models/SecurityLevel");
const logger_1 = require("../../../utils/logger");
const roleUtils_1 = require("../../../utils/roleUtils");
const AuditService_1 = require("../../audit/AuditService");
class PermissionService {
    permissionRepository = data_source_1.AppDataSource.getRepository(Permission_1.Permission);
    userOrgRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    securityLevelRepository = data_source_1.AppDataSource.getRepository(SecurityLevel_1.SecurityLevel);
    async hasPermission(userId, organizationId, resource, action) {
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
            if (permission.expiresAt && permission.expiresAt < new Date()) {
                return false;
            }
            return true;
        }
        const userOrg = await this.userOrgRepository.findOne({
            where: { userId, organizationId },
        });
        if (!userOrg) {
            return false;
        }
        if ((0, roleUtils_1.isOwnerOrAdminRole)(userOrg.role)) {
            return true;
        }
        if (userOrg.permissions?.includes(`${resource}:${action}`)) {
            return true;
        }
        return false;
    }
    async grantPermission(userId, organizationId, resource, action, grantedBy, expiresAt) {
        let permission = await this.permissionRepository.findOne({
            where: { userId, organizationId, resource, action },
        });
        if (permission) {
            permission.granted = true;
            permission.grantedBy = grantedBy;
            permission.expiresAt = expiresAt;
        }
        else {
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
        logger_1.logger.info('Granting permission', {
            userId,
            organizationId,
            resource,
            action,
            grantedBy,
            expiresAt,
        });
        const savedPermission = await this.permissionRepository.save(permission);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.PERMISSION,
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
    async revokePermission(userId, organizationId, resource, action, revokedBy) {
        const permission = await this.permissionRepository.findOne({
            where: { userId, organizationId, resource, action },
        });
        if (permission) {
            logger_1.logger.info('Revoking permission', {
                userId,
                organizationId,
                resource,
                action,
                revokedBy,
            });
            permission.granted = false;
            await this.permissionRepository.save(permission);
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.PERMISSION,
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
    async getUserPermissions(userId, organizationId) {
        return this.permissionRepository.find({
            where: { userId, organizationId, granted: true },
        });
    }
    async getUsersWithPermission(organizationId, resource, action) {
        return this.permissionRepository.find({
            where: { organizationId, resource, action, granted: true },
        });
    }
    async updateSecurityLevel(userId, organizationId, securityLevel, updatedBy) {
        const userOrg = await this.userOrgRepository.findOne({
            where: { userId, organizationId },
        });
        if (!userOrg) {
            throw new Error('User is not a member of this organization');
        }
        if (securityLevel < 1 || securityLevel > 5) {
            throw new Error('Security level must be between 1 and 5');
        }
        logger_1.logger.info('Updating security level', {
            userId,
            organizationId,
            newSecurityLevel: securityLevel,
            updatedBy,
        });
        const previousLevel = userOrg.securityLevel;
        userOrg.securityLevel = securityLevel;
        const updated = await this.userOrgRepository.save(userOrg);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.SECURITY,
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
    async setInterOrgSecurityLevel(sourceOrgId, targetOrgId, level, resourceType, accessLevel, approvedBy, restrictions, notes, expiresAt) {
        if (level < 1 || level > 10) {
            throw new Error('Security level must be between 1 and 10');
        }
        const validAccessLevels = ['none', 'read', 'write', 'full'];
        if (!validAccessLevels.includes(accessLevel)) {
            throw new Error(`Access level must be one of: ${validAccessLevels.join(', ')}`);
        }
        if (sourceOrgId === targetOrgId) {
            throw new Error('Cannot set security level from an organization to itself');
        }
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
            securityLevel.isActive = true;
        }
        else {
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
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.SECURITY,
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
    async hasInterOrgAccess(sourceOrgId, targetOrgId, resourceType, requiredAccessLevel = 'read', requiredSecurityLevel = 1) {
        let securityLevel = await this.securityLevelRepository.findOne({
            where: { sourceOrgId, targetOrgId, resourceType, isActive: true },
        });
        if (!securityLevel) {
            securityLevel = await this.securityLevelRepository.findOne({
                where: { sourceOrgId, targetOrgId, resourceType: '*', isActive: true },
            });
        }
        if (!securityLevel) {
            return false;
        }
        return securityLevel.grantsAccess(requiredSecurityLevel, requiredAccessLevel);
    }
    async getInterOrgSecurityLevels(organizationId) {
        return this.securityLevelRepository.find({
            where: [{ sourceOrgId: organizationId }, { targetOrgId: organizationId }],
            relations: ['sourceOrganization', 'targetOrganization'],
            order: { createdAt: 'DESC' },
        });
    }
    async getAllSecurityLevels() {
        return this.securityLevelRepository.find({
            relations: ['sourceOrganization', 'targetOrganization'],
            order: { createdAt: 'DESC' },
        });
    }
    async revokeInterOrgSecurityLevel(sourceOrgId, targetOrgId, resourceType, revokedBy) {
        const securityLevel = await this.securityLevelRepository.findOne({
            where: { sourceOrgId, targetOrgId, resourceType },
        });
        if (securityLevel) {
            logger_1.logger.info('Revoking inter-org security level', {
                sourceOrgId,
                targetOrgId,
                resourceType,
                revokedBy,
            });
            securityLevel.isActive = false;
            securityLevel.updatedBy = revokedBy;
            await this.securityLevelRepository.save(securityLevel);
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.SECURITY,
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
    async cleanupExpiredPermissions() {
        const result = await this.permissionRepository
            .createQueryBuilder()
            .update(Permission_1.Permission)
            .set({ granted: false })
            .where('expiresAt < :now', { now: new Date() })
            .andWhere('granted = :granted', { granted: true })
            .execute();
        return result.affected || 0;
    }
}
exports.PermissionService = PermissionService;
//# sourceMappingURL=PermissionService.js.map