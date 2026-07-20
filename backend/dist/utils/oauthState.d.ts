export declare function getOAuthSecret(): string;
export interface OAuthStateResult {
    valid: boolean;
    linkUserId?: string;
}
export declare function generateOAuthState(linkUserId?: string): string;
export declare function validateOAuthState(state: string | undefined): OAuthStateResult;
//# sourceMappingURL=oauthState.d.ts.map