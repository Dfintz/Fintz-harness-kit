"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdaptiveRateLimiter = void 0;
const DEFAULT_BACKOFF_MULTIPLIER = 2;
const DEFAULT_RECOVERY_MULTIPLIER = 0.5;
const DEFAULT_MAX_COOLDOWN_MS = 30_000;
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function defaultSleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
class AdaptiveRateLimiter {
    minIntervalMs;
    maxIntervalMs;
    backoffMultiplier;
    recoveryMultiplier;
    maxCooldownMs;
    label;
    now;
    sleep;
    currentIntervalMs;
    nextAllowedAt = 0;
    acquisitions = 0;
    backpressureEvents = 0;
    totalWaitMs = 0;
    peakIntervalMs;
    constructor(options) {
        const min = Math.max(0, options.minIntervalMs);
        this.minIntervalMs = min;
        this.maxIntervalMs = Math.max(min, options.maxIntervalMs);
        this.backoffMultiplier = Math.max(1, options.backoffMultiplier ?? DEFAULT_BACKOFF_MULTIPLIER);
        this.recoveryMultiplier = clamp(options.recoveryMultiplier ?? DEFAULT_RECOVERY_MULTIPLIER, 0.01, 1);
        this.maxCooldownMs = Math.max(0, options.maxCooldownMs ?? DEFAULT_MAX_COOLDOWN_MS);
        this.label = options.label ?? 'adaptive-rate-limiter';
        this.now = options.now ?? Date.now;
        this.sleep = options.sleep ?? defaultSleep;
        this.currentIntervalMs = this.minIntervalMs;
        this.peakIntervalMs = this.minIntervalMs;
    }
    async acquire() {
        const now = this.now();
        const waitMs = Math.max(0, this.nextAllowedAt - now);
        if (waitMs > 0) {
            await this.sleep(waitMs);
            this.totalWaitMs += waitMs;
        }
        this.nextAllowedAt = now + waitMs + this.currentIntervalMs;
        this.acquisitions += 1;
        return waitMs;
    }
    recordSuccess() {
        this.currentIntervalMs = clamp(this.currentIntervalMs * this.recoveryMultiplier, this.minIntervalMs, this.maxIntervalMs);
    }
    recordBackpressure(retryAfterMs) {
        this.backpressureEvents += 1;
        this.currentIntervalMs = clamp(this.currentIntervalMs * this.backoffMultiplier, this.minIntervalMs, this.maxIntervalMs);
        this.peakIntervalMs = Math.max(this.peakIntervalMs, this.currentIntervalMs);
        if (typeof retryAfterMs === 'number' && retryAfterMs > 0) {
            const cooldown = clamp(retryAfterMs, 0, this.maxCooldownMs);
            this.nextAllowedAt = Math.max(this.nextAllowedAt, this.now() + cooldown);
        }
    }
    getStats() {
        return {
            acquisitions: this.acquisitions,
            backpressureEvents: this.backpressureEvents,
            totalWaitMs: this.totalWaitMs,
            peakIntervalMs: this.peakIntervalMs,
            currentIntervalMs: this.currentIntervalMs,
        };
    }
    getLabel() {
        return this.label;
    }
}
exports.AdaptiveRateLimiter = AdaptiveRateLimiter;
//# sourceMappingURL=adaptiveRateLimiter.js.map