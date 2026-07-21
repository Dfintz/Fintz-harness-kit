/**
 * Tests for OpportunitySearchService
 * Sprint 19-G: Unified Opportunity Pool
 */

jest.mock('../../services/social/ReputationService', () => ({
  ReputationService: jest.fn().mockImplementation(() => ({
    getUserReputation: jest.fn().mockResolvedValue({ score: 75 }),
  })),
}));

import { ActivityStatus, ActivityType } from '../../models/Activity';
import { JobType, ListingCategory, PayType } from '../../models/PublicJobListing';
import {
  OpportunitySearchService,
  UnifiedOpportunityFilters,
} from '../../services/search/OpportunitySearchService';
import { PaginationOptions } from '../../utils/pagination';

// ==================== MOCK DATA ====================

const mockJobItem = {
  id: 'job-1',
  organizationId: 'org-1',
  organizationName: 'Test Org',
  organizationLogoUrl: 'https://example.com/logo.png',
  title: 'Pilot Wanted',
  description: 'Need a pilot for cargo runs',
  tags: ['pilot', 'cargo'],
  postedAt: new Date('2026-01-15'),
  expiresAt: new Date('2026-03-15'),
  isActive: true,
  jobType: JobType.CREW,
  payDisplay: '50k-100k aUEC',
  payMin: 50000,
  payMax: 100000,
  experienceLevel: 3,
  listingCategory: ListingCategory.JOB,
  crewSpotsTotal: 5,
  crewSpotsFilled: 2,
};

const mockJobItem2 = {
  id: 'job-2',
  organizationId: 'org-2',
  organizationName: 'Another Org',
  title: 'Gunner Needed',
  description: 'Turret gunner for combat ops',
  tags: ['combat'],
  postedAt: new Date('2026-01-20'),
  isActive: true,
  jobType: JobType.COMBAT,
  listingCategory: ListingCategory.JOB,
};

const mockActivity = {
  id: 'act-1',
  title: 'Mining Operation',
  description: 'Group mining in Aaron Halo',
  organizationId: 'org-1',
  organizationName: 'Test Org',
  activityType: ActivityType.MINING,
  status: ActivityStatus.OPEN,
  createdAt: new Date('2026-01-18'),
  scheduledStartDate: new Date('2026-02-01'),
  currentParticipants: 3,
  maxParticipants: 10,
  location: 'Aaron Halo',
  difficulty: 'medium',
  tags: ['mining'],
};

const mockActivity2 = {
  id: 'act-2',
  title: 'Bounty Hunt',
  description: 'Taking down NPC bounties',
  organizationId: 'org-2',
  status: ActivityStatus.IN_PROGRESS,
  activityType: ActivityType.COMBAT,
  createdAt: new Date('2026-01-22'),
  currentParticipants: 2,
  maxParticipants: 4,
  tags: ['combat'],
};

// ==================== MOCK SERVICES ====================

function createMockJobService() {
  return {
    getPublicJobListings: jest.fn().mockResolvedValue({
      data: [mockJobItem, mockJobItem2],
      pagination: { total: 2, page: 1, limit: 40, totalPages: 1, hasNext: false, hasPrev: false },
    }),
  };
}

function createMockActivityService() {
  return {
    searchActivities: jest.fn().mockResolvedValue({
      activities: [mockActivity, mockActivity2],
      total: 2,
      page: 1,
      totalPages: 1,
    }),
  };
}

// ==================== TESTS ====================

describe('OpportunitySearchService', () => {
  let service: OpportunitySearchService;
  let mockJobService: ReturnType<typeof createMockJobService>;
  let mockActivityService: ReturnType<typeof createMockActivityService>;

  beforeEach(() => {
    mockJobService = createMockJobService();
    mockActivityService = createMockActivityService();
    service = new OpportunitySearchService(mockJobService as never, mockActivityService as never);
  });

  describe('countOpportunities', () => {
    it('sums job and activity totals by default', async () => {
      await expect(service.countOpportunities()).resolves.toBe(4);
      expect(mockJobService.getPublicJobListings).toHaveBeenCalled();
      expect(mockActivityService.searchActivities).toHaveBeenCalled();
    });

    it('counts only jobs when sourceType is job', async () => {
      await expect(service.countOpportunities({ sourceType: 'job' })).resolves.toBe(2);
      expect(mockJobService.getPublicJobListings).toHaveBeenCalled();
      expect(mockActivityService.searchActivities).not.toHaveBeenCalled();
    });

    it('counts only activities when sourceType is activity', async () => {
      await expect(service.countOpportunities({ sourceType: 'activity' })).resolves.toBe(2);
      expect(mockActivityService.searchActivities).toHaveBeenCalled();
      expect(mockJobService.getPublicJobListings).not.toHaveBeenCalled();
    });
  });

  describe('searchOpportunities', () => {
    it('should return merged results from both sources by default', async () => {
      const result = await service.searchOpportunities({});

      expect(result.data).toHaveLength(4);
      expect(result.pagination.total).toBe(4);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(mockJobService.getPublicJobListings).toHaveBeenCalled();
      expect(mockActivityService.searchActivities).toHaveBeenCalled();
    });

    it('should fetch only jobs when sourceType is job', async () => {
      const filters: UnifiedOpportunityFilters = { sourceType: 'job' };
      const result = await service.searchOpportunities(filters);

      expect(mockJobService.getPublicJobListings).toHaveBeenCalled();
      expect(mockActivityService.searchActivities).not.toHaveBeenCalled();
      expect(result.data.every(item => item.sourceType === 'job')).toBe(true);
      expect(result.pagination.total).toBe(2);
    });

    it('should fetch only activities when sourceType is activity', async () => {
      const filters: UnifiedOpportunityFilters = { sourceType: 'activity' };
      const result = await service.searchOpportunities(filters);

      expect(mockJobService.getPublicJobListings).not.toHaveBeenCalled();
      expect(mockActivityService.searchActivities).toHaveBeenCalled();
      expect(result.data.every(item => item.sourceType === 'activity')).toBe(true);
      expect(result.pagination.total).toBe(2);
    });

    it('should fetch both when sourceType is all', async () => {
      const filters: UnifiedOpportunityFilters = { sourceType: 'all' };
      const result = await service.searchOpportunities(filters);

      expect(mockJobService.getPublicJobListings).toHaveBeenCalled();
      expect(mockActivityService.searchActivities).toHaveBeenCalled();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should pass searchTerm to job service', async () => {
      const filters: UnifiedOpportunityFilters = { searchTerm: 'pilot', sourceType: 'job' };
      await service.searchOpportunities(filters);

      expect(mockJobService.getPublicJobListings).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: 'pilot' }),
        expect.any(Object)
      );
    });

    it('should pass filters to activity service', async () => {
      const filters: UnifiedOpportunityFilters = {
        sourceType: 'activity',
        activityTypes: [ActivityType.BOUNTY],
        hasOpenSlots: true,
      };
      await service.searchOpportunities(filters);

      expect(mockActivityService.searchActivities).toHaveBeenCalledWith(
        expect.objectContaining({
          activityType: [ActivityType.BOUNTY],
          hasOpenSlots: true,
          visibility: 'public',
        }),
        1,
        expect.any(Number)
      );
    });

    it('should pass organizationId to both services', async () => {
      const filters: UnifiedOpportunityFilters = { organizationId: 'org-1' };
      await service.searchOpportunities(filters);

      expect(mockJobService.getPublicJobListings).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.any(Object)
      );
      expect(mockActivityService.searchActivities).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1' }),
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('should apply default pagination (page 1, limit 20)', async () => {
      const result = await service.searchOpportunities({});

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
    });

    it('should apply custom pagination', async () => {
      const pagination: PaginationOptions = { page: 2, limit: 10 };
      const result = await service.searchOpportunities({}, pagination);

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(10);
    });

    it('should calculate totalPages correctly', async () => {
      // 4 total items, limit=2 => 2 pages
      const pagination: PaginationOptions = { page: 1, limit: 2 };
      const result = await service.searchOpportunities({}, pagination);

      expect(result.pagination.totalPages).toBe(2);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(false);
    });

    it('should paginate merged results with offset', async () => {
      const pagination: PaginationOptions = { page: 2, limit: 2 };
      const result = await service.searchOpportunities({}, pagination);

      // Page 2 of 4 items with limit 2 = items 3 and 4
      expect(result.data.length).toBeLessThanOrEqual(2);
      expect(result.pagination.hasPrev).toBe(true);
    });

    it('should sort by postedAt DESC by default', async () => {
      const result = await service.searchOpportunities({});

      // Items should be sorted newest first
      for (let i = 0; i < result.data.length - 1; i++) {
        const dateA = new Date(result.data[i].postedAt).getTime();
        const dateB = new Date(result.data[i + 1].postedAt).getTime();
        expect(dateA).toBeGreaterThanOrEqual(dateB);
      }
    });

    it('should sort by postedAt ASC when specified', async () => {
      const pagination: PaginationOptions = { sortBy: 'postedAt', sortOrder: 'ASC' };
      const result = await service.searchOpportunities({}, pagination);

      for (let i = 0; i < result.data.length - 1; i++) {
        const dateA = new Date(result.data[i].postedAt).getTime();
        const dateB = new Date(result.data[i + 1].postedAt).getTime();
        expect(dateA).toBeLessThanOrEqual(dateB);
      }
    });

    it('should sort by title ASC when specified', async () => {
      const pagination: PaginationOptions = { sortBy: 'title', sortOrder: 'ASC' };
      const result = await service.searchOpportunities({}, pagination);

      for (let i = 0; i < result.data.length - 1; i++) {
        expect(result.data[i].title.localeCompare(result.data[i + 1].title)).toBeLessThanOrEqual(0);
      }
    });

    it('should fallback to postedAt when sortBy is invalid', async () => {
      const pagination: PaginationOptions = { sortBy: 'invalid_field', sortOrder: 'DESC' };
      const result = await service.searchOpportunities({}, pagination);

      // Should still sort by postedAt DESC
      for (let i = 0; i < result.data.length - 1; i++) {
        const dateA = new Date(result.data[i].postedAt).getTime();
        const dateB = new Date(result.data[i + 1].postedAt).getTime();
        expect(dateA).toBeGreaterThanOrEqual(dateB);
      }
    });

    it('should pass job-specific filters correctly', async () => {
      const filters: UnifiedOpportunityFilters = {
        sourceType: 'job',
        jobTypes: [JobType.CREW],
        payTypes: [PayType.HOURLY],
        listingCategory: ListingCategory.JOB,
        minPay: 10000,
        maxPay: 200000,
      };
      await service.searchOpportunities(filters);

      expect(mockJobService.getPublicJobListings).toHaveBeenCalledWith(
        expect.objectContaining({
          jobTypes: [JobType.CREW],
          payTypes: [PayType.HOURLY],
          listingCategory: ListingCategory.JOB,
          minPay: 10000,
          maxPay: 200000,
          isActive: true,
        }),
        expect.any(Object)
      );
    });

    it('should pass activity-specific filters correctly', async () => {
      const filters: UnifiedOpportunityFilters = {
        sourceType: 'activity',
        activityStatus: [ActivityStatus.OPEN],
        isFeatured: true,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
      };
      await service.searchOpportunities(filters);

      expect(mockActivityService.searchActivities).toHaveBeenCalledWith(
        expect.objectContaining({
          status: [ActivityStatus.OPEN],
          isFeatured: true,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
        }),
        1,
        expect.any(Number)
      );
    });

    it('should default activity status to OPEN and IN_PROGRESS when not specified', async () => {
      const filters: UnifiedOpportunityFilters = { sourceType: 'activity' };
      await service.searchOpportunities(filters);

      expect(mockActivityService.searchActivities).toHaveBeenCalledWith(
        expect.objectContaining({
          status: [ActivityStatus.OPEN, ActivityStatus.IN_PROGRESS],
        }),
        1,
        expect.any(Number)
      );
    });
  });

  describe('error handling', () => {
    it('should return activities when job fetch fails', async () => {
      mockJobService.getPublicJobListings.mockRejectedValue(new Error('DB error'));

      const result = await service.searchOpportunities({});

      expect(result.data).toHaveLength(2);
      expect(result.data.every(item => item.sourceType === 'activity')).toBe(true);
      expect(result.pagination.total).toBe(2);
    });

    it('should return jobs when activity fetch fails', async () => {
      mockActivityService.searchActivities.mockRejectedValue(new Error('Timeout'));

      const result = await service.searchOpportunities({});

      expect(result.data).toHaveLength(2);
      expect(result.data.every(item => item.sourceType === 'job')).toBe(true);
      expect(result.pagination.total).toBe(2);
    });

    it('should return empty results when both fetches fail', async () => {
      mockJobService.getPublicJobListings.mockRejectedValue(new Error('DB error'));
      mockActivityService.searchActivities.mockRejectedValue(new Error('Timeout'));

      const result = await service.searchOpportunities({});

      expect(result.data).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });
  });

  describe('normalizeJob', () => {
    it('should normalize a job item to unified format', async () => {
      mockJobService.getPublicJobListings.mockResolvedValue({
        data: [mockJobItem],
        pagination: { total: 1, page: 1, limit: 40, totalPages: 1, hasNext: false, hasPrev: false },
      });
      mockActivityService.searchActivities.mockResolvedValue({
        activities: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });

      const result = await service.searchOpportunities({ sourceType: 'job' });
      const item = result.data[0];

      expect(item.sourceType).toBe('job');
      expect(item.id).toBe('job-1');
      expect(item.title).toBe('Pilot Wanted');
      expect(item.organizationName).toBe('Test Org');
      expect(item.jobType).toBe(JobType.CREW);
      expect(item.payMin).toBe(50000);
      expect(item.payMax).toBe(100000);
      expect(item.listingCategory).toBe(ListingCategory.JOB);
      expect(item.crewSpotsTotal).toBe(5);
      expect(item.crewSpotsFilled).toBe(2);
    });
  });

  describe('normalizeActivity', () => {
    it('should normalize an activity to unified format', async () => {
      mockJobService.getPublicJobListings.mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 40, totalPages: 0, hasNext: false, hasPrev: false },
      });
      mockActivityService.searchActivities.mockResolvedValue({
        activities: [mockActivity],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const result = await service.searchOpportunities({ sourceType: 'activity' });
      const item = result.data[0];

      expect(item.sourceType).toBe('activity');
      expect(item.id).toBe('act-1');
      expect(item.title).toBe('Mining Operation');
      expect(item.organizationName).toBe('Test Org');
      expect(item.activityType).toBe(ActivityType.MINING);
      expect(item.activityStatus).toBe(ActivityStatus.OPEN);
      expect(item.location).toBe('Aaron Halo');
      expect(item.difficulty).toBe('medium');
      expect(item.maxParticipants).toBe(10);
      expect(item.currentParticipants).toBe(3);
      expect(item.isActive).toBe(true);
    });

    it('should set isActive based on activity status', async () => {
      const closedActivity = {
        ...mockActivity,
        id: 'act-closed',
        status: ActivityStatus.COMPLETED,
      };
      mockJobService.getPublicJobListings.mockResolvedValue({
        data: [],
        pagination: { total: 0, page: 1, limit: 40, totalPages: 0, hasNext: false, hasPrev: false },
      });
      mockActivityService.searchActivities.mockResolvedValue({
        activities: [closedActivity],
        total: 1,
        page: 1,
        totalPages: 1,
      });

      const result = await service.searchOpportunities({ sourceType: 'activity' });
      const item = result.data[0];

      expect(item.isActive).toBe(false);
    });
  });

  describe('over-fetch behavior', () => {
    it('should request double the pagination limit from each source', async () => {
      const pagination: PaginationOptions = { page: 1, limit: 10 };
      await service.searchOpportunities({}, pagination);

      // Over-fetch: limit * 2 = 20
      expect(mockJobService.getPublicJobListings).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ limit: 20 })
      );
      expect(mockActivityService.searchActivities).toHaveBeenCalledWith(expect.any(Object), 1, 20);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
