import { changelogEntries, type ChangelogEntry } from '@sc-fleet-manager/shared-types';
import axios from 'axios';

import { logger } from '../../utils/logger';
import { cache, redisClient } from '../../utils/redis';

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

type ChangelogCategory = ChangelogEntry['changes'][number]['category'];

class WebhookRateLimitedError extends Error {
  readonly retryAfterMs: number | null;
  readonly attempts: number;

  constructor(message: string, retryAfterMs: number | null, attempts: number) {
    super(message);
    this.name = 'WebhookRateLimitedError';
    this.retryAfterMs = retryAfterMs;
    this.attempts = attempts;
  }
}

/**
 * Posts newly added changelog entries to a Discord webhook.
 *
 * Deduplication is persisted in Redis via LAST_POSTED_VERSION_KEY, and
 * a distributed lock prevents duplicate posts when multiple bot processes run.
 */
export class ChangelogWebhookService {
  private static instance: ChangelogWebhookService;
  private pollInterval: NodeJS.Timeout | null = null;
  private startupRecheckTimer: NodeJS.Timeout | null = null;
  private webhookUrl: string | null = null;
  private enabled = false;
  private consecutiveRateLimitFailures = 0;

  static getInstance(): ChangelogWebhookService {
    if (!ChangelogWebhookService.instance) {
      ChangelogWebhookService.instance = new ChangelogWebhookService();
    }

    return ChangelogWebhookService.instance;
  }

  initialize(): void {
    if (this.enabled) {
      return;
    }

    const configuredWebhookUrl = process.env.DISCORD_CHANGELOG_WEBHOOK_URL?.trim() ?? '';
    if (!configuredWebhookUrl) {
      logger.info('Changelog webhook auto-posting is disabled (no webhook URL configured)');
      return;
    }

    if (!this.isDiscordWebhookUrl(configuredWebhookUrl)) {
      logger.error('Changelog webhook URL is invalid; auto-posting is disabled');
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

    logger.info(
      `Changelog webhook auto-posting enabled (poll interval: ${intervalMs}ms, startup recheck: ${startupRecheckMs}ms)`
    );
  }

  shutdown(): void {
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

  private getPollIntervalMs(): number {
    const raw = Number.parseInt(process.env.DISCORD_CHANGELOG_POLL_INTERVAL_MS ?? '', 10);
    if (Number.isFinite(raw) && raw >= MIN_POLL_INTERVAL_MS) {
      return raw;
    }

    return DEFAULT_POLL_INTERVAL_MS;
  }

  private getStartupRecheckMs(): number {
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

  private async runCheckSafely(reason: 'startup' | 'startup-recheck' | 'poll'): Promise<void> {
    try {
      await this.checkAndPostNewEntries();

      if (this.consecutiveRateLimitFailures > 0) {
        logger.info('Changelog webhook recovered from Discord rate limiting', {
          consecutiveRateLimitFailures: this.consecutiveRateLimitFailures,
        });
      }

      this.consecutiveRateLimitFailures = 0;
    } catch (error: unknown) {
      if (error instanceof WebhookRateLimitedError) {
        this.handleRateLimitedFailure(reason, error);
        return;
      }

      this.consecutiveRateLimitFailures = 0;
      logger.error(`Changelog webhook ${reason} check failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private handleRateLimitedFailure(
    reason: 'startup' | 'startup-recheck' | 'poll',
    error: WebhookRateLimitedError
  ): void {
    this.consecutiveRateLimitFailures += 1;

    const details = {
      error: error.message,
      retryAfterMs: error.retryAfterMs,
      attempts: error.attempts,
      consecutiveRateLimitFailures: this.consecutiveRateLimitFailures,
    };

    if (this.consecutiveRateLimitFailures >= RATE_LIMIT_ESCALATION_THRESHOLD) {
      logger.error(`Changelog webhook ${reason} check remains throttled by Discord (429)`, details);
      return;
    }

    logger.warn(`Changelog webhook ${reason} check throttled by Discord (429)`, details);
  }

  private async checkAndPostNewEntries(): Promise<void> {
    const webhookUrl = this.webhookUrl;
    if (!webhookUrl) {
      return;
    }

    let lockAcquired = false;

    try {
      lockAcquired = await redisClient.acquireLock(CHANGELOG_WEBHOOK_LOCK_KEY, LOCK_TTL_SECONDS);
      if (!lockAcquired) {
        return;
      }

      await this.postMissingEntries(webhookUrl);
    } finally {
      if (lockAcquired) {
        await redisClient.releaseLock(CHANGELOG_WEBHOOK_LOCK_KEY);
      }
    }
  }

  private async postMissingEntries(webhookUrl: string): Promise<void> {
    const latestEntry = changelogEntries[0];
    if (!latestEntry) {
      return;
    }

    const lastPostedVersion = await cache.get<string>(LAST_POSTED_VERSION_KEY);
    const postOnFirstRun = process.env.DISCORD_CHANGELOG_POST_ON_FIRST_RUN === 'true';

    if (!lastPostedVersion) {
      if (!postOnFirstRun) {
        await cache.set(LAST_POSTED_VERSION_KEY, latestEntry.version, STATE_TTL_SECONDS);
        logger.info(
          `Changelog webhook baseline initialized at version ${latestEntry.version}; no historical posts sent`
        );
        return;
      }

      await this.postEntry(webhookUrl, latestEntry);
      await cache.set(LAST_POSTED_VERSION_KEY, latestEntry.version, STATE_TTL_SECONDS);
      logger.info(`Posted initial changelog entry ${latestEntry.version} to webhook`);
      return;
    }

    if (lastPostedVersion === latestEntry.version) {
      return;
    }

    const lastPostedIndex = changelogEntries.findIndex(
      entry => entry.version === lastPostedVersion
    );
    const unseenEntries =
      lastPostedIndex >= 0 ? changelogEntries.slice(0, lastPostedIndex) : [latestEntry];

    if (unseenEntries.length === 0) {
      await cache.set(LAST_POSTED_VERSION_KEY, latestEntry.version, STATE_TTL_SECONDS);
      return;
    }

    for (const entry of [...unseenEntries].reverse()) {
      await this.postEntry(webhookUrl, entry);
    }

    await cache.set(LAST_POSTED_VERSION_KEY, latestEntry.version, STATE_TTL_SECONDS);

    logger.info(
      `Posted ${unseenEntries.length} new changelog entr${
        unseenEntries.length === 1 ? 'y' : 'ies'
      } to webhook (latest: ${latestEntry.version})`
    );
  }

  private async postEntry(webhookUrl: string, entry: ChangelogEntry): Promise<void> {
    const payload = {
      username: WEBHOOK_USERNAME,
      embeds: [this.buildEmbed(entry)],
    };

    for (let attempt = 1; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
      try {
        await axios.post(webhookUrl, payload, {
          timeout: 10_000,
        });
        return;
      } catch (error: unknown) {
        const rateLimitedError = this.buildRateLimitedError(error, entry, attempt);

        if (rateLimitedError) {
          if (attempt >= MAX_RATE_LIMIT_RETRIES) {
            throw rateLimitedError;
          }

          const waitMs = this.computeRateLimitBackoffMs(attempt, rateLimitedError.retryAfterMs);
          logger.warn('Changelog webhook post throttled by Discord (429); retrying', {
            version: entry.version,
            attempt,
            maxAttempts: MAX_RATE_LIMIT_RETRIES,
            retryAfterMs: rateLimitedError.retryAfterMs,
            waitMs,
          });
          await this.delay(waitMs);
          continue;
        }

        if (axios.isAxiosError(error)) {
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

  private buildRateLimitedError(
    error: unknown,
    entry: ChangelogEntry,
    attempts: number
  ): WebhookRateLimitedError | null {
    if (!axios.isAxiosError(error)) {
      return null;
    }

    const status = error.response?.status;
    if (status !== 429) {
      return null;
    }

    const statusText = error.response?.statusText;
    const detail = status ? `${status} ${statusText ?? ''}`.trim() : error.message;
    const retryAfterMs = this.parseRetryAfterMs(error.response?.headers?.['retry-after']);

    return new WebhookRateLimitedError(
      `Discord webhook request failed for ${entry.version}: ${detail}`,
      retryAfterMs,
      attempts
    );
  }

  private parseRetryAfterMs(headerValue: unknown): number | null {
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

  private computeRateLimitBackoffMs(attempt: number, retryAfterMs: number | null): number {
    const exponential = Math.min(
      RATE_LIMIT_BACKOFF_MAX_MS,
      RATE_LIMIT_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1)
    );
    const jitterWindow = Math.round(exponential * RATE_LIMIT_JITTER_RATIO);
    const jitter =
      jitterWindow > 0 ? Math.floor(Math.random() * (jitterWindow * 2 + 1)) - jitterWindow : 0;
    const computedDelayMs = Math.max(0, exponential + jitter);

    if (retryAfterMs === null) {
      return computedDelayMs;
    }

    return Math.max(computedDelayMs, retryAfterMs);
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }

    await new Promise<void>(resolve => {
      const timer = setTimeout(resolve, ms);
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    });
  }

  private buildEmbed(entry: ChangelogEntry): Record<string, unknown> {
    const title = this.limitLength(`${entry.version} - ${entry.title}`, 250);
    const timestamp = this.toIsoTimestamp(entry.date);

    const embed: Record<string, unknown> = {
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

  private buildDescription(entry: ChangelogEntry): string {
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

  private getCategoryLabel(category: ChangelogCategory): string {
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

  private getCategoryColor(category: ChangelogCategory | undefined): number {
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

  private toIsoTimestamp(date: string): string | undefined {
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }

    return parsed.toISOString();
  }

  private limitLength(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, Math.max(0, maxLength - 3))}...`;
  }

  private isDiscordWebhookUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      const hostname = parsed.hostname.toLowerCase();
      const validHostnames = new Set(['discord.com', 'ptb.discord.com', 'canary.discord.com']);

      return (
        parsed.protocol === 'https:' &&
        validHostnames.has(hostname) &&
        parsed.pathname.startsWith('/api/webhooks/')
      );
    } catch {
      return false;
    }
  }
}

