export interface GoogleTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    id_token?: string;
}
export interface GoogleUserInfo {
    id: string;
    email: string;
    verified_email: boolean;
    name: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
}
export declare class GoogleOAuthService {
    private readonly clientId;
    private readonly clientSecret;
    private readonly redirectUri;
    constructor();
    isConfigured(): boolean;
    generateAuthUrl(state: string): string;
    authenticateUser(code: string, redirectUri?: string): Promise<GoogleTokenResponse>;
    getUserInfo(accessToken: string): Promise<GoogleUserInfo>;
}
export declare function getGoogleOAuthService(): GoogleOAuthService;
export declare function isGoogleOAuthConfigured(): boolean;
//# sourceMappingURL=GoogleOAuthService.d.ts.map