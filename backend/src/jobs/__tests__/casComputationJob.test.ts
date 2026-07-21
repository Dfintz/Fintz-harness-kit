const mockComputeScore = jest.fn();

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
    options: {
      extra: {
        max: 25,
      },
    },
  },
}));

jest.mock('../../config/applicationInsights', () => ({
  trackMetric: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../services/analytics/CASComputationService', () => ({
  CASComputationService: jest.fn().mockImplementation(() => ({
    computeScore: mockComputeScore,
  })),
}));

import { trackMetric } from '../../config/applicationInsights';
import { AppDataSource } from '../../config/database';
import {
  resolveCASSchedulerConcurrency,
  runCASComputationCycle,
  startCASComputationJob,
  stopCASComputationJob,
} from '../casComputationJob';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type OrgRow = { id: string };

type QueryBuilderLike = {
  select: jest.Mock;
  where: jest.Mock;
  getMany: jest.Mock;
};

const ORIGINAL_ENV = process.env;

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

const flushAsync = async (): Promise<void> => {
  await new Promise<void>(resolve => {
    setImmediate(() => resolve());
  });
};

const createOrgQueryBuilder = (orgs: OrgRow[]): QueryBuilderLike => {
  const queryBuilder: QueryBuilderLike = {
    select: jest.fn(),
    where: jest.fn(),
    getMany: jest.fn().mockResolvedValue(orgs),
  };

  queryBuilder.select.mockReturnValue(queryBuilder);
  queryBuilder.where.mockReturnValue(queryBuilder);
  return queryBuilder;
};

describe('casComputationJob', () => {
  const mockOrgRepo = {
    createQueryBuilder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockComputeScore.mockReset();

    process.env = {
      ...ORIGINAL_ENV,
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockOrgRepo);
    (AppDataSource as unknown as { options: { extra?: { max?: number } } }).options = {
      extra: { max: 25 },
    };

    mockOrgRepo.createQueryBuilder.mockReturnValue(createOrgQueryBuilder([]));
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it('caps configured CAS concurrency by DB pool headroom', () => {
    process.env.CAS_SCHEDULER_CONCURRENCY = '50';
    process.env.CAS_SCHEDULER_POOL_UTILIZATION = '0.5';

    const settings = resolveCASSchedulerConcurrency(20);

    expect(settings.poolMaxConnections).toBe(20);
    expect(settings.requestedConcurrency).toBe(24);
    expect(settings.maxConcurrencyFromPool).toBe(10);
    expect(settings.effectiveConcurrency).toBe(10);
  });

  it('processes organizations with pool-bounded concurrency', async () => {
    process.env.CAS_SCHEDULER_CONCURRENCY = '10';
    process.env.CAS_SCHEDULER_POOL_UTILIZATION = '0.5';
    (AppDataSource as unknown as { options: { extra?: { max?: number } } }).options = {
      extra: { max: 4 },
    };

    const orgs: OrgRow[] = [{ id: 'org-1' }, { id: 'org-2' }, { id: 'org-3' }];
    mockOrgRepo.createQueryBuilder.mockReturnValue(createOrgQueryBuilder(orgs));

    const first = createDeferred<void>();
    const second = createDeferred<void>();
    const third = createDeferred<void>();

    mockComputeScore
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise)
      .mockImplementationOnce(() => third.promise);

    const cyclePromise = runCASComputationCycle();
    await flushAsync();

    // pool max=4 with utilization=0.5 => effective concurrency=2
    expect(mockComputeScore).toHaveBeenCalledTimes(2);

    first.resolve();
    second.resolve();
    await flushAsync();

    expect(mockComputeScore).toHaveBeenCalledTimes(3);

    third.resolve();
    await cyclePromise;
  });

  it('emits queue, duration, and failure telemetry for CAS cycles', async () => {
    process.env.CAS_SCHEDULER_CONCURRENCY = '2';
    process.env.CAS_SCHEDULER_POOL_UTILIZATION = '1';

    const orgs: OrgRow[] = [{ id: 'org-1' }, { id: 'org-2' }];
    mockOrgRepo.createQueryBuilder.mockReturnValue(createOrgQueryBuilder(orgs));

    // org-1 succeeds, org-2 fails (all retry attempts)
    mockComputeScore
      .mockResolvedValueOnce(undefined) // org-1 success
      .mockRejectedValueOnce(new Error('boom')) // org-2 attempt 1
      .mockRejectedValueOnce(new Error('boom')) // org-2 attempt 2
      .mockRejectedValueOnce(new Error('boom')); // org-2 attempt 3

    await runCASComputationCycle();

    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.queue_depth', 2);
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.queue_depth', 0);
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.effective_concurrency', 2);
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.pool_max_connections', 25);
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.org_failure_count', 1);
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.success_count', 1);
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.failure_count', 1);
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.org_duration_ms', expect.any(Number));
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.queue_duration_ms', expect.any(Number));
    expect(trackMetric).toHaveBeenCalledWith('cas.scheduler.cycle_duration_ms', expect.any(Number));
  });

  it('clears startup timeout when stopping scheduled CAS job', () => {
    jest.useFakeTimers();
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');

    startCASComputationJob();
    stopCASComputationJob();

    expect(clearTimeoutSpy).toHaveBeenCalled();

    clearTimeoutSpy.mockRestore();
    jest.useRealTimers();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
