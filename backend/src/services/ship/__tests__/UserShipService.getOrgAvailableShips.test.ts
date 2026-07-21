import { AppDataSource } from '../../../data-source';
import { User } from '../../../models/User';
import {
  ShipCondition,
  ShipOwnershipStatus,
  ShipSharingLevel,
  UserShip,
} from '../../../models/UserShip';
import { attachCatalogueMetadata } from '../OrganizationShipService';
import { UserShipService } from '../UserShipService';

jest.mock('../../../config/database');
jest.mock('../OrganizationShipService', () => ({
  attachCatalogueMetadata: jest.fn(async ships => ships),
}));

describe('UserShipService - getOrgAvailableShips', () => {
  let service: UserShipService;
  let mockShipQueryBuilder: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let mockUserQueryBuilder: {
    select: jest.Mock;
    where: jest.Mock;
    getMany: jest.Mock;
  };
  let mockUserShipRepository: {
    createQueryBuilder: jest.Mock;
    metadata: { name: string };
  };
  let mockUserRepository: {
    createQueryBuilder: jest.Mock;
    metadata: { name: string };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockShipQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    mockUserQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    mockUserShipRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockShipQueryBuilder),
      metadata: { name: 'UserShip' },
    };

    mockUserRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockUserQueryBuilder),
      metadata: { name: 'User' },
    };

    (AppDataSource.getRepository as jest.Mock) = jest.fn((entity: unknown) => {
      if (entity === User) {
        return mockUserRepository;
      }
      return mockUserShipRepository;
    });

    service = new UserShipService();
  });

  it('includes public-sharing ships for organization fleet visibility', async () => {
    const attachCatalogueMetadataMock = attachCatalogueMetadata as jest.MockedFunction<
      typeof attachCatalogueMetadata
    >;

    const mockShips: UserShip[] = [
      {
        id: 'ship-1',
        userId: 'user-1',
        shipName: 'Cutlass Black',
        status: ShipOwnershipStatus.OWNED,
        condition: ShipCondition.GOOD,
        sharingLevel: ShipSharingLevel.PUBLIC,
        isActive: true,
      } as UserShip,
      {
        id: 'ship-2',
        userId: 'user-2',
        shipName: 'Constellation Andromeda',
        status: ShipOwnershipStatus.PLEDGED,
        condition: ShipCondition.EXCELLENT,
        sharingLevel: ShipSharingLevel.ORGANIZATION,
        isActive: true,
      } as UserShip,
    ];

    mockShipQueryBuilder.getManyAndCount.mockResolvedValue([mockShips, 2]);
    mockUserQueryBuilder.getMany.mockResolvedValue([{ id: 'user-1', username: 'PilotOne' }]);

    const result = await service.getOrgAvailableShips('org-123', {
      page: 1,
      limit: 50,
      sortBy: 'shipName',
      sortOrder: 'ASC',
    });

    expect(mockShipQueryBuilder.andWhere).toHaveBeenCalledWith(
      'ship.sharingLevel IN (:...sharingLevels)',
      {
        sharingLevels: [
          ShipSharingLevel.ORGANIZATION,
          ShipSharingLevel.ALLIANCE,
          ShipSharingLevel.PUBLIC,
        ],
      }
    );

    expect(attachCatalogueMetadataMock).toHaveBeenCalled();
    expect(result.pagination.total).toBe(2);
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({ id: 'ship-1', ownerName: 'PilotOne' });
    expect(result.data[1]).toMatchObject({ id: 'ship-2', ownerName: undefined });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

