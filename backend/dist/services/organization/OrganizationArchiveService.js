"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationArchiveService = void 0;
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
class OrganizationArchiveService {
    static instance;
    organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    userOrgRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    constructor() { }
    static getInstance() {
        if (!OrganizationArchiveService.instance) {
            OrganizationArchiveService.instance = new OrganizationArchiveService();
        }
        return OrganizationArchiveService.instance;
    }
    async archiveOrganization(organizationId, archivedBy, reason) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        if (organization.isArchived) {
            throw new Error('Organization is already archived');
        }
        organization.isArchived = true;
        organization.archivedAt = new Date();
        organization.archivedBy = archivedBy;
        organization.archiveReason = reason;
        const archived = await this.organizationRepository.save(organization);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: archivedBy,
            message: `Organization archived: ${organization.name}`,
            metadata: {
                organizationId,
                organizationName: organization.name,
                reason,
                action: 'archive',
            },
        });
        logger_1.logger.info('Organization archived', {
            organizationId,
            organizationName: organization.name,
            archivedBy,
            reason,
        });
        return archived;
    }
    async restoreOrganization(organizationId, restoredBy) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        if (!organization.isArchived) {
            throw new Error('Organization is not archived');
        }
        const previousArchiveInfo = {
            archivedAt: organization.archivedAt,
            archivedBy: organization.archivedBy,
            archiveReason: organization.archiveReason,
        };
        organization.isArchived = false;
        organization.archivedAt = undefined;
        organization.archivedBy = undefined;
        organization.archiveReason = undefined;
        organization.restoredAt = new Date();
        organization.restoredBy = restoredBy;
        const restored = await this.organizationRepository.save(organization);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: restoredBy,
            message: `Organization restored: ${organization.name}`,
            metadata: {
                organizationId,
                organizationName: organization.name,
                previousArchiveInfo,
                action: 'restore',
            },
        });
        logger_1.logger.info('Organization restored', {
            organizationId,
            organizationName: organization.name,
            restoredBy,
        });
        return restored;
    }
    async permanentlyDelete(organizationId, deletedBy, minimumArchiveDays = 30) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        if (!organization.isArchived) {
            throw new Error('Organization must be archived before permanent deletion');
        }
        if (organization.archivedAt) {
            const daysSinceArchive = Math.floor((Date.now() - organization.archivedAt.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceArchive < minimumArchiveDays) {
                throw new Error(`Organization must be archived for at least ${minimumArchiveDays} days before permanent deletion. Currently archived for ${daysSinceArchive} days.`);
            }
        }
        await this.userOrgRepository.delete({ organizationId });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: deletedBy,
            message: `Organization permanently deleted: ${organization.name}`,
            metadata: {
                organizationId,
                organizationName: organization.name,
                action: 'permanent_delete',
            },
        });
        await this.organizationRepository.delete(organizationId);
        logger_1.logger.warn('Organization permanently deleted', {
            organizationId,
            organizationName: organization.name,
            deletedBy,
        });
    }
    async getArchivedOrganizations() {
        return this.organizationRepository.find({
            where: { isArchived: true },
            order: { archivedAt: 'DESC' },
        });
    }
    async getOrganizationsPendingDeletion(minimumArchiveDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - minimumArchiveDays);
        return this.organizationRepository
            .createQueryBuilder('org')
            .where('org.isArchived = :isArchived', { isArchived: true })
            .andWhere('org.archivedAt <= :cutoffDate', { cutoffDate })
            .orderBy('org.archivedAt', 'ASC')
            .getMany();
    }
    async cleanupOldArchivedOrganizations(daysBeforeDeletion = 90, systemUserId = 'system') {
        const organizationsToDelete = await this.getOrganizationsPendingDeletion(daysBeforeDeletion);
        let deletedCount = 0;
        for (const org of organizationsToDelete) {
            try {
                await this.permanentlyDelete(org.id, systemUserId, 0);
                deletedCount++;
            }
            catch (error) {
                logger_1.logger.error('Failed to delete archived organization', {
                    organizationId: org.id,
                    error,
                });
            }
        }
        if (deletedCount > 0) {
            logger_1.logger.info('Cleanup completed', {
                deletedCount,
                totalCandidates: organizationsToDelete.length,
            });
        }
        return deletedCount;
    }
}
exports.OrganizationArchiveService = OrganizationArchiveService;
//# sourceMappingURL=OrganizationArchiveService.js.map