import { User } from '../../models/User';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
export interface UserSearchFilters {
    username?: string;
    email?: string;
    role?: string | string[];
    discordId?: string;
    activeOrgId?: string;
    createdAfter?: Date;
    createdBefore?: Date;
    updatedAfter?: Date;
    updatedBefore?: Date;
    hasAvatar?: boolean;
    emailVerified?: boolean;
    isOnline?: boolean;
    organizationId?: string;
    memberOfOrg?: string;
    excludeIds?: string[];
}
export interface UserSortOptions {
    field?: 'username' | 'email' | 'role' | 'createdAt' | 'updatedAt' | 'lastLoginAt';
    order?: 'ASC' | 'DESC';
}
export interface UserSearchResult extends User {
    relevanceScore?: number;
    matchedFields?: string[];
    organizationInfo?: {
        isInSameOrg: boolean;
        sharedOrganizations: string[];
    };
}
export declare class UserSearchService {
    private readonly userRepository;
    searchUsers(query?: string, filters?: UserSearchFilters, pagination?: PaginationOptions, sort?: UserSortOptions): Promise<PaginatedResponse<UserSearchResult>>;
    findUsersByUsername(usernamePattern: string, limit?: number): Promise<User[]>;
    findUsersByEmail(emailPattern: string, limit?: number): Promise<User[]>;
    searchUsersAdvanced(query: string, contextUserId?: string, filters?: UserSearchFilters, pagination?: PaginationOptions): Promise<PaginatedResponse<UserSearchResult>>;
    findSimilarUsers(userId: string, limit?: number): Promise<UserSearchResult[]>;
    getRecentlyJoinedUsers(limit?: number, activeOrgId?: string): Promise<User[]>;
    getMostActiveUsers(limit?: number, activeOrgId?: string): Promise<User[]>;
    getUsersByRole(role: string | string[], searchQuery?: string, pagination?: PaginationOptions): Promise<PaginatedResponse<User>>;
    searchUsersInOrganization(organizationId: string, query?: string, pagination?: PaginationOptions): Promise<PaginatedResponse<User>>;
    findUnaffiliatedUsers(query?: string, pagination?: PaginationOptions): Promise<PaginatedResponse<User>>;
    private applyFilters;
    private buildRelevanceScore;
    private addSearchMetadata;
    private enhanceSearchResults;
    private getMatchedFields;
    private calculateRelevanceScore;
    getUsernameSuggestions(prefix: string, limit?: number, excludeIds?: string[]): Promise<string[]>;
    getSearchSuggestions(input: string, limit?: number): Promise<Array<{
        type: 'username' | 'email' | 'displayName';
        value: string;
        userId: string;
    }>>;
    browseCommunityMembers(requestingUserId: string, params: {
        search?: string;
        page?: number;
        limit?: number;
        sortBy?: 'createdAt' | 'username' | 'displayName';
        sortOrder?: 'ASC' | 'DESC';
        rsiVerifiedOnly?: boolean;
        hasOrganization?: boolean;
    }): Promise<PaginatedResponse<Record<string, unknown>>>;
}
//# sourceMappingURL=UserSearchService.d.ts.map