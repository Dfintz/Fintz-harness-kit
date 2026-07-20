"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = exports.BackupAuditAction = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Backup_1 = require("../../models/Backup");
const BackupSchedule_1 = require("../../models/BackupSchedule");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const TenantService_1 = require("../base/TenantService");
const BackupStorageService_1 = require("../cloud/BackupStorageService");
var BackupAuditAction;
(function (BackupAuditAction) {
    BackupAuditAction["BACKUP_CREATED"] = "backup_created";
    BackupAuditAction["BACKUP_COMPLETED"] = "backup_completed";
    BackupAuditAction["BACKUP_FAILED"] = "backup_failed";
    BackupAuditAction["BACKUP_DELETED"] = "backup_deleted";
    BackupAuditAction["BACKUP_RESTORED"] = "backup_restored";
    BackupAuditAction["SCHEDULE_CONFIGURED"] = "schedule_configured";
})(BackupAuditAction || (exports.BackupAuditAction = BackupAuditAction = {}));
class BackupService extends TenantService_1.TenantService {
    scheduleRepository = data_source_1.AppDataSource.getRepository(BackupSchedule_1.BackupSchedule);
    backupStorage = (0, BackupStorageService_1.getBackupStorageService)();
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Backup_1.Backup), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
    }
    logBackupAudit(action, backup, performedById, performedByName, details) {
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: performedById,
            username: performedByName,
            resource: `backup/${backup.id}`,
            action,
            message: `Backup ${action}: ${backup.name} (${backup.backupType})`,
            metadata: {
                backupId: backup.id,
                backupType: backup.backupType,
                status: backup.status,
                ...details,
            },
        });
    }
    async createBackup(organizationId, creatorId, creatorName, dto) {
        const name = dto.name ?? `Backup ${new Date().toISOString().slice(0, 16)}`;
        const backupType = dto.backupType ?? Backup_1.BackupType.FULL;
        const backup = await this.create(organizationId, {
            name,
            description: dto.description,
            backupType,
            status: Backup_1.BackupStatus.PENDING,
            createdBy: creatorId,
            createdByName: creatorName,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        this.logBackupAudit(BackupAuditAction.BACKUP_CREATED, backup, creatorId, creatorName);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'backup:created', {
            backupId: backup.id,
            name: backup.name,
            status: backup.status,
        });
        void this.processBackup(backup.id, organizationId, creatorId, creatorName);
        logger_1.logger.info(`Backup created: ${backup.id} (${backupType}) by ${creatorName}`);
        return backup;
    }
    async processBackup(backupId, organizationId, creatorId, creatorName) {
        try {
            await this.update(organizationId, backupId, {
                status: Backup_1.BackupStatus.PROCESSING,
            });
            (0, websocketServer_1.emitToOrganization)(organizationId, 'backup:processing', { backupId });
            const backupData = await this.collectOrganizationData(organizationId);
            let blobName;
            let sizeBytes = 0;
            if (this.backupStorage.isConfigured()) {
                const result = await this.backupStorage.uploadBackup(organizationId, backupId, backupData.data);
                blobName = result.blobName;
                sizeBytes = result.sizeBytes;
            }
            else {
                const jsonStr = JSON.stringify(backupData.data);
                sizeBytes = Buffer.byteLength(jsonStr, 'utf-8');
                logger_1.logger.warn('Azure Blob Storage not configured — backup data not persisted to cloud');
            }
            const completed = await this.update(organizationId, backupId, {
                status: Backup_1.BackupStatus.COMPLETED,
                blobName,
                sizeBytes,
                entityCount: backupData.entityCount,
                entityBreakdown: backupData.breakdown,
                completedAt: new Date(),
            });
            if (completed) {
                this.logBackupAudit(BackupAuditAction.BACKUP_COMPLETED, completed, creatorId, creatorName, {
                    entityCount: backupData.entityCount,
                    sizeBytes,
                });
            }
            (0, websocketServer_1.emitToOrganization)(organizationId, 'backup:completed', {
                backupId,
                entityCount: backupData.entityCount,
                sizeBytes,
            });
            logger_1.logger.info(`Backup completed: ${backupId} (${backupData.entityCount} entities, ${sizeBytes} bytes)`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger_1.logger.error(`Backup failed: ${backupId}`, { error: errorMessage });
            await this.update(organizationId, backupId, {
                status: Backup_1.BackupStatus.FAILED,
                errorMessage,
            });
            (0, websocketServer_1.emitToOrganization)(organizationId, 'backup:failed', {
                backupId,
                error: errorMessage,
            });
        }
    }
    async collectOrganizationData(organizationId) {
        const breakdown = {};
        const data = {
            meta: {
                organizationId,
                backupVersion: '1.0',
                createdAt: new Date().toISOString(),
                format: 'sc-fleet-manager-backup',
            },
        };
        let totalCount = 0;
        const entityQueries = [
            {
                name: 'fleets',
                query: `SELECT * FROM "fleets" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
            {
                name: 'fleet_ships',
                query: `SELECT fs.* FROM "fleet_ships" fs INNER JOIN "fleets" f ON fs."fleetId" = f."id" WHERE f."organizationId" = $1 AND f."deletedAt" IS NULL`,
            },
            {
                name: 'activities',
                query: `SELECT * FROM "activities" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
            {
                name: 'squadrons',
                query: `SELECT * FROM "squadrons" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
            {
                name: 'announcements',
                query: `SELECT * FROM "announcements" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
            {
                name: 'bounties',
                query: `SELECT * FROM "bounties" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
            {
                name: 'polls',
                query: `SELECT * FROM "polls" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
            {
                name: 'poll_votes',
                query: `SELECT pv.* FROM "poll_votes" pv INNER JOIN "polls" p ON pv."pollId" = p."id" WHERE p."organizationId" = $1 AND p."deletedAt" IS NULL`,
            },
            {
                name: 'organization_ships',
                query: `SELECT * FROM "organization_ships" WHERE "organizationId" = $1`,
            },
            {
                name: 'events',
                query: `SELECT * FROM "events" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
            {
                name: 'mining_operations',
                query: `SELECT * FROM "mining_operations" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
            {
                name: 'intel_reports',
                query: `SELECT * FROM "intel_reports" WHERE "organizationId" = $1 AND "deletedAt" IS NULL`,
            },
        ];
        for (const { name, query } of entityQueries) {
            try {
                const rows = await data_source_1.AppDataSource.query(query, [organizationId]);
                const rowCount = Array.isArray(rows) ? rows.length : 0;
                data[name] = rows;
                breakdown[name] = rowCount;
                totalCount += rowCount;
            }
            catch (error) {
                logger_1.logger.warn(`Failed to backup entity '${name}':`, error);
                breakdown[name] = 0;
                data[name] = [];
            }
        }
        return { data, entityCount: totalCount, breakdown };
    }
    async getBackupById(organizationId, backupId) {
        return this.findById(organizationId, backupId);
    }
    async listBackups(organizationId, filters, pagination) {
        const where = {};
        if (filters.status) {
            where.status = filters.status;
        }
        if (filters.backupType) {
            where.backupType = filters.backupType;
        }
        return this.findAllPaginated(organizationId, {
            ...pagination,
            sortBy: filters.sortBy ?? 'createdAt',
            sortOrder: filters.sortOrder ?? 'DESC',
        }, where);
    }
    async getBackupStatus(organizationId) {
        const backups = await this.findAll(organizationId);
        let latest = null;
        if (backups.length > 0) {
            const sorted = [...backups].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
            latest = sorted[0] ?? null;
        }
        const schedule = await this.scheduleRepository.findOne({
            where: { organizationId },
        });
        return {
            latestBackup: latest ?? null,
            totalBackups: backups.length,
            schedule,
        };
    }
    async getDownloadUrl(organizationId, backupId) {
        const backup = await this.findById(organizationId, backupId);
        if (!backup?.blobName) {
            return null;
        }
        if (!this.backupStorage.isConfigured()) {
            throw new apiErrors_1.ServiceUnavailableError('Azure Blob Storage is not configured');
        }
        return this.backupStorage.generateDownloadUrl(backup.blobName);
    }
    async deleteBackup(organizationId, backupId, userId, userName) {
        const backup = await this.findById(organizationId, backupId);
        if (!backup) {
            throw new apiErrors_1.NotFoundError('Backup');
        }
        if (backup.blobName) {
            await this.backupStorage.deleteBackup(backup.blobName);
        }
        await this.delete(organizationId, backupId);
        this.logBackupAudit(BackupAuditAction.BACKUP_DELETED, backup, userId, userName);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'backup:deleted', { backupId });
        logger_1.logger.info(`Backup deleted: ${backupId} by ${userName}`);
    }
    async restoreFromBackup(organizationId, backupId, userId, userName) {
        const backup = await this.findById(organizationId, backupId);
        if (!backup) {
            throw new apiErrors_1.NotFoundError('Backup');
        }
        if (backup.status !== Backup_1.BackupStatus.COMPLETED) {
            throw new apiErrors_1.ConflictError('Only completed backups can be restored');
        }
        this.logBackupAudit(BackupAuditAction.BACKUP_RESTORED, backup, userId, userName);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'backup:restore_started', {
            backupId,
            backupName: backup.name,
        });
        logger_1.logger.info(`Restore initiated from backup ${backupId} by ${userName}`);
        return {
            message: `Restore from backup "${backup.name}" has been queued. You will be notified when it completes.`,
        };
    }
    async configureSchedule(organizationId, userId, userName, dto) {
        let schedule = await this.scheduleRepository.findOne({
            where: { organizationId },
        });
        if (schedule) {
            schedule.frequency = dto.frequency;
            if (dto.retentionDays !== undefined) {
                schedule.retentionDays = dto.retentionDays;
            }
            if (dto.enabled !== undefined) {
                schedule.enabled = dto.enabled;
            }
            schedule.nextRunAt = this.calculateNextRun(dto.frequency);
        }
        else {
            schedule = this.scheduleRepository.create({
                organizationId,
                frequency: dto.frequency,
                retentionDays: dto.retentionDays ?? 30,
                enabled: dto.enabled ?? true,
                createdBy: userId,
                nextRunAt: this.calculateNextRun(dto.frequency),
            });
        }
        await this.scheduleRepository.save(schedule);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId,
            username: userName,
            resource: `backup-schedule/${schedule.id}`,
            action: BackupAuditAction.SCHEDULE_CONFIGURED,
            message: `Backup schedule configured: ${dto.frequency}, retention: ${schedule.retentionDays}d`,
            metadata: {
                scheduleId: schedule.id,
                frequency: dto.frequency,
                retentionDays: schedule.retentionDays,
                enabled: schedule.enabled,
            },
        });
        logger_1.logger.info(`Backup schedule configured for org ${organizationId}: ${dto.frequency}`);
        return schedule;
    }
    async getSchedule(organizationId) {
        return this.scheduleRepository.findOne({
            where: { organizationId },
        });
    }
    async cleanupExpiredBackups() {
        const expiredBackups = await this.repository.find({
            where: {
                status: (0, typeorm_1.In)([Backup_1.BackupStatus.COMPLETED, Backup_1.BackupStatus.FAILED]),
            },
        });
        let cleanedCount = 0;
        for (const backup of expiredBackups) {
            if (backup.expiresAt && new Date() > backup.expiresAt) {
                if (backup.blobName) {
                    await this.backupStorage.deleteBackup(backup.blobName);
                }
                backup.status = Backup_1.BackupStatus.EXPIRED;
                await this.repository.save(backup);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.info(`Cleaned up ${cleanedCount} expired backup(s)`);
        }
        return cleanedCount;
    }
    calculateNextRun(frequency) {
        const now = new Date();
        switch (frequency) {
            case BackupSchedule_1.BackupFrequency.DAILY:
                return new Date(now.getTime() + 24 * 60 * 60 * 1000);
            case BackupSchedule_1.BackupFrequency.WEEKLY:
                return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            case BackupSchedule_1.BackupFrequency.MONTHLY:
                return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            default:
                return new Date(now.getTime() + 24 * 60 * 60 * 1000);
        }
    }
}
exports.BackupService = BackupService;
//# sourceMappingURL=BackupService.js.map