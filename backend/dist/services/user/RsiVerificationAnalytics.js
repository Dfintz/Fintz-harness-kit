"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rsiVerificationAnalytics = exports.RsiVerificationAnalytics = void 0;
const logger_1 = require("../../utils/logger");
class RsiVerificationAnalytics {
    events = [];
    initiationTimestamps = new Map();
    pruneTimer;
    summaryTimer;
    WINDOW_MS = 24 * 60 * 60 * 1000;
    constructor() {
        this.pruneTimer = setInterval(() => this.pruneOldEvents(), 10 * 60 * 1000);
        this.pruneTimer.unref();
        this.summaryTimer = setInterval(() => {
            const snapshot = this.getSnapshot();
            if (snapshot.recentEvents > 0) {
                logger_1.logger.info('RSI Verification Analytics (hourly)', snapshot);
            }
        }, 60 * 60 * 1000);
        this.summaryTimer.unref();
    }
    recordInitiation(userId) {
        this.initiationTimestamps.set(userId, Date.now());
        this.events.push({ type: 'initiate', timestamp: Date.now() });
    }
    recordCompletion(userId, success, failureReason) {
        const initiatedAt = this.initiationTimestamps.get(userId);
        const durationMs = initiatedAt ? Date.now() - initiatedAt : undefined;
        if (initiatedAt) {
            this.initiationTimestamps.delete(userId);
        }
        this.events.push({
            type: success ? 'complete_success' : 'complete_failure',
            timestamp: Date.now(),
            durationMs,
            failureReason: failureReason ? this.categorizeFailure(failureReason) : undefined,
        });
    }
    recordOrgInitiation(_orgId) {
        this.events.push({ type: 'org_initiate', timestamp: Date.now() });
    }
    recordOrgCompletion(_orgId, success, failureReason) {
        this.events.push({
            type: success ? 'org_complete_success' : 'org_complete_failure',
            timestamp: Date.now(),
            failureReason: failureReason ? this.categorizeFailure(failureReason) : undefined,
        });
    }
    getSnapshot() {
        this.pruneOldEvents();
        const userInitiated = this.events.filter(e => e.type === 'initiate').length;
        const userSuccess = this.events.filter(e => e.type === 'complete_success');
        const userFailed = this.events.filter(e => e.type === 'complete_failure');
        const userCompleted = userSuccess.length + userFailed.length;
        const orgInitiated = this.events.filter(e => e.type === 'org_initiate').length;
        const orgSuccess = this.events.filter(e => e.type === 'org_complete_success').length;
        const orgFailed = this.events.filter(e => e.type === 'org_complete_failure').length;
        const orgCompleted = orgSuccess + orgFailed;
        const completionTimes = userSuccess
            .filter(e => e.durationMs !== undefined)
            .map(e => e.durationMs);
        const avgCompletionTimeMs = completionTimes.length > 0
            ? Math.round(completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length)
            : null;
        const failureReasons = {};
        for (const event of [
            ...userFailed,
            ...this.events.filter(e => e.type === 'org_complete_failure'),
        ]) {
            const reason = event.failureReason || 'unknown';
            failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        }
        return {
            period: '24h',
            user: {
                initiated: userInitiated,
                completed: userCompleted,
                successful: userSuccess.length,
                failed: userFailed.length,
                successRate: userCompleted > 0 ? `${((userSuccess.length / userCompleted) * 100).toFixed(1)}%` : 'N/A',
                avgCompletionTimeMs,
            },
            organization: {
                initiated: orgInitiated,
                completed: orgCompleted,
                successful: orgSuccess,
                failed: orgFailed,
                successRate: orgCompleted > 0 ? `${((orgSuccess / orgCompleted) * 100).toFixed(1)}%` : 'N/A',
            },
            failureReasons,
            recentEvents: this.events.length,
        };
    }
    categorizeFailure(reason) {
        const lower = reason.toLowerCase();
        if (lower.includes('expired')) {
            return 'code_expired';
        }
        if (lower.includes('not found in') && lower.includes('bio')) {
            return 'code_not_in_bio';
        }
        if (lower.includes('not found in') && lower.includes('description')) {
            return 'code_not_in_description';
        }
        if (lower.includes('handle not found') || lower.includes('not found')) {
            return 'handle_not_found';
        }
        if (lower.includes('already verified')) {
            return 'already_verified';
        }
        if (lower.includes('not a member')) {
            return 'not_org_member';
        }
        if (lower.includes('circuit breaker') || lower.includes('rate limit')) {
            return 'api_unavailable';
        }
        if (lower.includes('no bio')) {
            return 'no_bio';
        }
        if (lower.includes('no pending')) {
            return 'no_pending_verification';
        }
        return 'other';
    }
    pruneOldEvents() {
        const cutoff = Date.now() - this.WINDOW_MS;
        this.events = this.events.filter(e => e.timestamp > cutoff);
        const staleCutoff = Date.now() - 2 * this.WINDOW_MS;
        for (const [userId, timestamp] of this.initiationTimestamps.entries()) {
            if (timestamp < staleCutoff) {
                this.initiationTimestamps.delete(userId);
            }
        }
    }
}
exports.RsiVerificationAnalytics = RsiVerificationAnalytics;
exports.rsiVerificationAnalytics = new RsiVerificationAnalytics();
//# sourceMappingURL=RsiVerificationAnalytics.js.map