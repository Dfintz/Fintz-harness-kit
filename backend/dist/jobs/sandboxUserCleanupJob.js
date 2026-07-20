"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSandboxUserCleanupJob = exports.runSandboxUserCleanupJob = void 0;
const database_1 = require("../config/database");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const User_1 = require("../models/User");
const DistributedJobLockService_1 = require("../services/jobs/DistributedJobLockService");
const GdprDataDeletionService_1 = require("../services/user/GdprDataDeletionService");
const errorHandler_1 = require("../utils/errorHandler");
const logger_1 = require("../utils/logger");
const DEFAULT_SANDBOX_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const SANDBOX_DISCORD_ID_PREFIX = 'sandbox-';
const resolveRetentionDays = () => {
    const parsed = Number.parseInt(process.env.SANDBOX_USER_RETENTION_DAYS ?? '', 10);
    if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
    }
    return DEFAULT_SANDBOX_RETENTION_DAYS;
};
const findCleanupCandidates = async (retentionDays) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    return database_1.AppDataSource.getRepository(User_1.User)
        .createQueryBuilder('user')
        .leftJoin(OrganizationMembership_1.OrganizationMembership, 'membership', 'membership.userId = user.id AND membership.isActive = :isActive', { isActive: true })
        .where('user.discordId LIKE :sandboxPrefix', {
        sandboxPrefix: `${SANDBOX_DISCORD_ID_PREFIX}%`,
    })
        .andWhere('user.createdAt < :cutoffDate', { cutoffDate })
        .andWhere('user.activeOrgId IS NULL')
        .andWhere('membership.userId IS NULL')
        .select('user.id', 'id')
        .getRawMany();
};
const runSandboxUserCleanupJob = async () => {
    const retentionDays = resolveRetentionDays();
    const execution = await (0, DistributedJobLockService_1.withJobLock)('sandbox-user-cleanup', () => runSandboxUserCleanupUnlocked(retentionDays), { ttlSeconds: 30 * 60 });
    if (!execution.acquired) {
        logger_1.logger.info('Skipping sandbox user cleanup run because another instance owns the lock', {
            reason: execution.reason,
        });
        return { retentionDays, eligibleCount: 0, deletedCount: 0, failedCount: 0 };
    }
    if (!execution.executed || !execution.result) {
        throw new Error(execution.error ?? 'Sandbox user cleanup execution failed');
    }
    return execution.result;
};
exports.runSandboxUserCleanupJob = runSandboxUserCleanupJob;
const runSandboxUserCleanupUnlocked = async (retentionDays) => {
    const candidates = await findCleanupCandidates(retentionDays);
    const gdprDataDeletionService = (0, GdprDataDeletionService_1.getGdprDataDeletionService)();
    let deletedCount = 0;
    let failedCount = 0;
    for (const candidate of candidates) {
        try {
            const result = await gdprDataDeletionService.deleteAllUserData(candidate.id, true);
            if (result.success) {
                deletedCount += 1;
            }
            else {
                failedCount += 1;
                logger_1.logger.warn('Sandbox user cleanup failed for user', {
                    userId: candidate.id,
                    errors: result.errors,
                });
            }
        }
        catch (error) {
            failedCount += 1;
            logger_1.logger.error('Sandbox user cleanup raised an unexpected error', {
                userId: candidate.id,
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
        }
    }
    const summary = {
        retentionDays,
        eligibleCount: candidates.length,
        deletedCount,
        failedCount,
    };
    logger_1.logger.info('Sandbox user cleanup job completed', summary);
    return summary;
};
const startSandboxUserCleanupJob = () => {
    logger_1.logger.info('Starting sandbox user cleanup job (runs daily)', {
        retentionDays: resolveRetentionDays(),
    });
    void (0, exports.runSandboxUserCleanupJob)().catch(error => {
        logger_1.logger.error('Sandbox user cleanup startup run failed', {
            error: (0, errorHandler_1.getErrorMessage)(error),
        });
    });
    const interval = setInterval(() => {
        void (0, exports.runSandboxUserCleanupJob)().catch(error => {
            logger_1.logger.error('Sandbox user cleanup scheduled run failed', {
                error: (0, errorHandler_1.getErrorMessage)(error),
            });
        });
    }, DAY_MS);
    interval.unref();
    return interval;
};
exports.startSandboxUserCleanupJob = startSandboxUserCleanupJob;
//# sourceMappingURL=sandboxUserCleanupJob.js.map