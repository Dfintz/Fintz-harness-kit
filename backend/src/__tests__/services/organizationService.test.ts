// Mock TypeORM before imports
import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';
const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

// Mock domain services
jest.mock('../../services/organization/OrganizationMemberService');
jest.mock('../../services/organization/OrganizationPermissionService');
jest.mock('../../services/organization/OrganizationActivityService');
jest.mock('../../services/organization/OrganizationDeletionService');

import { Organization } from '../../models/Organization';
import { OrganizationService } from '../../services/organization';
import { OrganizationActivityService } from '../../services/organization/OrganizationActivityService';
import { OrganizationDeletionService } from '../../services/organization/OrganizationDeletionService';
import { OrganizationMemberService } from '../../services/organization/OrganizationMemberService';
import { OrganizationPermissionService } from '../../services/organization/OrganizationPermissionService';

describe('OrganizationService', () => {
  let organizationService: OrganizationService;
  let mockOrganizations: Partial<Organization>[];
  let mockQueryBuilder: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOrganizations = [];

    const mockRepo = createMockRepositoryWithData(mockOrganizations);

    // Setup query builder to return data properly
    mockQueryBuilder = {
      connection: { options: { type: 'postgres' } },
      where: jest.fn(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([mockOrganizations, mockOrganizations.length]),
      getMany: jest.fn().mockResolvedValue(mockOrganizations),
      getOne: jest.fn().mockImplementation(() => {
        const lookupId = mockQueryBuilder.__lookupId as string | undefined;
        if (!lookupId) {
          return Promise.resolve((mockOrganizations[0] as any) || null);
        }

        const found = mockOrganizations.find((org: any) => org.id === lookupId) || null;
        return Promise.resolve(found as any);
      }),
      getCount: jest.fn().mockResolvedValue(0),
    };

    mockQueryBuilder.where.mockImplementation((_sql: string, params?: { id?: string }) => {
      mockQueryBuilder.__lookupId = params?.id;
      return mockQueryBuilder;
    });

    mockRepo.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
    mockDataSource.getRepository.mockReturnValue(mockRepo);

    organizationService = new OrganizationService();

    // Mock domain service methods
    (OrganizationMemberService.prototype.addMember as jest.Mock) = jest.fn().mockResolvedValue({});
    (OrganizationMemberService.prototype.removeMember as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (OrganizationPermissionService.prototype.applyPermissionTemplate as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (OrganizationPermissionService.prototype.getUserPermissions as jest.Mock) = jest
      .fn()
      .mockResolvedValue([]);
    (OrganizationPermissionService.prototype.checkPermission as jest.Mock) = jest
      .fn()
      .mockResolvedValue({ allowed: true });
    (OrganizationActivityService.prototype.logOrgCreated as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (OrganizationActivityService.prototype.logOrgUpdated as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (OrganizationActivityService.prototype.logOrgDeleted as jest.Mock) = jest
      .fn()
      .mockResolvedValue(undefined);
    (OrganizationDeletionService.prototype.createDeletionRequest as jest.Mock) = jest
      .fn()
      .mockResolvedValue({
        id: 'deletion-req-123',
        organizationId: '1',
        requestedBy: 'actor-123',
        scheduledFor: new Date(),
      });

    // Patch getDescendants to always return an array
    if (organizationService && typeof (organizationService as any).getDescendants === 'function') {
      jest.spyOn(organizationService as any, 'getDescendants').mockResolvedValue([]);
    }
  });

  afterAll(() => {
    const { enhancedCacheService } = require('../../services/caching/EnhancedCacheService');
    enhancedCacheService.shutdown();
  });

  describe('getOrganizations', () => {
    it('should return all organizations', async () => {
      mockOrganizations.push(
        { id: '1', name: 'Org Alpha', members: ['user1', 'user2'] } as any,
        { id: '2', name: 'Org Beta', members: ['user3'] } as any
      );

      const result = await organizationService.getOrganizations();

      expect(result).toEqual(
        expect.objectContaining({
          data: expect.arrayContaining(mockOrganizations),
        })
      );
    });

    it('should preserve relevance ordering for name search with secondary sort', async () => {
      await organizationService.getOrganizations(
        { name: 'org' },
        { sortBy: 'name', sortOrder: 'ASC' }
      );

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('org.name', 'ASC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith(
        "ts_rank(org.search_vector, to_tsquery('english', :tsquery_orgName))",
        'DESC'
      );
    });
  });

  describe('searchOrganizations', () => {
    it('should keep rank ordering and append member/name ordering for text search', async () => {
      await organizationService.searchOrganizations('org', {}, { page: 1, limit: 10 });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('org.memberCount', 'DESC');
      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('org.name', 'ASC');
    });
  });

  describe('getOrganizationById', () => {
    it('should return an organization by ID', async () => {
      const mockOrg = { id: '1', name: 'Org Alpha', members: ['user1'] };
      mockOrganizations.push(mockOrg as any);

      const result = await organizationService.getOrganizationById('1');

      expect(result).toEqual(mockOrg);
    });

    it('should return null if organization not found', async () => {
      const result = await organizationService.getOrganizationById('999');

      expect(result).toBeNull();
    });
  });

  describe('createOrganization', () => {
    it('should create and save a new organization', async () => {
      const orgData = { id: '1', name: 'Org Alpha', members: ['user1'] };

      const result = await organizationService.createOrganization(orgData, 'creator-123');

      expect(result).toMatchObject(orgData);
      expect(mockOrganizations).toContainEqual(expect.objectContaining(orgData));
    });
  });

  describe('deleteOrganization', () => {
    it('should create a deletion request for an organization', async () => {
      mockOrganizations.push({ id: '1', name: 'To Delete' } as any);

      const result = await organizationService.deleteOrganization('1', 'actor-123');

      // Should return a deletion request, not immediately delete
      expect(result).toHaveProperty('requestId');
      expect(result).toHaveProperty('message');
      // Organization should still exist (not deleted yet)
      expect(mockOrganizations.find(o => o.id === '1')).toBeDefined();
    });
  });

  describe('updateOrganization', () => {
    it('should update and return the organization', async () => {
      mockOrganizations.push({ id: '1', name: 'Original Org', members: [] } as any);
      const orgData = { name: 'Updated Org' };

      await organizationService.updateOrganization('1', orgData, 'actor-123');

      const updated = mockOrganizations.find(o => o.id === '1');
      expect(updated?.name).toBe('Updated Org');
    });
  });
});
