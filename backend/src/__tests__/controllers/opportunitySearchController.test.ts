/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from 'express';

// Declare mock functions before jest.mock
const mockSearchOpportunities = jest.fn();

jest.mock('../../services/search/OpportunitySearchService', () => ({
  OpportunitySearchService: jest.fn().mockImplementation(() => ({
    searchOpportunities: mockSearchOpportunities,
  })),
}));

import { opportunitySearchController } from '../../controllers/opportunitySearchController';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'user-1', role: 'admin' },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response & { statusCode?: number; data?: any } {
  const res: any = {
    statusCode: 200,
    data: null,
    status: jest.fn().mockImplementation((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn().mockImplementation((body: any) => {
      res.data = body;
      return res;
    }),
  };
  return res;
}

describe('OpportunitySearchController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchOpportunities', () => {
    const mockResult = {
      items: [
        {
          id: 'job-1',
          sourceType: 'job',
          title: 'Pilot Needed',
          postedAt: '2025-01-15T00:00:00.000Z',
        },
        {
          id: 'act-1',
          sourceType: 'activity',
          title: 'Mining Run',
          postedAt: '2025-01-16T00:00:00.000Z',
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    };

    it('should call service with default filters and pagination', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: {} as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        {},
        {
          page: 1,
          limit: 20,
          sortBy: 'postedAt',
          sortOrder: 'DESC',
        }
      );
      expect(res.statusCode).toBe(200);
      expect(res.data).toEqual(mockResult);
    });

    it('should parse sourceType filter', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { sourceType: 'job' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: 'job' }),
        expect.any(Object)
      );
    });

    it('should parse searchTerm and trim whitespace', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { searchTerm: '  mining  ' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: 'mining' }),
        expect.any(Object)
      );
    });

    it('should parse organizationId', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { organizationId: 'org-123' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-123' }),
        expect.any(Object)
      );
    });

    it('should parse comma-separated tags', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { tags: 'mining,combat,trading' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ tags: ['mining', 'combat', 'trading'] }),
        expect.any(Object)
      );
    });

    it('should parse comma-separated jobTypes', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { jobTypes: 'PILOT,GUNNER' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ jobTypes: ['PILOT', 'GUNNER'] }),
        expect.any(Object)
      );
    });

    it('should parse comma-separated payTypes', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { payTypes: 'FIXED,HOURLY' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ payTypes: ['FIXED', 'HOURLY'] }),
        expect.any(Object)
      );
    });

    it('should parse listingCategory', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { listingCategory: 'STANDARD' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ listingCategory: 'STANDARD' }),
        expect.any(Object)
      );
    });

    it('should parse minPay and maxPay as integers', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { minPay: '500', maxPay: '5000' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ minPay: 500, maxPay: 5000 }),
        expect.any(Object)
      );
    });

    it('should parse comma-separated activityTypes', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { activityTypes: 'MINING,COMBAT' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ activityTypes: ['MINING', 'COMBAT'] }),
        expect.any(Object)
      );
    });

    it('should parse comma-separated activityStatus', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { activityStatus: 'OPEN,IN_PROGRESS' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ activityStatus: ['OPEN', 'IN_PROGRESS'] }),
        expect.any(Object)
      );
    });

    it('should parse boolean hasOpenSlots=true', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { hasOpenSlots: 'true' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ hasOpenSlots: true }),
        expect.any(Object)
      );
    });

    it('should parse boolean hasOpenSlots=false', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { hasOpenSlots: 'false' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ hasOpenSlots: false }),
        expect.any(Object)
      );
    });

    it('should parse boolean isFeatured', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { isFeatured: 'true' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.objectContaining({ isFeatured: true }),
        expect.any(Object)
      );
    });

    it('should parse startDate and endDate as Date objects', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({
        query: { startDate: '2025-01-01', endDate: '2025-12-31' } as any,
      });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      const calledFilters = mockSearchOpportunities.mock.calls[0][0];
      expect(calledFilters.startDate).toBeInstanceOf(Date);
      expect(calledFilters.endDate).toBeInstanceOf(Date);
    });

    it('should parse custom pagination params', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({
        query: { page: '3', limit: '50', sortBy: 'title', sortOrder: 'ASC' } as any,
      });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(expect.any(Object), {
        page: 3,
        limit: 50,
        sortBy: 'title',
        sortOrder: 'ASC',
      });
    });

    it('should cap limit at 100', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: { limit: '500' } as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ limit: 100 })
      );
    });

    it('should handle all filters combined', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({
        query: {
          sourceType: 'activity',
          searchTerm: 'mining',
          organizationId: 'org-1',
          tags: 'pve,group',
          activityTypes: 'MINING',
          activityStatus: 'OPEN',
          hasOpenSlots: 'true',
          isFeatured: 'true',
          startDate: '2025-06-01',
          endDate: '2025-06-30',
          page: '2',
          limit: '10',
          sortBy: 'title',
          sortOrder: 'ASC',
        } as any,
      });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(mockSearchOpportunities).toHaveBeenCalledWith(
        {
          sourceType: 'activity',
          searchTerm: 'mining',
          organizationId: 'org-1',
          tags: ['pve', 'group'],
          activityTypes: ['MINING'],
          activityStatus: ['OPEN'],
          hasOpenSlots: true,
          isFeatured: true,
          startDate: expect.any(Date),
          endDate: expect.any(Date),
        },
        {
          page: 2,
          limit: 10,
          sortBy: 'title',
          sortOrder: 'ASC',
        }
      );
    });

    it('should return 500 when service throws', async () => {
      mockSearchOpportunities.mockRejectedValue(new Error('Service failure'));

      const req = mockReq({ query: {} as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      expect(res.statusCode).toBe(500);
    });

    it('should not set filters for empty query params', async () => {
      mockSearchOpportunities.mockResolvedValue(mockResult);

      const req = mockReq({ query: {} as any });
      const res = mockRes();

      await opportunitySearchController.searchOpportunities(req, res);

      const calledFilters = mockSearchOpportunities.mock.calls[0][0];
      // None of the optional filter fields should be set
      expect(calledFilters.sourceType).toBeUndefined();
      expect(calledFilters.searchTerm).toBeUndefined();
      expect(calledFilters.organizationId).toBeUndefined();
      expect(calledFilters.tags).toBeUndefined();
      expect(calledFilters.jobTypes).toBeUndefined();
      expect(calledFilters.payTypes).toBeUndefined();
      expect(calledFilters.activityTypes).toBeUndefined();
      expect(calledFilters.activityStatus).toBeUndefined();
    });
  });
});
