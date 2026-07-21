import { Repository } from 'typeorm';

import { TenantEntity } from '../../models/base/TenantEntity';
import { TenantService } from '../../services/base/TenantService';
import { NotFoundError } from '../../utils/apiErrors';

const mockCreateQueryRunner = jest.fn();

jest.mock('../../data-source', () => ({
  AppDataSource: {
    createQueryRunner: (...args: unknown[]) => mockCreateQueryRunner(...args),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

class LockTestEntity extends TenantEntity {
  id!: string;
  name!: string;
}

/**
 * Concrete subclass exposing the protected transaction primitives so they can be
 * unit-tested directly rather than only through downstream service mocks.
 */
class LockTestService extends TenantService<LockTestEntity> {
  constructor(repository: Repository<LockTestEntity>) {
    super(repository);
  }

  public runInTransaction<R>(cb: Parameters<LockTestService['withTransaction']>[0]): Promise<R> {
    return this.withTransaction(cb) as Promise<R>;
  }

  public runWithEntityLock<R>(
    id: string,
    cb: (entity: LockTestEntity, qr: unknown) => Promise<R>,
    options?: { onNotFound?: () => Error }
  ): Promise<R> {
    return this.withEntityLock(id, cb as never, options);
  }
}

/**
 * F5: direct unit coverage for `TenantService.withTransaction` and
 * `withEntityLock` — the keystone concurrency primitive every B9 atomic fix
 * (ACT-01, ACT-02, PERF-01) depends on. These tests assert the
 * connect/commit/rollback/release lifecycle and the pessimistic_write keyset
 * load in isolation, so a regression in the primitive is caught here rather than
 * surfacing indirectly through one consumer's suite.
 */
describe('TenantService transaction primitives (F5 keystone)', () => {
  let lockQueryBuilder: {
    where: jest.Mock;
    setLock: jest.Mock;
    getOne: jest.Mock;
  };
  let lockedRepo: { createQueryBuilder: jest.Mock };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: { getRepository: jest.Mock };
  };
  let serviceRepo: {
    metadata: { name: string; primaryColumns: Array<{ propertyName: string }> };
    target: unknown;
  };
  let service: LockTestService;

  beforeEach(() => {
    jest.clearAllMocks();

    lockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    lockedRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(lockQueryBuilder),
    };
    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: { getRepository: jest.fn().mockReturnValue(lockedRepo) },
    };
    mockCreateQueryRunner.mockReturnValue(queryRunner);

    serviceRepo = {
      metadata: {
        name: 'LockTestEntity',
        primaryColumns: [{ propertyName: 'id' }],
      },
      target: LockTestEntity,
    };

    service = new LockTestService(serviceRepo as unknown as Repository<LockTestEntity>);
  });

  describe('withTransaction', () => {
    it('commits and releases on success, returning the callback result', async () => {
      const result = await service.runInTransaction(async () => 'ok');

      expect(result).toBe('ok');
      expect(queryRunner.connect).toHaveBeenCalledTimes(1);
      expect(queryRunner.startTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('rolls back (not commit) and still releases when the callback throws', async () => {
      const boom = new Error('callback failed');

      await expect(
        service.runInTransaction(async () => {
          throw boom;
        })
      ).rejects.toBe(boom);

      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('releases the query runner even if commit itself rejects', async () => {
      queryRunner.commitTransaction.mockRejectedValueOnce(new Error('commit failed'));

      await expect(service.runInTransaction(async () => 'value')).rejects.toThrow('commit failed');

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('withEntityLock', () => {
    it('loads the row under a pessimistic_write lock by primary key and passes it to the callback', async () => {
      const locked = { id: 'e-1', name: 'locked' };
      lockQueryBuilder.getOne.mockResolvedValue(locked);
      const callback = jest.fn().mockResolvedValue('done');

      const result = await service.runWithEntityLock('e-1', callback);

      expect(result).toBe('done');
      // Loaded via the transaction's query-runner manager, not the bare repo.
      expect(queryRunner.manager.getRepository).toHaveBeenCalledWith(LockTestEntity);
      expect(lockQueryBuilder.where).toHaveBeenCalledWith('entity.id = :id', { id: 'e-1' });
      expect(lockQueryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
      expect(callback).toHaveBeenCalledWith(locked, queryRunner);
      expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('throws NotFoundError and rolls back when the row does not exist', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(null);
      const callback = jest.fn();

      await expect(service.runWithEntityLock('missing', callback)).rejects.toBeInstanceOf(
        NotFoundError
      );

      expect(callback).not.toHaveBeenCalled();
      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('throws the caller-supplied onNotFound error when the row is absent', async () => {
      lockQueryBuilder.getOne.mockResolvedValue(null);
      const custom = new Error('custom not found');

      await expect(
        service.runWithEntityLock('missing', jest.fn(), { onNotFound: () => custom })
      ).rejects.toBe(custom);

      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('rolls back when the locked callback throws (lock held across the mutation)', async () => {
      lockQueryBuilder.getOne.mockResolvedValue({ id: 'e-1', name: 'locked' });
      const boom = new Error('mutation failed');

      await expect(
        service.runWithEntityLock('e-1', async () => {
          throw boom;
        })
      ).rejects.toBe(boom);

      expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
      expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(queryRunner.release).toHaveBeenCalledTimes(1);
    });

    it('uses the entity primary-key column name from metadata for the lock predicate', async () => {
      // A composite/aliased PK propertyName must drive the WHERE clause.
      serviceRepo.metadata.primaryColumns = [{ propertyName: 'uuid' }];
      service = new LockTestService(serviceRepo as unknown as Repository<LockTestEntity>);
      lockQueryBuilder.getOne.mockResolvedValue({ id: 'e-9', name: 'x' });

      await service.runWithEntityLock('e-9', jest.fn().mockResolvedValue(undefined));

      expect(lockQueryBuilder.where).toHaveBeenCalledWith('entity.uuid = :id', { id: 'e-9' });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
