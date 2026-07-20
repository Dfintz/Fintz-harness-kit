"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateWithTenant = exports.authenticate = exports.generateToken = exports.authenticateToken = exports.__resetSessionBindingWarnStateForTests = void 0;
const cookies_1 = require("../config/cookies");
const data_source_1 = require("../data-source");
const User_1 = require("../models/User");
const authentication_1 = require("../services/authentication");
const SessionBindingMetricsService_1 = require("../services/security/SessionBindingMetricsService");
const UserApiKeyService_1 = require("../services/security/UserApiKeyService");
const auditLogger_1 = require("../utils/auditLogger");
const logger_1 = require("../utils/logger");
const sessionBinding_1 = require("./sessionBinding");
const authService = new authentication_1.AuthenticationService();
const apiKeyService = new UserApiKeyService_1.UserApiKeyService();
const SESSION_BINDING_WARN_COOLDOWN_MS = Number.parseInt(process.env.SESSION_BINDING_WARN_COOLDOWN_MS ?? '300000', 10);
const SESSION_BINDING_WARN_STATE_MAX = 5000;
const sessionBindingWarnState = new Map();
const getSessionBindingWarnKey = (decodedId, path, mismatches) => {
    const normalizedMismatches = [...mismatches]
        .sort((left, right) => left.localeCompare(right))
        .join('|');
    return `${decodedId}:${path}:${normalizedMismatches}`;
};
const pruneSessionBindingWarnState = () => {
    if (sessionBindingWarnState.size < SESSION_BINDING_WARN_STATE_MAX) {
        return;
    }
    const oldestKey = sessionBindingWarnState.keys().next().value;
    if (oldestKey) {
        sessionBindingWarnState.delete(oldestKey);
    }
};
const getSessionBindingWarnMetadata = (key, now, cooldownMs) => {
    const current = sessionBindingWarnState.get(key);
    if (!current) {
        pruneSessionBindingWarnState();
        sessionBindingWarnState.set(key, { lastWarnAt: now, suppressedCount: 0 });
        return { shouldWarn: true, suppressedSinceLastWarn: 0 };
    }
    if (now - current.lastWarnAt >= cooldownMs) {
        const suppressedSinceLastWarn = current.suppressedCount;
        sessionBindingWarnState.set(key, { lastWarnAt: now, suppressedCount: 0 });
        return { shouldWarn: true, suppressedSinceLastWarn };
    }
    current.suppressedCount += 1;
    sessionBindingWarnState.set(key, current);
    return { shouldWarn: false, suppressedSinceLastWarn: current.suppressedCount };
};
const __resetSessionBindingWarnStateForTests = () => {
    sessionBindingWarnState.clear();
};
exports.__resetSessionBindingWarnStateForTests = __resetSessionBindingWarnStateForTests;
async function tryApiKeyAuth(req, res, ipAddress) {
    const apiKeyHeader = req.headers['x-api-key'];
    if (!apiKeyHeader) {
        return false;
    }
    try {
        const keyData = await apiKeyService.validateKey(apiKeyHeader, undefined, ipAddress);
        if (!keyData) {
            res.status(401).json({ message: 'Invalid or expired API key' });
            return true;
        }
        const userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
        const user = await userRepo
            .createQueryBuilder('user')
            .select(['user.id', 'user.username', 'user.role'])
            .where('user.id = :userId', { userId: keyData.userId })
            .getOne();
        if (!user) {
            res.status(401).json({ message: 'API key owner not found' });
            return true;
        }
        req.user = {
            id: user.id,
            username: user.username,
            role: user.role ?? 'member',
            apiKeyId: keyData.keyId,
            apiKeyScopes: keyData.scopes,
        };
        return true;
    }
    catch (error) {
        logger_1.logger.error('API key authentication failed:', error);
        res.status(500).json({ message: 'API key authentication error' });
        return true;
    }
}
function handleSessionBindingValidation(req, res, decoded, ipAddress) {
    if (!decoded.sessionBinding) {
        return true;
    }
    const currentBinding = (0, sessionBinding_1.createSessionBinding)(req);
    const validation = (0, sessionBinding_1.validateSessionBinding)(decoded.sessionBinding, currentBinding);
    const metricsService = SessionBindingMetricsService_1.SessionBindingMetricsService.getInstance();
    if (validation.valid) {
        metricsService.recordSuccess({
            userId: decoded.id,
            success: true,
            path: req.path,
            enforced: true,
            timestamp: new Date(),
        });
        return true;
    }
    const warnOnly = process.env.SESSION_BINDING_WARN_ONLY === 'true';
    metricsService.recordMismatch({
        userId: decoded.id,
        success: false,
        mismatches: validation.mismatches,
        path: req.path,
        enforced: !warnOnly,
        timestamp: new Date(),
    });
    if (!warnOnly) {
        logger_1.logger.warn('Session binding mismatch', {
            userId: decoded.id,
            mismatches: validation.mismatches,
            path: req.path,
            ip: ipAddress,
            enforced: true,
        });
    }
    else {
        const warnKey = getSessionBindingWarnKey(decoded.id, req.path, validation.mismatches);
        const warnMetadata = getSessionBindingWarnMetadata(warnKey, Date.now(), SESSION_BINDING_WARN_COOLDOWN_MS);
        if (warnMetadata.shouldWarn) {
            logger_1.logger.warn('Session binding mismatch', {
                userId: decoded.id,
                mismatches: validation.mismatches,
                path: req.path,
                ip: ipAddress,
                enforced: false,
                warnCooldownMs: SESSION_BINDING_WARN_COOLDOWN_MS,
                suppressedSinceLastWarn: warnMetadata.suppressedSinceLastWarn,
            });
        }
    }
    if (!warnOnly) {
        res.status(403).json({
            message: 'We detected an unusual login location or device. Please log out and log back in to continue.',
            code: 'SESSION_BINDING_MISMATCH',
            documentationUrl: 'https://docs.example.com/help/session-binding',
        });
        return false;
    }
    return true;
}
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader?.split(' ')[1];
    const cookieToken = req.cookies?.[cookies_1.COOKIE_NAMES.ACCESS_TOKEN];
    const token = headerToken || cookieToken;
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const apiKeyHandled = await tryApiKeyAuth(req, res, ipAddress);
    if (apiKeyHandled) {
        if (req.user) {
            next();
        }
        return;
    }
    if (!token) {
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.AUTH_MISSING_TOKEN,
            ipAddress,
            userAgent,
            message: 'Authentication attempt without token',
            metadata: {
                path: req.path,
                method: req.method,
                hasBotToken: !!req.headers['x-bot-internal-token'],
            },
        });
        res.status(401).json({ message: 'Access token required' });
        return;
    }
    try {
        const decoded = await authService.validateAccessToken(token);
        req.user = {
            id: decoded.id,
            username: decoded.username,
            role: decoded.role,
            jti: decoded.jti,
        };
        if (!handleSessionBindingValidation(req, res, decoded, ipAddress)) {
            return;
        }
        (0, auditLogger_1.logAuthenticationAttempt)(true, decoded.id, decoded.username, ipAddress, userAgent);
        next();
    }
    catch (error) {
        (0, auditLogger_1.logAuthenticationAttempt)(false, undefined, undefined, ipAddress, userAgent, error instanceof Error ? error.message : 'Invalid or expired token');
        const message = error instanceof Error ? error.message : 'Invalid or expired token';
        res.status(401).json({ message });
    }
};
exports.authenticateToken = authenticateToken;
const generateToken = (payload) => authService.generateAccessToken(payload);
exports.generateToken = generateToken;
exports.authenticate = exports.authenticateToken;
const authenticateWithTenant = async (req, res, next) => {
    await (0, exports.authenticateToken)(req, res, (authErr) => {
        if (authErr) {
            return next(authErr);
        }
        const { tenantContext: setTenantContext } = require('./tenantContext');
        return setTenantContext(req, res, next);
    });
};
exports.authenticateWithTenant = authenticateWithTenant;
//# sourceMappingURL=auth.js.map