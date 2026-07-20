import { User } from '../../models/User';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { ActivityLogPayload, TimelineEvent, UserActivityService } from './UserActivityService';
import { UserAuthenticationService } from './UserAuthenticationService';
import { OrganizationContext, UserPreferences, UserPreferencesService } from './UserPreferencesService';
import { UserProfileService } from './UserProfileService';
import { UserSearchService } from './UserSearchService';
import { UserSocialService } from './UserSocialService';
interface SocialStats {
    friendCount: number;
    followerCount: number;
    followingCount: number;
    blockedCount: number;
    profileViews: number;
    recentActivityCount: number;
}
interface ProfileActivity {
    profileCompletion: number;
    lastProfileUpdate?: Date;
    activityCount: number;
}
interface UserSearchFilters {
    role?: string;
    isActive?: boolean;
    organizationId?: string;
    [key: string]: unknown;
}
interface UserSortOptions {
    field: string;
    direction: 'ASC' | 'DESC';
}
export declare class UserService {
    private static readonly SANDBOX_USERNAME_PREFIX;
    private static readonly SANDBOX_EMAIL_DOMAIN;
    private readonly userRepository;
    private readonly cache;
    private readonly activityService;
    private readonly authenticationService;
    private readonly profileService;
    private readonly preferencesService;
    private readonly searchService;
    private readonly socialService;
    constructor();
    validateUsersInOrganization(userIds: string[], organizationId: string): Promise<{
        valid: string[];
        invalid: string[];
    }>;
    getUserById(userId: string, options?: {
        includeProfile?: boolean;
        includePreferences?: boolean;
        includeSocialStats?: boolean;
    }): Promise<User | null>;
    getUserByUsername(username: string): Promise<User | null>;
    getUserByEmail(email: string): Promise<User | null>;
    getUserByDiscordId(discordId: string): Promise<User | null>;
    getUserByGoogleId(googleId: string): Promise<User | null>;
    getUserByTwitchId(twitchId: string): Promise<User | null>;
    createUser(userData: Partial<User>): Promise<User>;
    createSandboxUser(options?: {
        usernamePrefix?: string;
        emailDomain?: string;
        ipAddress?: string;
    }): Promise<User>;
    private normalizeSandboxUsernamePrefix;
    private normalizeSandboxEmailDomain;
    updateUser(userId: string, userData: Partial<User>, updateType?: 'profile' | 'auth' | 'general'): Promise<User>;
    deleteUser(userId: string, performedBy: string, reason?: string): Promise<void>;
    listUsers(filters?: UserSearchFilters, pagination?: PaginationOptions, sort?: UserSortOptions): Promise<PaginatedResponse<User>>;
    searchUsers(query?: string, filters?: UserSearchFilters, pagination?: PaginationOptions): Promise<PaginatedResponse<User>>;
    validateCredentials(username: string, password: string): Promise<User | null>;
    updatePassword(userId: string, oldPassword: string, newPassword: string): Promise<void>;
    setPassword(userId: string, password: string): Promise<void>;
    recordLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void>;
    getUserProfile(userId: string): Promise<User | null>;
    updateProfile(userId: string, profileData: Partial<User>): Promise<User>;
    updateEmail(userId: string, newEmail: string): Promise<User>;
    updateUsername(userId: string, newUsername: string): Promise<User>;
    isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean>;
    isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean>;
    getUserPreferences(userId: string): Promise<UserPreferences>;
    updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<{
        preferences: UserPreferences;
    }>;
    setActiveOrganization(userId: string, organizationId: string): Promise<User>;
    getSocialStats(userId: string): Promise<SocialStats>;
    sendFriendRequest(userId: string, targetUserId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    getRelationshipStatus(userId: string, targetUserId: string): Promise<{
        status: string;
        type?: string;
    }>;
    getUserDashboard(userId: string): Promise<{
        user: User;
        profileCompletion: number;
        preferences: UserPreferences;
        socialStats: SocialStats;
        recentActivity: TimelineEvent[];
        activityStreak: number;
        organizationContext: OrganizationContext | null;
    }>;
    exportUserData(userId: string): Promise<{
        user: User;
        profile: ProfileActivity;
        preferences: UserPreferences;
        socialData: SocialStats;
        activities: ActivityLogPayload[];
        exportedAt: Date;
    }>;
    getUserStatistics(userId: string): Promise<{
        basicInfo: Pick<User, 'id' | 'username' | 'email' | 'role' | 'createdAt'>;
        activityStats: {
            totalActivities: number;
            recentActivities: number;
            activityStreak: number;
            profileCompletion: number;
            lastProfileUpdate: Date | null;
            profileViews: number;
        };
        socialStats: SocialStats;
        securityInfo: {
            lastLogin?: Date;
            twoFactorEnabled: boolean;
            loginAttempts: number;
            hasPassword: boolean;
            emailVerified: boolean;
        };
        organizationInfo: OrganizationContext | null;
    }>;
    bulkUpdateRoles(userIds: string[], newRole: string, performedBy: string): Promise<number>;
    getUsersByRole(role: string | string[], pagination?: PaginationOptions): Promise<PaginatedResponse<User>>;
    getAuthenticationService(): UserAuthenticationService;
    getProfileService(): UserProfileService;
    getPreferencesService(): UserPreferencesService;
    getSearchService(): UserSearchService;
    getSocialService(): UserSocialService;
    getActivityService(): UserActivityService;
    getUserActivityTimeline(userId: string, days?: number, limit?: number): Promise<{
        timeline: TimelineEvent[];
        summary: {
            totalEvents: number;
            byCategory: Record<string, number>;
            firstActivity: Date | null;
            lastActivity: Date | null;
            streak: number;
        };
    }>;
    getUserActivityHeatmap(userId: string, months?: number): Promise<Array<{
        date: string;
        count: number;
    }>>;
    validateUserData(userData: Partial<User>): {
        valid: boolean;
        errors: string[];
    };
    userExists(userId: string): Promise<boolean>;
    getUserCount(filters?: UserSearchFilters): Promise<number>;
}
export {};
//# sourceMappingURL=UserService.d.ts.map