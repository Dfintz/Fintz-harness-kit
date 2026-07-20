"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleOAuthService = void 0;
exports.getGoogleOAuthService = getGoogleOAuthService;
exports.isGoogleOAuthConfigured = isGoogleOAuthConfigured;
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const urls_1 = require("../../config/urls");
class GoogleOAuthService {
    clientId;
    clientSecret;
    redirectUri;
    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID || '';
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
        this.redirectUri =
            process.env.GOOGLE_REDIRECT_URI_BACKEND || `${(0, urls_1.getBackendUrl)()}/api/v2/auth/google/callback`;
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
            scope: 'openid email profile',
            state,
            access_type: 'offline',
            prompt: 'consent',
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    async authenticateUser(code, redirectUri) {
        if (!code) {
            throw new Error('Authorization code is required');
        }
        const effectiveRedirectUri = redirectUri || this.redirectUri;
        logger_1.logger.debug('Google OAuth token exchange starting', { redirectUri: effectiveRedirectUri });
        try {
            const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
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
                const errorDescription = errorData.error_description || errorData.error || tokenResponse.statusText;
                logger_1.logger.error('Google authentication failed', {
                    status: tokenResponse.status,
                    error: errorData.error,
                    errorDescription,
                });
                throw new Error(`Google authentication failed: ${tokenResponse.status} - ${errorDescription}`);
            }
            return (await tokenResponse.json());
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith('Google authentication failed')) {
                throw error;
            }
            logger_1.logger.error('Google authentication error:', error);
            throw new Error(`Failed to authenticate user via Google: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
    }
    async getUserInfo(accessToken) {
        if (!accessToken) {
            throw new Error('Access token is required');
        }
        try {
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!userResponse.ok) {
                const errorData = (await userResponse.json().catch(() => ({})));
                throw new Error(`Failed to fetch Google user info: ${userResponse.status} - ${errorData.message || userResponse.statusText}`);
            }
            return (await userResponse.json());
        }
        catch (error) {
            if (error instanceof Error && error.message.startsWith('Failed to fetch Google user info')) {
                throw error;
            }
            logger_1.logger.error('Failed to fetch Google user info:', error);
            throw new Error(`Failed to fetch Google user info: ${(0, errorHandler_1.getErrorMessage)(error)}`);
        }
    }
}
exports.GoogleOAuthService = GoogleOAuthService;
let googleOAuthServiceInstance = null;
function getGoogleOAuthService() {
    googleOAuthServiceInstance ??= new GoogleOAuthService();
    return googleOAuthServiceInstance;
}
function isGoogleOAuthConfigured() {
    return getGoogleOAuthService().isConfigured();
}
//# sourceMappingURL=GoogleOAuthService.js.map