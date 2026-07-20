"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCsrfCookieOptions = exports.clearRefreshCookieOptions = exports.clearCookieOptions = exports.COOKIE_NAMES = exports.pkceCookieOptions = exports.csrfTokenCookieOptions = exports.refreshTokenCookieOptions = exports.accessTokenCookieOptions = void 0;
exports.getAccessTokenCookieOptions = getAccessTokenCookieOptions;
const _isProduction = process.env.NODE_ENV === 'production';
const isDev = process.env.NODE_ENV !== 'production';
function getAccessTokenMaxAgeMs() {
    if (isDev) {
        return 24 * 60 * 60 * 1000;
    }
    const raw = process.env.ACCESS_TOKEN_EXPIRY || '1h';
    const match = /^(\d+)([mhds])$/.exec(raw.trim());
    if (!match) {
        return 60 * 60 * 1000;
    }
    const value = Number.parseInt(match[1], 10);
    const unit = match[2];
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return value * (multipliers[unit] ?? 3_600_000);
}
function getJwtLifetimeMs(accessToken) {
    const segments = accessToken.split('.');
    if (segments.length < 2) {
        return null;
    }
    try {
        const payloadSegment = segments[1].replaceAll('-', '+').replaceAll('_', '/');
        const padded = payloadSegment.padEnd(payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4), '=');
        const decoded = Buffer.from(padded, 'base64').toString('utf-8');
        const payload = JSON.parse(decoded);
        if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
            return null;
        }
        const lifetimeMs = (payload.exp - payload.iat) * 1000;
        return lifetimeMs > 0 ? lifetimeMs : null;
    }
    catch {
        return null;
    }
}
function getCookieDomain() {
    if (process.env.COOKIE_DOMAIN) {
        return process.env.COOKIE_DOMAIN;
    }
    const corsOrigin = process.env.CORS_ORIGIN;
    if (corsOrigin && corsOrigin !== '*') {
        try {
            const firstOrigin = corsOrigin.split(',')[0].trim();
            const hostname = new URL(firstOrigin).hostname;
            if (hostname !== 'localhost' && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
                return `.${hostname}`;
            }
        }
        catch {
        }
    }
    return undefined;
}
exports.accessTokenCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
    maxAge: getAccessTokenMaxAgeMs(),
};
function getAccessTokenCookieOptions(accessToken) {
    const maxAge = getJwtLifetimeMs(accessToken) ?? getAccessTokenMaxAgeMs();
    return {
        ...exports.accessTokenCookieOptions,
        maxAge,
    };
}
exports.refreshTokenCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
};
exports.csrfTokenCookieOptions = {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
    maxAge: 24 * 60 * 60 * 1000,
};
exports.pkceCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
    maxAge: 10 * 60 * 1000,
};
exports.COOKIE_NAMES = {
    ACCESS_TOKEN: 'access_token',
    REFRESH_TOKEN: 'refresh_token',
    CSRF_TOKEN: 'csrf_token',
    DISCORD_PKCE_VERIFIER: 'discord_pkce_verifier',
    MOBILE_REDIRECT: 'mobile_redirect',
};
exports.clearCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
};
exports.clearRefreshCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
};
exports.clearCsrfCookieOptions = {
    httpOnly: false,
    secure: true,
    sameSite: 'lax',
    path: '/',
    domain: getCookieDomain(),
};
//# sourceMappingURL=cookies.js.map