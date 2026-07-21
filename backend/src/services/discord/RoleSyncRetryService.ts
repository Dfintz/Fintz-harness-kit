/**
 * Role Sync Retry Service
 *
 * Handles failed role synchronization operations with exponential backoff retry logic.
 * Implements the retry queue pattern recommended in the Discord Integration Audit.
 *
 * Features:
 * - Automatic retry with exponential backoff (1s, 2s, 4s)
 * - Dead letter queue for permanently failed operations
 * - Admin notifications for persistent failures
 * - Configurable max retries (default: 3)
 */

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  CreateRoleSyncRetryDto,
  RoleSyncOperationType,
  RoleSyncRetryQueue,
  RoleSyncRetryStatus,
} from '../../models/RoleSyncRetryQueue';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

import { getDiscordService } from './DiscordService';

export class RoleSyncRetryService {
  private readonly repository: Repository<RoleSyncRetryQueue>;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private tableVerified = false;
  private readonly PROCESSING_INTERVAL_MS = 5000; // Check for retries every 5 seconds
  private readonly BASE_RETRY_DELAY_MS = 1000; // 1 second base delay

  constructor() {
    this.repository = AppDataSource.getRepository(RoleSyncRetryQueue);
  }

  /**
   * Start the retry processor
   * Should be called on application startup
   */
  public start(): void {
    if (this.processingInterval) {
      logger.warn('RoleSyncRetryService already started');
      return;
    }

    logger.info('Starting RoleSyncRetryService');
    this.processingInterval = setInterval(() => {
      void this.processRetryQueue();
    }, this.PROCESSING_INTERVAL_MS);
  }

  /**
   * Stop the retry processor
   * Should be called on application shutdown
   */
  public stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      logger.info('RoleSyncRetryService stopped');
    }
  }

  /**
   * Add a failed role operation to the retry queue
   */
  public async enqueue(dto: CreateRoleSyncRetryDto): Promise<RoleSyncRetryQueue> {
    const maxRetries = dto.maxRetries ?? 3;
    const retryDelayMs = dto.retryDelayMs ?? this.BASE_RETRY_DELAY_MS;

    const entry = this.repository.create({
      guildId: dto.guildId,
      userId: dto.userId,
      roleId: dto.roleId,
      operation: dto.operation,
      payload: {
        guildId: dto.guildId,
        userId: dto.userId,
        roleId: dto.roleId,
        operation: dto.operation,
        retryCount: 0,
        originalRequestId: dto.originalRequestId,
        metadata: dto.metadata,
      },
      retryCount: 0,
      maxRetries,
      status: RoleSyncRetryStatus.PENDING,
      nextRetryAt: new Date(Date.now() + retryDelayMs),
    });

    const saved = await this.repository.save(entry);
    logger.info(
      `Enqueued role sync retry: ${dto.operation} role ${dto.roleId} for user ${dto.userId} in guild ${dto.guildId}`
    );
    return saved;
  }

  /**
   * Process pending retries
   * Called periodically by the interval timer
   */
  private async processRetryQueue(): Promise<void> {
    if (this.isProcessing) {
      // Prevent overlapping runs if a previous tick is still working
      return;
    }

    // Wait for database to be ready before attempting queries
    if (!AppDataSource.isInitialized) {
      return;
    }

    this.isProcessing = true;
    try {
      // Verify table exists on first run to avoid spamming logs
      if (!this.tableVerified) {
        const tableExists = await AppDataSource.query(
          `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_sync_retry_queue')`
        );
        if (!tableExists?.[0]?.exists) {
          logger.warn(
            'role_sync_retry_queue table does not exist — stopping retry processor. Run migrations to create it.'
          );
          this.stop();
          return;
        }
        this.tableVerified = true;
      }

      // Query only entries that are due to retry (nextRetryAt <= now)
      const now = new Date();
      const readyEntries = await this.repository
        .createQueryBuilder('entry')
        .where('entry.status = :status', { status: RoleSyncRetryStatus.PENDING })
        .andWhere('entry.nextRetryAt IS NOT NULL')
        .andWhere('entry.nextRetryAt <= :now', { now })
        .orderBy('entry.nextRetryAt', 'ASC')
        .limit(10)
        .getMany();

      if (readyEntries.length > 0) {
        logger.debug(`Processing ${readyEntries.length} role sync retry entries`);
      }

      for (const entry of readyEntries) {
        await this.processEntry(entry);
      }
    } catch (error: unknown) {
      logger.error('Error processing role sync retry queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single retry entry
   */
  private async processEntry(entry: RoleSyncRetryQueue): Promise<void> {
    try {
      // Mark as processing
      entry.status = RoleSyncRetryStatus.PROCESSING;
      entry.processedAt = new Date();
      await this.repository.save(entry);

      // Attempt the role operation
      const discordService = getDiscordService();

      if (entry.operation === RoleSyncOperationType.ASSIGN) {
        await discordService.assignRole(entry.guildId, entry.userId, entry.roleId, false);
      } else {
        await discordService.removeRole(entry.guildId, entry.userId, entry.roleId, false);
      }

      // Success! Mark as completed
      entry.status = RoleSyncRetryStatus.COMPLETED;
      entry.completedAt = new Date();
      await this.repository.save(entry);

      logger.info(
        `Successfully processed role sync retry: ${entry.operation} role ${entry.roleId} for user ${entry.userId}`
      );
    } catch (error: unknown) {
      await this.handleRetryFailure(entry, error);
    }
  }

  /**
   * Handle a retry failure
   */
  private async handleRetryFailure(entry: RoleSyncRetryQueue, error: unknown): Promise<void> {
    entry.retryCount++;
    entry.lastError = getErrorMessage(error);

    // Extract Discord error code if available
    const errorObj = error as Record<string, unknown>;
    if (errorObj && typeof errorObj === 'object' && 'code' in errorObj) {
      entry.lastErrorCode = String(errorObj.code);
    }

    if (entry.retryCount >= entry.maxRetries) {
      // Max retries exceeded - move to dead letter queue
      entry.status = RoleSyncRetryStatus.DEAD_LETTER;
      entry.deadLetteredAt = new Date();
      await this.repository.save(entry);

      logger.error(`Role sync retry permanently failed after ${entry.retryCount} attempts:`, {
        guildId: entry.guildId,
        userId: entry.userId,
        roleId: entry.roleId,
        operation: entry.operation,
        error: entry.lastError,
      });

      // Notify admins if not already notified
      if (!entry.adminNotified) {
        await this.notifyAdmins(entry);
      }
    } else {
      // Calculate exponential backoff delay
      const backoffMultiplier = Math.pow(2, entry.retryCount);
      const delayMs = this.BASE_RETRY_DELAY_MS * backoffMultiplier;

      entry.status = RoleSyncRetryStatus.PENDING;
      entry.nextRetryAt = new Date(Date.now() + delayMs);
      await this.repository.save(entry);

      logger.warn(
        `Role sync retry failed (attempt ${entry.retryCount}/${entry.maxRetries}), will retry in ${delayMs}ms:`,
        {
          guildId: entry.guildId,
          userId: entry.userId,
          roleId: entry.roleId,
          operation: entry.operation,
          error: entry.lastError,
        }
      );
    }
  }

  /**
   * Notify admins about persistent failures via Discord and structured logging.
   * Uses the DiscordService to post to the admin/log channel when available.
   */
  private async notifyAdmins(entry: RoleSyncRetryQueue): Promise<void> {
    const alertPayload = {
      entryId: entry.id,
      guildId: entry.guildId,
      userId: entry.userId,
      roleId: entry.roleId,
      operation: entry.operation,
      retryCount: entry.retryCount,
      lastError: entry.lastError,
      lastErrorCode: entry.lastErrorCode,
    };

    // Structured error log — always emitted for monitoring/alerting pipelines
    logger.error(
      'ADMIN ALERT: Role sync permanently failed — moved to dead letter queue',
      alertPayload
    );

    // Attempt to post to the Discord admin/log channel (best-effort, non-blocking)
    // Note: Notification is dispatched without awaiting to avoid blocking retry pipeline
    const notifyDiscord = async () => {
      try {
        const discordService = getDiscordService();
        if (discordService) {
          const logChannelId = process.env.DISCORD_ADMIN_LOG_CHANNEL_ID;
          if (logChannelId) {
            const message =
              `⚠️ **Role Sync Dead Letter Alert**\n` +
              `> **Operation:** ${entry.operation}\n` +
              `> **Guild:** ${entry.guildId}\n` +
              `> **User:** ${entry.userId}\n` +
              `> **Role:** ${entry.roleId}\n` +
              `> **Retries:** ${entry.retryCount}\n` +
              `> **Error:** ${entry.lastError ?? 'Unknown'}\n` +
              `> **Entry ID:** ${entry.id}`;
            await discordService.sendMessage(logChannelId, message);

            // Only mark as notified after successful send
            entry.adminNotified = true;
            entry.adminNotifiedAt = new Date();
            await this.repository.save(entry);
          }
        }
      } catch (notifyError: unknown) {
        // Notification failure must never block the retry pipeline
        logger.warn('Failed to send dead-letter Discord notification', {
          entryId: entry.id,
          error: getErrorMessage(notifyError),
        });
      }
    };

    // Dispatch without awaiting to keep processing non-blocking
    void notifyDiscord();
  }

  /**
   * Get statistics about the retry queue
   */
  public async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
    total: number;
  }> {
    const [pending, processing, completed, failed, deadLetter, total] = await Promise.all([
      this.repository.count({ where: { status: RoleSyncRetryStatus.PENDING } }),
      this.repository.count({ where: { status: RoleSyncRetryStatus.PROCESSING } }),
      this.repository.count({ where: { status: RoleSyncRetryStatus.COMPLETED } }),
      this.repository.count({ where: { status: RoleSyncRetryStatus.FAILED } }),
      this.repository.count({ where: { status: RoleSyncRetryStatus.DEAD_LETTER } }),
      this.repository.count(),
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      deadLetter,
      total,
    };
  }

  /**
   * Get dead letter queue entries (permanently failed operations)
   */
  public async getDeadLetterQueue(): Promise<RoleSyncRetryQueue[]> {
    return this.repository.find({
      where: { status: RoleSyncRetryStatus.DEAD_LETTER },
      order: { deadLetteredAt: 'DESC' },
    });
  }

  /**
   * Manually retry a dead letter entry
   * Useful for admin intervention after fixing underlying issues
   */
  public async retryDeadLetter(entryId: string): Promise<void> {
    const entry = await this.repository.findOne({ where: { id: entryId } });

    if (!entry) {
      throw new Error(`Retry entry not found: ${entryId}`);
    }

    if (entry.status !== RoleSyncRetryStatus.DEAD_LETTER) {
      throw new Error(`Entry ${entryId} is not in dead letter queue (status: ${entry.status})`);
    }

    // Reset retry count and status
    entry.retryCount = 0;
    entry.status = RoleSyncRetryStatus.PENDING;
    entry.nextRetryAt = new Date();
    entry.adminNotified = false;
    entry.adminNotifiedAt = undefined;
    entry.deadLetteredAt = undefined;

    await this.repository.save(entry);
    logger.info(`Manually retrying dead letter entry: ${entryId}`);
  }

  /**
   * Clean up old completed entries
   * Should be called periodically (e.g., daily) to prevent table growth
   */
  public async cleanupCompleted(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('status = :status', { status: RoleSyncRetryStatus.COMPLETED })
      .andWhere('completedAt < :cutoffDate', { cutoffDate })
      .execute();

    const deletedCount = result.affected ?? 0;
    logger.info(
      `Cleaned up ${deletedCount} completed role sync retry entries older than ${olderThanDays} days`
    );
    return deletedCount;
  }
}

// Singleton instance
let roleSyncRetryServiceInstance: RoleSyncRetryService | null = null;

/**
 * Get or create singleton instance
 */
export function getRoleSyncRetryService(): RoleSyncRetryService {
  roleSyncRetryServiceInstance ??= new RoleSyncRetryService();
  return roleSyncRetryServiceInstance;
}

/**
 * Initialize and start the retry service
 * Should be called during application startup
 */
export function startRoleSyncRetryService(): void {
  const service = getRoleSyncRetryService();
  service.start();
}

/**
 * Stop the retry service
 * Should be called during application shutdown
 */
export function stopRoleSyncRetryService(): void {
  if (roleSyncRetryServiceInstance) {
    roleSyncRetryServiceInstance.stop();
  }
}

