import { CargoManifest, ManifestStatus } from '../../../models/CargoManifest';
import { Ship } from '../../../models/Ship';
import { NotFoundError, ValidationError } from '../../../utils/apiErrors';

const mockManifestRepository = {
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockShipRepository = {
  createQueryBuilder: jest.fn(),
};

const mockManifestQueryBuilder = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getOne: jest.fn(),
};

const mockShipQueryBuilder = {
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawOne: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockImplementation((entity: unknown) => {
      if (entity === Ship) {
        return mockShipRepository;
      }
      return mockManifestRepository;
    }),
  },
}));

jest.mock('../../../utils/pagination', () => ({
  paginateQueryBuilder: jest.fn().mockResolvedValue({
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  }),
}));

import { CargoManifestService } from '../../../services/fleet/CargoManifestService';
import { paginateQueryBuilder } from '../../../utils/pagination';

describe('CargoManifestService', () => {
  let service: CargoManifestService;

  const mockManifest: Partial<CargoManifest> = {
    id: 'manifest-uuid',
    shipId: 'ship-1',
    ownerId: 'user-1',
    cargo: [{ itemName: 'Laranite', quantity: 100, unitValue: 50, totalValue: 5000 }],
    origin: 'Port Olisar',
    destination: 'Lorville',
    sharedWithFleet: false,
    sharedWithAlliance: false,
    status: ManifestStatus.LOADING,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockManifestRepository.createQueryBuilder.mockReturnValue(mockManifestQueryBuilder);
    mockShipRepository.createQueryBuilder.mockReturnValue(mockShipQueryBuilder);
    mockShipQueryBuilder.getRawOne.mockResolvedValue({ id: 'ship-1' });
    service = new CargoManifestService();
  });

  describe('create', () => {
    it('should create manifest with UUID id', async () => {
      mockManifestRepository.create.mockReturnValue({ ...mockManifest });
      mockManifestRepository.save.mockResolvedValue({ ...mockManifest });

      const result = await service.create(
        {
          shipId: 'ship-1',
          origin: 'Port Olisar',
          destination: 'Lorville',
        },
        'org-1',
        'user-1'
      );

      expect(mockManifestRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f]{8}-/),
          shipId: 'ship-1',
          ownerId: 'user-1',
          status: ManifestStatus.LOADING,
          cargo: [],
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should delegate to paginateQueryBuilder', async () => {
      await service.findAll({ page: 1, limit: 10 }, 'org-1');

      expect(paginateQueryBuilder).toHaveBeenCalledWith(mockManifestQueryBuilder, {
        page: 1,
        limit: 10,
      });
    });
  });

  describe('findById', () => {
    it('should return manifest when found', async () => {
      mockManifestQueryBuilder.getOne.mockResolvedValue(mockManifest);

      const result = await service.findById('manifest-uuid', 'org-1');

      expect(result).toEqual(mockManifest);
    });

    it('should throw NotFoundError when not found', async () => {
      mockManifestQueryBuilder.getOne.mockResolvedValue(null);

      await expect(service.findById('missing', 'org-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('addCargoItem', () => {
    it('should add cargo item with calculated totalValue', async () => {
      const manifest = { ...mockManifest, cargo: [] } as CargoManifest;
      mockManifestQueryBuilder.getOne.mockResolvedValue(manifest);
      mockManifestRepository.save.mockResolvedValue(manifest);

      const result = await service.addCargoItem('manifest-uuid', 'org-1', {
        itemName: 'Titanium',
        quantity: 10,
        unitValue: 25,
      });

      expect(result.cargo).toHaveLength(1);
      expect(result.cargo[0].totalValue).toBe(250);
    });

    it('should handle item without unitValue', async () => {
      const manifest = { ...mockManifest, cargo: [] } as CargoManifest;
      mockManifestQueryBuilder.getOne.mockResolvedValue(manifest);
      mockManifestRepository.save.mockResolvedValue(manifest);

      await service.addCargoItem('manifest-uuid', 'org-1', {
        itemName: 'Scrap',
        quantity: 50,
      });

      expect(manifest.cargo[0].totalValue).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('should update status correctly', async () => {
      const manifest = { ...mockManifest } as CargoManifest;
      mockManifestQueryBuilder.getOne.mockResolvedValue(manifest);
      mockManifestRepository.save.mockResolvedValue(manifest);

      const result = await service.updateStatus(
        'manifest-uuid',
        'org-1',
        ManifestStatus.IN_TRANSIT
      );

      expect(result.status).toBe(ManifestStatus.IN_TRANSIT);
      expect(result.departureDate).toBeDefined();
    });

    it('should set arrivalDate when delivered', async () => {
      const manifest = {
        ...mockManifest,
        departureDate: new Date(),
      } as CargoManifest;
      mockManifestQueryBuilder.getOne.mockResolvedValue(manifest);
      mockManifestRepository.save.mockResolvedValue(manifest);

      const result = await service.updateStatus('manifest-uuid', 'org-1', ManifestStatus.DELIVERED);

      expect(result.arrivalDate).toBeDefined();
    });

    it('should throw ValidationError for invalid status', async () => {
      await expect(
        service.updateStatus('manifest-uuid', 'org-1', 'INVALID' as ManifestStatus)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('updateSharing', () => {
    it('should update sharing flags', async () => {
      const manifest = { ...mockManifest } as CargoManifest;
      mockManifestQueryBuilder.getOne.mockResolvedValue(manifest);
      mockManifestRepository.save.mockResolvedValue(manifest);

      const result = await service.updateSharing('manifest-uuid', 'org-1', {
        sharedWithFleet: true,
        sharedWithAlliance: true,
      });

      expect(result.sharedWithFleet).toBe(true);
      expect(result.sharedWithAlliance).toBe(true);
    });

    it('should only update provided fields', async () => {
      const manifest = {
        ...mockManifest,
        sharedWithFleet: false,
        sharedWithAlliance: true,
      } as CargoManifest;
      mockManifestQueryBuilder.getOne.mockResolvedValue(manifest);
      mockManifestRepository.save.mockResolvedValue(manifest);

      await service.updateSharing('manifest-uuid', 'org-1', { sharedWithFleet: true });

      expect(manifest.sharedWithFleet).toBe(true);
      expect(manifest.sharedWithAlliance).toBe(true); // unchanged
    });
  });
});
