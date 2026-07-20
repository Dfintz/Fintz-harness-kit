"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.v1ShutdownMiddleware = exports.v1DeprecationMiddleware = exports.trackApiVersion = void 0;
exports.getV1UsageStats = getV1UsageStats;
const logger_1 = require("../utils/logger");
const trackApiVersion = (req, res, next) => {
    const isV2 = req.path.startsWith('/api/v2');
    const isV1 = req.path.startsWith('/api') && !isV2;
    let version;
    if (isV2) {
        version = 'v2';
    }
    else if (isV1) {
        version = 'v1';
    }
    else {
        version = 'unknown';
    }
    req.apiVersion = version;
    if (isV2) {
        res.setHeader('X-API-Version', '2.0.0');
        res.setHeader('X-API-Deprecation', 'false');
    }
    next();
};
exports.trackApiVersion = trackApiVersion;
const SUNSET_DATE = new Date('2026-08-01T00:00:00Z');
const V1_TO_V2_PATHS = {
    '/api/activities': '/api/v2/activities',
    '/api/admin': '/api/v2/admin',
    '/api/alliance-diplomacy': '/api/v2/alliance-diplomacy',
    '/api/auth': '/api/v2/auth',
    '/api/bounties': '/api/v2/bounties',
    '/api/briefings': '/api/v2/briefings',
    '/api/contacts': '/api/v2/contacts',
    '/api/crews': '/api/v2/crew-assignments',
    '/api/discord': '/api/v2/discord',
    '/api/events': '/api/v2/activities',
    '/api/fleets': '/api/v2/fleets',
    '/api/jobs': '/api/v2/jobs',
    '/api/logistics': '/api/v2/logistics',
    '/api/notifications': '/api/v2/notifications',
    '/api/organizations': '/api/v2/organizations',
    '/api/permissions': '/api/v2/permissions',
    '/api/roles': '/api/v2/roles',
    '/api/rsi': '/api/v2/rsi',
    '/api/ships': '/api/v2/ships',
    '/api/squadrons': '/api/v2/squadrons',
    '/api/tickets': '/api/v2/tickets',
    '/api/trading': '/api/v2/trading',
    '/api/users': '/api/v2/users',
    '/api/webhooks': '/api/v2/webhooks',
};
function getV2Path(v1Path) {
    for (const [v1Pattern, v2Path] of Object.entries(V1_TO_V2_PATHS)) {
        if (v1Path.startsWith(v1Pattern)) {
            return v1Path.replace(v1Pattern, v2Path);
        }
    }
    return null;
}
var DeprecationLevel;
(function (DeprecationLevel) {
    DeprecationLevel["INFO"] = "info";
    DeprecationLevel["WARNING"] = "warning";
    DeprecationLevel["CRITICAL"] = "critical";
})(DeprecationLevel || (DeprecationLevel = {}));
function getDeprecationLevel() {
    const now = new Date();
    const daysUntilSunset = Math.floor((SUNSET_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilSunset <= 30) {
        return DeprecationLevel.CRITICAL;
    }
    else if (daysUntilSunset <= 90) {
        return DeprecationLevel.WARNING;
    }
    else {
        return DeprecationLevel.INFO;
    }
}
const v1DeprecationMiddleware = (req, res, next) => {
    if (!req.path.startsWith('/api/') || req.path.startsWith('/api/v2/')) {
        return next();
    }
    const v2Path = getV2Path(req.path);
    if (!v2Path) {
        return next();
    }
    const deprecationLevel = getDeprecationLevel();
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', SUNSET_DATE.toUTCString());
    if (v2Path) {
        res.setHeader('Link', `<${v2Path}>; rel="successor-version"`);
    }
    const warningMessage = getWarningMessage(deprecationLevel, v2Path);
    res.setHeader('X-API-Warn', warningMessage);
    logV1Usage(req, deprecationLevel);
    next();
};
exports.v1DeprecationMiddleware = v1DeprecationMiddleware;
function getWarningMessage(level, v2Path) {
    const baseMessage = `API v1 is deprecated and will be removed on ${SUNSET_DATE.toISOString().split('T')[0]}.`;
    const migrationMessage = v2Path
        ? ` Please migrate to ${v2Path}`
        : ' Please migrate to v2. See /api/v2/health for details.';
    switch (level) {
        case DeprecationLevel.CRITICAL:
            return `CRITICAL: ${baseMessage}${migrationMessage}`;
        case DeprecationLevel.WARNING:
            return `WARNING: ${baseMessage}${migrationMessage}`;
        case DeprecationLevel.INFO:
        default:
            return `${baseMessage}${migrationMessage}`;
    }
}
function logV1Usage(req, level) {
    if (level === DeprecationLevel.INFO) {
        return;
    }
    logger_1.logger.warn('V1 API usage detected', {
        deprecationLevel: level,
        method: req.method,
        path: req.path,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        userId: req.user?.id,
    });
}
const v1ShutdownMiddleware = (req, res, next) => {
    if (!req.path.startsWith('/api/') || req.path.startsWith('/api/v2/')) {
        return next();
    }
    const publicPrefixes = [
        '/api/public-directory',
        '/api/public-job-listings',
        '/api/contact-requests',
    ];
    if (publicPrefixes.some(prefix => req.path.startsWith(prefix))) {
        return next();
    }
    const now = new Date();
    if (now >= SUNSET_DATE) {
        const v2Path = getV2Path(req.path);
        if (!v2Path) {
            return next();
        }
        res.status(410).json({
            error: 'API Version Discontinued',
            message: `API v1 was discontinued on ${SUNSET_DATE.toISOString()}. Please use API v2.`,
            v2Endpoint: v2Path || '/api/v2',
            documentation: '/api/v2/health',
        });
        return;
    }
    next();
};
exports.v1ShutdownMiddleware = v1ShutdownMiddleware;
async function getV1UsageStats() {
    return {
        totalRequests: 0,
        uniqueEndpoints: [],
        topEndpoints: [],
        uniqueUsers: 0,
    };
}
//# sourceMappingURL=v1Deprecation.js.map