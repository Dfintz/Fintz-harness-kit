"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitchOAuthService = void 0;
exports.getTwitchOAuthService = getTwitchOAuthService;
exports.isTwitchOAuthConfigured = isTwitchOAuthConfigured;
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const urls_1 = require("../../config/urls");
class TwitchOAuthService {
    clientId;
    clientSecret;
    redirectUri;
    constructor() {
        this.clientId = process.env.TWITCH_CLIENT_ID || '';
        this.clientSecret = process.env.TWITCH_CLIENT_SECRET || '';
        this.redirectUri =
            process.env.TWITCH_REDIRECT_URI_BACKEND || `${(0, urls_1.getBackendUrl)()}/api/v2/auth/twitch/callback`;
    }
    isConfigured() {
        return Boolean(this.clientId && this.clientSecret && this.redirectUri);
    }
    generateAuthUrl(state) {
        if (!state) {
            throw new Error('State parameter is required for CSRF protection');
        }
        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            response_type: 'code',
            scope: 'user:read:email',
            state,
            force_verify: 'true',
        });
        return `https://id.twitch.tv/oauth2/authorize?${params.toString()}`;
    }
    async authenticateUser(code, redirectUri) {
        if (!code) {
            throw new Error('Authorization code is required');
        }
        const effectiveRedirectUri = redirectUri || this.redirectUri;
        logger_1.logger.debug('Twitch OAuth token exchange starting', { redirectUri: effectiveRedirectUri });
        try {
            const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    client_secret: this.clientSecret,
                    grant_type: 'authorization_code',
                    code,
                    redirect_uri: effectiveRedirectUri,
                }),
            });
            if (!tokenResponse.ok) {
                const raw = await tokenResponse.text();
                let errorData = {};
                try {
                    errorData = raw ? JSON.parse(raw) : {};
                }
                catch {
                    errorData = { rawError: raw };
                }
                const errorDescription = errorData.message || errorData.error || tokenResponse.statusText;
                logger_1.logger.error('Twitch authentication failed', {
                    status: tokenResponse.status,
                    error: errorData.error,
                    errorDescription,
                });
                throw new Error(`Twitch authentication failed: ${tokenResponse.status} - ${errorDescription}`);
            }
            return (await tokenResponse.json());
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith('Twitch authentication failed')) {
                throw error;
            }
            logger_1.logger.error('Twitch authentication error:', error);
            throw new Error(`Failed to authenticate user via Twitch: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
    }
    async getUserInfo(accessToken) {
        if (!accessToken) {
            throw new Error('Access token is required');
        }
        try {
            const userResponse = await fetch('https://api.twitch.tv/helix/users', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Client-Id': this.clientId,
                },
            });
            if (!userResponse.ok) {
                const errorData = (await userResponse.json().catch(() => ({})));
                throw new Error(`Failed to fetch Twitch user info: ${userResponse.status} - ${errorData.message || userResponse.statusText}`);
            }
            const body = (await userResponse.json());
            if (!body.data || body.data.length === 0) {
                throw new Error('Twitch API returned empty user data');
            }
            return body.data[0];
        }
        catch (error) {
            if (error instanceof Error &&
                (error.message.startsWith('Failed to fetch Twitch user info') ||
                    error.message.startsWith('Twitch API returned empty'))) {
                throw error;
            }
            logger_1.logger.error('Failed to fetch Twitch user info:', error);
            throw new Error(`Failed to fetch Twitch user info: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
    }
}
exports.TwitchOAuthService = TwitchOAuthService;
let twitchOAuthServiceInstance = null;
function getTwitchOAuthService() {
    twitchOAuthServiceInstance ??= new TwitchOAuthService();
    return twitchOAuthServiceInstance;
}
function isTwitchOAuthConfigured() {
    return getTwitchOAuthService().isConfigured();
}
//# sourceMappingURL=TwitchOAuthService.js.map