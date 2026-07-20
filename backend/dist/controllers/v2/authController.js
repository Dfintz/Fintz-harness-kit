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
exports.AuthControllerV2 = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const cookies_1 = require("../../config/cookies");
const database_1 = require("../../config/database");
const urls_1 = require("../../config/urls");
const sessionBinding_1 = require("../../middleware/sessionBinding");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const User_1 = require("../../models/User");
const authentication_1 = require("../../services/authentication");
const OAuthLinkingService_1 = require("../../services/authentication/OAuthLinkingService");
const TwoFactorService_1 = require("../../services/authentication/TwoFactorService");
const DiscordService_1 = require("../../services/discord/DiscordService");
const GoogleOAuthService_1 = require("../../services/google/GoogleOAuthService");
const security_1 = require("../../services/security");
const AccountAccessLogService_1 = require("../../services/security/access/AccountAccessLogService");
const RoleService_1 = require("../../services/security/core/RoleService");
const TwitchOAuthService_1 = require("../../services/twitch/TwitchOAuthService");
const UserAuthenticationService_1 = require("../../services/user/UserAuthenticationService");
const UserService_1 = require("../../services/user/UserService");
const api_1 = require("../../types/api");
const apiErrors_1 = require("../../utils/apiErrors");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const oauthState_1 = require("../../utils/oauthState");
const pkce_1 = require("../../utils/pkce");
const ALLOWED_AZURE_ADMIN_ROLES = new Set(['admin', 'superadmin', 'super_admin']);
const AZURE_GRAPH_MEMBER_OF_ENDPOINT = 'https://graph.microsoft.com/v1.0/me/memberOf?$select=id&$top=999';
const AZURE_GRAPH_ALLOWED_ORIGIN = 'https://graph.microsoft.com';
const MAX_AZURE_GRAPH_GROUP_PAGES = 10;
function parseCommaSeparatedEnv(value) {
    if (!value) {
        return [];
    }
    return value
        .split(',')
        .map(entry => entry.trim())
        .filter((entry, index, all) => entry.length > 0 && all.indexOf(entry) === index);
}
function decodeJwtClaims(token) {
    const segments = token.split('.');
    if (segments.length < 2) {
        return null;
    }
    try {
        const payloadSegment = segments[1].replaceAll('-', '+').replaceAll('_', '/');
        const padded = payloadSegment.padEnd(payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4), '=');
        const decoded = Buffer.from(padded, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        return typeof parsed === 'object' && parsed !== null
            ? parsed
            : null;
    }
    catch {
        return null;
    }
}
function resolveSafeGraphNextLink(rawNextLink) {
    if (typeof rawNextLink !== 'string' || rawNextLink.trim().length === 0) {
        return null;
    }
    try {
        const parsed = new URL(rawNextLink);
        if (parsed.origin !== AZURE_GRAPH_ALLOWED_ORIGIN) {
            logger_1.logger.warn('Ignoring Microsoft Graph nextLink with unexpected origin', {
                origin: parsed.origin,
            });
            return null;
        }
        if (!parsed.pathname.startsWith('/v1.0/me/memberOf')) {
            logger_1.logger.warn('Ignoring Microsoft Graph nextLink with unexpected path', {
                pathname: parsed.pathname,
            });
            return null;
        }
        return parsed.toString();
    }
    catch {
        logger_1.logger.warn('Ignoring malformed Microsoft Graph nextLink');
        return null;
    }
}
const OAUTH_ERROR_ALLOWLIST = [
    'access_denied',
    'invalid_request',
    'unauthorized_client',
    'unsupported_response_type',
    'invalid_scope',
    'server_error',
    'temporarily_unavailable',
    'interaction_required',
    'login_required',
    'consent_required',
];
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
        logger_1.logger.error('Refused OAuth redirect to malformed URL', { err: (0, errorHandler_1.getErrorMessage)(err) });
    }
    res.redirect(`${(0, urls_1.getFrontendUrl)()}/login?error=${encodeURIComponent(errorCode)}`);
}
class AuthControllerV2 {
    authService;
    oauthLinkingService;
    twoFactorService;
    userService;
    userAuthService;
    securityService;
    accessLogService;
    constructor() {
        this.authService = new authentication_1.AuthenticationService();
        this.twoFactorService = new TwoFactorService_1.TwoFactorService();
        this.userService = new UserService_1.UserService();
        this.userAuthService = new UserAuthenticationService_1.UserAuthenticationService();
        this.securityService = security_1.AccountSecurityService.getInstance();
        this.accessLogService = new AccountAccessLogService_1.AccountAccessLogService();
        this.oauthLinkingService = new OAuthLinkingService_1.OAuthLinkingService(this.userService, this.authService);
    }
    resolveAzureAdminConfig() {
        const tenantId = process.env.AZURE_AD_TENANT_ID ?? 'common';
        const clientId = process.env.AZURE_AD_CLIENT_ID;
        const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
        const configuredAdminGroups = parseCommaSeparatedEnv(process.env.AZURE_AD_ADMIN_GROUP_IDS);
        if (!clientId || !clientSecret) {
            return { ok: false, message: 'Azure AD not configured' };
        }
        if (tenantId === 'common') {
            return { ok: false, message: 'Azure AD tenant restriction is not configured' };
        }
        if (configuredAdminGroups.length === 0) {
            return { ok: false, message: 'Azure AD admin group restriction is not configured' };
        }
        return { ok: true, tenantId, clientId, clientSecret, configuredAdminGroups };
    }
    async fetchAzureAdminGroupIds(accessToken) {
        const groupIds = new Set();
        let nextPageUrl = AZURE_GRAPH_MEMBER_OF_ENDPOINT;
        let pageCount = 0;
        while (nextPageUrl && pageCount < MAX_AZURE_GRAPH_GROUP_PAGES) {
            const response = await fetch(nextPageUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!response.ok) {
                throw new Error('Failed to fetch Azure AD group membership');
            }
            const payload = (await response.json());
            for (const entry of payload.value ?? []) {
                if (typeof entry?.id === 'string' && entry.id.length > 0) {
                    groupIds.add(entry.id);
                }
            }
            pageCount += 1;
            nextPageUrl = resolveSafeGraphNextLink(payload['@odata.nextLink']);
        }
        if (nextPageUrl) {
            logger_1.logger.warn('Truncated Microsoft Graph group membership pagination', {
                maxPages: MAX_AZURE_GRAPH_GROUP_PAGES,
            });
        }
        return groupIds;
    }
    async resolveAzureUserGroupIds(accessToken, tokenClaims) {
        const groupIds = new Set();
        const claimGroups = tokenClaims?.groups;
        if (Array.isArray(claimGroups)) {
            for (const groupId of claimGroups) {
                if (typeof groupId === 'string' && groupId.length > 0) {
                    groupIds.add(groupId);
                }
            }
        }
        if (groupIds.size > 0) {
            return groupIds;
        }
        return this.fetchAzureAdminGroupIds(accessToken);
    }
    isAdminRole(role) {
        return typeof role === 'string' && ALLOWED_AZURE_ADMIN_ROLES.has(role);
    }
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
    async enable2FA(req, res) {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.error(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
            }
            const userRecord = await this.userService.getUserById(user.id);
            if (!userRecord) {
                return res.error(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', undefined, 404);
            }
            if (userRecord.twoFactorEnabled) {
                return res.error(api_1.ApiErrorCode.RESOURCE_CONFLICT, '2FA is already enabled. Disable it first to re-enable.', undefined, 409);
            }
            const setup = await this.twoFactorService.generateSecret(user.username || userRecord.email, 'SC Fleet Manager');
            const hashedBackupCodes = await this.twoFactorService.hashBackupCodes(setup.backupCodes);
            await this.userService.updateUser(user.id, {
                twoFactorSecret: setup.secret,
                backupCodes: hashedBackupCodes,
            });
            logger_1.logger.info('2FA setup initiated', { userId: user.id });
            res.success({
                secret: setup.secret,
                qrCodeUrl: setup.qrCodeUrl,
                backupCodes: setup.backupCodes,
                message: 'Scan QR code with authenticator app and verify to complete setup',
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to enable 2FA', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to enable 2FA'), undefined, 500);
        }
    }
    async verify2FA(req, res) {
        try {
            const user = req.user;
            const { code, isBackupCode = false } = req.body;
            if (!user?.id) {
                return res.error(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
            }
            const normalizedCode = typeof code === 'string'
                ? code.trim().toUpperCase()
                : String(code ?? '')
                    .trim()
                    .toUpperCase();
            if (!normalizedCode || (normalizedCode.length !== 6 && normalizedCode.length !== 8)) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid code format. Expected 6-digit code or 8-character backup code', undefined, 400);
            }
            const lockoutStatus = await this.twoFactorService.checkLockout(user.id);
            if (lockoutStatus.isLocked) {
                return res.error(api_1.ApiErrorCode.RATE_LIMIT_EXCEEDED, `Account temporarily locked due to multiple failed attempts. Try again after ${lockoutStatus.lockedUntil?.toISOString()}`, { lockedUntil: lockoutStatus.lockedUntil, remainingAttempts: 0 }, 429);
            }
            const userRecord = await this.userService.getUserById(user.id);
            if (!userRecord?.twoFactorSecret) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, '2FA is not set up for this user', undefined, 400);
            }
            let verified = false;
            if (isBackupCode) {
                verified = await this.twoFactorService.verifyBackupCode(normalizedCode, userRecord.backupCodes || []);
                if (verified) {
                    const updatedBackupCodes = await this.twoFactorService.removeBackupCode(normalizedCode, userRecord.backupCodes || []);
                    await this.userService.updateUser(user.id, {
                        backupCodes: updatedBackupCodes,
                    });
                    logger_1.logger.info('Backup code used successfully', { userId: user.id });
                }
            }
            else {
                verified = await this.twoFactorService.verifyToken(userRecord.twoFactorSecret, normalizedCode, user.id);
            }
            if (verified) {
                await this.twoFactorService.resetFailedAttempts(user.id);
                if (!userRecord.twoFactorEnabled) {
                    await this.userService.updateUser(user.id, {
                        twoFactorEnabled: true,
                    });
                    logger_1.logger.info('2FA enabled successfully', { userId: user.id });
                }
                res.success({
                    verified: true,
                    message: '2FA verified successfully',
                });
            }
            else {
                await this.twoFactorService.trackFailedAttempt(user.id);
                const updatedLockout = await this.twoFactorService.checkLockout(user.id);
                logger_1.logger.warn('Failed 2FA verification attempt', {
                    userId: user.id,
                    remainingAttempts: updatedLockout.remainingAttempts,
                });
                res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, 'Invalid verification code', {
                    remainingAttempts: updatedLockout.remainingAttempts,
                    attemptCount: updatedLockout.attemptCount,
                }, 401);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to verify 2FA', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to verify 2FA'), undefined, 500);
        }
    }
    async disable2FA(req, res) {
        try {
            const user = req.user;
            const { password, code } = req.body;
            if (!user?.id) {
                return res.error(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
            }
            if (!password || !code) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Password and current 2FA code required to disable 2FA', undefined, 400);
            }
            const userRecord = await this.userAuthService.getUserWithPassword(user.id);
            if (!userRecord) {
                return res.error(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', undefined, 404);
            }
            if (!userRecord.twoFactorEnabled) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, '2FA is not enabled', undefined, 400);
            }
            if (!userRecord.password) {
                logger_1.logger.warn('Cannot disable 2FA - user has no password set', { userId: user.id });
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Cannot disable 2FA - password is required', undefined, 400);
            }
            const passwordValid = await this.userAuthService.verifyPassword(password, userRecord.password);
            if (!passwordValid) {
                logger_1.logger.warn('Failed 2FA disable attempt - invalid password', { userId: user.id });
                return res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, 'Invalid password', undefined, 401);
            }
            const normalizedCode = typeof code === 'string'
                ? code.trim().toUpperCase()
                : String(code ?? '')
                    .trim()
                    .toUpperCase();
            const verified = await this.twoFactorService.verifyToken(userRecord.twoFactorSecret || '', normalizedCode, user.id);
            if (!verified) {
                logger_1.logger.warn('Failed 2FA disable attempt - invalid code', { userId: user.id });
                return res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, 'Invalid 2FA code', undefined, 401);
            }
            await this.userService.updateUser(user.id, {
                twoFactorEnabled: false,
                twoFactorSecret: undefined,
                backupCodes: [],
                failedTwoFactorAttempts: 0,
                twoFactorLockedUntil: undefined,
            });
            logger_1.logger.info('2FA disabled successfully', { userId: user.id });
            res.success({
                message: '2FA disabled successfully',
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to disable 2FA', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to disable 2FA'), undefined, 500);
        }
    }
    async login(req, res) {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Username and password are required', undefined, 400);
            }
            const user = await this.userService.validateCredentials(username, password);
            if (!user) {
                const existingUser = await this.userService.getUserByUsername(username);
                if (existingUser) {
                    const lockoutResult = await this.securityService.recordFailedAttempt(existingUser.id);
                    if (lockoutResult.isLocked && lockoutResult.lockedUntil) {
                        const lockoutMinutes = Math.ceil((lockoutResult.lockedUntil.getTime() - Date.now()) / 60000);
                        return res.error(api_1.ApiErrorCode.FORBIDDEN, `Account locked due to too many failed attempts. Try again in ${lockoutMinutes} minutes.`, undefined, 403);
                    }
                    if (lockoutResult.attemptsRemaining <= 2) {
                        return res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, `Invalid credentials. ${lockoutResult.attemptsRemaining} attempts remaining before lockout.`, { attemptsRemaining: lockoutResult.attemptsRemaining }, 401);
                    }
                }
                return res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, 'Invalid credentials', undefined, 401);
            }
            if (this.securityService.isAccountLocked(user)) {
                const status = await this.securityService.getLockoutStatus(user.id);
                const lockoutMinutes = status.lockoutExpiresIn
                    ? Math.ceil(status.lockoutExpiresIn / 60000)
                    : 0;
                return res.error(api_1.ApiErrorCode.FORBIDDEN, `Account is locked. Try again in ${lockoutMinutes} minutes.`, undefined, 403);
            }
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const tokens = await this.authService.generateTokens(user, {
                ipAddress,
                userAgent,
                sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
            });
            await this.securityService.resetFailedAttempts(user.id);
            void this.accessLogService.logAccess(user.id, user.id, user.activeOrgId ?? undefined, 'login:password', ipAddress, userAgent);
            res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
            res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
            logger_1.logger.info('Password login successful', {
                userId: user.id,
                username: user.username,
                role: user.role,
            });
            res.success({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: { id: user.id, username: user.username, role: user.role },
                message: 'Login successful. Tokens also set in httpOnly cookies for enhanced security.',
            });
        }
        catch (error) {
            logger_1.logger.error('Login failed', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Login failed'), undefined, 500);
        }
    }
    async demoLogin(req, res) {
        try {
            if (process.env.NODE_ENV === 'production') {
                throw new apiErrors_1.ForbiddenError('Development login is disabled in production environments');
            }
            if (process.env.ALLOW_DEV_LOGIN !== 'true') {
                throw new apiErrors_1.ForbiddenError('Development login is disabled. Set ALLOW_DEV_LOGIN=true to enable.');
            }
            const username = (typeof req.body?.username === 'string' ? req.body.username.trim() : '') || 'dev-user';
            const email = (typeof req.body?.email === 'string' ? req.body.email.trim() : '') ||
                `${username}@dev.local`;
            const VALID_DEV_ROLES = ['admin', 'user', 'moderator'];
            const rawRole = (typeof req.body?.role === 'string' ? req.body.role.trim() : '') ||
                process.env.DEV_LOGIN_ROLE ||
                'admin';
            const role = VALID_DEV_ROLES.includes(rawRole) ? rawRole : 'admin';
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
                try {
                    await database_1.AppDataSource.query(`DELETE FROM organization_memberships WHERE "userId" = $1`, [
                        user.id,
                    ]);
                    await database_1.AppDataSource.query(`DELETE FROM users WHERE id = $1`, [user.id]);
                }
                catch (delErr) {
                    logger_1.logger.warn('Dev persona: could not delete non-UUID user (non-fatal)', {
                        userId: user.id,
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
                    role,
                    discordId: `${devDiscordPrefix}-${username}`,
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
            res.success({
                token: tokens.accessToken,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: { id: user.id, username: user.username, role: user.role },
                message: 'Development login successful. Tokens set in httpOnly cookies for this session.',
            });
        }
        catch (error) {
            res.error(api_1.ApiErrorCode.FORBIDDEN, (0, errorHandler_1.getErrorMessage)(error, 'Development login failed'), undefined, 403);
        }
    }
    async sandboxLogin(req, res) {
        try {
            if (process.env.ENABLE_SANDBOX_LOGIN !== 'true') {
                throw new apiErrors_1.ForbiddenError('Sandbox login is disabled. Set ENABLE_SANDBOX_LOGIN=true to enable trial sessions.');
            }
            const metadata = {
                ipAddress: req.ip ?? req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
                sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
            };
            const user = await this.userService.createSandboxUser({
                usernamePrefix: process.env.SANDBOX_LOGIN_PREFIX,
                emailDomain: process.env.SANDBOX_EMAIL_DOMAIN,
                ipAddress: metadata.ipAddress,
            });
            await this.securityService.resetFailedAttempts(user.id);
            const tokens = await this.authService.generateTokens(user, metadata);
            res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
            res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
            logger_1.logger.info('Sandbox login issued', { userId: user.id });
            res.success({
                token: tokens.accessToken,
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                user: { id: user.id, username: user.username, role: user.role },
                sandbox: true,
                message: 'Sandbox session started. You are signed in with an isolated trial account.',
            });
        }
        catch (error) {
            if (error instanceof apiErrors_1.ForbiddenError) {
                res.error(api_1.ApiErrorCode.FORBIDDEN, error.message, undefined, 403);
                return;
            }
            logger_1.logger.error('Sandbox login internal error', {
                error: error instanceof Error ? error.message : String(error),
            });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, 'Sandbox login failed due to an internal error', undefined, 500);
        }
    }
    async seedDevPersonaOrgs(userId, username) {
        const personaOrgs = AuthControllerV2.DEV_PERSONA_ORGS[username];
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
    async ensureDevOrg(orgRepo, config, userId) {
        const existing = await orgRepo.findOne({ where: { id: config.orgId } });
        if (existing) {
            return;
        }
        const org = orgRepo.create({
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
            const { getOrgDefaultsService } = await Promise.resolve().then(() => __importStar(require('../../services/organization/OrgDefaultsService')));
            await getOrgDefaultsService().seedDefaults(config.orgId);
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
    async logout(req, res) {
        try {
            const refreshToken = req.cookies?.[cookies_1.COOKIE_NAMES.REFRESH_TOKEN] ?? req.body.refreshToken;
            if (refreshToken) {
                await this.authService.revokeRefreshToken(refreshToken).catch(() => {
                    logger_1.logger.debug('Refresh token revocation skipped (already revoked or expired)');
                });
            }
            res.clearCookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, cookies_1.clearCookieOptions);
            res.clearCookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, cookies_1.clearRefreshCookieOptions);
            res.clearCookie(cookies_1.COOKIE_NAMES.CSRF_TOKEN, cookies_1.clearCsrfCookieOptions);
            const userId = req.user?.id ?? 'unknown';
            logger_1.logger.info(`User ${userId} logged out`);
            res.success({ message: 'Logged out successfully' });
        }
        catch (error) {
            logger_1.logger.error('Logout failed', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Logout failed'), undefined, 500);
        }
    }
    async logoutAll(req, res) {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.error(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
            }
            const count = await this.authService.revokeAllUserTokens(user.id);
            res.clearCookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, cookies_1.clearCookieOptions);
            res.clearCookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, cookies_1.clearRefreshCookieOptions);
            res.clearCookie(cookies_1.COOKIE_NAMES.CSRF_TOKEN, cookies_1.clearCsrfCookieOptions);
            logger_1.logger.info(`All tokens revoked for user ${user.id} (${count} tokens)`);
            res.success({
                message: 'Logged out from all devices successfully',
                tokensRevoked: count,
            });
        }
        catch (error) {
            logger_1.logger.error('Logout all failed', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Logout all failed'), undefined, 500);
        }
    }
    async refresh(req, res) {
        try {
            const refreshToken = req.cookies?.[cookies_1.COOKIE_NAMES.REFRESH_TOKEN] ?? req.body.refreshToken;
            if (!refreshToken) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Refresh token is required', undefined, 400);
            }
            const ipAddress = req.ip ?? req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            const tokens = await this.authService.refreshTokens(refreshToken, {
                ipAddress,
                userAgent,
                sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
            });
            res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
            res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
            logger_1.logger.info('Tokens refreshed successfully');
            res.success({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });
        }
        catch (error) {
            logger_1.logger.warn('Token refresh failed', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.TOKEN_EXPIRED, 'Invalid or expired refresh token', undefined, 401);
        }
    }
    async getActiveSessions(req, res) {
        try {
            const user = req.user;
            if (!user?.id) {
                return res.error(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
            }
            const tokens = await this.authService.getUserRefreshTokens(user.id);
            res.success({
                sessions: tokens.map(token => ({
                    id: token.id,
                    createdAt: token.createdAt,
                    expiresAt: token.expiresAt,
                    ipAddress: token.ipAddress,
                    userAgent: token.userAgent,
                })),
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to get sessions', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to get sessions'), undefined, 500);
        }
    }
    handleOAuthError(req, res, errorCode, message) {
        if (req.method === 'GET') {
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorCode)}`);
            return;
        }
        res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, message, undefined, 401);
    }
    validateOAuthCallbackPreconditions(req, res, isConfigured, providerName) {
        if (!isConfigured) {
            this.handleOAuthError(req, res, `${providerName}_not_configured`, `${providerName} authentication is not available.`);
            return undefined;
        }
        const oauthError = req.query.error;
        if (oauthError) {
            const rawError = Array.isArray(oauthError) ? oauthError[0] : oauthError;
            const truncated = String(rawError !== null && rawError !== undefined ? rawError : '')
                .trim()
                .toLowerCase()
                .slice(0, 128);
            const errorStr = OAUTH_ERROR_ALLOWLIST.includes(truncated)
                ? truncated
                : truncated.replaceAll(/[^a-zA-Z0-9_\- ]/g, '') || 'unknown_error';
            this.handleOAuthError(req, res, errorStr, `${providerName} authentication failed: ${errorStr}`);
            return undefined;
        }
        const queryCode = Array.isArray(req.query.code) ? req.query.code[0] : req.query.code;
        const code = (queryCode ?? req.body.code);
        if (!code) {
            this.handleOAuthError(req, res, 'no_code', 'Authorization code is required');
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
                res.error(api_1.ApiErrorCode.FORBIDDEN, 'Invalid or expired OAuth state', undefined, 403);
            }
            return undefined;
        }
        return { code, linkUserId: stateResult.linkUserId };
    }
    validateDiscordCallbackPreconditions(req, res) {
        const result = this.validateOAuthCallbackPreconditions(req, res, (0, DiscordService_1.isDiscordServiceInitialized)(), 'Discord');
        if (!result) {
            return undefined;
        }
        const backendRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND;
        if (!backendRedirectUri) {
            this.handleOAuthError(req, res, 'server_config', 'DISCORD_REDIRECT_URI_BACKEND is not configured');
            return undefined;
        }
        return result;
    }
    getAccessTokenFromRequest(req) {
        return (req.cookies?.[cookies_1.COOKIE_NAMES.ACCESS_TOKEN] ??
            req.headers.authorization?.replace('Bearer ', '') ??
            undefined);
    }
    async resolveOrCreateOAuthUserAndRespond(req, res, opts) {
        const result = await this.oauthLinkingService.resolveOrCreateOAuthUser({
            ...opts,
            accessToken: this.getAccessTokenFromRequest(req),
            ipAddress: req.ip ?? req.socket.remoteAddress,
        });
        if (result.tag === 'duplicate_provider') {
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            res.redirect(`${frontendUrl}/settings?error=account_already_linked`);
            return null;
        }
        return result.user;
    }
    static MOBILE_SCHEME = 'scfleetmanager://';
    storeMobileRedirect(req, res) {
        const mobileRedirect = req.query.mobile_redirect;
        if (!mobileRedirect) {
            return;
        }
        if (!mobileRedirect.startsWith(AuthControllerV2.MOBILE_SCHEME)) {
            logger_1.logger.warn('Rejected mobile_redirect with invalid scheme', {
                value: mobileRedirect.substring(0, 60),
            });
            return;
        }
        res.cookie(cookies_1.COOKIE_NAMES.MOBILE_REDIRECT, mobileRedirect, cookies_1.pkceCookieOptions);
    }
    consumeMobileRedirect(req, res) {
        const mobileRedirect = req.cookies?.[cookies_1.COOKIE_NAMES.MOBILE_REDIRECT];
        if (mobileRedirect) {
            res.clearCookie(cookies_1.COOKIE_NAMES.MOBILE_REDIRECT, cookies_1.clearCookieOptions);
        }
        if (mobileRedirect && !mobileRedirect.startsWith(AuthControllerV2.MOBILE_SCHEME)) {
            logger_1.logger.warn('Rejected consumed mobile_redirect with invalid scheme');
            return undefined;
        }
        return mobileRedirect;
    }
    async completeOAuthLogin(req, res, user, providerName, redirectUrl) {
        const tokens = await this.authService.generateTokens(user, {
            ipAddress: req.ip ?? req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
        });
        res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
        res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
        void this.accessLogService.logAccess(user.id, user.id, user.activeOrgId ?? undefined, `login:${providerName.toLowerCase()}`, req.ip ?? req.socket.remoteAddress, req.headers['user-agent']);
        if (req.method === 'GET') {
            const mobileRedirect = this.consumeMobileRedirect(req, res);
            if (mobileRedirect) {
                const mobileUrl = new URL(mobileRedirect);
                mobileUrl.searchParams.set('token', tokens.accessToken);
                mobileUrl.searchParams.set('refreshToken', tokens.refreshToken);
                const target = mobileUrl.toString();
                logger_1.logger.info(`${providerName} OAuth successful, redirecting to mobile app`);
                res.redirect(target);
                return;
            }
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            const target = redirectUrl ?? `${frontendUrl}/login?success=true`;
            logger_1.logger.info(`${providerName} OAuth successful, redirecting to ${target}`);
            res.redirect(target);
            return;
        }
        res.success({
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
    async discordInitiate(req, res) {
        try {
            if (!(0, DiscordService_1.isDiscordServiceInitialized)()) {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                return res.redirect(`${frontendUrl}/login?error=discord_not_configured`);
            }
            this.storeMobileRedirect(req, res);
            const state = (0, oauthState_1.generateOAuthState)();
            const pkce = (0, pkce_1.generatePkcePair)();
            res.cookie(cookies_1.COOKIE_NAMES.DISCORD_PKCE_VERIFIER, pkce.verifier, cookies_1.pkceCookieOptions);
            const discordService = (0, DiscordService_1.getDiscordService)();
            const authUrl = discordService.generateAuthUrl(state, pkce.challenge);
            logger_1.logger.debug('Redirecting to Discord OAuth', { pkce: true });
            safeOAuthRedirect(res, authUrl, 'discord_error');
        }
        catch (error) {
            logger_1.logger.error('Discord OAuth initiation error:', error);
            const frontendUrl = (0, urls_1.getFrontendUrl)();
            res.redirect(`${frontendUrl}/login?error=discord_error`);
        }
    }
    async discordCallback(req, res) {
        try {
            const result = this.validateDiscordCallbackPreconditions(req, res);
            if (!result) {
                return;
            }
            const { code, linkUserId } = result;
            const backendRedirectUri = process.env.DISCORD_REDIRECT_URI_BACKEND;
            const codeVerifier = req.cookies?.[cookies_1.COOKIE_NAMES.DISCORD_PKCE_VERIFIER];
            res.clearCookie(cookies_1.COOKIE_NAMES.DISCORD_PKCE_VERIFIER, cookies_1.clearCookieOptions);
            const discordService = (0, DiscordService_1.getDiscordService)();
            const discordTokens = await discordService.authenticateUser(code, backendRedirectUri, codeVerifier);
            const discordUser = await discordService.getUserInfo(discordTokens.access_token);
            const oauthUserOpts = {
                linkUserId,
                providerName: 'Discord',
                providerId: discordUser.id,
                providerIdField: 'discordId',
                email: discordUser.email,
                username: discordUser.username,
                displayName: discordUser.username,
                avatar: discordUser.avatar
                    ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}`
                    : undefined,
                lookupByProviderId: () => this.userService.getUserByDiscordId(discordUser.id),
            };
            let user;
            let redirectUrl;
            if (linkUserId) {
                user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
                if (!user) {
                    return;
                }
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                redirectUrl = `${frontendUrl}/settings?linked=discord`;
            }
            else {
                user = await this.userService.getUserByDiscordId(discordUser.id);
                if (user) {
                    await this.userService.updateUser(user.id, {
                        lastLoginAt: new Date(),
                        lastLoginIp: req.ip ?? req.socket.remoteAddress,
                    });
                    logger_1.logger.info(`User logged in via Discord OAuth: ${user.id}`);
                }
                else {
                    user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
                    if (!user) {
                        return;
                    }
                }
            }
            await this.completeOAuthLogin(req, res, user, 'Discord', redirectUrl);
        }
        catch (error) {
            logger_1.logger.error('Discord OAuth callback error:', error);
            if (req.method === 'GET') {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                res.redirect(`${frontendUrl}/login?error=auth_failed`);
                return;
            }
            res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, (0, errorHandler_1.getErrorMessage)(error, 'Discord authentication failed'), undefined, 401);
        }
    }
    async azureADCallback(req, res) {
        try {
            const { code, redirectUri } = req.body;
            if (!code || !redirectUri) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Code and redirectUri are required', undefined, 400);
            }
            const allowedOrigin = (0, urls_1.getFrontendUrl)();
            try {
                const parsed = new URL(redirectUri);
                const allowed = new URL(allowedOrigin);
                if (parsed.origin !== allowed.origin || parsed.pathname !== '/admin/login') {
                    return res.error(api_1.ApiErrorCode.FORBIDDEN, 'Redirect URI is not allowed', undefined, 403);
                }
            }
            catch {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Invalid redirect URI format', undefined, 400);
            }
            const tenantId = process.env.AZURE_AD_TENANT_ID ?? 'common';
            const adminConfig = this.resolveAzureAdminConfig();
            if (!adminConfig.ok) {
                return res.error(api_1.ApiErrorCode.INTERNAL_ERROR, adminConfig.message, undefined, 500);
            }
            const { clientId, clientSecret, configuredAdminGroups } = adminConfig;
            const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
            const tokenParams = new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code: code,
                redirect_uri: redirectUri,
                grant_type: 'authorization_code',
                scope: 'openid profile email User.Read',
            });
            const tokenResponse = await fetch(tokenEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: tokenParams.toString(),
            });
            if (!tokenResponse.ok) {
                let errorMessage = 'Failed to exchange code for token';
                try {
                    const errorData = (await tokenResponse.json());
                    errorMessage = errorData.error_description ?? errorData.error ?? errorMessage;
                }
                catch {
                }
                logger_1.logger.error('Azure AD token exchange failed', { error: errorMessage });
                return res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, errorMessage, undefined, 401);
            }
            const tokenData = (await tokenResponse.json());
            const tokenClaims = decodeJwtClaims(tokenData.access_token);
            const tokenTenantId = tokenClaims?.tid;
            if (typeof tokenTenantId !== 'string' || tokenTenantId !== tenantId) {
                return res.error(api_1.ApiErrorCode.FORBIDDEN, 'Azure AD tenant is not allowed for admin login', undefined, 403);
            }
            const userGroupIds = await this.resolveAzureUserGroupIds(tokenData.access_token, tokenClaims);
            const isInAdminGroup = configuredAdminGroups.some(groupId => userGroupIds.has(groupId));
            if (!isInAdminGroup) {
                return res.error(api_1.ApiErrorCode.FORBIDDEN, 'Azure AD account is not in an allowed admin group', undefined, 403);
            }
            const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            if (!userInfoResponse.ok) {
                return res.error(api_1.ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch user info from Microsoft Graph', undefined, 500);
            }
            const azureUser = (await userInfoResponse.json());
            const email = azureUser.mail ?? azureUser.userPrincipalName;
            if (!email) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Azure AD user has no email address', undefined, 400);
            }
            const user = await this.userService.getUserByEmail(email);
            if (!user) {
                return res.error(api_1.ApiErrorCode.FORBIDDEN, 'No linked admin account exists for this Azure AD user', undefined, 403);
            }
            if (!this.isAdminRole(user.role)) {
                return res.error(api_1.ApiErrorCode.FORBIDDEN, 'User account is not authorized for admin login', undefined, 403);
            }
            await this.userService.updateUser(user.id, {
                lastLoginAt: new Date(),
                lastLoginIp: req.ip ?? req.socket.remoteAddress,
            });
            logger_1.logger.info(`Admin user logged in via Azure AD OAuth: ${user.id}`);
            const tokens = await this.authService.generateTokens(user, {
                ipAddress: req.ip ?? req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
                sessionBinding: (0, sessionBinding_1.createSessionBinding)(req),
            });
            res.cookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, (0, cookies_1.getAccessTokenCookieOptions)(tokens.accessToken));
            res.cookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, cookies_1.refreshTokenCookieOptions);
            void this.accessLogService.logAccess(user.id, user.id, user.activeOrgId ?? undefined, 'login:azuread', req.ip ?? req.socket.remoteAddress, req.headers['user-agent']);
            res.success({
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
            });
        }
        catch (error) {
            logger_1.logger.error('Azure AD OAuth callback error:', error);
            res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, (0, errorHandler_1.getErrorMessage)(error, 'Azure AD authentication failed'), undefined, 401);
        }
    }
    async googleInitiate(req, res) {
        try {
            if (!(0, GoogleOAuthService_1.isGoogleOAuthConfigured)()) {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                return res.redirect(`${frontendUrl}/login?error=google_not_configured`);
            }
            this.storeMobileRedirect(req, res);
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
    }
    async googleCallback(req, res) {
        try {
            const result = this.validateOAuthCallbackPreconditions(req, res, (0, GoogleOAuthService_1.isGoogleOAuthConfigured)(), 'Google');
            if (!result) {
                return;
            }
            const { code, linkUserId } = result;
            const googleService = (0, GoogleOAuthService_1.getGoogleOAuthService)();
            const googleTokens = await googleService.authenticateUser(code);
            const googleUser = await googleService.getUserInfo(googleTokens.access_token);
            const oauthUserOpts = {
                linkUserId,
                providerName: 'Google',
                providerId: googleUser.id,
                providerIdField: 'googleId',
                email: googleUser.email,
                username: googleUser.email.split('@')[0] ?? `google_${node_crypto_1.default.randomUUID().substring(0, 8)}`,
                displayName: googleUser.name,
                avatar: googleUser.picture ?? undefined,
                lookupByProviderId: () => this.userService.getUserByGoogleId(googleUser.id),
            };
            let user;
            let redirectUrl;
            if (linkUserId) {
                user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
                if (!user) {
                    return;
                }
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                redirectUrl = `${frontendUrl}/settings?linked=google`;
            }
            else {
                user = await this.userService.getUserByGoogleId(googleUser.id);
                if (user) {
                    await this.userService.updateUser(user.id, {
                        lastLoginAt: new Date(),
                        lastLoginIp: req.ip ?? req.socket.remoteAddress,
                    });
                    logger_1.logger.info(`User logged in via Google OAuth: ${user.id}`);
                }
                else {
                    user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
                    if (!user) {
                        return;
                    }
                }
            }
            await this.completeOAuthLogin(req, res, user, 'Google', redirectUrl);
        }
        catch (error) {
            logger_1.logger.error('Google OAuth callback error:', error);
            if (req.method === 'GET') {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                res.redirect(`${frontendUrl}/login?error=auth_failed`);
                return;
            }
            res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, (0, errorHandler_1.getErrorMessage)(error, 'Google authentication failed'), undefined, 401);
        }
    }
    async googleLink(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.error(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
            }
            const { code } = req.body;
            if (!code) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Authorization code is required', undefined, 400);
            }
            const googleService = (0, GoogleOAuthService_1.getGoogleOAuthService)();
            const googleTokens = await googleService.authenticateUser(code);
            const googleUser = await googleService.getUserInfo(googleTokens.access_token);
            const existing = await this.userService.getUserByGoogleId(googleUser.id);
            if (existing && existing.id !== userId) {
                return res.error(api_1.ApiErrorCode.RESOURCE_CONFLICT, 'This Google account is already linked to another user', undefined, 409);
            }
            await this.userService.updateUser(userId, { googleId: googleUser.id });
            logger_1.logger.info(`User ${userId} linked Google account ${googleUser.id}`);
            res.success({
                message: 'Google account linked successfully',
                provider: 'google',
                providerId: googleUser.id,
            });
        }
        catch (error) {
            logger_1.logger.error('Google account linking failed:', error);
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Google account linking failed'), undefined, 500);
        }
    }
    async twitchInitiate(req, res) {
        try {
            if (!(0, TwitchOAuthService_1.isTwitchOAuthConfigured)()) {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                return res.redirect(`${frontendUrl}/login?error=twitch_not_configured`);
            }
            this.storeMobileRedirect(req, res);
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
    }
    async twitchCallback(req, res) {
        try {
            const result = this.validateOAuthCallbackPreconditions(req, res, (0, TwitchOAuthService_1.isTwitchOAuthConfigured)(), 'Twitch');
            if (!result) {
                return;
            }
            const { code, linkUserId } = result;
            const twitchService = (0, TwitchOAuthService_1.getTwitchOAuthService)();
            const twitchTokens = await twitchService.authenticateUser(code);
            const twitchUser = await twitchService.getUserInfo(twitchTokens.access_token);
            const oauthUserOpts = {
                linkUserId,
                providerName: 'Twitch',
                providerId: twitchUser.id,
                providerIdField: 'twitchId',
                email: twitchUser.email,
                username: twitchUser.login ?? `twitch_${node_crypto_1.default.randomUUID().substring(0, 8)}`,
                displayName: twitchUser.display_name,
                avatar: twitchUser.profile_image_url ?? undefined,
                lookupByProviderId: () => this.userService.getUserByTwitchId(twitchUser.id),
            };
            let user;
            let redirectUrl;
            if (linkUserId) {
                user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
                if (!user) {
                    return;
                }
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                redirectUrl = `${frontendUrl}/settings?linked=twitch`;
            }
            else {
                user = await this.userService.getUserByTwitchId(twitchUser.id);
                if (user) {
                    await this.userService.updateUser(user.id, {
                        lastLoginAt: new Date(),
                        lastLoginIp: req.ip ?? req.socket.remoteAddress,
                    });
                    logger_1.logger.info(`User logged in via Twitch OAuth: ${user.id}`);
                }
                else {
                    user = await this.resolveOrCreateOAuthUserAndRespond(req, res, oauthUserOpts);
                    if (!user) {
                        return;
                    }
                }
            }
            await this.completeOAuthLogin(req, res, user, 'Twitch', redirectUrl);
        }
        catch (error) {
            logger_1.logger.error('Twitch OAuth callback error:', error);
            if (req.method === 'GET') {
                const frontendUrl = (0, urls_1.getFrontendUrl)();
                res.redirect(`${frontendUrl}/login?error=auth_failed`);
                return;
            }
            res.error(api_1.ApiErrorCode.INVALID_CREDENTIALS, (0, errorHandler_1.getErrorMessage)(error, 'Twitch authentication failed'), undefined, 401);
        }
    }
    async twitchLink(req, res) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.error(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', undefined, 401);
            }
            const { code } = req.body;
            if (!code) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Authorization code is required', undefined, 400);
            }
            const twitchService = (0, TwitchOAuthService_1.getTwitchOAuthService)();
            const twitchTokens = await twitchService.authenticateUser(code);
            const twitchUser = await twitchService.getUserInfo(twitchTokens.access_token);
            const existing = await this.userService.getUserByTwitchId(twitchUser.id);
            if (existing && existing.id !== userId) {
                return res.error(api_1.ApiErrorCode.RESOURCE_CONFLICT, 'This Twitch account is already linked to another user', undefined, 409);
            }
            await this.userService.updateUser(userId, { twitchId: twitchUser.id });
            logger_1.logger.info(`User ${userId} linked Twitch account ${twitchUser.id}`);
            res.success({
                message: 'Twitch account linked successfully',
                provider: 'twitch',
                providerId: twitchUser.id,
            });
        }
        catch (error) {
            logger_1.logger.error('Twitch account linking failed:', error);
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Twitch account linking failed'), undefined, 500);
        }
    }
    async revokeSession(req, res) {
        try {
            const { sessionId } = req.params;
            if (!sessionId) {
                return res.error(api_1.ApiErrorCode.INVALID_INPUT, 'Session ID is required', undefined, 400);
            }
            await this.authService.revokeRefreshToken(sessionId).catch(() => {
                logger_1.logger.debug('Session revocation skipped (already revoked or expired)');
            });
            const currentRefreshToken = req.cookies?.[cookies_1.COOKIE_NAMES.REFRESH_TOKEN];
            if (currentRefreshToken === sessionId) {
                res.clearCookie(cookies_1.COOKIE_NAMES.ACCESS_TOKEN, cookies_1.clearCookieOptions);
                res.clearCookie(cookies_1.COOKIE_NAMES.REFRESH_TOKEN, cookies_1.clearRefreshCookieOptions);
                res.clearCookie(cookies_1.COOKIE_NAMES.CSRF_TOKEN, cookies_1.clearCsrfCookieOptions);
            }
            const userId = req.user?.id ?? 'unknown';
            logger_1.logger.info(`Session ${sessionId} revoked for user ${userId}`);
            res.success({ message: 'Session revoked successfully' });
        }
        catch (error) {
            logger_1.logger.error('Failed to revoke session', { error: (0, errorHandler_1.getErrorMessage)(error) });
            res.error(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to revoke session'), undefined, 500);
        }
    }
    async verifyToken(req, res) {
        try {
            const user = req.user;
            if (!user) {
                throw new Error('User not found in request');
            }
            res.success({
                valid: true,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role,
                },
            });
        }
        catch (error) {
            res.error(api_1.ApiErrorCode.UNAUTHORIZED, (0, errorHandler_1.getErrorMessage)(error, 'Token verification failed'), undefined, 401);
        }
    }
    async refreshAccessToken(req, res) {
        return this.refresh(req, res);
    }
    async revokeAllSessions(req, res) {
        return this.logoutAll(req, res);
    }
}
exports.AuthControllerV2 = AuthControllerV2;
//# sourceMappingURL=authController.js.map