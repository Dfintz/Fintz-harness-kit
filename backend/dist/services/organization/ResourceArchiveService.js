"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResourceArchiveService = void 0;
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
class ResourceArchiveService {
    static instance;
    fleetRepository = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
    constructor() { }
    static getInstance() {
        if (!ResourceArchiveService.instance) {
            ResourceArchiveService.instance = new ResourceArchiveService();
        }
        return ResourceArchiveService.instance;
    }
    async archiveFleet(fleetId, organizationId, archivedBy, reason) {
        const fleet = await this.fleetRepository.findOne({
            where: { id: fleetId, organizationId },
        });
        if (!fleet) {
            throw new Error('Fleet not found');
        }
        if (fleet.isArchived) {
            throw new Error('Fleet is already archived');
        }
        fleet.isArchived = true;
        fleet.archivedAt = new Date();
        fleet.archivedBy = archivedBy;
        fleet.archiveReason = reason;
        const archived = await this.fleetRepository.save(fleet);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: archivedBy,
            message: `Fleet archived: ${fleet.name}`,
            metadata: {
                fleetId,
                organizationId,
                fleetName: fleet.name,
                reason,
                action: 'archive',
            },
        });
        logger_1.logger.info('Fleet archived', {
            fleetId,
            organizationId,
            fleetName: fleet.name,
            archivedBy,
            reason,
        });
        return archived;
    }
    async restoreFleet(fleetId, organizationId, restoredBy) {
        const fleet = await this.fleetRepository.findOne({
            where: { id: fleetId, organizationId },
        });
        if (!fleet) {
            throw new Error('Fleet not found');
        }
        if (!fleet.isArchived) {
            throw new Error('Fleet is not archived');
        }
        fleet.isArchived = false;
        fleet.archivedAt = undefined;
        fleet.archivedBy = undefined;
        fleet.archiveReason = undefined;
        fleet.restoredAt = new Date();
        fleet.restoredBy = restoredBy;
        const restored = await this.fleetRepository.save(fleet);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: restoredBy,
            message: `Fleet restored: ${fleet.name}`,
            metadata: {
                fleetId,
                organizationId,
                fleetName: fleet.name,
                action: 'restore',
            },
        });
        logger_1.logger.info('Fleet restored', {
            fleetId,
            organizationId,
            fleetName: fleet.name,
            restoredBy,
        });
        return restored;
    }
    async permanentlyDeleteFleet(fleetId, organizationId, deletedBy, minimumArchiveDays = 30) {
        const fleet = await this.fleetRepository.findOne({
            where: { id: fleetId, organizationId },
        });
        if (!fleet) {
            throw new Error('Fleet not found');
        }
        if (!fleet.isArchived) {
            throw new Error('Fleet must be archived before permanent deletion');
        }
        if (fleet.archivedAt) {
            const daysSinceArchive = Math.floor((Date.now() - fleet.archivedAt.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSinceArchive < minimumArchiveDays) {
                throw new Error(`Fleet must be archived for at least ${minimumArchiveDays} days before permanent deletion. Currently archived for ${daysSinceArchive} days.`);
            }
        }
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: deletedBy,
            message: `Fleet permanently deleted: ${fleet.name}`,
            metadata: {
                fleetId,
                organizationId,
                fleetName: fleet.name,
                action: 'permanent_delete',
            },
        });
        await this.fleetRepository.delete(fleetId);
        logger_1.logger.warn('Fleet permanently deleted', {
            fleetId,
            organizationId,
            fleetName: fleet.name,
            deletedBy,
        });
    }
    async getArchivedFleets(organizationId) {
        return this.fleetRepository.find({
            where: { organizationId, isArchived: true },
            order: { archivedAt: 'DESC' },
        });
    }
    async getArchivedFleetById(fleetId, organizationId) {
        return this.fleetRepository.findOne({
            where: { id: fleetId, organizationId, isArchived: true },
        });
    }
    async getArchivedFleetCount(organizationId) {
        return this.fleetRepository.count({
            where: { organizationId, isArchived: true },
        });
    }
}
exports.ResourceArchiveService = ResourceArchiveService;
//# sourceMappingURL=ResourceArchiveService.js.map