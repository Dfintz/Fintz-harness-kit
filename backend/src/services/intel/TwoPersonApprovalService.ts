import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { IntelApproval, IntelApprovalStatus } from '../../models/IntelApproval';
import { IntelAuditAction, IntelAuditLog } from '../../models/IntelAuditLog';
import { IntelClassification, IntelEntry } from '../../models/IntelEntry';
import { IntelOfficer, IntelOfficerRank } from '../../models/IntelOfficer';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';

/**
 * Configuration for two-person approval
 */
export interface TwoPersonApprovalConfig {
  requiredApprovals: number; // Number of approvals required (default: 2)
  expirationHours: number; // Hours until approval request expires (default: 72)
  allowSelfApproval: boolean; // Whether requester can approve their own request (default: false)
  notifyOnPending: boolean; // Notify approvers when new request is created
  notifyOnComplete: boolean; // Notify requester when approval is complete
}

const DEFAULT_CONFIG: TwoPersonApprovalConfig = {
  requiredApprovals: 2,
  expirationHours: 72,
  allowSelfApproval: false,
  notifyOnPending: true,
  notifyOnComplete: true,
};

/**
 * Two-Person Approval Service
 *
 * Implements dual-authorization for TOP_SECRET Intel entries.
 * Requires two separate authorized users to approve changes.
 */
export class TwoPersonApprovalService {
  private readonly approvalRepo: Repository<IntelApproval>;
  private readonly intelEntryRepo: Repository<IntelEntry>;
  private readonly intelOfficerRepo: Repository<IntelOfficer>;
  private readonly auditLogRepo: Repository<IntelAuditLog>;
  private readonly userOrgRepo: Repository<OrganizationMembership>;
  private readonly config: TwoPersonApprovalConfig;

  constructor(config: Partial<TwoPersonApprovalConfig> = {}) {
    this.approvalRepo = AppDataSource.getRepository(IntelApproval);
    this.intelEntryRepo = AppDataSource.getRepository(IntelEntry);
    this.intelOfficerRepo = AppDataSource.getRepository(IntelOfficer);
    this.auditLogRepo = AppDataSource.getRepository(IntelAuditLog);
    this.userOrgRepo = AppDataSource.getRepository(OrganizationMembership);
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if an Intel entry requires two-person approval
   */
  requiresTwoPersonApproval(classification: IntelClassification): boolean {
    return classification === IntelClassification.TOP_SECRET;
  }

  /**
   * Check if a user can be an approver for TOP_SECRET content
   */
  async canBeApprover(userId: string, organizationId: string): Promise<boolean> {
    // Check if user is org owner
    const userOrg = await this.userOrgRepo.findOne({
      where: { userId, organizationId, isActive: true },
    });

    if (getRoleName(userOrg?.role) === 'owner' || getRoleName(userOrg?.role) === 'founder') {
      return true;
    }

    // Check if user is Chief or Lead Intel officer
    const officer = await this.intelOfficerRepo.findOne({
      where: { userId, organizationId, isActive: true },
    });

    if (!officer) {
      return false;
    }

    return [IntelOfficerRank.CHIEF, IntelOfficerRank.LEAD].includes(officer.rank);
  }

  /**
   * Get all eligible approvers for an organization
   */
  async getEligibleApprovers(organizationId: string): Promise<string[]> {
    const approvers: string[] = [];

    // Get org owners
    const owners = await this.userOrgRepo.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: { organizationId, role: 'owner', isActive: true } as any,
    });
    approvers.push(...owners.map(o => o.userId));

    // Get Chief and Lead officers — filter at DB level instead of loading all officers
    const seniorOfficers = await this.intelOfficerRepo.find({
      where: [
        { organizationId, isActive: true, rank: IntelOfficerRank.CHIEF },
        { organizationId, isActive: true, rank: IntelOfficerRank.LEAD },
      ],
    });
    approvers.push(...seniorOfficers.map(o => o.userId));

    // Remove duplicates
    return [...new Set(approvers)];
  }

  /**
   * Request approval for a TOP_SECRET Intel entry
   */
  async requestApproval(
    intelEntryId: string,
    requestedBy: string,
    organizationId: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelApproval> {
    try {
      // Verify entry exists and is TOP_SECRET
      const entry = await this.intelEntryRepo.findOne({
        where: { id: intelEntryId, organizationId },
      });

      if (!entry) {
        throw new Error('Intel entry not found');
      }

      if (entry.classification !== IntelClassification.TOP_SECRET) {
        throw new Error('Two-person approval is only required for TOP_SECRET entries');
      }

      // Check for existing pending approval
      const existingApproval = await this.approvalRepo.findOne({
        where: {
          intelEntryId,
          organizationId,
          status: IntelApprovalStatus.PENDING,
        },
      });

      if (existingApproval) {
        throw new Error('An approval request is already pending for this entry');
      }

      // Calculate expiration
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.config.expirationHours);

      // Create approval request
      const approval = this.approvalRepo.create({
        id: uuidv4(),
        organizationId,
        intelEntryId,
        requestedBy,
        status: IntelApprovalStatus.PENDING,
        reason,
        requiredApprovals: this.config.requiredApprovals,
        approvers: [],
        approvalDetails: [],
        expiresAt,
      });

      const saved = await this.approvalRepo.save(approval);

      // Log audit event
      await this.logAudit({
        organizationId,
        userId: requestedBy,
        intelEntryId,
        action: IntelAuditAction.APPROVAL_REQUESTED,
        description: `Requested two-person approval for TOP_SECRET entry`,
        ipAddress,
        userAgent,
        severity: 'info',
        metadata: {
          approvalId: saved.id,
          requiredApprovals: this.config.requiredApprovals,
        },
      });

      logger.info('Two-person approval requested', {
        approvalId: saved.id,
        intelEntryId,
        organizationId,
        requestedBy,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error requesting two-person approval:', error);
      throw error;
    }
  }

  /**
   * Submit an approval decision
   */
  async submitApproval(
    approvalId: string,
    approverId: string,
    organizationId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelApproval> {
    try {
      // Get approval request
      const approval = await this.approvalRepo.findOne({
        where: { id: approvalId, organizationId },
      });

      if (!approval) {
        throw new Error('Approval request not found');
      }

      if (approval.status !== IntelApprovalStatus.PENDING) {
        throw new Error(`Cannot modify approval with status: ${approval.status}`);
      }

      // Check if expired
      if (approval.expiresAt && new Date() > approval.expiresAt) {
        approval.status = IntelApprovalStatus.EXPIRED;
        await this.approvalRepo.save(approval);
        throw new Error('Approval request has expired');
      }

      // Check if user can be an approver
      const canApprove = await this.canBeApprover(approverId, organizationId);
      if (!canApprove) {
        throw new Error('User is not authorized to approve TOP_SECRET content');
      }

      // Check if user is the requester (self-approval)
      if (!this.config.allowSelfApproval && approval.requestedBy === approverId) {
        throw new Error('Self-approval is not permitted');
      }

      // Check if user has already approved/rejected
      const existingDecision = approval.approvalDetails?.find(d => d.userId === approverId);
      if (existingDecision) {
        throw new Error('User has already submitted a decision');
      }

      // Add approval detail
      const approvalDetail = {
        userId: approverId,
        timestamp: new Date(),
        decision,
        comment,
      };

      approval.approvalDetails = [...(approval.approvalDetails || []), approvalDetail];

      if (decision === 'rejected') {
        // Any rejection rejects the entire request
        approval.status = IntelApprovalStatus.REJECTED;
        approval.completedAt = new Date();
        approval.completedBy = approverId;
      } else {
        // Check if we have enough approvals
        const approvals = approval.approvalDetails.filter(d => d.decision === 'approved');
        approval.approvers = approvals.map(a => a.userId);

        if (approvals.length >= approval.requiredApprovals) {
          approval.status = IntelApprovalStatus.APPROVED;
          approval.completedAt = new Date();
          approval.completedBy = approverId;
        }
      }

      const saved = await this.approvalRepo.save(approval);

      // Log audit event with appropriate action type
      const auditAction =
        decision === 'approved'
          ? IntelAuditAction.APPROVAL_GRANTED
          : IntelAuditAction.APPROVAL_REJECTED;

      await this.logAudit({
        organizationId,
        userId: approverId,
        intelEntryId: approval.intelEntryId,
        action: auditAction,
        description: `${decision === 'approved' ? 'Approved' : 'Rejected'} two-person approval request`,
        ipAddress,
        userAgent,
        severity: decision === 'rejected' ? 'warning' : 'info',
        metadata: {
          approvalId: saved.id,
          decision,
          comment,
          finalStatus: saved.status,
        },
      });

      logger.info('Two-person approval decision submitted', {
        approvalId: saved.id,
        approverId,
        decision,
        newStatus: saved.status,
      });

      return saved;
    } catch (error: unknown) {
      logger.error('Error submitting approval decision:', error);
      throw error;
    }
  }

  /**
   * Get pending approvals for an organization
   */
  async getPendingApprovals(organizationId: string): Promise<IntelApproval[]> {
    return this.approvalRepo.find({
      where: { organizationId, status: IntelApprovalStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get approval history for an Intel entry
   */
  async getApprovalHistory(intelEntryId: string, organizationId: string): Promise<IntelApproval[]> {
    return this.approvalRepo.find({
      where: { intelEntryId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Withdraw an approval request
   */
  async withdrawApproval(
    approvalId: string,
    userId: string,
    organizationId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<IntelApproval> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, organizationId },
    });

    if (!approval) {
      throw new Error('Approval request not found');
    }

    if (approval.requestedBy !== userId) {
      throw new Error('Only the requester can withdraw an approval request');
    }

    if (approval.status !== IntelApprovalStatus.PENDING) {
      throw new Error(`Cannot withdraw approval with status: ${approval.status}`);
    }

    approval.status = IntelApprovalStatus.WITHDRAWN;
    approval.completedAt = new Date();
    approval.completedBy = userId;

    const saved = await this.approvalRepo.save(approval);

    // Log audit event
    await this.logAudit({
      organizationId,
      userId,
      intelEntryId: approval.intelEntryId,
      action: IntelAuditAction.APPROVAL_WITHDRAWN,
      description: 'Withdrew two-person approval request',
      ipAddress,
      userAgent,
      severity: 'info',
      metadata: { approvalId: saved.id },
    });

    return saved;
  }

  /**
   * Check if an Intel entry is approved for modification
   */
  async isApprovedForModification(intelEntryId: string, organizationId: string): Promise<boolean> {
    const approval = await this.approvalRepo.findOne({
      where: {
        intelEntryId,
        organizationId,
        status: IntelApprovalStatus.APPROVED,
      },
      order: { createdAt: 'DESC' },
    });

    if (!approval) {
      return false;
    }

    // Check if approval is still valid (within 24 hours of approval)
    if (approval.completedAt) {
      const validUntil = new Date(approval.completedAt);
      validUntil.setHours(validUntil.getHours() + 24);
      return new Date() < validUntil;
    }

    return false;
  }

  /**
   * Expire old pending approvals
   */
  async expireOldApprovals(): Promise<number> {
    const now = new Date();

    const result = await this.approvalRepo
      .createQueryBuilder()
      .update()
      .set({ status: IntelApprovalStatus.EXPIRED })
      .where('status = :status', { status: IntelApprovalStatus.PENDING })
      .andWhere('expiresAt < :now', { now })
      .execute();

    const expired = result.affected || 0;

    if (expired > 0) {
      logger.info(`Expired ${expired} old approval requests`);
    }

    return expired;
  }

  /**
   * Log audit event
   */
  private async logAudit(params: {
    organizationId: string;
    userId: string;
    intelEntryId?: string;
    action: IntelAuditAction;
    description: string;
    ipAddress?: string;
    userAgent?: string;
    severity: 'info' | 'warning' | 'critical';
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const log = this.auditLogRepo.create({
      id: uuidv4(),
      ...params,
    });
    await this.auditLogRepo.save(log);
  }
}

