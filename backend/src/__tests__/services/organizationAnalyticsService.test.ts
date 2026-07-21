import { AnalyticsPeriod } from '../../models/OrganizationAnalytics';
import { OrganizationAnalyticsService } from '../../services/organization/OrganizationAnalyticsService';

// Mock the service's internal methods to avoid database dependencies
jest.mock('../../config/database');

describe('OrganizationAnalyticsService - New Methods', () => {
  let analyticsService: OrganizationAnalyticsService;

  beforeEach(() => {
    analyticsService = new OrganizationAnalyticsService();

    // Mock generateAnalytics to return predictable data
    jest.spyOn(analyticsService as any, 'generateAnalytics').mockResolvedValue({
      memberStats: {
        totalMembers: 100,
        directMembers: 80,
        activeMembers: 70,
        inactiveMembers: 30,
        newMembersThisPeriod: 10,
        removedMembersThisPeriod: 5,
        membersByRole: { leader: 5, member: 95 },
        averageTenure: 180,
        memberGrowthRate: 5.5,
      },
      activityMetrics: {
        totalActivities: 250,
        activitiesByType: { MEMBER_ADDED: 10, SETTINGS_UPDATED: 5 },
        activitiesBySeverity: { INFO: 240, WARNING: 10 },
        activityTrend: [{ date: '2024-01-01', count: 50 }],
        mostActiveUsers: [{ userId: 'user-1', activityCount: 30 }],
        peakActivityTimes: [{ hour: 14, count: 20 }],
        averageActivitiesPerDay: 8.3,
      },
      engagementMetrics: {
        engagementScore: 75,
        activeUsersPercentage: 70,
        averageActivitiesPerUser: 2.5,
        lastActivityDate: new Date(),
        dormantMembers: 30,
        highlyEngagedMembers: 21,
        engagementTrend: 'STABLE' as const,
      },
      growthMetrics: {
        memberGrowth: [
          { date: '2024-01-01', count: 95 },
          { date: '2024-01-15', count: 100 },
        ],
        growthRate: 5.5,
        projectedGrowth: 6.05,
        churnRate: 5,
        retentionRate: 95,
        netGrowth: 5,
        subOrgGrowth: 2,
      },
      hierarchyHealth: {
        depth: 3,
        balance: 75,
        averageChildrenPerNode: 2.5,
        leafNodeCount: 10,
        middleNodeCount: 5,
        totalSubOrgs: 15,
        deepestPath: ['org-1', 'org-2', 'org-3'],
        widestLevel: 8,
      },
      resourceUsage: {
        storageUsed: 1024000,
        apiCallsThisPeriod: 500,
        permissionChecks: 200,
        averageResponseTime: 150,
        errorRate: 0.5,
        resourcesByType: { fleet: 50, member: 100 },
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getOrganizationAnalytics', () => {
    it('should return analytics summary with key metrics', async () => {
      const analytics = await analyticsService.getOrganizationAnalytics('org-123');

      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('totalMembers');
      expect(analytics).toHaveProperty('activeMembers');
      expect(analytics).toHaveProperty('growth');
      expect(analytics).toHaveProperty('engagement');
      expect(typeof analytics.totalMembers).toBe('number');
      expect(typeof analytics.activeMembers).toBe('number');
      expect(typeof analytics.growth).toBe('number');
      expect(typeof analytics.engagement).toBe('number');
    });

    it('should return correct member counts', async () => {
      const analytics = await analyticsService.getOrganizationAnalytics('org-123');

      expect(analytics.totalMembers).toBe(100);
      expect(analytics.activeMembers).toBe(70);
      expect(analytics.growth).toBe(5.5);
      expect(analytics.engagement).toBe(75);
    });

    it('should accept period parameter', async () => {
      const dailyAnalytics = await analyticsService.getOrganizationAnalytics(
        'org-123',
        AnalyticsPeriod.DAILY
      );
      const weeklyAnalytics = await analyticsService.getOrganizationAnalytics(
        'org-123',
        AnalyticsPeriod.WEEKLY
      );

      expect(dailyAnalytics).toBeDefined();
      expect(weeklyAnalytics).toBeDefined();
      expect(dailyAnalytics.totalMembers).toBe(100);
      expect(weeklyAnalytics.totalMembers).toBe(100);
    });
  });

  describe('getAnalyticsByPeriod', () => {
    it('should return analytics with period information', async () => {
      const analytics = await analyticsService.getAnalyticsByPeriod('org-123', 'monthly');

      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('period');
      expect(analytics).toHaveProperty('data');
      expect(analytics.period).toBe('monthly');
    });

    it('should handle string period input', async () => {
      const analytics = await analyticsService.getAnalyticsByPeriod('org-123', 'weekly');

      expect(analytics.period).toBe('weekly');
      expect(analytics.data).toBeDefined();
    });

    it('should normalize period strings to lowercase', async () => {
      const analytics = await analyticsService.getAnalyticsByPeriod('org-123', 'DAILY');

      expect(analytics.period).toBe('daily');
    });

    it('should handle AnalyticsPeriod enum values', async () => {
      const analytics = await analyticsService.getAnalyticsByPeriod(
        'org-123',
        AnalyticsPeriod.QUARTERLY
      );

      expect(analytics.period).toBe('quarterly');
    });

    it('should return comprehensive analytics data', async () => {
      const analytics = await analyticsService.getAnalyticsByPeriod('org-123', 'monthly');

      expect(analytics.data).toHaveProperty('memberStats');
      expect(analytics.data).toHaveProperty('activityMetrics');
      expect(analytics.data).toHaveProperty('engagementMetrics');
      expect(analytics.data).toHaveProperty('growthMetrics');
    });
  });

  describe('compareOrganizations', () => {
    it('should compare multiple organizations', async () => {
      const comparison = await analyticsService.compareOrganizations(['org-123', 'org-456']);

      expect(comparison).toBeDefined();
      expect(comparison).toHaveProperty('organizations');
      expect(comparison.organizations).toHaveLength(2);
    });

    it('should return metrics for each organization', async () => {
      const comparison = await analyticsService.compareOrganizations(['org-123', 'org-456']);

      comparison.organizations.forEach(org => {
        expect(org).toHaveProperty('id');
        expect(org).toHaveProperty('metrics');
        expect(org.metrics).toHaveProperty('members');
        expect(org.metrics).toHaveProperty('activeMembers');
        expect(org.metrics).toHaveProperty('growth');
        expect(org.metrics).toHaveProperty('engagement');
        expect(org.metrics).toHaveProperty('activities');
        expect(org.metrics).toHaveProperty('retentionRate');
      });
    });

    it('should return consistent metrics for known organization', async () => {
      const comparison = await analyticsService.compareOrganizations(['org-123']);

      const org1Metrics = comparison.organizations.find(o => o.id === 'org-123');

      expect(org1Metrics?.metrics.members).toBe(100);
      expect(org1Metrics?.metrics.activeMembers).toBe(70);
      expect(org1Metrics?.metrics.growth).toBe(5.5);
      expect(org1Metrics?.metrics.engagement).toBe(75);
      expect(org1Metrics?.metrics.activities).toBe(250);
      expect(org1Metrics?.metrics.retentionRate).toBe(95);
    });

    it('should accept period parameter', async () => {
      const comparison = await analyticsService.compareOrganizations(
        ['org-123', 'org-456'],
        AnalyticsPeriod.WEEKLY
      );

      expect(comparison.organizations).toHaveLength(2);
    });

    it('should work with single organization', async () => {
      const comparison = await analyticsService.compareOrganizations(['org-123']);

      expect(comparison.organizations).toHaveLength(1);
      expect(comparison.organizations[0].id).toBe('org-123');
    });

    it('should work with three or more organizations', async () => {
      const comparison = await analyticsService.compareOrganizations([
        'org-123',
        'org-456',
        'org-789',
      ]);

      expect(comparison.organizations).toHaveLength(3);
    });
  });

  describe('Method behavior', () => {
    it('should call generateAnalytics with correct parameters in getOrganizationAnalytics', async () => {
      const generateSpy = jest.spyOn(analyticsService as any, 'generateAnalytics');

      await analyticsService.getOrganizationAnalytics('org-123', AnalyticsPeriod.WEEKLY);

      expect(generateSpy).toHaveBeenCalledWith('org-123', AnalyticsPeriod.WEEKLY);
    });

    it('should call generateAnalytics with correct parameters in getAnalyticsByPeriod', async () => {
      const generateSpy = jest.spyOn(analyticsService as any, 'generateAnalytics');

      await analyticsService.getAnalyticsByPeriod('org-123', 'monthly');

      expect(generateSpy).toHaveBeenCalledWith('org-123', AnalyticsPeriod.MONTHLY);
    });

    it('should call generateAnalytics for each organization in compareOrganizations', async () => {
      const generateSpy = jest.spyOn(analyticsService as any, 'generateAnalytics');

      await analyticsService.compareOrganizations(['org-123', 'org-456']);

      expect(generateSpy).toHaveBeenCalledTimes(2);
      expect(generateSpy).toHaveBeenCalledWith('org-123', AnalyticsPeriod.MONTHLY);
      expect(generateSpy).toHaveBeenCalledWith('org-456', AnalyticsPeriod.MONTHLY);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
