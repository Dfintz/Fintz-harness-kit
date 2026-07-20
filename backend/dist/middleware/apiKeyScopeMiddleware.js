"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__resetApiKeyScopePhaseForTests = exports.__setApiKeyScopePhaseForTests = exports.requireScope = void 0;
const ApiKeyScopeService_1 = require("../services/security/ApiKeyScopeService");
const auditLogger_1 = require("../utils/auditLogger");
const logger_1 = require("../utils/logger");
const scopeService = new ApiKeyScopeService_1.ApiKeyScopeService();
const API_KEY_SCOPE_ENFORCEMENT_PHASE = Number.parseInt(process.env.API_KEY_SCOPE_ENFORCEMENT_PHASE ?? '1', 10);
const requireScope = (required, phaseRequired = 1) => async (req, res, next) => {
    try {
        const isApiKeyAuth = req.user?.apiKeyId !== undefined && req.user?.apiKeyScopes !== undefined;
        if (!isApiKeyAuth) {
            next();
            return;
        }
        const hasScope = scopeService.hasScope(req.user.apiKeyScopes, required);
        if (!hasScope) {
            const currentPhase = API_KEY_SCOPE_ENFORCEMENT_PHASE;
            if (currentPhase === 0) {
                logger_1.logger.warn(`[API_KEY_SCOPE_GRACE_PERIOD] API key would lack scope: ` +
                    `user=${req.user.id}, key=${req.user.apiKeyId}, ` +
                    `required=${required}, granted=${req.user.apiKeyScopes?.join(',')}`);
                next();
                return;
            }
            if (currentPhase >= phaseRequired) {
                (0, auditLogger_1.logAuditEvent)({
                    eventType: 'API_KEY_SCOPE_DENIED',
                    userId: req.user.id,
                    organizationId: req.user.currentOrganizationId,
                    apiKeyId: req.user.apiKeyId,
                    details: {
                        requiredScope: required,
                        availableScopes: req.user.apiKeyScopes,
                        endpoint: `${req.method} ${req.path}`,
                        ipAddress: req.ip,
                        userAgent: req.headers['user-agent'],
                    },
                });
                logger_1.logger.warn(`API key scope denied: user=${req.user.id}, key=${req.user.apiKeyId}, ` +
                    `endpoint=${req.method} ${req.path}, required=${required}`);
                res.status(403).json({
                    message: 'API key does not have required scope',
                    code: 'INSUFFICIENT_SCOPE',
                    required,
                    granted: req.user.apiKeyScopes,
                });
                return;
            }
            next();
            return;
        }
        next();
    }
    catch (error) {
        logger_1.logger.error('API key scope validation error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};
exports.requireScope = requireScope;
const __setApiKeyScopePhaseForTests = (phase) => {
    global.__API_KEY_SCOPE_ENFORCEMENT_PHASE_OVERRIDE = phase;
};
exports.__setApiKeyScopePhaseForTests = __setApiKeyScopePhaseForTests;
const __resetApiKeyScopePhaseForTests = () => {
    delete global.__API_KEY_SCOPE_ENFORCEMENT_PHASE_OVERRIDE;
};
exports.__resetApiKeyScopePhaseForTests = __resetApiKeyScopePhaseForTests;
//# sourceMappingURL=apiKeyScopeMiddleware.js.map