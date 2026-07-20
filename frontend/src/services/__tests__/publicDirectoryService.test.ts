import axios from 'axios';
import {
  ActivityLevel,
  DirectoryFilters,
  OrgPrimaryFocus,
  PaginationOptions,
  publicDirectoryService,
} from '@/services/publicDirectoryService';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PublicDirectoryService', () => {
  const API_BASE_URL = '/api';
  const API_V2_BASE_URL = '/api/v2';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listOrganizations', () => {
    it('fetches organizations without filters', async () => {
      const mockResponse = {
        data: {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await publicDirectoryService.listOrganizations();

      expect(mockedAxios.get).toHaveBeenCalledWith(`${API_V2_BASE_URL}/directory/organizations`);
      expect(result.data).toEqual([]);
      expect(result.pagination).toEqual(mockResponse.data.pagination);
    });

    it('applies filters correctly', async () => {
      const mockResponse = {
        data: {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      const filters: DirectoryFilters = {
        primaryFocus: 'combat',
        isRecruiting: true,
        minMemberCount: 10,
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await publicDirectoryService.listOrganizations(filters);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations?primaryFocus=combat&isRecruiting=true&minMemberCount=10`
      );
    });

    it('applies pagination options', async () => {
      const mockResponse = {
        data: {
          data: [],
          pagination: {
            total: 0,
            page: 2,
            limit: 50,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      const pagination: PaginationOptions = {
        page: 2,
        limit: 50,
        sortBy: 'memberCount',
        sortOrder: 'DESC',
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await publicDirectoryService.listOrganizations({}, pagination);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations?page=2&limit=50&sortBy=memberCount&sortOrder=DESC`
      );
    });

    it('handles multi-select filters (Phase 2)', async () => {
      const mockResponse = {
        data: {
          organizations: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      const filters: DirectoryFilters = {
        primaryFocuses: ['combat', 'mining', 'trading'],
        activityLevels: ['high', 'very_high'],
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await publicDirectoryService.listOrganizations(filters);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations?primaryFocuses=combat%2Cmining%2Ctrading&activityLevels=high%2Cvery_high`
      );
    });
  });

  describe('getPublicProfile', () => {
    it('fetches organization profile by ID', async () => {
      const mockProfile = {
        id: 'profile-1',
        organizationId: 'org-123',
        organizationName: 'Test Org',
        primaryFocus: 'combat' as OrgPrimaryFocus,
        memberCount: 100,
        activityLevel: 'high' as ActivityLevel,
        isVerified: true,
        isRecruiting: true,
      };

      mockedAxios.get.mockResolvedValue({ data: { data: mockProfile } });

      const result = await publicDirectoryService.getPublicProfile('org-123');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations/org-123`
      );
      expect(result).toEqual(mockProfile);
    });

    it('handles API errors', async () => {
      const error = {
        response: { status: 404 },
        isAxiosError: true,
      };
      mockedAxios.get.mockRejectedValue(error);
      mockedAxios.isAxiosError.mockReturnValue(true);

      const result = await publicDirectoryService.getPublicProfile('invalid');
      expect(result).toBeNull();
    });
  });

  describe('getDirectory with search', () => {
    it('performs search with query string', async () => {
      const mockResponse = {
        data: {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await publicDirectoryService.getDirectory({ search: 'test query' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations?search=test+query`
      );
    });

    it('combines search with filters', async () => {
      const mockResponse = {
        data: {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      const filters: DirectoryFilters = {
        search: 'test',
        primaryFocus: 'mining',
        isRecruiting: true,
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await publicDirectoryService.getDirectory(filters);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations?primaryFocus=mining&isRecruiting=true&search=test`
      );
    });
  });

  describe('createOrUpdateProfile', () => {
    it('creates/updates a profile via updateProfile', async () => {
      const profileData = {
        organizationId: 'org-123',
        organizationName: 'New Org',
        primaryFocus: 'combat' as OrgPrimaryFocus,
        isRecruiting: true,
      };

      const mockResponse = {
        data: {
          data: {
            id: 'profile-1',
            organizationId: 'org-123',
            organizationName: 'New Org',
            primaryFocus: 'combat' as OrgPrimaryFocus,
            memberCount: 50,
            activityLevel: 'moderate' as ActivityLevel,
            isVerified: false,
            isPublic: true,
            isRecruiting: true,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        },
      };

      mockedAxios.patch.mockResolvedValue(mockResponse);

      const result = await publicDirectoryService.createOrUpdateProfile(profileData);

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        `${API_BASE_URL}/organizations/org-123/public-profile`,
        { primaryFocus: 'combat', isRecruiting: true }
      );
      expect(result.organizationId).toBe('org-123');
    });

    it('updates an existing profile', async () => {
      const profileData = {
        organizationId: 'org-123',
        organizationName: 'Updated Org',
        primaryFocus: 'trading' as OrgPrimaryFocus,
        isRecruiting: false,
      };

      const mockResponse = {
        data: {
          data: {
            id: 'profile-1',
            organizationId: 'org-123',
            organizationName: 'Updated Org',
            primaryFocus: 'trading' as OrgPrimaryFocus,
            memberCount: 75,
            activityLevel: 'high' as ActivityLevel,
            isVerified: true,
            isPublic: true,
            isRecruiting: false,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-02',
          },
        },
      };

      mockedAxios.patch.mockResolvedValue(mockResponse);

      const result = await publicDirectoryService.createOrUpdateProfile(profileData);

      expect(result.updatedAt).toBeTruthy();
      expect(result.primaryFocus).toBe('trading');
    });
  });

  describe('setPublicVisibility', () => {
    it('sets profile visibility', async () => {
      const mockResponse = {
        data: {
          data: {
            id: 'profile-1',
            organizationId: 'org-123',
            organizationName: 'Test Org',
            primaryFocus: 'combat' as OrgPrimaryFocus,
            memberCount: 100,
            activityLevel: 'high' as ActivityLevel,
            isVerified: true,
            isRecruiting: true,
            isPublic: false,
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        },
      };

      mockedAxios.patch.mockResolvedValue(mockResponse);

      const result = await publicDirectoryService.setPublicVisibility('org-123', false);

      expect(mockedAxios.patch).toHaveBeenCalledWith(
        `${API_BASE_URL}/organizations/org-123/public-profile`,
        { isPublic: false }
      );
      expect(result.isPublic).toBe(false);
    });
  });

  describe('getFilterOptions', () => {
    it('returns static filter options (client-side)', async () => {
      const result = await publicDirectoryService.getFilterOptions();

      // v2 API returns static options client-side (no HTTP call)
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(result.focusOptions).toHaveLength(13);
      expect(result.activityLevelOptions).toHaveLength(5);
      expect(result.focusOptions).toContain('combat');
      expect(result.activityLevelOptions).toContain('high');
    });
  });

  describe('getDirectoryStats', () => {
    it('fetches directory statistics', async () => {
      const mockStats = {
        data: {
          data: {
            totalOrganizations: 150,
            recruitingOrganizations: 75,
            verifiedOrganizations: 50,
            byFocus: {
              combat: 40,
              mining: 30,
              trading: 25,
            },
          },
        },
      };

      mockedAxios.get.mockResolvedValue(mockStats);

      const result = await publicDirectoryService.getDirectoryStats();

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations/stats`
      );
      expect(result.totalOrganizations).toBe(150);
      expect(result.recruitingOrganizations).toBe(75);
    });
  });

  describe('error handling', () => {
    it('handles network errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(publicDirectoryService.listOrganizations()).rejects.toThrow('Network error');
    });

    it('handles API error responses', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: { message: 'Invalid request' },
        },
      };

      mockedAxios.get.mockRejectedValue(errorResponse);

      await expect(publicDirectoryService.listOrganizations()).rejects.toBeTruthy();
    });

    it('handles unauthorized access', async () => {
      const errorResponse = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };

      mockedAxios.patch.mockRejectedValue(errorResponse);

      await expect(
        publicDirectoryService.createOrUpdateProfile({
          organizationId: 'org-123',
          organizationName: 'Test',
          primaryFocus: 'combat',
          isRecruiting: false,
        })
      ).rejects.toBeTruthy();
    });
  });

  describe('backward compatibility', () => {
    it('handles legacy single-value filters', async () => {
      const mockResponse = {
        data: {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      const filters: DirectoryFilters = {
        primaryFocus: 'combat', // Legacy single value
        activityLevel: 'high', // Legacy single value
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await publicDirectoryService.listOrganizations(filters);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations?primaryFocus=combat&activityLevel=high`
      );
    });

    it('prefers multi-select over single-value filters', async () => {
      const mockResponse = {
        data: {
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 20,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
      };

      const filters: DirectoryFilters = {
        primaryFocus: 'combat', // Legacy
        primaryFocuses: ['mining', 'trading'], // New multi-select (should take precedence)
      };

      mockedAxios.get.mockResolvedValue(mockResponse);

      await publicDirectoryService.listOrganizations(filters);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `${API_V2_BASE_URL}/directory/organizations?primaryFocuses=mining%2Ctrading`
      );
    });
  });
});
