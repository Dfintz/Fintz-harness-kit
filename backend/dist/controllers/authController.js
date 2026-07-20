"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const cookies_1 = require("../config/cookies");
const database_1 = require("../config/database");
const urls_1 = require("../config/urls");
const sessionBinding_1 = require("../middleware/sessionBinding");
const Organization_1 = require("../models/Organization");
const OrganizationMembership_1 = require("../models/OrganizationMembership");
const User_1 = require("../models/User");
const authentication_1 = require("../services/authentication");
const DiscordService_1 = require("../services/discord/DiscordService");
const GoogleOAuthService_1 = require("../services/google/GoogleOAuthService");
const OrgDefaultsService_1 = require("../services/organization/OrgDefaultsService");
const security_1 = require("../services/security");
const AccountAccessLogService_1 = require("../services/security/access/AccountAccessLogService");
const RoleService_1 = require("../services/security/core/RoleService");
const TwitchOAuthService_1 = require("../services/twitch/TwitchOAuthService");
const user_1 = require("../services/user");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const oauthState_1 = require("../utils/oauthState");
const BaseController_1 = require("./BaseController");
const OAUTH_PROVIDER_ORIGINS = new Set([
    'https://discord.com',
    'https://accounts.google.com',
    'https://id.twitch.tv',
]);
function safeOAuthRedirect(res, authUrl, errorCode) {
    try {
        const parsed = new URL(authUrl);
        if (OAUTH_PROVIDER_ORIGINS.has(parsed.origin)) {
            res.redirect(parsed.toString());
            return;
        }
        logger_1.logger.error('Refused OAuth redirect to non-allowlisted origin', { origin: parsed.origin });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger_1.logger.error('Refused OAuth redirect to malformed URL', { error: message });
    }
    res.redirect(`${(0, urls_1.getFrontendUrl)()}/login?error=${encodeURIComponent(errorCode)}`);
}
class AuthController extends BaseController_1.BaseController {
    authService;
    userService;
    userAuthService;
    userProfileService;
    securityService;
    accessLogService;
    constructor() {
        super();
        this.authService = new authentication_1.AuthenticationService();
        this.userService = new user_1.UserService();
        this.userAuthService = new user_1.UserAuthenticationService();
        this.userProfileService = new user_1.UserProfileService();
        this.securityService = security_1.AccountSecurityService.getInstance();
        this.accessLogService = new AccountAccessLogService_1.AccountAccessLogService();
    }
    login = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            this.validateRequired(req.body, 'username', 'password');
            const { username, password } = req.body;
            const user = await this.userService.validateCredentials(username, password);
            if (!user) {
                logger_1.logger.warn(`Failed login attempt for username: ${username}`);
                const existingUser = await this.userService.getUserByUsername(username);
                if (existingUser) {
                    const lockoutResult = await this.securityService.recordFailedAttempt(existingUser.id);
                    if (lockoutResult.isLocked && lockoutResult.lockedUntil) {
                        const lockoutMinutes = Math.ceil((lockoutResult.lockedUntil.getTime() - Date.now()) / 60000);
                        throw new apiErrors_1.ForbiddenError(`Account locked due to too many failed attempts. Try again in ${lockoutMinutes} minutes.`);
                    }
                    if (lockoutResult.attemptsRemaining <= 2) {
                        throw new apiErrors_1.UnauthorizedError(`Invalid credentials. ${lockoutResult.attemptsRemaining} attempts remaining before lockout.`, { attemptsRemaining: lockoutResult.attemptsRemaining });
                    }
                }
                throw new apiErrors_1.UnauthorizedError('Invalid credentials');
            }
            if (this.securityService.isAccountLocked(user)) {
                const status = await this.securityService.getLockoutStatus(user.id);
                const lockoutMinutes = status.lockoutExpiresIn
                    ? Math.ceil(status.lockoutExpiresIn / 60000)
                    : 0;
                logger_1.logger.warn(`Login attempt on locked account: ${user.id}`);
                throw new apiErrors_1.ForbiddenError(`Account is locked due to too many failed attempts. Try again in ${lockoutMinutes} minutes.`);
            }
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const tokens = await this.authService.generateTokens(user, {
                ipAddress,
                userAgent,
                sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
            });
            await this.securityService.resetFailedAttempts(user.id);
            logger_1.logger.info(`User ${user.id} logged in successfully`);
            void this.accessLogService.logAccess(user.id, user.id, user.activeOrgId ?? undefined, 'login:password', ipAddress, userAgent);
            res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
            res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
            return {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
                message: 'Login successful. Tokens also set in httpOnly cookies for enhanced security.',
            };
        });
    };
    static DEV_PERSONA_ORGS = {
        star_cadet: [
            {
                orgId: '00000000-0000-4000-a000-000000000001',
                orgName: 'Stardust Expeditionary Fleet',
                role: 'Member',
                isPrimary: true,
            },
            {
                orgId: '00000000-0000-4000-a000-000000000002',
                orgName: 'Deep Core Mining Consortium',
                role: 'Member',
            },
        ],
        admiral_chen: [
            {
                orgId: '00000000-0000-4000-a000-000000000001',
                orgName: 'Stardust Expeditionary Fleet',
                role: 'Owner',
                isPrimary: true,
            },
        ],
        sysop_nexus: [
            {
                orgId: '00000000-0000-4000-a000-000000000003',
                orgName: 'Ironwolf Mercenary Company',
                role: 'Admin',
                isPrimary: true,
            },
        ],
        'dev-user': [
            {
                orgId: '00000000-0000-4000-a000-000000000001',
                orgName: 'Stardust Expeditionary Fleet',
                role: 'Owner',
                isPrimary: true,
            },
        ],
    };
    async ensureDevOrg(orgRepo, config, userId) {
        let org = await orgRepo.findOne({ where: { id: config.orgId } });
        if (org) {
            return;
        }
        org = orgRepo.create({
            id: config.orgId,
            name: config.orgName,
            description: `Demo organization for development - ${config.orgName}`,
            members: [],
            totalMembers: 0,
            directMembers: 0,
            childCount: 0,
            level: 0,
            path: config.orgId,
            ownerId: config.role === 'owner' || config.role === 'founder' ? userId : undefined,
        });
        await orgRepo.save(org);
        logger_1.logger.info(`Dev persona: created demo org "${config.orgName}" (${config.orgId})`);
        try {
            await (0, OrgDefaultsService_1.getOrgDefaultsService)().seedDefaults(config.orgId);
        }
        catch (seedError) {
            logger_1.logger.warn('Dev persona: failed to seed org defaults (non-fatal)', {
                orgId: config.orgId,
                error: seedError instanceof Error ? seedError.message : String(seedError),
            });
        }
    }
    async ensureDevMembership(membershipRepo, orgRepo, config, userId, username) {
        const existing = await membershipRepo.findOne({
            where: { userId, organizationId: config.orgId },
        });
        if (existing) {
            return;
        }
        const roleId = await (0, RoleService_1.getRoleService)().getRoleIdByName(config.role, config.orgId);
        if (!roleId) {
            logger_1.logger.warn(`Dev persona: role '${config.role}' not found for org ${config.orgId}`);
            return;
        }
        const membership = membershipRepo.create({
            userId,
            organizationId: config.orgId,
            roleId,
            isActive: true,
            joinedAt: new Date(),
        });
        await membershipRepo.save(membership);
        await orgRepo.increment({ id: config.orgId }, 'totalMembers', 1);
        await orgRepo.increment({ id: config.orgId }, 'directMembers', 1);
        logger_1.logger.info(`Dev persona: added membership for "${username}" in "${config.orgName}" as ${config.role}`);
    }
    async seedDevPersonaOrgs(userId, username) {
        const personaOrgs = AuthController.DEV_PERSONA_ORGS[username];
        if (!personaOrgs || personaOrgs.length === 0) {
            return;
        }
        const orgRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
        const membershipRepo = database_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        const userRepo = database_1.AppDataSource.getRepository(User_1.User);
        let primaryOrgId;
        for (const config of personaOrgs) {
            await this.ensureDevOrg(orgRepo, config, userId);
            await this.ensureDevMembership(membershipRepo, orgRepo, config, userId, username);
            if (config.isPrimary) {
                primaryOrgId = config.orgId;
            }
        }
        if (primaryOrgId) {
            const currentUser = await userRepo.findOne({ where: { id: userId } });
            if (currentUser && !currentUser.activeOrgId) {
                await userRepo.update(userId, { activeOrgId: primaryOrgId });
                logger_1.logger.info(`Dev persona: set activeOrgId for "${username}" to ${primaryOrgId}`);
            }
        }
    }
    devLogin = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            if (process.env.NODE_ENV === 'production') {
                throw new apiErrors_1.ForbiddenError('Development login is disabled in production environments');
            }
            if (process.env.ALLOW_DEV_LOGIN !== 'true') {
                throw new apiErrors_1.ForbiddenError('Development login is disabled. Set ALLOW_DEV_LOGIN=true to enable.');
            }
            const rawUsername = typeof req.body?.username === 'string' ? req.body.username.trim() : 'dev-user';
            const username = rawUsername ?? 'dev-user';
            const emailInput = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
            const email = emailInput ?? `${username}@dev.local`;
            const roleInput = typeof req.body?.role === 'string' ? req.body.role.trim() : undefined;
            const role = roleInput ?? process.env.DEV_LOGIN_ROLE ?? 'admin';
            const metadata = {
                ipAddress: req.ip ?? req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
                sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
            };
            let user = (await this.userService.getUserByUsername(username)) ??
                (await this.userService.getUserByEmail(email));
            const uuidPattern = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
            if (user && !uuidPattern.test(user.id)) {
                logger_1.logger.info(`Dev persona: replacing non-UUID user "${user.id}" with UUID`);
                const oldId = user.id;
                try {
                    await database_1.AppDataSource.query(`DELETE FROM organization_memberships WHERE "userId" = $1`, [
                        oldId,
                    ]);
                    await database_1.AppDataSource.query(`DELETE FROM users WHERE id = $1`, [oldId]);
                    logger_1.logger.info(`Dev persona: deleted old non-UUID user "${oldId}"`);
                }
                catch (delErr) {
                    logger_1.logger.warn('Dev persona: could not delete non-UUID user (non-fatal)', {
                        userId: oldId,
                        error: delErr instanceof Error ? delErr.message : String(delErr),
                    });
                }
                user = null;
            }
            if (user) {
                user = await this.userService.updateUser(user.id, {
                    email,
                    role,
                    lastLoginAt: new Date(),
                    lastLoginIp: metadata.ipAddress,
                    loginCount: (user.loginCount ?? 0) + 1,
                    discordId: user.discordId ?? `dev-${username}`,
                });
            }
            else {
                const devDiscordPrefix = process.env.DEV_DISCORD_ID_PREFIX ?? 'dev';
                user = await this.userService.createUser({
                    id: node_crypto_1.default.randomUUID(),
                    username,
                    email,
                    discordId: `${devDiscordPrefix}-${username}`,
                    role,
                    displayName: 'Developer',
                    lastLoginAt: new Date(),
                    lastLoginIp: metadata.ipAddress,
                });
            }
            await this.securityService.resetFailedAttempts(user.id);
            await this.seedDevPersonaOrgs(user.id, username);
            const tokens = await this.authService.generateTokens(user, metadata);
            res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
            res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
            logger_1.logger.info('Development login issued', { userId: user.id, role: user.role });
            return {
                token: tokens.accessToken,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
                message: 'Development login successful. Tokens set in httpOnly cookies for this session.',
            };
        });
    };
    refresh = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const refreshToken = req.cookies?.[cookies_1.COOKIE_NAMES.REFRESH_TOKEN] ?? req.body.refreshToken;
            if (!refreshToken) {
                this.validateRequired(req.body, 'refreshToken');
            }
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            try {
                const tokens = await this.authService.refreshTokens(refreshToken, {
                    ipAddress,
                    userAgent,
                    sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
                });
                logger_1.logger.info(`Tokens refreshed successfully`);
                res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
                res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
                return {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                };
            }
            catch (error) {
                logger_1.logger.warn('Token refresh failed', { error: error.message });
                const err = new Error('Invalid or expired refresh token');
                err.name = 'ForbiddenError';
                throw err;
            }
        });
    };
    logout = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const refreshToken = req.cookies?.[cookies_1.COOKIE_NAMES.REFRESH_TOKEN] ?? req.body.refreshToken;
            if (refreshToken) {
                await this.authService.revokeRefreshToken(refreshToken).catch(() => {
                    logger_1.logger.debug('Refresh token revocation skipped (already revoked or expired)');
                });
            }
            res.clearCookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, cookies_1.clearCookieOptions);
            res.clearCookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, cookies_1.clearRefreshCookieOptions);
            res.clearCookie(cookies_1.COOKIE_NAMES.CSRF_TOKEN, cookies_1.clearCsrfCookieOptions);
            logger_1.logger.info(`User ${req.user?.id ?? 'unknown'} logged out`);
            return { message: 'Logged out successfully' };
        });
    };
    logoutAll = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const count = await this.authService.revokeAllUserTokens(user.id);
            res.clearCookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, cookies_1.clearCookieOptions);
            res.clearCookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, cookies_1.clearRefreshCookieOptions);
            res.clearCookie(cookies_1.COOKIE_NAMES.CSRF_TOKEN, cookies_1.clearCsrfCookieOptions);
            logger_1.logger.info(`All tokens revoked for user ${user.id} (${count} tokens)`);
            return {
                message: 'Logged out from all devices successfully',
                tokensRevoked: count,
            };
        });
    };
    getActiveSessions = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const user = this.getAuthUser(req);
            const tokens = await this.authService.getUserRefreshTokens(user.id);
            return {
                sessions: tokens.map(token => ({
                    id: token.id,
                    createdAt: token.createdAt,
                    expiresAt: token.expiresAt,
                    ipAddress: token.ipAddress,
                    userAgent: token.userAgent,
                })),
            };
        });
    };
    discordInitiate = async (req, res) => {
        try {
            if (!(0, DiscordService_1.isDiscordServiceInitialized)()) {
                logger_1.logger.warn('Discord OAuth initiation attempted but service not initialized');
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                return res.redirect(`${frontendUrl}/login?error=discord_not_configured`);
            }
            const nonce = node_crypto_1.default.randomBytes(16).toString('hex');
            const timestamp = Date.now().toString(36);
            const payload = `${nonce}.${timestamp}`;
            const secret = (0, oauthState_1.getOAuthSecret)();
            const signature = node_crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
            const state = `${payload}.${signature}`;
            const discordService = (0, DiscordService_1.getDiscordService)();
            const authUrl = discordService.generateAuthUrl(state);
            logger_1.logger.debug('Redirecting to Discord OAuth', { state });
            safeOAuthRedirect(res, authUrl, 'discord_error');
        }
        catch (error) {
            logger_1.logger.error('Discord OAuth initiation error:', error);
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            res.redirect(`${frontendUrl}/login?error=discord_error`);
        }
    };
    handleOAuthError(req, res, errorCode, ErrorClass, message) {
        if (req.method === 'GET') {
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorCode)}`);
            return;
        }
        throw new ErrorClass(message);
    }
    validateDiscordOAuthPreconditions(req, res) {
        if (!(0, DiscordService_1.isDiscordServiceInitialized)()) {
            logger_1.logger.warn('Discord OAuth callback attempted but service not initialized');
            this.handleOAuthError(req, res, 'discord_not_configured', apiErrors_1.UnauthorizedError, 'Discord authentication is not available. Please contact the administrator or use an alternative login method.');
            return undefined;
        }
        const oauthError = req.query.error;
        if (oauthError) {
            logger_1.logger.warn('Discord OAuth error received', { error: oauthError });
            this.handleOAuthError(req, res, String(oauthError), apiErrors_1.UnauthorizedError, `Discord authentication failed: ${oauthError}`);
            return undefined;
        }
        const backendRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND;
        if (!backendRedirectUri) {
            logger_1.logger.error('Discord OAuth callback failed: DISCORD_REDIRECT_URI_BACKEND not configured');
            this.handleOAuthError(req, res, 'server_config', apiErrors_1.ValidationError, 'DISCORD_REDIRECT_URI_BACKEND is not configured');
            return undefined;
        }
        const code = this.extractAuthorizationCode(req);
        if (!code) {
            this.handleOAuthError(req, res, 'no_code', apiErrors_1.ValidationError, 'Authorization code is required');
            return undefined;
        }
        if (req.method === 'GET' && !this.validateGetRequestState(req, res)) {
            return undefined;
        }
        return code;
    }
    extractAuthorizationCode(req) {
        const queryCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
        return (queryCode ?? req.body.code) ?? undefined;
    }
    validateGetRequestState(req, res) {
        const queryState = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
        const state = String(queryState ?? req.body.state ?? '');
        if (!(0, oauthState_1.validateOAuthState)(state).valid) {
            logger_1.logger.warn('Discord OAuth state invalid or expired');
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            res.redirect(`${frontendUrl}/login?error=invalid_state`);
            return false;
        }
        return true;
    }
    discordCallback = async (req, res) => {
        try {
            const code = this.validateDiscordOAuthPreconditions(req, res);
            if (!code) {
                return;
            }
            const backendRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND;
            logger_1.logger.debug('Discord OAuth callback starting', {
                hasCode: true,
                redirectUri: backendRedirectUri,
                method: req.method,
            });
            const discordService = (0, DiscordService_1.getDiscordService)();
            const discordTokens = await discordService.authenticateUser(code, backendRedirectUri);
            const discordUser = await discordService.getUserInfo(discordTokens.access_token);
            let user = await this.userService.getUserByDiscordId(discordUser.id);
            if (user) {
                await this.userService.updateUser(user.id, {
                    lastLoginAt: new Date(),
                    lastLoginIp: req.ip ?? req.socket.remoteAddress,
                });
                logger_1.logger.info(`User logged in via Discord OAuth: ${user.id}`);
            }
            else {
                user = await this.userService.createUser({
                    id: node_crypto_1.default.randomUUID(),
                    discordId: discordUser.id,
                    username: discordUser.username,
                    email: discordUser.email ?? `${discordUser.id}@noemail.discord.local`,
                    displayName: discordUser.username,
                    avatar: discordUser.avatar
                        ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`
                        : undefined,
                    role: 'user',
                    lastLoginAt: new Date(),
                });
                logger_1.logger.info(`New user created via Discord OAuth: ${user.id}`);
            }
            const tokens = await this.authService.generateTokens(user, {
                ipAddress: req.ip ?? req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
                sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
            });
            res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
            res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
            if (req.method === 'GET') {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                logger_1.logger.info(`Discord OAuth successful, redirecting to ${frontendUrl}/login?success=true`);
                res.redirect(`${frontendUrl}/login?success=true`);
                return;
            }
            res.status(200).json({
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: {
                    id: user.id,
                    username: user.username,
                    displayName: user.displayName,
                    avatar: user.avatar,
                    role: user.role,
                },
                message: 'Discord authentication successful',
            });
        }
        catch (error) {
            logger_1.logger.error('Discord OAuth callback error:', error);
            if (req.method === 'GET') {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                res.redirect(`${frontendUrl}/login?error=auth_failed`);
                return;
            }
            await this.executeAndReturn(req, res, async () => {
                if (error instanceof Error &&
                    (error.constructor.name === 'ValidationError' ||
                        error.constructor.name === 'UnauthorizedError' ||
                        error.constructor.name === 'ForbiddenError' ||
                        error.constructor.name === 'NotFoundError')) {
                    throw error;
                }
                throw new apiErrors_1.UnauthorizedError('Discord authentication failed');
            });
        }
    };
    validateRedirectUri(redirectUri) {
        const allowedOrigin = (0, urls_1.getFrontendUrl)();
        try {
            const parsed = new URL(redirectUri);
            const allowed = new URL(allowedOrigin);
            if (parsed.origin !== allowed.origin) {
                throw new apiErrors_1.ValidationError('Redirect URI origin is not allowed');
            }
            if (parsed.pathname !== '/admin/login') {
                throw new apiErrors_1.ValidationError('Redirect URI path is not allowed');
            }
        }
        catch (error) {
            if (error instanceof apiErrors_1.ValidationError) {
                throw error;
            }
            throw new apiErrors_1.ValidationError('Invalid redirect URI format');
        }
    }
    azureADCallback = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            this.validateRequired(req.body, 'code', 'redirectUri');
            const { code, redirectUri } = req.body;
            this.validateRedirectUri(redirectUri);
            try {
                const tenantId = process.env.AZURE_AD_TENANT_ID ?? 'common';
                const clientId = process.env.AZURE_AD_CLIENT_ID;
                const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
                if (!clientId || !clientSecret) {
                    throw new apiErrors_1.ValidationError('Azure AD not configured - missing client ID or secret');
                }
                const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
                const tokenParams = new URLSearchParams({
                    client_id: clientId,
                    client_secret: clientSecret,
                    code,
                    redirect_uri: redirectUri,
                    grant_type: 'authorization_code',
                    scope: 'openid profile email User.Read',
                });
                const tokenResponse = await fetch(tokenEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: tokenParams.toString(),
                });
                if (!tokenResponse.ok) {
                    let errorMessage = 'Failed to exchange code for token';
                    try {
                        const errorData = (await tokenResponse.json());
                        logger_1.logger.error('Azure AD token exchange failed:', errorData);
                        errorMessage = errorData.error_description ?? errorData.error ?? errorMessage;
                    }
                    catch (_parseError) {
                        logger_1.logger.error('Azure AD token exchange failed with non-JSON response', {
                            parseError: _parseError instanceof Error ? _parseError.message : String(_parseError),
                        });
                    }
                    throw new apiErrors_1.ValidationError(errorMessage);
                }
                const tokenData = (await tokenResponse.json());
                const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                    headers: {
                        Authorization: `Bearer ${tokenData.access_token}`,
                    },
                });
                if (!userInfoResponse.ok) {
                    throw new apiErrors_1.ValidationError('Failed to fetch user info from Microsoft Graph');
                }
                const azureUser = (await userInfoResponse.json());
                const email = azureUser.mail ?? azureUser.userPrincipalName;
                if (!email) {
                    throw new apiErrors_1.ValidationError('Azure AD user has no email address');
                }
                let user = await this.userService.getUserByEmail(email);
                if (user) {
                    await this.userService.updateUser(user.id, {
                        lastLoginAt: new Date(),
                        lastLoginIp: req.ip ?? req.socket.remoteAddress,
                        role: 'admin',
                    });
                    logger_1.logger.info(`Admin user logged in via Azure AD OAuth: ${user.id}`);
                }
                else {
                    const username = azureUser.userPrincipalName?.split('@')[0] ??
                        azureUser.displayName?.replaceAll(/\s+/g, '').toLowerCase() ??
                        `admin_${node_crypto_1.default.randomUUID().substring(0, 8)}`;
                    user = await this.userService.createUser({
                        id: node_crypto_1.default.randomUUID(),
                        discordId: `azuread:${azureUser.id}`,
                        username,
                        email,
                        displayName: azureUser.displayName,
                        role: 'admin',
                        lastLoginAt: new Date(),
                    });
                    logger_1.logger.info(`New admin user created via Azure AD OAuth: ${user.id}`);
                }
                const ipAddress = req.ip ?? req.socket.remoteAddress;
                const userAgent = req.headers['user-agent'];
                const tokens = await this.authService.generateTokens(user, {
                    ipAddress,
                    userAgent,
                    sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
                });
                res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
                res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
                return {
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    user: {
                        id: user.id,
                        username: user.username,
                        displayName: user.displayName,
                        email: user.email,
                        role: user.role,
                    },
                    message: 'Azure AD authentication successful',
                };
            }
            catch (error) {
                logger_1.logger.error('Azure AD OAuth callback error:', error);
                throw new apiErrors_1.UnauthorizedError('Azure AD authentication failed');
            }
        });
    };
    validateOAuthCallbackPreconditions(req, res, isConfigured, providerName) {
        if (!isConfigured) {
            this.handleOAuthError(req, res, `${providerName}_not_configured`, apiErrors_1.UnauthorizedError, `${providerName} authentication is not available.`);
            return undefined;
        }
        const oauthError = req.query.error;
        if (oauthError) {
            this.handleOAuthError(req, res, String(oauthError), apiErrors_1.UnauthorizedError, `${providerName} authentication failed: ${oauthError}`);
            return undefined;
        }
        const queryCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
        const code = (queryCode ?? req.body.code);
        if (!code) {
            this.handleOAuthError(req, res, 'no_code', apiErrors_1.ValidationError, 'Authorization code is required');
            return undefined;
        }
        const queryState = Array.isArray(req.query.state) ? req.query.state[0] : req.query.state;
        const state = String(queryState ?? req.body.state ?? '');
        const stateResult = (0, oauthState_1.validateOAuthState)(state);
        if (!stateResult.valid) {
            if (req.method === 'GET') {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                res.redirect(`${frontendUrl}/login?error=invalid_state`);
            }
            else {
                res.status(403).json({ error: 'Invalid or expired OAuth state' });
            }
            return undefined;
        }
        return { code, linkUserId: stateResult.linkUserId };
    }
    async resolveExistingSessionUser(req, linkUserId) {
        if (linkUserId) {
            const user = await this.userService.getUserById(linkUserId);
            if (user) {
                logger_1.logger.debug('Resolved linking user from OAuth state', { linkUserId });
                return user;
            }
        }
        try {
            const accessToken = req.cookies?.[cookies_1.COOKIE_NAMES.ACCESS_TOKEN] ??
                req.headers.authorization?.replace('Bearer ', '');
            if (accessToken) {
                const decoded = await this.authService.validateAccessToken(accessToken);
                if (decoded?.id) {
                    return await this.userService.getUserById(decoded.id);
                }
            }
        }
        catch {
        }
        return null;
    }
    async resolveOrCreateOAuthUser(req, res, opts) {
        const existingSessionUser = await this.resolveExistingSessionUser(req, opts.linkUserId);
        if (existingSessionUser) {
            const existingByProvider = await opts.lookupByProviderId();
            if (existingByProvider && existingByProvider.id !== existingSessionUser.id) {
                logger_1.logger.warn(`${opts.providerName} account already linked to another user`, {
                    providerId: opts.providerId,
                    targetUser: existingSessionUser.id,
                });
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                res.redirect(`${frontendUrl}/settings?error=account_already_linked`);
                return null;
            }
            await this.userService.updateUser(existingSessionUser.id, {
                [opts.providerIdField]: opts.providerId,
                lastLoginAt: new Date(),
                lastLoginIp: req.ip ?? req.socket.remoteAddress,
            });
            logger_1.logger.info(`Linked ${opts.providerName} account to authenticated user: ${existingSessionUser.id}`);
            return existingSessionUser;
        }
        const existingByEmail = opts.email ? await this.userService.getUserByEmail(opts.email) : null;
        if (existingByEmail) {
            await this.userService.updateUser(existingByEmail.id, {
                [opts.providerIdField]: opts.providerId,
                lastLoginAt: new Date(),
                lastLoginIp: req.ip ?? req.socket.remoteAddress,
            });
            logger_1.logger.info(`Linked ${opts.providerName} account to existing user by email: ${existingByEmail.id}`);
            return existingByEmail;
        }
        const user = await this.userService.createUser({
            id: node_crypto_1.default.randomUUID(),
            discordId: `${opts.providerName.toLowerCase()}:${opts.providerId}`,
            [opts.providerIdField]: opts.providerId,
            username: opts.username,
            email: opts.email ?? `${opts.providerId}@noemail.${opts.providerName.toLowerCase()}.local`,
            displayName: opts.displayName,
            avatar: opts.avatar,
            role: 'user',
            lastLoginAt: new Date(),
        });
        logger_1.logger.info(`New user created via ${opts.providerName} OAuth: ${user.id}`);
        return user;
    }
    async completeOAuthLogin(req, res, user, providerName) {
        const tokens = await this.authService.generateTokens(user, {
            ipAddress: req.ip ?? req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
        });
        res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
        res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
        void this.accessLogService.logAccess(user.id, user.id, user.activeOrgId ?? undefined, `login:${providerName.toLowerCase()}`, req.ip ?? req.socket.remoteAddress, req.headers['user-agent']);
        if (req.method === 'GET') {
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            logger_1.logger.info(`${providerName} OAuth successful, redirecting to ${frontendUrl}/login?success=true`);
            res.redirect(`${frontendUrl}/login?success=true`);
            return;
        }
        res.status(200).json({
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatar: user.avatar,
                role: user.role,
            },
            message: `${providerName} authentication successful`,
        });
    }
    googleInitiate = async (req, res) => {
        try {
            if (!(0, GoogleOAuthService_1.isGoogleOAuthConfigured)()) {
                logger_1.logger.warn('Google OAuth initiation attempted but not configured');
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
            }
            const state = (0, oauthState_1.generateOAuthState)();
            const googleService = (0, GoogleOAuthService_1.getGoogleOAuthService)();
            const authUrl = googleService.generateAuthUrl(state);
            logger_1.logger.debug('Redirecting to Google OAuth');
            safeOAuthRedirect(res, authUrl, 'google_error');
        }
        catch (error) {
            logger_1.logger.error('Google OAuth initiation error:', error);
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            res.redirect(`${frontendUrl}/login?error=google_error`);
        }
    };
    googleCallback = async (req, res) => {
        try {
            const result = this.validateOAuthCallbackPreconditions(req, res, (0, GoogleOAuthService_1.isGoogleOAuthConfigured)(), 'Google');
            if (!result) {
                return;
            }
            const { code, linkUserId } = result;
            const googleService = (0, GoogleOAuthService_1.getGoogleOAuthService)();
            const googleTokens = await googleService.authenticateUser(code);
            const googleUser = await googleService.getUserInfo(googleTokens.access_token);
            let user = await this.userService.getUserByGoogleId(googleUser.id);
            if (user) {
                await this.userService.updateUser(user.id, {
                    lastLoginAt: new Date(),
                    lastLoginIp: req.ip ?? req.socket.remoteAddress,
                });
                logger_1.logger.info(`User logged in via Google OAuth: ${user.id}`);
            }
            else {
                user = await this.resolveOrCreateOAuthUser(req, res, {
                    linkUserId,
                    providerName: 'Google',
                    providerId: googleUser.id,
                    providerIdField: 'googleId',
                    email: googleUser.email,
                    username: googleUser.email.split('@')[0] ?? `google_${node_crypto_1.default.randomUUID().substring(0, 8)}`,
                    displayName: googleUser.name,
                    avatar: googleUser.picture ?? undefined,
                    lookupByProviderId: () => this.userService.getUserByGoogleId(googleUser.id),
                });
                if (!user) {
                    return;
                }
            }
            await this.completeOAuthLogin(req, res, user, 'Google');
        }
        catch (error) {
            logger_1.logger.error('Google OAuth callback error:', error);
            if (req.method === 'GET') {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                res.redirect(`${frontendUrl}/login?error=auth_failed`);
                return;
            }
            await this.executeAndReturn(req, res, async () => {
                if (error instanceof Error &&
                    (error.constructor.name === 'ValidationError' ||
                        error.constructor.name === 'UnauthorizedError')) {
                    throw error;
                }
                throw new apiErrors_1.UnauthorizedError('Google authentication failed');
            });
        }
    };
    googleLink = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            this.validateRequired(req.body, 'code');
            const { code } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const googleService = (0, GoogleOAuthService_1.getGoogleOAuthService)();
            const googleTokens = await googleService.authenticateUser(code);
            const googleUser = await googleService.getUserInfo(googleTokens.access_token);
            const existing = await this.userService.getUserByGoogleId(googleUser.id);
            if (existing && existing.id !== userId) {
                throw new apiErrors_1.ValidationError('This Google account is already linked to another user');
            }
            await this.userService.updateUser(userId, { googleId: googleUser.id });
            logger_1.logger.info(`User ${userId} linked Google account ${googleUser.id}`);
            return {
                message: 'Google account linked successfully',
                provider: 'google',
                providerId: googleUser.id,
            };
        });
    };
    twitchInitiate = async (req, res) => {
        try {
            if (!(0, TwitchOAuthService_1.isTwitchOAuthConfigured)()) {
                logger_1.logger.warn('Twitch OAuth initiation attempted but not configured');
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                return res.redirect(`${frontendUrl}/login?error=twitch_not_configured`);
            }
            const state = (0, oauthState_1.generateOAuthState)();
            const twitchService = (0, TwitchOAuthService_1.getTwitchOAuthService)();
            const authUrl = twitchService.generateAuthUrl(state);
            logger_1.logger.debug('Redirecting to Twitch OAuth');
            safeOAuthRedirect(res, authUrl, 'twitch_error');
        }
        catch (error) {
            logger_1.logger.error('Twitch OAuth initiation error:', error);
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            res.redirect(`${frontendUrl}/login?error=twitch_error`);
        }
    };
    twitchCallback = async (req, res) => {
        try {
            const result = this.validateOAuthCallbackPreconditions(req, res, (0, TwitchOAuthService_1.isTwitchOAuthConfigured)(), 'Twitch');
            if (!result) {
                return;
            }
            const { code, linkUserId } = result;
            const twitchService = (0, TwitchOAuthService_1.getTwitchOAuthService)();
            const twitchTokens = await twitchService.authenticateUser(code);
            const twitchUser = await twitchService.getUserInfo(twitchTokens.access_token);
            let user = await this.userService.getUserByTwitchId(twitchUser.id);
            if (user) {
                await this.userService.updateUser(user.id, {
                    lastLoginAt: new Date(),
                    lastLoginIp: req.ip ?? req.socket.remoteAddress,
                });
                logger_1.logger.info(`User logged in via Twitch OAuth: ${user.id}`);
            }
            else {
                user = await this.resolveOrCreateOAuthUser(req, res, {
                    linkUserId,
                    providerName: 'Twitch',
                    providerId: twitchUser.id,
                    providerIdField: 'twitchId',
                    email: twitchUser.email,
                    username: twitchUser.login ?? `twitch_${node_crypto_1.default.randomUUID().substring(0, 8)}`,
                    displayName: twitchUser.display_name,
                    avatar: twitchUser.profile_image_url ?? undefined,
                    lookupByProviderId: () => this.userService.getUserByTwitchId(twitchUser.id),
                });
                if (!user) {
                    return;
                }
            }
            await this.completeOAuthLogin(req, res, user, 'Twitch');
        }
        catch (error) {
            logger_1.logger.error('Twitch OAuth callback error:', error);
            if (req.method === 'GET') {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                res.redirect(`${frontendUrl}/login?error=auth_failed`);
                return;
            }
            await this.executeAndReturn(req, res, async () => {
                if (error instanceof Error &&
                    (error.constructor.name === 'ValidationError' ||
                        error.constructor.name === 'UnauthorizedError')) {
                    throw error;
                }
                throw new apiErrors_1.UnauthorizedError('Twitch authentication failed');
            });
        }
    };
    twitchLink = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            this.validateRequired(req.body, 'code');
            const { code } = req.body;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const twitchService = (0, TwitchOAuthService_1.getTwitchOAuthService)();
            const twitchTokens = await twitchService.authenticateUser(code);
            const twitchUser = await twitchService.getUserInfo(twitchTokens.access_token);
            const existing = await this.userService.getUserByTwitchId(twitchUser.id);
            if (existing && existing.id !== userId) {
                throw new apiErrors_1.ValidationError('This Twitch account is already linked to another user');
            }
            await this.userService.updateUser(userId, { twitchId: twitchUser.id });
            logger_1.logger.info(`User ${userId} linked Twitch account ${twitchUser.id}`);
            return {
                message: 'Twitch account linked successfully',
                provider: 'twitch',
                providerId: twitchUser.id,
            };
        });
    };
}
exports.AuthController = AuthController;
//# sourceMappingURL=authController.js.map