import { User } from '../../models/User';
import { UserService } from '../user/UserService';
import { AuthenticationService } from './AuthenticationService';
export interface OAuthUserResolutionOpts {
    linkUserId?: string;
    accessToken?: string;
    providerName: string;
    providerId: string;
    providerIdField: string;
    email: string | undefined;
    username: string;
    displayName: string;
    avatar?: string;
    ipAddress?: string;
    lookupByProviderId: () => Promise<User | null>;
}
export type OAuthLinkResult = {
    tag: 'linked';
    user: User;
} | {
    tag: 'created';
    user: User;
} | {
    tag: 'duplicate_provider';
    providerId: string;
    targetUserId: string;
};
export declare class OAuthLinkingService {
    private readonly userService;
    private readonly authService;
    constructor(userService: UserService, authService: AuthenticationService);
    resolveExistingSessionUser(linkUserId?: string, accessToken?: string): Promise<User | null>;
    resolveOrCreateOAuthUser(opts: OAuthUserResolutionOpts): Promise<OAuthLinkResult>;
}
//# sourceMappingURL=OAuthLinkingService.d.ts.map