"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startDiscordReconciliationJob = void 0;
const DiscordReconciliationService_1 = require("../services/discord/DiscordReconciliationService");
const logger_1 = require("../utils/logger");
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
async function runReconciliationPass() {
    try {
        const result = await DiscordReconciliationService_1.DiscordReconciliationService.getInstance().runPass();
        if (result.guildsProcessed > 0) {
            logger_1.logger.info(`Discord reconciliation pass: ${result.guildsProcessed} guild(s), ` +
                `${result.totalRolesAssigned} assigned, ${result.totalRolesRemoved} removed, ` +
                `${result.totalErrors} error(s) in ${result.durationMs}ms`);
        }
    }
    catch (err) {
        logger_1.logger.error('Discord reconciliation job tick failed', {
            error: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}
const startDiscordReconciliationJob = () => {
    logger_1.logger.info(`Starting Discord reconciliation job (check interval: ${CHECK_INTERVAL_MS / 60_000} min)`);
    const interval = setInterval(() => {
        void runReconciliationPass();
    }, CHECK_INTERVAL_MS);
    interval.unref();
    return interval;
};
exports.startDiscordReconciliationJob = startDiscordReconciliationJob;
//# sourceMappingURL=discordReconciliationJob.js.map