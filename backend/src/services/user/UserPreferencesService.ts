import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import type { UserPreferences as StoredUserPreferences } from '../../types/models';
import { ForbiddenError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { getRoleName } from '../../utils/roleUtils';
import { domainEvents } from '../shared/DomainEventBus';

/**
 * Profile privacy settings stored under `User.preferences.privacy`.
 * Distinct from the legacy top-level `defaultVisibility`/`showOnlineStatus`/
 * `allowDirectMessages` fields exposed via {@link UserPreferencesService.updatePrivacyPreferences}.
 */
export type ProfilePrivacySettings = NonNullable<StoredUserPreferences['privacy']>;

/** Default values returned when a privacy field has not been explicitly set. */
export const PROFILE_PRIVACY_DEFAULTS: Required<ProfilePrivacySettings> = {
  profileVisibility: 'public',
  showEmail: false,
  showDiscord: false,
  showBio: true,
  showRsiInfo: true,
  showVerifiedBadge: true,
  showOrganizations: true,
  showPublicShips: true,
  showScStats: false,
  showActivity: true,
};

type ThemePreference = 'light' | 'dark' | 'auto';
type VisibilityPreference = 'public' | 'private' | 'friends';

/**
 * User preference data interface
 */
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
  organizationDeletionNotifications?: boolean; // Notifications for org deletion status changes
  customSettings?: Record<string, unknown>;
}

/**
 * Organization context data
 */
export interface OrganizationContext {
  activeOrgId?: string;
  roleInOrg?: string;
  joinedAt?: Date;
  permissions?: string[];
  isOwner?: boolean;
  isAdmin?: boolean;
}

interface ClearActiveOrganizationOptions {
  reason: 'manual_clear' | 'system_stale_membership';
  staleOrganizationId?: string;
  path?: string;
}

/**
 * User Preferences Service
 * Handles user preferences, settings, and organization context
 */
export class UserPreferencesService {
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly userOrgRepository = AppDataSource.getRepository(OrganizationMembership);

  private async persistActiveOrganizationClear(
    user: User,
    options: ClearActiveOrganizationOptions
  ): Promise<User> {
    const previousOrgId = user.activeOrgId ?? null;

    user.activeOrgId = undefined;
    (user as unknown as Record<string, unknown>).activeOrgChangedAt = new Date();

    const saved = await this.userRepository.save(user);

    if (previousOrgId) {
      domainEvents.emit('member:primary_org_cleared', {
        timestamp: new Date().toISOString(),
        userId: user.id,
        previousOrgId,
        reason: options.reason,
        ...(options.staleOrganizationId
          ? { staleOrganizationId: options.staleOrganizationId }
          : {}),
        ...(options.path ? { path: options.path } : {}),
      });
    }

    return saved;
  }

  // ==================== USER PREFERENCES ====================

  /**
   * Get user preferences
   * @param userId User ID
   * @returns User preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['preferences'],
    });

    return (
      (user as unknown as Record<string, unknown>)?.preferences || this.getDefaultPreferences()
    );
  }

  /**
   * Update user preferences
   * @param userId User ID
   * @param preferences Preferences to update
   * @returns Updated preferences
   */
  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>
  ): Promise<UserPreferences> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const currentPreferences =
      (user as unknown as Record<string, unknown>).preferences || this.getDefaultPreferences();
    const updatedPreferences = { ...currentPreferences, ...preferences };

    (user as unknown as Record<string, unknown>).preferences = updatedPreferences;
    await this.userRepository.save(user);

    return updatedPreferences;
  }

  /**
   * Reset preferences to defaults
   * @param userId User ID
   * @returns Default preferences
   */
  async resetPreferences(userId: string): Promise<UserPreferences> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const defaultPreferences = this.getDefaultPreferences();
    (user as unknown as Record<string, unknown>).preferences = defaultPreferences;
    await this.userRepository.save(user);

    return defaultPreferences;
  }

  /**
   * Get specific preference value
   * @param userId User ID
   * @param key Preference key
   * @returns Preference value
   */
  async getPreference<T = unknown>(
    userId: string,
    key: keyof UserPreferences
  ): Promise<T | undefined> {
    const preferences = await this.getUserPreferences(userId);
    return preferences[key] as T;
  }

  /**
   * Set specific preference value
   * @param userId User ID
   * @param key Preference key
   * @param value Preference value
   * @returns Updated preferences
   */
  async setPreference<T = unknown>(
    userId: string,
    key: keyof UserPreferences,
    value: T
  ): Promise<UserPreferences> {
    return this.updatePreferences(userId, { [key]: value });
  }

  // ==================== NOTIFICATION PREFERENCES ====================

  /**
   * Get notification preferences
   * @param userId User ID
   * @returns Notification preferences
   */
  async getNotificationPreferences(userId: string): Promise<{
    emailNotifications: boolean;
    pushNotifications: boolean;
    weeklyDigest: boolean;
    marketingEmails: boolean;
    organizationDeletionNotifications: boolean;
  }> {
    const preferences = await this.getUserPreferences(userId);

    return {
      emailNotifications: preferences.emailNotifications ?? true,
      pushNotifications: preferences.pushNotifications ?? true,
      weeklyDigest: preferences.weeklyDigest ?? true,
      marketingEmails: preferences.marketingEmails ?? false,
      organizationDeletionNotifications: preferences.organizationDeletionNotifications ?? true,
    };
  }

  /**
   * Update notification preferences
   * @param userId User ID
   * @param notificationSettings Notification settings to update
   * @returns Updated preferences
   */
  async updateNotificationPreferences(
    userId: string,
    notificationSettings: {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      weeklyDigest?: boolean;
      marketingEmails?: boolean;
      organizationDeletionNotifications?: boolean;
    }
  ): Promise<UserPreferences> {
    return this.updatePreferences(userId, notificationSettings);
  }

  // ==================== APPEARANCE PREFERENCES ====================

  /**
   * Get appearance preferences
   * @param userId User ID
   * @returns Appearance preferences
   */
  async getAppearancePreferences(userId: string): Promise<{
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    compactMode: boolean;
  }> {
    const preferences = await this.getUserPreferences(userId);

    return {
      theme: preferences.theme || 'auto',
      language: preferences.language || 'en',
      timezone: preferences.timezone || 'UTC',
      compactMode: preferences.compactMode ?? false,
    };
  }

  /**
   * Update appearance preferences
   * @param userId User ID
   * @param appearanceSettings Appearance settings to update
   * @returns Updated preferences
   */
  async updateAppearancePreferences(
    userId: string,
    appearanceSettings: {
      theme?: 'light' | 'dark' | 'auto';
      language?: string;
      timezone?: string;
      compactMode?: boolean;
    }
  ): Promise<UserPreferences> {
    return this.updatePreferences(userId, appearanceSettings);
  }

  // ==================== PRIVACY PREFERENCES ====================

  /**
   * Get privacy preferences
   * @param userId User ID
   * @returns Privacy preferences
   */
  async getPrivacyPreferences(userId: string): Promise<{
    defaultVisibility: 'public' | 'private' | 'friends';
    showOnlineStatus: boolean;
    allowDirectMessages: boolean;
  }> {
    const preferences = await this.getUserPreferences(userId);

    return {
      defaultVisibility: preferences.defaultVisibility || 'public',
      showOnlineStatus: preferences.showOnlineStatus ?? true,
      allowDirectMessages: preferences.allowDirectMessages ?? true,
    };
  }

  /**
   * Update privacy preferences
   * @param userId User ID
   * @param privacySettings Privacy settings to update
   * @returns Updated preferences
   */
  async updatePrivacyPreferences(
    userId: string,
    privacySettings: {
      defaultVisibility?: 'public' | 'private' | 'friends';
      showOnlineStatus?: boolean;
      allowDirectMessages?: boolean;
    }
  ): Promise<UserPreferences> {
    return this.updatePreferences(userId, privacySettings);
  }

  // ==================== PROFILE PRIVACY (preferences.privacy) ====================

  /**
   * Get the resolved profile-privacy settings for a user, applying
   * {@link PROFILE_PRIVACY_DEFAULTS} for any field the user has not set.
   *
   * Stored under `User.preferences.privacy` (nested in the `simple-json` column).
   */
  async getProfilePrivacy(userId: string): Promise<Required<ProfilePrivacySettings>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const stored = user?.preferences?.privacy ?? {};
    return { ...PROFILE_PRIVACY_DEFAULTS, ...stored };
  }

  /**
   * Apply a partial update to `User.preferences.privacy` and persist it.
   *
   * Implementation notes:
   * - We use entity `save()` (not `userRepository.update()`) so TypeORM runs the
   *   `simple-json` column transformer for the nested `preferences` value.
   * - We reassign `user.preferences` to a brand-new object reference so change
   *   detection picks the write up.
   * - We re-read the row after save so the returned value is the canonical
   *   persisted state, eliminating drift between this response and any
   *   subsequent GET that the caller may issue after cache invalidation.
   *
   * @throws Error('User not found') if the user does not exist.
   */
  async updateProfilePrivacy(
    userId: string,
    patch: Partial<ProfilePrivacySettings>
  ): Promise<Required<ProfilePrivacySettings>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const currentPrivacy: ProfilePrivacySettings = user.preferences?.privacy ?? {};
    const updatedPrivacy: ProfilePrivacySettings = { ...currentPrivacy, ...patch };

    user.preferences = user.preferences
      ? { ...user.preferences, privacy: updatedPrivacy }
      : { privacy: updatedPrivacy };
    await this.userRepository.save(user);

    const persisted = await this.userRepository.findOne({ where: { id: userId } });
    const persistedPrivacy = persisted?.preferences?.privacy ?? updatedPrivacy;
    return { ...PROFILE_PRIVACY_DEFAULTS, ...persistedPrivacy };
  }

  // ==================== ORGANIZATION CONTEXT ====================

  /**
   * Get active organization context
   * @param userId User ID
   * @returns Organization context or null if no active org or user is not a member
   */
  async getActiveOrganizationContext(userId: string): Promise<OrganizationContext | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['activeOrgId', 'username'],
    });

    if (!user?.activeOrgId) {
      return null;
    }

    // Verify user is member of the organization
    const membership = await this.userOrgRepository.findOne({
      where: { userId, organizationId: user.activeOrgId, isActive: true },
    });

    if (!membership) {
      // Audit log unauthorized attempt to access organization context
      logAuditEvent({
        eventType: AuditEventType.AUTHZ_FAILURE,
        userId,
        username: user.username,
        resource: `organization/${user.activeOrgId}`,
        action: 'GET_ACTIVE_ORGANIZATION_CONTEXT',
        message: `User ${user.username} attempted to access context for organization ${user.activeOrgId} without being a member`,
        metadata: {
          userId,
          organizationId: user.activeOrgId,
          attemptedAction: 'getActiveOrganizationContext',
        },
      });

      // Return null instead of throwing error to maintain backwards compatibility
      // The user may have been removed from org but still has it set as active
      return null;
    }

    // Return actual context from membership table
    return {
      activeOrgId: user.activeOrgId,
      roleInOrg: getRoleName(membership.role) || 'member',
      joinedAt: membership.joinedAt,
      permissions: membership.permissions || [],
      isOwner:
        getRoleName(membership.role) === 'owner' || getRoleName(membership.role) === 'founder',
      isAdmin:
        getRoleName(membership.role) === 'admin' ||
        getRoleName(membership.role) === 'owner' ||
        getRoleName(membership.role) === 'founder',
    };
  }

  /**
   * Set active organization
   * @param userId User ID
   * @param organizationId Organization ID to set as active
   * @returns Updated user
   */
  async setActiveOrganization(userId: string, organizationId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    // Prevent founders/owners from switching away from their primary org
    if (user.activeOrgId && user.activeOrgId !== organizationId) {
      const currentMembership = await this.userOrgRepository.findOne({
        where: { userId, organizationId: user.activeOrgId, isActive: true },
      });
      if (currentMembership) {
        const currentRole = getRoleName(currentMembership.role);
        if (currentRole === 'founder' || currentRole === 'owner') {
          throw new ForbiddenError(
            'Organization founders and owners cannot switch their primary organization'
          );
        }
      }
    }

    // Verify user is member of the organization
    const membership = await this.userOrgRepository.findOne({
      where: { userId, organizationId, isActive: true },
    });

    if (!membership) {
      // Audit log unauthorized attempt
      logAuditEvent({
        eventType: AuditEventType.AUTHZ_FAILURE,
        userId,
        username: user.username,
        resource: `organization/${organizationId}`,
        action: 'SET_ACTIVE_ORGANIZATION',
        message: `User ${user.username} attempted to set active organization ${organizationId} without being a member`,
        metadata: {
          userId,
          organizationId,
          attemptedAction: 'setActiveOrganization',
        },
      });

      throw new ForbiddenError('You are not a member of this organization');
    }

    const previousOrgId = user.activeOrgId ?? null;

    user.activeOrgId = organizationId;
    (user as unknown as Record<string, unknown>).activeOrgChangedAt = new Date();

    const saved = await this.userRepository.save(user);

    // Wave 2.1 — emit domain event for audit trail
    if (previousOrgId !== organizationId) {
      domainEvents.emit('member:primary_org_switched', {
        timestamp: new Date().toISOString(),
        userId,
        previousOrgId,
        newOrgId: organizationId,
      });
    }

    return saved;
  }

  /**
   * Clear active organization
   * @param userId User ID
   * @returns Updated user
   */
  async clearActiveOrganization(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    return this.persistActiveOrganizationClear(user, { reason: 'manual_clear' });
  }

  /**
   * Clear an invalid active organization from an already loaded user.
   * Used by middleware repair paths when membership drift is detected.
   */
  async clearStaleActiveOrganization(
    user: User,
    context?: { staleOrganizationId?: string; path?: string }
  ): Promise<User> {
    return this.persistActiveOrganizationClear(user, {
      reason: 'system_stale_membership',
      ...(context?.staleOrganizationId ? { staleOrganizationId: context.staleOrganizationId } : {}),
      ...(context?.path ? { path: context.path } : {}),
    });
  }

  /**
   * Get organization switching history
   * @param userId User ID
   * @param limit Number of recent switches to return
   * @returns Array of recent organization switches
   */
  async getOrganizationSwitchHistory(
    userId: string,
    _limit: number = 10
  ): Promise<
    Array<{
      organizationId: string;
      switchedAt: Date;
      previousOrgId?: string;
    }>
  > {
    // This would typically be stored in a separate table
    // For now, we'll return empty array
    return [];
  }

  // ==================== CUSTOM SETTINGS ====================

  /**
   * Get custom setting value
   * @param userId User ID
   * @param key Setting key
   * @returns Setting value
   */
  async getCustomSetting<T = unknown>(userId: string, key: string): Promise<T | undefined> {
    const preferences = await this.getUserPreferences(userId);
    return preferences.customSettings?.[key] as T;
  }

  /**
   * Set custom setting value
   * @param userId User ID
   * @param key Setting key
   * @param value Setting value
   * @returns Updated preferences
   */
  async setCustomSetting<T = unknown>(
    userId: string,
    key: string,
    value: T
  ): Promise<UserPreferences> {
    const preferences = await this.getUserPreferences(userId);
    const customSettings = preferences.customSettings || {};
    customSettings[key] = value;

    return this.updatePreferences(userId, { customSettings });
  }

  /**
   * Delete custom setting
   * @param userId User ID
   * @param key Setting key
   * @returns Updated preferences
   */
  async deleteCustomSetting(userId: string, key: string): Promise<UserPreferences> {
    const preferences = await this.getUserPreferences(userId);
    const customSettings = preferences.customSettings || {};
    delete customSettings[key];

    return this.updatePreferences(userId, { customSettings });
  }

  /**
   * Get all custom settings
   * @param userId User ID
   * @returns Custom settings object
   */
  async getAllCustomSettings(userId: string): Promise<Record<string, unknown>> {
    const preferences = await this.getUserPreferences(userId);
    return preferences.customSettings || {};
  }

  // ==================== ACTIVITY PREFERENCES ====================

  /**
   * Get activity preferences
   * @param userId User ID
   * @returns Activity preferences
   */
  async getActivityPreferences(userId: string): Promise<{
    autoJoinVoice: boolean;
    defaultVisibility: 'public' | 'private' | 'friends';
  }> {
    const preferences = await this.getUserPreferences(userId);

    return {
      autoJoinVoice: preferences.autoJoinVoice ?? false,
      defaultVisibility: preferences.defaultVisibility || 'public',
    };
  }

  /**
   * Update activity preferences
   * @param userId User ID
   * @param activitySettings Activity settings to update
   * @returns Updated preferences
   */
  async updateActivityPreferences(
    userId: string,
    activitySettings: {
      autoJoinVoice?: boolean;
      defaultVisibility?: 'public' | 'private' | 'friends';
    }
  ): Promise<UserPreferences> {
    return this.updatePreferences(userId, activitySettings);
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get default user preferences
   * @returns Default preferences object
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'auto',
      language: 'en',
      timezone: 'UTC',
      emailNotifications: true,
      pushNotifications: true,
      weeklyDigest: true,
      marketingEmails: false,
      autoJoinVoice: false,
      defaultVisibility: 'public',
      compactMode: false,
      showOnlineStatus: true,
      allowDirectMessages: true,
      organizationDeletionNotifications: true,
      customSettings: {},
    };
  }

  /**
   * Validate preferences object
   * @param preferences Preferences to validate
   * @returns Validation result
   */
  validatePreferences(preferences: Partial<UserPreferences>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (preferences.theme && !['light', 'dark', 'auto'].includes(preferences.theme)) {
      errors.push('Invalid theme value');
    }

    if (
      preferences.defaultVisibility &&
      !['public', 'private', 'friends'].includes(preferences.defaultVisibility)
    ) {
      errors.push('Invalid default visibility value');
    }

    if (preferences.language && typeof preferences.language !== 'string') {
      errors.push('Language must be a string');
    }

    if (preferences.timezone && typeof preferences.timezone !== 'string') {
      errors.push('Timezone must be a string');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Export user preferences for data portability
   * @param userId User ID
   * @returns Exported preferences data
   */
  async exportPreferences(userId: string): Promise<{
    userId: string;
    preferences: UserPreferences;
    exportedAt: Date;
  }> {
    const preferences = await this.getUserPreferences(userId);

    return {
      userId,
      preferences,
      exportedAt: new Date(),
    };
  }

  /**
   * Import user preferences from backup
   * @param userId User ID
   * @param preferences Preferences to import
   * @returns Updated preferences
   */
  async importPreferences(userId: string, preferences: UserPreferences): Promise<UserPreferences> {
    const validation = this.validatePreferences(preferences);
    if (!validation.valid) {
      throw new Error(`Invalid preferences: ${validation.errors.join(', ')}`);
    }

    return this.updatePreferences(userId, preferences);
  }
}

