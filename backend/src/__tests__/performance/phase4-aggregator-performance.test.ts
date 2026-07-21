/**
 * Phase 4 Performance Tests - Aggregator Services
 *
 * Benchmarks for ActivityAggregatorService, OrganizationAggregatorService,
 * and ReputationService to identify performance bottlenecks.
 *
 * Note: These tests use mocked services to isolate aggregator logic performance.
 * For real database performance, use integration performance tests.
 */

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

import {
  benchmark,
  saveResults,
  checkThresholds,
  PERFORMANCE_THRESHOLDS,
  PerformanceResult,
  MockDataGenerator,
} from './performance-utils';

describe('Phase 4 Performance Tests - Aggregator Services', () => {
  let activityAggregator: ActivityAggregatorService;
  let organizationAggregator: OrganizationAggregatorService;
  let reputationService: ReputationService;
  let mockData: MockDataGenerator;
  const results: PerformanceResult[] = [];

  beforeAll(() => {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🚀 Phase 4 Performance Testing Suite');
    console.log('═══════════════════════════════════════════════════════════\n');

    mockData = new MockDataGenerator();
  });

  afterAll(() => {
    // Save all results
    if (results.length > 0) {
      saveResults(results, `phase4-performance-${Date.now()}.json`);
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 Performance Testing Complete');
    console.log('═══════════════════════════════════════════════════════════\n');
  });

  describe('ActivityAggregatorService Performance', () => {
    beforeAll(() => {
      // Mock all dependencies for isolated performance testing
      activityAggregator = new ActivityAggregatorService();

      // Mock service methods to simulate fast operations
      (activityAggregator as any).activityService = {
        create: jest.fn().mockResolvedValue({ id: 'mock-activity-id', title: 'Mock Activity' }),
        findById: jest.fn().mockResolvedValue({ id: 'mock-activity-id', status: 'active' }),
        update: jest.fn().mockResolvedValue({ id: 'mock-activity-id', status: 'completed' }),
      };

      (activityAggregator as any).participantService = {
        create: jest.fn().mockResolvedValue({ id: 'mock-participant-id', userId: 'mock-user' }),
        findByActivityId: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      };

      (activityAggregator as any).eventService = {
        create: jest.fn().mockResolvedValue({ id: 'mock-event-id' }),
        findByActivityId: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      };

      (activityAggregator as any).notificationService = {
        create: jest.fn().mockResolvedValue({ id: 'mock-notification-id' }),
      };

      (activityAggregator as any).discordService = {
        postMessage: jest.fn().mockResolvedValue({ id: 'mock-message-id' }),
      };

      (activityAggregator as any).userService = {
        findById: jest.fn().mockResolvedValue({ id: 'mock-user', username: 'testuser' }),
      };
    });

    it('should benchmark createActivityWithParticipants - small group (5 participants)', async () => {
      const result = await benchmark(
        'ActivityAggregator.createActivityWithParticipants (5 participants)',
        async () => {
          const orgId = mockData.generateOrgId();
          const creatorId = mockData.generateUserId();
          const participantIds = mockData.generateParticipantIds(5);

          await activityAggregator.createActivityWithParticipants({
            organizationId: orgId,
            activityData: mockData.generateActivityData(orgId, creatorId),
            participantIds,
            notifyParticipants: true,
            postToDiscord: false,
          });
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      // Check thresholds
      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorCreate);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark createActivityWithParticipants - large group (20 participants)', async () => {
      const result = await benchmark(
        'ActivityAggregator.createActivityWithParticipants (20 participants)',
        async () => {
          const orgId = mockData.generateOrgId();
          const creatorId = mockData.generateUserId();
          const participantIds = mockData.generateParticipantIds(20);

          await activityAggregator.createActivityWithParticipants({
            organizationId: orgId,
            activityData: mockData.generateActivityData(orgId, creatorId),
            participantIds,
            notifyParticipants: true,
            postToDiscord: true,
          });
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      // Large groups may be slower, use relaxed thresholds
      const check = checkThresholds(result, {
        average: PERFORMANCE_THRESHOLDS.aggregatorCreate.average * 2,
        p95: PERFORMANCE_THRESHOLDS.aggregatorCreate.p95 * 2,
        p99: PERFORMANCE_THRESHOLDS.aggregatorCreate.p99 * 2,
      });

      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark completeActivity', async () => {
      const result = await benchmark(
        'ActivityAggregator.completeActivity',
        async () => {
          const orgId = mockData.generateOrgId();
          const activityId = mockData.generateActivityId();
          const completedById = mockData.generateUserId();

          await activityAggregator.completeActivity({
            organizationId: orgId,
            activityId,
            completedById,
            outcome: 'success',
            summary: 'Test completion',
            participantReports: [
              { userId: mockData.generateUserId(), attended: true },
              { userId: mockData.generateUserId(), attended: false },
            ],
            notifyParticipants: true,
          });
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorUpdate);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark cancelActivity', async () => {
      const result = await benchmark(
        'ActivityAggregator.cancelActivity',
        async () => {
          const orgId = mockData.generateOrgId();
          const activityId = mockData.generateActivityId();
          const cancelledById = mockData.generateUserId();

          await (activityAggregator as any).cancelActivity(
            orgId,
            activityId,
            cancelledById,
            'Testing cancellation performance'
          );
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorUpdate);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark getActivityWithDetails', async () => {
      const result = await benchmark(
        'ActivityAggregator.getActivityWithDetails',
        async () => {
          const orgId = mockData.generateOrgId();
          const activityId = mockData.generateActivityId();

          await activityAggregator.getActivityWithDetails(orgId, activityId);
        },
        { iterations: 100, warmupIterations: 10, cooldownMs: 2 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorRead);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });
  });

  describe('OrganizationAggregatorService Performance', () => {
    beforeAll(() => {
      organizationAggregator = new OrganizationAggregatorService();

      // Mock dependencies
      (organizationAggregator as any).organizationService = {
        createOrganization: jest.fn().mockResolvedValue({ id: 'mock-org-id', name: 'Mock Org' }),
        findById: jest.fn().mockResolvedValue({ id: 'mock-org-id', name: 'Mock Org' }),
      };

      (organizationAggregator as any).memberService = {
        addMember: jest.fn().mockResolvedValue({ id: 'mock-member-id', userId: 'mock-user' }),
        removeMember: jest.fn().mockResolvedValue(true),
        findByOrganizationId: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      };

      (organizationAggregator as any).permissionService = {
        grantPermission: jest.fn().mockResolvedValue({ id: 'mock-permission-id' }),
        revokeAllPermissions: jest.fn().mockResolvedValue(true),
        findByUserId: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      };

      (organizationAggregator as any).settingsService = {
        create: jest.fn().mockResolvedValue({ id: 'mock-settings-id' }),
      };

      (organizationAggregator as any).userService = {
        findById: jest.fn().mockResolvedValue({ id: 'mock-user', username: 'testuser' }),
      };

      (organizationAggregator as any).notificationService = {
        create: jest.fn().mockResolvedValue({ id: 'mock-notification-id' }),
      };
    });

    it('should benchmark inviteAndOnboardMember', async () => {
      const result = await benchmark(
        'OrganizationAggregator.inviteAndOnboardMember',
        async () => {
          const orgId = mockData.generateOrgId();
          const userId = mockData.generateUserId();
          const invitedBy = mockData.generateUserId();

          await organizationAggregator.inviteAndOnboardMember({
            organizationId: orgId,
            userId,
            invitedBy,
            role: 'member',
            permissions: [
              { resource: 'activities', actions: ['read', 'create'] },
              { resource: 'members', actions: ['read'] },
            ] as any,
            sendNotification: true,
          });
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorCreate);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark offboardMember', async () => {
      const result = await benchmark(
        'OrganizationAggregator.offboardMember',
        async () => {
          const orgId = mockData.generateOrgId();
          const userId = mockData.generateUserId();
          const removedBy = mockData.generateUserId();

          await (organizationAggregator as any).offboardMember(
            orgId,
            userId,
            removedBy,
            'Performance test'
          );
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorUpdate);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark bulkInviteMembers - small batch (5 members)', async () => {
      const result = await benchmark(
        'OrganizationAggregator.bulkInviteMembers (5 members)',
        async () => {
          const orgId = mockData.generateOrgId();
          const invitedBy = mockData.generateUserId();
          const invitations = Array.from({ length: 5 }, () => ({
            userId: mockData.generateUserId(),
            role: 'member' as const,
          }));

          await (organizationAggregator as any).bulkInviteMembers({
            organizationId: orgId,
            invitations,
            invitedBy,
            sendNotifications: true,
          });
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorCreate);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark bulkInviteMembers - large batch (20 members)', async () => {
      const result = await benchmark(
        'OrganizationAggregator.bulkInviteMembers (20 members)',
        async () => {
          const orgId = mockData.generateOrgId();
          const invitedBy = mockData.generateUserId();
          const invitations = Array.from({ length: 20 }, () => ({
            userId: mockData.generateUserId(),
            role: 'member' as const,
          }));

          await (organizationAggregator as any).bulkInviteMembers({
            organizationId: orgId,
            invitations,
            invitedBy,
            sendNotifications: true,
          });
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      // Relaxed thresholds for bulk operations
      const check = checkThresholds(result, {
        average: PERFORMANCE_THRESHOLDS.aggregatorCreate.average * 2,
        p95: PERFORMANCE_THRESHOLDS.aggregatorCreate.p95 * 2,
        p99: PERFORMANCE_THRESHOLDS.aggregatorCreate.p99 * 2,
      });

      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark setupNewOrganization', async () => {
      const result = await benchmark(
        'OrganizationAggregator.setupNewOrganization',
        async () => {
          const ownerId = mockData.generateUserId();

          await organizationAggregator.setupNewOrganization({
            name: `Perf Test Org ${mockData.generateOrgId()}`,
            ownerId,
            description: 'Performance testing organization',
            settings: {
              allowPublicJoin: false,
              requireApproval: true,
              maxMembers: 100,
            },
          });
        },
        { iterations: 50, warmupIterations: 5, cooldownMs: 5 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorCreate);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark getOrganizationOverview', async () => {
      const result = await benchmark(
        'OrganizationAggregator.getOrganizationOverview',
        async () => {
          const orgId = mockData.generateOrgId();

          await organizationAggregator.getOrganizationOverview(orgId);
        },
        { iterations: 100, warmupIterations: 10, cooldownMs: 2 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorRead);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });
  });

  describe('ReputationService Performance', () => {
    beforeAll(() => {
      reputationService = new ReputationService();

      // Mock dependencies (LFG reputation methods are now directly on ReputationService)
      (reputationService as any).trustScoreService = {
        calculateTrustScore: jest.fn().mockResolvedValue(70),
      };

      (reputationService as any).userReputationRepository = {
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue({
          overallScore: 75,
          totalSessions: 50,
          successRate: 0.8,
          averageRating: 4.2,
        }),
      };

      (reputationService as any).relationshipRepository = {
        find: jest.fn().mockResolvedValue([]),
      };
    });

    it('should benchmark getUnifiedReputation', async () => {
      const result = await benchmark(
        'ReputationService.getUnifiedReputation',
        async () => {
          const userId = mockData.generateUserId();
          const orgId = mockData.generateOrgId();

          await reputationService.getUnifiedReputation(userId, orgId);
        },
        { iterations: 100, warmupIterations: 10, cooldownMs: 2 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.calculation);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark getReputationReport', async () => {
      const result = await benchmark(
        'ReputationService.getReputationReport',
        async () => {
          const userId = mockData.generateUserId();
          const orgId = mockData.generateOrgId();

          await reputationService.getReputationReport(userId, orgId);
        },
        { iterations: 100, warmupIterations: 10, cooldownMs: 2 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.calculation);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark compareReputations', async () => {
      const result = await benchmark(
        'ReputationService.compareReputations',
        async () => {
          const userIds = [mockData.generateUserId(), mockData.generateUserId()];
          const orgId = mockData.generateOrgId();

          await (reputationService as any).compareReputations(userIds, orgId);
        },
        { iterations: 100, warmupIterations: 10, cooldownMs: 2 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.calculation);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });

    it('should benchmark getGlobalLeaderboard', async () => {
      const result = await benchmark(
        'ReputationService.getGlobalLeaderboard',
        async () => {
          await reputationService.getGlobalLeaderboard(10);
        },
        { iterations: 100, warmupIterations: 10, cooldownMs: 2 }
      );

      results.push(result);

      const check = checkThresholds(result, PERFORMANCE_THRESHOLDS.aggregatorRead);
      if (!check.passed) {
        console.warn('⚠️  Performance threshold failures:');
        check.failures.forEach(f => console.warn(`   - ${f}`));
      }
    });
  });
});
