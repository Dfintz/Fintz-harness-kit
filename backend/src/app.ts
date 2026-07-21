// Patch Express to automatically catch async errors and forward them to error-handling middleware.
// This MUST be imported before express itself. See: https://github.com/davidbanham/express-async-errors
import 'express-async-errors';

import 'reflect-metadata';

// NOSONAR: node: protocol preferred but 'http' is functionally equivalent here.
// The HTTP server runs behind a TLS-terminating reverse proxy (Azure Container Apps / nginx).
import { createServer } from 'node:http';

import { json } from 'body-parser';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express from 'express';
import swaggerUi from 'swagger-ui-express';

dotenv.config();

import { startBot } from './bot/botApp';
import { initializeApplicationInsights } from './config/applicationInsights';
import { AppDataSource, initializeDatabase } from './config/database';
import { logRateLimitConfig } from './config/rateLimitConfig';
import { swaggerSpec } from './config/swagger';
import { initializeContainer, registerDatabaseDependencies } from './container';
import { FleetTenantController } from './controllers/FleetTenantController';
import { scheduleGdprCleanup } from './jobs/gdprDataCleanup';
import { scheduleIntelAuditLogRotation } from './jobs/intelAuditLogRotation';
import { startJwtBlacklistCleanupJob } from './jobs/jwtBlacklistCleanup';
import { startRsiAffiliationBatchJob } from './jobs/rsiAffiliationBatchJob';
import { startRsiCrawlerJob } from './jobs/rsiCrawlerJob';
import { startRsiSyncSchedulerJob } from './jobs/rsiSyncScheduler';
import { startRsiVerificationAutoDetectJob } from './jobs/rsiVerificationAutoDetectJob';
import { startSandboxUserCleanupJob } from './jobs/sandboxUserCleanupJob';
import { ShipDataFetcher } from './jobs/shipDataFetcher';
import { authenticate } from './middleware/auth';
import { csrfProtection, csrfTokenMiddleware } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestCorrelationMiddleware } from './middleware/requestCorrelation';
import {
  corsConfig,
  helmetConfig,
  rateLimiter,
  removePoweredBy,
  resolveSwaggerEnabled,
  sanitizeInput,
  swaggerCspMiddleware,
  validateEnvironment,
} from './middleware/security';
import {
  trackApiVersion,
  v1DeprecationMiddleware,
  v1ShutdownMiddleware,
} from './middleware/v1Deprecation';
import { registerControllers } from './routing';
import { FeatureFlagService } from './services/admin/FeatureFlagService';
import { startRoleSyncRetryService } from './services/discord';
import { ChangelogWebhookService } from './services/discord/ChangelogWebhookService';
import { initializeDiscordService } from './services/discord/DiscordService';
import { healthMonitor } from './services/health';
import { SecretsManagerService } from './services/infrastructure';
import { errorTrackingService } from './services/monitoring/ErrorTrackingService';
import { getCASActivityLevelBridge } from './services/organization/CASActivityLevelBridge';
import { OrganizationFederationService } from './services/organization/OrganizationFederationService';
// Wave 2 cross-system cleanup: lazy init — must be called after DataSource is ready
import { getMemberCleanupHandler } from './services/shared/MemberCleanupHandler';
import { startRefreshTokenCleanup } from './utils/cleanupJobs';
import { logger } from './utils/logger';
import { redisClient } from './utils/redis';
import { setValidationErrors } from './utils/validationState';
import {
  awaitWebSocketTransportReady,
  closeWebSocketServer,
  initializeWebSocketServer,
} from './websocket/websocketServer';

initializeApplicationInsights();
errorTrackingService.initialize();
initializeContainer();

// deepcode ignore DisablePoweredBy: explicitly disabled below via app.disable('x-powered-by').
// CSRF compensating controls:
// - Token issuance: app.use(csrfTokenMiddleware)
// - Validation: app.use(...) invokes csrfProtection.validate for state-changing requests
// - Browser-scope hardening: cookie-authenticated flow + explicit CSRF_EXEMPT_PATHS
// deepcode ignore UseCsurfForExpress: CSRF is enforced by middleware/csrf.ts and app-level policy.
// NOSONAR: CWE-352 compensated by double-submit CSRF middleware and route policy below.
const app = express(); // NOSONAR
// CWE-200: Explicitly disable X-Powered-By header to prevent information exposure
app.disable('x-powered-by');
// HTTP bootstrap compensating controls:
// - Edge TLS termination (Azure Front Door + ACA Envoy)
// - In-app HSTS + HTTPS redirect with canonical host allowlist in production
// deepcode ignore HttpToHttps: HTTP listener is intentionally private behind trusted TLS edge.
// NOSONAR: CWE-319 compensated by edge TLS + app-level HSTS/redirect enforcement.
const httpServer = createServer(app); // NOSONAR
const PORT = process.env.PORT ?? 3000;

const validationErrors = validateEnvironment();
setValidationErrors(validationErrors);

// Fail-closed in production: refuse to start with environment errors. Zero Trust requires the
// server to never serve traffic with an unverified configuration. In non-production environments
// errors are surfaced via the /health endpoint so developers can debug.
if (validationErrors.length > 0 && process.env.NODE_ENV === 'production') {
  // Allow explicit override only for emergency rollbacks; must be set per-process, not in image.
  if (process.env.ALLOW_INSECURE_STARTUP !== 'true') {
    logger.error(
      `Refusing to start: ${validationErrors.length} environment validation error(s) in production. Set ALLOW_INSECURE_STARTUP=true to override (NOT RECOMMENDED).`
    );
    process.exit(1);
  }
  logger.error(
    'ALLOW_INSECURE_STARTUP=true — starting despite environment validation errors. This is a security risk.'
  );
}

// Log rate limiting configuration
logRateLimitConfig();

const initializeSecretsManager = async (): Promise<void> => {
  try {
    const secretsManager = SecretsManagerService.getInstance();
    await secretsManager.initialize();
    logger.info('Secrets manager initialized successfully');
  } catch (error) {
    logger.warn('Secrets manager initialization failed, using environment variables:', error);
  }
};

app.use((req, res, next) => {
  // Skip helmet CSP for swagger-ui routes - they have their own CSP middleware
  if (req.path.startsWith('/api-docs')) {
    return next();
  }
  helmetConfig(req, res, next);
});
app.use(removePoweredBy);
app.use(corsConfig);
app.use(requestCorrelationMiddleware()); // Add correlation IDs early

// ── Azure Front Door origin restriction ──────────────────────────────────
// When AZURE_FRONT_DOOR_ID is set, reject non-health-check requests that
// don't come through Front Door. Front Door adds the X-Azure-FDID header
// with the profile's unique ID — Azure strips any spoofed versions before
// forwarding, so this is a reliable origin check.
const azureFrontDoorId = process.env.AZURE_FRONT_DOOR_ID;
const BOT_INTERNAL_ALLOWED_PATH_PREFIXES = [
  '/api/recruitments', // Legacy alias
  '/api/v2/recruitment',
  '/api/v2/tickets',
  '/api/v2/invitations',
  '/api/alliance-diplomacy',
  '/api/v2/alliance-diplomacy',
  '/api/v2/rsi/role-mapping',
  '/api/bot/rsi',
];
const isAllowedBotInternalPath = (path: string): boolean =>
  BOT_INTERNAL_ALLOWED_PATH_PREFIXES.some(prefix => path.startsWith(prefix));
if (azureFrontDoorId) {
  app.use((req, res, next) => {
    // Always allow health probes (Container Apps liveness/readiness)
    if (req.path === '/health' || req.path === '/ready') {
      return next();
    }

    // Allow Discord webhook events — Discord sends requests directly, not
    // through Front Door. Authenticity is verified by Ed25519 signature.
    if (req.path === '/api/v2/discord/webhook-events') {
      return next();
    }

    // Allow loopback requests (bot running in same process/container).
    // Use raw socket address — not req.ip which respects trust proxy and
    // could be spoofed via X-Forwarded-For.
    // NOSONAR: ::ffff:127.0.0.1 is the IPv6-mapped IPv4 loopback constant, not a routable host.
    const rawIp = req.socket.remoteAddress || '';
    if (rawIp === '127.0.0.1' || rawIp === '::1' || rawIp === '::ffff:127.0.0.1') {
      // NOSONAR
      return next();
    }

    // Allow bot-to-API internal calls only on routes that explicitly validate
    // BOT_INTERNAL_SECRET through botOrUserAuth.
    if (req.headers['x-bot-internal-token'] && isAllowedBotInternalPath(req.path)) {
      return next();
    }

    const fdid = req.headers['x-azure-fdid'] as string | undefined;
    if (fdid !== azureFrontDoorId) {
      res.status(403).json({ error: 'Direct access not permitted' });
      return;
    }
    next();
  });
}

// CWE-319: Enforce HTTPS in production by redirecting HTTP to HTTPS
// CWE-352: Add HSTS header to enforce HTTPS for future requests
// Trust proxy headers (X-Forwarded-Proto) from reverse proxy/load balancer
if (process.env.NODE_ENV === 'production') {
  // Set trust proxy to the number of reverse proxies between the client and Express.
  // Azure Front Door (1) + Container Apps Envoy sidecar (2) = 2 hops.
  // This tells Express to use the 2nd-from-right entry in X-Forwarded-For,
  // which is the real client IP added by Front Door — preventing spoofing.
  // Configurable via TRUST_PROXY_HOPS for deployments with different proxy topology.
  const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '2', 10);
  app.set(
    'trust proxy',
    Number.isFinite(trustProxyHops) && trustProxyHops > 0 ? trustProxyHops : 2
  );
  // Build allowlist of canonical hostnames for HTTPS redirect target validation.
  // Mitigates open-redirect via spoofed Host header (CWE-601): a malicious Host:
  // attacker.com would otherwise produce a 301 to https://attacker.com/<path>.
  // Hostnames are derived from CORS_ORIGIN + optional explicit PUBLIC_HOSTS env var.
  const allowedRedirectHosts = new Set<string>();
  (process.env.CORS_ORIGIN ?? '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean)
    .forEach(origin => {
      try {
        allowedRedirectHosts.add(new URL(origin).host.toLowerCase());
      } catch {
        // Skip malformed entries
      }
    });
  (process.env.PUBLIC_HOSTS ?? '')
    .split(',')
    .map(h => h.trim().toLowerCase())
    .filter(Boolean)
    .forEach(h => allowedRedirectHosts.add(h));

  app.use((req, res, next) => {
    // Add HSTS header to enforce HTTPS
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // Skip HTTPS redirect for internal/localhost requests (e.g. bot → API calls)
    // Azure Container Apps internal FQDNs use the `.internal.` subdomain pattern;
    // these are container-to-container calls that already go through Envoy TLS.
    const host = (req.get('host') ?? '').toLowerCase();
    const isInternal =
      host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.includes('.internal.');

    // Check if request is not secure (HTTP instead of HTTPS)
    if (!isInternal && !req.secure && req.get('x-forwarded-proto') !== 'https') {
      // CWE-601: Validate Host header against allowlist and use the allowlisted value
      // (not the request value) when constructing the redirect target. This breaks the
      // taint flow from req.get('host') into the redirect Location header.
      const hostnameOnly = host.split(':')[0];
      let canonicalHost: string | null = null;
      if (allowedRedirectHosts.has(host)) {
        canonicalHost = host;
      } else if (allowedRedirectHosts.has(hostnameOnly)) {
        canonicalHost = hostnameOnly;
      }
      if (!canonicalHost) {
        logger.warn('HTTPS redirect blocked: Host header not in allowlist', { host });
        res.status(400).json({ error: 'Invalid Host header' });
        return;
      }
      // canonicalHost is a value from our env-configured allowlist, not user-controlled.
      // req.url is path+query only (no host component) and is path-safe by Express parsing.
      return res.redirect(301, `https://${canonicalHost}${req.url}`); // NOSONAR
    }
    next();
  });
}

app.use(rateLimiter);

app.use(
  compression({
    filter: (req, res): boolean => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6,
  })
);

// ── Discord Webhook Events (must come BEFORE global json() parser) ───────
// Discord webhook events require Ed25519 signature verification against the
// raw request body. The route uses express.raw() internally, so it must be
// mounted before json() parses the body into an object.
import { setDiscordWebhookEventRoutes } from './routes/discordWebhookEventRoutes';
setDiscordWebhookEventRoutes(app);

app.use(json({ limit: '5mb' }));

// SECURITY: COOKIE_SECRET is required in production for secure cookie signing
const cookieSecret = process.env.COOKIE_SECRET;
if (!cookieSecret && process.env.NODE_ENV === 'production') {
  throw new Error(
    'COOKIE_SECRET is required in production! Generate with: openssl rand -base64 32'
  );
}

if (cookieSecret) {
  app.use(cookieParser(cookieSecret));
  logger.info('Cookie parser initialized with secret (cookies will be signed)');
} else {
  logger.warn(
    '⚠️  COOKIE_SECRET not set; cookies will not be signed. This is acceptable for development only!'
  );
  app.use(cookieParser());
}
app.use(csrfTokenMiddleware);

// CWE-352: CSRF-exempt paths (OAuth callbacks, API routes with Bearer tokens, login)
const CSRF_EXEMPT_PATHS = new Set([
  '/api/v2/auth/discord/callback',
  '/api/auth/discord/callback',
  '/api/v2/auth/azuread/callback',
  '/api/auth/login',
  '/api/v2/auth/login', // Admin login - username/password auth uses request signing instead
  '/api/auth/demo', // Development login (v1) - for local development convenience
  '/api/v2/auth/demo', // Development login - for local development convenience
  '/api/auth/logout', // Logout - protected by authentication, CSRF not needed
  '/api/v2/auth/logout', // Logout - protected by authentication, CSRF not needed
  '/api/auth/logout-all', // Logout all - protected by authentication, CSRF not needed
  '/api/v2/auth/logout-all', // Logout all - protected by authentication, CSRF not needed
  '/api/v2/errors/track', // Error tracking should work for unauthenticated users
  '/api/v2/metrics/web-vitals', // Web Vitals telemetry should not require CSRF
  '/api/v2/webauthn/authenticate/options', // Passkey login — public endpoint, no session yet
  '/api/v2/webauthn/authenticate/verify', // Passkey login — public endpoint, issues new session
]);

// CWE-352: Apply CSRF validation to state-changing requests (POST, PUT, PATCH, DELETE)
app.use((req, res, next) => {
  // Skip CSRF validation for:
  // 1. Bearer token requests (API usage)
  // 2. Bot internal token requests on explicitly allowed bot endpoints
  // 3. Health/docs endpoints
  // 4. Dev endpoints (gated by requireDevMode, ALLOW_DEV_LOGIN=true only, not production)
  // 5. Exempt paths (OAuth callbacks, login endpoints)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return next();
  }
  // Bot internal calls are server-to-server, not browser-based — skip CSRF
  // only on routes that validate BOT_INTERNAL_SECRET via botOrUserAuth.
  if (req.headers['x-bot-internal-token'] && isAllowedBotInternalPath(req.path)) {
    return next();
  }
  if (req.path.startsWith('/health') || req.path.startsWith('/api-docs')) {
    return next();
  }
  // Dev routes are dev-only (ALLOW_DEV_LOGIN gating) and not exposed in production
  if (req.path.startsWith('/dev')) {
    return next();
  }
  if (CSRF_EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  csrfProtection.validate(req, res, next);
});

app.use(sanitizeInput);
app.use(trackApiVersion);

// Prevent browser and service-worker caches from serving stale API responses.
// React Query handles client-side caching with proper invalidation; the browser's
// HTTP cache (ETag/304) and SW runtime cache were causing stale data after mutations.
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// Serve favicon without authentication (browsers auto-request this)
app.get('/favicon.ico', (_req, res) => res.status(204).end());
app.use(express.static('public'));

// Swagger API Documentation
// SECURITY: Fail-secure in production. resolveSwaggerEnabled() throws if
// SWAGGER_ENABLED isn't explicitly 'false' in production without the
// SWAGGER_FORCE_PROD=true override.
const swaggerEnabled = resolveSwaggerEnabled();
const swaggerRequireAuth =
  process.env.NODE_ENV === 'production' && process.env.SWAGGER_REQUIRE_AUTH !== 'false';

if (swaggerEnabled) {
  if (swaggerRequireAuth) {
    app.use(
      '/api-docs',
      authenticate,
      swaggerCspMiddleware,
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec)
    );
    logger.info('Swagger UI enabled at /api-docs (authentication required)');
  } else {
    app.use('/api-docs', swaggerCspMiddleware, swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    logger.info('Swagger UI enabled at /api-docs (public access)');
  }
} else {
  logger.info('Swagger UI disabled');
}

const setHealthRoutes = async () => {
  const { setHealthRoutes: registerHealthRoutes } = await import('./routes/healthRoutes.js');
  registerHealthRoutes(app);
};

const registerApiRoutes = async (): Promise<void> => {
  const [
    { v2Router },
    { router: mobileDownloadRouter },
    { router: bountyRoutes },
    { router: matchmakingRoutes },
    { router: performanceRoutes },
    { router: publicDirectoryRoutes },
    { router: publicJobListingRoutes },
    { router: contactRequestRoutes },
    { router: secretsRoutes },
    { router: tunnelRoutes },
    { router: tradingRoutes },
    { router: gdprRoutes },
    { router: discordRoutes },
    { router: orgRelationshipRoutes },
    { router: featureFlagRoutes },
    { router: devRoutes },
    { setAllianceDiplomacyRoutes },
    { setAttendanceRoutes },
    { setAuthRoutes },
    { setBriefingRoutes },
    { setCargoManifestRoutes },
    { setCrewAssignmentRoutes },
    { setFleetLogisticsRoutes },
    { setFleetViewRoutes },
    { setFleetVisibilityRoutes },
    { setImageRoutes },
    { setIntelVaultRoutes },
    { setMemberAuditRoutes },
    { setMiningOperationRoutes: _setMiningOperationRoutes }, // Standalone mining disabled
    { setOrganizationInventoryRoutes },
    { setOrganizationRoutes },
    { setOrganizationShipRoutes },
    { setRecruitmentRoutes },
    { setReputationRoutes },
    { setRsiRoleMappingRoutes },
    { setRsiUserLinkBotRoutes },
    { setRsiVerificationRoutes },
    { setSharedAccountRoutes },
    { setShipDataRoutes },
    { setSquadronRoutes },
    { setTournamentRoutes },
    { setTreatyTemplateRoutes },
    { setTwoFactorRoutes },
    { setUserShipRoutes },
    { setWebAuthnRoutes },
    { setWebhookRoutes },
  ] = await Promise.all([
    import('./routes/v2/index.js'),
    import('./routes/v2/mobile.js'),
    import('./routes/bountyRoutes.js'),
    import('./routes/matchmakingRoutes.js'),
    import('./routes/performanceRoutes.js'),
    import('./routes/publicDirectoryRoutes.js'),
    import('./routes/publicJobListingRoutes.js'),
    import('./routes/contactRequestRoutes.js'),
    import('./routes/secretsRoutes.js'),
    import('./routes/tunnelRoutes.js'),
    import('./routes/trading.js'),
    import('./routes/gdprRoutes.js'),
    import('./routes/discordRoutes.js'),
    import('./routes/orgRelationshipRoutes.js'),
    import('./routes/featureFlagRoutes.js'),
    import('./routes/dev.routes.js'),
    import('./routes/allianceDiplomacyRoutes.js'),
    import('./routes/attendanceRoutes.js'),
    import('./routes/authRoutes.js'),
    import('./routes/briefingRoutes.js'),
    import('./routes/cargoManifestRoutes.js'),
    import('./routes/crewAssignmentRoutes.js'),
    import('./routes/fleetLogisticsRoutes.js'),
    import('./routes/fleetViewRoutes.js'),
    import('./routes/fleetVisibilityRoutes.js'),
    import('./routes/imageRoutes.js'),
    import('./routes/intelVaultRoutes.js'),
    import('./routes/memberAuditRoutes.js'),
    import('./routes/miningOperationRoutes.js'),
    import('./routes/organizationInventoryRoutes.js'),
    import('./routes/organizationRoutes.js'),
    import('./routes/organizationShipRoutes.js'),
    import('./routes/recruitmentRoutes.js'),
    import('./routes/reputationRoutes.js'),
    import('./routes/rsiRoleMappingRoutes.js'),
    import('./routes/rsiUserLinkBotRoutes.js'),
    import('./routes/rsiVerificationRoutes.js'),
    import('./routes/sharedAccountRoutes.js'),
    import('./routes/shipDataRoutes.js'),
    import('./routes/squadronRoutes.js'),
    import('./routes/tournamentRoutes.js'),
    import('./routes/treatyTemplateRoutes.js'),
    import('./routes/twoFactorRoutes.js'),
    import('./routes/userShipRoutes.js'),
    import('./routes/webAuthnRoutes.js'),
    import('./routes/webhookRoutes.js'),
  ]);

  // Mount dev routes FIRST (gated by ALLOW_DEV_LOGIN environment variable)
  // Dev routes mounted at /dev (not under /api/v2) to completely bypass v2Router middleware
  app.use('/dev', devRoutes);

  // Mount V2 routes after dev routes
  app.use('/api/v2', v2Router);

  // Public compatibility alias for Front Door mobile downloads.
  // Keeps /mobile/<file>.apk working even if edge originPath rewrites drift.
  app.use('/mobile', mobileDownloadRouter);

  // Apply V1 deprecation middleware to mapped legacy V1 API routes.
  // Uses RFC 8594-compliant headers with dynamic severity levels.
  // Sunset date: 2026-08-01 (configured in v1Deprecation.ts)
  app.use(v1ShutdownMiddleware); // Returns 410 Gone after sunset date for mapped legacy endpoints.
  app.use(v1DeprecationMiddleware); // Adds deprecation headers and usage logs for mapped legacy endpoints.

  // PUBLIC V1 routes MUST come before routers that use router.use(authenticate)
  // at the `/api` mount point — those block all unmatched /api/* paths with 401.
  app.use('/api', publicDirectoryRoutes);
  app.use('/api', publicJobListingRoutes);
  app.use('/api', contactRequestRoutes);

  // Bot RSI routes must be mounted before broad '/api' routers that apply
  // router-level authenticateToken middleware, otherwise /api/bot/rsi/*
  // requests can be intercepted with "Access token required".
  setRsiUserLinkBotRoutes(app);

  setOrganizationRoutes(app);
  setOrganizationInventoryRoutes(app);
  setImageRoutes(app);
  setTournamentRoutes(app);
  // setMiningOperationRoutes(app); // Standalone mining disabled — mining remains as activity type
  setCrewAssignmentRoutes(app);
  setReputationRoutes(app);
  setCargoManifestRoutes(app);
  setAllianceDiplomacyRoutes(app);
  setFleetLogisticsRoutes(app);
  setTwoFactorRoutes(app);
  setWebAuthnRoutes(app);
  setAuthRoutes(app);
  app.use('/api/v2/bounties', bountyRoutes);
  // Legacy alias for backward compatibility
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

  // Initialize Discord service with SSO support
  // Try to get Discord credentials from Secrets Manager (which loads from Azure Key Vault)
  // Fall back to environment variables if Secrets Manager is not available
  //
  // NOTE: Only bot token and client secret are loaded from Key Vault (they are secrets)
  // Client ID and Redirect URIs are not secrets, just configuration values
  try {
    const secretsManager = SecretsManagerService.getInstance();
    // CWE-547: Avoid empty string fallbacks for secrets - fail fast if missing
    const discordBotToken =
      secretsManager.getSecret('DISCORD_BOT_TOKEN') || process.env.DISCORD_BOT_TOKEN || undefined;
    const discordClientId = process.env.DISCORD_CLIENT_ID || undefined;
    const discordClientSecret =
      secretsManager.getSecret('DISCORD_CLIENT_SECRET') ||
      process.env.DISCORD_CLIENT_SECRET ||
      undefined;
    // Backend uses the backend-specific redirect URI for token exchange
    const discordRedirectUri =
      process.env.DISCORD_REDIRECT_URI_BACKEND || process.env.DISCORD_REDIRECT_URI || undefined;

    if (discordBotToken && discordClientId && discordClientSecret && discordRedirectUri) {
      initializeDiscordService(
        discordBotToken,
        discordClientId,
        discordClientSecret,
        discordRedirectUri
      );
      logger.info('Discord service initialized with SSO support');
    } else {
      logger.warn('Discord SSO credentials not fully configured - Discord service not initialized');
      logger.warn('Required credentials status:', {
        discordBotTokenConfigured: Boolean(discordBotToken),
        discordClientIdConfigured: Boolean(discordClientId),
        discordClientSecretConfigured: Boolean(discordClientSecret),
        discordRedirectUriConfigured: Boolean(discordRedirectUri),
      });
    }
  } catch (error) {
    logger.error('Failed to initialize Discord service:', error);
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
};

const startServer = async () => {
  try {
    await Promise.all([initializeSecretsManager(), initializeDatabase()]);
    registerDatabaseDependencies();

    // Initialize CAS tier -> directory activity-level sync bridge now that DataSource is ready
    getCASActivityLevelBridge();

    // Initialize member cleanup handler now that DataSource is ready
    getMemberCleanupHandler();

    // Initialize default feature flags
    await FeatureFlagService.initializeDefaultFlags();
    logger.info('Feature flags initialized');

    // Seed demo federation data in development
    if (process.env.NODE_ENV !== 'production') {
      await OrganizationFederationService.getInstance().seedDemoFederations();
    }

    await setHealthRoutes();
    await registerApiRoutes();

    registerControllers(app, [FleetTenantController], {
      prefix: '/api',
      debug: process.env.NODE_ENV === 'development',
    });
    logger.info('Decorator-based controllers registered after database initialization');

    initializeWebSocketServer(httpServer);
    const websocketTransportReadiness = await awaitWebSocketTransportReady();
    if (websocketTransportReadiness.timedOut) {
      logger.warn('WebSocket transport readiness timed out before startup declaration', {
        mode: websocketTransportReadiness.mode,
        reason: websocketTransportReadiness.reason,
        waitedMs: websocketTransportReadiness.waitedMs,
      });
    } else {
      logger.info('WebSocket transport ready', {
        mode: websocketTransportReadiness.mode,
        reason: websocketTransportReadiness.reason,
        waitedMs: websocketTransportReadiness.waitedMs,
        latencyMs: websocketTransportReadiness.latencyMs,
      });
    }

    await healthMonitor
      .logHealthSummary()
      .catch(err => logger.warn('Failed to log initial health summary:', err));

    httpServer.listen(PORT, () => {
      logger.info(`Server is running on http://localhost:${PORT}`);
      logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`WebSocket server available at ws://localhost:${PORT}`);
      logger.info('Health endpoints: /health, /health/system, /health/component/:name');

      // JWT blacklist cleanup — must stay in API process (flushes process-local cache)
      startJwtBlacklistCleanupJob();

      // Start role sync retry queue processor
      startRoleSyncRetryService();
      logger.info('Role sync retry queue processor started');

      // Background jobs — skip if worker container handles them (DISABLE_BACKGROUND_JOBS=true)
      if (process.env.DISABLE_BACKGROUND_JOBS === 'true') {
        logger.info(
          'Background jobs disabled (DISABLE_BACKGROUND_JOBS=true — worker container handles them)'
        );
      } else {
        // Refresh token cleanup — runs in worker when available, API fallback here
        startRefreshTokenCleanup();
        startSandboxUserCleanupJob();
        logger.info('Sandbox user cleanup job started (daily, default retention 30 days)');
        if (process.env.NODE_ENV === 'production') {
          scheduleGdprCleanup();
          logger.info('GDPR data cleanup job scheduled for daily 3 AM execution');

          scheduleIntelAuditLogRotation();
          logger.info(
            'Intel audit log rotation job scheduled for daily 4 AM execution (30-day retention)'
          );
        } else {
          logger.info('GDPR data cleanup job disabled in non-production environment');
          logger.info('Intel audit log rotation job disabled in non-production environment');
        }

        if (process.env.DISABLE_EXTERNAL_FETCHES === 'true') {
          logger.info(
            'External data fetches disabled (DISABLE_EXTERNAL_FETCHES=true) — skipping Regolith and ShipDataFetcher'
          );
        } else {
          // Mining operations standalone feature disabled — regolith.rocks data source deprecated
          // RegolithService.startScheduledFetch();
          // logger.info('Regolith mining data fetch job scheduled (every 6 hours)');
          logger.info(
            'Regolith mining data fetch job disabled (standalone mining feature disabled)'
          );

          ShipDataFetcher.schedule();
          logger.info('Ship data fetch job scheduled (daily at 2 AM UTC)');

          // RSI crawler job (opt-in via environment variable)
          if (process.env.ENABLE_RSI_CRAWLER_JOB === 'true') {
            startRsiCrawlerJob();
            logger.info('RSI crawler job scheduled (every 6 hours by default)');
          } else {
            logger.info('RSI crawler job disabled (set ENABLE_RSI_CRAWLER_JOB=true to enable)');
          }

          // RSI sync scheduler (checks every 15 min for orgs due for automatic sync)
          startRsiSyncSchedulerJob();
          logger.info('RSI sync scheduler job started (checks every 15 minutes)');

          // RSI verification auto-detect is owned by the worker process by default.
          // Keep an explicit API fallback for local single-process setups.
          if (process.env.ENABLE_RSI_VERIFICATION_AUTO_DETECT_IN_API === 'true') {
            startRsiVerificationAutoDetectJob();
            logger.info('RSI verification auto-detect job started in API process (fallback mode)');
          } else {
            logger.info(
              'RSI verification auto-detect owned by worker process (set ENABLE_RSI_VERIFICATION_AUTO_DETECT_IN_API=true for API fallback)'
            );
          }

          if (process.env.ENABLE_RSI_AFFILIATION_BATCH_JOB === 'false') {
            logger.info('RSI affiliation batch refresh disabled');
          } else {
            startRsiAffiliationBatchJob();
            logger.info('RSI affiliation batch refresh started');
          }
        }
      } // end DISABLE_BACKGROUND_JOBS guard

      // Register known jobs in admin registry for operations dashboard
      import('./services/jobs/registerKnownJobs.js')
        .then(({ registerKnownJobs }) => registerKnownJobs())
        .catch(err => logger.warn('Failed to register jobs in admin registry:', err));

      // Start Discord bot (connects to gateway, registers slash commands)
      // Skip when DISABLE_BOT=true (bot runs in separate container — see P5)
      const disableBot = process.env.DISABLE_BOT === 'true';
      if (disableBot) {
        logger.info('Discord bot disabled (DISABLE_BOT=true — running in separate container)');

        // Initialize IPC so the Express process can communicate with the bot container
        import('./bot/BotIPCService.js')
          .then(({ BotIPCService }) => BotIPCService.getInstance().initialize())
          .then(() => logger.info('BotIPCService initialized for Express↔Bot IPC'))
          .catch(err => logger.warn('BotIPCService: Failed to initialize (non-fatal):', err));
      } else if (
        process.env.DISCORD_BOT_TOKEN &&
        (process.env.DISCORD_BOT_CLIENT_ID || process.env.DISCORD_CLIENT_ID)
      ) {
        startBot().catch(err => logger.error('Failed to start Discord bot:', err));
      } else {
        logger.info(
          'Discord bot disabled (DISCORD_BOT_TOKEN or bot application client ID not set)'
        );
      }

      // Changelog webhook polling does not require a Discord gateway connection.
      // Initialize from API runtime so webhook posting still works when bot startup is disabled.
      ChangelogWebhookService.getInstance().initialize();
    });
  } catch (error) {
    logger.error('Failed to initialize application:', error);

    if (process.env.NODE_ENV === 'production') {
      logger.error('Critical initialization failure in production. Exiting...');
      process.exit(1);
    }

    logger.warn('Starting server in degraded mode for development...');
    initializeWebSocketServer(httpServer);
    const websocketTransportReadiness = await awaitWebSocketTransportReady();
    if (websocketTransportReadiness.timedOut) {
      logger.warn('WebSocket transport readiness timed out in degraded startup mode', {
        mode: websocketTransportReadiness.mode,
        reason: websocketTransportReadiness.reason,
        waitedMs: websocketTransportReadiness.waitedMs,
      });
    } else {
      logger.info('WebSocket transport ready in degraded startup mode', {
        mode: websocketTransportReadiness.mode,
        reason: websocketTransportReadiness.reason,
        waitedMs: websocketTransportReadiness.waitedMs,
        latencyMs: websocketTransportReadiness.latencyMs,
      });
    }

    httpServer.listen(PORT, () => {
      logger.warn(`Server is running on http://localhost:${PORT} (without database)`);
      logger.info(`API documentation available at http://localhost:${PORT}/api-docs`);
      logger.info(`WebSocket server available at ws://localhost:${PORT}`);
      startRefreshTokenCleanup();

      // Start role sync retry queue processor even in degraded mode
      startRoleSyncRetryService();

      // Keep changelog webhook polling available in degraded startup mode as well.
      ChangelogWebhookService.getInstance().initialize();
    });
  }
};

// ==================== Graceful Shutdown ====================
let isShuttingDown = false;

const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn(`Received ${signal} again during shutdown — forcing exit`);
    process.exit(1);
  }
  isShuttingDown = true;
  logger.info(`Received ${signal} — starting graceful shutdown...`);

  // Give in-flight requests a deadline to complete
  const SHUTDOWN_TIMEOUT_MS = 30_000;
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExitTimer.unref();

  try {
    // 1. Stop accepting new HTTP connections and drain existing ones
    await new Promise<void>((resolve, reject) => {
      httpServer.close(err => {
        if (err) {
          logger.error('Error closing HTTP server:', err);
          reject(err);
        } else {
          logger.info('HTTP server closed — no longer accepting connections');
          resolve();
        }
      });
    });

    // 2. Close WebSocket connections gracefully
    try {
      await closeWebSocketServer();
      logger.info('WebSocket server closed');
    } catch (wsError) {
      logger.warn('WebSocket shutdown error (non-critical):', wsError);
    }

    // 3. Stop database connection monitor before closing pool
    try {
      const { stopConnectionMonitor } = await import('./config/database.js');
      stopConnectionMonitor();
      logger.info('Database connection monitor stopped');
    } catch (monitorError) {
      logger.warn('Connection monitor stop error (non-critical):', monitorError);
    }

    // 4. Close database connection pool
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
      logger.info('Database connection pool closed');
    }

    // 5. Close Redis connection
    try {
      ChangelogWebhookService.getInstance().shutdown();
      await redisClient.close();
      logger.info('Redis connection closed');
    } catch (redisError) {
      logger.warn('Redis shutdown error (non-critical):', redisError);
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

void startServer();
