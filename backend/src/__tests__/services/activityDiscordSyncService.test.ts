import { createMockDataSource, createMockRepository } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
const mockActivityRepository = createMockRepository();

jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { ActivityDiscordSyncService } from '../../services/activity/ActivityDiscordSyncService';

describe('ActivityDiscordSyncService', () => {
  let service: ActivityDiscordSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDataSource.isInitialized = true;
    mockDataSource.getRepository.mockReturnValue(mockActivityRepository);
    service = new ActivityDiscordSyncService();
  });

  it('returns false when database is not ready for pointer cleanup', async () => {
    mockDataSource.isInitialized = false;

    const result = await service.clearVoiceChannelPointers('activity-1', 'org-1');

    expect(result).toBe(false);
    expect(mockActivityRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('clears discordEventId pointer by setting it to null', async () => {
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.clearDiscordEventPointer('activity-1', 'org-1');

    expect(result).toBe(true);
    expect(queryBuilder.update).toHaveBeenCalled();
    expect(queryBuilder.where).toHaveBeenCalledWith('id = :activityId', {
      activityId: 'activity-1',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('organizationId = :organizationId', {
      organizationId: 'org-1',
    });
    const setPayload = queryBuilder.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof setPayload.discordEventId).toBe('function');
  });

  it('clears voiceChannelId, voiceChannelName, and voiceChannel payload pointers', async () => {
    const queryBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.clearVoiceChannelPointers('activity-1', 'org-1');

    expect(result).toBe(true);
    expect(queryBuilder.update).toHaveBeenCalled();
    expect(queryBuilder.where).toHaveBeenCalledWith('id = :activityId', {
      activityId: 'activity-1',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('organizationId = :organizationId', {
      organizationId: 'org-1',
    });
    const setPayload = queryBuilder.set.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(typeof setPayload.voiceChannelId).toBe('function');
    expect(typeof setPayload.voiceChannelName).toBe('function');
    expect(typeof setPayload.voiceChannel).toBe('function');
  });

  it('resolves voice channel info from nested voiceChannel payload when alias fields are absent', async () => {
    const queryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'activity-1',
        voiceChannel: {
          channelId: 'nested-channel-1',
          autoDelete: true,
        },
      }),
    };

    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getVoiceChannelInfo('activity-1', 'org-1');

    expect(result).toEqual({
      channelId: 'nested-channel-1',
      autoDelete: true,
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
