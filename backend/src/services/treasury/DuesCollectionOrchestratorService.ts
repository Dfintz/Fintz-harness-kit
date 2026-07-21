import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { OrgDues } from '../../models/OrgDues';
import { logger } from '../../utils/logger';

import { DuesService } from './DuesService';

export interface DuesCollectionSummary {
  collected: number;
  errors: number;
}

/**
 * DuesCollectionOrchestratorService
 *
 * Executes cross-tenant dues collection scans and delegates per-dues collection
 * execution to DuesService. This keeps global orchestration out of tenant-scoped
 * domain services.
 */
export class DuesCollectionOrchestratorService {
  private static readonly BATCH_SIZE = 100;

  constructor(
    private readonly duesService: DuesService = new DuesService(),
    private readonly duesRepository: Repository<OrgDues> = AppDataSource.getRepository(OrgDues)
  ) {}

  async collectAllDues(now: Date = new Date()): Promise<DuesCollectionSummary> {
    const utcSnapshot = this.duesService.getUtcCalendarSnapshot(now);

    let collected = 0;
    let errors = 0;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.duesRepository.find({
        where: { isActive: true },
        take: DuesCollectionOrchestratorService.BATCH_SIZE,
        skip: offset,
        order: { createdAt: 'ASC' },
      });

      if (batch.length < DuesCollectionOrchestratorService.BATCH_SIZE) {
        hasMore = false;
      }
      offset += DuesCollectionOrchestratorService.BATCH_SIZE;

      for (const dues of batch) {
        if (!this.duesService.isDueToday(dues, utcSnapshot)) {
          continue;
        }

        try {
          const didCollect = await this.duesService.collectDueIfEligible(
            dues,
            utcSnapshot.collectionDateUtc
          );

          if (!didCollect) {
            logger.info('Dues collection skipped due to idempotency guard', {
              organizationId: dues.organizationId,
              duesId: dues.id,
              collectionDateUtc: utcSnapshot.collectionDateUtc,
            });
            continue;
          }

          collected++;
          logger.info('Dues collected', {
            organizationId: dues.organizationId,
            duesId: dues.id,
            amount: dues.amount,
            collectionDateUtc: utcSnapshot.collectionDateUtc,
          });
        } catch (error: unknown) {
          errors++;
          logger.error('Dues collection failed', {
            error: String(error),
            organizationId: dues.organizationId,
            duesId: dues.id,
            collectionDateUtc: utcSnapshot.collectionDateUtc,
          });
        }
      }
    }

    return { collected, errors };
  }
}

