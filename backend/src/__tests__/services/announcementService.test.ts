/**
 * AnnouncementService Tests
 *
 * These tests verify the AnnouncementService functionality with mocked TypeORM repository.
 */

// Mock modules BEFORE any imports
jest.mock('../../config/database', () => {
  const mockRepository = {
    create: jest.fn((data: Record<string, unknown>) => ({
      ...data,
      id: data.id || 'announcement-test-id',
      createdAt: new Date(),
    })),
    save: jest.fn((entity: Record<string, unknown>) => Promise.resolve(entity)),
    findOne: jest.fn(),
    find: jest.fn(() => Promise.resolve([])),
    findAndCount: jest.fn(() => Promise.resolve([[], 0])),
    delete: jest.fn(() => Promise.resolve({ affected: 1 })),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn(() => Promise.resolve([])),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      execute: jest.fn(() => Promise.resolve({ affected: 0 })),
    })),
  };

  return {
    AppDataSource: {
      getRepository: jest.fn(() => mockRepository),
      isInitialized: true,
    },
  };
});

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { AppDataSource } from '../../config/database';
import { AnnouncementStatus, AnnouncementTargetType } from '../../models/Announcement';
import { AnnouncementService } from '../../services/communication/announcement/AnnouncementService';
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../../utils/apiErrors';

describe('AnnouncementService', () => {
  let announcementService: AnnouncementService;
  let mockRepo: jest.Mocked<{
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
  }>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get fresh mock repository reference
    mockRepo = (AppDataSource.getRepository as jest.Mock)();

    // Create new instance for each test
    announcementService = new AnnouncementService();
  });

  describe('create', () => {
    it('should create a sent announcement without scheduled time', async () => {
      const createDto = {
        title: 'Test Announcement',
        content: 'This is a test announcement content',
        createdBy: 'user123',
        createdByName: 'TestUser',
      };

      const expectedAnnouncement = {
        ...createDto,
        id: 'announcement-test-id',
        organizationId: 'org123',
        status: AnnouncementStatus.SENT,
        targetType: AnnouncementTargetType.SINGLE,
        createdAt: expect.any(Date),
      };

      mockRepo.create.mockReturnValue(expectedAnnouncement);
      mockRepo.save.mockResolvedValue(expectedAnnouncement);

      const announcement = await announcementService.create('org123', createDto);

      expect(announcement).toBeDefined();
      expect(announcement.title).toBe('Test Announcement');
      expect(announcement.status).toBe(AnnouncementStatus.SENT);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should create a scheduled announcement with scheduled time', async () => {
      const scheduledAt = new Date(Date.now() + 3600000); // 1 hour from now
      const createDto = {
        title: 'Scheduled Announcement',
        content: 'This will be sent later',
        createdBy: 'user123',
        scheduledAt,
      };

      const expectedAnnouncement = {
        ...createDto,
        id: 'announcement-test-id',
        organizationId: 'org123',
        status: AnnouncementStatus.SCHEDULED,
        targetType: AnnouncementTargetType.SINGLE,
        createdAt: expect.any(Date),
      };

      mockRepo.create.mockReturnValue(expectedAnnouncement);
      mockRepo.save.mockResolvedValue(expectedAnnouncement);

      const announcement = await announcementService.create('org123', createDto);

      expect(announcement.status).toBe(AnnouncementStatus.SCHEDULED);
      expect(announcement.scheduledAt).toBe(scheduledAt);
    });

    it('should create an announcement with embed configuration', async () => {
      const createDto = {
        title: 'Styled Announcement',
        content: 'With embed styling',
        createdBy: 'user123',
        embedConfig: {
          color: '#FF5500',
          thumbnailUrl: 'https://example.com/thumb.png',
          timestamp: true,
        },
      };

      const expectedAnnouncement = {
        ...createDto,
        id: 'announcement-test-id',
        organizationId: 'org123',
        status: AnnouncementStatus.DRAFT,
        targetType: AnnouncementTargetType.SINGLE,
        createdAt: expect.any(Date),
      };

      mockRepo.create.mockReturnValue(expectedAnnouncement);
      mockRepo.save.mockResolvedValue(expectedAnnouncement);

      const announcement = await announcementService.create('org123', createDto);

      expect(announcement.embedConfig).toBeDefined();
      expect(announcement.embedConfig?.color).toBe('#FF5500');
    });
  });

  describe('getById', () => {
    it('should return null for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await announcementService.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return announcement when found', async () => {
      const announcement = {
        id: 'test-id',
        title: 'Test Announcement',
        content: 'Test content',
        organizationId: 'org123',
        createdBy: 'user123',
        status: AnnouncementStatus.DRAFT,
        targetType: AnnouncementTargetType.SINGLE,
        createdAt: new Date(),
      };
      mockRepo.findOne.mockResolvedValue(announcement);

      const result = await announcementService.getById('test-id');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-id');
    });
  });

  describe('update', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        announcementService.update('nonexistent', { title: 'New Title' })
      ).rejects.toThrow('Announcement not found');
    });

    it('should throw error when trying to update sent announcement', async () => {
      const sentAnnouncement = {
        id: 'sent-id',
        title: 'Sent Announcement',
        status: AnnouncementStatus.SENT,
      };
      mockRepo.findOne.mockResolvedValue(sentAnnouncement);

      await expect(announcementService.update('sent-id', { title: 'New Title' })).rejects.toThrow(
        'Cannot update a sent announcement'
      );
    });

    it('should update announcement fields', async () => {
      const existingAnnouncement = {
        id: 'test-id',
        title: 'Original Title',
        content: 'Original content',
        status: AnnouncementStatus.DRAFT,
        organizationId: 'org123',
        createdBy: 'user123',
      };
      mockRepo.findOne.mockResolvedValue(existingAnnouncement);
      mockRepo.save.mockResolvedValue({
        ...existingAnnouncement,
        title: 'Updated Title',
      });

      const result = await announcementService.update('test-id', {
        title: 'Updated Title',
      });

      expect(result.title).toBe('Updated Title');
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('typed error normalization', () => {
    it('update throws NotFoundError (404) for a missing announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      const error = await announcementService
        .update('nonexistent', { title: 'x' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('update throws ConflictError (409) for a sent announcement', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'sent', status: AnnouncementStatus.SENT });
      const error = await announcementService
        .update('sent', { title: 'x' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('send throws ConflictError (409) when already sent', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'sent', status: AnnouncementStatus.SENT });
      const error = await announcementService.send('sent', 'chan-1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('send throws ServiceUnavailableError (503) when the Discord client is unavailable', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'draft', status: AnnouncementStatus.DRAFT });
      const error = await announcementService.send('draft', 'chan-1').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ServiceUnavailableError);
      expect((error as ServiceUnavailableError).statusCode).toBe(503);
    });

    it('schedule throws ValidationError (400) for a past scheduled time', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'draft', status: AnnouncementStatus.DRAFT });
      const error = await announcementService
        .schedule('draft', new Date(Date.now() - 60_000))
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('cancel throws ConflictError (409) when already sent', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'sent', status: AnnouncementStatus.SENT });
      const error = await announcementService.cancel('sent').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

  describe('delete', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(announcementService.delete('nonexistent', 'user123')).rejects.toThrow(
        'Announcement not found'
      );
    });

    it('should soft delete announcement', async () => {
      const existingAnnouncement = {
        id: 'test-id',
        title: 'To Be Deleted',
        status: AnnouncementStatus.DRAFT,
      };
      mockRepo.findOne.mockResolvedValue(existingAnnouncement);
      mockRepo.save.mockResolvedValue({
        ...existingAnnouncement,
        deletedAt: expect.any(Date),
        deletedBy: 'user123',
      });

      await announcementService.delete('test-id', 'user123');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedBy: 'user123',
        })
      );
    });
  });

  describe('list', () => {
    it('should return empty list when no announcements exist', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await announcementService.list('org123');

      expect(result.announcements).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should return announcements with pagination', async () => {
      const announcements = [
        { id: '1', title: 'First', status: AnnouncementStatus.DRAFT },
        { id: '2', title: 'Second', status: AnnouncementStatus.SENT },
      ];
      mockRepo.findAndCount.mockResolvedValue([announcements, 2]);

      const result = await announcementService.list('org123', {}, 1, 10);

      expect(result.announcements).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by status', async () => {
      const draftAnnouncements = [{ id: '1', title: 'Draft 1', status: AnnouncementStatus.DRAFT }];
      mockRepo.findAndCount.mockResolvedValue([draftAnnouncements, 1]);

      const result = await announcementService.list('org123', {
        status: AnnouncementStatus.DRAFT,
      });

      expect(result.announcements).toHaveLength(1);
      expect(result.announcements[0].status).toBe(AnnouncementStatus.DRAFT);
    });
  });

  describe('preview', () => {
    it('should generate embed preview', async () => {
      const announcement = {
        id: 'test-id',
        title: 'Preview Test',
        content: 'This is preview content',
        status: AnnouncementStatus.DRAFT,
        organizationId: 'org123',
        createdBy: 'user123',
        embedConfig: {
          color: '#0099FF',
          timestamp: true,
        },
        createdAt: new Date(),
        targetType: AnnouncementTargetType.SINGLE,
        isPending: true,
        isDelivered: false,
        totalTargets: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
      } as const;

      const preview = await announcementService.preview(announcement as never);

      expect(preview.embed).toBeDefined();
      expect(preview.announcement).toBe(announcement);
    });
  });

  describe('cancel', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(announcementService.cancel('nonexistent')).rejects.toThrow(
        'Announcement not found'
      );
    });

    it('should throw error when cancelling sent announcement', async () => {
      const sentAnnouncement = {
        id: 'sent-id',
        status: AnnouncementStatus.SENT,
      };
      mockRepo.findOne.mockResolvedValue(sentAnnouncement);

      await expect(announcementService.cancel('sent-id')).rejects.toThrow(
        'Cannot cancel a sent announcement'
      );
    });

    it('should cancel scheduled announcement', async () => {
      const scheduledAnnouncement = {
        id: 'scheduled-id',
        title: 'Scheduled',
        status: AnnouncementStatus.SCHEDULED,
      };
      mockRepo.findOne.mockResolvedValue(scheduledAnnouncement);
      mockRepo.save.mockResolvedValue({
        ...scheduledAnnouncement,
        status: AnnouncementStatus.CANCELLED,
      });

      const result = await announcementService.cancel('scheduled-id');

      expect(result.status).toBe(AnnouncementStatus.CANCELLED);
    });
  });

  describe('getStats', () => {
    it('should return statistics for organization announcements', async () => {
      const announcements = [
        { status: AnnouncementStatus.DRAFT },
        { status: AnnouncementStatus.DRAFT },
        { status: AnnouncementStatus.SCHEDULED },
        { status: AnnouncementStatus.SENT },
        { status: AnnouncementStatus.FAILED },
        { status: AnnouncementStatus.CANCELLED },
      ];
      mockRepo.find.mockResolvedValue(announcements);

      const stats = await announcementService.getStats('org123');

      expect(stats.total).toBe(6);
      expect(stats.draft).toBe(2);
      expect(stats.scheduled).toBe(1);
      expect(stats.sent).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.cancelled).toBe(1);
    });
  });

  describe('getPendingDelivery', () => {
    it('should return scheduled announcements due for delivery', async () => {
      const pendingAnnouncements = [
        {
          id: 'pending-1',
          status: AnnouncementStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() - 1000), // 1 second ago
        },
      ];

      mockRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(pendingAnnouncements),
      });

      const result = await announcementService.getPendingDelivery();

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe(AnnouncementStatus.SCHEDULED);
    });
  });

  describe('send', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(announcementService.send('nonexistent', 'channel123')).rejects.toThrow(
        'Announcement not found'
      );
    });

    it('should throw error for already sent announcement', async () => {
      const sentAnnouncement = {
        id: 'sent-id',
        status: AnnouncementStatus.SENT,
      };
      mockRepo.findOne.mockResolvedValue(sentAnnouncement);

      await expect(announcementService.send('sent-id', 'channel123')).rejects.toThrow(
        'Announcement has already been sent'
      );
    });

    it('should throw error when Discord client is not configured', async () => {
      const draftAnnouncement = {
        id: 'draft-id',
        title: 'Draft',
        content: 'Content',
        status: AnnouncementStatus.DRAFT,
      };
      mockRepo.findOne.mockResolvedValue(draftAnnouncement);

      await expect(announcementService.send('draft-id', 'channel123')).rejects.toThrow(
        'Discord client not configured'
      );
    });
  });

  // ========================================
  // Phase 2: Multi-Server & Scheduling Tests
  // ========================================

  describe('sendMultiple', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        announcementService.sendMultiple('nonexistent', 'multiple', ['channel1', 'channel2'])
      ).rejects.toThrow('Announcement not found');
    });

    it('should throw error for already sent announcement', async () => {
      const sentAnnouncement = {
        id: 'sent-id',
        status: AnnouncementStatus.SENT,
      };
      mockRepo.findOne.mockResolvedValue(sentAnnouncement);

      await expect(
        announcementService.sendMultiple('sent-id', 'multiple', ['channel1'])
      ).rejects.toThrow('Announcement has already been sent');
    });

    it('should throw error when no target servers specified', async () => {
      const draftAnnouncement = {
        id: 'draft-id',
        status: AnnouncementStatus.DRAFT,
      };
      mockRepo.findOne.mockResolvedValue(draftAnnouncement);

      await expect(announcementService.sendMultiple('draft-id', 'multiple', [])).rejects.toThrow(
        'No target servers specified'
      );
    });

    it('should throw error when Discord client is not configured', async () => {
      const draftAnnouncement = {
        id: 'draft-id',
        title: 'Draft',
        content: 'Content',
        status: AnnouncementStatus.DRAFT,
      };
      mockRepo.findOne.mockResolvedValue(draftAnnouncement);

      await expect(
        announcementService.sendMultiple('draft-id', 'multiple', ['channel1', 'channel2'])
      ).rejects.toThrow('Discord client not configured');
    });
  });

  describe('schedule', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const futureDate = new Date(Date.now() + 3600000);
      await expect(announcementService.schedule('nonexistent', futureDate)).rejects.toThrow(
        'Announcement not found'
      );
    });

    it('should throw error for already sent announcement', async () => {
      const sentAnnouncement = {
        id: 'sent-id',
        status: AnnouncementStatus.SENT,
      };
      mockRepo.findOne.mockResolvedValue(sentAnnouncement);

      const futureDate = new Date(Date.now() + 3600000);
      await expect(announcementService.schedule('sent-id', futureDate)).rejects.toThrow(
        'Cannot schedule a sent announcement'
      );
    });

    it('should throw error when scheduled time is in the past', async () => {
      const draftAnnouncement = {
        id: 'draft-id',
        status: AnnouncementStatus.DRAFT,
      };
      mockRepo.findOne.mockResolvedValue(draftAnnouncement);

      const pastDate = new Date(Date.now() - 1000);
      await expect(announcementService.schedule('draft-id', pastDate)).rejects.toThrow(
        'Scheduled time must be in the future'
      );
    });

    it('should schedule announcement for future delivery', async () => {
      const draftAnnouncement = {
        id: 'draft-id',
        title: 'Draft',
        content: 'Content',
        status: AnnouncementStatus.DRAFT,
        targetType: AnnouncementTargetType.SINGLE,
      };
      mockRepo.findOne.mockResolvedValue(draftAnnouncement);
      mockRepo.save.mockResolvedValue({
        ...draftAnnouncement,
        status: AnnouncementStatus.SCHEDULED,
      });

      const futureDate = new Date(Date.now() + 3600000);
      await announcementService.schedule('draft-id', futureDate, ['channel1']);

      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(announcementService.getStatus('nonexistent')).rejects.toThrow(
        'Announcement not found'
      );
    });

    it('should return announcement status with delivery summary', async () => {
      const announcement = {
        id: 'test-id',
        title: 'Test',
        content: 'Content',
        status: AnnouncementStatus.SENT,
        organizationId: 'org123',
        createdBy: 'user123',
      };
      mockRepo.findOne.mockResolvedValue(announcement);

      const result = await announcementService.getStatus('test-id');

      expect(result.announcement).toBeDefined();
      expect(result.announcement.id).toBe('test-id');
      expect(result.deliveries).toBeDefined();
      expect(result.summary).toBeDefined();
    });
  });

  describe('cancelScheduled', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(announcementService.cancelScheduled('nonexistent')).rejects.toThrow(
        'Announcement not found'
      );
    });

    it('should throw error for already sent announcement', async () => {
      const sentAnnouncement = {
        id: 'sent-id',
        status: AnnouncementStatus.SENT,
      };
      mockRepo.findOne.mockResolvedValue(sentAnnouncement);

      await expect(announcementService.cancelScheduled('sent-id')).rejects.toThrow(
        'Cannot cancel a sent announcement'
      );
    });

    // Note: Full cancellation with delivery updates requires more complex mocking
    // The service correctly updates both announcement status and delivery records
  });

  describe('retryFailed', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(announcementService.retryFailed('nonexistent')).rejects.toThrow(
        'Announcement not found'
      );
    });

    it('should throw error when Discord client is not configured', async () => {
      const announcement = {
        id: 'test-id',
        title: 'Test',
        content: 'Content',
        status: AnnouncementStatus.FAILED,
      };
      mockRepo.findOne.mockResolvedValue(announcement);

      await expect(announcementService.retryFailed('test-id')).rejects.toThrow(
        'Discord client not configured'
      );
    });
  });

  // ========================================
  // Phase 3: Alliance-Wide Targeting Tests
  // ========================================

  describe('getAlliedOrganizations', () => {
    it('should return empty array when no alliances exist', async () => {
      mockRepo.find.mockResolvedValue([]);

      const result = await announcementService.getAlliedOrganizations('org123');

      expect(result).toEqual([]);
    });

    it('should return allied org IDs from active diplomacy relations', async () => {
      const activeRelations = [
        { orgId1: 'org123', orgId2: 'allied-org-1', status: 'active' },
        { orgId1: 'allied-org-2', orgId2: 'org123', status: 'active' },
      ];
      mockRepo.find.mockResolvedValue(activeRelations);

      const result = await announcementService.getAlliedOrganizations('org123');

      expect(result).toContain('allied-org-1');
      expect(result).toContain('allied-org-2');
      expect(result).toHaveLength(2);
    });

    it('should return unique org IDs for duplicate relationships', async () => {
      const activeRelations = [
        { orgId1: 'org123', orgId2: 'allied-org-1', status: 'active' },
        { orgId1: 'org123', orgId2: 'allied-org-1', status: 'active' }, // Duplicate
      ];
      mockRepo.find.mockResolvedValue(activeRelations);

      const result = await announcementService.getAlliedOrganizations('org123');

      expect(result).toContain('allied-org-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('getDiscordGuildIdForOrg', () => {
    it('should return Discord guild ID directly if organizationId looks like a snowflake', async () => {
      const discordGuildId = '123456789012345678';

      const result = await announcementService.getDiscordGuildIdForOrg(discordGuildId);

      expect(result).toBe(discordGuildId);
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('should return null for non-existent organization', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await announcementService.getDiscordGuildIdForOrg('non-snowflake-org');

      expect(result).toBeNull();
    });

    it('should return discordGuildId from metadata if available', async () => {
      const org = {
        id: 'my-org',
        metadata: { discordGuildId: '987654321098765432' },
      };
      mockRepo.findOne.mockResolvedValue(org);

      const result = await announcementService.getDiscordGuildIdForOrg('my-org');

      expect(result).toBe('987654321098765432');
    });

    it('should return discordServerId from metadata if discordGuildId not available', async () => {
      const org = {
        id: 'my-org',
        metadata: { discordServerId: '111222333444555666' },
      };
      mockRepo.findOne.mockResolvedValue(org);

      const result = await announcementService.getDiscordGuildIdForOrg('my-org');

      expect(result).toBe('111222333444555666');
    });

    it('should return null if no Discord ID in metadata or settings', async () => {
      const org = {
        id: 'my-org',
        metadata: { someOtherField: 'value' },
      };
      mockRepo.findOne.mockResolvedValue(org);

      const result = await announcementService.getDiscordGuildIdForOrg('my-org');

      expect(result).toBeNull();
    });
  });

  describe('sendToAllianceWithChannelResolution', () => {
    it('should throw error for non-existent announcement', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        announcementService.sendToAllianceWithChannelResolution('nonexistent', 'org123')
      ).rejects.toThrow('Announcement not found');
    });

    it('should throw error for already sent announcement', async () => {
      const sentAnnouncement = {
        id: 'sent-id',
        status: AnnouncementStatus.SENT,
      };
      mockRepo.findOne.mockResolvedValue(sentAnnouncement);

      await expect(
        announcementService.sendToAllianceWithChannelResolution('sent-id', 'org123')
      ).rejects.toThrow('Announcement has already been sent');
    });

    it('should throw error when Discord client is not configured', async () => {
      const draftAnnouncement = {
        id: 'draft-id',
        title: 'Draft',
        content: 'Content',
        status: AnnouncementStatus.DRAFT,
      };
      mockRepo.findOne.mockResolvedValue(draftAnnouncement);

      await expect(
        announcementService.sendToAllianceWithChannelResolution('draft-id', 'org123')
      ).rejects.toThrow('Discord client not configured');
    });
  });

  describe('AnnouncementTargetType.ALLIANCE', () => {
    it('should include ALLIANCE in target type enum', () => {
      expect(AnnouncementTargetType.ALLIANCE).toBe('alliance');
    });
  });

  describe('buildShortcodeContext (Multi-Tenant Authorization)', () => {
    it('should throw ForbiddenError when userId is provided but user is not member of organization', async () => {
      // Mock the membershipRepository method on the service
      const membershipExists = jest.fn().mockResolvedValue(false);
      (announcementService as any).organizationMembershipRepository = {
        exists: membershipExists,
        count: jest.fn(),
      };
      mockRepo.findOne.mockResolvedValue({ id: 'org123', name: 'Test Org' });

      await expect(
        (announcementService as any).buildShortcodeContext('org123', 'user-not-member')
      ).rejects.toThrow('Access denied');

      expect(membershipExists).toHaveBeenCalledWith({
        where: { organizationId: 'org123', userId: 'user-not-member' },
      });
    });

    it('should allow access when userId is provided and user is member of organization', async () => {
      const org = { id: 'org123', name: 'Test Org' };
      mockRepo.findOne.mockResolvedValue(org);

      const membershipExists = jest.fn().mockResolvedValue(true); // User IS a member
      const membershipCount = jest.fn().mockResolvedValue(42); // 42 members
      (announcementService as any).organizationMembershipRepository = {
        exists: membershipExists,
        count: membershipCount,
      };

      const context = await (announcementService as any).buildShortcodeContext(
        'org123',
        'user-is-member'
      );

      expect(context.organization).toEqual({
        id: 'org123',
        name: 'Test Org',
        memberCount: 42,
      });
      expect(membershipExists).toHaveBeenCalledWith({
        where: { organizationId: 'org123', userId: 'user-is-member' },
      });
      expect(membershipCount).toHaveBeenCalledWith({ where: { organizationId: 'org123' } });
    });

    it('should bypass authorization check when userId is not provided (system operation)', async () => {
      const org = { id: 'org123', name: 'System Org' };
      mockRepo.findOne.mockResolvedValue(org);

      const membershipExists = jest.fn();
      const membershipCount = jest.fn().mockResolvedValue(15);
      (announcementService as any).organizationMembershipRepository = {
        exists: membershipExists,
        count: membershipCount,
      };

      const context = await (announcementService as any).buildShortcodeContext('org123');

      expect(context.organization?.memberCount).toBe(15);
      // exists() should not have been called since userId was not provided
      expect(membershipExists).not.toHaveBeenCalled();
    });

    it('should return empty context if organization not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const context = await (announcementService as any).buildShortcodeContext('nonexistent-org');

      expect(context).toEqual({});
    });

    it('should query actual member count from OrganizationMembership table', async () => {
      const org = { id: 'org123', name: 'Count Test Org' };
      mockRepo.findOne.mockResolvedValue(org);

      const membershipCount = jest.fn().mockResolvedValue(125);
      (announcementService as any).organizationMembershipRepository = {
        count: membershipCount,
        exists: jest.fn(),
      };

      const context = await (announcementService as any).buildShortcodeContext('org123');

      expect(context.organization?.memberCount).toBe(125);
      expect(membershipCount).toHaveBeenCalledWith({ where: { organizationId: 'org123' } });
    });

    it('should not hardcode memberCount to 0', async () => {
      const org = { id: 'org456', name: 'Another Org' };
      mockRepo.findOne.mockResolvedValue(org);

      const membershipCount = jest.fn().mockResolvedValue(99);
      (announcementService as any).organizationMembershipRepository = {
        count: membershipCount,
        exists: jest.fn(),
      };

      const context = await (announcementService as any).buildShortcodeContext('org456');

      expect(context.organization?.memberCount).not.toBe(0);
      expect(context.organization?.memberCount).toBe(99);
    });
  });

  describe('preview with authorization', () => {
    it('should pass userId to buildShortcodeContext when provided', async () => {
      const announcement = {
        id: 'ann123',
        title: 'Test',
        content: 'Test content',
        organizationId: 'org123',
        embedConfig: { title: 'Title', description: 'Desc' },
      };

      mockRepo.findOne.mockResolvedValue(announcement);

      const buildContextSpy = jest.spyOn(announcementService as any, 'buildShortcodeContext');
      const buildEmbedSpy = jest
        .spyOn(announcementService as any, 'buildEmbed')
        .mockReturnValue({});

      await announcementService.preview(announcement as any, 'user-id-123');

      expect(buildContextSpy).toHaveBeenCalledWith('org123', 'user-id-123');

      buildContextSpy.mockRestore();
      buildEmbedSpy.mockRestore();
    });

    it('should work without userId (optional parameter)', async () => {
      const announcement = {
        id: 'ann456',
        title: 'Public Test',
        content: 'Public content',
        organizationId: 'org456',
        embedConfig: { title: 'Title', description: 'Desc' },
      };

      mockRepo.findOne.mockResolvedValue(announcement);

      const buildContextSpy = jest.spyOn(announcementService as any, 'buildShortcodeContext');
      const buildEmbedSpy = jest
        .spyOn(announcementService as any, 'buildEmbed')
        .mockReturnValue({});

      await announcementService.preview(announcement as any);

      expect(buildContextSpy).toHaveBeenCalledWith('org456', undefined);

      buildContextSpy.mockRestore();
      buildEmbedSpy.mockRestore();
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
