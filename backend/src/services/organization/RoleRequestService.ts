import { AppDataSource } from '../../config/database';
import {
  ApprovalRequest,
  ApprovalRequestStatus,
  ApprovalRequestType,
} from '../../models/ApprovalRequest';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { Role as RoleEntity } from '../../models/Role';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import { ApprovalService } from '../approval/ApprovalService';
import {
  CreateInAppNotificationData,
  NotificationService,
} from '../communication/notifications/NotificationService';

import { MemberRoleAssignmentService } from './MemberRoleAssignmentService';

/** Organization roles permitted to approve/reject role-change requests. */
const APPROVER_ROLE_NAMES = ['owner', 'founder', 'admin'];

// String widenings of the approval enums for safe (non-enum) comparisons.
const ROLE_CHANGE_TYPE: string = ApprovalRequestType.ROLE_CHANGE;
const PENDING_STATUS: string = ApprovalRequestStatus.PENDING;

/**
 * Orchestrates the organization role-change request loop surfaced in the Inbox:
 * a member requests a role, an authorized approver (owner/founder/admin) reviews
 * it, and on approval the role is granted automatically.
 *
 * Lives in the organization domain because it owns `OrganizationMembership.roleId`.
 * The generic {@link ApprovalService} stores the request record; this service
 * adds the RBAC-specific authorization, approver routing, and auto-grant — the
 * approval service is never coupled to role semantics.
 */
export class RoleRequestService {
  private readonly approvalService = new ApprovalService();
  private readonly memberRoleAssignmentService = new MemberRoleAssignmentService();
  private readonly notificationService = new NotificationService();
  private readonly membershipRepo = AppDataSource.getRepository(OrganizationMembership);
  private readonly roleRepo = AppDataSource.getRepository(RoleEntity);

  /**
   * Re-verify the actor currently holds organization role-management authority.
   * Authorization is based on the actor's *current* role, never on a stored
   * assignee, so a member who has since lost admin rights cannot act.
   */
  private async assertApprover(organizationId: string, userId: string): Promise<void> {
    const membership = await this.membershipRepo.findOne({
      where: { userId, organizationId, isActive: true },
    });
    if (!membership || !APPROVER_ROLE_NAMES.includes(getRoleName(membership.role))) {
      throw new ForbiddenError('Organization admin access required to manage role requests', {
        resource: 'roleRequest',
        action: 'approve',
      });
    }
  }

  /** Active owner/founder/admin members, excluding the requester. */
  private async findEligibleApproverIds(
    organizationId: string,
    excludeUserId: string
  ): Promise<string[]> {
    const memberships = await this.membershipRepo.find({
      where: { organizationId, isActive: true },
    });
    return memberships
      .filter(m => m.userId !== excludeUserId && APPROVER_ROLE_NAMES.includes(getRoleName(m.role)))
      .map(m => m.userId);
  }

  /**
   * Create a role-change request for the requester and notify eligible approvers.
   * Fails fast with {@link ConflictError} when no eligible approver exists so no
   * orphaned request is created.
   */
  async requestRoleChange(
    organizationId: string,
    requesterId: string,
    roleId: string,
    reason?: string
  ): Promise<ApprovalRequest> {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundError('Role', roleId);
    }
    if (role.organizationId && role.organizationId !== organizationId) {
      throw new ForbiddenError('Role does not belong to this organization', {
        resource: 'role',
        action: 'request',
        resourceId: roleId,
      });
    }
    // Block self-service elevation into governance roles. Higher-privilege custom
    // roles remain subject to the deferred permission-fingerprint guard (v2).
    if (APPROVER_ROLE_NAMES.includes(getRoleName(role))) {
      throw new ValidationError('Governance roles cannot be requested through self-service');
    }

    const membership = await this.membershipRepo.findOne({
      where: { userId: requesterId, organizationId, isActive: true },
    });
    if (!membership) {
      throw new ForbiddenError('You are not an active member of this organization', {
        resource: 'organization',
        action: 'requestRole',
      });
    }
    if (membership.roleId === role.id) {
      throw new ValidationError('You already hold this role');
    }

    const approverIds = await this.findEligibleApproverIds(organizationId, requesterId);
    if (approverIds.length === 0) {
      throw new ConflictError('No eligible approver is available to review this request');
    }

    const approval = await this.approvalService.createApproval(organizationId, requesterId, {
      type: ApprovalRequestType.ROLE_CHANGE,
      title: `Role change request: ${role.name}`,
      description: reason,
      resourceId: role.id,
      resourceType: 'role',
      reason,
      metadata: { roleName: role.name },
    });

    await this.notifyApprovers(approverIds, organizationId, requesterId, role.name, approval.id);

    return approval;
  }

  /**
   * Approve a pending role-change request and grant the role atomically.
   *
   * The approval status transition and the membership role update happen inside
   * a single transaction with a pessimistic lock on the request row, so the
   * request can never be marked APPROVED without the role actually being granted
   * (and vice versa). Notifications and the permission-change event fire only
   * after the transaction commits.
   */
  async approveRoleChange(
    organizationId: string,
    approvalId: string,
    approverId: string,
    comment?: string
  ): Promise<ApprovalRequest> {
    await this.assertApprover(organizationId, approverId);

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let approved!: ApprovalRequest;
    let grantedRequesterId!: string;
    let grantedRoleName!: string;
    try {
      const approval = await queryRunner.manager.getRepository(ApprovalRequest).findOne({
        where: { id: approvalId, organizationId, type: ApprovalRequestType.ROLE_CHANGE },
        lock: { mode: 'pessimistic_write' },
      });
      if (!approval) {
        throw new NotFoundError('Role change request', approvalId);
      }
      if (approval.status !== PENDING_STATUS) {
        throw new ConflictError(`Cannot approve request in status: ${approval.status}`);
      }
      if (approval.requestedBy === approverId) {
        throw new ForbiddenError('You cannot approve your own role change request', {
          resource: 'roleRequest',
          action: 'approve',
          resourceId: approvalId,
        });
      }
      if (!approval.resourceId) {
        throw new ConflictError('Role change request is missing its target role');
      }

      // Requester must still be an active member at decision time.
      const requesterMembership = await queryRunner.manager
        .getRepository(OrganizationMembership)
        .findOne({ where: { userId: approval.requestedBy, organizationId, isActive: true } });
      if (!requesterMembership) {
        throw new ConflictError('Requester is no longer an active member of this organization');
      }

      const assignment = await this.memberRoleAssignmentService.applyRoleAssignment(
        queryRunner.manager,
        {
          organizationId,
          targetUserId: approval.requestedBy,
          roleId: approval.resourceId,
          actorUserId: approverId,
        }
      );

      approved = await this.approvalService.approve(
        approvalId,
        organizationId,
        approverId,
        comment,
        queryRunner.manager
      );

      await queryRunner.commitTransaction();
      grantedRequesterId = approval.requestedBy;
      grantedRoleName = assignment.roleName;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Post-commit side-effects run after the transaction has fully resolved, so a
    // best-effort failure can never roll back (or appear to roll back) the
    // committed grant. The DB commit is the source of truth.
    await this.runPostApprove(organizationId, grantedRequesterId, approverId, grantedRoleName);

    return approved;
  }

  /** Reject a pending role-change request and notify the requester. */
  async rejectRoleChange(
    organizationId: string,
    approvalId: string,
    approverId: string,
    reason: string
  ): Promise<ApprovalRequest> {
    await this.assertApprover(organizationId, approverId);

    const approval = await this.approvalService.getApproval(approvalId, organizationId);
    if (!approval) {
      throw new NotFoundError('Role change request', approvalId);
    }
    if (approval.type !== ROLE_CHANGE_TYPE) {
      throw new NotFoundError('Role change request', approvalId);
    }

    const rejected = await this.approvalService.reject(
      approvalId,
      organizationId,
      approverId,
      reason
    );

    const roleName = this.resolveRoleName(approval);
    await this.notifyRequester(
      approval.requestedBy,
      organizationId,
      approverId,
      roleName,
      'rejected'
    );

    return rejected;
  }

  /** List pending role-change requests visible to an authorized approver. */
  async listPendingForApprover(
    organizationId: string,
    approverId: string
  ): Promise<ApprovalRequest[]> {
    await this.assertApprover(organizationId, approverId);
    const { approvals } = await this.approvalService.listApprovals(organizationId, {
      status: ApprovalRequestStatus.PENDING,
      type: ApprovalRequestType.ROLE_CHANGE,
    });
    return approvals;
  }

  // ── side-effects (best-effort; never throw into the request path) ──────────

  private resolveRoleName(approval: ApprovalRequest): string {
    const fromMetadata = approval.metadata?.roleName;
    if (typeof fromMetadata === 'string' && fromMetadata.length > 0) {
      return fromMetadata;
    }
    return 'requested role';
  }

  private async runPostApprove(
    organizationId: string,
    requesterId: string,
    approverId: string,
    roleName: string
  ): Promise<void> {
    try {
      await this.memberRoleAssignmentService.emitRoleChanged(
        organizationId,
        requesterId,
        approverId
      );
    } catch (error: unknown) {
      logger.error('Failed to emit role-change event after approval', {
        organizationId,
        requesterId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await this.notifyRequester(requesterId, organizationId, approverId, roleName, 'approved');
  }

  private async notifyApprovers(
    approverIds: string[],
    organizationId: string,
    requesterId: string,
    roleName: string,
    approvalId: string
  ): Promise<void> {
    await Promise.all(
      approverIds.map(approverId =>
        this.safeNotify({
          userId: approverId,
          type: 'role_request',
          title: 'New role change request',
          message: `A member has requested the "${roleName}" role and needs your approval.`,
          data: { organizationId, requesterId, approvalId, roleName },
          senderId: requesterId,
        })
      )
    );
  }

  private async notifyRequester(
    requesterId: string,
    organizationId: string,
    approverId: string,
    roleName: string,
    outcome: 'approved' | 'rejected'
  ): Promise<void> {
    await this.safeNotify({
      userId: requesterId,
      type: outcome === 'approved' ? 'role_request_approved' : 'role_request_rejected',
      title: outcome === 'approved' ? 'Role change approved' : 'Role change rejected',
      message:
        outcome === 'approved'
          ? `Your request for the "${roleName}" role was approved.`
          : `Your request for the "${roleName}" role was rejected.`,
      data: { organizationId, approverId, roleName },
      senderId: approverId,
    });
  }

  private async safeNotify(data: CreateInAppNotificationData): Promise<void> {
    try {
      await this.notificationService.create(data);
    } catch (error: unknown) {
      logger.error('Failed to send role-request notification', {
        userId: data.userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

