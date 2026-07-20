"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemberRoleAssignmentService = void 0;
const database_1 = require("../../config/database");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const Role_1 = require("../../models/Role");
const api_1 = require("../../types/api");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const AuditService_1 = require("../audit/AuditService");
const PermissionChangeEventService_1 = require("../security/permissions/PermissionChangeEventService");
class MemberRoleAssignmentService {
    permissionChangeEventService = PermissionChangeEventService_1.PermissionChangeEventService.getInstance();
    async applyRoleAssignment(manager, params) {
        const { organizationId, targetUserId, roleId } = params;
        const role = await manager.getRepository(Role_1.Role).findOne({ where: { id: roleId } });
        if (!role) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
        }
        if (role.organizationId && role.organizationId !== organizationId) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.FORBIDDEN, 'Role does not belong to this organization', 403);
        }
        const membershipRepo = manager.getRepository(OrganizationMembership_1.OrganizationMembership);
        const membership = await membershipRepo.findOne({
            where: { userId: targetUserId, organizationId },
        });
        if (!membership) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User is not a member of this organization', 404);
        }
        const previousRoleName = (0, roleUtils_1.getRoleName)(membership.role);
        membership.roleId = role.id;
        await membershipRepo.save(membership);
        logger_1.logger.info('MemberRoleAssignmentService.applyRoleAssignment: Role assigned', {
            organizationId,
            targetUserId,
            roleId: role.id,
            roleName: role.name,
            previousRoleName,
            actorUserId: params.actorUserId,
        });
        return { targetUserId, roleId: role.id, roleName: role.name, previousRoleName };
    }
    async emitRoleChanged(organizationId, targetUserId, actorUserId) {
        await this.permissionChangeEventService.onUserRoleChanged(organizationId, targetUserId, 'role_assigned', actorUserId);
    }
    async assignRole(params) {
        const result = await this.applyRoleAssignment(database_1.AppDataSource.manager, params);
        await this.emitRoleChanged(params.organizationId, params.targetUserId, params.actorUserId);
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.PERMISSION,
            action: 'ROLE_ASSIGNED',
            message: `Role '${result.roleName}' assigned to user ${params.targetUserId} (was '${result.previousRoleName}') by ${params.actorUserId}`,
            userId: params.actorUserId,
            organizationId: params.organizationId,
            resource: `org/${params.organizationId}/member/${params.targetUserId}/role`,
            metadata: {
                roleId: result.roleId,
                roleName: result.roleName,
                previousRoleName: result.previousRoleName,
                targetUserId: params.targetUserId,
            },
        });
        return result;
    }
}
exports.MemberRoleAssignmentService = MemberRoleAssignmentService;
//# sourceMappingURL=MemberRoleAssignmentService.js.map