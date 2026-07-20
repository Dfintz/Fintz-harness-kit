"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISCORD_ACCOUNT_NOT_LINKED_CODE = void 0;
exports.getDiscordWebLoginUrl = getDiscordWebLoginUrl;
exports.isHttpUrl = isHttpUrl;
exports.parseDiscordAccountLinkPrompt = parseDiscordAccountLinkPrompt;
const errorHandler_1 = require("./errorHandler");
exports.DISCORD_ACCOUNT_NOT_LINKED_CODE = 'DISCORD_ACCOUNT_NOT_LINKED';
function getDiscordWebLoginUrl() {
    const frontendUrl = (process.env.FRONTEND_URL ?? 'https://fringecore.space').replace(/\/$/, '');
    return `${frontendUrl}/login`;
}
function isHttpUrl(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return false;
    }
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    }
    catch {
        return false;
    }
}
function parseDiscordAccountLinkPrompt(error, options) {
    if (!(0, errorHandler_1.isAxiosError)(error)) {
        return null;
    }
    const allowedStatusCodes = new Set(options.allowedStatusCodes ?? [401, 403, 404]);
    const status = error.response?.status;
    const data = (error.response?.data ?? {});
    const errorCode = typeof data.errorCode === 'string' ? data.errorCode : '';
    const apiError = typeof data.error === 'string' ? data.error : '';
    const apiMessage = typeof data.message === 'string' ? data.message : '';
    const combined = `${apiError} ${apiMessage}`.toLowerCase();
    const isNotLinkedError = errorCode === exports.DISCORD_ACCOUNT_NOT_LINKED_CODE ||
        (allowedStatusCodes.has(status ?? 0) &&
            (combined.includes('no platform user linked to this discord account') ||
                combined.includes('discord account is not linked') ||
                combined.includes('link your discord account on the web app first')));
    if (!isNotLinkedError) {
        return null;
    }
    return {
        message: apiMessage || options.fallbackMessage,
        loginUrl: isHttpUrl(data.loginUrl) ? data.loginUrl : options.fallbackLoginUrl,
    };
}
//# sourceMappingURL=discordAccountLink.js.map