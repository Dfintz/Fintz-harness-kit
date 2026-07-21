/**
 * GDPR Configuration
 * 
 * Centralized configuration for GDPR compliance settings
 */

/**
 * Minimum grace period allowed (in days)
 * Organizations should provide at least 1 day for users to cancel
 */
export const MIN_GRACE_PERIOD_DAYS = 1;

/**
 * Maximum grace period allowed (in days)
 * GDPR requires deletion within 30 days, so this is the maximum
 */
export const MAX_GRACE_PERIOD_DAYS = 30;

/**
 * Grace period for data deletion requests (in days)
 * GDPR requires deletion within 30 days, but organizations can offer
 * a grace period where users can cancel the request
 */
const configuredGracePeriod = parseInt(
    process.env.DELETION_GRACE_PERIOD_DAYS || '30',
    10
);

// Validate grace period is within bounds
if (configuredGracePeriod < MIN_GRACE_PERIOD_DAYS) {
    throw new Error(`DELETION_GRACE_PERIOD_DAYS must be at least ${MIN_GRACE_PERIOD_DAYS} day(s)`);
}
if (configuredGracePeriod > MAX_GRACE_PERIOD_DAYS) {
    throw new Error(`DELETION_GRACE_PERIOD_DAYS must not exceed ${MAX_GRACE_PERIOD_DAYS} days (GDPR compliance requirement)`);
}

export const DELETION_GRACE_PERIOD_DAYS = configuredGracePeriod;

/**
 * Grace period in milliseconds (for calculations)
 */
export const DELETION_GRACE_PERIOD_MS = DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Milliseconds per day constant for conversions
 */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Whether to allow immediate deletion without grace period
 * (when user explicitly requests it with immediate: true)
 */
export const ALLOW_IMMEDIATE_DELETION = process.env.ALLOW_IMMEDIATE_DELETION !== 'false';
