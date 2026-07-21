/**
 * AdminJobRegistry — Unit tests
 *
 * Tests the job registry used by the admin operations dashboard
 * for managing (listing, triggering, enabling/disabling) background jobs.
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

import { AdminJobRegistry, type JobRegistryConfig } from '../admin/AdminJobRegistry';

function createTestConfig(overrides?: Partial<JobRegistryConfig>): JobRegistryConfig {
  return {
    id: 'test-job',
    name: 'Test Job',
    description: 'A test job',
    category: 'cleanup',
    schedule: 'Every hour',
    handler: jest.fn().mockResolvedValue(undefined),
    enabled: true,
    ...overrides,
  };
}

describe('AdminJobRegistry', () => {
  let registry: AdminJobRegistry;

  beforeEach(() => {
    // Create a fresh instance for each test (bypass singleton for isolation)
    registry = Object.create(AdminJobRegistry.prototype);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (registry as any).jobs = new Map();
  });

  describe('registerJob', () => {
    it('should register a job successfully', () => {
      const config = createTestConfig();
      registry.registerJob(config);

      const jobs = registry.getAllJobs();
      expect(jobs).toHaveLength(1);
      expect(jobs[0].id).toBe('test-job');
      expect(jobs[0].name).toBe('Test Job');
      expect(jobs[0].enabled).toBe(true);
    });

    it('should not register duplicate job IDs', () => {
      const config = createTestConfig();
      registry.registerJob(config);
      registry.registerJob(config); // duplicate

      expect(registry.getAllJobs()).toHaveLength(1);
    });

    it('should default enabled to true when not specified', () => {
      const config = createTestConfig({ enabled: undefined });
      registry.registerJob(config);

      expect(registry.getAllJobs()[0].enabled).toBe(true);
    });
  });

  describe('getJob', () => {
    it('should return job info by ID', () => {
      registry.registerJob(createTestConfig());
      const job = registry.getJob('test-job');

      expect(job).toBeDefined();
      expect(job!.id).toBe('test-job');
    });

    it('should return undefined for unknown ID', () => {
      expect(registry.getJob('nonexistent')).toBeUndefined();
    });
  });

  describe('triggerJob', () => {
    it('should execute the handler and return execution record', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      registry.registerJob(createTestConfig({ handler }));

      const execution = await registry.triggerJob('test-job');

      expect(handler).toHaveBeenCalledTimes(1);
      expect(execution.success).toBe(true);
      expect(execution.manual).toBe(true);
      expect(execution.outcome).toBe('executed');
      expect(execution.duration).toBeGreaterThanOrEqual(0);
    });

    it('should mark execution as skipped when handler returns skipped outcome', async () => {
      const handler = jest.fn().mockResolvedValue({
        outcome: 'skipped',
        reason: 'lock held by another instance',
      });
      registry.registerJob(createTestConfig({ handler }));

      const execution = await registry.triggerJob('test-job');
      const job = registry.getJob('test-job');

      expect(execution.success).toBe(true);
      expect(execution.outcome).toBe('skipped');
      expect(execution.outcomeReason).toBe('lock held by another instance');
      expect(job!.statistics.skippedExecutions).toBe(1);
      expect(job!.statistics.successfulExecutions).toBe(0);
      expect(job!.statistics.failedExecutions).toBe(0);
    });

    it('should record failed execution when handler throws', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Job failed'));
      registry.registerJob(createTestConfig({ handler }));

      const execution = await registry.triggerJob('test-job');

      expect(execution.success).toBe(false);
      expect(execution.error).toBe('Job failed');
    });

    it('should throw for unknown job', async () => {
      await expect(registry.triggerJob('nonexistent')).rejects.toThrow("'nonexistent' not found");
    });

    it('should throw if job is already running', async () => {
      const handler = jest.fn(() => new Promise<void>(resolve => setTimeout(resolve, 1000)));
      registry.registerJob(createTestConfig({ handler }));

      // Start the job but don't await
      const running = registry.triggerJob('test-job');

      await expect(registry.triggerJob('test-job')).rejects.toThrow('already running');

      // Let the first complete
      await running;
    });

    it('should update statistics after execution', async () => {
      registry.registerJob(createTestConfig());

      await registry.triggerJob('test-job');
      const job = registry.getJob('test-job');

      expect(job!.statistics.totalExecutions).toBe(1);
      expect(job!.statistics.successfulExecutions).toBe(1);
      expect(job!.statistics.skippedExecutions).toBe(0);
      expect(job!.statistics.failedExecutions).toBe(0);
      expect(job!.statistics.successRate).toBe(100);
    });
  });

  describe('enableJob / disableJob', () => {
    it('should enable a disabled job', () => {
      registry.registerJob(createTestConfig({ enabled: false }));
      expect(registry.getJob('test-job')!.enabled).toBe(false);

      const result = registry.enableJob('test-job');
      expect(result).toBe(true);
      expect(registry.getJob('test-job')!.enabled).toBe(true);
    });

    it('should disable an enabled job', () => {
      registry.registerJob(createTestConfig());
      expect(registry.getJob('test-job')!.enabled).toBe(true);

      const result = registry.disableJob('test-job');
      expect(result).toBe(true);
      expect(registry.getJob('test-job')!.enabled).toBe(false);
    });

    it('should return false for unknown job', () => {
      expect(registry.enableJob('nonexistent')).toBe(false);
      expect(registry.disableJob('nonexistent')).toBe(false);
    });
  });

  describe('isJobEnabled', () => {
    it('should return true for enabled job', () => {
      registry.registerJob(createTestConfig());
      expect(registry.isJobEnabled('test-job')).toBe(true);
    });

    it('should return false for disabled job', () => {
      registry.registerJob(createTestConfig({ enabled: false }));
      expect(registry.isJobEnabled('test-job')).toBe(false);
    });

    it('should return true for unknown job (safe default)', () => {
      expect(registry.isJobEnabled('nonexistent')).toBe(true);
    });
  });

  describe('recordExecution', () => {
    it('should update statistics from external execution', () => {
      registry.registerJob(createTestConfig());

      registry.recordExecution('test-job', true, 500);
      registry.recordExecution('test-job', false, 200, 'timeout');

      const job = registry.getJob('test-job');
      expect(job!.statistics.totalExecutions).toBe(2);
      expect(job!.statistics.successfulExecutions).toBe(1);
      expect(job!.statistics.skippedExecutions).toBe(0);
      expect(job!.statistics.failedExecutions).toBe(1);
      expect(job!.statistics.successRate).toBe(50);
      expect(job!.lastExecution!.success).toBe(false);
      expect(job!.lastExecution!.error).toBe('timeout');
    });
  });

  describe('getAllJobs', () => {
    it('should return all registered jobs', () => {
      registry.registerJob(createTestConfig({ id: 'job-1', name: 'Job 1' }));
      registry.registerJob(createTestConfig({ id: 'job-2', name: 'Job 2' }));
      registry.registerJob(createTestConfig({ id: 'job-3', name: 'Job 3' }));

      const jobs = registry.getAllJobs();
      expect(jobs).toHaveLength(3);
      expect(jobs.map(j => j.id)).toEqual(['job-1', 'job-2', 'job-3']);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

