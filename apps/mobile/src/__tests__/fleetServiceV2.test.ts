import { apiClient } from '../services/apiClient';
import { fleetServiceV2 } from '../services/fleetServiceV2';

// Mock apiClient
jest.mock('../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    getPaginated: jest.fn(),
    setTokenProvider: jest.fn(),
  },
  ApiClientError: class ApiClientError extends Error {
    code: string;
    statusCode: number;
    constructor(message: string, code: string, statusCode: number) {
      super(message);
      this.code = code;
      this.statusCode = statusCode;
    }
  },
}));

jest.mock('../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('FleetServiceV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFleets', () => {
    it('should fetch fleets for an organization', async () => {
      const mockResponse = {
        data: [{ id: '1', name: 'Alpha Fleet' }],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
        },
      };
      mockApiClient.getPaginated.mockResolvedValue(mockResponse as never);

      const result = await fleetServiceV2.getFleets('org-1');

      expect(mockApiClient.getPaginated).toHaveBeenCalledWith(
        '/api/v2/organizations/org-1/fleets',
        expect.objectContaining({ params: expect.objectContaining({ page: 1, limit: 20 }) })
      );
      expect(result.items).toEqual([{ id: '1', name: 'Alpha Fleet' }]);
      expect(result.pagination.total).toBe(1);
    });

    it('should pass search params', async () => {
      const mockResponse = {
        data: [],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        },
      };
      mockApiClient.getPaginated.mockResolvedValue(mockResponse as never);

      await fleetServiceV2.getFleets('org-1', { search: 'alpha', page: 2, limit: 10 });

      expect(mockApiClient.getPaginated).toHaveBeenCalledWith(
        '/api/v2/organizations/org-1/fleets',
        expect.objectContaining({
          params: expect.objectContaining({ search: 'alpha', page: 2, limit: 10 }),
        })
      );
    });
  });

  describe('getFleetById', () => {
    it('should fetch a fleet by ID', async () => {
      const mockFleet = { id: 'fleet-1', name: 'Test Fleet' };
      mockApiClient.get.mockResolvedValue({ data: mockFleet } as never);

      const result = await fleetServiceV2.getFleetById('fleet-1');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/fleets/fleet-1');
      expect(result).toEqual(mockFleet);
    });
  });

  describe('createFleet', () => {
    it('should create a fleet', async () => {
      const mockFleet = { id: 'new-fleet', name: 'New Fleet' };
      mockApiClient.post.mockResolvedValue({ data: mockFleet } as never);

      const result = await fleetServiceV2.createFleet('org-1', { name: 'New Fleet' });

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v2/organizations/org-1/fleets', {
        name: 'New Fleet',
      });
      expect(result).toEqual(mockFleet);
    });
  });

  describe('updateFleet', () => {
    it('should update a fleet', async () => {
      const mockFleet = { id: 'fleet-1', name: 'Updated' };
      mockApiClient.put.mockResolvedValue({ data: mockFleet } as never);

      const result = await fleetServiceV2.updateFleet('fleet-1', { name: 'Updated' });

      expect(mockApiClient.put).toHaveBeenCalledWith('/api/v2/fleets/fleet-1', { name: 'Updated' });
      expect(result).toEqual(mockFleet);
    });
  });

  describe('deleteFleet', () => {
    it('should delete a fleet', async () => {
      mockApiClient.delete.mockResolvedValue({} as never);

      await fleetServiceV2.deleteFleet('fleet-1');

      expect(mockApiClient.delete).toHaveBeenCalledWith('/api/v2/fleets/fleet-1');
    });
  });

  describe('getFleetStatistics', () => {
    it('should fetch fleet statistics', async () => {
      const mockStats = { totalFleets: 3, totalShips: 15, totalMembers: 42 };
      mockApiClient.get.mockResolvedValue({ data: mockStats } as never);

      const result = await fleetServiceV2.getFleetStatistics('org-1');

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/v2/organizations/org-1/fleets/statistics'
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('getFleetShips', () => {
    it('should fetch ships for a fleet', async () => {
      const mockResponse = {
        data: [{ id: 's1', name: 'Aurora' }],
        meta: {
          pagination: {
            page: 1,
            limit: 20,
            total: 1,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
        },
      };
      mockApiClient.getPaginated.mockResolvedValue(mockResponse as never);

      const result = await fleetServiceV2.getFleetShips('fleet-1');

      expect(mockApiClient.getPaginated).toHaveBeenCalledWith(
        '/api/v2/fleets/fleet-1/ships',
        expect.any(Object)
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('getFleetComposition', () => {
    it('should fetch fleet composition', async () => {
      const mockComposition = {
        fleetId: 'f1',
        totalShips: 5,
        byRole: {},
        byManufacturer: {},
        bySize: {},
      };
      mockApiClient.get.mockResolvedValue({ data: mockComposition } as never);

      const result = await fleetServiceV2.getFleetComposition('f1');

      expect(result).toEqual(mockComposition);
    });
  });
});
