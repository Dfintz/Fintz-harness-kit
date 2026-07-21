import { EntityManager } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { Role as RoleEntity } from '../../models/Role';
import { ApiErrorCode } from '../../types/api';
import { ApiError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import { AuditCategory, auditService } from '../audit/AuditService';
import { PermissionChangeEventService } from '../security/permissions/PermissionChangeEventService';

export interface AssignRoleParams {
  organizationId: string;
  targetUserId: string;
  roleId: string;
  actorUserId: string;
}

export interface RoleAssignmentResult {
  targetUserId: string;
  roleId: string;
  roleName: string;
  /** Name of the role the member held before this assignment. */
  previousRoleName: string;
}

/**
 * Canonical organization role-assignment service.
 *
 * Single source of truth for granting an organization role to a member:
 * validates the role belongs to the organization, locates the membership,
 * mutates `roleId`, and emits the permission-change event that drives cache
 * invalidation + session refresh.
 *
 * Used by both the direct admin assignment path (RolesControllerV2) and the
 * approval-driven auto-grant path (RoleRequestService) so the security-critical
 * grant logic never drifts between callers.
 */
export class MemberRoleAssignmentService {
  private readonly permissionChangeEventService = PermissionChangeEventService.getInstance();

  /**
   * Apply the role assignment using the caller-provided entity manager so the
   * write can participate in an enclosing transaction. Does NOT emit
   * side-effects — callers emit `emitRoleChanged` after the transaction commits.
   */
  async applyRoleAssignment(
    manager: EntityManager,
    params: AssignRoleParams
  ): Promise<RoleAssignmentResult> {
    const { organizationId, targetUserId, roleId } = params;

    const role = await manager.getRepository(RoleEntity).findOne({ where: { id: roleId } });
    if (!role) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'Role not found', 404);
    }
    if (role.organizationId && role.organizationId !== organizationId) {
      throw new ApiError(ApiErrorCode.FORBIDDEN, 'Role does not belong to this organization', 403);
    }

    const membershipRepo = manager.getRepository(OrganizationMembership);
    const membership = await membershipRepo.findOne({
      where: { userId: targetUserId, organizationId },
    });
    if (!membership) {
      throw new ApiError(
        ApiErrorCode.RESOURCE_NOT_FOUND,
        'User is not a member of this organization',
        404
      );
    }

    const previousRoleName = getRoleName(membership.role);
    membership.roleId = role.id;
    await membershipRepo.save(membership);

    logger.info('MemberRoleAssignmentService.applyRoleAssignment: Role assigned', {
      organizationId,
      targetUserId,
      roleId: role.id,
      roleName: role.name,
      previousRoleName,
      actorUserId: params.actorUserId,
    });

    return { targetUserId, roleId: role.id, roleName: role.name, previousRoleName };
  }

  /**
   * Emit the permission-change event (cache invalidation + session refresh).
   * Call AFTER the assignment transaction commits.
   */
  async emitRoleChanged(
    organizationId: string,
    targetUserId: string,
    actorUserId: string
  ): Promise<void> {
    await this.permissionChangeEventService.onUserRoleChanged(
      organizationId,
      targetUserId,
      'role_assigned',
      actorUserId
    );
  }

  /**
   * Standalone (non-transactional) assignment: applies the change on the default
   * manager and emits the permission-change event. Used by the direct admin
   * assignment endpoint, which has no enclosing transaction.
   */
  async assignRole(params: AssignRoleParams): Promise<RoleAssignmentResult> {
    const result = await this.applyRoleAssignment(AppDataSource.manager, params);
    await this.emitRoleChanged(params.organizationId, params.targetUserId, params.actorUserId);

    auditService.log({
      category: AuditCategory.PERMISSION,
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
