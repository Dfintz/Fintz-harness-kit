import { CookieOptions } from 'express';
export declare const accessTokenCookieOptions: CookieOptions;
export declare function getAccessTokenCookieOptions(accessToken: string): CookieOptions;
export declare const refreshTokenCookieOptions: CookieOptions;
export declare const csrfTokenCookieOptions: CookieOptions;
export declare const pkceCookieOptions: CookieOptions;
export declare const COOKIE_NAMES: {
    readonly ACCESS_TOKEN: "access_token";
    readonly REFRESH_TOKEN: "refresh_token";
    readonly CSRF_TOKEN: "csrf_token";
    readonly DISCORD_PKCE_VERIFIER: "discord_pkce_verifier";
    readonly MOBILE_REDIRECT: "mobile_redirect";
};
export declare const clearCookieOptions: CookieOptions;
export declare const clearRefreshCookieOptions: CookieOptions;
export declare const clearCsrfCookieOptions: CookieOptions;
//# sourceMappingURL=cookies.d.ts.map