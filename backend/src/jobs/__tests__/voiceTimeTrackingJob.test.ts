jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    query: jest.fn(),
  },
}));

jest.mock('../../config/applicationInsights', () => ({
  trackMetric: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
  },
}));

import { trackMetric } from '../../config/applicationInsights';
import { AppDataSource } from '../../config/database';
import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';
import { runVoiceTimeTracking, startVoiceTimeTrackingJob } from '../voiceTimeTrackingJob';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const flushAsync = async (): Promise<void> => {
  await new Promise<void>(resolve => {
    setImmediate(() => resolve());
  });
};

describe('voiceTimeTrackingJob', () => {
  const mockOrgRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockFedRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name: string }) => {
      switch (entity.name) {
        case 'Organization':
          return mockOrgRepo;
        case 'Federation':
          return mockFedRepo;
        default:
          return {};
      }
    });

    const orgQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockOrgRepo.createQueryBuilder.mockReturnValue(orgQb);

    const fedQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockFedRepo.createQueryBuilder.mockReturnValue(fedQb);

    (AppDataSource.query as jest.Mock).mockResolvedValue(undefined);
    (globalThis.fetch as unknown as jest.Mock) = jest.fn();
    (cache.get as jest.Mock).mockResolvedValue(null);
  });

  afterEach(() => {
    (globalThis.fetch as unknown as jest.Mock).mockReset();
  });

  it('credits aggregated minutes with one batch upsert per org and tracks totals', async () => {
    const orgQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'org-1',
          settings: {
            voiceServer: {
              enabled: true,
              contributeToCAS: true,
              iceHost: 'bridge.example.com',
              icePort: 8443,
            },
          },
        },
      ]),
    };
    mockOrgRepo.createQueryBuilder.mockReturnValue(orgQb);

    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        channels: [],
        users: [
          {
            displayName: 'Pilot One',
            channelId: 1,
            isMuted: false,
            isDeafened: false,
            onlineSince: 'now',
            platformUserId: 'user-1',
          },
          {
            displayName: 'Pilot One Duplicate Session',
            channelId: 1,
            isMuted: false,
            isDeafened: false,
            onlineSince: 'now',
            platformUserId: 'user-1',
          },
          {
            displayName: 'Pilot Two',
            channelId: 1,
            isMuted: false,
            isDeafened: false,
            onlineSince: 'now',
            platformUserId: 'user-2',
          },
          {
            displayName: 'Guest',
            channelId: 1,
            isMuted: false,
            isDeafened: false,
            onlineSince: 'now',
          },
        ],
      }),
    });

    const { cleanup } = startVoiceTimeTrackingJob();
    await flushAsync();
    await flushAsync();
    cleanup();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://bridge.example.com:8443/channels',
      expect.objectContaining({
        signal: expect.anything(),
      })
    );
    expect(AppDataSource.query).toHaveBeenCalledTimes(1);

    const [queryText, queryParams] = (AppDataSource.query as jest.Mock).mock.calls[0] as [
      string,
      [string, string, string[], number[]],
    ];
    expect(queryText).toContain('INSERT INTO member_engagements');
    expect(queryParams[0]).toBe('platform');
    expect(queryParams[2]).toEqual(['user-1', 'user-2']);
    expect(queryParams[3]).toEqual([10, 5]);

    expect(trackMetric).toHaveBeenCalledWith('voice.tracking.minutes_credited', 15);
  });

  it('processes organizations with bounded parallel polling instead of strict serialization', async () => {
    const orgQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'org-1',
          settings: {
            voiceServer: {
              enabled: true,
              contributeToCAS: true,
              iceHost: 'bridge-1.example.com',
              icePort: 8443,
            },
          },
        },
        {
          id: 'org-2',
          settings: {
            voiceServer: {
              enabled: true,
              contributeToCAS: true,
              iceHost: 'bridge-2.example.com',
              icePort: 8443,
            },
          },
        },
      ]),
    };
    mockOrgRepo.createQueryBuilder.mockReturnValue(orgQb);

    const deferredOne = createDeferred<{ ok: boolean; json: () => Promise<unknown> }>();
    const deferredTwo = createDeferred<{ ok: boolean; json: () => Promise<unknown> }>();

    (globalThis.fetch as unknown as jest.Mock)
      .mockImplementationOnce(() => deferredOne.promise)
      .mockImplementationOnce(() => deferredTwo.promise);

    const { cleanup } = startVoiceTimeTrackingJob();
    await flushAsync();

    // With concurrent workers, both org poll requests are initiated before either resolves.
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);

    deferredOne.resolve({
      ok: true,
      json: async () => ({ channels: [], users: [] }),
    });
    deferredTwo.resolve({
      ok: true,
      json: async () => ({ channels: [], users: [] }),
    });

    await flushAsync();
    await flushAsync();
    cleanup();
  });

  it('falls back to per-user upserts when batch write fails', async () => {
    const orgQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'org-1',
          settings: {
            voiceServer: {
              enabled: true,
              contributeToCAS: true,
              iceHost: 'bridge.example.com',
              icePort: 8443,
            },
          },
        },
      ]),
    };
    mockOrgRepo.createQueryBuilder.mockReturnValue(orgQb);

    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        channels: [],
        users: [
          {
            displayName: 'Pilot One',
            channelId: 1,
            isMuted: false,
            isDeafened: false,
            onlineSince: 'now',
            platformUserId: 'user-1',
          },
          {
            displayName: 'Pilot Two',
            channelId: 1,
            isMuted: false,
            isDeafened: false,
            onlineSince: 'now',
            platformUserId: 'user-2',
          },
        ],
      }),
    });

    (AppDataSource.query as jest.Mock)
      .mockRejectedValueOnce(new Error('batch failure'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined);

    const { cleanup } = startVoiceTimeTrackingJob();
    await flushAsync();
    await flushAsync();
    cleanup();

    expect(AppDataSource.query).toHaveBeenCalledTimes(3);
    const [batchQueryText] = (AppDataSource.query as jest.Mock).mock.calls[0] as [
      string,
      [string, string, string[], number[]],
    ];
    expect(batchQueryText).toContain('INSERT INTO member_engagements');

    const fallbackCalls = (AppDataSource.query as jest.Mock).mock.calls.slice(1);
    const fallbackUserIds = fallbackCalls
      .map(call => ((call[1] as [string, string, string[], number[]])[2] ?? [])[0])
      .sort();
    expect(fallbackUserIds).toEqual(['user-1', 'user-2']);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Batch upsert failed'),
      expect.objectContaining({ records: 2 })
    );
  });

  it('persists aggregated federation scope credits via member engagement upsert', async () => {
    process.env.PLATFORM_MUMBLE_FEDERATION_ID = 'fed-1';

    const orgQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    mockOrgRepo.createQueryBuilder.mockReturnValue(orgQb);

    const fedQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'fed-1',
          settings: {
            voiceServer: {
              enabled: true,
              contributeToCAS: true,
            },
          },
        },
      ]),
    };
    mockFedRepo.createQueryBuilder.mockReturnValue(fedQb);

    (cache.get as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'voice:channels:fed:fed-1') {
        return {
          channels: [],
          users: [{ platformUserId: 'user-1' }, { platformUserId: 'user-2' }],
        };
      }

      if (key === 'voice:channels:platform') {
        return {
          channels: [],
          users: [{ platformUserId: 'user-2' }, { platformUserId: 'user-3' }],
        };
      }

      return null;
    });

    await runVoiceTimeTracking();

    expect(mockFedRepo.createQueryBuilder).toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalledWith('voice:channels:fed:fed-1');
    expect(cache.get).toHaveBeenCalledWith('voice:channels:platform');

    expect(AppDataSource.query).toHaveBeenCalledTimes(1);
    const [_sql, queryParams] = (AppDataSource.query as jest.Mock).mock.calls[0] as [
      string,
      [string, string, string[], number[]],
    ];

    expect(queryParams[2]).toEqual(['user-1', 'user-2', 'user-3']);
    expect(queryParams[3]).toEqual([5, 10, 5]);
    expect(trackMetric).toHaveBeenCalledWith('voice.tracking.minutes_credited', 20);
  });

  it('skips minute credits when CVP endpoint is unavailable', async () => {
    const orgQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'org-1',
          settings: {
            voiceServer: {
              enabled: true,
              contributeToCAS: true,
              iceHost: 'bridge.example.com',
            },
          },
        },
      ]),
    };
    mockOrgRepo.createQueryBuilder.mockReturnValue(orgQb);

    (globalThis.fetch as unknown as jest.Mock).mockResolvedValue({ ok: false });

    const { cleanup } = startVoiceTimeTrackingJob();
    await flushAsync();
    await flushAsync();
    cleanup();

    expect(AppDataSource.query).not.toHaveBeenCalled();
    expect(trackMetric).not.toHaveBeenCalledWith(
      'voice.tracking.minutes_credited',
      expect.anything()
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
