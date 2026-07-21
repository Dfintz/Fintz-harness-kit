import { logger } from '../utils/logger';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ScheduledJobHandle {
  cleanup: () => void;
}

interface ExecuteGuardOptions {
  jobName: string;
  run: () => Promise<void>;
}

function createGuardedExecutor(options: ExecuteGuardOptions): (trigger: string) => Promise<void> {
  let isRunning = false;

  return async (trigger: string): Promise<void> => {
    if (isRunning) {
      logger.info(`${options.jobName} skipped because previous run is still active`, { trigger });
      return;
    }

    isRunning = true;
    try {
      await options.run();
    } catch (error) {
      logger.error(`${options.jobName} failed`, {
        trigger,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      isRunning = false;
    }
  };
}

export interface DailyUtcScheduleOptions {
  jobName: string;
  hourUtc: number;
  minuteUtc?: number;
  run: () => Promise<void>;
  runOnStartup?: boolean;
}

export function scheduleDailyUtcJob(options: DailyUtcScheduleOptions): ScheduledJobHandle {
  const minuteUtc = options.minuteUtc ?? 0;
  const execute = createGuardedExecutor({
    jobName: options.jobName,
    run: options.run,
  });

  if (options.runOnStartup) {
    void execute('startup');
  }

  const now = new Date();
  const nextRun = new Date();
  nextRun.setUTCHours(options.hourUtc, minuteUtc, 0, 0);

  if (now > nextRun) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const msUntilNextRun = nextRun.getTime() - now.getTime();
  logger.info(`${options.jobName} scheduled`, {
    nextRunAt: nextRun.toISOString(),
    cadence: 'daily',
  });

  let intervalId: NodeJS.Timeout | null = null;
  const timeoutId = setTimeout(() => {
    void execute('scheduled');

    intervalId = setInterval(() => {
      void execute('scheduled');
    }, DAY_MS);
    intervalId.unref();
  }, msUntilNextRun);
  timeoutId.unref();

  return {
    cleanup: () => {
      clearTimeout(timeoutId);
      if (intervalId) {
        clearInterval(intervalId);
      }
      logger.info(`${options.jobName} stopped`);
    },
  };
}

export interface FixedIntervalScheduleOptions {
  jobName: string;
  intervalMs: number;
  run: () => Promise<void>;
  runOnStartup?: boolean;
}

export function scheduleFixedIntervalJob(
  options: FixedIntervalScheduleOptions
): ScheduledJobHandle {
  const execute = createGuardedExecutor({
    jobName: options.jobName,
    run: options.run,
  });

  if (options.runOnStartup) {
    void execute('startup');
  }

  const interval = setInterval(() => {
    void execute('scheduled');
  }, options.intervalMs);
  interval.unref();

  logger.info(`${options.jobName} scheduled`, {
    cadence: 'fixed-interval',
    intervalMs: options.intervalMs,
  });

  return {
    cleanup: () => {
      clearInterval(interval);
      logger.info(`${options.jobName} stopped`);
    },
  };
}
