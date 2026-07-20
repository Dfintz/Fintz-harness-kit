"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoleSyncRetryService = void 0;
exports.getRoleSyncRetryService = getRoleSyncRetryService;
exports.startRoleSyncRetryService = startRoleSyncRetryService;
exports.stopRoleSyncRetryService = stopRoleSyncRetryService;
const data_source_1 = require("../../data-source");
const RoleSyncRetryQueue_1 = require("../../models/RoleSyncRetryQueue");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const DiscordService_1 = require("./DiscordService");
class RoleSyncRetryService {
    repository;
    processingInterval = null;
    isProcessing = false;
    tableVerified = false;
    PROCESSING_INTERVAL_MS = 5000;
    BASE_RETRY_DELAY_MS = 1000;
    constructor() {
        this.repository = data_source_1.AppDataSource.getRepository(RoleSyncRetryQueue_1.RoleSyncRetryQueue);
    }
    start() {
        if (this.processingInterval) {
            logger_1.logger.warn('RoleSyncRetryService already started');
            return;
        }
        logger_1.logger.info('Starting RoleSyncRetryService');
        this.processingInterval = setInterval(() => {
            void this.processRetryQueue();
        }, this.PROCESSING_INTERVAL_MS);
    }
    stop() {
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
            logger_1.logger.info('RoleSyncRetryService stopped');
        }
    }
    async enqueue(dto) {
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
            status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.PENDING,
            nextRetryAt: new Date(Date.now() + retryDelayMs),
        });
        const saved = await this.repository.save(entry);
        logger_1.logger.info(`Enqueued role sync retry: ${dto.operation} role ${dto.roleId} for user ${dto.userId} in guild ${dto.guildId}`);
        return saved;
    }
    async processRetryQueue() {
        if (this.isProcessing) {
            return;
        }
        if (!data_source_1.AppDataSource.isInitialized) {
            return;
        }
        this.isProcessing = true;
        try {
            if (!this.tableVerified) {
                const tableExists = await data_source_1.AppDataSource.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'role_sync_retry_queue')`);
                if (!tableExists?.[0]?.exists) {
                    logger_1.logger.warn('role_sync_retry_queue table does not exist — stopping retry processor. Run migrations to create it.');
                    this.stop();
                    return;
                }
                this.tableVerified = true;
            }
            const now = new Date();
            const readyEntries = await this.repository
                .createQueryBuilder('entry')
                .where('entry.status = :status', { status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.PENDING })
                .andWhere('entry.nextRetryAt IS NOT NULL')
                .andWhere('entry.nextRetryAt <= :now', { now })
                .orderBy('entry.nextRetryAt', 'ASC')
                .limit(10)
                .getMany();
            if (readyEntries.length > 0) {
                logger_1.logger.debug(`Processing ${readyEntries.length} role sync retry entries`);
            }
            for (const entry of readyEntries) {
                await this.processEntry(entry);
            }
        }
        catch (error) {
            logger_1.logger.error('Error processing role sync retry queue:', error);
        }
        finally {
            this.isProcessing = false;
        }
    }
    async processEntry(entry) {
        try {
            entry.status = RoleSyncRetryQueue_1.RoleSyncRetryStatus.PROCESSING;
            entry.processedAt = new Date();
            await this.repository.save(entry);
            const discordService = (0, DiscordService_1.getDiscordService)();
            if (entry.operation === RoleSyncRetryQueue_1.RoleSyncOperationType.ASSIGN) {
                await discordService.assignRole(entry.guildId, entry.userId, entry.roleId, false);
            }
            else {
                await discordService.removeRole(entry.guildId, entry.userId, entry.roleId, false);
            }
            entry.status = RoleSyncRetryQueue_1.RoleSyncRetryStatus.COMPLETED;
            entry.completedAt = new Date();
            await this.repository.save(entry);
            logger_1.logger.info(`Successfully processed role sync retry: ${entry.operation} role ${entry.roleId} for user ${entry.userId}`);
        }
        catch (error) {
            await this.handleRetryFailure(entry, error);
        }
    }
    async handleRetryFailure(entry, error) {
        entry.retryCount++;
        entry.lastError = (0, errorHandler_1.getErrorMessage)(error);
        const errorObj = error;
        if (errorObj && typeof errorObj === 'object' && 'code' in errorObj) {
            entry.lastErrorCode = String(errorObj.code);
        }
        if (entry.retryCount >= entry.maxRetries) {
            entry.status = RoleSyncRetryQueue_1.RoleSyncRetryStatus.DEAD_LETTER;
            entry.deadLetteredAt = new Date();
            await this.repository.save(entry);
            logger_1.logger.error(`Role sync retry permanently failed after ${entry.retryCount} attempts:`, {
                guildId: entry.guildId,
                userId: entry.userId,
                roleId: entry.roleId,
                operation: entry.operation,
                error: entry.lastError,
            });
            if (!entry.adminNotified) {
                await this.notifyAdmins(entry);
            }
        }
        else {
            const backoffMultiplier = Math.pow(2, entry.retryCount);
            const delayMs = this.BASE_RETRY_DELAY_MS * backoffMultiplier;
            entry.status = RoleSyncRetryQueue_1.RoleSyncRetryStatus.PENDING;
            entry.nextRetryAt = new Date(Date.now() + delayMs);
            await this.repository.save(entry);
            logger_1.logger.warn(`Role sync retry failed (attempt ${entry.retryCount}/${entry.maxRetries}), will retry in ${delayMs}ms:`, {
                guildId: entry.guildId,
                userId: entry.userId,
                roleId: entry.roleId,
                operation: entry.operation,
                error: entry.lastError,
            });
        }
    }
    async notifyAdmins(entry) {
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
        logger_1.logger.error('ADMIN ALERT: Role sync permanently failed — moved to dead letter queue', alertPayload);
        const notifyDiscord = async () => {
            try {
                const discordService = (0, DiscordService_1.getDiscordService)();
                if (discordService) {
                    const logChannelId = process.env.DISCORD_ADMIN_LOG_CHANNEL_ID;
                    if (logChannelId) {
                        const message = `⚠️ **Role Sync Dead Letter Alert**\n` +
                            `> **Operation:** ${entry.operation}\n` +
                            `> **Guild:** ${entry.guildId}\n` +
                            `> **User:** ${entry.userId}\n` +
                            `> **Role:** ${entry.roleId}\n` +
                            `> **Retries:** ${entry.retryCount}\n` +
                            `> **Error:** ${entry.lastError ?? 'Unknown'}\n` +
                            `> **Entry ID:** ${entry.id}`;
                        await discordService.sendMessage(logChannelId, message);
                        entry.adminNotified = true;
                        entry.adminNotifiedAt = new Date();
                        await this.repository.save(entry);
                    }
                }
            }
            catch (notifyError) {
                logger_1.logger.warn('Failed to send dead-letter Discord notification', {
                    entryId: entry.id,
                    error: (0, errorHandler_1.getErrorMessage)(notifyError),
                });
            }
        };
        void notifyDiscord();
    }
    async getStats() {
        const [pending, processing, completed, failed, deadLetter, total] = await Promise.all([
            this.repository.count({ where: { status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.PENDING } }),
            this.repository.count({ where: { status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.PROCESSING } }),
            this.repository.count({ where: { status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.COMPLETED } }),
            this.repository.count({ where: { status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.FAILED } }),
            this.repository.count({ where: { status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.DEAD_LETTER } }),
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
    async getDeadLetterQueue() {
        return this.repository.find({
            where: { status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.DEAD_LETTER },
            order: { deadLetteredAt: 'DESC' },
        });
    }
    async retryDeadLetter(entryId) {
        const entry = await this.repository.findOne({ where: { id: entryId } });
        if (!entry) {
            throw new Error(`Retry entry not found: ${entryId}`);
        }
        if (entry.status !== RoleSyncRetryQueue_1.RoleSyncRetryStatus.DEAD_LETTER) {
            throw new Error(`Entry ${entryId} is not in dead letter queue (status: ${entry.status})`);
        }
        entry.retryCount = 0;
        entry.status = RoleSyncRetryQueue_1.RoleSyncRetryStatus.PENDING;
        entry.nextRetryAt = new Date();
        entry.adminNotified = false;
        entry.adminNotifiedAt = undefined;
        entry.deadLetteredAt = undefined;
        await this.repository.save(entry);
        logger_1.logger.info(`Manually retrying dead letter entry: ${entryId}`);
    }
    async cleanupCompleted(olderThanDays = 7) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const result = await this.repository
            .createQueryBuilder()
            .delete()
            .where('status = :status', { status: RoleSyncRetryQueue_1.RoleSyncRetryStatus.COMPLETED })
            .andWhere('completedAt < :cutoffDate', { cutoffDate })
            .execute();
        const deletedCount = result.affected ?? 0;
        logger_1.logger.info(`Cleaned up ${deletedCount} completed role sync retry entries older than ${olderThanDays} days`);
        return deletedCount;
    }
}
exports.RoleSyncRetryService = RoleSyncRetryService;
let roleSyncRetryServiceInstance = null;
function getRoleSyncRetryService() {
    roleSyncRetryServiceInstance ??= new RoleSyncRetryService();
    return roleSyncRetryServiceInstance;
}
function startRoleSyncRetryService() {
    const service = getRoleSyncRetryService();
    service.start();
}
function stopRoleSyncRetryService() {
    if (roleSyncRetryServiceInstance) {
        roleSyncRetryServiceInstance.stop();
    }
}
//# sourceMappingURL=RoleSyncRetryService.js.map