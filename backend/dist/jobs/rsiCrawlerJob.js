"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopRsiCrawlerJob = exports.startRsiCrawlerJob = void 0;
const RsiCrawlerDataService_1 = require("../services/external/RsiCrawlerDataService");
const RsiCrawlerService_1 = require("../services/external/RsiCrawlerService");
const logger_1 = require("../utils/logger");
let isRunning = false;
function isDegradedCrawlerFailure(message) {
    const lowered = message.toLowerCase();
    return (lowered.includes('circuit breaker') ||
        lowered.includes('rate limit') ||
        lowered.includes('status code 503') ||
        lowered.includes('service unavailable') ||
        lowered.includes('failed to crawl organization: 503') ||
        lowered.includes('failed to crawl members: 503'));
}
const startRsiCrawlerJob = () => {
    const intervalMinutes = parseInt(process.env.RSI_CRAWLER_JOB_INTERVAL ?? '360');
    const intervalMs = intervalMinutes * 60 * 1000;
    logger_1.logger.info(`Starting RSI crawler job (interval: ${intervalMinutes} minutes)`);
    void runCrawlerJob();
    setInterval(() => {
        void runCrawlerJob();
    }, intervalMs).unref();
};
exports.startRsiCrawlerJob = startRsiCrawlerJob;
async function runCrawlerJob() {
    if (isRunning) {
        logger_1.logger.debug('RSI crawler job already running, skipping');
        return;
    }
    isRunning = true;
    const startTime = Date.now();
    try {
        logger_1.logger.info('RSI crawler job started');
        const circuitStatus = RsiCrawlerService_1.rsiCrawlerService.getCircuitStatus();
        if (circuitStatus.state === 'open') {
            logger_1.logger.warn('RSI crawler circuit breaker is OPEN, skipping scheduled crawl');
            return;
        }
        const stats = await RsiCrawlerDataService_1.rsiCrawlerDataService.getStatistics();
        logger_1.logger.info(`Current crawler stats: ${stats.totalOrgs} orgs, ${stats.recentlyCrawledOrgs} crawled in last 24h`);
        const orgsToRefresh = await getOrganizationsNeedingRefresh();
        if (orgsToRefresh.length === 0) {
            logger_1.logger.info('No organizations need refreshing');
            return;
        }
        logger_1.logger.info(`Found ${orgsToRefresh.length} organizations needing refresh`);
        let successCount = 0;
        let errorCount = 0;
        for (const org of orgsToRefresh) {
            try {
                logger_1.logger.debug(`Crawling organization: ${org.sid}`);
                await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreOrganization(org.sid, true);
                if (org.memberCount < 500) {
                    await RsiCrawlerDataService_1.rsiCrawlerDataService.fetchAndStoreMembers(org.sid, true);
                }
                successCount++;
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            catch (error) {
                errorCount++;
                const message = error instanceof Error ? error.message : String(error);
                if (isDegradedCrawlerFailure(message)) {
                    logger_1.logger.warn(`Failed to crawl organization ${org.sid} (degraded control path): ${message}`);
                }
                else {
                    logger_1.logger.error(`Failed to crawl organization ${org.sid}:`, error);
                }
            }
            const runTime = Date.now() - startTime;
            if (runTime > 30 * 60 * 1000) {
                logger_1.logger.warn('RSI crawler job running too long, stopping early');
                break;
            }
        }
        const duration = Math.round((Date.now() - startTime) / 1000);
        logger_1.logger.info(`RSI crawler job completed: ${successCount} succeeded, ${errorCount} failed (${duration}s)`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isDegradedCrawlerFailure(message)) {
            logger_1.logger.warn(`RSI crawler job failed (degraded control path): ${message}`);
        }
        else {
            logger_1.logger.error('RSI crawler job failed:', error);
        }
    }
    finally {
        isRunning = false;
    }
}
async function getOrganizationsNeedingRefresh() {
    try {
        const { organizations } = await RsiCrawlerDataService_1.rsiCrawlerDataService.listOrganizations(1000, 0);
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        return organizations
            .filter(org => org.lastCrawledAt < twelveHoursAgo || org.crawlFailed)
            .map(org => ({ sid: org.sid, memberCount: org.memberCount }))
            .slice(0, 50);
    }
    catch (error) {
        logger_1.logger.error('Failed to get organizations needing refresh:', error);
        return [];
    }
}
const stopRsiCrawlerJob = () => {
    logger_1.logger.info('Stopping RSI crawler job');
};
exports.stopRsiCrawlerJob = stopRsiCrawlerJob;
//# sourceMappingURL=rsiCrawlerJob.js.map