import { EntityManager } from 'typeorm';

import { AppDataSource } from '../../config/database';
import {
  ApprovalRequest,
  ApprovalRequestStatus,
  type ApprovalHistoryEntry,
} from '../../models/ApprovalRequest';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

import { ApprovalAuditAction, approvalAuditLogger } from './ApprovalAuditLogger';

export { ApprovalAuditAction };

export class ApprovalService {
  private readonly approvalRepo = AppDataSource.getRepository(ApprovalRequest);

  async listApprovals(
    organizationId: string,
    filters?: { status?: string; type?: string; assignedTo?: string }
  ): Promise<{ approvals: ApprovalRequest[]; total: number }> {
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

  async getApproval(approvalId: string, organizationId: string): Promise<ApprovalRequest | null> {
    return this.approvalRepo.findOne({ where: { id: approvalId, organizationId } });
  }

  async createApproval(
    organizationId: string,
    requestedBy: string,
    data: {
      type: string;
      title?: string;
      description?: string;
      resourceId?: string;
      resourceType?: string;
      assignedTo?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<ApprovalRequest> {
    if (!data.type?.trim()) {
      throw new ValidationError('Approval type is required');
    }

    const approval = this.approvalRepo.create({
      ...data,
      type: data.type.trim(),
      organizationId,
      requestedBy,
      status: ApprovalRequestStatus.PENDING,
      history: [
        {
          action: 'created',
          userId: requestedBy,
          timestamp: new Date().toISOString(),
        },
      ],
    });
    const saved = await this.approvalRepo.save(approval);

    logger.info('ApprovalService.createApproval: Approval request created', {
      approvalId: saved.id,
      type: data.type,
      organizationId,
      requestedBy,
    });
    approvalAuditLogger.log({
      action: ApprovalAuditAction.APPROVAL_REQUEST_SUBMITTED,
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

  async approve(
    approvalId: string,
    organizationId: string,
    userId: string,
    comment?: string,
    manager?: EntityManager
  ): Promise<ApprovalRequest> {
    // When a manager is supplied the status transition participates in the
    // caller's transaction (used by RoleRequestService to keep approve + grant
    // atomic). Otherwise the default repository is used.
    const repo = manager ? manager.getRepository(ApprovalRequest) : this.approvalRepo;
    const approval = await repo.findOne({
      where: { id: approvalId, organizationId },
    });
    if (!approval) {
      throw new NotFoundError('Approval request', approvalId);
    }
    if (approval.status !== ApprovalRequestStatus.PENDING) {
      throw new ValidationError(`Cannot approve request in status: ${approval.status}`);
    }
    // Authorization: only the assigned approver (or delegatee) can approve
    if (approval.assignedTo && approval.assignedTo !== userId) {
      throw new ForbiddenError('Only the assigned approver can approve this request', {
        resource: 'approval',
        action: 'approve',
        resourceId: approvalId,
      });
    }

    approval.status = ApprovalRequestStatus.APPROVED;
    approval.completedAt = new Date();
    approval.completedBy = userId;
    this.addHistory(approval, {
      action: 'approved',
      userId,
      timestamp: new Date().toISOString(),
      comment,
    });
    const saved = await repo.save(approval);

    logger.info('ApprovalService.approve: Approval granted', {
      approvalId,
      userId,
      organizationId,
    });
    approvalAuditLogger.logApprovalApproved(
      approvalId,
      approval.title ?? approval.type,
      userId,
      userId,
      approval.requestedBy,
      organizationId
    );

    return saved;
  }

  async reject(
    approvalId: string,
    organizationId: string,
    userId: string,
    reason?: string
  ): Promise<ApprovalRequest> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, organizationId },
    });
    if (!approval) {
      throw new NotFoundError('Approval request', approvalId);
    }
    if (approval.status !== ApprovalRequestStatus.PENDING) {
      throw new ValidationError(`Cannot reject request in status: ${approval.status}`);
    }
    // Authorization: only the assigned approver (or delegatee) can reject
    if (approval.assignedTo && approval.assignedTo !== userId) {
      throw new ForbiddenError('Only the assigned approver can reject this request', {
        resource: 'approval',
        action: 'reject',
        resourceId: approvalId,
      });
    }

    approval.status = ApprovalRequestStatus.REJECTED;
    approval.completedAt = new Date();
    approval.completedBy = userId;
    this.addHistory(approval, {
      action: 'rejected',
      userId,
      timestamp: new Date().toISOString(),
      comment: reason,
    });
    const saved = await this.approvalRepo.save(approval);

    logger.info('ApprovalService.reject: Approval rejected', {
      approvalId,
      userId,
      organizationId,
      reason,
    });
    approvalAuditLogger.logApprovalRejected(
      approvalId,
      approval.title ?? approval.type,
      userId,
      userId,
      approval.requestedBy,
      reason ?? 'No reason provided',
      organizationId
    );

    return saved;
  }

  async delegate(
    approvalId: string,
    organizationId: string,
    delegatedBy: string,
    delegateTo: string
  ): Promise<ApprovalRequest> {
    if (!delegateTo?.trim()) {
      throw new ValidationError('Delegate target user ID is required');
    }
    if (delegatedBy === delegateTo) {
      throw new ValidationError('Cannot delegate an approval to yourself');
    }

    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, organizationId },
    });
    if (!approval) {
      throw new NotFoundError('Approval request', approvalId);
    }
    if (approval.status !== ApprovalRequestStatus.PENDING) {
      throw new ValidationError(`Cannot delegate request in status: ${approval.status}`);
    }
    // Authorization: only the current assignee can delegate
    if (approval.assignedTo && approval.assignedTo !== delegatedBy) {
      throw new ForbiddenError('Only the current assignee can delegate this approval', {
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

    logger.info('ApprovalService.delegate: Approval delegated', {
      approvalId,
      delegatedBy,
      delegateTo,
      organizationId,
    });
    approvalAuditLogger.logApprovalDelegated(
      approvalId,
      approval.title ?? approval.type,
      delegatedBy,
      delegatedBy,
      delegateTo,
      delegateTo,
      organizationId
    );

    return saved;
  }

  async getPending(organizationId: string, userId: string): Promise<ApprovalRequest[]> {
    return this.approvalRepo.find({
      where: { organizationId, assignedTo: userId, status: ApprovalRequestStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  private addHistory(approval: ApprovalRequest, entry: ApprovalHistoryEntry): void {
    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    approval.history = [...(approval.history ?? []), entry];
  }
}
