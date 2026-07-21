import { ActivityStatus } from '../../models/Activity';
import { createMockDataSource, createMockRepository } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
const mockActivityRepository = createMockRepository();
const mockParticipantRepository = createMockRepository();

const mockVoiceChannelServiceInstance = {
  createChannel: jest.fn(),
  getChannel: jest.fn(),
};

const mockDomainEventsEmit = jest.fn();
const mockAuditLog = jest.fn();
const mockCancelActivityReminders = jest.fn();

jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../services/communication', () => ({
  VoiceChannelService: {
    getInstance: jest.fn(() => mockVoiceChannelServiceInstance),
  },
  NotificationService: jest.fn(),
}));

jest.mock('../../services/activity/ActivityReminderService', () => ({
  ActivityReminderService: jest.fn().mockImplementation(() => ({
    cancelActivityReminders: mockCancelActivityReminders,
  })),
}));

jest.mock('../../services/shared/DomainEventBus', () => ({
  domainEvents: {
    emit: mockDomainEventsEmit,
  },
}));

jest.mock('../../services/activity/ActivityAuditLogger', () => ({
  ActivityAuditAction: {
    ACTIVITY_CANCELLED: 'ACTIVITY_CANCELLED',
    ACTIVITY_STARTED: 'ACTIVITY_STARTED',
    COMPLETION_REPORT_SUBMITTED: 'COMPLETION_REPORT_SUBMITTED',
  },
  activityAuditLogger: {
    log: mockAuditLog,
  },
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

import { ActivityEventService } from '../../services/activity/ActivityEventService';

describe('ActivityEventService cancellation orchestration', () => {
  let service: ActivityEventService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCancelActivityReminders.mockResolvedValue(0);

    mockDataSource.getRepository.mockImplementation((entity: { name?: string }) => {
      if (entity?.name === 'ActivityParticipantEntity') {
        return mockParticipantRepository;
      }
      return mockActivityRepository;
    });

    // ACT-02: applyCancellationLifecycle now re-reads the row under a pessimistic_write
    // lock via withEntityLock, which needs the entity's primary-key metadata and a
    // query-runner manager.getRepository that resolves back to the mocked Activity repo.
    (mockActivityRepository as unknown as { metadata: unknown; target: unknown }).metadata = {
      name: 'Activity',
      primaryColumns: [{ propertyName: 'id' }],
    };
    (mockActivityRepository as unknown as { target: unknown }).target = 'Activity';
    mockDataSource.createQueryRunner.mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn((entity: { name?: string }) =>
          entity?.name === 'ActivityParticipantEntity'
            ? mockParticipantRepository
            : mockActivityRepository
        ),
      },
    });

    service = new ActivityEventService();
  });

  it('cancelActivityAsSystem passes system source to lifecycle handler', async () => {
    const baseActivity = {
      id: 'activity-1',
      organizationId: 'org-1',
      creatorId: 'system-user-id',
      creatorName: 'system-user',
      title: 'Cancellation test',
      activityType: 'mission',
      status: ActivityStatus.OPEN,
      currentParticipants: 3,
    };

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(baseActivity),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const updatedActivity = {
      ...baseActivity,
      status: ActivityStatus.CANCELLED,
    };
    mockActivityRepository.save.mockResolvedValue(updatedActivity);

    const result = await service.cancelActivityAsSystem(
      'org-1',
      'activity-1',
      'system-user-id',
      'maintenance'
    );

    expect(result).toEqual(updatedActivity);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ACTIVITY_CANCELLED',
        performedById: 'system-user-id',
        details: expect.objectContaining({ source: 'system_orchestration' }),
      })
    );
    expect(mockDomainEventsEmit).toHaveBeenCalledWith('activity:cancelled', expect.any(Object));
    // Pending reminders for the cancelled activity must be cancelled so they don't
    // fire after the event is gone.
    expect(mockCancelActivityReminders).toHaveBeenCalledWith('activity-1');
  });

  it('still cancels the activity when reminder cancellation fails (best-effort)', async () => {
    const baseActivity = {
      id: 'activity-rem',
      organizationId: 'org-1',
      creatorId: 'system-user-id',
      creatorName: 'system-user',
      title: 'Reminder failure test',
      activityType: 'mission',
      status: ActivityStatus.OPEN,
      currentParticipants: 2,
    };

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(baseActivity),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const updatedActivity = { ...baseActivity, status: ActivityStatus.CANCELLED };
    mockActivityRepository.save.mockResolvedValue(updatedActivity);

    // The reminder subsystem is down — the cancellation must still succeed.
    mockCancelActivityReminders.mockRejectedValueOnce(new Error('reminders unavailable'));

    const result = await service.cancelActivityAsSystem(
      'org-1',
      'activity-rem',
      'system-user-id',
      'maintenance'
    );

    expect(result).toEqual(updatedActivity);
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ACTIVITY_CANCELLED' })
    );
    expect(mockDomainEventsEmit).toHaveBeenCalledWith('activity:cancelled', expect.any(Object));
    expect(mockCancelActivityReminders).toHaveBeenCalledWith('activity-rem');
  });

  it('cancelFromDiscordEvent returns null when no linked activity exists', async () => {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.cancelFromDiscordEvent('discord-event-1', 'deleted on discord');

    expect(result).toBeNull();
  });

  it('cancelFromDiscordEvent returns normalized cancellation summary', async () => {
    jest.useFakeTimers();
    const activity = {
      id: 'activity-2',
      organizationId: 'org-2',
      creatorId: 'creator-2',
      title: 'Discord cancellation test',
      activityType: 'mission',
      status: ActivityStatus.OPEN,
      currentParticipants: 6,
      discordEventId: 'discord-event-2',
    };

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(activity),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const cancelledAt = new Date('2026-06-03T01:00:00.000Z');
    jest.setSystemTime(cancelledAt);

    mockActivityRepository.save.mockImplementation(async input => ({
      ...(input as Record<string, unknown>),
    }));

    const result = await service.cancelFromDiscordEvent('discord-event-2', 'cancelled by discord');

    expect(result).toEqual({
      activityId: 'activity-2',
      organizationId: 'org-2',
      participantCount: 6,
      cancelledAt: cancelledAt.toISOString(),
      wasCancelled: true,
    });

    expect(mockActivityRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'activity-2',
        status: ActivityStatus.CANCELLED,
        discordEventId: undefined,
      })
    );

    jest.useRealTimers();
  });

  it('does not re-run cancellation side effects when the row is already cancelled under the lock (ACT-02)', async () => {
    // Simulate a concurrent cancellation winning the race: the caller observes the
    // activity as OPEN, but by the time the pessimistic_write lock is acquired the row
    // has already been transitioned to CANCELLED by another request. The terminal-status
    // guard must run against the locked row, so this call becomes a no-op (no second
    // save, audit log, or domain event).
    const openActivity = {
      id: 'activity-3',
      organizationId: 'org-3',
      creatorId: 'system-user',
      title: 'Concurrent cancellation test',
      activityType: 'mission',
      status: ActivityStatus.OPEN,
      currentParticipants: 2,
    };
    const alreadyCancelled = { ...openActivity, status: ActivityStatus.CANCELLED };

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce(openActivity) // caller's pre-lock load
        .mockResolvedValueOnce(alreadyCancelled), // row reloaded under the lock
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.cancelActivityAsSystem(
      'org-3',
      'activity-3',
      'system-user',
      'maintenance'
    );

    expect(result).toEqual(alreadyCancelled);
    expect(mockActivityRepository.save).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
    expect(mockDomainEventsEmit).not.toHaveBeenCalled();
    // No-op cancellation must not touch reminders either.
    expect(mockCancelActivityReminders).not.toHaveBeenCalled();
  });

  it('does not re-run start transition side effects when the row is already IN_PROGRESS under the lock (ACT-02)', async () => {
    const readyActivity = {
      id: 'activity-4',
      organizationId: 'org-4',
      creatorId: 'creator-4',
      creatorName: 'creator-4',
      title: 'Concurrent start test',
      activityType: 'mission',
      status: ActivityStatus.READY,
      currentParticipants: 4,
    };
    const alreadyStarted = { ...readyActivity, status: ActivityStatus.IN_PROGRESS };

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValueOnce(readyActivity).mockResolvedValueOnce(alreadyStarted),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.startActivity('activity-4', 'creator-4');

    expect(result).toEqual(alreadyStarted);
    expect(mockActivityRepository.save).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
    expect(mockDomainEventsEmit).not.toHaveBeenCalled();
  });

  it('does not re-run completion transition side effects when the row is already COMPLETED under the lock (ACT-02)', async () => {
    const inProgressActivity = {
      id: 'activity-5',
      organizationId: 'org-5',
      creatorId: 'creator-5',
      creatorName: 'creator-5',
      title: 'Concurrent completion test',
      activityType: 'mission',
      status: ActivityStatus.IN_PROGRESS,
      currentParticipants: 5,
      metadata: {},
    };
    const alreadyCompleted = {
      ...inProgressActivity,
      status: ActivityStatus.COMPLETED,
    };

    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValueOnce(inProgressActivity)
        .mockResolvedValueOnce(alreadyCompleted),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.submitCompletionReport(
      'activity-5',
      { notes: 'mission complete' },
      'creator-5'
    );

    expect(result).toEqual(alreadyCompleted);
    expect(mockActivityRepository.save).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
    expect(mockDomainEventsEmit).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
