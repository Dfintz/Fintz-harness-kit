import {
    JobCategory,
    JobConfig,
    JobExecutionStatus,
    JobSchedulerService,
} from '../jobs/JobSchedulerService';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('node-cron', () => ({
  validate: jest.fn(() => true),
  schedule: jest.fn(() => ({
    stop: jest.fn(),
    start: jest.fn(),
  })),
}));

describe('JobSchedulerService', () => {
  let scheduler: JobSchedulerService;

  const createJobConfig = (overrides: Partial<JobConfig> = {}): JobConfig => ({
    id: 'test-job',
    name: 'Test Job',
    cronExpression: '*/5 * * * *',
    category: JobCategory.SYNC,
    handler: jest.fn().mockResolvedValue(undefined),
    enabled: true,
    maxRetries: 3,
    retryDelay: 1000,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    scheduler = new JobSchedulerService({ maxHistoryPerJob: 10 });
  });

  afterEach(async () => {
    await scheduler.stopAll();
  });

  describe('registerJob', () => {
    it('should register a new job', () => {
      const config = createJobConfig();

      scheduler.registerJob(config);

      const job = scheduler.getJob('test-job');
      expect(job).toBeDefined();
      expect(job!.config.name).toBe('Test Job');
      expect(job!.config.category).toBe(JobCategory.SYNC);
    });

    it('should throw if job already registered', () => {
      const config = createJobConfig();
      scheduler.registerJob(config);

      expect(() => scheduler.registerJob(config)).toThrow();
    });

    it('should throw for invalid cron expression', () => {
      const cron = require('node-cron');
      cron.validate.mockReturnValueOnce(false);

      const config = createJobConfig({ cronExpression: 'invalid' });

      expect(() => scheduler.registerJob(config)).toThrow();
    });
  });

  describe('unregisterJob', () => {
    it('should unregister an existing job', () => {
      scheduler.registerJob(createJobConfig());

      const result = scheduler.unregisterJob('test-job');

      expect(result).toBe(true);
      expect(scheduler.getJob('test-job')).toBeUndefined();
    });

    it('should return false for non-existent job', () => {
      const result = scheduler.unregisterJob('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('executeJob', () => {
    it('should execute job and record execution', async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      scheduler.registerJob(createJobConfig({ handler }));

      const execution = await scheduler.executeJob('test-job');

      expect(execution).not.toBeNull();
      expect(execution!.status).toBe(JobExecutionStatus.COMPLETED);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent job', async () => {
      const result = await scheduler.executeJob('nonexistent');

      expect(result).toBeNull();
    });

    it('should mark as manual execution', async () => {
      scheduler.registerJob(createJobConfig());

      const execution = await scheduler.executeJob('test-job', true);

      expect(execution).not.toBeNull();
      expect(execution!.metadata?.manual).toBe(true);
    });

    it('should handle job failure', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Job failed'));
      scheduler.registerJob(createJobConfig({ handler, maxRetries: 0 }));

      const execution = await scheduler.executeJob('test-job');

      expect(execution).not.toBeNull();
      expect(execution!.status).toBe(JobExecutionStatus.FAILED);
      expect(execution!.error).toBeDefined();
    });

    it('should retry on failure with maxRetries', async () => {
      const handler = jest
        .fn()
        .mockRejectedValueOnce(new Error('Attempt 1'))
        .mockRejectedValueOnce(new Error('Attempt 2'))
        .mockResolvedValueOnce(undefined);

      scheduler.registerJob(
        createJobConfig({
          handler,
          maxRetries: 3,
          retryDelay: 10, // Fast retry for tests
        })
      );

      const execution = await scheduler.executeJob('test-job');

      expect(execution).not.toBeNull();
      expect(execution!.status).toBe(JobExecutionStatus.COMPLETED);
      expect(handler).toHaveBeenCalledTimes(3);
    });
  });

  describe('enableJob / disableJob', () => {
    it('should enable a disabled job', () => {
      scheduler.registerJob(createJobConfig({ enabled: false }));

      const result = scheduler.enableJob('test-job');

      expect(result).toBe(true);
      const job = scheduler.getJob('test-job');
      expect(job!.config.enabled).toBe(true);
    });

    it('should disable an enabled job', () => {
      scheduler.registerJob(createJobConfig({ enabled: true }));

      const result = scheduler.disableJob('test-job');

      expect(result).toBe(true);
      const job = scheduler.getJob('test-job');
      expect(job!.config.enabled).toBe(false);
    });

    it('should return false for non-existent job', () => {
      expect(scheduler.enableJob('nonexistent')).toBe(false);
      expect(scheduler.disableJob('nonexistent')).toBe(false);
    });
  });

  describe('getAllJobs', () => {
    it('should return all registered jobs', () => {
      scheduler.registerJob(createJobConfig({ id: 'job-1', name: 'Job 1' }));
      scheduler.registerJob(createJobConfig({ id: 'job-2', name: 'Job 2' }));

      const jobs = scheduler.getAllJobs();

      expect(jobs).toHaveLength(2);
    });

    it('should return empty array when no jobs', () => {
      expect(scheduler.getAllJobs()).toHaveLength(0);
    });
  });

  describe('getJobsByCategory', () => {
    it('should filter jobs by category', () => {
      scheduler.registerJob(createJobConfig({ id: 'sync-1', category: JobCategory.SYNC }));
      scheduler.registerJob(createJobConfig({ id: 'cleanup-1', category: JobCategory.CLEANUP }));
      scheduler.registerJob(createJobConfig({ id: 'sync-2', category: JobCategory.SYNC }));

      const syncJobs = scheduler.getJobsByCategory(JobCategory.SYNC);
      expect(syncJobs).toHaveLength(2);

      const cleanupJobs = scheduler.getJobsByCategory(JobCategory.CLEANUP);
      expect(cleanupJobs).toHaveLength(1);
    });
  });

  describe('getRunningJobs', () => {
    it('should return empty when no jobs running', () => {
      scheduler.registerJob(createJobConfig());

      const running = scheduler.getRunningJobs();

      expect(running).toHaveLength(0);
    });
  });

  describe('updateCronExpression', () => {
    it('should update cron expression for existing job', () => {
      scheduler.registerJob(createJobConfig());

      const result = scheduler.updateCronExpression('test-job', '0 * * * *');

      expect(result).toBe(true);
      const job = scheduler.getJob('test-job');
      expect(job!.config.cronExpression).toBe('0 * * * *');
    });

    it('should return false for non-existent job', () => {
      const result = scheduler.updateCronExpression('nonexistent', '0 * * * *');

      expect(result).toBe(false);
    });
  });

  describe('stopAll', () => {
    it('should stop all jobs and prevent new executions', async () => {
      scheduler.registerJob(createJobConfig({ id: 'job-1' }));
      scheduler.registerJob(createJobConfig({ id: 'job-2' }));

      await scheduler.stopAll();

      // Executing after stopAll should return null
      const result = await scheduler.executeJob('job-1');
      expect(result).toBeNull();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

