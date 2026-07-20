"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryWithBackoff = retryWithBackoff;
exports.retryWithJitter = retryWithJitter;
const logger_1 = require("./logger");
const DEFAULT_RETRY_OPTIONS = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
};
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function calculateBackoffDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier) {
    const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
    return Math.min(delay, maxDelayMs);
}
function isRetryableError(error, retryableErrors) {
    if (!retryableErrors || retryableErrors.length === 0) {
        return true;
    }
    return retryableErrors.some(ErrorClass => error instanceof ErrorClass);
}
async function retryWithBackoff(operation, options = {}) {
    const { maxAttempts = DEFAULT_RETRY_OPTIONS.maxAttempts, initialDelayMs = DEFAULT_RETRY_OPTIONS.initialDelayMs, maxDelayMs = DEFAULT_RETRY_OPTIONS.maxDelayMs, backoffMultiplier = DEFAULT_RETRY_OPTIONS.backoffMultiplier, retryableErrors, onRetry, } = options;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt === maxAttempts || !isRetryableError(lastError, retryableErrors)) {
                throw lastError;
            }
            const delayMs = calculateBackoffDelay(attempt, initialDelayMs, maxDelayMs, backoffMultiplier);
            logger_1.logger.warn(`Operation failed, retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})`, {
                error: lastError.message,
                attempt,
                maxAttempts,
                delayMs,
            });
            await sleep(delayMs);
            if (onRetry) {
                try {
                    onRetry(lastError, attempt);
                }
                catch (callbackError) {
                    logger_1.logger.error('Retry callback failed', { error: callbackError });
                }
            }
        }
    }
    throw lastError ?? new Error('Retry failed after maximum attempts');
}
async function retryWithJitter(operation, options = {}) {
    return retryWithBackoff(operation, {
        ...options,
        initialDelayMs: (options.initialDelayMs || DEFAULT_RETRY_OPTIONS.initialDelayMs) * (0.5 + Math.random() * 0.5),
    });
}
//# sourceMappingURL=retryHelper.js.map