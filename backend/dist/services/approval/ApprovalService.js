"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApprovalService = exports.ApprovalAuditAction = void 0;
const database_1 = require("../../config/database");
const ApprovalRequest_1 = require("../../models/ApprovalRequest");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const ApprovalAuditLogger_1 = require("./ApprovalAuditLogger");
Object.defineProperty(exports, "ApprovalAuditAction", { enumerable: true, get: function () { return ApprovalAuditLogger_1.ApprovalAuditAction; } });
class ApprovalService {
    approvalRepo = database_1.AppDataSource.getRepository(ApprovalRequest_1.ApprovalRequest);
    async listApprovals(organizationId, filters) {
        const qb = this.approvalRepo
            .createQueryBuilder('approval')
            .where('approval.organizationId = :organizationId', { organizationId })
            .orderBy('approval.createdAt', 'DESC');
        if (filters?.status) {
            qb.andWhere('approval.status = :status', { status: filters.status });
        }
        if (filters?.type) {
            qb.andWhere('approval.type = :type', { type: filters.type });
        }
        if (filters?.assignedTo) {
            qb.andWhere('approval.assignedTo = :assignedTo', { assignedTo: filters.assignedTo });
        }
        const [approvals, total] = await qb.getManyAndCount();
        return { approvals, total };
    }
    async getApproval(approvalId, organizationId) {
        return this.approvalRepo.findOne({ where: { id: approvalId, organizationId } });
    }
    async createApproval(organizationId, requestedBy, data) {
        if (!data.type?.trim()) {
            throw new apiErrors_1.ValidationError('Approval type is required');
        }
        const approval = this.approvalRepo.create({
            ...data,
            type: data.type.trim(),
            organizationId,
            requestedBy,
            status: ApprovalRequest_1.ApprovalRequestStatus.PENDING,
            history: [
                {
                    action: 'created',
                    userId: requestedBy,
                    timestamp: new Date().toISOString(),
                },
            ],
        });
        const saved = await this.approvalRepo.save(approval);
        logger_1.logger.info('ApprovalService.createApproval: Approval request created', {
            approvalId: saved.id,
            type: data.type,
            organizationId,
            requestedBy,
        });
        ApprovalAuditLogger_1.approvalAuditLogger.log({
            action: ApprovalAuditLogger_1.ApprovalAuditAction.APPROVAL_REQUEST_SUBMITTED,
            approvalRequestId: saved.id,
            requestType: data.type,
            subject: data.title,
            requesterId: requestedBy,
            organizationId,
            performedById: requestedBy,
            details: { type: data.type, assignedTo: data.assignedTo, resourceId: data.resourceId },
        });
        return saved;
    }
    async approve(approvalId, organizationId, userId, comment, manager) {
        const repo = manager ? manager.getRepository(ApprovalRequest_1.ApprovalRequest) : this.approvalRepo;
        const approval = await repo.findOne({
            where: { id: approvalId, organizationId },
        });
        if (!approval) {
            throw new apiErrors_1.NotFoundError('Approval request', approvalId);
        }
        if (approval.status !== ApprovalRequest_1.ApprovalRequestStatus.PENDING) {
            throw new apiErrors_1.ValidationError(`Cannot approve request in status: ${approval.status}`);
        }
        if (approval.assignedTo && approval.assignedTo !== userId) {
            throw new apiErrors_1.ForbiddenError('Only the assigned approver can approve this request', {
                resource: 'approval',
                action: 'approve',
                resourceId: approvalId,
            });
        }
        approval.status = ApprovalRequest_1.ApprovalRequestStatus.APPROVED;
        approval.completedAt = new Date();
        approval.completedBy = userId;
        this.addHistory(approval, {
            action: 'approved',
            userId,
            timestamp: new Date().toISOString(),
            comment,
        });
        const saved = await repo.save(approval);
        logger_1.logger.info('ApprovalService.approve: Approval granted', {
            approvalId,
            userId,
            organizationId,
        });
        ApprovalAuditLogger_1.approvalAuditLogger.logApprovalApproved(approvalId, approval.title ?? approval.type, userId, userId, approval.requestedBy, organizationId);
        return saved;
    }
    async reject(approvalId, organizationId, userId, reason) {
        const approval = await this.approvalRepo.findOne({
            where: { id: approvalId, organizationId },
        });
        if (!approval) {
            throw new apiErrors_1.NotFoundError('Approval request', approvalId);
        }
        if (approval.status !== ApprovalRequest_1.ApprovalRequestStatus.PENDING) {
            throw new apiErrors_1.ValidationError(`Cannot reject request in status: ${approval.status}`);
        }
        if (approval.assignedTo && approval.assignedTo !== userId) {
            throw new apiErrors_1.ForbiddenError('Only the assigned approver can reject this request', {
                resource: 'approval',
                action: 'reject',
                resourceId: approvalId,
            });
        }
        approval.status = ApprovalRequest_1.ApprovalRequestStatus.REJECTED;
        approval.completedAt = new Date();
        approval.completedBy = userId;
        this.addHistory(approval, {
            action: 'rejected',
            userId,
            timestamp: new Date().toISOString(),
            comment: reason,
        });
        const saved = await this.approvalRepo.save(approval);
        logger_1.logger.info('ApprovalService.reject: Approval rejected', {
            approvalId,
            userId,
            organizationId,
            reason,
        });
        ApprovalAuditLogger_1.approvalAuditLogger.logApprovalRejected(approvalId, approval.title ?? approval.type, userId, userId, approval.requestedBy, reason ?? 'No reason provided', organizationId);
        return saved;
    }
    async delegate(approvalId, organizationId, delegatedBy, delegateTo) {
        if (!delegateTo?.trim()) {
            throw new apiErrors_1.ValidationError('Delegate target user ID is required');
        }
        if (delegatedBy === delegateTo) {
            throw new apiErrors_1.ValidationError('Cannot delegate an approval to yourself');
        }
        const approval = await this.approvalRepo.findOne({
            where: { id: approvalId, organizationId },
        });
        if (!approval) {
            throw new apiErrors_1.NotFoundError('Approval request', approvalId);
        }
        if (approval.status !== ApprovalRequest_1.ApprovalRequestStatus.PENDING) {
            throw new apiErrors_1.ValidationError(`Cannot delegate request in status: ${approval.status}`);
        }
        if (approval.assignedTo && approval.assignedTo !== delegatedBy) {
            throw new apiErrors_1.ForbiddenError('Only the current assignee can delegate this approval', {
                resource: 'approval',
                action: 'delegate',
                resourceId: approvalId,
            });
        }
        approval.delegatedTo = delegateTo;
        approval.delegatedBy = delegatedBy;
        approval.assignedTo = delegateTo;
        this.addHistory(approval, {
            action: 'delegated',
            userId: delegatedBy,
            timestamp: new Date().toISOString(),
            comment: `Delegated to user ${delegateTo}`,
        });
        const saved = await this.approvalRepo.save(approval);
        logger_1.logger.info('ApprovalService.delegate: Approval delegated', {
            approvalId,
            delegatedBy,
            delegateTo,
            organizationId,
        });
        ApprovalAuditLogger_1.approvalAuditLogger.logApprovalDelegated(approvalId, approval.title ?? approval.type, delegatedBy, delegatedBy, delegateTo, delegateTo, organizationId);
        return saved;
    }
    async getPending(organizationId, userId) {
        return this.approvalRepo.find({
            where: { organizationId, assignedTo: userId, status: ApprovalRequest_1.ApprovalRequestStatus.PENDING },
            order: { createdAt: 'DESC' },
        });
    }
    addHistory(approval, entry) {
        approval.history = [...(approval.history ?? []), entry];
    }
}
exports.ApprovalService = ApprovalService;
//# sourceMappingURL=ApprovalService.js.map