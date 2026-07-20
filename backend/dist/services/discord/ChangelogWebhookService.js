"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangelogWebhookService = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../../utils/logger");
const redis_1 = require("../../utils/redis");
const CHANGELOG_WEBHOOK_LOCK_KEY = 'bot:changelog:webhook:lock';
const LAST_POSTED_VERSION_KEY = 'bot:changelog:webhook:last-posted-version';
const CHANGELOG_URL = 'https://fringecore.space/changelog';
const WEBHOOK_USERNAME = 'Fringe Core Changelog';
const DEFAULT_POLL_INTERVAL_MS = 15 * 60 * 1000;
const MIN_POLL_INTERVAL_MS = 60 * 1000;
const DEFAULT_STARTUP_RECHECK_MS = 30 * 1000;
const MIN_STARTUP_RECHECK_MS = 5 * 1000;
const LOCK_TTL_SECONDS = 120;
const STATE_TTL_SECONDS = 10 * 365 * 24 * 60 * 60;
const MAX_RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_BASE_MS = 1_000;
const RATE_LIMIT_BACKOFF_MAX_MS = 30_000;
const RATE_LIMIT_JITTER_RATIO = 0.2;
const RATE_LIMIT_ESCALATION_THRESHOLD = 3;
class WebhookRateLimitedError extends Error {
    retryAfterMs;
    attempts;
    constructor(message, retryAfterMs, attempts) {
        super(message);
        this.name = 'WebhookRateLimitedError';
        this.retryAfterMs = retryAfterMs;
        this.attempts = attempts;
    }
}
class ChangelogWebhookService {
    static instance;
    pollInterval = null;
    startupRecheckTimer = null;
    webhookUrl = null;
    enabled = false;
    consecutiveRateLimitFailures = 0;
    static getInstance() {
        if (!ChangelogWebhookService.instance) {
            ChangelogWebhookService.instance = new ChangelogWebhookService();
        }
        return ChangelogWebhookService.instance;
    }
    initialize() {
        if (this.enabled) {
            return;
        }
        const configuredWebhookUrl = process.env.DISCORD_CHANGELOG_WEBHOOK_URL?.trim() ?? '';
        if (!configuredWebhookUrl) {
            logger_1.logger.info('Changelog webhook auto-posting is disabled (no webhook URL configured)');
            return;
        }
        if (!this.isDiscordWebhookUrl(configuredWebhookUrl)) {
            logger_1.logger.error('Changelog webhook URL is invalid; auto-posting is disabled');
            return;
        }
        this.webhookUrl = configuredWebhookUrl;
        this.enabled = true;
        void this.runCheckSafely('startup');
        const startupRecheckMs = this.getStartupRecheckMs();
        if (startupRecheckMs > 0) {
            this.startupRecheckTimer = setTimeout(() => {
                void this.runCheckSafely('startup-recheck');
            }, startupRecheckMs);
            if (typeof this.startupRecheckTimer.unref === 'function') {
                this.startupRecheckTimer.unref();
            }
        }
        const intervalMs = this.getPollIntervalMs();
        this.pollInterval = setInterval(() => {
            void this.runCheckSafely('poll');
        }, intervalMs);
        if (typeof this.pollInterval.unref === 'function') {
            this.pollInterval.unref();
        }
        logger_1.logger.info(`Changelog webhook auto-posting enabled (poll interval: ${intervalMs}ms, startup recheck: ${startupRecheckMs}ms)`);
    }
    shutdown() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        if (this.startupRecheckTimer) {
            clearTimeout(this.startupRecheckTimer);
            this.startupRecheckTimer = null;
        }
        this.webhookUrl = null;
        this.enabled = false;
        this.consecutiveRateLimitFailures = 0;
    }
    getPollIntervalMs() {
        const raw = Number.parseInt(process.env.DISCORD_CHANGELOG_POLL_INTERVAL_MS ?? '', 10);
        if (Number.isFinite(raw) && raw >= MIN_POLL_INTERVAL_MS) {
            return raw;
        }
        return DEFAULT_POLL_INTERVAL_MS;
    }
    getStartupRecheckMs() {
        const raw = Number.parseInt(process.env.DISCORD_CHANGELOG_STARTUP_RECHECK_MS ?? '', 10);
        if (Number.isFinite(raw)) {
            if (raw === 0) {
                return 0;
            }
            if (raw >= MIN_STARTUP_RECHECK_MS) {
                return raw;
            }
        }
        return DEFAULT_STARTUP_RECHECK_MS;
    }
    async runCheckSafely(reason) {
        try {
            await this.checkAndPostNewEntries();
            if (this.consecutiveRateLimitFailures > 0) {
                logger_1.logger.info('Changelog webhook recovered from Discord rate limiting', {
                    consecutiveRateLimitFailures: this.consecutiveRateLimitFailures,
                });
            }
            this.consecutiveRateLimitFailures = 0;
        }
        catch (error) {
            if (error instanceof WebhookRateLimitedError) {
                this.handleRateLimitedFailure(reason, error);
                return;
            }
            this.consecutiveRateLimitFailures = 0;
            logger_1.logger.error(`Changelog webhook ${reason} check failed`, {
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    handleRateLimitedFailure(reason, error) {
        this.consecutiveRateLimitFailures += 1;
        const details = {
            error: error.message,
            retryAfterMs: error.retryAfterMs,
            attempts: error.attempts,
            consecutiveRateLimitFailures: this.consecutiveRateLimitFailures,
        };
        if (this.consecutiveRateLimitFailures >= RATE_LIMIT_ESCALATION_THRESHOLD) {
            logger_1.logger.error(`Changelog webhook ${reason} check remains throttled by Discord (429)`, details);
            return;
        }
        logger_1.logger.warn(`Changelog webhook ${reason} check throttled by Discord (429)`, details);
    }
    async checkAndPostNewEntries() {
        const webhookUrl = this.webhookUrl;
        if (!webhookUrl) {
            return;
        }
        let lockAcquired = false;
        try {
            lockAcquired = await redis_1.redisClient.acquireLock(CHANGELOG_WEBHOOK_LOCK_KEY, LOCK_TTL_SECONDS);
            if (!lockAcquired) {
                return;
            }
            await this.postMissingEntries(webhookUrl);
        }
        finally {
            if (lockAcquired) {
                await redis_1.redisClient.releaseLock(CHANGELOG_WEBHOOK_LOCK_KEY);
            }
        }
    }
    async postMissingEntries(webhookUrl) {
        const latestEntry = shared_types_1.changelogEntries[0];
        if (!latestEntry) {
            return;
        }
        const lastPostedVersion = await redis_1.cache.get(LAST_POSTED_VERSION_KEY);
        const postOnFirstRun = process.env.DISCORD_CHANGELOG_POST_ON_FIRST_RUN === 'true';
        if (!lastPostedVersion) {
            if (!postOnFirstRun) {
                await redis_1.cache.set(LAST_POSTED_VERSION_KEY, latestEntry.version, STATE_TTL_SECONDS);
                logger_1.logger.info(`Changelog webhook baseline initialized at version ${latestEntry.version}; no historical posts sent`);
                return;
            }
            await this.postEntry(webhookUrl, latestEntry);
            await redis_1.cache.set(LAST_POSTED_VERSION_KEY, latestEntry.version, STATE_TTL_SECONDS);
            logger_1.logger.info(`Posted initial changelog entry ${latestEntry.version} to webhook`);
            return;
        }
        if (lastPostedVersion === latestEntry.version) {
            return;
        }
        const lastPostedIndex = shared_types_1.changelogEntries.findIndex(entry => entry.version === lastPostedVersion);
        const unseenEntries = lastPostedIndex >= 0 ? shared_types_1.changelogEntries.slice(0, lastPostedIndex) : [latestEntry];
        if (unseenEntries.length === 0) {
            await redis_1.cache.set(LAST_POSTED_VERSION_KEY, latestEntry.version, STATE_TTL_SECONDS);
            return;
        }
        for (const entry of [...unseenEntries].reverse()) {
            await this.postEntry(webhookUrl, entry);
        }
        await redis_1.cache.set(LAST_POSTED_VERSION_KEY, latestEntry.version, STATE_TTL_SECONDS);
        logger_1.logger.info(`Posted ${unseenEntries.length} new changelog entr${unseenEntries.length === 1 ? 'y' : 'ies'} to webhook (latest: ${latestEntry.version})`);
    }
    async postEntry(webhookUrl, entry) {
        const payload = {
            username: WEBHOOK_USERNAME,
            embeds: [this.buildEmbed(entry)],
        };
        for (let attempt = 1; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
            try {
                await axios_1.default.post(webhookUrl, payload, {
                    timeout: 10_000,
                });
                return;
            }
            catch (error) {
                const rateLimitedError = this.buildRateLimitedError(error, entry, attempt);
                if (rateLimitedError) {
                    if (attempt >= MAX_RATE_LIMIT_RETRIES) {
                        throw rateLimitedError;
                    }
                    const waitMs = this.computeRateLimitBackoffMs(attempt, rateLimitedError.retryAfterMs);
                    logger_1.logger.warn('Changelog webhook post throttled by Discord (429); retrying', {
                        version: entry.version,
                        attempt,
                        maxAttempts: MAX_RATE_LIMIT_RETRIES,
                        retryAfterMs: rateLimitedError.retryAfterMs,
                        waitMs,
                    });
                    await this.delay(waitMs);
                    continue;
                }
                if (axios_1.default.isAxiosError(error)) {
                    const status = error.response?.status;
                    const statusText = error.response?.statusText;
                    const detail = status ? `${status} ${statusText ?? ''}`.trim() : error.message;
                    throw new Error(`Discord webhook request failed for ${entry.version}: ${detail}`);
                }
                throw error;
            }
        }
        throw new Error(`Discord webhook request failed for ${entry.version}: exhausted retries`);
    }
    buildRateLimitedError(error, entry, attempts) {
        if (!axios_1.default.isAxiosError(error)) {
            return null;
        }
        const status = error.response?.status;
        if (status !== 429) {
            return null;
        }
        const statusText = error.response?.statusText;
        const detail = status ? `${status} ${statusText ?? ''}`.trim() : error.message;
        const retryAfterMs = this.parseRetryAfterMs(error.response?.headers?.['retry-after']);
        return new WebhookRateLimitedError(`Discord webhook request failed for ${entry.version}: ${detail}`, retryAfterMs, attempts);
    }
    parseRetryAfterMs(headerValue) {
        const rawValue = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        if (rawValue === undefined || rawValue === null) {
            return null;
        }
        if (typeof rawValue === 'number' && Number.isFinite(rawValue) && rawValue >= 0) {
            return Math.round(rawValue * 1000);
        }
        if (typeof rawValue !== 'string') {
            return null;
        }
        const normalized = rawValue.trim();
        if (!normalized) {
            return null;
        }
        const retryAfterSeconds = Number.parseFloat(normalized);
        if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
            return Math.round(retryAfterSeconds * 1000);
        }
        const retryAfterDateMs = Date.parse(normalized);
        if (Number.isNaN(retryAfterDateMs)) {
            return null;
        }
        return Math.max(0, retryAfterDateMs - Date.now());
    }
    computeRateLimitBackoffMs(attempt, retryAfterMs) {
        const exponential = Math.min(RATE_LIMIT_BACKOFF_MAX_MS, RATE_LIMIT_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
        const jitterWindow = Math.round(exponential * RATE_LIMIT_JITTER_RATIO);
        const jitter = jitterWindow > 0 ? Math.floor(Math.random() * (jitterWindow * 2 + 1)) - jitterWindow : 0;
        const computedDelayMs = Math.max(0, exponential + jitter);
        if (retryAfterMs === null) {
            return computedDelayMs;
        }
        return Math.max(computedDelayMs, retryAfterMs);
    }
    async delay(ms) {
        if (ms <= 0) {
            return;
        }
        await new Promise(resolve => {
            const timer = setTimeout(resolve, ms);
            if (typeof timer.unref === 'function') {
                timer.unref();
            }
        });
    }
    buildEmbed(entry) {
        const title = this.limitLength(`${entry.version} - ${entry.title}`, 250);
        const timestamp = this.toIsoTimestamp(entry.date);
        const embed = {
            title,
            url: CHANGELOG_URL,
            description: this.buildDescription(entry),
            color: this.getCategoryColor(entry.changes[0]?.category),
            footer: { text: 'Fringe Core - Changelog' },
        };
        if (timestamp) {
            embed.timestamp = timestamp;
        }
        return embed;
    }
    buildDescription(entry) {
        const highlights = entry.highlights.slice(0, 4).map(item => `- ${item}`);
        const categorySummary = entry.changes
            .map(change => `${this.getCategoryLabel(change.category)}: ${change.items.length}`)
            .join(' | ');
        const description = [
            ...highlights,
            '',
            `Categories: ${categorySummary || 'General'}`,
            `[View full changelog](${CHANGELOG_URL})`,
        ].join('\n');
        return this.limitLength(description, 4000);
    }
    getCategoryLabel(category) {
        switch (category) {
            case 'added':
                return 'Added';
            case 'fixed':
                return 'Fixed';
            case 'improved':
                return 'Improved';
            case 'removed':
                return 'Removed';
            default:
                return 'General';
        }
    }
    getCategoryColor(category) {
        switch (category) {
            case 'added':
                return 3447003;
            case 'fixed':
                return 15158332;
            case 'improved':
                return 3066993;
            case 'removed':
                return 10038562;
            default:
                return 15844367;
        }
    }
    toIsoTimestamp(date) {
        const parsed = new Date(`${date}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime())) {
            return undefined;
        }
        return parsed.toISOString();
    }
    limitLength(value, maxLength) {
        if (value.length <= maxLength) {
            return value;
        }
        return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
    }
    isDiscordWebhookUrl(value) {
        try {
            const parsed = new URL(value);
            const hostname = parsed.hostname.toLowerCase();
            const validHostnames = new Set(['discord.com', 'ptb.discord.com', 'canary.discord.com']);
            return (parsed.protocol === 'https:' &&
                validHostnames.has(hostname) &&
                parsed.pathname.startsWith('/api/webhooks/'));
        }
        catch {
            return false;
        }
    }
}
exports.ChangelogWebhookService = ChangelogWebhookService;
//# sourceMappingURL=ChangelogWebhookService.js.map