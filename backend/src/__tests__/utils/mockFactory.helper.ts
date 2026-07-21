/**
 * TypeORM Repository Mock Factory
 *
 * Provides reusable mock factories for TypeORM repositories to fix
 * EntityMetadataNotFoundError in tests.
 *
 * Usage:
 * ```typescript
 * import { createMockRepository } from '../utils/mockFactory';
 *
 * jest.mock('../../data-source', () => ({
 *     AppDataSource: {
 *         getRepository: jest.fn().mockReturnValue(createMockRepository()),
 *     },
 * }));
 * ```
 */

/**
 * Base entity constraint - all entities should have an id field
 */
interface BaseEntity {
  id: string | number;
}

export interface MockRepository<T extends BaseEntity = BaseEntity> {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  findAndCount: jest.Mock;
  findBy: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  remove: jest.Mock;
  count: jest.Mock;
  createQueryBuilder: jest.Mock;
  metadata: {
    name: string;
  };
  manager: {
    transaction: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
}

/**
 * Creates a mock TypeORM repository with all common methods
 */
export function createMockRepository<T extends BaseEntity = BaseEntity>(): MockRepository<T> {
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn(),
    getManyAndCount: jest.fn(),
    execute: jest.fn(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
  };

  return {
    create: jest.fn((entity?: Partial<T>) => entity as T),
    save: jest.fn((entity: T) => Promise.resolve(entity)),
    find: jest.fn(() => Promise.resolve([])),
    findOne: jest.fn(() => Promise.resolve(null)),
    findOneBy: jest.fn(() => Promise.resolve(null)),
    findAndCount: jest.fn(() => Promise.resolve([[], 0])),
    findBy: jest.fn(() => Promise.resolve([])),
    update: jest.fn(() => Promise.resolve({ affected: 1, raw: [], generatedMaps: [] })),
    delete: jest.fn(() => Promise.resolve({ affected: 1, raw: [] })),
    remove: jest.fn((entity: T) => Promise.resolve(entity)),
    count: jest.fn(() => Promise.resolve(0)),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
    metadata: {
      name: 'MockEntity',
    },
    manager: {
      transaction: jest.fn((fn: Function) =>
        fn({
          save: jest.fn((entity: T) => Promise.resolve(entity)),
          find: jest.fn(() => Promise.resolve([])),
          findOne: jest.fn(() => Promise.resolve(null)),
        })
      ),
      save: jest.fn((entity: T) => Promise.resolve(entity)),
      find: jest.fn(() => Promise.resolve([])),
      findOne: jest.fn(() => Promise.resolve(null)),
    },
  };
}

/**
 * Creates a mock AppDataSource for testing
 *
 * Usage:
 * ```typescript
 * jest.mock('../../data-source', () => ({
 *     AppDataSource: createMockDataSource()
 * }));
 * ```
 */
export function createMockDataSource() {
  const repositories = new Map<string, MockRepository>();

  return {
    getRepository: jest.fn((entity: any) => {
      const entityName = typeof entity === 'function' ? entity.name : String(entity);
      if (!repositories.has(entityName)) {
        repositories.set(entityName, createMockRepository());
      }
      return repositories.get(entityName);
    }),
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
      },
    })),
    manager: {
      transaction: jest.fn((fn: Function) =>
        fn({
          save: jest.fn(),
          find: jest.fn(),
          findOne: jest.fn(),
        })
      ),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      getRepository: jest.fn((entity: any) => {
        const entityName = typeof entity === 'function' ? entity.name : String(entity);
        if (!repositories.has(entityName)) {
          repositories.set(entityName, createMockRepository());
        }
        return repositories.get(entityName);
      }),
    },
    initialize: jest.fn(() => Promise.resolve()),
    isInitialized: true,
  };
}

/**
 * Creates a pre-configured mock repository with data
 *
 * @param data - Array of entities to return from find() methods
 * @param single - Single entity to return from findOne() methods
 */
export function createMockRepositoryWithData<T>(data: T[], single?: T | null): MockRepository<T> {
  const repo = createMockRepository<T>();

  // Standard find operations
  repo.find.mockResolvedValue(data);
  repo.findBy.mockResolvedValue(data);
  repo.findAndCount.mockResolvedValue([data, data.length]);
  repo.count.mockResolvedValue(data.length);

  // Smart findOne - handles where clauses
  repo.findOne.mockImplementation((options: any) => {
    if (single !== undefined) {
      return Promise.resolve(single);
    }

    if (!options?.where) {
      return Promise.resolve(data.length > 0 ? data[0] : null);
    }

    // Find matching entity by where clause
    const where = options.where;
    const found = data.find((item: any) =>
      Object.keys(where).every(key => item[key] === where[key])
    );

    return Promise.resolve(found || null);
  });

  repo.findOneBy.mockImplementation((where: any) => {
    if (single !== undefined) {
      return Promise.resolve(single);
    }

    const found = data.find((item: any) =>
      Object.keys(where).every(key => item[key] === where[key])
    );

    return Promise.resolve(found || null);
  });

  // Smart save - adds to array or updates existing
  repo.save.mockImplementation((entity: any) => {
    const index = data.findIndex((item: any) => item.id === entity.id);
    if (index >= 0) {
      data[index] = { ...data[index], ...entity };
      return Promise.resolve(data[index]);
    } else {
      const saved = { ...entity };
      data.push(saved as T);
      return Promise.resolve(saved);
    }
  });

  // Smart create - returns entity with generated ID if needed
  repo.create.mockImplementation(
    (entityData: any) =>
      ({
        id: entityData.id || `generated-${Date.now()}`,
        ...entityData,
      }) as T
  );

  // Smart delete - removes from array
  repo.delete.mockImplementation((criteria: any) => {
    const id = typeof criteria === 'object' ? criteria.id : criteria;
    const index = data.findIndex((item: any) => item.id === id);
    if (index >= 0) {
      data.splice(index, 1);
      return Promise.resolve({ affected: 1, raw: [] });
    }
    return Promise.resolve({ affected: 0, raw: [] });
  });

  // Smart update - modifies existing entity
  repo.update.mockImplementation((criteria: any, partialEntity: any) => {
    const id = typeof criteria === 'object' ? criteria.id : criteria;
    const index = data.findIndex((item: any) => item.id === id);
    if (index >= 0) {
      data[index] = { ...data[index], ...partialEntity };
      return Promise.resolve({ affected: 1, raw: [], generatedMaps: [] });
    }
    return Promise.resolve({ affected: 0, raw: [], generatedMaps: [] });
  });

  return repo;
}

/**
 * Helper to setup mock repository responses for a specific entity
 *
 * @param mockDataSource - The mocked AppDataSource
 * @param entityName - Name of the entity (e.g., 'User', 'Organization')
 * @param setupFn - Function to configure the repository mock
 */
export function setupRepositoryMock<T>(
  mockDataSource: any,
  entityName: string,
  setupFn: (repo: MockRepository<T>) => void
): void {
  const repo = createMockRepository<T>();
  setupFn(repo);

  mockDataSource.getRepository.mockImplementation((entity: any) => {
    const name = typeof entity === 'function' ? entity.name : String(entity);
    if (name === entityName) {
      return repo;
    }
    return createMockRepository();
  });
}

/**
 * Creates a mock query builder with pre-configured responses
 */
export function createMockQueryBuilder<T>(data?: T | T[] | null) {
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    having: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getMany: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(null),
    getRawMany: jest.fn().mockResolvedValue([]),
    getCount: jest.fn(),
    getManyAndCount: jest.fn(),
    execute: jest.fn(),
  };

  if (data !== undefined) {
    if (Array.isArray(data)) {
      mockQueryBuilder.getMany.mockResolvedValue(data);
      mockQueryBuilder.getCount.mockResolvedValue(data.length);
      mockQueryBuilder.getManyAndCount.mockResolvedValue([data, data.length]);
      mockQueryBuilder.getOne.mockResolvedValue(data[0] || null);
    } else {
      mockQueryBuilder.getOne.mockResolvedValue(data);
      mockQueryBuilder.getMany.mockResolvedValue(data ? [data] : []);
      mockQueryBuilder.getCount.mockResolvedValue(data ? 1 : 0);
      mockQueryBuilder.getManyAndCount.mockResolvedValue(data ? [[data], 1] : [[], 0]);
    }
  }

  return mockQueryBuilder;
}

/**
 * Example usage in tests:
 *
 * // Basic usage
 * jest.mock('../../data-source', () => ({
 *     AppDataSource: createMockDataSource()
 * }));
 *
 * // With pre-configured data
 * const mockUsers = [{ id: 1, username: 'test' }];
 * const mockRepo = createMockRepositoryWithData(mockUsers);
 *
 * // Setup specific repository
 * const mockDataSource = createMockDataSource();
 * setupRepositoryMock(mockDataSource, 'User', (repo) => {
 *     repo.findOne.mockResolvedValue({ id: 1, username: 'test' });
 * });
 */
