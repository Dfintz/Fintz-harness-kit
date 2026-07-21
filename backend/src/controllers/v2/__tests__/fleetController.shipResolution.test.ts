const mockGetRepository = jest.fn();

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: (...args: unknown[]) => mockGetRepository(...args),
  },
}));

import { OrganizationShip } from '../../../models/OrganizationShip';
import { Ship } from '../../../models/Ship';
import { UserShip } from '../../../models/UserShip';

import { resolveShipIds } from '../fleetController.shipResolution';

type QueryBuilderMock<T> = {
  where: jest.Mock;
  andWhere: jest.Mock;
  getMany: jest.Mock<Promise<T[]>, []>;
};

const makeQueryBuilder = <T>(rows: T[]): QueryBuilderMock<T> => {
  const queryBuilder: QueryBuilderMock<T> = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  return queryBuilder;
};

const makeRepo = <T>(queryBuilder: QueryBuilderMock<T>) => ({
  createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
});

describe('fleetController.shipResolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves IDs from organization ships first, then user ships, then catalog ships', async () => {
    const orgQueryBuilder = makeQueryBuilder([{ id: 'os-1', shipId: 'ship-a' }]);
    const userQueryBuilder = makeQueryBuilder([{ id: 'us-1', shipId: 'ship-b' }]);
    const catalogQueryBuilder = makeQueryBuilder([{ id: 'ship-c' }]);

    mockGetRepository.mockImplementation((entity: unknown) => {
      if (entity === OrganizationShip) {
        return makeRepo(orgQueryBuilder);
      }
      if (entity === UserShip) {
        return makeRepo(userQueryBuilder);
      }
      if (entity === Ship) {
        return makeRepo(catalogQueryBuilder);
      }
      throw new Error('Unexpected repository request');
    });

    const resolved = await resolveShipIds(['os-1', 'us-1', 'ship-c'], 'org-1');

    expect([...resolved.entries()]).toEqual([
      ['os-1', 'ship-a'],
      ['us-1', 'ship-b'],
      ['ship-c', 'ship-c'],
    ]);

    expect(orgQueryBuilder.where).toHaveBeenCalledWith('os.id IN (:...shipIds)', {
      shipIds: ['os-1', 'us-1', 'ship-c'],
    });
    expect(orgQueryBuilder.andWhere).toHaveBeenCalledWith('os.organizationId = :organizationId', {
      organizationId: 'org-1',
    });
    expect(userQueryBuilder.where).toHaveBeenCalledWith('us.id IN (:...unresolvedIds)', {
      unresolvedIds: ['us-1', 'ship-c'],
    });
    expect(catalogQueryBuilder.where).toHaveBeenCalledWith('s.id IN (:...stillUnresolved)', {
      stillUnresolved: ['ship-c'],
    });
  });

  it('short-circuits user and catalog lookups when organization ship resolution is complete', async () => {
    const orgQueryBuilder = makeQueryBuilder([
      { id: 'os-1', shipId: 'ship-a' },
      { id: 'os-2', shipId: 'ship-b' },
    ]);
    const userQueryBuilder = makeQueryBuilder([]);
    const catalogQueryBuilder = makeQueryBuilder([]);

    mockGetRepository.mockImplementation((entity: unknown) => {
      if (entity === OrganizationShip) {
        return makeRepo(orgQueryBuilder);
      }
      if (entity === UserShip) {
        return makeRepo(userQueryBuilder);
      }
      if (entity === Ship) {
        return makeRepo(catalogQueryBuilder);
      }
      throw new Error('Unexpected repository request');
    });

    const resolved = await resolveShipIds(['os-1', 'os-2'], 'org-1');

    expect([...resolved.entries()]).toEqual([
      ['os-1', 'ship-a'],
      ['os-2', 'ship-b'],
    ]);
    expect(userQueryBuilder.getMany).not.toHaveBeenCalled();
    expect(catalogQueryBuilder.getMany).not.toHaveBeenCalled();
  });

  it('ignores user ship rows with null shipId', async () => {
    const orgQueryBuilder = makeQueryBuilder([]);
    const userQueryBuilder = makeQueryBuilder([{ id: 'us-1', shipId: null }]);
    const catalogQueryBuilder = makeQueryBuilder([{ id: 'ship-z' }]);

    mockGetRepository.mockImplementation((entity: unknown) => {
      if (entity === OrganizationShip) {
        return makeRepo(orgQueryBuilder);
      }
      if (entity === UserShip) {
        return makeRepo(userQueryBuilder);
      }
      if (entity === Ship) {
        return makeRepo(catalogQueryBuilder);
      }
      throw new Error('Unexpected repository request');
    });

    const resolved = await resolveShipIds(['us-1', 'ship-z'], 'org-1');

    expect([...resolved.entries()]).toEqual([['ship-z', 'ship-z']]);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
