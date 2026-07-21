import { ValidationError } from '../../utils/apiErrors';
import { ActivityEventService } from '../activity/ActivityEventService';
import { ActivityParticipantService } from '../activity/ActivityParticipantService';
import { ActivityService } from '../activity/ActivityService';
import {
  ActivityAggregatorService,
  CompleteActivityParams,
  CreateActivityWithParticipantsParams,
} from '../aggregators/ActivityAggregatorService';
import { NotificationService } from '../communication';
import { DiscordService } from '../discord/DiscordService';
import { UserService } from '../user/UserService';

// Mock all dependencies
jest.mock('../activity/ActivityService', () => ({
  ActivityService: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
  })),
}));
jest.mock('../activity/ActivityParticipantService', () => ({
  ActivityParticipantService: jest.fn().mockImplementation(() => ({
    joinActivity: jest.fn(),
    getParticipant: jest.fn(),
    updateParticipant: jest.fn(),
    getParticipants: jest.fn(),
    getParticipantCount: jest.fn(),
    update: jest.fn(),
  })),
}));
jest.mock('../activity/ActivityEventService', () => ({
  ActivityEventService: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
    cancelActivityAsSystem: jest.fn(),
    submitCompletionReport: jest.fn(),
    findAll: jest.fn(),
  })),
}));
jest.mock('../communication', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    create: jest.fn(),
  })),
}));
jest.mock('../user/UserService', () => ({
  UserService: jest.fn().mockImplementation(() => ({
    getUserById: jest.fn(),
  })),
}));

// Mock Discord service and getDiscordService function
const mockDiscordServiceInstance = {
  postMessage: jest.fn(),
  getUserRoles: jest.fn(),
  assignRole: jest.fn(),
  removeRole: jest.fn(),
  clearRoleCache: jest.fn(),
  getRoleCacheStats: jest.fn(),
} as any;

jest.mock('../discord/DiscordService', () => ({
  DiscordService: jest.fn(),
  getDiscordService: jest.fn(() => mockDiscordServiceInstance),
}));

jest.mock('../../data-source', () => ({
  AppDataSource: {
    transaction: jest.fn(callback => callback({})),
  },
}));

describe('ActivityAggregatorService', () => {
  let service: ActivityAggregatorService;
  let mockActivityService: jest.Mocked<ActivityService>;
  let mockParticipantService: jest.Mocked<ActivityParticipantService>;
  let mockEventService: jest.Mocked<ActivityEventService>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockDiscordService: jest.Mocked<DiscordService>;
  let mockUserService: jest.Mocked<UserService>;

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ActivityAggregatorService();

    // Access internal services
    mockActivityService = (service as any).activityService;
    mockParticipantService = (service as any).participantService;
    mockEventService = (service as any).eventService;
    mockNotificationService = (service as any).notificationService;
    mockDiscordService = (service as any).discordService;
    mockUserService = (service as any).userService;
  });

  describe('createActivityWithParticipants', () => {
    const mockActivity = {
      id: 'activity-123',
      title: 'Mining Operation',
      description: 'Quantainium mining in Lyria',
      activityType: 'mining',
      organizationId: 'org-456',
      creatorId: 'user-creator',
      status: 'scheduled',
      scheduledStartDate: new Date('2025-10-20T10:00:00Z'),
      createdAt: new Date(),
    };

    it('should create activity with participants and notifications successfully', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Mining Operation',
          description: 'Quantainium mining in Lyria',
          activityType: 'mining',
          scheduledStartDate: new Date('2025-10-20T10:00:00Z'),
          maxParticipants: 5,
          creatorId: 'user-creator',
        },
        participantIds: ['user-1', 'user-2', 'user-3'],
        notifyParticipants: true,
        postToDiscord: false,
      };

      const mockParticipants = [
        { id: 'participant-1', activityId: 'activity-123', userId: 'user-1', status: 'invited' },
        { id: 'participant-2', activityId: 'activity-123', userId: 'user-2', status: 'invited' },
        { id: 'participant-3', activityId: 'activity-123', userId: 'user-3', status: 'invited' },
      ];

      const mockNotifications = [
        { success: true, channel: 'in-app', recipientCount: 1 },
        { success: true, channel: 'in-app', recipientCount: 1 },
        { success: true, channel: 'in-app', recipientCount: 1 },
      ];

      mockActivityService.create = jest.fn().mockResolvedValue(mockActivity);
      mockParticipantService.joinActivity = jest
        .fn()
        .mockResolvedValue({ activity: mockActivity, wasUpdate: false } as any);
      mockParticipantService.getParticipant = jest.fn().mockImplementation(async (_id, userId) => {
        const found = mockParticipants.find(participant => participant.userId === userId);
        return (found ?? null) as any;
      });
      mockUserService.getUserById = jest.fn().mockImplementation(async userId => ({
        id: userId,
        username: userId,
        email: `${userId}@test.com`,
      }));
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValueOnce(mockNotifications[0])
        .mockResolvedValueOnce(mockNotifications[1])
        .mockResolvedValueOnce(mockNotifications[2]);

      // Act
      const result = await service.createActivityWithParticipants(params);

      // Assert
      expect(result).toBeDefined();
      expect(result.activity).toEqual(mockActivity);
      expect(result.participants).toHaveLength(3);
      expect(result.notifications).toHaveLength(3);
      expect(result.warnings).toHaveLength(0);
      expect(mockActivityService.create).toHaveBeenCalledWith(
        'org-456',
        expect.objectContaining({
          ...params.activityData,
          organizationId: 'org-456',
        })
      );
      expect(mockParticipantService.joinActivity).toHaveBeenCalledTimes(3);
      expect(mockParticipantService.getParticipant).toHaveBeenCalledTimes(3);
      expect(mockEventService.create).toHaveBeenCalledWith(
        'org-456',
        expect.objectContaining({
          activity: expect.objectContaining({ id: 'activity-123' }),
          eventType: 'created',
        })
      );
      expect(mockNotificationService.create).toHaveBeenCalledTimes(3);
    });

    it('should create activity without participants', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Solo Exploration',
          activityType: 'exploration',
          scheduledStartDate: new Date('2025-10-20T10:00:00Z'),
          creatorId: 'user-creator',
        },
        participantIds: [],
        notifyParticipants: false,
        postToDiscord: false,
      };

      mockActivityService.create = jest.fn().mockResolvedValue(mockActivity);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockNotificationService.create = jest.fn(); // Define even though not called

      // Act
      const result = await service.createActivityWithParticipants(params);

      // Assert
      expect(result.activity).toEqual(mockActivity);
      expect(result.participants).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
      expect(mockParticipantService.joinActivity).not.toHaveBeenCalled();
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('should add warning when participant notification result is unsuccessful', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Notification warning test',
          activityType: 'mission',
          scheduledStartDate: new Date('2025-10-20T10:00:00Z'),
          creatorId: 'user-creator',
        },
        participantIds: ['user-1', 'user-2'],
        notifyParticipants: true,
      };

      mockActivityService.create = jest.fn().mockResolvedValue(mockActivity);
      mockUserService.getUserById = jest.fn().mockImplementation(async userId => ({
        id: userId,
        username: userId,
        email: `${userId}@test.com`,
      }));
      mockParticipantService.joinActivity = jest
        .fn()
        .mockResolvedValue({ activity: mockActivity, wasUpdate: false } as any);
      mockParticipantService.getParticipant = jest
        .fn()
        .mockImplementation(
          async (_activityId, userId) => ({ id: `participant-${userId}`, userId }) as any
        );
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' } as any);
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValueOnce({ success: true, channel: 'in-app', recipientCount: 1 } as any)
        .mockResolvedValueOnce({
          success: false,
          channel: 'in-app',
          recipientCount: 0,
          error: 'Queue unavailable',
        } as any);

      // Act
      const result = await service.createActivityWithParticipants(params);

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'PARTICIPANT_NOTIFICATION_PARTIAL_FAILURE',
            stage: 'notification',
          }),
        ])
      );
    });

    it('should continue activity creation when participant join fails validation', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Participant warning test',
          activityType: 'mission',
          scheduledStartDate: new Date('2025-10-20T10:00:00Z'),
          creatorId: 'user-creator',
        },
        participantIds: ['user-1', 'user-2'],
        notifyParticipants: false,
      };

      mockActivityService.create = jest.fn().mockResolvedValue(mockActivity);
      mockUserService.getUserById = jest.fn().mockImplementation(async userId => ({
        id: userId,
        username: userId,
        email: `${userId}@test.com`,
      }));
      mockParticipantService.joinActivity = jest
        .fn()
        .mockResolvedValueOnce({ activity: mockActivity, wasUpdate: false } as any)
        .mockRejectedValueOnce(new ValidationError('Activity has reached maximum participants'));
      mockParticipantService.getParticipant = jest
        .fn()
        .mockResolvedValueOnce({ id: 'participant-user-1', userId: 'user-1' } as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' } as any);

      // Act
      const result = await service.createActivityWithParticipants(params);

      // Assert
      expect(result.activity).toBeDefined();
      expect(result.participants).toHaveLength(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'PARTICIPANT_JOIN_FAILED',
            stage: 'participant',
          }),
        ])
      );
    });

    it('should post to Discord when requested', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Mining Operation',
          description: 'Quantainium mining',
          activityType: 'mining',
          scheduledStartDate: new Date('2025-10-20T10:00:00Z'),
          creatorId: 'user-creator',
        },
        participantIds: ['user-1'],
        postToDiscord: true,
        discordChannelId: 'channel-123',
      };

      mockActivityService.create = jest.fn().mockResolvedValue(mockActivity);
      mockParticipantService.joinActivity = jest
        .fn()
        .mockResolvedValue({ activity: mockActivity, wasUpdate: false } as any);
      mockParticipantService.getParticipant = jest
        .fn()
        .mockResolvedValue({ id: 'participant-1', userId: 'user-1' } as any);
      mockUserService.getUserById = jest
        .fn()
        .mockResolvedValue({ id: 'user-1', username: 'testuser', email: 'test@test.com' });
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockDiscordService.sendMessage = jest.fn().mockResolvedValue(undefined);

      // Act
      await service.createActivityWithParticipants(params);

      // Assert
      expect(mockDiscordService.sendMessage).toHaveBeenCalledWith(
        'channel-123',
        expect.stringContaining('Mining Operation')
      );
    });

    it('should handle notification failures gracefully', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Test Activity',
          activityType: 'test',
          scheduledStartDate: new Date(),
          creatorId: 'user-creator',
        },
        participantIds: ['user-1', 'user-2'],
        notifyParticipants: true,
      };

      mockActivityService.create = jest.fn().mockResolvedValue(mockActivity);
      mockUserService.getUserById = jest.fn().mockImplementation(async userId => ({
        id: userId,
        username: userId,
        email: `${userId}@test.com`,
      }));
      mockParticipantService.joinActivity = jest
        .fn()
        .mockResolvedValue({ activity: mockActivity, wasUpdate: false } as any);
      mockParticipantService.getParticipant = jest
        .fn()
        .mockImplementation(async (_activityId, userId) => ({
          id: `participant-${userId}`,
          activityId: 'activity-123',
          userId,
          status: 'invited',
        }));
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValueOnce({ success: true, channel: 'in-app', recipientCount: 1 })
        .mockRejectedValueOnce(new Error('Notification failed'));

      // Act
      const result = await service.createActivityWithParticipants(params);

      // Assert - should complete despite notification failure
      expect(result.activity).toEqual(mockActivity);
      expect(result.participants).toHaveLength(2);
      expect(result.notifications).toHaveLength(1); // Only one succeeded
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'PARTICIPANT_NOTIFICATION_PARTIAL_FAILURE',
            stage: 'notification',
          }),
        ])
      );
    });

    it('should rollback on activity creation failure', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Failing Activity',
          activityType: 'test',
          scheduledStartDate: new Date(),
          creatorId: 'user-creator',
        },
      };

      mockActivityService.create = jest.fn().mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(service.createActivityWithParticipants(params)).rejects.toThrow(
        'Database error'
      );
      expect(mockParticipantService.joinActivity).not.toHaveBeenCalled();
      expect(mockEventService.create).not.toHaveBeenCalled();
    });
  });

  describe('completeActivity', () => {
    const mockActivity = {
      id: 'activity-123',
      title: 'Mining Operation',
      status: 'completed',
      completedAt: new Date(),
      outcome: 'success',
    };

    it('should complete activity with attendance tracking', async () => {
      // Arrange
      const params: CompleteActivityParams = {
        organizationId: 'org-456',
        activityId: 'activity-123',
        completedById: 'user-leader',
        outcome: 'success',
        summary: 'Successful mining operation, 50 SCU collected',
        participantReports: [
          { userId: 'user-1', attended: true, contribution: 'Excellent mining' },
          { userId: 'user-2', attended: true, contribution: 'Good escort duty' },
          { userId: 'user-3', attended: false },
        ],
        notifyParticipants: true,
      };

      const mockUpdatedParticipants = [
        {
          id: 'participant-1',
          activityId: 'activity-123',
          userId: 'user-1',
          notes: '[attendance:true] Excellent mining',
        },
        {
          id: 'participant-2',
          activityId: 'activity-123',
          userId: 'user-2',
          notes: '[attendance:true] Good escort duty',
        },
        {
          id: 'participant-3',
          activityId: 'activity-123',
          userId: 'user-3',
          notes: '[attendance:false]',
        },
      ];

      mockActivityService.update = jest.fn().mockResolvedValue(mockActivity);
      mockParticipantService.updateParticipant = jest.fn().mockResolvedValue(1);
      mockParticipantService.getParticipants = jest
        .fn()
        .mockResolvedValue(mockUpdatedParticipants as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValue({ success: true, channel: 'in-app', recipientCount: 1 });

      // Act
      const result = await service.completeActivity(params);

      // Assert
      expect(result.activity).toEqual(mockActivity);
      expect(result.updatedParticipants).toHaveLength(3);
      expect(result.notifications).toHaveLength(3);
      expect(result.warnings).toHaveLength(0);
      expect(mockActivityService.update).toHaveBeenCalledWith(
        'org-456',
        'activity-123',
        expect.objectContaining({
          status: 'completed',
          outcome: 'success',
          summary: params.summary,
        })
      );
      expect(mockParticipantService.updateParticipant).toHaveBeenCalledTimes(3);
      expect(mockEventService.create).toHaveBeenCalledWith(
        'org-456',
        expect.objectContaining({
          eventType: 'completed',
        })
      );
    });

    it('should complete activity without attendance reports', async () => {
      // Arrange
      const params: CompleteActivityParams = {
        organizationId: 'org-456',
        activityId: 'activity-123',
        completedById: 'user-leader',
        outcome: 'success',
        notifyParticipants: false,
      };

      mockActivityService.update = jest.fn().mockResolvedValue(mockActivity);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockNotificationService.create = jest.fn(); // Define even though not called

      // Act
      const result = await service.completeActivity(params);

      // Assert
      expect(result.activity).toEqual(mockActivity);
      expect(result.updatedParticipants).toHaveLength(0);
      expect(result.notifications).toHaveLength(0);
      expect(mockParticipantService.update).not.toHaveBeenCalled();
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('should add completion warning when notification dispatch is partially unsuccessful', async () => {
      // Arrange
      const params: CompleteActivityParams = {
        organizationId: 'org-456',
        activityId: 'activity-123',
        completedById: 'user-leader',
        outcome: 'success',
        notifyParticipants: true,
      };

      mockActivityService.update = jest
        .fn()
        .mockResolvedValue({ ...mockActivity, title: 'Mining Operation' } as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' } as any);
      mockParticipantService.getParticipants = jest
        .fn()
        .mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }] as any);
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValueOnce({ success: true, channel: 'in-app', recipientCount: 1 } as any)
        .mockResolvedValueOnce({
          success: false,
          channel: 'in-app',
          recipientCount: 0,
          error: 'Notification worker down',
        } as any);

      // Act
      const result = await service.completeActivity(params);

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'COMPLETION_NOTIFICATION_PARTIAL_FAILURE',
            stage: 'notification',
          }),
        ])
      );
    });

    it('should handle failed outcome', async () => {
      // Arrange
      const params: CompleteActivityParams = {
        organizationId: 'org-456',
        activityId: 'activity-123',
        completedById: 'user-leader',
        outcome: 'failed',
        summary: 'Cargo destroyed by pirates',
        notifyParticipants: false,
      };

      const failedActivity = {
        ...mockActivity,
        outcome: 'failed',
      };

      mockActivityService.update = jest.fn().mockResolvedValue(failedActivity);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });

      // Act
      const result = await service.completeActivity(params);

      // Assert
      expect(result.activity.outcome).toBe('failed');
      expect(mockActivityService.update).toHaveBeenCalledWith(
        'org-456',
        'activity-123',
        expect.objectContaining({ outcome: 'failed' })
      );
    });

    it('should throw error when activity not found', async () => {
      // Arrange
      const params: CompleteActivityParams = {
        organizationId: 'org-456',
        activityId: 'nonexistent',
        completedById: 'user-leader',
      };

      mockActivityService.update = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.completeActivity(params)).rejects.toThrow('Activity not found');
    });

    it('should handle notification failures during completion', async () => {
      // Arrange
      const params: CompleteActivityParams = {
        organizationId: 'org-456',
        activityId: 'activity-123',
        completedById: 'user-leader',
        notifyParticipants: true,
      };

      mockActivityService.update = jest.fn().mockResolvedValue(mockActivity);
      mockParticipantService.getParticipants = jest.fn().mockResolvedValue([
        { id: 'p-1', userId: 'user-1' },
        { id: 'p-2', userId: 'user-2' },
      ] as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValueOnce({ success: true, channel: 'in-app', recipientCount: 1 })
        .mockRejectedValueOnce(new Error('Notification failed'));

      // Act
      const result = await service.completeActivity(params);

      // Assert - should complete despite notification failure
      expect(result.activity).toEqual(mockActivity);
      expect(result.notifications).toHaveLength(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'COMPLETION_NOTIFICATION_PARTIAL_FAILURE',
            stage: 'notification',
          }),
        ])
      );
    });
  });

  describe('cancelActivity', () => {
    const mockActivity = {
      id: 'activity-123',
      title: 'Mining Operation',
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: 'Bad weather',
    };

    it('should cancel activity and notify participants', async () => {
      // Arrange
      const mockParticipants = [
        { id: 'p-1', userId: 'user-1', status: 'confirmed' },
        { id: 'p-2', userId: 'user-2', status: 'invited' },
      ];

      mockEventService.cancelActivityAsSystem = jest.fn().mockResolvedValue(mockActivity as any);
      mockParticipantService.getParticipants = jest.fn().mockResolvedValue(mockParticipants as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValue({ success: true, channel: 'in-app', recipientCount: 1 });

      // Act
      const result = await service.cancelActivity(
        'org-456',
        'activity-123',
        'user-leader',
        'Bad weather',
        true
      );

      // Assert
      expect(result.activity).toEqual(mockActivity);
      expect(result.notifications).toHaveLength(2);
      expect(mockEventService.cancelActivityAsSystem).toHaveBeenCalledWith(
        'org-456',
        'activity-123',
        'user-leader',
        'Bad weather'
      );
      expect(mockEventService.create).toHaveBeenCalledWith(
        'org-456',
        expect.objectContaining({
          eventType: 'cancelled',
        })
      );
      expect(result.warnings).toHaveLength(0);
    });

    it('should cancel activity without notifications', async () => {
      // Arrange
      mockEventService.cancelActivityAsSystem = jest.fn().mockResolvedValue(mockActivity as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' } as any);
      mockNotificationService.create = jest.fn(); // Define even though not called

      // Act
      const result = await service.cancelActivity(
        'org-456',
        'activity-123',
        'user-leader',
        undefined,
        false
      );

      // Assert
      expect(result.activity).toEqual(mockActivity);
      expect(result.notifications).toHaveLength(0);
      expect(mockNotificationService.create).not.toHaveBeenCalled();
    });

    it('should add cancellation warning when notification dispatch partially fails', async () => {
      // Arrange
      const cancelledActivity = {
        ...mockActivity,
        organizationId: 'org-456',
      };

      mockEventService.cancelActivityAsSystem = jest
        .fn()
        .mockResolvedValue(cancelledActivity as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' } as any);
      mockParticipantService.getParticipants = jest
        .fn()
        .mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }] as any);
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValueOnce({ success: true, channel: 'in-app', recipientCount: 1 } as any)
        .mockRejectedValueOnce(new Error('Queue timeout'));

      // Act
      const result = await service.cancelActivity(
        'org-456',
        'activity-123',
        'user-leader',
        'Test cancellation',
        true
      );

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'CANCELLATION_NOTIFICATION_PARTIAL_FAILURE',
            stage: 'notification',
          }),
        ])
      );
    });

    it('should throw error when activity not found during cancellation', async () => {
      // Arrange
      mockEventService.cancelActivityAsSystem = jest
        .fn()
        .mockRejectedValue(new Error('Activity not found'));

      // Act & Assert
      await expect(service.cancelActivity('org-456', 'nonexistent', 'user-leader')).rejects.toThrow(
        'Activity not found'
      );
    });

    it('should handle notification failures during cancellation', async () => {
      // Arrange
      mockEventService.cancelActivityAsSystem = jest.fn().mockResolvedValue(mockActivity as any);
      mockParticipantService.getParticipants = jest.fn().mockResolvedValue([
        { id: 'p-1', userId: 'user-1' },
        { id: 'p-2', userId: 'user-2' },
      ] as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValueOnce({ success: true, channel: 'in-app', recipientCount: 1 })
        .mockRejectedValueOnce(new Error('Notification failed'));

      // Act
      const result = await service.cancelActivity(
        'org-456',
        'activity-123',
        'user-leader',
        'Test cancellation',
        true
      );

      // Assert
      expect(result.notifications).toHaveLength(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'CANCELLATION_NOTIFICATION_PARTIAL_FAILURE',
            stage: 'notification',
          }),
        ])
      );
    });
  });

  describe('completePersonalActivity', () => {
    it('completes personal activity before attendance updates and notifications', async () => {
      const personalActivity = {
        id: 'activity-personal-1',
        title: 'Personal Mission',
        currentParticipants: 2,
      } as any;

      const completedActivity = {
        ...personalActivity,
        status: 'completed',
      } as any;

      const participantRows = [
        { userId: 'user-1', notes: '[attendance:true] Good run' },
        { userId: 'user-2', notes: '[attendance:false]' },
      ] as any;

      mockEventService.submitCompletionReport = jest.fn().mockResolvedValue(completedActivity);
      mockParticipantService.updateParticipant = jest.fn().mockResolvedValue(1);
      mockParticipantService.getParticipants = jest
        .fn()
        .mockResolvedValueOnce(participantRows)
        .mockResolvedValueOnce(participantRows);
      mockNotificationService.create = jest
        .fn()
        .mockResolvedValue({ success: true, channel: 'in-app', recipientCount: 1 });

      const result = await service.completePersonalActivity({
        activity: personalActivity,
        completedById: 'user-1',
        outcome: 'success',
        summary: 'Done',
        participantReports: [
          { userId: 'user-1', attended: true, contribution: 'Good run' },
          { userId: 'user-2', attended: false },
        ],
        notifyParticipants: true,
      });

      expect(result.activity).toEqual(completedActivity);
      expect(result.updatedParticipants).toHaveLength(2);
      expect(result.notifications).toHaveLength(2);
      expect(result.warnings).toHaveLength(0);

      const completionWriteOrder =
        mockEventService.submitCompletionReport.mock.invocationCallOrder[0];
      const attendanceWriteOrder =
        mockParticipantService.updateParticipant.mock.invocationCallOrder[0];
      expect(completionWriteOrder).toBeLessThan(attendanceWriteOrder);
    });

    it('adds warning when personal attendance updates partially fail', async () => {
      const personalActivity = {
        id: 'activity-personal-2',
        title: 'Personal Mission Partial',
        currentParticipants: 1,
      } as any;

      mockEventService.submitCompletionReport = jest.fn().mockResolvedValue({
        ...personalActivity,
        status: 'completed',
      } as any);
      mockParticipantService.updateParticipant = jest.fn().mockResolvedValue(0);
      mockParticipantService.getParticipants = jest.fn().mockResolvedValue([] as any);

      const result = await service.completePersonalActivity({
        activity: personalActivity,
        completedById: 'user-1',
        participantReports: [{ userId: 'user-2', attended: false }],
        notifyParticipants: false,
      });

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'ATTENDANCE_PARTIAL_FAILURE',
            stage: 'attendance',
          }),
        ])
      );
      expect(result.notifications).toHaveLength(0);
    });
  });

  describe('getActivityWithDetails', () => {
    it('should return activity with full details and stats', async () => {
      // Arrange
      const mockActivity = {
        id: 'activity-123',
        title: 'Mining Operation',
        status: 'completed',
      };

      const mockParticipants = [
        { id: 'p-1', userId: 'user-1', status: 'accepted', notes: '[attendance:true] Great run' },
        { id: 'p-2', userId: 'user-2', status: 'accepted', notes: '[attendance:true] Escort duty' },
        { id: 'p-3', userId: 'user-3', status: 'accepted', notes: '[attendance:false] No-show' },
        { id: 'p-4', userId: 'user-4', status: 'invited' },
      ];

      const mockEvents = [
        { id: 'e-1', eventType: 'created' },
        { id: 'e-2', eventType: 'completed' },
      ];

      mockActivityService.findById = jest.fn().mockResolvedValue(mockActivity);
      mockParticipantService.getParticipantCount = jest
        .fn()
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(3);
      mockParticipantService.getParticipants = jest.fn().mockResolvedValue(mockParticipants as any);
      mockEventService.findAll = jest.fn().mockResolvedValue(mockEvents);

      // Act
      const result = await service.getActivityWithDetails('org-456', 'activity-123');

      // Assert
      expect(result.activity).toEqual(mockActivity);
      expect(result.participants).toHaveLength(4);
      expect(result.events).toHaveLength(2);
      expect(result.stats).toEqual({
        totalParticipants: 4,
        confirmedParticipants: 3,
        attendedParticipants: 2,
        completionRate: 75,
      });
    });

    it('should calculate stats with zero participants', async () => {
      // Arrange
      const mockActivity = {
        id: 'activity-123',
        title: 'Solo Mission',
      };

      mockActivityService.findById = jest.fn().mockResolvedValue(mockActivity);
      mockParticipantService.getParticipantCount = jest
        .fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockParticipantService.getParticipants = jest.fn().mockResolvedValue([] as any);
      mockEventService.findAll = jest.fn().mockResolvedValue([]);

      // Act
      const result = await service.getActivityWithDetails('org-456', 'activity-123');

      // Assert
      expect(result.stats).toEqual({
        totalParticipants: 0,
        confirmedParticipants: 0,
        attendedParticipants: 0,
        completionRate: 0,
      });
    });

    it('should throw error when activity not found', async () => {
      // Arrange
      mockActivityService.findById = jest.fn().mockResolvedValue(null);

      // Act & Assert
      await expect(service.getActivityWithDetails('org-456', 'nonexistent')).rejects.toThrow(
        'Activity not found'
      );
    });
  });

  describe('Best-Effort Safety', () => {
    it('should return warnings when participant joins fail after activity creation', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Test',
          activityType: 'test',
          scheduledStartDate: new Date(),
          creatorId: 'user-1',
        },
        participantIds: ['user-1', 'user-2'],
      };

      mockActivityService.create = jest.fn().mockResolvedValue({ id: 'activity-123' });
      mockParticipantService.joinActivity = jest
        .fn()
        .mockResolvedValueOnce({ activity: { id: 'activity-123' }, wasUpdate: false } as any)
        .mockRejectedValueOnce(new Error('Database constraint violation'));
      mockUserService.getUserById = jest.fn().mockImplementation(async userId => ({
        id: userId,
        username: 'testuser',
        email: 'test@test.com',
      }));
      mockParticipantService.getParticipant = jest
        .fn()
        .mockResolvedValue({ id: 'p-1', userId: 'user-1' } as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' } as any);

      // Act
      const result = await service.createActivityWithParticipants(params);

      // Assert
      expect(result.activity).toBeDefined();
      expect(result.participants).toHaveLength(1);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'PARTICIPANT_JOIN_FAILED',
            stage: 'participant',
          }),
        ])
      );
      expect(mockActivityService.create).toHaveBeenCalled();
      expect(mockParticipantService.joinActivity).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty participant list', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Empty Test',
          activityType: 'test',
          scheduledStartDate: new Date(),
          creatorId: 'user-1',
        },
        participantIds: [],
      };

      mockActivityService.create = jest.fn().mockResolvedValue({ id: 'activity-123' });
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });

      // Act
      const result = await service.createActivityWithParticipants(params);

      // Assert
      expect(result.participants).toHaveLength(0);
      expect(mockParticipantService.joinActivity).not.toHaveBeenCalled();
    });

    it('should handle Discord service failure gracefully', async () => {
      // Arrange
      const params: CreateActivityWithParticipantsParams = {
        organizationId: 'org-456',
        activityData: {
          title: 'Test',
          activityType: 'test',
          scheduledStartDate: new Date(),
          creatorId: 'user-1',
        },
        postToDiscord: true,
        discordChannelId: 'channel-123',
      };

      mockActivityService.create = jest.fn().mockResolvedValue({ id: 'activity-123' });
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });
      mockDiscordService.sendMessage = jest.fn().mockRejectedValue(new Error('Discord API error'));

      // Act
      const result = await service.createActivityWithParticipants(params);

      // Assert - should complete despite Discord failure
      expect(result.activity).toBeDefined();
      expect(result.discordMessage).toBeUndefined();
    });

    it('should handle completion with partial participant updates', async () => {
      // Arrange
      const params: CompleteActivityParams = {
        organizationId: 'org-456',
        activityId: 'activity-123',
        completedById: 'user-leader',
        participantReports: [{ userId: 'user-1', attended: true }],
      };

      mockActivityService.update = jest
        .fn()
        .mockResolvedValue({ id: 'activity-123', status: 'completed' });
      mockParticipantService.updateParticipant = jest.fn().mockResolvedValue(1);
      mockParticipantService.getParticipants = jest.fn().mockResolvedValue([] as any);
      mockEventService.create = jest.fn().mockResolvedValue({ id: 'event-1' });

      // Act
      const result = await service.completeActivity(params);

      // Assert - should complete even if participant not found
      expect(result.activity).toBeDefined();
      expect(result.updatedParticipants).toHaveLength(0);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
