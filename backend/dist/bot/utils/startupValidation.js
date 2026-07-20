"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateBotInternalSecret = validateBotInternalSecret;
const logger_1 = require("../../utils/logger");
function validateBotInternalSecret({ contextLabel, onFailure, logSuccess = false, }) {
    const botSecret = process.env.BOT_INTERNAL_SECRET;
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const isNonProdEnv = nodeEnv === 'development' || nodeEnv === 'test';
    if (!botSecret) {
        const message = `${contextLabel} BOT_INTERNAL_SECRET is required for bot-to-API authentication. ` +
            `NODE_ENV=${nodeEnv}. ` +
            'Set BOT_INTERNAL_SECRET to the same value in both API and bot containers. ' +
            'Check docker-compose.yml and .env files to verify both services have matching values.';
        if (isNonProdEnv) {
            logger_1.logger.warn(`${contextLabel} Dev mode: ${message}`);
            return;
        }
        logger_1.logger.error(message);
        if (onFailure === 'exit') {
            process.exit(1);
        }
        throw new Error(message);
    }
    if (logSuccess) {
        logger_1.logger.info(`${contextLabel} BOT_INTERNAL_SECRET is configured`);
    }
}
//# sourceMappingURL=startupValidation.js.map