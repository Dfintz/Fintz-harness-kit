"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DuesService = void 0;
const data_source_1 = require("../../data-source");
const OrgDues_1 = require("../../models/OrgDues");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const TenantService_1 = require("../base/TenantService");
const TreasuryService_1 = require("./TreasuryService");
class DuesService extends TenantService_1.TenantService {
    treasuryService;
    constructor() {
        super(data_source_1.AppDataSource.getRepository(OrgDues_1.OrgDues), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
        this.treasuryService = (0, TreasuryService_1.getTreasuryService)();
    }
    async createDues(organizationId, creatorId, dto) {
        const dues = await this.create(organizationId, {
            name: dto.name,
            amount: dto.amount,
            frequency: dto.frequency,
            dueDay: dto.dueDay ?? 1,
            gracePeriodDays: dto.gracePeriodDays ?? 7,
            createdBy: creatorId,
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: creatorId,
            resource: `dues/${dues.id}`,
            action: 'dues_created',
            message: `Dues created: ${dues.name} (${dues.amount} ${dues.frequency})`,
            metadata: { organizationId, duesId: dues.id },
        });
        logger_1.logger.info('Dues schedule created', { organizationId, duesId: dues.id, name: dues.name });
        return dues;
    }
    async getDuesById(organizationId, duesId) {
        return this.repository
            .createQueryBuilder('dues')
            .where('dues.id = :duesId', { duesId })
            .andWhere('dues.organizationId = :organizationId', { organizationId })
            .getOne();
    }
    async listDues(organizationId, pagination, activeOnly) {
        const where = {
            organizationId,
        };
        if (activeOnly) {
            where.isActive = true;
        }
        return this.findAllPaginated(organizationId, pagination, where);
    }
    async updateDues(organizationId, duesId, dto) {
        const dues = await this.getDuesById(organizationId, duesId);
        if (!dues) {
            throw new apiErrors_1.NotFoundError('Dues schedule');
        }
        if (dto.name !== undefined) {
            dues.name = dto.name;
        }
        if (dto.amount !== undefined) {
            dues.amount = dto.amount;
        }
        if (dto.frequency !== undefined) {
            dues.frequency = dto.frequency;
        }
        if (dto.isActive !== undefined) {
            dues.isActive = dto.isActive;
        }
        if (dto.dueDay !== undefined) {
            dues.dueDay = dto.dueDay;
        }
        if (dto.gracePeriodDays !== undefined) {
            dues.gracePeriodDays = dto.gracePeriodDays;
        }
        return this.repository.save(dues);
    }
    async deleteDues(organizationId, duesId) {
        const dues = await this.getDuesById(organizationId, duesId);
        if (!dues) {
            throw new apiErrors_1.NotFoundError('Dues schedule');
        }
        await this.repository.remove(dues);
        logger_1.logger.info('Dues schedule deleted', { organizationId, duesId });
    }
    async collectDueIfEligible(dues, collectionDateUtc) {
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        const idempotencyKey = this.getCollectionIdempotencyKey(dues.id, collectionDateUtc);
        let runId = null;
        await queryRunner.connect();
        try {
            const lockRows = (await queryRunner.query('SELECT pg_try_advisory_lock(hashtext($1)) AS locked', [idempotencyKey]));
            if (!lockRows[0]?.locked) {
                return false;
            }
            runId = await this.acquireCollectionRun(queryRunner, dues, collectionDateUtc);
            if (!runId) {
                return false;
            }
            const transaction = await this.treasuryService.earnCredits(dues.organizationId, 'system', {
                amount: Number(dues.amount),
                source: `Dues: ${dues.name}`,
                category: 'dues',
                metadata: {
                    duesId: dues.id,
                    frequency: dues.frequency,
                    collectionDateUtc,
                    idempotencyKey,
                    collectionRunId: runId,
                },
            });
            await this.markCollectionRunCompleted(queryRunner, runId, transaction.id);
            return true;
        }
        catch (error) {
            if (runId) {
                await this.markCollectionRunFailed(queryRunner, runId, String(error));
            }
            throw error;
        }
        finally {
            try {
                await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [idempotencyKey]);
            }
            catch {
            }
            await queryRunner.release();
        }
    }
    async acquireCollectionRun(queryRunner, dues, collectionDateUtc) {
        const runRows = (await queryRunner.query(`INSERT INTO org_dues_collection_runs
        ("organizationId", "duesId", "collectionDateUtc", "status", "attemptCount", "createdAt", "updatedAt")
       VALUES ($1, $2, $3::date, 'running', 1, NOW(), NOW())
       ON CONFLICT ("duesId", "collectionDateUtc")
       DO UPDATE SET
         "status" = 'running',
         "lastError" = NULL,
         "updatedAt" = NOW(),
         "attemptCount" = org_dues_collection_runs."attemptCount" + 1
       WHERE org_dues_collection_runs."status" = 'failed'
          OR (
            org_dues_collection_runs."status" = 'running'
            AND org_dues_collection_runs."updatedAt" < NOW() - INTERVAL '30 minutes'
          )
       RETURNING "id"`, [dues.organizationId, dues.id, collectionDateUtc]));
        return runRows[0]?.id ?? null;
    }
    async markCollectionRunCompleted(queryRunner, runId, transactionId) {
        await queryRunner.query(`UPDATE org_dues_collection_runs
       SET "status" = 'completed',
           "lastError" = NULL,
           "transactionId" = $1,
           "updatedAt" = NOW()
       WHERE "id" = $2`, [transactionId, runId]);
    }
    async markCollectionRunFailed(queryRunner, runId, errorMessage) {
        await queryRunner.query(`UPDATE org_dues_collection_runs
       SET "status" = 'failed',
           "lastError" = $1,
           "updatedAt" = NOW()
       WHERE "id" = $2`, [errorMessage.slice(0, 2000), runId]);
    }
    getCollectionIdempotencyKey(duesId, collectionDateUtc) {
        return `dues:${duesId}:${collectionDateUtc}`;
    }
    getUtcCalendarSnapshot(now = new Date()) {
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth();
        const dayOfMonth = now.getUTCDate();
        const dayOfWeek = now.getUTCDay();
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        return {
            dayOfMonth,
            dayOfWeek,
            month,
            year,
            daysInMonth,
            collectionDateUtc: `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`,
        };
    }
    isDueToday(dues, utcSnapshot) {
        if (dues.frequency === OrgDues_1.DuesFrequency.WEEKLY) {
            return utcSnapshot.dayOfWeek === dues.dueDay;
        }
        if (dues.frequency === OrgDues_1.DuesFrequency.BIWEEKLY) {
            const secondDay = Math.min(dues.dueDay + 14, utcSnapshot.daysInMonth);
            return utcSnapshot.dayOfMonth === dues.dueDay || utcSnapshot.dayOfMonth === secondDay;
        }
        if (dues.frequency === OrgDues_1.DuesFrequency.MONTHLY) {
            return utcSnapshot.dayOfMonth === dues.dueDay;
        }
        if (dues.frequency === OrgDues_1.DuesFrequency.QUARTERLY) {
            return utcSnapshot.dayOfMonth === dues.dueDay && utcSnapshot.month % 3 === 0;
        }
        return false;
    }
}
exports.DuesService = DuesService;
//# sourceMappingURL=DuesService.js.map