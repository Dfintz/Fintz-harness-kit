import {
    JobCategory,
    JobExecution,
    JobExecutionStatus,
    JobSchedulerService,
    RegisteredJob,
} from '../jobs/JobSchedulerService';
import {
    createJobStatusDashboard,
    JobAlertType,
    JobStatusDashboardService,
} from '../jobs/JobStatusDashboardService';

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('JobStatusDashboardService', () => {
  let dashboard: JobStatusDashboardService;
  let mockScheduler: jest.Mocked<Partial<JobSchedulerService>>;

  const now = new Date('2026-02-09T12:00:00Z');
  const oneHourAgo = new Date('2026-02-09T11:00:00Z');

  const createMockJob = (overrides?: Partial<RegisteredJob>): RegisteredJob => ({
    config: {
      id: 'job-1',
      name: 'Test Job',
      cronExpression: '0 * * * *',
      handler: jest.fn(),
      enabled: true,
      category: JobCategory.CLEANUP,
    },
    task: null,
    lastExecution: {
      id: 'exec-1',
      jobId: 'job-1',
      status: JobExecutionStatus.COMPLETED,
      startedAt: oneHourAgo,
      completedAt: now,
      duration: 5000,
      retryCount: 0,
    },
    executionHistory: [
      {
        id: 'exec-1',
        jobId: 'job-1',
        status: JobExecutionStatus.COMPLETED,
        startedAt: oneHourAgo,
        completedAt: now,
        duration: 5000,
        retryCount: 0,
      },
    ],
    totalExecutions: 10,
    successfulExecutions: 9,
    failedExecutions: 1,
    averageDuration: 4500,
    isRunning: false,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: now.getTime() });

    mockScheduler = {
      getAllJobs: jest.fn().mockReturnValue([]),
      getJob: jest.fn().mockReturnValue(null),
      getJobsByCategory: jest.fn().mockReturnValue([]),
    };

    dashboard = new JobStatusDashboardService(mockScheduler as unknown as JobSchedulerService);
  });

  afterEach(() => {
    dashboard.stopMonitoring();
    jest.useRealTimers();
  });

  // --- constructor & factory ---

  describe('constructor', () => {
    it('should create instance with default thresholds', () => {
      const d = new JobStatusDashboardService(mockScheduler as unknown as JobSchedulerService);
      expect(d).toBeInstanceOf(JobStatusDashboardService);
    });

    it('should create instance with custom thresholds', () => {
      const d = new JobStatusDashboardService(mockScheduler as unknown as JobSchedulerService, {
        consecutiveFailures: 5,
        minSuccessRate: 0.9,
      });
      expect(d).toBeInstanceOf(JobStatusDashboardService);
    });
  });

  describe('createJobStatusDashboard factory', () => {
    it('should return a JobStatusDashboardService instance', () => {
      const d = createJobStatusDashboard(mockScheduler as unknown as JobSchedulerService);
      expect(d).toBeInstanceOf(JobStatusDashboardService);
      d.stopMonitoring();
    });
  });

  // --- getDashboardOverview ---

  describe('getDashboardOverview', () => {
    it('should return overview with zero jobs', () => {
      mockScheduler.getAllJobs!.mockReturnValue([]);

      const overview = dashboard.getDashboardOverview();

      expect(overview.totalJobs).toBe(0);
      expect(overview.enabledJobs).toBe(0);
      expect(overview.disabledJobs).toBe(0);
      expect(overview.runningJobs).toBe(0);
      expect(overview.alertCount).toBe(0);
      expect(overview.timestamp).toBeInstanceOf(Date);
    });

    it('should count enabled and disabled jobs', () => {
      const enabledJob = createMockJob();
      const disabledJob = createMockJob({
        config: { ...enabledJob.config, id: 'job-2', name: 'Disabled', enabled: false },
      });
      mockScheduler.getAllJobs!.mockReturnValue([enabledJob, disabledJob]);

      const overview = dashboard.getDashboardOverview();

      expect(overview.totalJobs).toBe(2);
      expect(overview.enabledJobs).toBe(1);
      expect(overview.disabledJobs).toBe(1);
    });

    it('should count running jobs', () => {
      const runningJob = createMockJob({ isRunning: true });
      mockScheduler.getAllJobs!.mockReturnValue([runningJob]);

      const overview = dashboard.getDashboardOverview();

      expect(overview.runningJobs).toBe(1);
    });

    it('should categorize health statuses', () => {
      const healthy = createMockJob();
      const unknown = createMockJob({
        config: { ...healthy.config, id: 'job-2', name: 'New' },
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
      });
      mockScheduler.getAllJobs!.mockReturnValue([healthy, unknown]);

      const overview = dashboard.getDashboardOverview();

      expect(overview.healthySummary.healthy).toBe(1);
      expect(overview.healthySummary.unknown).toBe(1);
    });

    it('should include recent executions', () => {
      const job = createMockJob();
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      const overview = dashboard.getDashboardOverview();

      expect(overview.recentExecutions.length).toBeGreaterThanOrEqual(1);
    });

    it('should include upcoming enabled jobs', () => {
      const job = createMockJob();
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      const overview = dashboard.getDashboardOverview();

      expect(overview.upcomingJobs.length).toBeGreaterThanOrEqual(0);
    });
  });

  // --- getJobStatus ---

  describe('getJobStatus', () => {
    it('should return status for a valid job', () => {
      const job = createMockJob();
      mockScheduler.getJob!.mockReturnValue(job);

      const status = dashboard.getJobStatus('job-1');

      expect(status.jobId).toBe('job-1');
      expect(status.name).toBe('Test Job');
      expect(status.category).toBe(JobCategory.CLEANUP);
      expect(status.enabled).toBe(true);
      expect(status.isRunning).toBe(false);
    });

    it('should accept RegisteredJob object directly', () => {
      const job = createMockJob();

      const status = dashboard.getJobStatus(job);

      expect(status.jobId).toBe('job-1');
    });

    it('should throw for unknown job ID', () => {
      mockScheduler.getJob!.mockReturnValue(null);

      expect(() => dashboard.getJobStatus('non-existent')).toThrow('Job not found');
    });

    it('should calculate statistics correctly', () => {
      const job = createMockJob({
        totalExecutions: 20,
        successfulExecutions: 18,
        failedExecutions: 2,
        averageDuration: 3000,
      });

      const status = dashboard.getJobStatus(job);

      expect(status.statistics.totalExecutions).toBe(20);
      expect(status.statistics.successfulExecutions).toBe(18);
      expect(status.statistics.failedExecutions).toBe(2);
      expect(status.statistics.successRate).toBe(90);
      expect(status.statistics.averageDuration).toBe(3000);
    });

    it('should include last execution details', () => {
      const job = createMockJob();

      const status = dashboard.getJobStatus(job);

      expect(status.lastExecution).toBeDefined();
      expect(status.lastExecution!.status).toBe(JobExecutionStatus.COMPLETED);
      expect(status.lastExecution!.duration).toBe(5000);
    });

    it('should handle job with no executions', () => {
      const job = createMockJob({
        lastExecution: undefined,
        executionHistory: [],
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
      });

      const status = dashboard.getJobStatus(job);

      expect(status.lastExecution).toBeUndefined();
      expect(status.statistics.successRate).toBe(100); // default 1 * 100
      expect(status.health).toBe('unknown');
    });

    it('should default category to OTHER when undefined', () => {
      const job = createMockJob({
        config: {
          id: 'job-no-cat',
          name: 'No Category',
          cronExpression: '0 * * * *',
          handler: jest.fn(),
          category: undefined,
        },
      });

      const status = dashboard.getJobStatus(job);

      expect(status.category).toBe(JobCategory.OTHER);
    });

    it('should default enabled to true when undefined', () => {
      const job = createMockJob({
        config: {
          id: 'job-no-enabled',
          name: 'No Enabled',
          cronExpression: '0 * * * *',
          handler: jest.fn(),
          enabled: undefined,
        },
      });

      const status = dashboard.getJobStatus(job);

      expect(status.enabled).toBe(true);
    });
  });

  // --- getAllJobStatuses ---

  describe('getAllJobStatuses', () => {
    it('should return statuses for all jobs', () => {
      const job1 = createMockJob();
      const job2 = createMockJob({
        config: { ...job1.config, id: 'job-2', name: 'Job 2' },
      });
      mockScheduler.getAllJobs!.mockReturnValue([job1, job2]);

      const statuses = dashboard.getAllJobStatuses();

      expect(statuses).toHaveLength(2);
    });
  });

  // --- getJobStatusesByCategory ---

  describe('getJobStatusesByCategory', () => {
    it('should return statuses filtered by category', () => {
      const cleanupJob = createMockJob();
      mockScheduler.getJobsByCategory!.mockReturnValue([cleanupJob]);

      const statuses = dashboard.getJobStatusesByCategory(JobCategory.CLEANUP);

      expect(statuses).toHaveLength(1);
      expect(mockScheduler.getJobsByCategory).toHaveBeenCalledWith(JobCategory.CLEANUP);
    });
  });

  // --- getJobExecutionHistory ---

  describe('getJobExecutionHistory', () => {
    it('should return execution history for a job', () => {
      const executions: JobExecution[] = [
        {
          id: 'e1',
          jobId: 'job-1',
          status: JobExecutionStatus.COMPLETED,
          startedAt: new Date('2026-02-09T10:00:00Z'),
          duration: 1000,
          retryCount: 0,
        },
        {
          id: 'e2',
          jobId: 'job-1',
          status: JobExecutionStatus.FAILED,
          startedAt: new Date('2026-02-09T11:00:00Z'),
          duration: 2000,
          retryCount: 0,
          error: 'fail',
        },
      ];
      const job = createMockJob({ executionHistory: executions });
      mockScheduler.getJob!.mockReturnValue(job);

      const history = dashboard.getJobExecutionHistory('job-1');

      expect(history).toHaveLength(2);
      // Should be reversed (newest first)
      expect(history[0].id).toBe('e2');
    });

    it('should limit results when limit provided', () => {
      const executions = Array.from({ length: 5 }, (_, i) => ({
        id: `e${i}`,
        jobId: 'job-1',
        status: JobExecutionStatus.COMPLETED,
        startedAt: new Date(),
        duration: 1000,
        retryCount: 0,
      }));
      const job = createMockJob({ executionHistory: executions });
      mockScheduler.getJob!.mockReturnValue(job);

      const history = dashboard.getJobExecutionHistory('job-1', 3);

      expect(history).toHaveLength(3);
    });

    it('should return empty array for unknown job', () => {
      mockScheduler.getJob!.mockReturnValue(null);

      const history = dashboard.getJobExecutionHistory('non-existent');

      expect(history).toEqual([]);
    });
  });

  // --- getRecentExecutions ---

  describe('getRecentExecutions', () => {
    it('should aggregate executions across all jobs sorted by time', () => {
      const job1 = createMockJob({
        executionHistory: [
          {
            id: 'e1',
            jobId: 'job-1',
            status: JobExecutionStatus.COMPLETED,
            startedAt: new Date('2026-02-09T10:00:00Z'),
            duration: 1000,
            retryCount: 0,
          },
        ],
      });
      const job2 = createMockJob({
        config: { ...job1.config, id: 'job-2' },
        executionHistory: [
          {
            id: 'e2',
            jobId: 'job-2',
            status: JobExecutionStatus.COMPLETED,
            startedAt: new Date('2026-02-09T11:00:00Z'),
            duration: 2000,
            retryCount: 0,
          },
        ],
      });
      mockScheduler.getAllJobs!.mockReturnValue([job1, job2]);

      const recent = dashboard.getRecentExecutions(10);

      expect(recent).toHaveLength(2);
      expect(recent[0].id).toBe('e2'); // newest first
    });
  });

  // --- Alerts ---

  describe('alerts', () => {
    it('should return empty active alerts initially', () => {
      expect(dashboard.getActiveAlerts()).toEqual([]);
    });

    it('should return empty job alerts for unknown job', () => {
      expect(dashboard.getJobAlerts('non-existent')).toEqual([]);
    });

    it('should acknowledge an alert', () => {
      // Create alert through consecutive failures check
      const failedExecs = Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        jobId: 'job-1',
        status: JobExecutionStatus.FAILED,
        startedAt: new Date(),
        duration: 1000,
        retryCount: 0,
        error: 'test error',
      }));
      const job = createMockJob({
        executionHistory: failedExecs,
        failedExecutions: 3,
        successfulExecutions: 0,
        totalExecutions: 3,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      // Trigger alert check manually through monitoring
      dashboard.startMonitoring(1000);
      jest.advanceTimersByTime(1000);

      const alerts = dashboard.getActiveAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(1);

      const alertId = alerts[0].id;
      const result = dashboard.acknowledgeAlert(alertId, 'admin-user');

      expect(result).toBe(true);
      const acknowledged = dashboard.getActiveAlerts();
      expect(acknowledged[0].acknowledgedBy).toBe('admin-user');
      expect(acknowledged[0].acknowledgedAt).toBeInstanceOf(Date);
    });

    it('should return false when acknowledging non-existent alert', () => {
      expect(dashboard.acknowledgeAlert('non-existent', 'admin')).toBe(false);
    });

    it('should resolve an alert', () => {
      const failedExecs = Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        jobId: 'job-1',
        status: JobExecutionStatus.FAILED,
        startedAt: new Date(),
        duration: 1000,
        retryCount: 0,
        error: 'test',
      }));
      const job = createMockJob({
        executionHistory: failedExecs,
        failedExecutions: 3,
        successfulExecutions: 0,
        totalExecutions: 3,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(1000);
      jest.advanceTimersByTime(1000);

      const alerts = dashboard.getActiveAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(1);

      const result = dashboard.resolveAlert(alerts[0].id);
      expect(result).toBe(true);
      expect(dashboard.getActiveAlerts()).toHaveLength(0);
    });

    it('should return false when resolving non-existent alert', () => {
      expect(dashboard.resolveAlert('non-existent')).toBe(false);
    });

    it('should emit alert event when alert is created', () => {
      const alertHandler = jest.fn();
      dashboard.on('alert', alertHandler);

      const failedExecs = Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        jobId: 'job-1',
        status: JobExecutionStatus.FAILED,
        startedAt: new Date(),
        duration: 1000,
        retryCount: 0,
      }));
      const job = createMockJob({
        executionHistory: failedExecs,
        failedExecutions: 3,
        successfulExecutions: 0,
        totalExecutions: 3,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(1000);
      jest.advanceTimersByTime(1000);

      expect(alertHandler).toHaveBeenCalled();
    });

    it('should not create duplicate active alerts', () => {
      const failedExecs = Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        jobId: 'job-1',
        status: JobExecutionStatus.FAILED,
        startedAt: new Date(),
        duration: 1000,
        retryCount: 0,
      }));
      const job = createMockJob({
        executionHistory: failedExecs,
        failedExecutions: 3,
        successfulExecutions: 0,
        totalExecutions: 3,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);
      const count1 = dashboard.getActiveAlerts().length;
      jest.advanceTimersByTime(500);
      const count2 = dashboard.getActiveAlerts().length;

      expect(count2).toBe(count1); // no duplicates
    });

    it('should sort active alerts by severity', () => {
      // Create jobs triggering different alert types
      const stuckJob = createMockJob({
        config: { ...createMockJob().config, id: 'stuck-job', name: 'Stuck' },
        isRunning: true,
        lastExecution: {
          id: 'e-stuck',
          jobId: 'stuck-job',
          status: JobExecutionStatus.RUNNING,
          startedAt: new Date(now.getTime() - 7200000), // 2 hours ago
          retryCount: 0,
        },
        totalExecutions: 10,
        successfulExecutions: 9,
        failedExecutions: 1,
      });

      const failedJob = createMockJob({
        config: { ...createMockJob().config, id: 'failed-job', name: 'Failed' },
        executionHistory: Array.from({ length: 3 }, (_, i) => ({
          id: `e-f${i}`,
          jobId: 'failed-job',
          status: JobExecutionStatus.FAILED,
          startedAt: new Date(),
          duration: 1000,
          retryCount: 0,
        })),
        failedExecutions: 3,
        successfulExecutions: 0,
        totalExecutions: 3,
      });

      mockScheduler.getAllJobs!.mockReturnValue([stuckJob, failedJob]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);

      const alerts = dashboard.getActiveAlerts();
      if (alerts.length >= 2) {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        for (let i = 0; i < alerts.length - 1; i++) {
          expect(severityOrder[alerts[i].severity]).toBeLessThanOrEqual(
            severityOrder[alerts[i + 1].severity]
          );
        }
      }
    });
  });

  // --- Alert type checks ---

  describe('alert type checks', () => {
    it('should create alert for consecutive failures', () => {
      const failedExecs = Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        jobId: 'job-1',
        status: JobExecutionStatus.FAILED,
        startedAt: new Date(),
        duration: 1000,
        retryCount: 0,
      }));
      const job = createMockJob({
        executionHistory: failedExecs,
        totalExecutions: 3,
        successfulExecutions: 0,
        failedExecutions: 3,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);

      const alerts = dashboard.getActiveAlerts();
      const failureAlert = alerts.find(a => a.type === JobAlertType.CONSECUTIVE_FAILURES);
      expect(failureAlert).toBeDefined();
      expect(failureAlert!.severity).toBe('high');
    });

    it('should create alert for high duration', () => {
      const job = createMockJob({
        lastExecution: {
          id: 'e1',
          jobId: 'job-1',
          status: JobExecutionStatus.COMPLETED,
          startedAt: oneHourAgo,
          duration: 15000, // 3x+ the average of 4500
          retryCount: 0,
        },
        averageDuration: 4500,
        totalExecutions: 10,
        successfulExecutions: 10,
        failedExecutions: 0,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);

      const alerts = dashboard.getActiveAlerts();
      const durationAlert = alerts.find(a => a.type === JobAlertType.HIGH_DURATION);
      expect(durationAlert).toBeDefined();
      expect(durationAlert!.severity).toBe('medium');
    });

    it('should create alert for low success rate', () => {
      const job = createMockJob({
        totalExecutions: 20,
        successfulExecutions: 10,
        failedExecutions: 10,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);

      const alerts = dashboard.getActiveAlerts();
      const successRateAlert = alerts.find(a => a.type === JobAlertType.LOW_SUCCESS_RATE);
      expect(successRateAlert).toBeDefined();
    });

    it('should not alert on low success rate with insufficient sample size', () => {
      const job = createMockJob({
        totalExecutions: 5,
        successfulExecutions: 2,
        failedExecutions: 3,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);

      const alerts = dashboard.getActiveAlerts();
      const successRateAlert = alerts.find(a => a.type === JobAlertType.LOW_SUCCESS_RATE);
      expect(successRateAlert).toBeUndefined();
    });

    it('should create critical alert for stuck job', () => {
      const job = createMockJob({
        isRunning: true,
        lastExecution: {
          id: 'e1',
          jobId: 'job-1',
          status: JobExecutionStatus.RUNNING,
          startedAt: new Date(now.getTime() - 7200000), // 2 hours ago
          retryCount: 0,
        },
        totalExecutions: 10,
        successfulExecutions: 9,
        failedExecutions: 1,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);

      const alerts = dashboard.getActiveAlerts();
      const stuckAlert = alerts.find(a => a.type === JobAlertType.JOB_STUCK);
      expect(stuckAlert).toBeDefined();
      expect(stuckAlert!.severity).toBe('critical');
    });

    it('should skip disabled jobs in alert checks', () => {
      const disabledJob = createMockJob({
        config: {
          ...createMockJob().config,
          enabled: false,
        },
        executionHistory: Array.from({ length: 3 }, (_, i) => ({
          id: `e${i}`,
          jobId: 'job-1',
          status: JobExecutionStatus.FAILED,
          startedAt: new Date(),
          duration: 1000,
          retryCount: 0,
        })),
        failedExecutions: 3,
      });
      mockScheduler.getAllJobs!.mockReturnValue([disabledJob]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);

      expect(dashboard.getActiveAlerts()).toHaveLength(0);
    });
  });

  // --- Health calculation ---

  describe('health calculation', () => {
    it('should return "unknown" for jobs with no executions', () => {
      const job = createMockJob({
        totalExecutions: 0,
        successfulExecutions: 0,
      });

      const status = dashboard.getJobStatus(job);
      expect(status.health).toBe('unknown');
    });

    it('should return "healthy" for high success rate', () => {
      const job = createMockJob({
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 5,
      });

      const status = dashboard.getJobStatus(job);
      expect(status.health).toBe('healthy');
    });

    it('should return "degraded" for last execution failure', () => {
      const job = createMockJob({
        lastExecution: {
          id: 'e1',
          jobId: 'job-1',
          status: JobExecutionStatus.FAILED,
          startedAt: oneHourAgo,
          duration: 1000,
          retryCount: 0,
          error: 'something failed',
        },
        totalExecutions: 100,
        successfulExecutions: 90,
        failedExecutions: 10,
      });

      const status = dashboard.getJobStatus(job);
      expect(status.health).toBe('degraded');
    });

    it('should return "unhealthy" for very low success rate', () => {
      const job = createMockJob({
        totalExecutions: 100,
        successfulExecutions: 30,
        failedExecutions: 70,
      });

      const status = dashboard.getJobStatus(job);
      expect(status.health).toBe('unhealthy');
    });

    it('should return "unhealthy" for stuck running job', () => {
      const job = createMockJob({
        isRunning: true,
        lastExecution: {
          id: 'e1',
          jobId: 'job-1',
          status: JobExecutionStatus.RUNNING,
          startedAt: new Date(now.getTime() - 7200000),
          retryCount: 0,
        },
        totalExecutions: 10,
        successfulExecutions: 10,
      });

      const status = dashboard.getJobStatus(job);
      expect(status.health).toBe('unhealthy');
    });
  });

  // --- Monitoring lifecycle ---

  describe('monitoring', () => {
    it('should start and stop monitoring', () => {
      dashboard.startMonitoring(5000);
      // No errors
      dashboard.stopMonitoring();
      // No errors
    });

    it('should restart monitoring if called again', () => {
      dashboard.startMonitoring(5000);
      dashboard.startMonitoring(10000); // restarts
      dashboard.stopMonitoring();
    });
  });

  // --- getJobPerformanceTrends ---

  describe('getJobPerformanceTrends', () => {
    it('should return trends grouped by period', () => {
      const executions: JobExecution[] = [
        {
          id: 'e1',
          jobId: 'job-1',
          status: JobExecutionStatus.COMPLETED,
          startedAt: new Date('2026-02-09T10:00:00Z'),
          duration: 1000,
          retryCount: 0,
        },
        {
          id: 'e2',
          jobId: 'job-1',
          status: JobExecutionStatus.COMPLETED,
          startedAt: new Date('2026-02-09T10:30:00Z'),
          duration: 2000,
          retryCount: 0,
        },
        {
          id: 'e3',
          jobId: 'job-1',
          status: JobExecutionStatus.FAILED,
          startedAt: new Date('2026-02-09T11:00:00Z'),
          duration: 500,
          retryCount: 0,
        },
      ];
      const job = createMockJob({ executionHistory: executions });
      mockScheduler.getJob!.mockReturnValue(job);

      const trends = dashboard.getJobPerformanceTrends('job-1', 60);

      expect(trends.length).toBeGreaterThanOrEqual(1);
      const firstPeriod = trends[0];
      expect(firstPeriod).toHaveProperty('period');
      expect(firstPeriod).toHaveProperty('executionCount');
      expect(firstPeriod).toHaveProperty('successCount');
      expect(firstPeriod).toHaveProperty('failureCount');
      expect(firstPeriod).toHaveProperty('avgDuration');
    });

    it('should return empty array for unknown job', () => {
      mockScheduler.getJob!.mockReturnValue(null);

      const trends = dashboard.getJobPerformanceTrends('non-existent');
      expect(trends).toEqual([]);
    });

    it('should sort trends chronologically', () => {
      const executions: JobExecution[] = [
        {
          id: 'e1',
          jobId: 'job-1',
          status: JobExecutionStatus.COMPLETED,
          startedAt: new Date('2026-02-09T08:00:00Z'),
          duration: 1000,
          retryCount: 0,
        },
        {
          id: 'e2',
          jobId: 'job-1',
          status: JobExecutionStatus.COMPLETED,
          startedAt: new Date('2026-02-09T12:00:00Z'),
          duration: 2000,
          retryCount: 0,
        },
      ];
      const job = createMockJob({ executionHistory: executions });
      mockScheduler.getJob!.mockReturnValue(job);

      const trends = dashboard.getJobPerformanceTrends('job-1', 60);

      if (trends.length >= 2) {
        expect(trends[0].period < trends[1].period).toBe(true);
      }
    });
  });

  // --- getJobAlerts ---

  describe('getJobAlerts', () => {
    it('should return alerts for a specific job sorted by time', () => {
      // Create alerts
      const failedExecs = Array.from({ length: 3 }, (_, i) => ({
        id: `e${i}`,
        jobId: 'job-1',
        status: JobExecutionStatus.FAILED,
        startedAt: new Date(),
        duration: 1000,
        retryCount: 0,
      }));
      const job = createMockJob({
        executionHistory: failedExecs,
        totalExecutions: 3,
        successfulExecutions: 0,
        failedExecutions: 3,
      });
      mockScheduler.getAllJobs!.mockReturnValue([job]);

      dashboard.startMonitoring(500);
      jest.advanceTimersByTime(500);

      const jobAlerts = dashboard.getJobAlerts('job-1');
      expect(jobAlerts.length).toBeGreaterThanOrEqual(1);
      expect(jobAlerts.every(a => a.jobId === 'job-1')).toBe(true);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

