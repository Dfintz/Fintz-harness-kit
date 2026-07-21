jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    isAxiosError: jest.fn(),
  },
}));

jest.mock('../../../utils/redis', () => ({
  cache: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(true),
  },
  redisClient: {
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(undefined),
  },
}));

import axios from 'axios';

import { changelogEntries } from '@sc-fleet-manager/shared-types';

import { ChangelogWebhookService } from '../../../services/discord/ChangelogWebhookService';
import { logger } from '../../../utils/logger';
import { cache, redisClient } from '../../../utils/redis';

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedCache = cache as jest.Mocked<typeof cache>;
const mockedRedisClient = redisClient as jest.Mocked<typeof redisClient>;
const mockedLogger = logger as jest.Mocked<typeof logger>;

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function getService(): ChangelogWebhookService {
  (ChangelogWebhookService as unknown as { instance?: ChangelogWebhookService }).instance =
    undefined;
  return ChangelogWebhookService.getInstance();
}

describe('ChangelogWebhookService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();

    delete process.env.DISCORD_CHANGELOG_WEBHOOK_URL;
    delete process.env.DISCORD_CHANGELOG_POLL_INTERVAL_MS;
    delete process.env.DISCORD_CHANGELOG_STARTUP_RECHECK_MS;
    delete process.env.DISCORD_CHANGELOG_POST_ON_FIRST_RUN;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs an immediate changelog check on startup', async () => {
    process.env.DISCORD_CHANGELOG_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc';
    process.env.DISCORD_CHANGELOG_STARTUP_RECHECK_MS = '0';
    mockedCache.get.mockResolvedValueOnce(changelogEntries[0]?.version ?? null);

    const service = getService();
    service.initialize();

    await flushMicrotasks();

    expect(mockedRedisClient.acquireLock).toHaveBeenCalledTimes(1);
    service.shutdown();
  });

  it('runs a startup recheck after configured delay', async () => {
    jest.useFakeTimers();

    process.env.DISCORD_CHANGELOG_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/abc';
    process.env.DISCORD_CHANGELOG_POLL_INTERVAL_MS = '900000';
    process.env.DISCORD_CHANGELOG_STARTUP_RECHECK_MS = '5000';
    mockedCache.get.mockResolvedValue(changelogEntries[0]?.version ?? null);

    const service = getService();
    service.initialize();

    await flushMicrotasks();
    expect(mockedRedisClient.acquireLock).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5000);
    await flushMicrotasks();

    expect(mockedRedisClient.acquireLock).toHaveBeenCalledTimes(2);
    service.shutdown();
  });

  it('initializes baseline without posting when first run bootstrap is disabled', async () => {
    const service = getService();
    const latestVersion = changelogEntries[0]?.version;
    expect(latestVersion).toBeDefined();

    mockedCache.get.mockResolvedValueOnce(null);

    await (
      service as unknown as { postMissingEntries: (url: string) => Promise<void> }
    ).postMissingEntries('https://discord.com/api/webhooks/123/abc');

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedCache.set).toHaveBeenCalledWith(
      'bot:changelog:webhook:last-posted-version',
      latestVersion,
      10 * 365 * 24 * 60 * 60
    );
  });

  it('posts only unseen entries in chronological order when new versions exist', async () => {
    const service = getService();
    const latest = changelogEntries[0];
    const thirdLatest = changelogEntries[2];
    expect(latest).toBeDefined();
    expect(thirdLatest).toBeDefined();

    mockedCache.get.mockResolvedValueOnce(thirdLatest.version);

    await (
      service as unknown as { postMissingEntries: (url: string) => Promise<void> }
    ).postMissingEntries('https://discord.com/api/webhooks/123/abc');

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);

    const firstPayload = mockedAxios.post.mock.calls[0]?.[1] as {
      embeds: Array<{ title?: string }>;
    };
    const secondPayload = mockedAxios.post.mock.calls[1]?.[1] as {
      embeds: Array<{ title?: string }>;
    };

    expect(firstPayload.embeds[0]?.title).toContain(changelogEntries[1]?.version ?? '');
    expect(secondPayload.embeds[0]?.title).toContain(changelogEntries[0]?.version ?? '');

    expect(mockedCache.set).toHaveBeenCalledWith(
      'bot:changelog:webhook:last-posted-version',
      latest.version,
      10 * 365 * 24 * 60 * 60
    );
  });

  it('posts latest entry on first run when bootstrap posting is enabled', async () => {
    process.env.DISCORD_CHANGELOG_POST_ON_FIRST_RUN = 'true';

    const service = getService();
    mockedCache.get.mockResolvedValueOnce(null);

    await (
      service as unknown as { postMissingEntries: (url: string) => Promise<void> }
    ).postMissingEntries('https://discord.com/api/webhooks/123/abc');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);

    const payload = mockedAxios.post.mock.calls[0]?.[1] as {
      embeds: Array<{ title?: string }>;
    };
    expect(payload.embeds[0]?.title).toContain(changelogEntries[0]?.version ?? '');
  });

  it('does not post when latest version has already been posted', async () => {
    const service = getService();
    mockedCache.get.mockResolvedValueOnce(changelogEntries[0]?.version ?? null);

    await (
      service as unknown as { postMissingEntries: (url: string) => Promise<void> }
    ).postMissingEntries('https://discord.com/api/webhooks/123/abc');

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedCache.set).not.toHaveBeenCalled();
  });

  it('falls back to posting only latest when previous version is no longer in feed', async () => {
    const service = getService();
    mockedCache.get.mockResolvedValueOnce('1999.01.001');

    await (
      service as unknown as { postMissingEntries: (url: string) => Promise<void> }
    ).postMissingEntries('https://discord.com/api/webhooks/123/abc');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);

    const payload = mockedAxios.post.mock.calls[0]?.[1] as {
      embeds: Array<{ title?: string }>;
    };
    expect(payload.embeds[0]?.title).toContain(changelogEntries[0]?.version ?? '');
  });

  it('skips processing when lock is not acquired', async () => {
    const service = getService();

    (service as unknown as { webhookUrl: string | null }).webhookUrl =
      'https://discord.com/api/webhooks/123/abc';
    mockedRedisClient.acquireLock.mockResolvedValueOnce(false);

    await (
      service as unknown as { checkAndPostNewEntries: () => Promise<void> }
    ).checkAndPostNewEntries();

    expect(mockedAxios.post).not.toHaveBeenCalled();
    expect(mockedRedisClient.releaseLock).not.toHaveBeenCalled();
  });

  it('retries throttled webhook posts and honors Retry-After delay', async () => {
    const service = getService();
    const delaySpy = jest
      .spyOn(service as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
      .mockResolvedValue(undefined);

    const rateLimitError = {
      message: 'Request failed with status code 429',
      response: {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'retry-after': '2',
        },
      },
    };

    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post
      .mockRejectedValueOnce(rateLimitError)
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({});

    await (
      service as unknown as {
        postEntry: (url: string, entry: (typeof changelogEntries)[number]) => Promise<void>;
      }
    ).postEntry('https://discord.com/api/webhooks/123/abc', changelogEntries[0]!);

    expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    expect(delaySpy).toHaveBeenCalledTimes(2);
    for (const call of delaySpy.mock.calls) {
      expect(call[0]).toBeGreaterThanOrEqual(2000);
      expect(call[0]).toBeLessThanOrEqual(2400);
    }

    const retryWarns = mockedLogger.warn.mock.calls.filter(call =>
      String(call[0]).includes('post throttled by Discord (429); retrying')
    );
    expect(retryWarns).toHaveLength(2);
  });

  it('logs warnings first then escalates persistent throttling to error', async () => {
    const service = getService();
    const delaySpy = jest
      .spyOn(service as unknown as { delay: (ms: number) => Promise<void> }, 'delay')
      .mockResolvedValue(undefined);

    (service as unknown as { webhookUrl: string | null }).webhookUrl =
      'https://discord.com/api/webhooks/123/abc';

    mockedCache.get.mockResolvedValue('1999.01.001');
    mockedRedisClient.acquireLock.mockResolvedValue(true);
    mockedRedisClient.releaseLock.mockResolvedValue(undefined);

    const rateLimitError = {
      message: 'Request failed with status code 429',
      response: {
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          'retry-after': '1',
        },
      },
    };

    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValue(rateLimitError);

    await (
      service as unknown as {
        runCheckSafely: (reason: 'startup' | 'startup-recheck' | 'poll') => Promise<void>;
      }
    ).runCheckSafely('poll');
    await (
      service as unknown as {
        runCheckSafely: (reason: 'startup' | 'startup-recheck' | 'poll') => Promise<void>;
      }
    ).runCheckSafely('poll');
    await (
      service as unknown as {
        runCheckSafely: (reason: 'startup' | 'startup-recheck' | 'poll') => Promise<void>;
      }
    ).runCheckSafely('poll');

    expect(delaySpy).toHaveBeenCalled();

    const throttledWarns = mockedLogger.warn.mock.calls.filter(call =>
      String(call[0]).includes('check throttled by Discord (429)')
    );
    const throttledErrors = mockedLogger.error.mock.calls.filter(call =>
      String(call[0]).includes('check remains throttled by Discord (429)')
    );

    expect(throttledWarns.length).toBeGreaterThanOrEqual(2);
    expect(throttledErrors).toHaveLength(1);
  });
});
