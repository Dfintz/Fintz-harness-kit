/**
 * ActivityReminderService — typed error contract tests
 *
 * Locks the HTTP/error semantics of the reminder lifecycle:
 * - createReminder / createActivityReminders → ValidationError (400) / NotFoundError (404)
 * - sendReminder / cancelReminder / rescheduleReminder → NotFoundError (404) / ConflictError (409)
 *
 * createReminder is HTTP-reachable via activityController.createActivityReminder (Path-2b: the
 * controller re-throws typed ApiErrors to the global errorHandlerV2); the lifecycle methods are
 * bot-/job-reachable. All throws are now typed ApiError subclasses.
 */

jest.mock('../../../data-source', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { Activity } from '../../../models/Activity';
import {
  ActivityReminder,
  DeliveryStatus,
  ReminderChannel,
  ReminderType,
} from '../../../models/ActivityReminder';
import { ActivityReminderService } from '../../../services/activity/ActivityReminderService';

function createMockNotificationService() {
  return {
    sendMultiChannelNotification: jest.fn().mockResolvedValue([{ success: true }]),
    createEventReminderEmbed: jest.fn(),
  };
}

function createMockReminderRepository() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createMockActivityRepository() {
  return {
    findOne: jest.fn(),
  };
}

function buildActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'activity-bengal-001',
    title: 'Bengal Carrier Assault',
    scheduledStartDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    location: 'Stanton',
    description: 'Capital ship operation',
    creatorId: 'commander-alpha',
    ...overrides,
  } as Activity;
}

describe('ActivityReminderService — typed error contract', () => {
  let service: ActivityReminderService;
  let mockReminderRepo: ReturnType<typeof createMockReminderRepository>;
  let mockActivityRepo: ReturnType<typeof createMockActivityRepository>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReminderRepo = createMockReminderRepository();
    mockActivityRepo = createMockActivityRepository();
    mockNotificationService = createMockNotificationService();

    const { AppDataSource } = require('../../../data-source');
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === ActivityReminder) return mockReminderRepo;
      if (entity === Activity) return mockActivityRepo;
      return {};
    });

    service = new ActivityReminderService(mockNotificationService as never);
  });

  describe('createReminder', () => {
    it('throws ValidationError (400) when neither activityId nor eventId is provided', async () => {
      await expect(
        service.createReminder({
          reminderType: ReminderType.ONE_HOUR_BEFORE,
          channel: ReminderChannel.DISCORD,
        })
      ).rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });
      await expect(
        service.createReminder({
          reminderType: ReminderType.ONE_HOUR_BEFORE,
          channel: ReminderChannel.DISCORD,
        })
      ).rejects.toThrow('Activity ID is required (use activityId or eventId)');
    });

    it('throws NotFoundError (404) when the activity does not exist', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createReminder({
          activityId: 'missing-activity',
          reminderType: ReminderType.ONE_HOUR_BEFORE,
          channel: ReminderChannel.DISCORD,
        })
      ).rejects.toMatchObject({ name: 'NotFoundError', statusCode: 404 });
      await expect(
        service.createReminder({
          activityId: 'missing-activity',
          reminderType: ReminderType.ONE_HOUR_BEFORE,
          channel: ReminderChannel.DISCORD,
        })
      ).rejects.toThrow('Activity not found');
    });
  });

  describe('createActivityReminders', () => {
    it('throws NotFoundError (404) when the activity does not exist', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createActivityReminders(
          'missing-activity',
          [ReminderType.ONE_HOUR_BEFORE],
          ReminderChannel.DISCORD
        )
      ).rejects.toMatchObject({ name: 'NotFoundError', statusCode: 404 });
    });
  });

  describe('sendReminder', () => {
    it('throws NotFoundError (404) when the reminder activity no longer exists', async () => {
      mockActivityRepo.findOne.mockResolvedValue(null);

      const reminder = { activityId: 'missing-activity' } as ActivityReminder;

      await expect(service.sendReminder(reminder)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });
  });

  describe('cancelReminder', () => {
    it('throws NotFoundError (404) when the reminder does not exist', async () => {
      mockReminderRepo.findOne.mockResolvedValue(null);

      await expect(service.cancelReminder('missing-reminder')).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
      await expect(service.cancelReminder('missing-reminder')).rejects.toThrow(
        'Reminder not found'
      );
    });
  });

  describe('rescheduleReminder', () => {
    it('throws NotFoundError (404) when the reminder does not exist', async () => {
      mockReminderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.rescheduleReminder('missing-reminder', new Date(Date.now() + 60_000))
      ).rejects.toMatchObject({ name: 'NotFoundError', statusCode: 404 });
    });

    it('throws ConflictError (409) when the reminder is not in PENDING status', async () => {
      mockReminderRepo.findOne.mockResolvedValue({
        id: 'reminder-1',
        deliveryStatus: DeliveryStatus.SENT,
      });

      await expect(
        service.rescheduleReminder('reminder-1', new Date(Date.now() + 60_000))
      ).rejects.toMatchObject({ name: 'ConflictError', statusCode: 409 });
      await expect(
        service.rescheduleReminder('reminder-1', new Date(Date.now() + 60_000))
      ).rejects.toThrow('Can only reschedule pending reminders');
    });
  });
});
