"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatBotApiError = formatBotApiError;
const logger_1 = require("../../utils/logger");
function extractResponseMessage(data) {
    if (!data || typeof data !== 'object') {
        return undefined;
    }
    const record = data;
    if (typeof record.message === 'string') {
        return record.message;
    }
    if (typeof record.error === 'string') {
        return record.error;
    }
    if (record.error &&
        typeof record.error === 'object' &&
        typeof record.error.message === 'string') {
        return record.error.message;
    }
    return undefined;
}
function formatBotApiError(error, fallback, context) {
    const axiosError = error;
    logger_1.logger.error(`Bot API error${context ? ` [${context}]` : ''}`, {
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        url: axiosError.config?.url,
        method: axiosError.config?.method,
        code: axiosError.code,
        message: axiosError.message,
    });
    if (axiosError.response?.status === 403) {
        const responseMsg = extractResponseMessage(axiosError.response?.data);
        if (responseMsg === 'Direct access not permitted') {
            return ('Bot-to-API authentication failed (Direct access not permitted).\n' +
                '💡 Ensure `BOT_INTERNAL_SECRET` is set to the **same value** in both ' +
                'the API and bot containers.');
        }
    }
    if (axiosError.response?.status === 401) {
        const responseMsg = extractResponseMessage(axiosError.response?.data);
        if (responseMsg === 'Access token required' ||
            responseMsg === 'Unauthorized: invalid bot token' ||
            responseMsg === 'Unauthorized: BOT_INTERNAL_SECRET is not configured') {
            return (`Bot-to-API authentication failed (${responseMsg}).\n` +
                '💡 Ensure `BOT_INTERNAL_SECRET` is set to the **same value** in both ' +
                'the API and bot containers, then restart the bot.');
        }
    }
    const responseMsg = extractResponseMessage(axiosError.response?.data);
    return responseMsg ?? (error instanceof Error ? error.message : fallback);
}
//# sourceMappingURL=botErrorFormat.js.map