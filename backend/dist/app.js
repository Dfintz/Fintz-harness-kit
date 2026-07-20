"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
require("reflect-metadata");
const node_http_1 = require("node:http");
const body_parser_1 = require("body-parser");
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
dotenv_1.default.config();
const botApp_1 = require("./bot/botApp");
const applicationInsights_1 = require("./config/applicationInsights");
const database_1 = require("./config/database");
const rateLimitConfig_1 = require("./config/rateLimitConfig");
const swagger_1 = require("./config/swagger");
const container_1 = require("./container");
const FleetTenantController_1 = require("./controllers/FleetTenantController");
const gdprDataCleanup_1 = require("./jobs/gdprDataCleanup");
const intelAuditLogRotation_1 = require("./jobs/intelAuditLogRotation");
const jwtBlacklistCleanup_1 = require("./jobs/jwtBlacklistCleanup");
const rsiAffiliationBatchJob_1 = require("./jobs/rsiAffiliationBatchJob");
const rsiCrawlerJob_1 = require("./jobs/rsiCrawlerJob");
const rsiSyncScheduler_1 = require("./jobs/rsiSyncScheduler");
const rsiVerificationAutoDetectJob_1 = require("./jobs/rsiVerificationAutoDetectJob");
const sandboxUserCleanupJob_1 = require("./jobs/sandboxUserCleanupJob");
const shipDataFetcher_1 = require("./jobs/shipDataFetcher");
const auth_1 = require("./middleware/auth");
const csrf_1 = require("./middleware/csrf");
const errorHandler_1 = require("./middleware/errorHandler");
const requestCorrelation_1 = require("./middleware/requestCorrelation");
const security_1 = require("./middleware/security");
const v1Deprecation_1 = require("./middleware/v1Deprecation");
const routing_1 = require("./routing");
const FeatureFlagService_1 = require("./services/admin/FeatureFlagService");
const discord_1 = require("./services/discord");
const ChangelogWebhookService_1 = require("./services/discord/ChangelogWebhookService");
const DiscordService_1 = require("./services/discord/DiscordService");
const health_1 = require("./services/health");
const infrastructure_1 = require("./services/infrastructure");
const ErrorTrackingService_1 = require("./services/monitoring/ErrorTrackingService");
const CASActivityLevelBridge_1 = require("./services/organization/CASActivityLevelBridge");
const OrganizationFederationService_1 = require("./services/organization/OrganizationFederationService");
const MemberCleanupHandler_1 = require("./services/shared/MemberCleanupHandler");
const cleanupJobs_1 = require("./utils/cleanupJobs");
const logger_1 = require("./utils/logger");
const redis_1 = require("./utils/redis");
const validationState_1 = require("./utils/validationState");
const websocketServer_1 = require("./websocket/websocketServer");
(0, applicationInsights_1.initializeApplicationInsights)();
ErrorTrackingService_1.errorTrackingService.initialize();
(0, container_1.initializeContainer)();
const app = (0, express_1.default)();
app.disable('x-powered-by');
const httpServer = (0, node_http_1.createServer)(app);
const PORT = process.env.PORT ?? 3000;
const validationErrors = (0, security_1.validateEnvironment)();
(0, validationState_1.setValidationErrors)(validationErrors);
if (validationErrors.length > 0 && process.env.NODE_ENV === 'production') {
    if (process.env.ALLOW_INSECURE_STARTUP !== 'true') {
        logger_1.logger.error(`Refusing to start: ${validationErrors.length} environment validation error(s) in production. Set ALLOW_INSECURE_STARTUP=true to override (NOT RECOMMENDED).`);
        process.exit(1);
    }
    logger_1.logger.error('ALLOW_INSECURE_STARTUP=true — starting despite environment validation errors. This is a security risk.');
}
(0, rateLimitConfig_1.logRateLimitConfig)();
const initializeSecretsManager = async () => {
    try {
        const secretsManager = infrastructure_1.SecretsManagerService.getInstance();
        await secretsManager.initialize();
        logger_1.logger.info('Secrets manager initialized successfully');
    }
    catch (error) {
        logger_1.logger.warn('Secrets manager initialization failed, using environment variables:', error);
    }
};
app.use((req, res, next) => {
    if (req.path.startsWith('/api-docs')) {
        return next();
    }
    (0, security_1.helmetConfig)(req, res, next);
});
app.use(security_1.removePoweredBy);
app.use(security_1.corsConfig);
app.use((0, requestCorrelation_1.requestCorrelationMiddleware)());
const azureFrontDoorId = process.env.AZURE_FRONT_DOOR_ID;
const BOT_INTERNAL_ALLOWED_PATH_PREFIXES = [
    '/api/recruitments',
    '/api/v2/recruitment',
    '/api/v2/tickets',
    '/api/v2/invitations',
    '/api/alliance-diplomacy',
    '/api/v2/alliance-diplomacy',
    '/api/v2/rsi/role-mapping',
    '/api/bot/rsi',
];
const isAllowedBotInternalPath = (path) => BOT_INTERNAL_ALLOWED_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
if (azureFrontDoorId) {
    app.use((req, res, next) => {
        if (req.path === '/health' || req.path === '/ready') {
            return next();
        }
        if (req.path === '/api/v2/discord/webhook-events') {
            return next();
        }
        const rawIp = req.socket.remoteAddress || '';
        if (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '::ffff:127.0.0.1') {
            return next();
        }
        if (req.headers['x-bot-internal-token'] && isAllowedBotInternalPath(req.path)) {
            return next();
        }
        const fdid = req.headers['x-azure-fdid'];
        if (fdid !== azureFrontDoorId) {
            res.status(403).json({ error: 'Direct access not permitted' });
            return;
        }
        next();
    });
}
if (process.env.NODE_ENV === 'production') {
    const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '2', 10);
    app.set('trust proxy', Number.isFinite(trustProxyHops) && trustProxyHops > 0 ? trustProxyHops : 2);
    const allowedRedirectHosts = new Set();
    (process.env.CORS_ORIGIN ?? '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean)
        .forEach(origin => {
        try {
            allowedRedirectHosts.add(new URL(origin).host.toLowerCase());
        }
        catch {
        }
    });
    (process.env.PUBLIC_HOSTS ?? '')
        .split(',')
        .map(h => h.trim().toLowerCase())
        .filter(Boolean)
        .forEach(h => allowedRedirectHosts.add(h));
    app.use((req, res, next) => {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        const host = (req.get('host') ?? '').toLowerCase();
        const isInternal = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.includes('.internal.');
        if (!isInternal && !req.secure && req.get('x-forwarded-proto') !== 'https') {
            const hostnameOnly = host.split(':')[0];
            let canonicalHost = null;
            if (allowedRedirectHosts.has(host)) {
                canonicalHost = host;
            }
            else if (allowedRedirectHosts.has(hostnameOnly)) {
                canonicalHost = hostnameOnly;
            }
            if (!canonicalHost) {
                logger_1.logger.warn('HTTPS redirect blocked: Host header not in allowlist', { host });
                res.status(400).json({ error: 'Invalid Host header' });
                return;
            }
            return res.redirect(301, `https://${canonicalHost}${req.url}`);
        }
        next();
    });
}
app.use(security_1.rateLimiter);
app.use((0, compression_1.default)({
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    },
    level: 6,
}));
const discordWebhookEventRoutes_1 = require("./routes/discordWebhookEventRoutes");
(0, discordWebhookEventRoutes_1.setDiscordWebhookEventRoutes)(app);
app.use((0, body_parser_1.json)({ limit: '5mb' }));
const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret && process.env.NODE_ENV === 'production') {
    throw new Error('COOKIE_SECRET is required in production! Generate with: openssl rand -base64 32');
}
if (cookieSecret) {
    app.use((0, cookie_parser_1.default)(cookieSecret));
    logger_1.logger.info('Cookie parser initialized with secret (cookies will be signed)');
}
else {
    logger_1.logger.warn('⚠️  COOKIE_SECRET not set; cookies will not be signed. This is acceptable for development only!');
    app.use((0, cookie_parser_1.default)());
}
app.use(csrf_1.csrfTokenMiddleware);
const CSRF_EXEMPT_PATHS = new Set([
    '/api/v2/auth/discord/callback',
    '/api/auth/discord/callback',
    '/api/v2/auth/azuread/callback',
    '/api/auth/login',
    '/api/v2/auth/login',
    '/api/auth/demo',
    '/api/v2/auth/demo',
    '/api/auth/logout',
    '/api/v2/auth/logout',
    '/api/auth/logout-all',
    '/api/v2/auth/logout-all',
    '/api/v2/errors/track',
    '/api/v2/metrics/web-vitals',
    '/api/v2/webauthn/authenticate/options',
    '/api/v2/webauthn/authenticate/verify',
]);
app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return next();
    }
    if (req.headers['x-bot-internal-token'] && isAllowedBotInternalPath(req.path)) {
        return next();
    }
    if (req.path.startsWith('/health') || req.path.startsWith('/api-docs')) {
        return next();
    }
    if (req.path.startsWith('/dev')) {
        return next();
    }
    if (CSRF_EXEMPT_PATHS.has(req.path)) {
        return next();
    }
    csrf_1.csrfProtection.validate(req, res, next);
});
app.use(security_1.sanitizeInput);
app.use(v1Deprecation_1.trackApiVersion);
app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
});
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use(express_1.default.static('public'));
const swaggerEnabled = (0, security_1.resolveSwaggerEnabled)();
const swaggerRequireAuth = process.env.NODE_ENV === 'production' && process.env.SWAGGER_REQUIRE_AUTH !== 'false';
if (swaggerEnabled) {
    if (swaggerRequireAuth) {
        app.use('/api-docs', auth_1.authenticate, security_1.swaggerCspMiddleware, swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
        logger_1.logger.info('Swagger UI enabled at /api-docs (authentication required)');
    }
    else {
        app.use('/api-docs', security_1.swaggerCspMiddleware, swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
        logger_1.logger.info('Swagger UI enabled at /api-docs (public access)');
    }
}
else {
    logger_1.logger.info('Swagger UI disabled');
}
const setHealthRoutes = async () => {
    const { setHealthRoutes: registerHealthRoutes } = await Promise.resolve().then(() => __importStar(require('./routes/healthRoutes')));
    registerHealthRoutes(app);
};
const registerApiRoutes = async () => {
    const [{ v2Router }, { router: mobileDownloadRouter }, { router: bountyRoutes }, { router: matchmakingRoutes }, { router: performanceRoutes }, { router: publicDirectoryRoutes }, { router: publicJobListingRoutes }, { router: contactRequestRoutes }, { router: secretsRoutes }, { router: tunnelRoutes }, { router: tradingRoutes }, { router: gdprRoutes }, { router: discordRoutes }, { router: orgRelationshipRoutes }, { router: featureFlagRoutes }, { router: devRoutes }, { setAllianceDiplomacyRoutes }, { setAttendanceRoutes }, { setAuthRoutes }, { setBriefingRoutes }, { setCargoManifestRoutes }, { setCrewAssignmentRoutes }, { setFleetLogisticsRoutes }, { setFleetViewRoutes }, { setFleetVisibilityRoutes }, { setImageRoutes }, { setIntelVaultRoutes }, { setMemberAuditRoutes }, { setMiningOperationRoutes: _setMiningOperationRoutes }, { setOrganizationInventoryRoutes }, { setOrganizationRoutes }, { setOrganizationShipRoutes }, { setRecruitmentRoutes }, { setReputationRoutes }, { setRsiRoleMappingRoutes }, { setRsiUserLinkBotRoutes }, { setRsiVerificationRoutes }, { setSharedAccountRoutes }, { setShipDataRoutes }, { setSquadronRoutes }, { setTournamentRoutes }, { setTreatyTemplateRoutes }, { setTwoFactorRoutes }, { setUserShipRoutes }, { setWebAuthnRoutes }, { setWebhookRoutes },] = await Promise.all([
        Promise.resolve().then(() => __importStar(require('./routes/v2'))),
        Promise.resolve().then(() => __importStar(require('./routes/v2/mobile'))),
        Promise.resolve().then(() => __importStar(require('./routes/bountyRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/matchmakingRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/performanceRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/publicDirectoryRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/publicJobListingRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/contactRequestRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/secretsRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/tunnelRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/trading'))),
        Promise.resolve().then(() => __importStar(require('./routes/gdprRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/discordRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/orgRelationshipRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/featureFlagRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/dev.routes'))),
        Promise.resolve().then(() => __importStar(require('./routes/allianceDiplomacyRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/attendanceRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/authRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/briefingRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/cargoManifestRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/crewAssignmentRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/fleetLogisticsRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/fleetViewRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/fleetVisibilityRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/imageRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/intelVaultRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/memberAuditRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/miningOperationRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/organizationInventoryRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/organizationRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/organizationShipRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/recruitmentRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/reputationRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/rsiRoleMappingRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/rsiUserLinkBotRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/rsiVerificationRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/sharedAccountRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/shipDataRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/squadronRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/tournamentRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/treatyTemplateRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/twoFactorRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/userShipRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/webAuthnRoutes'))),
        Promise.resolve().then(() => __importStar(require('./routes/webhookRoutes'))),
    ]);
    app.use('/dev', devRoutes);
    app.use('/api/v2', v2Router);
    app.use('/mobile', mobileDownloadRouter);
    app.use(v1Deprecation_1.v1ShutdownMiddleware);
    app.use(v1Deprecation_1.v1DeprecationMiddleware);
    app.use('/api', publicDirectoryRoutes);
    app.use('/api', publicJobListingRoutes);
    app.use('/api', contactRequestRoutes);
    setRsiUserLinkBotRoutes(app);
    setOrganizationRoutes(app);
    setOrganizationInventoryRoutes(app);
    setImageRoutes(app);
    setTournamentRoutes(app);
    setCrewAssignmentRoutes(app);
    setReputationRoutes(app);
    setCargoManifestRoutes(app);
    setAllianceDiplomacyRoutes(app);
    setFleetLogisticsRoutes(app);
    setTwoFactorRoutes(app);
    setWebAuthnRoutes(app);
    setAuthRoutes(app);
    app.use('/api/v2/bounties', bountyRoutes);
    app.use('/api/bounties', bountyRoutes);
    app.use('/api/matchmaking', matchmakingRoutes);
    setRecruitmentRoutes(app);
    setShipDataRoutes(app);
    setFleetViewRoutes(app);
    setFleetVisibilityRoutes(app);
    setBriefingRoutes(app);
    setSharedAccountRoutes(app);
    setAttendanceRoutes(app);
    setIntelVaultRoutes(app);
    setMemberAuditRoutes(app);
    setRsiVerificationRoutes(app);
    setRsiRoleMappingRoutes(app);
    app.use('/api/secrets', secretsRoutes);
    app.use('/api/tunnels', tunnelRoutes);
    app.use('/api/trading', tradingRoutes);
    app.use('/api/gdpr', gdprRoutes);
    app.use('/api/feature-flags', featureFlagRoutes);
    app.use('/api/performance', performanceRoutes);
    app.use('/api', discordRoutes);
    app.use('/api', orgRelationshipRoutes);
    setWebhookRoutes(app);
    setUserShipRoutes(app);
    setOrganizationShipRoutes(app);
    setSquadronRoutes(app);
    setTreatyTemplateRoutes(app);
    try {
        const secretsManager = infrastructure_1.SecretsManagerService.getInstance();
        const discordBotToken = secretsManager.getSecret('DISCORD_BOT_TOKEN') || process.env.DISCORD_BOT_TOKEN || undefined;
        const discordClientId = process.env.DISCORD_CLIENT_ID || undefined;
        const discordClientSecret = secretsManager.getSecret('DISCORD_CLIENT_SECRET') ||
            process.env.DISCORD_CLIENT_SECRET ||
            undefined;
        const discordRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND || process.env.DISCORD_REDIRECT_URI || undefined;
        if (discordBotToken && discordClientId && discordClientSecret && discordRedirectUri) {
            (0, DiscordService_1.initializeDiscordService)(discordBotToken, discordClientId, discordClientSecret, discordRedirectUri);
            logger_1.logger.info('Discord service initialized with SSO support');
        }
        else {
            logger_1.logger.warn('Discord SSO credentials not fully configured - Discord service not initialized');
            logger_1.logger.warn('Required credentials status:', {
                discordBotTokenConfigured: Boolean(discordBotToken),
                discordClientIdConfigured: Boolean(discordClientId),
                discordClientSecretConfigured: Boolean(discordClientSecret),
                discordRedirectUriConfigured: Boolean(discordRedirectUri),
            });
        }
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize Discord service:', error);
    }
    app.use(errorHandler_1.notFoundHandler);
    app.use(errorHandler_1.errorHandler);
};
const startServer = async () => {
    try {
        await Promise.all([initializeSecretsManager(), (0, database_1.initializeDatabase)()]);
        (0, container_1.registerDatabaseDependencies)();
        (0, CASActivityLevelBridge_1.getCASActivityLevelBridge)();
        (0, MemberCleanupHandler_1.getMemberCleanupHandler)();
        await FeatureFlagService_1.FeatureFlagService.initializeDefaultFlags();
        logger_1.logger.info('Feature flags initialized');
        if (process.env.NODE_ENV !== 'production') {
            await OrganizationFederationService_1.OrganizationFederationService.getInstance().seedDemoFederations();
        }
        await setHealthRoutes();
        await registerApiRoutes();
        (0, routing_1.registerControllers)(app, [FleetTenantController_1.FleetTenantController], {
            prefix: '/api',
            debug: process.env.NODE_ENV === 'development',
        });
        logger_1.logger.info('Decorator-based controllers registered after database initialization');
        (0, websocketServer_1.initializeWebSocketServer)(httpServer);
        const websocketTransportReadiness = await (0, websocketServer_1.awaitWebSocketTransportReady)();
        if (websocketTransportReadiness.timedOut) {
            logger_1.logger.warn('WebSocket transport readiness timed out before startup declaration', {
                mode: websocketTransportReadiness.mode,
                reason: websocketTransportReadiness.reason,
                waitedMs: websocketTransportReadiness.waitedMs,
            });
        }
        else {
            logger_1.logger.info('WebSocket transport ready', {
                mode: websocketTransportReadiness.mode,
                reason: websocketTransportReadiness.reason,
                waitedMs: websocketTransportReadiness.waitedMs,
                latencyMs: websocketTransportReadiness.latencyMs,
            });
        }
        await health_1.healthMonitor
            .logHealthSummary()
            .catch(err => logger_1.logger.warn('Failed to log initial health summary:', err));
        httpServer.listen(PORT, () => {
            logger_1.logger.info(`Server is running on http://localhost:${PORT}`);
            logger_1.logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
            logger_1.logger.info(`WebSocket server available at ws://localhost:${PORT}`);
            logger_1.logger.info('Health endpoints: /health, /health/system, /health/component/:name');
            (0, jwtBlacklistCleanup_1.startJwtBlacklistCleanupJob)();
            (0, discord_1.startRoleSyncRetryService)();
            logger_1.logger.info('Role sync retry queue processor started');
            if (process.env.DISABLE_BACKGROUND_JOBS === 'true') {
                logger_1.logger.info('Background jobs disabled (DISABLE_BACKGROUND_JOBS=true — worker container handles them)');
            }
            else {
                (0, cleanupJobs_1.startRefreshTokenCleanup)();
                (0, sandboxUserCleanupJob_1.startSandboxUserCleanupJob)();
                logger_1.logger.info('Sandbox user cleanup job started (daily, default retention 30 days)');
                if (process.env.NODE_ENV === 'production') {
                    (0, gdprDataCleanup_1.scheduleGdprCleanup)();
                    logger_1.logger.info('GDPR data cleanup job scheduled for daily 3 AM execution');
                    (0, intelAuditLogRotation_1.scheduleIntelAuditLogRotation)();
                    logger_1.logger.info('Intel audit log rotation job scheduled for daily 4 AM execution (30-day retention)');
                }
                else {
                    logger_1.logger.info('GDPR data cleanup job disabled in non-production environment');
                    logger_1.logger.info('Intel audit log rotation job disabled in non-production environment');
                }
                if (process.env.DISABLE_EXTERNAL_FETCHES === 'true') {
                    logger_1.logger.info('External data fetches disabled (DISABLE_EXTERNAL_FETCHES=true) — skipping Regolith and ShipDataFetcher');
                }
                else {
                    logger_1.logger.info('Regolith mining data fetch job disabled (standalone mining feature disabled)');
                    shipDataFetcher_1.ShipDataFetcher.schedule();
                    logger_1.logger.info('Ship data fetch job scheduled (daily at 2 AM UTC)');
                    if (process.env.ENABLE_RSI_CRAWLER_JOB === 'true') {
                        (0, rsiCrawlerJob_1.startRsiCrawlerJob)();
                        logger_1.logger.info('RSI crawler job scheduled (every 6 hours by default)');
                    }
                    else {
                        logger_1.logger.info('RSI crawler job disabled (set ENABLE_RSI_CRAWLER_JOB=true to enable)');
                    }
                    (0, rsiSyncScheduler_1.startRsiSyncSchedulerJob)();
                    logger_1.logger.info('RSI sync scheduler job started (checks every 15 minutes)');
                    if (process.env.ENABLE_RSI_VERIFICATION_AUTO_DETECT_IN_API === 'true') {
                        (0, rsiVerificationAutoDetectJob_1.startRsiVerificationAutoDetectJob)();
                        logger_1.logger.info('RSI verification auto-detect job started in API process (fallback mode)');
                    }
                    else {
                        logger_1.logger.info('RSI verification auto-detect owned by worker process (set ENABLE_RSI_VERIFICATION_AUTO_DETECT_IN_API=true for API fallback)');
                    }
                    if (process.env.ENABLE_RSI_AFFILIATION_BATCH_JOB === 'false') {
                        logger_1.logger.info('RSI affiliation batch refresh disabled');
                    }
                    else {
                        (0, rsiAffiliationBatchJob_1.startRsiAffiliationBatchJob)();
                        logger_1.logger.info('RSI affiliation batch refresh started');
                    }
                }
            }
            Promise.resolve().then(() => __importStar(require('./services/jobs/registerKnownJobs'))).then(({ registerKnownJobs }) => registerKnownJobs())
                .catch(err => logger_1.logger.warn('Failed to register jobs in admin registry:', err));
            const disableBot = process.env.DISABLE_BOT === 'true';
            if (disableBot) {
                logger_1.logger.info('Discord bot disabled (DISABLE_BOT=true — running in separate container)');
                Promise.resolve().then(() => __importStar(require('./bot/BotIPCService'))).then(({ BotIPCService }) => BotIPCService.getInstance().initialize())
                    .then(() => logger_1.logger.info('BotIPCService initialized for Express↔Bot IPC'))
                    .catch(err => logger_1.logger.warn('BotIPCService: Failed to initialize (non-fatal):', err));
            }
            else if (process.env.DISCORD_BOT_TOKEN &&
                (process.env.DISCORD_BOT_CLIENT_ID || process.env.DISCORD_CLIENT_ID)) {
                (0, botApp_1.startBot)().catch(err => logger_1.logger.error('Failed to start Discord bot:', err));
            }
            else {
                logger_1.logger.info('Discord bot disabled (DISCORD_BOT_TOKEN or bot application client ID not set)');
            }
            ChangelogWebhookService_1.ChangelogWebhookService.getInstance().initialize();
        });
    }
    catch (error) {
        logger_1.logger.error('Failed to initialize application:', error);
        if (process.env.NODE_ENV === 'production') {
            logger_1.logger.error('Critical initialization failure in production. Exiting...');
            process.exit(1);
        }
        logger_1.logger.warn('Starting server in degraded mode for development...');
        (0, websocketServer_1.initializeWebSocketServer)(httpServer);
        const websocketTransportReadiness = await (0, websocketServer_1.awaitWebSocketTransportReady)();
        if (websocketTransportReadiness.timedOut) {
            logger_1.logger.warn('WebSocket transport readiness timed out in degraded startup mode', {
                mode: websocketTransportReadiness.mode,
                reason: websocketTransportReadiness.reason,
                waitedMs: websocketTransportReadiness.waitedMs,
            });
        }
        else {
            logger_1.logger.info('WebSocket transport ready in degraded startup mode', {
                mode: websocketTransportReadiness.mode,
                reason: websocketTransportReadiness.reason,
                waitedMs: websocketTransportReadiness.waitedMs,
                latencyMs: websocketTransportReadiness.latencyMs,
            });
        }
        httpServer.listen(PORT, () => {
            logger_1.logger.warn(`Server is running on http://localhost:${PORT} (without database)`);
            logger_1.logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
            logger_1.logger.info(`WebSocket server available at ws://localhost:${PORT}`);
            (0, cleanupJobs_1.startRefreshTokenCleanup)();
            (0, discord_1.startRoleSyncRetryService)();
            ChangelogWebhookService_1.ChangelogWebhookService.getInstance().initialize();
        });
    }
};
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
    if (isShuttingDown) {
        logger_1.logger.warn(`Received ${signal} again during shutdown — forcing exit`);
        process.exit(1);
    }
    isShuttingDown = true;
    logger_1.logger.info(`Received ${signal} — starting graceful shutdown...`);
    const SHUTDOWN_TIMEOUT_MS = 30_000;
    const forceExitTimer = setTimeout(() => {
        logger_1.logger.error('Graceful shutdown timed out — forcing exit');
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();
    try {
        await new Promise((resolve, reject) => {
            httpServer.close(err => {
                if (err) {
                    logger_1.logger.error('Error closing HTTP server:', err);
                    reject(err);
                }
                else {
                    logger_1.logger.info('HTTP server closed — no longer accepting connections');
                    resolve();
                }
            });
        });
        try {
            await (0, websocketServer_1.closeWebSocketServer)();
            logger_1.logger.info('WebSocket server closed');
        }
        catch (wsError) {
            logger_1.logger.warn('WebSocket shutdown error (non-critical):', wsError);
        }
        try {
            const { stopConnectionMonitor } = await Promise.resolve().then(() => __importStar(require('./config/database')));
            stopConnectionMonitor();
            logger_1.logger.info('Database connection monitor stopped');
        }
        catch (monitorError) {
            logger_1.logger.warn('Connection monitor stop error (non-critical):', monitorError);
        }
        if (database_1.AppDataSource.isInitialized) {
            await database_1.AppDataSource.destroy();
            logger_1.logger.info('Database connection pool closed');
        }
        try {
            ChangelogWebhookService_1.ChangelogWebhookService.getInstance().shutdown();
            await redis_1.redisClient.close();
            logger_1.logger.info('Redis connection closed');
        }
        catch (redisError) {
            logger_1.logger.warn('Redis shutdown error (non-critical):', redisError);
        }
        logger_1.logger.info('Graceful shutdown complete');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};
process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
void startServer();
//# sourceMappingURL=app.js.map