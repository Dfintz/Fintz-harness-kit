"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.botApiClient = void 0;
exports.discordHeaders = discordHeaders;
const promises_1 = require("node:timers/promises");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
const api_1 = require("../constants/api");
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 15_000;
const botApiClient = axios_1.default.create({
    baseURL: api_1.API_BASE_URL,
    timeout: 15_000,
    maxRedirects: 0,
});
exports.botApiClient = botApiClient;
botApiClient.interceptors.request.use((config) => {
    const secret = process.env.BOT_INTERNAL_SECRET;
    if (secret) {
        config.headers.set('x-bot-internal-token', secret);
    }
    else if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
        logger_1.logger.warn('BOT_INTERNAL_SECRET is not set; bot API calls will likely fail with 401');
    }
    const fdid = process.env.AZURE_FRONT_DOOR_ID;
    if (fdid) {
        config.headers.set('x-azure-fdid', fdid);
    }
    return config;
});
const RETRYABLE_METHODS = new Set(['get', 'head', 'options', 'put', 'delete']);
botApiClient.interceptors.response.use(undefined, async (error) => {
    const config = error.config;
    if (!config) {
        throw error;
    }
    const method = (config.method ?? 'get').toLowerCase();
    if (!RETRYABLE_METHODS.has(method)) {
        throw error;
    }
    const retryCount = config.__retryCount || 0;
    const isRetryable = error.code === 'ECONNABORTED' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        (error.response && RETRYABLE_STATUS_CODES.has(error.response.status));
    if (!isRetryable || retryCount >= MAX_RETRIES) {
        throw error;
    }
    config.__retryCount = retryCount + 1;
    const exponentialDelay = RETRY_BASE_DELAY_MS * Math.pow(2, retryCount);
    const delay = Math.max(0, Math.min(exponentialDelay, RETRY_MAX_DELAY_MS));
    logger_1.logger.warn(`Bot API request failed (${error.code ?? error.response?.status}), retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`, { url: config.url, method: config.method });
    await (0, promises_1.setTimeout)(delay);
    return botApiClient(config);
});
function discordHeaders(interaction) {
    const headers = {};
    const secret = process.env.BOT_INTERNAL_SECRET;
    if (secret) {
        headers['x-bot-internal-token'] = secret;
    }
    const fdid = process.env.AZURE_FRONT_DOOR_ID;
    if (fdid) {
        headers['x-azure-fdid'] = fdid;
    }
    if (interaction.guildId) {
        headers['x-discord-guild-id'] = interaction.guildId;
    }
    if (interaction.user?.id) {
        headers['x-discord-user-id'] = interaction.user.id;
    }
    return headers;
}
//# sourceMappingURL=botApiClient.js.map