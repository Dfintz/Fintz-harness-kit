import { User } from '../../models/User';
import type { UserPreferences as StoredUserPreferences } from '../../types/models';
export type ProfilePrivacySettings = NonNullable<StoredUserPreferences['privacy']>;
export declare const PROFILE_PRIVACY_DEFAULTS: Required<ProfilePrivacySettings>;
type ThemePreference = 'light' | 'dark' | 'auto';
type VisibilityPreference = 'public' | 'private' | 'friends';
export interface UserPreferences {
    theme?: ThemePreference;
    language?: string;
    timezone?: string;
    emailNotifications?: boolean;
    pushNotifications?: boolean;
    weeklyDigest?: boolean;
    marketingEmails?: boolean;
    autoJoinVoice?: boolean;
    defaultVisibility?: VisibilityPreference;
    compactMode?: boolean;
    showOnlineStatus?: boolean;
    allowDirectMessages?: boolean;
    organizationDeletionNotifications?: boolean;
    customSettings?: Record<string, unknown>;
}
export interface OrganizationContext {
    activeOrgId?: string;
    roleInOrg?: string;
    joinedAt?: Date;
    permissions?: string[];
    isOwner?: boolean;
    isAdmin?: boolean;
}
export declare class UserPreferencesService {
    private readonly userRepository;
    private readonly userOrgRepository;
    private persistActiveOrganizationClear;
    getUserPreferences(userId: string): Promise<UserPreferences>;
    updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences>;
    resetPreferences(userId: string): Promise<UserPreferences>;
    getPreference<T = unknown>(userId: string, key: keyof UserPreferences): Promise<T | undefined>;
    setPreference<T = unknown>(userId: string, key: keyof UserPreferences, value: T): Promise<UserPreferences>;
    getNotificationPreferences(userId: string): Promise<{
        emailNotifications: boolean;
        pushNotifications: boolean;
        weeklyDigest: boolean;
        marketingEmails: boolean;
        organizationDeletionNotifications: boolean;
    }>;
    updateNotificationPreferences(userId: string, notificationSettings: {
        emailNotifications?: boolean;
        pushNotifications?: boolean;
        weeklyDigest?: boolean;
        marketingEmails?: boolean;
        organizationDeletionNotifications?: boolean;
    }): Promise<UserPreferences>;
    getAppearancePreferences(userId: string): Promise<{
        theme: 'light' | 'dark' | 'auto';
        language: string;
        timezone: string;
        compactMode: boolean;
    }>;
    updateAppearancePreferences(userId: string, appearanceSettings: {
        theme?: 'light' | 'dark' | 'auto';
        language?: string;
        timezone?: string;
        compactMode?: boolean;
    }): Promise<UserPreferences>;
    getPrivacyPreferences(userId: string): Promise<{
        defaultVisibility: 'public' | 'private' | 'friends';
        showOnlineStatus: boolean;
        allowDirectMessages: boolean;
    }>;
    updatePrivacyPreferences(userId: string, privacySettings: {
        defaultVisibility?: 'public' | 'private' | 'friends';
        showOnlineStatus?: boolean;
        allowDirectMessages?: boolean;
    }): Promise<UserPreferences>;
    getProfilePrivacy(userId: string): Promise<Required<ProfilePrivacySettings>>;
    updateProfilePrivacy(userId: string, patch: Partial<ProfilePrivacySettings>): Promise<Required<ProfilePrivacySettings>>;
    getActiveOrganizationContext(userId: string): Promise<OrganizationContext | null>;
    setActiveOrganization(userId: string, organizationId: string): Promise<User>;
    clearActiveOrganization(userId: string): Promise<User>;
    clearStaleActiveOrganization(user: User, context?: {
        staleOrganizationId?: string;
        path?: string;
    }): Promise<User>;
    getOrganizationSwitchHistory(userId: string, _limit?: number): Promise<Array<{
        organizationId: string;
        switchedAt: Date;
        previousOrgId?: string;
    }>>;
    getCustomSetting<T = unknown>(userId: string, key: string): Promise<T | undefined>;
    setCustomSetting<T = unknown>(userId: string, key: string, value: T): Promise<UserPreferences>;
    deleteCustomSetting(userId: string, key: string): Promise<UserPreferences>;
    getAllCustomSettings(userId: string): Promise<Record<string, unknown>>;
    getActivityPreferences(userId: string): Promise<{
        autoJoinVoice: boolean;
        defaultVisibility: 'public' | 'private' | 'friends';
    }>;
    updateActivityPreferences(userId: string, activitySettings: {
        autoJoinVoice?: boolean;
        defaultVisibility?: 'public' | 'private' | 'friends';
    }): Promise<UserPreferences>;
    private getDefaultPreferences;
    validatePreferences(preferences: Partial<UserPreferences>): {
        valid: boolean;
        errors: string[];
    };
    exportPreferences(userId: string): Promise<{
        userId: string;
        preferences: UserPreferences;
        exportedAt: Date;
    }>;
    importPreferences(userId: string, preferences: UserPreferences): Promise<UserPreferences>;
}
export {};
//# sourceMappingURL=UserPreferencesService.d.ts.map