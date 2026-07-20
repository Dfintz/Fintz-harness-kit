"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoPersonApprovalService = void 0;
const uuid_1 = require("uuid");
const data_source_1 = require("../../data-source");
const IntelApproval_1 = require("../../models/IntelApproval");
const IntelAuditLog_1 = require("../../models/IntelAuditLog");
const IntelEntry_1 = require("../../models/IntelEntry");
const IntelOfficer_1 = require("../../models/IntelOfficer");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const DEFAULT_CONFIG = {
    requiredApprovals: 2,
    expirationHours: 72,
    allowSelfApproval: false,
    notifyOnPending: true,
    notifyOnComplete: true,
};
class TwoPersonApprovalService {
    approvalRepo;
    intelEntryRepo;
    intelOfficerRepo;
    auditLogRepo;
    userOrgRepo;
    config;
    constructor(config = {}) {
        this.approvalRepo = data_source_1.AppDataSource.getRepository(IntelApproval_1.IntelApproval);
        this.intelEntryRepo = data_source_1.AppDataSource.getRepository(IntelEntry_1.IntelEntry);
        this.intelOfficerRepo = data_source_1.AppDataSource.getRepository(IntelOfficer_1.IntelOfficer);
        this.auditLogRepo = data_source_1.AppDataSource.getRepository(IntelAuditLog_1.IntelAuditLog);
        this.userOrgRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    requiresTwoPersonApproval(classification) {
        return classification === IntelEntry_1.IntelClassification.TOP_SECRET;
    }
    async canBeApprover(userId, organizationId) {
        const userOrg = await this.userOrgRepo.findOne({
            where: { userId, organizationId, isActive: true },
        });
        if ((0, roleUtils_1.getRoleName)(userOrg?.role) === 'owner' || (0, roleUtils_1.getRoleName)(userOrg?.role) === 'founder') {
            return true;
        }
        const officer = await this.intelOfficerRepo.findOne({
            where: { userId, organizationId, isActive: true },
        });
        if (!officer) {
            return false;
        }
        return [IntelOfficer_1.IntelOfficerRank.CHIEF, IntelOfficer_1.IntelOfficerRank.LEAD].includes(officer.rank);
    }
    async getEligibleApprovers(organizationId) {
        const approvers = [];
        const owners = await this.userOrgRepo.find({
            where: { organizationId, role: 'owner', isActive: true },
        });
        approvers.push(...owners.map(o => o.userId));
        const seniorOfficers = await this.intelOfficerRepo.find({
            where: [
                { organizationId, isActive: true, rank: IntelOfficer_1.IntelOfficerRank.CHIEF },
                { organizationId, isActive: true, rank: IntelOfficer_1.IntelOfficerRank.LEAD },
            ],
        });
        approvers.push(...seniorOfficers.map(o => o.userId));
        return [...new Set(approvers)];
    }
    async requestApproval(intelEntryId, requestedBy, organizationId, reason, ipAddress, userAgent) {
        try {
            const entry = await this.intelEntryRepo.findOne({
                where: { id: intelEntryId, organizationId },
            });
            if (!entry) {
                throw new Error('Intel entry not found');
            }
            if (entry.classification !== IntelEntry_1.IntelClassification.TOP_SECRET) {
                throw new Error('Two-person approval is only required for TOP_SECRET entries');
            }
            const existingApproval = await this.approvalRepo.findOne({
                where: {
                    intelEntryId,
                    organizationId,
                    status: IntelApproval_1.IntelApprovalStatus.PENDING,
                },
            });
            if (existingApproval) {
                throw new Error('An approval request is already pending for this entry');
            }
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + this.config.expirationHours);
            const approval = this.approvalRepo.create({
                id: (0, uuid_1.v4)(),
                organizationId,
                intelEntryId,
                requestedBy,
                status: IntelApproval_1.IntelApprovalStatus.PENDING,
                reason,
                requiredApprovals: this.config.requiredApprovals,
                approvers: [],
                approvalDetails: [],
                expiresAt,
            });
            const saved = await this.approvalRepo.save(approval);
            await this.logAudit({
                organizationId,
                userId: requestedBy,
                intelEntryId,
                action: IntelAuditLog_1.IntelAuditAction.APPROVAL_REQUESTED,
                description: `Requested two-person approval for TOP_SECRET entry`,
                ipAddress,
                userAgent,
                severity: 'info',
                metadata: {
                    approvalId: saved.id,
                    requiredApprovals: this.config.requiredApprovals,
                },
            });
            logger_1.logger.info('Two-person approval requested', {
                approvalId: saved.id,
                intelEntryId,
                organizationId,
                requestedBy,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error requesting two-person approval:', error);
            throw error;
        }
    }
    async submitApproval(approvalId, approverId, organizationId, decision, comment, ipAddress, userAgent) {
        try {
            const approval = await this.approvalRepo.findOne({
                where: { id: approvalId, organizationId },
            });
            if (!approval) {
                throw new Error('Approval request not found');
            }
            if (approval.status !== IntelApproval_1.IntelApprovalStatus.PENDING) {
                throw new Error(`Cannot modify approval with status: ${approval.status}`);
            }
            if (approval.expiresAt && new Date() > approval.expiresAt) {
                approval.status = IntelApproval_1.IntelApprovalStatus.EXPIRED;
                await this.approvalRepo.save(approval);
                throw new Error('Approval request has expired');
            }
            const canApprove = await this.canBeApprover(approverId, organizationId);
            if (!canApprove) {
                throw new Error('User is not authorized to approve TOP_SECRET content');
            }
            if (!this.config.allowSelfApproval && approval.requestedBy === approverId) {
                throw new Error('Self-approval is not permitted');
            }
            const existingDecision = approval.approvalDetails?.find(d => d.userId === approverId);
            if (existingDecision) {
                throw new Error('User has already submitted a decision');
            }
            const approvalDetail = {
                userId: approverId,
                timestamp: new Date(),
                decision,
                comment,
            };
            approval.approvalDetails = [...(approval.approvalDetails || []), approvalDetail];
            if (decision === 'rejected') {
                approval.status = IntelApproval_1.IntelApprovalStatus.REJECTED;
                approval.completedAt = new Date();
                approval.completedBy = approverId;
            }
            else {
                const approvals = approval.approvalDetails.filter(d => d.decision === 'approved');
                approval.approvers = approvals.map(a => a.userId);
                if (approvals.length >= approval.requiredApprovals) {
                    approval.status = IntelApproval_1.IntelApprovalStatus.APPROVED;
                    approval.completedAt = new Date();
                    approval.completedBy = approverId;
                }
            }
            const saved = await this.approvalRepo.save(approval);
            const auditAction = decision === 'approved'
                ? IntelAuditLog_1.IntelAuditAction.APPROVAL_GRANTED
                : IntelAuditLog_1.IntelAuditAction.APPROVAL_REJECTED;
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
            logger_1.logger.info('Two-person approval decision submitted', {
                approvalId: saved.id,
                approverId,
                decision,
                newStatus: saved.status,
            });
            return saved;
        }
        catch (error) {
            logger_1.logger.error('Error submitting approval decision:', error);
            throw error;
        }
    }
    async getPendingApprovals(organizationId) {
        return this.approvalRepo.find({
            where: { organizationId, status: IntelApproval_1.IntelApprovalStatus.PENDING },
            order: { createdAt: 'DESC' },
        });
    }
    async getApprovalHistory(intelEntryId, organizationId) {
        return this.approvalRepo.find({
            where: { intelEntryId, organizationId },
            order: { createdAt: 'DESC' },
        });
    }
    async withdrawApproval(approvalId, userId, organizationId, ipAddress, userAgent) {
        const approval = await this.approvalRepo.findOne({
            where: { id: approvalId, organizationId },
        });
        if (!approval) {
            throw new Error('Approval request not found');
        }
        if (approval.requestedBy !== userId) {
            throw new Error('Only the requester can withdraw an approval request');
        }
        if (approval.status !== IntelApproval_1.IntelApprovalStatus.PENDING) {
            throw new Error(`Cannot withdraw approval with status: ${approval.status}`);
        }
        approval.status = IntelApproval_1.IntelApprovalStatus.WITHDRAWN;
        approval.completedAt = new Date();
        approval.completedBy = userId;
        const saved = await this.approvalRepo.save(approval);
        await this.logAudit({
            organizationId,
            userId,
            intelEntryId: approval.intelEntryId,
            action: IntelAuditLog_1.IntelAuditAction.APPROVAL_WITHDRAWN,
            description: 'Withdrew two-person approval request',
            ipAddress,
            userAgent,
            severity: 'info',
            metadata: { approvalId: saved.id },
        });
        return saved;
    }
    async isApprovedForModification(intelEntryId, organizationId) {
        const approval = await this.approvalRepo.findOne({
            where: {
                intelEntryId,
                organizationId,
                status: IntelApproval_1.IntelApprovalStatus.APPROVED,
            },
            order: { createdAt: 'DESC' },
        });
        if (!approval) {
            return false;
        }
        if (approval.completedAt) {
            const validUntil = new Date(approval.completedAt);
            validUntil.setHours(validUntil.getHours() + 24);
            return new Date() < validUntil;
        }
        return false;
    }
    async expireOldApprovals() {
        const now = new Date();
        const result = await this.approvalRepo
            .createQueryBuilder()
            .update()
            .set({ status: IntelApproval_1.IntelApprovalStatus.EXPIRED })
            .where('status = :status', { status: IntelApproval_1.IntelApprovalStatus.PENDING })
            .andWhere('expiresAt < :now', { now })
            .execute();
        const expired = result.affected || 0;
        if (expired > 0) {
            logger_1.logger.info(`Expired ${expired} old approval requests`);
        }
        return expired;
    }
    async logAudit(params) {
        const log = this.auditLogRepo.create({
            id: (0, uuid_1.v4)(),
            ...params,
        });
        await this.auditLogRepo.save(log);
    }
}
exports.TwoPersonApprovalService = TwoPersonApprovalService;
//# sourceMappingURL=TwoPersonApprovalService.js.map