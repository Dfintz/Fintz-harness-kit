import { BaseQueryBuilder, PaginatedResult } from '../../../utils/query/QueryBuilder';
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';

// Mock entity type
interface MockEntity extends ObjectLiteral {
  id: string;
  name: string;
  organizationId: string;
  createdAt?: Date;
}

// Concrete implementation for testing
class TestQueryBuilder extends BaseQueryBuilder<MockEntity> {
  constructor(repository: Repository<MockEntity>) {
    super(repository, 'test');
  }

  withRelation(): this {
    this.qb.leftJoinAndSelect('test.relation', 'relation');
    return this;
  }
}

describe('BaseQueryBuilder', () => {
  let mockRepository: jest.Mocked<Repository<MockEntity>>;
  let mockQueryBuilder: jest.Mocked<SelectQueryBuilder<MockEntity>>;
  let queryBuilder: TestQueryBuilder;

  beforeEach(() => {
    // Create mock query builder
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      cache: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
      getCount: jest.fn().mockResolvedValue(0),
      getSql: jest.fn().mockReturnValue('SELECT * FROM test'),
      getParameters: jest.fn().mockReturnValue({}),
    } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;

    // Create mock repository
    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    } as unknown as jest.Mocked<Repository<MockEntity>>;

    queryBuilder = new TestQueryBuilder(mockRepository);
  });

  describe('forOrganization', () => {
    it('should add organization filter', () => {
      queryBuilder.forOrganization('org-123');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'test.organizationId = :organizationId',
        { organizationId: 'org-123' }
      );
    });

    it('should return this for chaining', () => {
      const result = queryBuilder.forOrganization('org-123');
      expect(result).toBe(queryBuilder);
    });
  });

  describe('orderBy', () => {
    it('should add ascending order by default', () => {
      queryBuilder.orderBy('name');

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('test.name', 'ASC');
    });

    it('should add descending order when specified', () => {
      queryBuilder.orderBy('createdAt', 'DESC');

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('test.createdAt', 'DESC');
    });
  });

  describe('addOrderBy', () => {
    it('should add secondary sort', () => {
      queryBuilder.addOrderBy('name', 'DESC');

      expect(mockQueryBuilder.addOrderBy).toHaveBeenCalledWith('test.name', 'DESC');
    });
  });

  describe('paginate', () => {
    it('should calculate correct offset for page 1', () => {
      queryBuilder.paginate(1, 10);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });

    it('should calculate correct offset for page 3', () => {
      queryBuilder.paginate(3, 10);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(10);
    });
  });

  describe('whereEquals', () => {
    it('should add equality condition', () => {
      queryBuilder.whereEquals('status', 'active');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'test.status = :status',
        { status: 'active' }
      );
    });
  });

  describe('whereLike', () => {
    it('should add ILIKE condition with wildcards', () => {
      queryBuilder.whereLike('name', 'test');

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'test.name ILIKE :namePattern',
        { namePattern: '%test%' }
      );
    });
  });

  describe('whereIn', () => {
    it('should add IN condition for non-empty array', () => {
      queryBuilder.whereIn('status', ['active', 'pending']);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'test.status IN (:...statusValues)',
        { statusValues: ['active', 'pending'] }
      );
    });

    it('should not add condition for empty array', () => {
      queryBuilder.whereIn('status', []);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('whereDateRange', () => {
    it('should add from date condition', () => {
      const from = new Date('2024-01-01');
      queryBuilder.whereDateRange('createdAt', from);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'test.createdAt >= :createdAtFrom',
        { createdAtFrom: from }
      );
    });

    it('should add to date condition', () => {
      const to = new Date('2024-12-31');
      queryBuilder.whereDateRange('createdAt', undefined, to);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'test.createdAt <= :createdAtTo',
        { createdAtTo: to }
      );
    });

    it('should add both conditions', () => {
      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');
      queryBuilder.whereDateRange('createdAt', from, to);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('cache', () => {
    it('should enable caching with duration', () => {
      queryBuilder.cache(60000);

      expect(mockQueryBuilder.cache).toHaveBeenCalledWith(true, 60000);
    });

    it('should enable caching with custom id', () => {
      queryBuilder.cache(60000, 'custom-cache-key');

      expect(mockQueryBuilder.cache).toHaveBeenCalledWith('custom-cache-key', 60000);
    });
  });

  describe('execution methods', () => {
    it('should execute getMany', async () => {
      const mockData = [{ id: '1', name: 'Test', organizationId: 'org-1' }];
      mockQueryBuilder.getMany.mockResolvedValue(mockData);

      const result = await queryBuilder.getMany();

      expect(result).toEqual(mockData);
    });

    it('should execute getManyAndCount', async () => {
      const mockData = [{ id: '1', name: 'Test', organizationId: 'org-1' }];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockData, 1]);

      const [data, count] = await queryBuilder.getManyAndCount();

      expect(data).toEqual(mockData);
      expect(count).toBe(1);
    });

    it('should execute getOne', async () => {
      const mockEntity = { id: '1', name: 'Test', organizationId: 'org-1' };
      mockQueryBuilder.getOne.mockResolvedValue(mockEntity);

      const result = await queryBuilder.getOne();

      expect(result).toEqual(mockEntity);
    });

    it('should execute getCount', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(5);

      const result = await queryBuilder.getCount();

      expect(result).toBe(5);
    });

    it('should execute exists', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(1);

      const result = await queryBuilder.exists();

      expect(result).toBe(true);
    });
  });

  describe('getPaginated', () => {
    it('should return paginated result', async () => {
      const mockData = [
        { id: '1', name: 'Test 1', organizationId: 'org-1' },
        { id: '2', name: 'Test 2', organizationId: 'org-1' },
      ];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([mockData, 25]);

      const result = await queryBuilder.getPaginated({ page: 2, limit: 10 });

      expect(result).toEqual<PaginatedResult<MockEntity>>({
        data: mockData,
        total: 25,
        page: 2,
        limit: 10,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it('should indicate no next page on last page', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 20]);

      const result = await queryBuilder.getPaginated({ page: 2, limit: 10 });

      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(true);
    });

    it('should indicate no prev page on first page', async () => {
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 5]);

      const result = await queryBuilder.getPaginated({ page: 1, limit: 10 });

      expect(result.hasNext).toBe(false);
      expect(result.hasPrev).toBe(false);
    });
  });

  describe('chaining', () => {
    it('should allow method chaining', async () => {
      const mockData = [{ id: '1', name: 'Test', organizationId: 'org-1' }];
      mockQueryBuilder.getMany.mockResolvedValue(mockData);

      const result = await queryBuilder
        .forOrganization('org-123')
        .whereEquals('status', 'active')
        .whereLike('name', 'test')
        .orderBy('createdAt', 'DESC')
        .paginate(1, 10)
        .getMany();

      expect(result).toEqual(mockData);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(3);
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.skip).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.take).toHaveBeenCalledTimes(1);
    });
  });

  describe('debugging', () => {
    it('should return SQL query', () => {
      const sql = queryBuilder.getSql();
      expect(sql).toBe('SELECT * FROM test');
    });

    it('should return query parameters', () => {
      const params = queryBuilder.getParameters();
      expect(params).toEqual({});
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
