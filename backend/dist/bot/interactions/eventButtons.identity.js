"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveInternalUserId = resolveInternalUserId;
const logger_1 = require("../../utils/logger");
const eventButtons_services_1 = require("./eventButtons.services");
async function resolveInternalUserId(discordId) {
    try {
        const user = await (0, eventButtons_services_1.getUserService)().getUserByDiscordId(discordId);
        return user?.id ?? null;
    }
    catch (err) {
        logger_1.logger.warn('Failed to resolve internal user ID from Discord ID', {
            discordId,
            error: err instanceof Error ? err.message : String(err),
        });
        return null;
    }
}
//# sourceMappingURL=eventButtons.identity.js.map