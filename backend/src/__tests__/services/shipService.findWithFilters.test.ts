import { ShipService } from '../../services/ship/ShipService';

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

import { AppDataSource } from '../../data-source';

const mockQueryBuilder = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue([]),
  connection: { options: { type: 'postgres' } },
};

const mockRepository = {
  metadata: { name: 'Ship' },
  createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
};

describe('ShipService.findWithFilters ordering', () => {
  let service: ShipService;

  beforeEach(() => {
    jest.clearAllMocks();
    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
    service = new ShipService();
  });

  it('should preserve relevance ordering and append ship name ordering when search is present', async () => {
    await service.findWithFilters('org-1', { search: 'pilot' });

    expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('ship.name', 'ASC');
    expect(mockQueryBuilder.orderBy).not.toHaveBeenCalledWith('ship.name', 'ASC');
  });

  it('should keep direct ship name ordering when search is absent', async () => {
    await service.findWithFilters('org-1', {});

    expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('ship.name', 'ASC');
  });
});
