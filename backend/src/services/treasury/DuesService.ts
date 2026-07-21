import { FindOptionsWhere } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { DuesFrequency, OrgDues } from '../../models/OrgDues';
import { NotFoundError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';

import { getTreasuryService, TreasuryService } from './TreasuryService';

// ==================== DTOs ====================

export interface CreateDuesDTO {
  name: string;
  amount: number;
  frequency: DuesFrequency;
  dueDay?: number;
  gracePeriodDays?: number;
}

export interface UpdateDuesDTO {
  name?: string;
  amount?: number;
  frequency?: DuesFrequency;
  isActive?: boolean;
  dueDay?: number;
  gracePeriodDays?: number;
}

export interface UtcCalendarSnapshot {
  dayOfMonth: number;
  dayOfWeek: number;
  month: number;
  year: number;
  daysInMonth: number;
  collectionDateUtc: string;
}

// ==================== SERVICE ====================

/**
 * DuesService
 *
 * Manages organization dues schedules and automated collection.
 * Dues are recorded as income transactions in the org credit pool.
 */
export class DuesService extends TenantService<OrgDues> {
  private readonly treasuryService: TreasuryService;

  constructor() {
    super(AppDataSource.getRepository(OrgDues), {
      enableCache: true,
      cacheTTL: 300,
      cacheCheckPeriod: 60,
    });
    this.treasuryService = getTreasuryService();
  }

  // ==================== CRUD ====================

  async createDues(
    organizationId: string,
    creatorId: string,
    dto: CreateDuesDTO
  ): Promise<OrgDues> {
    const dues = await this.create(organizationId, {
      name: dto.name,
      amount: dto.amount,
      frequency: dto.frequency,
      dueDay: dto.dueDay ?? 1,
      gracePeriodDays: dto.gracePeriodDays ?? 7,
      createdBy: creatorId,
    });

    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: creatorId,
      resource: `dues/${dues.id}`,
      action: 'dues_created',
      message: `Dues created: ${dues.name} (${dues.amount} ${dues.frequency})`,
      metadata: { organizationId, duesId: dues.id },
    });

    logger.info('Dues schedule created', { organizationId, duesId: dues.id, name: dues.name });
    return dues;
  }

  async getDuesById(organizationId: string, duesId: string): Promise<OrgDues | null> {
    return this.repository
      .createQueryBuilder('dues')
      .where('dues.id = :duesId', { duesId })
      .andWhere('dues.organizationId = :organizationId', { organizationId })
      .getOne();
  }

  async listDues(
    organizationId: string,
    pagination: PaginationOptions,
    activeOnly?: boolean
  ): Promise<PaginatedResponse<OrgDues>> {
    const where: FindOptionsWhere<OrgDues> = {
      organizationId,
    };

    if (activeOnly) {
      where.isActive = true;
    }

    return this.findAllPaginated(organizationId, pagination, where);
  }

  async updateDues(organizationId: string, duesId: string, dto: UpdateDuesDTO): Promise<OrgDues> {
    const dues = await this.getDuesById(organizationId, duesId);
    if (!dues) {
      throw new NotFoundError('Dues schedule');
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

  async deleteDues(organizationId: string, duesId: string): Promise<void> {
    const dues = await this.getDuesById(organizationId, duesId);
    if (!dues) {
      throw new NotFoundError('Dues schedule');
    }
    await this.repository.remove(dues);
    logger.info('Dues schedule deleted', { organizationId, duesId });
  }

  // ==================== COLLECTION PRIMITIVES ====================

  /**
   * Attempt collection for a single dues schedule/date pair.
   * Returns false when idempotency guards indicate the run should be skipped.
   */
  async collectDueIfEligible(dues: OrgDues, collectionDateUtc: string): Promise<boolean> {
    const queryRunner = AppDataSource.createQueryRunner();
    const idempotencyKey = this.getCollectionIdempotencyKey(dues.id, collectionDateUtc);
    let runId: string | null = null;

    await queryRunner.connect();

    try {
      const lockRows = (await queryRunner.query(
        'SELECT pg_try_advisory_lock(hashtext($1)) AS locked',
        [idempotencyKey]
      )) as Array<{ locked: boolean }>;

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
    } catch (error: unknown) {
      if (runId) {
        await this.markCollectionRunFailed(queryRunner, runId, String(error));
      }
      throw error;
    } finally {
      try {
        await queryRunner.query('SELECT pg_advisory_unlock(hashtext($1))', [idempotencyKey]);
      } catch {
        // Best-effort unlock. Connection close also releases locks.
      }
      await queryRunner.release();
    }
  }

  private async acquireCollectionRun(
    queryRunner: Awaited<ReturnType<typeof AppDataSource.createQueryRunner>>,
    dues: OrgDues,
    collectionDateUtc: string
  ): Promise<string | null> {
    const runRows = (await queryRunner.query(
      `INSERT INTO org_dues_collection_runs
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
       RETURNING "id"`,
      [dues.organizationId, dues.id, collectionDateUtc]
    )) as Array<{ id: string }>;

    return runRows[0]?.id ?? null;
  }

  private async markCollectionRunCompleted(
    queryRunner: Awaited<ReturnType<typeof AppDataSource.createQueryRunner>>,
    runId: string,
    transactionId: string
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE org_dues_collection_runs
       SET "status" = 'completed',
           "lastError" = NULL,
           "transactionId" = $1,
           "updatedAt" = NOW()
       WHERE "id" = $2`,
      [transactionId, runId]
    );
  }

  private async markCollectionRunFailed(
    queryRunner: Awaited<ReturnType<typeof AppDataSource.createQueryRunner>>,
    runId: string,
    errorMessage: string
  ): Promise<void> {
    await queryRunner.query(
      `UPDATE org_dues_collection_runs
       SET "status" = 'failed',
           "lastError" = $1,
           "updatedAt" = NOW()
       WHERE "id" = $2`,
      [errorMessage.slice(0, 2000), runId]
    );
  }

  private getCollectionIdempotencyKey(duesId: string, collectionDateUtc: string): string {
    return `dues:${duesId}:${collectionDateUtc}`;
  }

  getUtcCalendarSnapshot(now: Date = new Date()): UtcCalendarSnapshot {
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

  isDueToday(dues: OrgDues, utcSnapshot: UtcCalendarSnapshot): boolean {
    if (dues.frequency === DuesFrequency.WEEKLY) {
      // Weekly: dueDay = day of week (0=Sunday, 6=Saturday)
      return utcSnapshot.dayOfWeek === dues.dueDay;
    }
    if (dues.frequency === DuesFrequency.BIWEEKLY) {
      // Biweekly: on dueDay and 14 days later, clamped to end of month
      const secondDay = Math.min(dues.dueDay + 14, utcSnapshot.daysInMonth);
      return utcSnapshot.dayOfMonth === dues.dueDay || utcSnapshot.dayOfMonth === secondDay;
    }
    if (dues.frequency === DuesFrequency.MONTHLY) {
      return utcSnapshot.dayOfMonth === dues.dueDay;
    }
    if (dues.frequency === DuesFrequency.QUARTERLY) {
      // Quarterly: on dueDay of Jan(0), Apr(3), Jul(6), Oct(9)
      return utcSnapshot.dayOfMonth === dues.dueDay && utcSnapshot.month % 3 === 0;
    }
    return false;
  }
}

