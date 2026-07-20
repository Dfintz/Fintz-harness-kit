"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleRequestService = void 0;
const database_1 = require("../../config/database");
const ApprovalRequest_1 = require("../../models/ApprovalRequest");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const Role_1 = require("../../models/Role");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const ApprovalService_1 = require("../approval/ApprovalService");
const NotificationService_1 = require("../communication/notifications/NotificationService");
const MemberRoleAssignmentService_1 = require("./MemberRoleAssignmentService");
const APPROVER_ROLE_NAMES = ['owner', 'founder', 'admin'];
const ROLE_CHANGE_TYPE = ApprovalRequest_1.ApprovalRequestType.ROLE_CHANGE;
const PENDING_STATUS = ApprovalRequest_1.ApprovalRequestStatus.PENDING;
class RoleRequestService {
    approvalService = new ApprovalService_1.ApprovalService();
    memberRoleAssignmentService = new MemberRoleAssignmentService_1.MemberRoleAssignmentService();
    notificationService = new NotificationService_1.NotificationService();
    membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    roleRepo = database_1.AppDataSource.getRepository(Role_1.Role);
    async assertApprover(organizationId, userId) {
        const membership = await this.membershipRepo.findOne({
            where: { userId, organizationId, isActive: true },
        });
        if (!membership || !APPROVER_ROLE_NAMES.includes((0, roleUtils_1.getRoleName)(membership.role))) {
            throw new apiErrors_1.ForbiddenError('Organization admin access required to manage role requests', {
                resource: 'roleRequest',
                action: 'approve',
            });
        }
    }
    async findEligibleApproverIds(organizationId, excludeUserId) {
        const memberships = await this.membershipRepo.find({
            where: { organizationId, isActive: true },
        });
        return memberships
            .filter(m => m.userId !== excludeUserId && APPROVER_ROLE_NAMES.includes((0, roleUtils_1.getRoleName)(m.role)))
            .map(m => m.userId);
    }
    async requestRoleChange(organizationId, requesterId, roleId, reason) {
        const role = await this.roleRepo.findOne({ where: { id: roleId } });
        if (!role) {
            throw new apiErrors_1.NotFoundError('Role', roleId);
        }
        if (role.organizationId && role.organizationId !== organizationId) {
            throw new apiErrors_1.ForbiddenError('Role does not belong to this organization', {
                resource: 'role',
                action: 'request',
                resourceId: roleId,
            });
        }
        if (APPROVER_ROLE_NAMES.includes((0, roleUtils_1.getRoleName)(role))) {
            throw new apiErrors_1.ValidationError('Governance roles cannot be requested through self-service');
        }
        const membership = await this.membershipRepo.findOne({
            where: { userId: requesterId, organizationId, isActive: true },
        });
        if (!membership) {
            throw new apiErrors_1.ForbiddenError('You are not an active member of this organization', {
                resource: 'organization',
                action: 'requestRole',
            });
        }
        if (membership.roleId === role.id) {
            throw new apiErrors_1.ValidationError('You already hold this role');
        }
        const approverIds = await this.findEligibleApproverIds(organizationId, requesterId);
        if (approverIds.length === 0) {
            throw new apiErrors_1.ConflictError('No eligible approver is available to review this request');
        }
        const approval = await this.approvalService.createApproval(organizationId, requesterId, {
            type: ApprovalRequest_1.ApprovalRequestType.ROLE_CHANGE,
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
    async approveRoleChange(organizationId, approvalId, approverId, comment) {
        await this.assertApprover(organizationId, approverId);
        const queryRunner = database_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        let approved;
        let grantedRequesterId;
        let grantedRoleName;
        try {
            const approval = await queryRunner.manager.getRepository(ApprovalRequest_1.ApprovalRequest).findOne({
                where: { id: approvalId, organizationId, type: ApprovalRequest_1.ApprovalRequestType.ROLE_CHANGE },
                lock: { mode: 'pessimistic_write' },
            });
            if (!approval) {
                throw new apiErrors_1.NotFoundError('Role change request', approvalId);
            }
            if (approval.status !== PENDING_STATUS) {
                throw new apiErrors_1.ConflictError(`Cannot approve request in status: ${approval.status}`);
            }
            if (approval.requestedBy === approverId) {
                throw new apiErrors_1.ForbiddenError('You cannot approve your own role change request', {
                    resource: 'roleRequest',
                    action: 'approve',
                    resourceId: approvalId,
                });
            }
            if (!approval.resourceId) {
                throw new apiErrors_1.ConflictError('Role change request is missing its target role');
            }
            const requesterMembership = await queryRunner.manager
                .getRepository(OrganizationMembership_1.OrganizationMembership)
                .findOne({ where: { userId: approval.requestedBy, organizationId, isActive: true } });
            if (!requesterMembership) {
                throw new apiErrors_1.ConflictError('Requester is no longer an active member of this organization');
            }
            const assignment = await this.memberRoleAssignmentService.applyRoleAssignment(queryRunner.manager, {
                organizationId,
                targetUserId: approval.requestedBy,
                roleId: approval.resourceId,
                actorUserId: approverId,
            });
            approved = await this.approvalService.approve(approvalId, organizationId, approverId, comment, queryRunner.manager);
            await queryRunner.commitTransaction();
            grantedRequesterId = approval.requestedBy;
            grantedRoleName = assignment.roleName;
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
        await this.runPostApprove(organizationId, grantedRequesterId, approverId, grantedRoleName);
        return approved;
    }
    async rejectRoleChange(organizationId, approvalId, approverId, reason) {
        await this.assertApprover(organizationId, approverId);
        const approval = await this.approvalService.getApproval(approvalId, organizationId);
        if (!approval) {
            throw new apiErrors_1.NotFoundError('Role change request', approvalId);
        }
        if (approval.type !== ROLE_CHANGE_TYPE) {
            throw new apiErrors_1.NotFoundError('Role change request', approvalId);
        }
        const rejected = await this.approvalService.reject(approvalId, organizationId, approverId, reason);
        const roleName = this.resolveRoleName(approval);
        await this.notifyRequester(approval.requestedBy, organizationId, approverId, roleName, 'rejected');
        return rejected;
    }
    async listPendingForApprover(organizationId, approverId) {
        await this.assertApprover(organizationId, approverId);
        const { approvals } = await this.approvalService.listApprovals(organizationId, {
            status: ApprovalRequest_1.ApprovalRequestStatus.PENDING,
            type: ApprovalRequest_1.ApprovalRequestType.ROLE_CHANGE,
        });
        return approvals;
    }
    resolveRoleName(approval) {
        const fromMetadata = approval.metadata?.roleName;
        if (typeof fromMetadata === 'string' && fromMetadata.length > 0) {
            return fromMetadata;
        }
        return 'requested role';
    }
    async runPostApprove(organizationId, requesterId, approverId, roleName) {
        try {
            await this.memberRoleAssignmentService.emitRoleChanged(organizationId, requesterId, approverId);
        }
        catch (error) {
            logger_1.logger.error('Failed to emit role-change event after approval', {
                organizationId,
                requesterId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
        await this.notifyRequester(requesterId, organizationId, approverId, roleName, 'approved');
    }
    async notifyApprovers(approverIds, organizationId, requesterId, roleName, approvalId) {
        await Promise.all(approverIds.map(approverId => this.safeNotify({
            userId: approverId,
            type: 'role_request',
            title: 'New role change request',
            message: `A member has requested the "${roleName}" role and needs your approval.`,
            data: { organizationId, requesterId, approvalId, roleName },
            senderId: requesterId,
        })));
    }
    async notifyRequester(requesterId, organizationId, approverId, roleName, outcome) {
        await this.safeNotify({
            userId: requesterId,
            type: outcome === 'approved' ? 'role_request_approved' : 'role_request_rejected',
            title: outcome === 'approved' ? 'Role change approved' : 'Role change rejected',
            message: outcome === 'approved'
                ? `Your request for the "${roleName}" role was approved.`
                : `Your request for the "${roleName}" role was rejected.`,
            data: { organizationId, approverId, roleName },
            senderId: approverId,
        });
    }
    async safeNotify(data) {
        try {
            await this.notificationService.create(data);
        }
        catch (error) {
            logger_1.logger.error('Failed to send role-request notification', {
                userId: data.userId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
}
exports.RoleRequestService = RoleRequestService;
//# sourceMappingURL=RoleRequestService.js.map