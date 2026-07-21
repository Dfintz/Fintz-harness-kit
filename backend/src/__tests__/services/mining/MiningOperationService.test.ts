import { MiningOperation, MiningOperationStatus } from '../../../models/MiningOperation';
import { NotFoundError, ValidationError } from '../../../utils/apiErrors';

const mockRepository = {
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  remove: jest.fn(),
};

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue(mockRepository),
  },
}));

jest.mock('../../../utils/pagination', () => ({
  paginateRepository: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
}));

import { MiningOperationService } from '../../../services/mining/MiningOperationService';
import { paginateRepository } from '../../../utils/pagination';

describe('MiningOperationService', () => {
  let service: MiningOperationService;

  const mockOperation: Partial<MiningOperation> = {
    id: 'mining-uuid',
    name: 'Yela Extraction',
    description: 'Mining operation on Yela',
    location: 'Yela - Aaron Halo',
    coordinatorId: 'user-1',
    scheduledDate: new Date('2026-04-01'),
    status: MiningOperationStatus.PLANNED,
    crew: [],
    resourcesFound: [],
    totalValue: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MiningOperationService();
  });

  describe('create', () => {
    it('should create operation with UUID and PLANNED status', async () => {
      mockRepository.create.mockReturnValue({ ...mockOperation });
      mockRepository.save.mockResolvedValue({ ...mockOperation });

      const result = await service.create({
        name: 'Yela Extraction',
        location: 'Yela - Aaron Halo',
        coordinatorId: 'user-1',
        scheduledDate: '2026-04-01T00:00:00Z',
      });

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f]{8}-/),
          status: MiningOperationStatus.PLANNED,
          crew: [],
          resourcesFound: [],
          totalValue: 0,
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('findAll', () => {
    it('should delegate to paginateRepository', async () => {
      await service.findAll({ page: 1, limit: 10 });

      expect(paginateRepository).toHaveBeenCalledWith(
        mockRepository,
        { page: 1, limit: 10 },
        undefined,
        'createdAt'
      );
    });
  });

  describe('findById', () => {
    it('should return operation when found', async () => {
      mockRepository.findOne.mockResolvedValue(mockOperation);

      const result = await service.findById('mining-uuid');

      expect(result).toEqual(mockOperation);
    });

    it('should throw NotFoundError when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('missing')).rejects.toThrow(NotFoundError);
      await expect(service.findById('missing')).rejects.toThrow('Mining operation');
    });
  });

  describe('update', () => {
    it('should update allowed fields', async () => {
      const operation = { ...mockOperation } as MiningOperation;
      mockRepository.findOne.mockResolvedValue(operation);
      mockRepository.save.mockResolvedValue(operation);

      await service.update('mining-uuid', {
        location: 'Aberdeen',
        description: 'Updated description',
      });

      expect(operation.location).toBe('Aberdeen');
      expect(operation.description).toBe('Updated description');
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should map resourceType to name field', async () => {
      const operation = { ...mockOperation } as MiningOperation;
      mockRepository.findOne.mockResolvedValue(operation);
      mockRepository.save.mockResolvedValue(operation);

      await service.update('mining-uuid', { resourceType: 'Quantanium' });

      expect(operation.name).toBe('Quantanium');
    });
  });

  describe('updateStatus', () => {
    it('should update status with valid value', async () => {
      const operation = { ...mockOperation } as MiningOperation;
      mockRepository.findOne.mockResolvedValue(operation);
      mockRepository.save.mockResolvedValue(operation);

      const result = await service.updateStatus('mining-uuid', MiningOperationStatus.IN_PROGRESS);

      expect(result.status).toBe(MiningOperationStatus.IN_PROGRESS);
    });

    it('should set completedDate when completed', async () => {
      const operation = { ...mockOperation } as MiningOperation;
      mockRepository.findOne.mockResolvedValue(operation);
      mockRepository.save.mockResolvedValue(operation);

      const result = await service.updateStatus('mining-uuid', MiningOperationStatus.COMPLETED);

      expect(result.completedDate).toBeDefined();
    });

    it('should throw ValidationError for invalid status', async () => {
      await expect(
        service.updateStatus('mining-uuid', 'BOGUS' as MiningOperationStatus)
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('addCrewMember', () => {
    it('should add crew member to operation', async () => {
      const operation = { ...mockOperation, crew: [] } as MiningOperation;
      mockRepository.findOne.mockResolvedValue(operation);
      mockRepository.save.mockResolvedValue(operation);

      const result = await service.addCrewMember('mining-uuid', {
        userId: 'user-2',
        role: 'miner',
        shipId: 'ship-1',
      });

      expect(result.crew).toHaveLength(1);
      expect(result.crew[0].role).toBe('miner');
    });
  });

  describe('recordResources', () => {
    it('should add resource and increment totalValue', async () => {
      const operation = {
        ...mockOperation,
        resourcesFound: [],
        totalValue: 100,
      } as MiningOperation;
      mockRepository.findOne.mockResolvedValue(operation);
      mockRepository.save.mockResolvedValue(operation);

      const result = await service.recordResources('mining-uuid', {
        resourceType: 'Quantanium',
        quantity: 50,
        value: 500,
      });

      expect(result.resourcesFound).toHaveLength(1);
      expect(result.totalValue).toBe(600); // 100 + 500
    });
  });

  describe('delete', () => {
    it('should remove operation when found', async () => {
      const operation = { ...mockOperation } as MiningOperation;
      mockRepository.findOne.mockResolvedValue(operation);
      mockRepository.remove.mockResolvedValue(operation);

      await expect(service.delete('mining-uuid')).resolves.toBeUndefined();
      expect(mockRepository.remove).toHaveBeenCalledWith(operation);
    });

    it('should throw NotFoundError when not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.delete('missing')).rejects.toThrow(NotFoundError);
    });
  });
});
