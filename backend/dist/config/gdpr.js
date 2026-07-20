"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOW_IMMEDIATE_DELETION = exports.MS_PER_DAY = exports.DELETION_GRACE_PERIOD_MS = exports.DELETION_GRACE_PERIOD_DAYS = exports.MAX_GRACE_PERIOD_DAYS = exports.MIN_GRACE_PERIOD_DAYS = void 0;
exports.MIN_GRACE_PERIOD_DAYS = 1;
exports.MAX_GRACE_PERIOD_DAYS = 30;
const configuredGracePeriod = parseInt(process.env.DELETION_GRACE_PERIOD_DAYS || '30', 10);
if (configuredGracePeriod < exports.MIN_GRACE_PERIOD_DAYS) {
    throw new Error(`DELETION_GRACE_PERIOD_DAYS must be at least ${exports.MIN_GRACE_PERIOD_DAYS} day(s)`);
}
if (configuredGracePeriod > exports.MAX_GRACE_PERIOD_DAYS) {
    throw new Error(`DELETION_GRACE_PERIOD_DAYS must not exceed ${exports.MAX_GRACE_PERIOD_DAYS} days (GDPR compliance requirement)`);
}
exports.DELETION_GRACE_PERIOD_DAYS = configuredGracePeriod;
exports.DELETION_GRACE_PERIOD_MS = exports.DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
exports.MS_PER_DAY = 24 * 60 * 60 * 1000;
exports.ALLOW_IMMEDIATE_DELETION = process.env.ALLOW_IMMEDIATE_DELETION !== 'false';
//# sourceMappingURL=gdpr.js.map