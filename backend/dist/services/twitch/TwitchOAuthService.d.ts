export interface TwitchTokenResponse {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
    scope: string[];
}
export interface TwitchUserInfo {
    id: string;
    login: string;
    display_name: string;
    email?: string;
    profile_image_url?: string;
    type: string;
    broadcaster_type: string;
}
export declare class TwitchOAuthService {
    private readonly clientId;
    private readonly clientSecret;
    private readonly redirectUri;
    constructor();
    isConfigured(): boolean;
    generateAuthUrl(state: string): string;
    authenticateUser(code: string, redirectUri?: string): Promise<TwitchTokenResponse>;
    getUserInfo(accessToken: string): Promise<TwitchUserInfo>;
}
export declare function getTwitchOAuthService(): TwitchOAuthService;
export declare function isTwitchOAuthConfigured(): boolean;
//# sourceMappingURL=TwitchOAuthService.d.ts.map