import { rsiCrawlerDataService } from '../services/external/RsiCrawlerDataService';
import { rsiCrawlerService } from '../services/external/RsiCrawlerService';
import { logger } from '../utils/logger';

/**
 * RSI Crawler Background Job
 * Periodically crawls RSI organizations to keep data fresh
 */

let isRunning = false;

function isDegradedCrawlerFailure(message: string): boolean {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('circuit breaker') ||
    lowered.includes('rate limit') ||
    lowered.includes('status code 503') ||
    lowered.includes('service unavailable') ||
    lowered.includes('failed to crawl organization: 503') ||
    lowered.includes('failed to crawl members: 503')
  );
}

/**
 * Start the RSI crawler job
 * Runs every 6 hours by default
 */
export const startRsiCrawlerJob = (): void => {
  const intervalMinutes = parseInt(process.env.RSI_CRAWLER_JOB_INTERVAL ?? '360'); // 6 hours default
  const intervalMs = intervalMinutes * 60 * 1000;

  logger.info(`Starting RSI crawler job (interval: ${intervalMinutes} minutes)`);

  // Run immediately on startup
  void runCrawlerJob();

  // Schedule recurring runs
  setInterval(() => {
    void runCrawlerJob();
  }, intervalMs).unref();
};

/**
 * Run a single crawler job iteration
 */
async function runCrawlerJob(): Promise<void> {
  if (isRunning) {
    logger.debug('RSI crawler job already running, skipping');
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    logger.info('RSI crawler job started');

    // Check circuit breaker state before starting
    const circuitStatus = rsiCrawlerService.getCircuitStatus();
    if (circuitStatus.state === 'open') {
      logger.warn('RSI crawler circuit breaker is OPEN, skipping scheduled crawl');
      return;
    }

    // Get statistics to see what needs crawling
    const stats = await rsiCrawlerDataService.getStatistics();
    logger.info(
      `Current crawler stats: ${stats.totalOrgs} orgs, ${stats.recentlyCrawledOrgs} crawled in last 24h`
    );

    // Get all organizations that need refreshing (older than 12 hours)
    const orgsToRefresh = await getOrganizationsNeedingRefresh();

    if (orgsToRefresh.length === 0) {
      logger.info('No organizations need refreshing');
      return;
    }

    logger.info(`Found ${orgsToRefresh.length} organizations needing refresh`);

    // Crawl each organization
    let successCount = 0;
    let errorCount = 0;

    for (const org of orgsToRefresh) {
      try {
        logger.debug(`Crawling organization: ${org.sid}`);

        // Refresh organization data
        await rsiCrawlerDataService.fetchAndStoreOrganization(org.sid, true);

        // Optionally refresh members (only if org has less than 500 members)
        if (org.memberCount < 500) {
          await rsiCrawlerDataService.fetchAndStoreMembers(org.sid, true);
        }

        successCount++;

        // Small delay between organizations to be respectful
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        errorCount++;
        const message = error instanceof Error ? error.message : String(error);
        if (isDegradedCrawlerFailure(message)) {
          logger.warn(
            `Failed to crawl organization ${org.sid} (degraded control path): ${message}`
          );
        } else {
          logger.error(`Failed to crawl organization ${org.sid}:`, error);
        }
      }

      // Check if we've been running too long (max 30 minutes)
      const runTime = Date.now() - startTime;
      if (runTime > 30 * 60 * 1000) {
        logger.warn('RSI crawler job running too long, stopping early');
        break;
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    logger.info(
      `RSI crawler job completed: ${successCount} succeeded, ${errorCount} failed (${duration}s)`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (isDegradedCrawlerFailure(message)) {
      logger.warn(`RSI crawler job failed (degraded control path): ${message}`);
    } else {
      logger.error('RSI crawler job failed:', error);
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Get organizations that need refreshing (crawled more than 12 hours ago)
 */
async function getOrganizationsNeedingRefresh(): Promise<
  Array<{ sid: string; memberCount: number }>
> {
  try {
    // Get all organizations
    const { organizations } = await rsiCrawlerDataService.listOrganizations(1000, 0);

    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    // Filter to those needing refresh
    return organizations
      .filter(org => org.lastCrawledAt < twelveHoursAgo || org.crawlFailed)
      .map(org => ({ sid: org.sid, memberCount: org.memberCount }))
      .slice(0, 50); // Limit to 50 per run
  } catch (error) {
    logger.error('Failed to get organizations needing refresh:', error);
    return [];
  }
}

/**
 * Stop the crawler job (for graceful shutdown)
 */
export const stopRsiCrawlerJob = (): void => {
  logger.info('Stopping RSI crawler job');
  // Job will stop on next check of isRunning flag
};
