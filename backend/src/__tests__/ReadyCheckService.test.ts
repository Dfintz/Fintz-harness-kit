import { ChannelType } from 'discord.js';

import { BotClientManager } from '../bot/BotClientManager';
import { Activity, ActivityStatus, ActivityType } from '../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../models/ActivityParticipant';
import { User } from '../models/User';
import { ReadyCheckService } from '../services/activity/ReadyCheckService';
import { discordSettingsService } from '../services/discord/DiscordSettingsService';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';
import { redisClient } from '../utils/redis';

jest.mock('../services/communication/notifications/NotificationPreferencesService', () => {
  const __mockShouldDeliver = jest.fn();
  return {
    NotificationPreferencesService: jest.fn().mockImplementation(() => ({
      shouldDeliver: __mockShouldDeliver,
    })),
    __mockShouldDeliver,
  };
});

jest.mock('../services/communication/notifications/NotificationRouter', () => {
  const __mockNotifyUser = jest.fn().mockResolvedValue(undefined);
  return {
    NotificationContext: {
      READY_CHECK_INITIATED: 'READY_CHECK_INITIATED',
    },
    NotificationRouter: jest.fn().mockImplementation(() => ({
      notifyUser: __mockNotifyUser,
    })),
    __mockNotifyUser,
  };
});

jest.mock('../services/discord/DiscordSettingsService', () => ({
  discordSettingsService: {
    getOrganizationSettings: jest.fn(),
  },
}));

// Mock dependencies
jest.mock('../utils/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../websocket/controllers/activityWebSocketController', () => ({
  emitReadyCheckInitiated: jest.fn(),
  emitReadyCheckResponse: jest.fn(),
  emitReadyCheckCompleted: jest.fn(),
  emitReadyCheckExpired: jest.fn(),
  emitReadyCheckCancelled: jest.fn(),
}));

jest.mock('../services/activity/ActivityAuditLogger', () => ({
  ActivityAuditAction: {
    READY_CHECK_INITIATED: 'READY_CHECK_INITIATED',
    READY_CHECK_RESPONDED: 'READY_CHECK_RESPONDED',
    READY_CHECK_COMPLETED: 'READY_CHECK_COMPLETED',
    READY_CHECK_EXPIRED: 'READY_CHECK_EXPIRED',
    READY_CHECK_CANCELLED: 'READY_CHECK_CANCELLED',
  },
  activityAuditLogger: {
    log: jest.fn(),
  },
}));

jest.mock('../bot/BotClientManager', () => ({
  BotClientManager: {
    getInstance: jest.fn(() => ({
      isReady: jest.fn(() => false),
      getClient: jest.fn(() => null),
    })),
  },
}));

const mockActivityRepo = {
  findOne: jest.fn(),
};

const mockParticipantRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  count: jest.fn(),
};

const mockUserQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};

const mockUserRepo = {
  createQueryBuilder: jest.fn(() => mockUserQueryBuilder),
};

jest.mock('../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Activity) return mockActivityRepo;
      if (entity === ActivityParticipantEntity) return mockParticipantRepo;
      if (entity === User) return mockUserRepo;
      return {};
    }),
  },
}));

const notificationPreferencesModule = jest.requireMock(
  '../services/communication/notifications/NotificationPreferencesService'
) as {
  __mockShouldDeliver: jest.Mock;
};

const notificationRouterModule = jest.requireMock(
  '../services/communication/notifications/NotificationRouter'
) as {
  __mockNotifyUser: jest.Mock;
};

describe('ReadyCheckService', () => {
  let service: ReadyCheckService;

  const mockActivity: Partial<Activity> = {
    id: 'activity-1',
    title: 'Test Operation',
    activityType: 'operation' as ActivityType,
    status: ActivityStatus.OPEN,
    organizationId: 'org-1',
    creatorId: 'user-leader',
  };

  const mockParticipants: Partial<ActivityParticipantEntity>[] = [
    {
      userId: 'user-leader',
      userName: 'LeaderUser',
      activityId: 'activity-1',
      status: ActivityParticipantStatus.ACCEPTED,
      role: 'leader' as never,
    },
    {
      userId: 'user-pilot',
      userName: 'PilotUser',
      activityId: 'activity-1',
      status: ActivityParticipantStatus.ACCEPTED,
      role: 'pilot' as never,
    },
    {
      userId: 'user-gunner',
      userName: 'GunnerUser',
      activityId: 'activity-1',
      status: ActivityParticipantStatus.ACCEPTED,
      role: 'gunner' as never,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    service = new ReadyCheckService();
    notificationPreferencesModule.__mockShouldDeliver.mockResolvedValue(true);
    notificationRouterModule.__mockNotifyUser.mockResolvedValue(undefined);
    (discordSettingsService.getOrganizationSettings as jest.Mock).mockResolvedValue([]);
    mockUserQueryBuilder.getMany.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('initiateReadyCheck', () => {
    it('should create a ready check with valid data', async () => {
      mockActivityRepo.findOne.mockResolvedValue(mockActivity);
      mockParticipantRepo.findOne.mockResolvedValue({ role: 'leader' });
      mockParticipantRepo.find.mockResolvedValue(mockParticipants);
      (redisClient.get as jest.Mock).mockResolvedValue(null); // No existing check
      (redisClient.set as jest.Mock).mockResolvedValue(true);

      const result = await service.initiateReadyCheck(
        'activity-1',
        'org-1',
        'user-leader',
        'LeaderUser',
        120
      );

      expect(result).toBeDefined();
      expect(result.activityId).toBe('activity-1');
      expect(result.status).toBe('pending');
      expect(result.totalParticipants).toBe(3);
      expect(result.durationSeconds).toBe(120);
      expect(Object.keys(result.responses)).toHaveLength(3);
      expect(result.responses['user-leader'].response).toBe('pending');
      expect(result.responses['user-pilot'].response).toBe('pending');
    });

    it('should throw ValidationError for invalid duration', async () => {
      await expect(
        service.initiateReadyCheck('activity-1', 'org-1', 'user-leader', 'LeaderUser', 10)
      ).rejects.toThrow(ValidationError);
    });

    it('should throw NotFoundError for non-existent activity', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      await expect(
        service.initiateReadyCheck('activity-999', 'org-1', 'user-leader', 'LeaderUser')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for non-leader user', async () => {
      mockActivityRepo.findOne.mockResolvedValue({ ...mockActivity, creatorId: 'other-user' });
      mockParticipantRepo.findOne.mockResolvedValue({ role: 'member' });

      await expect(
        service.initiateReadyCheck('activity-1', 'org-1', 'user-random', 'RandomUser')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError for invalid activity status', async () => {
      mockActivityRepo.findOne.mockResolvedValue({
        ...mockActivity,
        status: ActivityStatus.COMPLETED,
      });
      mockParticipantRepo.findOne.mockResolvedValue({ role: 'leader' });

      await expect(
        service.initiateReadyCheck('activity-1', 'org-1', 'user-leader', 'LeaderUser')
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError if ready check already active', async () => {
      mockActivityRepo.findOne.mockResolvedValue(mockActivity);
      mockParticipantRepo.findOne.mockResolvedValue({ role: 'leader' });
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('existing-check-id')
        .mockResolvedValueOnce({
          id: 'existing-check-id',
          status: 'pending',
          expiresAt: new Date(Date.now() + 60000).toISOString(),
          responses: {},
        });

      await expect(
        service.initiateReadyCheck('activity-1', 'org-1', 'user-leader', 'LeaderUser')
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ValidationError with fewer than 2 participants', async () => {
      mockActivityRepo.findOne.mockResolvedValue(mockActivity);
      mockParticipantRepo.findOne.mockResolvedValue({ role: 'leader' });
      mockParticipantRepo.find.mockResolvedValue([mockParticipants[0]]);
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await expect(
        service.initiateReadyCheck('activity-1', 'org-1', 'user-leader', 'LeaderUser')
      ).rejects.toThrow(ValidationError);
    });

    it('posts fallback mention once and stops after the first successful guild', async () => {
      mockUserQueryBuilder.getMany.mockResolvedValue([
        { id: 'user-pilot', discordId: 'discord-pilot' },
        { id: 'user-gunner', discordId: 'discord-gunner' },
      ]);
      (discordSettingsService.getOrganizationSettings as jest.Mock).mockResolvedValue([
        {
          guildId: 'guild-1',
          eventSettings: { eventAnnouncementChannelId: 'events-1' },
        },
        {
          guildId: 'guild-2',
          eventSettings: { eventAnnouncementChannelId: 'events-2' },
        },
      ]);

      const threadSend = jest.fn().mockResolvedValue(undefined);
      const matchingThread = {
        name: '📣 New activity: Test Operation',
        send: threadSend,
      };

      const guildOneChannel = {
        id: 'events-1',
        type: ChannelType.GuildText,
        threads: {
          fetchActive: jest.fn().mockResolvedValue({ threads: [matchingThread] }),
          fetchArchived: jest.fn().mockResolvedValue({ threads: [] }),
        },
      };

      const guildOne = {
        channels: {
          cache: {
            get: jest.fn((channelId: string) =>
              channelId === 'events-1' ? guildOneChannel : null
            ),
          },
          fetch: jest.fn().mockResolvedValue(null),
        },
      };

      const guildCacheGet = jest.fn((guildId: string) => (guildId === 'guild-1' ? guildOne : null));
      const guildFetch = jest.fn().mockResolvedValue(null);

      const fetchDiscordUser = jest.fn((discordId: string) => {
        if (discordId === 'discord-pilot') {
          return Promise.resolve({
            send: jest.fn().mockRejectedValue(new Error('Cannot DM this user')),
          });
        }
        if (discordId === 'discord-gunner') {
          return Promise.resolve({
            send: jest.fn().mockResolvedValue(undefined),
          });
        }
        return Promise.resolve({ send: jest.fn().mockResolvedValue(undefined) });
      });

      const mockClient = {
        users: { fetch: fetchDiscordUser },
        guilds: {
          cache: { get: guildCacheGet },
          fetch: guildFetch,
        },
      };

      (BotClientManager.getInstance as jest.Mock).mockReturnValue({
        isReady: jest.fn(() => true),
        getClient: jest.fn(() => mockClient),
      });

      const readyCheck = {
        id: 'check-1',
        activityId: 'activity-1',
        activityTitle: 'Test Operation',
        organizationId: 'org-1',
        initiatedBy: 'user-leader',
        initiatedByName: 'LeaderUser',
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        durationSeconds: 120,
        responses: {
          'user-leader': {
            userId: 'user-leader',
            userName: 'LeaderUser',
            response: 'pending' as const,
          },
          'user-pilot': {
            userId: 'user-pilot',
            userName: 'PilotUser',
            response: 'pending' as const,
          },
          'user-gunner': {
            userId: 'user-gunner',
            userName: 'GunnerUser',
            response: 'pending' as const,
          },
        },
        totalParticipants: 3,
        createdAt: new Date().toISOString(),
      };

      await (
        service as unknown as {
          notifyParticipantsViaDiscordWithThreadFallback: (
            check: typeof readyCheck,
            participants: ActivityParticipantEntity[]
          ) => Promise<void>;
        }
      ).notifyParticipantsViaDiscordWithThreadFallback(
        readyCheck,
        mockParticipants as ActivityParticipantEntity[]
      );

      expect(threadSend).toHaveBeenCalledWith(
        expect.objectContaining({
          allowedMentions: { users: ['discord-pilot'] },
        })
      );
      expect(guildCacheGet).toHaveBeenCalledWith('guild-1');
      expect(guildCacheGet).not.toHaveBeenCalledWith('guild-2');
    });

    it('suppresses Discord delivery when preference lookup fails', async () => {
      mockUserQueryBuilder.getMany.mockResolvedValue([
        { id: 'user-pilot', discordId: 'discord-pilot' },
        { id: 'user-gunner', discordId: 'discord-gunner' },
      ]);
      notificationPreferencesModule.__mockShouldDeliver.mockRejectedValue(
        new Error('Preference service unavailable')
      );

      const fetchDiscordUser = jest.fn();
      const mockClient = {
        users: { fetch: fetchDiscordUser },
        guilds: {
          cache: { get: jest.fn() },
          fetch: jest.fn(),
        },
      };

      (BotClientManager.getInstance as jest.Mock).mockReturnValue({
        isReady: jest.fn(() => true),
        getClient: jest.fn(() => mockClient),
      });

      const readyCheck = {
        id: 'check-1',
        activityId: 'activity-1',
        activityTitle: 'Test Operation',
        organizationId: 'org-1',
        initiatedBy: 'user-leader',
        initiatedByName: 'LeaderUser',
        status: 'pending' as const,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        durationSeconds: 120,
        responses: {
          'user-leader': {
            userId: 'user-leader',
            userName: 'LeaderUser',
            response: 'pending' as const,
          },
          'user-pilot': {
            userId: 'user-pilot',
            userName: 'PilotUser',
            response: 'pending' as const,
          },
          'user-gunner': {
            userId: 'user-gunner',
            userName: 'GunnerUser',
            response: 'pending' as const,
          },
        },
        totalParticipants: 3,
        createdAt: new Date().toISOString(),
      };

      await (
        service as unknown as {
          notifyParticipantsViaDiscordWithThreadFallback: (
            check: typeof readyCheck,
            participants: ActivityParticipantEntity[]
          ) => Promise<void>;
        }
      ).notifyParticipantsViaDiscordWithThreadFallback(
        readyCheck,
        mockParticipants as ActivityParticipantEntity[]
      );

      expect(fetchDiscordUser).not.toHaveBeenCalled();
      expect(discordSettingsService.getOrganizationSettings).not.toHaveBeenCalled();
    });
  });

  describe('respond', () => {
    const pendingReadyCheck = {
      id: 'check-1',
      activityId: 'activity-1',
      organizationId: 'org-1',
      initiatedBy: 'user-leader',
      initiatedByName: 'LeaderUser',
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      durationSeconds: 120,
      responses: {
        'user-leader': {
          userId: 'user-leader',
          userName: 'LeaderUser',
          response: 'pending' as const,
        },
        'user-pilot': { userId: 'user-pilot', userName: 'PilotUser', response: 'pending' as const },
      },
      totalParticipants: 2,
      createdAt: new Date().toISOString(),
    };

    it('should record a ready response', async () => {
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('check-1') // active check ID
        .mockResolvedValueOnce({ ...pendingReadyCheck }); // ready check state
      (redisClient.set as jest.Mock).mockResolvedValue(true);

      const result = await service.respond('activity-1', 'user-pilot', 'PilotUser', 'ready');

      expect(result.responses['user-pilot'].response).toBe('ready');
      expect(result.responses['user-pilot'].respondedAt).toBeDefined();
    });

    it('should auto-complete when all participants respond', async () => {
      const almostDoneCheck = {
        ...pendingReadyCheck,
        responses: {
          'user-leader': {
            userId: 'user-leader',
            userName: 'LeaderUser',
            response: 'ready' as const,
            respondedAt: new Date().toISOString(),
          },
          'user-pilot': {
            userId: 'user-pilot',
            userName: 'PilotUser',
            response: 'pending' as const,
          },
        },
      };

      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('check-1')
        .mockResolvedValueOnce({ ...almostDoneCheck });
      (redisClient.set as jest.Mock).mockResolvedValue(true);

      const result = await service.respond('activity-1', 'user-pilot', 'PilotUser', 'ready');

      expect(result.status).toBe('completed');
      expect(result.completedAt).toBeDefined();
    });

    it('should throw NotFoundError when no active ready check', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await expect(
        service.respond('activity-1', 'user-pilot', 'PilotUser', 'ready')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError for non-participant', async () => {
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('check-1')
        .mockResolvedValueOnce({ ...pendingReadyCheck });

      await expect(
        service.respond('activity-1', 'user-random', 'RandomUser', 'ready')
      ).rejects.toThrow(ForbiddenError);
    });

    it('should allow updating a prior response', async () => {
      const alreadyResponded = {
        ...pendingReadyCheck,
        responses: {
          ...pendingReadyCheck.responses,
          'user-pilot': {
            userId: 'user-pilot',
            userName: 'PilotUser',
            response: 'ready' as const,
            respondedAt: new Date().toISOString(),
          },
        },
      };

      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('check-1')
        .mockResolvedValueOnce(alreadyResponded);
      (redisClient.set as jest.Mock).mockResolvedValue(true);

      const result = await service.respond('activity-1', 'user-pilot', 'PilotUser', 'not_ready');

      expect(result.responses['user-pilot'].response).toBe('not_ready');
      expect(result.responses['user-pilot'].respondedAt).toBeDefined();
    });
  });

  describe('cancelReadyCheck', () => {
    const pendingReadyCheck = {
      id: 'check-1',
      activityId: 'activity-1',
      organizationId: 'org-1',
      initiatedBy: 'user-leader',
      initiatedByName: 'LeaderUser',
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      durationSeconds: 120,
      responses: {},
      totalParticipants: 2,
      createdAt: new Date().toISOString(),
    };

    it('should cancel an active ready check', async () => {
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('check-1')
        .mockResolvedValueOnce({ ...pendingReadyCheck });
      (redisClient.set as jest.Mock).mockResolvedValue(true);
      (redisClient.del as jest.Mock).mockResolvedValue(true);
      mockActivityRepo.findOne.mockResolvedValue(mockActivity);

      await service.cancelReadyCheck('activity-1', 'user-leader', 'LeaderUser');

      expect(redisClient.del).toHaveBeenCalled();
    });

    it('should throw NotFoundError when no active check', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await expect(
        service.cancelReadyCheck('activity-1', 'user-leader', 'LeaderUser')
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ForbiddenError when non-initiator cancels', async () => {
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('check-1')
        .mockResolvedValueOnce({ ...pendingReadyCheck });
      mockActivityRepo.findOne.mockResolvedValue({
        ...mockActivity,
        creatorId: 'other-user',
      });

      await expect(
        service.cancelReadyCheck('activity-1', 'user-random', 'RandomUser')
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getActiveReadyCheck', () => {
    it('should return null when no active check exists', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      const result = await service.getActiveReadyCheck('activity-1');

      expect(result).toBeNull();
    });

    it('should return the active ready check', async () => {
      const activeCheck = {
        id: 'check-1',
        activityId: 'activity-1',
        status: 'pending',
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        responses: {},
        totalParticipants: 2,
      };

      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('check-1')
        .mockResolvedValueOnce(activeCheck);

      const result = await service.getActiveReadyCheck('activity-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('check-1');
    });

    it('should clean up stale active pointer', async () => {
      (redisClient.get as jest.Mock)
        .mockResolvedValueOnce('check-stale') // Active pointer exists
        .mockResolvedValueOnce(null); // But actual check data is gone
      (redisClient.del as jest.Mock).mockResolvedValue(true);

      const result = await service.getActiveReadyCheck('activity-1');

      expect(result).toBeNull();
      expect(redisClient.del).toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
