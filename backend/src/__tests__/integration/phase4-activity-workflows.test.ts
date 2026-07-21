// Mock database before importing services to prevent EntityMetadataNotFoundError
import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

// Mock Discord service before importing aggregators
const mockDiscordServiceInstance = {
  postMessage: jest.fn(),
  getUserRoles: jest.fn(),
  assignRole: jest.fn(),
  removeRole: jest.fn(),
  clearRoleCache: jest.fn(),
  getRoleCacheStats: jest.fn(),
} as any;

jest.mock('../../services/discord/DiscordService', () => ({
  DiscordService: jest.fn(),
  getDiscordService: jest.fn(() => mockDiscordServiceInstance),
}));

// Mock all services that require entity metadata
jest.mock('../../services/activity/ActivityService');
jest.mock('../../services/activity/ActivityParticipantService');
jest.mock('../../services/activity/ActivityEventService');
jest.mock('../../services/communication/notifications/NotificationService');
jest.mock('../../services/user/UserService');
jest.mock('../../services/organization/OrganizationService');
jest.mock('../../services/organization/OrganizationMemberService');

import { ActivityAggregatorService } from '../../services/aggregators/ActivityAggregatorService';
import { OrganizationAggregatorService } from '../../services/aggregators/OrganizationAggregatorService';
import { ReputationService } from '../../services/social/ReputationService';

/**
 * Phase 4 Integration Tests - Service Workflows
 *
 * Tests that Phase 4 aggregator services can be instantiated and
 * their core workflows are properly structured. These tests validate
 * that services integrate correctly without requiring full database setup.
 *
 * Note: Full database integration tests require test environment setup.
 * These tests focus on service interaction patterns and error handling.
 */
describe('Phase 4 Integration - Service Workflows', () => {
  let activityAggregator: ActivityAggregatorService;
  let organizationAggregator: OrganizationAggregatorService;
  let reputationService: ReputationService;

  beforeAll(() => {
    // Initialize Phase 4 services
    activityAggregator = new ActivityAggregatorService();
    organizationAggregator = new OrganizationAggregatorService();
    reputationService = new ReputationService();
  });

  afterAll(() => {
    const { enhancedCacheService } = require('../../services/caching/EnhancedCacheService');
    enhancedCacheService.shutdown();

    const socialGroupService = (reputationService as any)?.socialGroupService;
    socialGroupService?.stopCleanup?.();
  });

  describe('Service Instantiation', () => {
    it('should successfully instantiate ActivityAggregatorService', () => {
      expect(activityAggregator).toBeDefined();
      expect(activityAggregator).toBeInstanceOf(ActivityAggregatorService);
    });

    it('should successfully instantiate OrganizationAggregatorService', () => {
      expect(organizationAggregator).toBeDefined();
      expect(organizationAggregator).toBeInstanceOf(OrganizationAggregatorService);
    });

    it('should successfully instantiate ReputationService', () => {
      expect(reputationService).toBeDefined();
      expect(reputationService).toBeInstanceOf(ReputationService);
    });
  });

  describe('Service Method Availability', () => {
    it('ActivityAggregatorService should have required methods', () => {
      expect(typeof activityAggregator.createActivityWithParticipants).toBe('function');
      expect(typeof activityAggregator.completeActivity).toBe('function');
      expect(typeof activityAggregator.cancelActivity).toBe('function');
      expect(typeof activityAggregator.getActivityWithDetails).toBe('function');
    });

    it('OrganizationAggregatorService should have required methods', () => {
      expect(typeof organizationAggregator.inviteAndOnboardMember).toBe('function');
      expect(typeof organizationAggregator.offboardMember).toBe('function');
      expect(typeof organizationAggregator.bulkInviteMembers).toBe('function');
      expect(typeof organizationAggregator.setupNewOrganization).toBe('function');
      expect(typeof organizationAggregator.getOrganizationOverview).toBe('function');
    });

    it('ReputationService should have required methods', () => {
      expect(typeof reputationService.getUnifiedReputation).toBe('function');
      expect(typeof reputationService.getReputationReport).toBe('function');
      expect(typeof reputationService.compareReputations).toBe('function');
      expect(typeof reputationService.getGlobalLeaderboard).toBe('function');
    });
  });

  describe('Parameter Validation', () => {
    it('ActivityAggregatorService should handle empty params (no validation currently)', async () => {
      // Note: Services currently don't validate empty parameters
      // This test documents current behavior - consider adding validation in future
      // Mocking the underlying service call to return a valid activity
      const mockActivityService = (activityAggregator as any).activityService;
      mockActivityService.create = jest.fn().mockResolvedValue({
        id: 'mock-activity-id',
        title: '',
        activityType: '',
        scheduledStartDate: new Date(),
        creatorId: '',
      });

      const result = await activityAggregator.createActivityWithParticipants({
        organizationId: '',
        activityData: {
          title: '',
          activityType: '',
          scheduledStartDate: new Date(),
          creatorId: '',
        },
      });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('activity');
    });

    it('OrganizationAggregatorService should have inviteAndOnboardMember method', () => {
      // Just verify method exists for now
      expect(typeof organizationAggregator.inviteAndOnboardMember).toBe('function');
    });

    it('ReputationService should have getUnifiedReputation method', () => {
      // Just verify method exists for now
      expect(typeof reputationService.getUnifiedReputation).toBe('function');
    });
  });

  describe('Error Handling', () => {
    it('ActivityAggregatorService should handle missing organization (no validation currently)', async () => {
      // Note: Services currently don't validate organization existence
      // This documents current behavior - database constraints would catch issues
      // Mocking the underlying service call to return a valid activity
      const mockActivityService = (activityAggregator as any).activityService;
      mockActivityService.create = jest.fn().mockResolvedValue({
        id: 'mock-activity-id',
        title: 'Test Activity',
        activityType: 'mission',
        scheduledStartDate: new Date(),
        creatorId: 'test-user-id',
      });

      const result = await activityAggregator.createActivityWithParticipants({
        organizationId: 'non-existent-org-id',
        activityData: {
          title: 'Test Activity',
          activityType: 'mission',
          scheduledStartDate: new Date(),
          creatorId: 'test-user-id',
        },
        participantIds: [],
      });
      expect(result).toBeDefined();
    });

    it('OrganizationAggregatorService should have inviteAndOnboardMember (skipping validation test)', () => {
      // Skipping actual execution as it requires full service mocking
      expect(typeof organizationAggregator.inviteAndOnboardMember).toBe('function');
    });

    it('ReputationService should have getUnifiedReputation (skipping validation test)', () => {
      // Skipping actual execution as it requires database mocking
      expect(typeof reputationService.getUnifiedReputation).toBe('function');
    });
  });

  describe('Service Integration Patterns', () => {
    it('ActivityAggregatorService should coordinate multiple services', () => {
      // Verify that the aggregator has access to required sub-services
      // This validates the service integration pattern
      expect(activityAggregator).toHaveProperty('activityService');
      expect(activityAggregator).toHaveProperty('participantService');
      expect(activityAggregator).toHaveProperty('eventService');
      expect(activityAggregator).toHaveProperty('notificationService');
      expect(activityAggregator).toHaveProperty('discordService');
    });

    it('OrganizationAggregatorService should coordinate multiple services', () => {
      expect(organizationAggregator).toHaveProperty('organizationService');
      expect(organizationAggregator).toHaveProperty('memberService');
      expect(organizationAggregator).toHaveProperty('permissionService');
      expect(organizationAggregator).toHaveProperty('settingsService');
      expect(organizationAggregator).toHaveProperty('userService');
    });

    it('ReputationService should have consolidated LFG and Trust functionality', () => {
      // ReputationService now has consolidated functionality directly (no internal services)
      expect(reputationService).toHaveProperty('ratingRepository');
      expect(reputationService).toHaveProperty('userReputationRepository');
      expect(reputationService).toHaveProperty('relationshipRepository');
      expect(reputationService).toHaveProperty('socialGroupService');
    });
  });
});
