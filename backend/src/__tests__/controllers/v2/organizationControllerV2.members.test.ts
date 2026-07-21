import { Request, Response } from 'express';

import { AppDataSource } from '../../../config/database';
import { OrganizationControllerV2 } from '../../../controllers/v2/organizationController';
import { CrewAssignment } from '../../../models/CrewAssignment';
import { Organization } from '../../../models/Organization';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { TeamMember } from '../../../models/TeamMember';

jest.mock('../../../config/database');
jest.mock('../../../middleware/queryParser');

const mockQueryParser = require('../../../middleware/queryParser');

describe('OrganizationControllerV2 - getMembers filtering', () => {
  let controller: OrganizationControllerV2;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  let mockOrgQueryBuilder: {
    where: jest.Mock;
    leftJoinAndSelect: jest.Mock;
    getOne: jest.Mock;
  };
  let mockOrgRepository: { createQueryBuilder: jest.Mock };
  let mockMemberQueryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let mockMemberRepository: { createQueryBuilder: jest.Mock };

  let mockTeamQueryBuilder: {
    leftJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };
  let mockTeamMemberRepository: { createQueryBuilder: jest.Mock };

  let mockCrewRepository: { find: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Test Org' }),
    };

    mockOrgRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockOrgQueryBuilder),
    };

    mockMemberQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };

    mockMemberRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockMemberQueryBuilder),
    };

    mockTeamQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockTeamMemberRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockTeamQueryBuilder),
    };

    mockCrewRepository = {
      find: jest.fn().mockResolvedValue([]),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === Organization) return mockOrgRepository;
      if (entity === OrganizationMembership) return mockMemberRepository;
      if (entity === TeamMember) return mockTeamMemberRepository;
      if (entity === CrewAssignment) return mockCrewRepository;
      return {};
    });

    controller = new OrganizationControllerV2();

    mockQueryParser.buildHateoasLinks.mockReturnValue({
      self: '/api/v2/organizations/org-1/members?limit=25&offset=0',
      first: '/api/v2/organizations/org-1/members?limit=25&offset=0',
      last: '/api/v2/organizations/org-1/members?limit=25&offset=0',
    });

    mockRequest = {
      params: { id: 'org-1' },
      query: {},
      queryParams: {
        limit: 25,
        offset: 0,
        search: null,
        filters: {},
      },
    };

    mockResponse = {
      paginated: jest.fn(),
      success: jest.fn(),
    };
  });

  afterAll(() => {
    const { enhancedCacheService } = require('../../../services/caching/EnhancedCacheService');
    enhancedCacheService.shutdown();
  });

  it('applies search and role filters from query params', async () => {
    mockRequest.query = { search: 'Ace', role: 'Officer' };
    mockRequest.queryParams = {
      limit: 25,
      offset: 0,
      search: 'Ace',
      filters: {},
    };

    await controller.getMembers(mockRequest as Request, mockResponse as Response);

    expect(mockMemberQueryBuilder.andWhere).toHaveBeenCalledWith(
      'membership.isActive = :isActive',
      {
        isActive: true,
      }
    );
    expect(mockMemberQueryBuilder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('user.username ILIKE :searchTerm'),
      { searchTerm: '%Ace%' }
    );
    expect(mockMemberQueryBuilder.andWhere).toHaveBeenCalledWith('LOWER(memberRole.name) = :role', {
      role: 'officer',
    });
    expect(mockMemberQueryBuilder.orderBy).toHaveBeenCalledWith('membership.joinedAt', 'DESC');
    expect(mockMemberQueryBuilder.skip).toHaveBeenCalledWith(0);
    expect(mockMemberQueryBuilder.take).toHaveBeenCalledWith(25);

    expect(mockQueryParser.buildHateoasLinks).toHaveBeenCalledWith(
      '/api/v2/organizations/org-1/members',
      0,
      25,
      0,
      { search: 'Ace', role: 'officer' }
    );
  });

  it('applies role filter from parsed filter object fallback', async () => {
    mockRequest.queryParams = {
      limit: 25,
      offset: 0,
      search: null,
      filters: { role: 'Admin' },
    };

    await controller.getMembers(mockRequest as Request, mockResponse as Response);

    expect(mockMemberQueryBuilder.andWhere).toHaveBeenCalledWith('LOWER(memberRole.name) = :role', {
      role: 'admin',
    });
    expect(mockQueryParser.buildHateoasLinks).toHaveBeenCalledWith(
      '/api/v2/organizations/org-1/members',
      0,
      25,
      0,
      { role: 'admin' }
    );
  });

  it('ignores role filter when role is all', async () => {
    mockRequest.query = { role: 'all' };

    await controller.getMembers(mockRequest as Request, mockResponse as Response);

    const roleFilterCalls = mockMemberQueryBuilder.andWhere.mock.calls.filter(
      ([sql]: [string]) => typeof sql === 'string' && sql.includes('LOWER(memberRole.name)')
    );

    expect(roleFilterCalls).toHaveLength(0);
    expect(mockQueryParser.buildHateoasLinks).toHaveBeenCalledWith(
      '/api/v2/organizations/org-1/members',
      0,
      25,
      0,
      undefined
    );
  });

  it('returns enriched member payload when filtered results include members', async () => {
    const joinedAt = new Date('2026-05-01T00:00:00.000Z');
    const lastLoginAt = new Date('2026-05-24T00:00:00.000Z');
    const createdAt = new Date('2025-01-15T00:00:00.000Z');

    mockRequest.query = { search: 'Ace' };
    mockRequest.queryParams = {
      limit: 25,
      offset: 0,
      search: 'Ace',
      filters: {},
    };

    mockMemberQueryBuilder.getManyAndCount.mockResolvedValue([
      [
        {
          userId: 'user-1',
          organizationId: 'org-1',
          role: { name: 'officer' },
          joinedAt,
          securityLevel: 2,
          title: 'XO',
          user: {
            username: 'AcePilot',
            displayName: 'Ace Pilot',
            avatar: null,
            rsiHandle: 'AcePilotRSI',
            rsiVerified: true,
            discordId: '1234',
            lastLoginAt,
            createdAt,
          },
        },
      ],
      1,
    ]);

    mockTeamQueryBuilder.getMany.mockResolvedValue([
      {
        userId: 'user-1',
        role: 'lead',
        rank: 'captain',
        team: { name: 'Alpha Wing' },
      },
    ]);

    mockCrewRepository.find.mockResolvedValue([
      {
        organizationId: 'org-1',
        status: 'active',
        shipId: 'ship-1',
        crew: [{ userId: 'user-1', role: 'pilot' }],
      },
    ]);

    await controller.getMembers(mockRequest as Request, mockResponse as Response);

    const [items, pagination] = (mockResponse.paginated as jest.Mock).mock.calls[0];

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        role: 'officer',
        teams: [{ teamName: 'Alpha Wing', teamRole: 'lead', rank: 'captain' }],
        crewAssignments: [{ shipId: 'ship-1', crewRole: 'pilot' }],
      })
    );
    expect(pagination).toEqual(
      expect.objectContaining({ total: 1, limit: 25, offset: 0, hasMore: false })
    );
  });
});
