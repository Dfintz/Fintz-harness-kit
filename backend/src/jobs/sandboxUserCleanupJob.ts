import { AppDataSource } from '../config/database';
import { OrganizationMembership } from '../models/OrganizationMembership';
import { User } from '../models/User';
import { withJobLock } from '../services/jobs/DistributedJobLockService';
import { getGdprDataDeletionService } from '../services/user/GdprDataDeletionService';
import { getErrorMessage } from '../utils/errorHandler';
import { logger } from '../utils/logger';

const DEFAULT_SANDBOX_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const SANDBOX_DISCORD_ID_PREFIX = 'sandbox-';

interface SandboxUserCleanupCandidate {
  id: string;
}

export interface SandboxUserCleanupResult {
  retentionDays: number;
  eligibleCount: number;
  deletedCount: number;
  failedCount: number;
}

const resolveRetentionDays = (): number => {
  const parsed = Number.parseInt(process.env.SANDBOX_USER_RETENTION_DAYS ?? '', 10);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_SANDBOX_RETENTION_DAYS;
};

const findCleanupCandidates = async (
  retentionDays: number
): Promise<SandboxUserCleanupCandidate[]> => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  return AppDataSource.getRepository(User)
    .createQueryBuilder('user')
    .leftJoin(
      OrganizationMembership,
      'membership',
      'membership.userId = user.id AND membership.isActive = :isActive',
      { isActive: true }
    )
    .where('user.discordId LIKE :sandboxPrefix', {
      sandboxPrefix: `${SANDBOX_DISCORD_ID_PREFIX}%`,
    })
    .andWhere('user.createdAt < :cutoffDate', { cutoffDate })
    .andWhere('user.activeOrgId IS NULL')
    .andWhere('membership.userId IS NULL')
    .select('user.id', 'id')
    .getRawMany<SandboxUserCleanupCandidate>();
};

export const runSandboxUserCleanupJob = async (): Promise<SandboxUserCleanupResult> => {
  const retentionDays = resolveRetentionDays();

  // Job-scope distributed lock so only one instance runs this destructive (deletes all
  // user data) cleanup at a time, even across replicas.
  const execution = await withJobLock(
    'sandbox-user-cleanup',
    () => runSandboxUserCleanupUnlocked(retentionDays),
    { ttlSeconds: 30 * 60 }
  );

  if (!execution.acquired) {
    logger.info('Skipping sandbox user cleanup run because another instance owns the lock', {
      reason: execution.reason,
    });
    return { retentionDays, eligibleCount: 0, deletedCount: 0, failedCount: 0 };
  }

  if (!execution.executed || !execution.result) {
    throw new Error(execution.error ?? 'Sandbox user cleanup execution failed');
  }

  return execution.result;
};

const runSandboxUserCleanupUnlocked = async (
  retentionDays: number
): Promise<SandboxUserCleanupResult> => {
  const candidates = await findCleanupCandidates(retentionDays);
  const gdprDataDeletionService = getGdprDataDeletionService();

  let deletedCount = 0;
  let failedCount = 0;

  for (const candidate of candidates) {
    try {
      const result = await gdprDataDeletionService.deleteAllUserData(candidate.id, true);
      if (result.success) {
        deletedCount += 1;
      } else {
        failedCount += 1;
        logger.warn('Sandbox user cleanup failed for user', {
          userId: candidate.id,
          errors: result.errors,
        });
      }
    } catch (error: unknown) {
      failedCount += 1;
      logger.error('Sandbox user cleanup raised an unexpected error', {
        userId: candidate.id,
        error: getErrorMessage(error),
      });
    }
  }

  const summary: SandboxUserCleanupResult = {
    retentionDays,
    eligibleCount: candidates.length,
    deletedCount,
    failedCount,
  };

  logger.info('Sandbox user cleanup job completed', summary);
  return summary;
};

export const startSandboxUserCleanupJob = (): NodeJS.Timeout => {
  logger.info('Starting sandbox user cleanup job (runs daily)', {
    retentionDays: resolveRetentionDays(),
  });

  void runSandboxUserCleanupJob().catch(error => {
    logger.error('Sandbox user cleanup startup run failed', {
      error: getErrorMessage(error),
    });
  });

  const interval = setInterval(() => {
    void runSandboxUserCleanupJob().catch(error => {
      logger.error('Sandbox user cleanup scheduled run failed', {
        error: getErrorMessage(error),
      });
    });
  }, DAY_MS);

  interval.unref();
  return interval;
};
