"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const adminAuth_1 = require("../../middleware/adminAuth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const deadLetterSchemas_1 = require("../../schemas/deadLetterSchemas");
const RoleSyncRetryService_1 = require("../../services/discord/RoleSyncRetryService");
const logger_1 = require("../../utils/logger");
const router = express_1.default.Router();
exports.router = router;
const MAX_ENTRIES = 100;
const MAX_ERROR_LENGTH = 500;
function toDeadLetterEntry(entry) {
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
router.get('/dead-letter', async (_req, res) => {
    try {
        const service = (0, RoleSyncRetryService_1.getRoleSyncRetryService)();
        const [stats, entries] = await Promise.all([service.getStats(), service.getDeadLetterQueue()]);
        res.json({
            stats,
            entries: entries.slice(0, MAX_ENTRIES).map(toDeadLetterEntry),
            hasMore: entries.length > MAX_ENTRIES,
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to list dead-letter queue', { error: message });
        res.status(500).json({ error: 'Failed to list dead-letter queue' });
    }
});
router.post('/dead-letter/:id/retry', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(deadLetterSchemas_1.paramSchemas.entryId, 'params'), async (req, res) => {
    const { id } = req.params;
    try {
        const service = (0, RoleSyncRetryService_1.getRoleSyncRetryService)();
        const deadLetters = await service.getDeadLetterQueue();
        if (!deadLetters.some(entry => entry.id === id)) {
            return res.status(404).json({ error: 'Dead-letter entry not found' });
        }
        try {
            await service.retryDeadLetter(id);
        }
        catch (retryError) {
            const retryMessage = retryError instanceof Error ? retryError.message : '';
            if (retryMessage.includes('not in dead letter queue')) {
                return res.status(409).json({ error: 'Entry is no longer in the dead-letter queue' });
            }
            throw retryError;
        }
        logger_1.logger.info('Dead-letter entry re-queued via API', { entryId: id, userId: req.user?.id });
        res.json({ message: 'Retry queued' });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to retry dead-letter entry', { error: message, entryId: id });
        res.status(500).json({ error: 'Failed to retry dead-letter entry' });
    }
});
//# sourceMappingURL=deadLetterRoutes.js.map