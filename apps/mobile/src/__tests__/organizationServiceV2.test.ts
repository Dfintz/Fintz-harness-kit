import { apiClient } from '../services/apiClient';
import { organizationServiceV2 } from '../services/organizationServiceV2';

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

describe('OrganizationServiceV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyOrganizations', () => {
    it('should fetch user organizations', async () => {
      const mockOrgs = [{ id: 'org-1', name: 'Test Org' }];
      mockApiClient.get.mockResolvedValue({ data: mockOrgs } as never);

      const result = await organizationServiceV2.getMyOrganizations();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/users/me/organizations');
      expect(result).toEqual(mockOrgs);
    });
  });

  describe('getOrganizationById', () => {
    it('should fetch a single org', async () => {
      const mockOrg = { id: 'org-1', name: 'Test Org' };
      mockApiClient.get.mockResolvedValue({ data: mockOrg } as never);

      const result = await organizationServiceV2.getOrganizationById('org-1');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/v2/organizations/org-1');
      expect(result).toEqual(mockOrg);
    });
  });

  describe('getOrganizationMembers', () => {
    it('should fetch members with pagination', async () => {
      const mockResponse = {
        data: [{ userId: 'u1', role: 'Admin', organizationId: 'org-1', joinedAt: new Date() }],
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

      const result = await organizationServiceV2.getOrganizationMembers('org-1');

      expect(mockApiClient.getPaginated).toHaveBeenCalledWith(
        '/api/v2/organizations/org-1/members',
        expect.any(Object)
      );
      expect(result.items).toHaveLength(1);
    });
  });

  describe('createOrganization', () => {
    it('should create a new organization', async () => {
      const mockOrg = { id: 'new-org', name: 'New Org' };
      mockApiClient.post.mockResolvedValue({ data: mockOrg } as never);

      const result = await organizationServiceV2.createOrganization({ name: 'New Org' });

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/v2/organizations', { name: 'New Org' });
      expect(result).toEqual(mockOrg);
    });
  });

  describe('getOrganizationStatistics', () => {
    it('should fetch org statistics', async () => {
      const mockStats = { totalMembers: 10, totalShips: 20, totalFleets: 3, totalActivities: 5 };
      mockApiClient.get.mockResolvedValue({ data: mockStats } as never);

      const result = await organizationServiceV2.getOrganizationStatistics('org-1');

      expect(result).toEqual(mockStats);
    });
  });
});
