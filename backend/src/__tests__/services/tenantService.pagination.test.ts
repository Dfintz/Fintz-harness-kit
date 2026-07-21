import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { Repository } from 'typeorm';
import { TenantEntity } from '../../models/base/TenantEntity';
import { TenantService } from '../../services/base/TenantService';

// Create a concrete implementation for testing
class TestEntity extends TenantEntity {
  id!: string;
  name!: string;
  createdAt!: Date;
}

class TestTenantService extends TenantService<TestEntity> {
  constructor(repository: Repository<TestEntity>) {
    super(repository);
  }
}

describe('TenantService - Pagination Methods', () => {
  let testService: TestTenantService;
  let mockRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      metadata: {
        name: 'TestEntity',
        tableName: 'test_entity',
        targetName: 'TestEntity',
        columns: [],
        relations: [],
        primaryColumns: [{ propertyName: 'id', databaseName: 'id' }],
      },
    };

    testService = new TestTenantService(mockRepository);
  });

  describe('findAllPaginated', () => {
    it('should return paginated results with correct structure', async () => {
      const mockData = [
        { id: '1', name: 'Entity 1', organizationId: 'org-123' },
        { id: '2', name: 'Entity 2', organizationId: 'org-123' },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockData, 25]);

      const result = await testService.findAllPaginated('org-123', {
        page: 1,
        limit: 10,
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toEqual(mockData);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNext: true,
        hasPrev: false,
      });
    });

    it('should apply correct pagination parameters', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await testService.findAllPaginated('org-123', {
        page: 3,
        limit: 20,
        sortBy: 'name',
        sortOrder: 'ASC',
      });

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        skip: 40, // (page 3 - 1) * 20
        take: 20,
        order: { name: 'ASC' },
      });
    });

    it('should use default values for missing pagination options', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await testService.findAllPaginated('org-123', {});

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });

    it('should correctly calculate hasNext and hasPrev', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 100]);

      // First page
      let result = await testService.findAllPaginated('org-123', { page: 1, limit: 10 });
      expect(result.pagination.hasPrev).toBe(false);
      expect(result.pagination.hasNext).toBe(true);

      // Middle page
      result = await testService.findAllPaginated('org-123', { page: 5, limit: 10 });
      expect(result.pagination.hasPrev).toBe(true);
      expect(result.pagination.hasNext).toBe(true);

      // Last page
      result = await testService.findAllPaginated('org-123', { page: 10, limit: 10 });
      expect(result.pagination.hasPrev).toBe(true);
      expect(result.pagination.hasNext).toBe(false);
    });

    it('should handle additional where conditions', async () => {
      mockRepository.findAndCount.mockResolvedValue([[], 0]);

      await testService.findAllPaginated('org-123', { page: 1, limit: 10 }, {
        name: 'test',
      } as any);

      expect(mockRepository.findAndCount).toHaveBeenCalledWith({
        where: { organizationId: 'org-123', name: 'test' },
        skip: 0,
        take: 10,
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findAllPaginatedWithQuery', () => {
    let mockQueryBuilder: any;

    beforeEach(() => {
      mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
    });

    it('should return paginated results using query builder', async () => {
      const mockData = [{ id: '1', name: 'Entity 1' }];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockData, 50]);

      const result = await testService.findAllPaginatedWithQuery('org-123', {
        page: 2,
        limit: 10,
      });

      expect(result.data).toEqual(mockData);
      expect(result.pagination.total).toBe(50);
      expect(result.pagination.totalPages).toBe(5);
    });

    it('should apply custom query builder callback', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await testService.findAllPaginatedWithQuery('org-123', { page: 1, limit: 10 }, qb => {
        qb.andWhere('entity.name LIKE :name', { name: '%test%' });
      });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('entity.name LIKE :name', {
        name: '%test%',
      });
    });
  });
});

describe('TenantService - Soft Delete Methods', () => {
  let testService: TestTenantService;
  let mockRepository: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      metadata: {
        name: 'TestEntity',
        tableName: 'test_entity',
        targetName: 'TestEntity',
        columns: [],
        relations: [],
        primaryColumns: [{ propertyName: 'id', databaseName: 'id' }],
      },
    };

    testService = new TestTenantService(mockRepository);
  });

  describe('softDelete', () => {
    it('should soft delete an entity', async () => {
      const mockEntity = {
        id: 'entity-123',
        organizationId: 'org-123',
        name: 'Test Entity',
      };

      mockRepository.findOne
        .mockResolvedValueOnce(mockEntity) // findById call
        .mockResolvedValueOnce({ ...mockEntity, deletedAt: new Date(), deletedBy: 'user-456' }); // final fetch

      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await testService.softDelete('org-123', 'entity-123', 'user-456');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: 'entity-123' },
        expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: 'user-456',
        })
      );
      expect(result).toBeDefined();
    });

    it('should return null if entity not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await testService.softDelete('org-123', 'nonexistent', 'user-456');

      expect(result).toBeNull();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted entity', async () => {
      const deletedEntity = {
        id: 'entity-123',
        organizationId: 'org-123',
        name: 'Test Entity',
        deletedAt: new Date(),
        deletedBy: 'user-456',
      };

      const restoredEntity = {
        ...deletedEntity,
        deletedAt: null,
        deletedBy: null,
      };

      mockRepository.findOne
        .mockResolvedValueOnce(deletedEntity) // initial find with withDeleted
        .mockResolvedValueOnce(restoredEntity); // final findById

      mockRepository.update.mockResolvedValue({ affected: 1 });

      const result = await testService.restore('org-123', 'entity-123');

      expect(mockRepository.update).toHaveBeenCalledWith(
        { id: 'entity-123' },
        { deletedAt: null, deletedBy: null }
      );
      expect(result).toBeDefined();
    });

    it('should return null if entity not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await testService.restore('org-123', 'nonexistent');

      expect(result).toBeNull();
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('should return entity as-is if not deleted', async () => {
      const activeEntity = {
        id: 'entity-123',
        organizationId: 'org-123',
        name: 'Test Entity',
        deletedAt: null,
      };

      mockRepository.findOne.mockResolvedValue(activeEntity);

      const result = await testService.restore('org-123', 'entity-123');

      expect(result).toEqual(activeEntity);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('findDeleted', () => {
    it('should find only soft-deleted entities', async () => {
      const mockQueryBuilder = {
        withDeleted: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: '1', deletedAt: new Date() },
          { id: '2', deletedAt: new Date() },
        ]),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await testService.findDeleted('org-123');

      expect(mockQueryBuilder.withDeleted).toHaveBeenCalled();
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('entity.deletedAt IS NOT NULL');
      expect(result).toHaveLength(2);
    });
  });

  describe('permanentDelete', () => {
    it('should permanently delete an entity', async () => {
      const mockEntity = {
        id: 'entity-123',
        organizationId: 'org-123',
        deletedAt: new Date(),
      };

      mockRepository.findOne.mockResolvedValue(mockEntity);
      mockRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await testService.permanentDelete('org-123', 'entity-123');

      expect(mockRepository.delete).toHaveBeenCalledWith({ id: 'entity-123' });
      expect(result).toBe(true);
    });

    it('should return false if entity not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await testService.permanentDelete('org-123', 'nonexistent');

      expect(result).toBe(false);
      expect(mockRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('bulkSoftDelete', () => {
    it('should soft delete multiple entities', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await testService.bulkSoftDelete(
        'org-123',
        ['id-1', 'id-2', 'id-3'],
        'user-456'
      );

      expect(mockQueryBuilder.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: 'user-456',
        })
      );
      expect(result).toBe(3);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
