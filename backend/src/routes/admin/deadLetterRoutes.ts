import express from 'express';

import { logAdminMutation } from '../../middleware/adminAuth';
import { AuthRequest } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { RoleSyncOperationType, RoleSyncRetryQueue } from '../../models/RoleSyncRetryQueue';
import { paramSchemas } from '../../schemas/deadLetterSchemas';
import { getRoleSyncRetryService } from '../../services/discord/RoleSyncRetryService';
import { logger } from '../../utils/logger';

const router = express.Router();

/** Cap the response payload — the dead-letter queue holds only permanent failures. */
const MAX_ENTRIES = 100;
/** Defensive truncation of upstream error text before exposing it to the admin UI. */
const MAX_ERROR_LENGTH = 500;

/** Admin-safe projection of a dead-letter row (no payload; truncated error). */
interface DeadLetterEntryDto {
  id: string;
  guildId: string;
  userId: string;
  roleId: string;
  operation: RoleSyncOperationType;
  retryCount: number;
  maxRetries: number;
  lastError: string | null;
  lastErrorCode: string | null;
  createdAt: Date;
  deadLetteredAt: Date | null;
  adminNotified: boolean;
}

/**
 * Project a raw retry-queue row into the admin-safe dead-letter DTO.
 * Drops `payload`/internal scheduling fields and truncates `lastError`.
 */
function toDeadLetterEntry(entry: RoleSyncRetryQueue): DeadLetterEntryDto {
  return {
    id: entry.id,
    guildId: entry.guildId,
    userId: entry.userId,
    roleId: entry.roleId,
    operation: entry.operation,
    retryCount: entry.retryCount,
    maxRetries: entry.maxRetries,
    lastError: entry.lastError ? entry.lastError.slice(0, MAX_ERROR_LENGTH) : null,
    lastErrorCode: entry.lastErrorCode ?? null,
    createdAt: entry.createdAt,
    deadLetteredAt: entry.deadLetteredAt ?? null,
    adminNotified: entry.adminNotified,
  };
}

/**
 * @route GET /admin/role-sync/dead-letter
 * @description List role-sync dead-letter entries (capped) plus queue stats
 * @access Admin only
 */
router.get('/dead-letter', async (_req: AuthRequest, res) => {
  try {
    const service = getRoleSyncRetryService();
    const [stats, entries] = await Promise.all([service.getStats(), service.getDeadLetterQueue()]);

    res.json({
      stats,
      entries: entries.slice(0, MAX_ENTRIES).map(toDeadLetterEntry),
      hasMore: entries.length > MAX_ENTRIES,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list dead-letter queue', { error: message });
    res.status(500).json({ error: 'Failed to list dead-letter queue' });
  }
});

/**
 * @route POST /admin/role-sync/dead-letter/:id/retry
 * @description Re-queue a dead-letter entry for processing
 * @access Admin only
 */
router.post(
  '/dead-letter/:id/retry',
  logAdminMutation,
  validateSchema(paramSchemas.entryId, 'params'),
  async (req: AuthRequest, res) => {
    const { id } = req.params;
    try {
      const service = getRoleSyncRetryService();

      // Pre-check: 404 if the entry is not currently in the dead-letter queue.
      const deadLetters = await service.getDeadLetterQueue();
      if (!deadLetters.some(entry => entry.id === id)) {
        return res.status(404).json({ error: 'Dead-letter entry not found' });
      }

      try {
        await service.retryDeadLetter(id);
      } catch (retryError) {
        // Entry left the dead-letter queue between the pre-check and the retry.
        const retryMessage = retryError instanceof Error ? retryError.message : '';
        if (retryMessage.includes('not in dead letter queue')) {
          return res.status(409).json({ error: 'Entry is no longer in the dead-letter queue' });
        }
        throw retryError;
      }

      logger.info('Dead-letter entry re-queued via API', { entryId: id, userId: req.user?.id });
      res.json({ message: 'Retry queued' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to retry dead-letter entry', { error: message, entryId: id });
      res.status(500).json({ error: 'Failed to retry dead-letter entry' });
    }
  }
);

export { router };
