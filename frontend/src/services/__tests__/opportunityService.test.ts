import { apiClient } from '@/services/apiClient';
import { OpportunitySearchResponse, searchOpportunities } from '@/services/opportunityService';

jest.mock('../apiClient', () => {
  const actual = jest.requireActual('../apiClient');
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
  };
});

describe('opportunityService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockResponse: OpportunitySearchResponse = {
    data: [
      {
        id: 'job-1',
        sourceType: 'job',
        title: 'Pilot Needed',
        description: 'Looking for an experienced pilot',
        jobType: 'PILOT',
        payDisplay: '10,000 aUEC/hr',
      },
      {
        id: 'act-1',
        sourceType: 'activity',
        title: 'Mining Run',
        description: 'Group mining expedition',
        activityType: 'MINING',
        activityStatus: 'OPEN',
      },
    ],
    pagination: {
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  describe('searchOpportunities', () => {
    it('should call the correct API endpoint with default params', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await searchOpportunities();

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(
        expect.stringContaining('/search/opportunities'),
        {
          params: {
            page: '1',
            limit: '20',
            sortBy: 'postedAt',
            sortOrder: 'DESC',
          },
        }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should pass custom pagination params', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({}, 3, 50, 'title', 'ASC');

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({
          page: '3',
          limit: '50',
          sortBy: 'title',
          sortOrder: 'ASC',
        }),
      });
    });

    it('should include sourceType when not "all"', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ sourceType: 'job' });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ sourceType: 'job' }),
      });
    });

    it('should exclude sourceType when "all"', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ sourceType: 'all' });

      const calledParams = (apiClient.get as jest.Mock).mock.calls[0][1]?.params as Record<
        string,
        string
      >;
      expect(calledParams.sourceType).toBeUndefined();
    });

    it('should pass searchTerm', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ searchTerm: 'mining' });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ searchTerm: 'mining' }),
      });
    });

    it('should pass organizationId', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ organizationId: 'org-123' });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ organizationId: 'org-123' }),
      });
    });

    it('should join tags as comma-separated string', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ tags: ['mining', 'combat', 'pve'] });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ tags: 'mining,combat,pve' }),
      });
    });

    it('should not include empty tags array', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ tags: [] });

      const calledParams = (apiClient.get as jest.Mock).mock.calls[0][1]?.params as Record<
        string,
        string
      >;
      expect(calledParams.tags).toBeUndefined();
    });

    it('should join jobTypes as comma-separated string', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ jobTypes: ['PILOT', 'GUNNER'] });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ jobTypes: 'PILOT,GUNNER' }),
      });
    });

    it('should join payTypes as comma-separated string', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ payTypes: ['FIXED', 'HOURLY'] });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ payTypes: 'FIXED,HOURLY' }),
      });
    });

    it('should pass listingCategory', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ listingCategory: 'STANDARD' });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ listingCategory: 'STANDARD' }),
      });
    });

    it('should convert minPay and maxPay to strings', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ minPay: 500, maxPay: 5000 });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ minPay: '500', maxPay: '5000' }),
      });
    });

    it('should join activityTypes as comma-separated string', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ activityTypes: ['MINING', 'COMBAT'] });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ activityTypes: 'MINING,COMBAT' }),
      });
    });

    it('should join activityStatus as comma-separated string', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ activityStatus: ['OPEN', 'IN_PROGRESS'] });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ activityStatus: 'OPEN,IN_PROGRESS' }),
      });
    });

    it('should convert boolean hasOpenSlots to string', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ hasOpenSlots: true });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ hasOpenSlots: 'true' }),
      });
    });

    it('should convert boolean isFeatured to string', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ isFeatured: false });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({ isFeatured: 'false' }),
      });
    });

    it('should pass startDate and endDate as strings', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({ startDate: '2025-01-01', endDate: '2025-12-31' });

      expect(apiClient.get as jest.Mock).toHaveBeenCalledWith(expect.any(String), {
        params: expect.objectContaining({
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        }),
      });
    });

    it('should not include undefined optional filters', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await searchOpportunities({});

      const calledParams = (apiClient.get as jest.Mock).mock.calls[0][1]?.params as Record<
        string,
        string
      >;
      // Only default pagination params should be present
      expect(Object.keys(calledParams)).toEqual(
        expect.arrayContaining(['page', 'limit', 'sortBy', 'sortOrder'])
      );
      expect(calledParams.sourceType).toBeUndefined();
      expect(calledParams.searchTerm).toBeUndefined();
      expect(calledParams.organizationId).toBeUndefined();
    });

    it('should propagate API errors', async () => {
      (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(searchOpportunities()).rejects.toThrow('Network error');
    });
  });
});

