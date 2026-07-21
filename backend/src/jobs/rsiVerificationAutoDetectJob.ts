/**
 * RSI Verification Auto-Detect Job
 *
 * Periodically re-crawls RSI profiles for users and organizations that have a
 * pending (non-expired) verification token but have not yet completed
 * verification. When the token is found in the RSI bio / Website field (users)
 * or any org-page section (organizations), verification is finalized
 * automatically.
 *
 * This is what makes the "no copy-paste code" flow feel seamless: the user
 * simply pastes their verification link into their RSI profile and the platform
 * detects it within a couple of minutes — clicking "Verify Now" stays available
 * for an immediate check but is no longer required.
 */

import { distributedJobLock } from '../services/jobs';
import { RsiVerificationService } from '../services/user/RsiVerificationService';
import { logger } from '../utils/logger';

const AUTO_DETECT_JOB_ID = 'rsi-verification-auto-detect';
const AUTO_DETECT_LOCK_TTL_SECONDS = 5 * 60;
const AUTO_DETECT_INTERVAL_MS = 2 * 60 * 1000; // run every 2 minutes

export interface RsiVerificationAutoDetectRunResult {
  outcome: 'executed' | 'skipped';
  reason?: string;
  usersChecked?: number;
  usersVerified?: number;
  organizationsChecked?: number;
  organizationsVerified?: number;
}

let isRunning = false;
let verificationService: RsiVerificationService | null = null;

const getService = (): RsiVerificationService => {
  if (!verificationService) {
    verificationService = new RsiVerificationService();
  }
  return verificationService;
};

/**
 * Process all pending user and organization verifications once.
 */
async function processPendingVerifications(): Promise<RsiVerificationAutoDetectRunResult> {
  // Prevent overlapping runs within this instance
  if (isRunning) {
    logger.debug('RSI verification auto-detect already running, skipping');
    return {
      outcome: 'skipped',
      reason: 'job already running in this instance',
    };
  }

  // Distributed lock — only one instance scans at a time.
  // Uses owner-aware release semantics to avoid deleting another instance's lock.
  const lockResult = await distributedJobLock.acquireLock(AUTO_DETECT_JOB_ID, {
    ttlSeconds: AUTO_DETECT_LOCK_TTL_SECONDS,
    waitForLock: false,
  });
  if (!lockResult.acquired) {
    logger.debug(
      `RSI verification auto-detect lock not acquired: ${lockResult.reason ?? 'held by another instance'}`
    );
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
      logger.info(
        `RSI verification auto-detect: users ${users.verified}/${users.checked} verified, ` +
          `orgs ${orgs.verified}/${orgs.checked} verified`
      );
    }

    return {
      outcome: 'executed',
      usersChecked: users.checked,
      usersVerified: users.verified,
      organizationsChecked: orgs.checked,
      organizationsVerified: orgs.verified,
    };
  } catch (error) {
    logger.error('RSI verification auto-detect job failed', { error });
    throw error;
  } finally {
    isRunning = false;
    await distributedJobLock.releaseLock(AUTO_DETECT_JOB_ID);
  }
}

/**
 * Run a single auto-detect pass.
 *
 * Used by admin job registry manual trigger and tests.
 */
export const runRsiVerificationAutoDetectOnce =
  async (): Promise<RsiVerificationAutoDetectRunResult> => processPendingVerifications();

/**
 * Start the RSI verification auto-detect job.
 *
 * Runs immediately on startup and then every 2 minutes. The timer is unref'd so
 * it never keeps the process alive on its own.
 */
export const startRsiVerificationAutoDetectJob = (): void => {
  logger.info('Starting RSI verification auto-detect job (runs every 2 minutes)');

  // Run shortly after startup (deferred so it doesn't block boot)
  setTimeout(() => {
    void processPendingVerifications().catch(error => {
      logger.error('Initial RSI verification auto-detect run failed', { error });
    });
  }, 10 * 1000).unref();

  setInterval(() => {
    void processPendingVerifications().catch(error => {
      logger.error('Scheduled RSI verification auto-detect run failed', { error });
    });
  }, AUTO_DETECT_INTERVAL_MS).unref();
};
