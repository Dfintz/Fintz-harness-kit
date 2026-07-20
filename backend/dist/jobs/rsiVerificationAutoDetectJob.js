"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startRsiVerificationAutoDetectJob = exports.runRsiVerificationAutoDetectOnce = void 0;
const jobs_1 = require("../services/jobs");
const RsiVerificationService_1 = require("../services/user/RsiVerificationService");
const logger_1 = require("../utils/logger");
const AUTO_DETECT_JOB_ID = 'rsi-verification-auto-detect';
const AUTO_DETECT_LOCK_TTL_SECONDS = 5 * 60;
const AUTO_DETECT_INTERVAL_MS = 2 * 60 * 1000;
let isRunning = false;
let verificationService = null;
const getService = () => {
    if (!verificationService) {
        verificationService = new RsiVerificationService_1.RsiVerificationService();
    }
    return verificationService;
};
async function processPendingVerifications() {
    if (isRunning) {
        logger_1.logger.debug('RSI verification auto-detect already running, skipping');
        return {
            outcome: 'skipped',
            reason: 'job already running in this instance',
        };
    }
    const lockResult = await jobs_1.distributedJobLock.acquireLock(AUTO_DETECT_JOB_ID, {
        ttlSeconds: AUTO_DETECT_LOCK_TTL_SECONDS,
        waitForLock: false,
    });
    if (!lockResult.acquired) {
        logger_1.logger.debug(`RSI verification auto-detect lock not acquired: ${lockResult.reason ?? 'held by another instance'}`);
        return {
            outcome: 'skipped',
            reason: lockResult.reason ?? 'lock held by another instance',
        };
    }
    isRunning = true;
    try {
        const service = getService();
        const [users, orgs] = await Promise.all([
            service.autoDetectUserVerifications(),
            service.autoDetectOrganizationVerifications(),
        ]);
        if (users.checked > 0 || orgs.checked > 0) {
            logger_1.logger.info(`RSI verification auto-detect: users ${users.verified}/${users.checked} verified, ` +
                `orgs ${orgs.verified}/${orgs.checked} verified`);
        }
        return {
            outcome: 'executed',
            usersChecked: users.checked,
            usersVerified: users.verified,
            organizationsChecked: orgs.checked,
            organizationsVerified: orgs.verified,
        };
    }
    catch (error) {
        logger_1.logger.error('RSI verification auto-detect job failed', { error });
        throw error;
    }
    finally {
        isRunning = false;
        await jobs_1.distributedJobLock.releaseLock(AUTO_DETECT_JOB_ID);
    }
}
const runRsiVerificationAutoDetectOnce = async () => processPendingVerifications();
exports.runRsiVerificationAutoDetectOnce = runRsiVerificationAutoDetectOnce;
const startRsiVerificationAutoDetectJob = () => {
    logger_1.logger.info('Starting RSI verification auto-detect job (runs every 2 minutes)');
    setTimeout(() => {
        void processPendingVerifications().catch(error => {
            logger_1.logger.error('Initial RSI verification auto-detect run failed', { error });
        });
    }, 10 * 1000).unref();
    setInterval(() => {
        void processPendingVerifications().catch(error => {
            logger_1.logger.error('Scheduled RSI verification auto-detect run failed', { error });
        });
    }, AUTO_DETECT_INTERVAL_MS).unref();
};
exports.startRsiVerificationAutoDetectJob = startRsiVerificationAutoDetectJob;
//# sourceMappingURL=rsiVerificationAutoDetectJob.js.map