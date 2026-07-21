import { AppDataSource } from '../../../data-source';
import {
  OrganizationDeletionRequest,
  OrgDeletionRequestStatus,
} from '../../../models/OrganizationDeletionRequest';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { User } from '../../../models/User';
import { emailService } from '../../communication/email';
import { OrganizationDeletionNotificationService } from '../OrganizationDeletionNotificationService';

// Mock dependencies
jest.mock('../../../config/database');
jest.mock('../../../websocket/controllers/notificationWebSocketController', () => ({
  sendUserNotification: jest.fn(),
  sendOrganizationNotification: jest.fn(),
}));
jest.mock('../../communication/email', () => ({
  emailService: {
    isConfigured: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id' }),
  },
}));

describe('OrganizationDeletionNotificationService', () => {
  let service: OrganizationDeletionNotificationService;
  let mockUserRepo: any;
  let mockMembershipRepo: any;
  let mockDeletionRequestRepo: any;
  const mockEmailSvc = emailService as jest.Mocked<typeof emailService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Reset email service mock
    mockEmailSvc.isConfigured.mockReturnValue(true);
    mockEmailSvc.send.mockResolvedValue({ success: true, messageId: 'test-id' });

    // Mock repositories
    mockUserRepo = {
      findOne: jest.fn(),
    };

    mockMembershipRepo = {
      find: jest.fn(),
    };

    mockDeletionRequestRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === User) return mockUserRepo;
      if (entity === OrganizationMembership) return mockMembershipRepo;
      if (entity === OrganizationDeletionRequest) return mockDeletionRequestRepo;
      return {};
    });

    service = new OrganizationDeletionNotificationService();
  });

  describe('notifyRequestCreated', () => {
    it('should send notifications when deletion request is created', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        gracePeriodDays: 30,
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      const mockRequester = {
        id: 'user-123',
        username: 'testuser',
        email: 'testuser@example.com',
      };

      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: { emailNotifications: true },
          },
        },
        {
          userId: 'user-456',
          role: 'admin',
          user: {
            email: 'admin@example.com',
            id: 'user-456',
            preferences: { emailNotifications: true },
          },
        },
      ];

      mockUserRepo.findOne.mockResolvedValue(mockRequester);
      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyRequestCreated(mockRequest);

      // Verify email was sent to stakeholders
      expect(mockEmailSvc.send).toHaveBeenCalledTimes(2);

      // Verify WebSocket notifications were sent
      const {
        sendUserNotification,
      } = require('../../../websocket/controllers/notificationWebSocketController');
      expect(sendUserNotification).toHaveBeenCalledTimes(2);
    });

    it('should handle missing organization gracefully', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        gracePeriodDays: 30,
      } as OrganizationDeletionRequest;

      mockUserRepo.findOne.mockResolvedValue({ id: 'user-123', username: 'testuser' });
      mockMembershipRepo.find.mockResolvedValue([]);

      await expect(service.notifyRequestCreated(mockRequest)).resolves.not.toThrow();
    });
  });

  describe('notifyRequestApproved', () => {
    it('should send notifications when deletion request is approved', async () => {
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + 30);

      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        approvedBy: 'admin-123',
        status: OrgDeletionRequestStatus.APPROVED,
        approvedAt: new Date(),
        scheduledFor,
        gracePeriodDays: 30,
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      const mockApprover = {
        id: 'admin-123',
        username: 'adminuser',
        email: 'admin@example.com',
      };

      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: { emailNotifications: true },
          },
        },
      ];

      mockUserRepo.findOne.mockResolvedValue(mockApprover);
      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyRequestApproved(mockRequest);

      expect(mockEmailSvc.send).toHaveBeenCalled();

      const {
        sendUserNotification,
      } = require('../../../websocket/controllers/notificationWebSocketController');
      expect(sendUserNotification).toHaveBeenCalled();
    });
  });

  describe('notifyRequestRejected', () => {
    it('should send notifications when deletion request is rejected', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        rejectedBy: 'admin-123',
        status: OrgDeletionRequestStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: 'Not appropriate',
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      const mockRejector = {
        id: 'admin-123',
        username: 'adminuser',
        email: 'admin@example.com',
      };

      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: { emailNotifications: true },
          },
        },
      ];

      mockUserRepo.findOne.mockResolvedValue(mockRejector);
      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyRequestRejected(mockRequest);

      expect(mockEmailSvc.send).toHaveBeenCalled();

      const {
        sendUserNotification,
      } = require('../../../websocket/controllers/notificationWebSocketController');
      expect(sendUserNotification).toHaveBeenCalled();
    });
  });

  describe('notifyRequestCancelled', () => {
    it('should send notifications when deletion request is cancelled', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        cancelledBy: 'user-123',
        status: OrgDeletionRequestStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: 'Changed my mind',
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      const mockCanceller = {
        id: 'user-123',
        username: 'testuser',
        email: 'testuser@example.com',
      };

      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: { emailNotifications: true },
          },
        },
      ];

      mockUserRepo.findOne.mockResolvedValue(mockCanceller);
      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyRequestCancelled(mockRequest);

      expect(mockEmailSvc.send).toHaveBeenCalled();

      const {
        sendUserNotification,
      } = require('../../../websocket/controllers/notificationWebSocketController');
      expect(sendUserNotification).toHaveBeenCalled();
    });
  });

  describe('notifyGracePeriodReminder', () => {
    it('should send grace period reminder notifications', async () => {
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + 3);

      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.APPROVED,
        scheduledFor,
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: { emailNotifications: true },
          },
        },
      ];

      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyGracePeriodReminder(mockRequest, 3);

      expect(mockEmailSvc.send).toHaveBeenCalled();

      const {
        sendUserNotification,
      } = require('../../../websocket/controllers/notificationWebSocketController');
      expect(sendUserNotification).toHaveBeenCalled();
    });
  });

  describe('notifyFinalWarning', () => {
    it('should send final warning notification with high priority', async () => {
      const scheduledFor = new Date();
      scheduledFor.setHours(scheduledFor.getHours() + 24);

      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.APPROVED,
        scheduledFor,
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: { emailNotifications: true },
          },
        },
      ];

      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyFinalWarning(mockRequest);

      expect(mockEmailSvc.send).toHaveBeenCalled();

      // Verify subject contains FINAL WARNING
      const emailCall = mockEmailSvc.send.mock.calls[0][0];
      expect(emailCall.subject).toContain('FINAL WARNING');
    });
  });

  describe('notifyDeletionCompleted', () => {
    it('should send notifications when deletion is completed', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.COMPLETED,
        completedAt: new Date(),
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: { emailNotifications: true },
          },
        },
      ];

      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyDeletionCompleted(mockRequest);

      expect(mockEmailSvc.send).toHaveBeenCalled();

      const {
        sendUserNotification,
      } = require('../../../websocket/controllers/notificationWebSocketController');
      expect(sendUserNotification).toHaveBeenCalled();
    });
  });

  describe('notification preferences', () => {
    it('should respect user notification preferences', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        gracePeriodDays: 30,
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      // Member with notifications disabled
      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: {
              emailNotifications: false,
            },
          },
        },
      ];

      mockUserRepo.findOne.mockImplementation((query: any) => {
        // Return user with preferences when queried
        if (query.where?.id === 'user-123') {
          return Promise.resolve({
            id: 'user-123',
            username: 'testuser',
            preferences: {
              emailNotifications: false,
            },
          });
        }
        return Promise.resolve({ id: 'user-123', username: 'testuser' });
      });
      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyRequestCreated(mockRequest);

      // Should not send email because notifications are disabled
      expect(mockEmailSvc.send).not.toHaveBeenCalled();
    });

    it('should respect organization deletion notification preferences', async () => {
      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        gracePeriodDays: 30,
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      // Member with org deletion notifications disabled
      const mockMembers = [
        {
          userId: 'user-123',
          role: 'owner',
          user: {
            email: 'testuser@example.com',
            id: 'user-123',
            preferences: {
              emailNotifications: true,
              organizationDeletionNotifications: false,
            },
          },
        },
      ];

      mockUserRepo.findOne.mockImplementation((query: any) => {
        // Return user with preferences when queried
        if (query.where?.id === 'user-123') {
          return Promise.resolve({
            id: 'user-123',
            username: 'testuser',
            preferences: {
              emailNotifications: true,
              organizationDeletionNotifications: false,
            },
          });
        }
        return Promise.resolve({ id: 'user-123', username: 'testuser' });
      });
      mockMembershipRepo.find.mockResolvedValue(mockMembers);

      await service.notifyRequestCreated(mockRequest);

      // Should not send email because org deletion notifications are disabled
      expect(mockEmailSvc.send).not.toHaveBeenCalled();
    });
  });

  describe('email not configured', () => {
    it('should handle missing email configuration gracefully', async () => {
      // Simulate email not configured
      mockEmailSvc.isConfigured.mockReturnValue(false);

      const serviceWithoutEmail = new OrganizationDeletionNotificationService();

      const mockRequest = {
        id: 'req-123',
        organizationId: 'org-123',
        requestedBy: 'user-123',
        status: OrgDeletionRequestStatus.PENDING,
        requestedAt: new Date(),
        gracePeriodDays: 30,
        organization: { name: 'Test Org' },
      } as OrganizationDeletionRequest;

      mockMembershipRepo.find.mockResolvedValue([]);

      // Should not throw an error
      await expect(serviceWithoutEmail.notifyRequestCreated(mockRequest)).resolves.not.toThrow();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

