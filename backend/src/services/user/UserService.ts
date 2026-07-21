import crypto from 'node:crypto';

import NodeCache from 'node-cache';
import { In, Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { DatabaseError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { AuditCategory, auditService } from '../audit/AuditService';

// Import domain services
import { ActivityLogPayload, TimelineEvent, UserActivityService } from './UserActivityService';
import { UserAuthenticationService } from './UserAuthenticationService';
import {
  OrganizationContext,
  UserPreferences,
  UserPreferencesService,
} from './UserPreferencesService';
import { UserProfileService } from './UserProfileService';
import { UserSearchService } from './UserSearchService';
import { SocialActivityType, UserSocialService } from './UserSocialService';

// Constants for dashboard activity timeline
const DASHBOARD_TIMELINE_DAYS = 7;
const DASHBOARD_TIMELINE_LIMIT = 10;

/**
 * Social statistics interface
 */
interface SocialStats {
  friendCount: number;
  followerCount: number;
  followingCount: number;
  blockedCount: number;
  profileViews: number;
  recentActivityCount: number;
}

/**
 * Profile activity data
 */
interface ProfileActivity {
  profileCompletion: number;
  lastProfileUpdate?: Date;
  activityCount: number;
}

/**
 * Search filters interface
 */
interface UserSearchFilters {
  role?: string;
  isActive?: boolean;
  organizationId?: string;
  [key: string]: unknown;
}

/**
 * Sort options interface
 */
interface UserSortOptions {
  field: string;
  direction: 'ASC' | 'DESC';
}

/**
 * Core User Service
 * Handles basic CRUD operations and coordinates with domain-specific services
 * Follows the Domain-Driven Design pattern established in Phase 4.1 and 4.2
 */
export class UserService {
  private static readonly SANDBOX_USERNAME_PREFIX = 'sandbox';
  private static readonly SANDBOX_EMAIL_DOMAIN = 'sandbox.local';

  private readonly userRepository: Repository<User>;
  private readonly cache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: false });

  // Domain-specific services
  private readonly activityService = new UserActivityService();
  private readonly authenticationService = new UserAuthenticationService();
  private readonly profileService = new UserProfileService();
  private readonly preferencesService = new UserPreferencesService();
  private readonly searchService = new UserSearchService();
  private readonly socialService = new UserSocialService();

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
  }

  // ==================== ORGANIZATION MEMBERSHIP VALIDATION ====================

  /**
   * Validate that user IDs belong to a specific organization (M1: Org crew verification)
   * PERFORMANCE: Single batch query, O(n) memory for set lookup
   * MULTI-TENANT: Scoped by organizationId parameter
   *
   * @param userIds - Array of user IDs to validate
   * @param organizationId - Organization to check membership against
   * @returns Promise<{ valid: string[], invalid: string[] }>
   * @throws DatabaseError if query fails
   */
  public async validateUsersInOrganization(
    userIds: string[],
    organizationId: string
  ): Promise<{ valid: string[]; invalid: string[] }> {
    // Handle empty input
    if (!userIds || userIds.length === 0) {
      return { valid: [], invalid: [] };
    }

    try {
      // Single database query: fetch all org members matching user IDs
      // Index: organization_memberships(organization_id, user_id)
      const members = await AppDataSource.getRepository(OrganizationMembership).find({
        where: {
          organizationId,
          userId: In(userIds),
        },
        select: ['userId'],
      });

      // Build set for O(1) lookup
      const validIds = new Set(members.map(m => m.userId));

      // Identify invalid IDs
      const invalid = userIds.filter(id => !validIds.has(id));

      return {
        valid: Array.from(validIds),
        invalid,
      };
    } catch (error) {
      logger.error('Failed to validate users in organization', {
        organizationId,
        userCount: userIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new DatabaseError('Failed to verify crew membership');
    }
  }

  // ==================== CORE CRUD OPERATIONS ====================

  /**
   * Get user by ID
   * @param userId User ID
   * @param includeProfile Include profile data
   * @param includePreferences Include user preferences
   * @param includeSocialStats Include social statistics
   * @returns User or null
   */
  async getUserById(
    userId: string,
    options?: {
      includeProfile?: boolean;
      includePreferences?: boolean;
      includeSocialStats?: boolean;
    }
  ): Promise<User | null> {
    // Use cache for simple lookups (no options)
    const hasOptions = options && Object.values(options).some(Boolean);
    if (!hasOptions) {
      const cached = this.cache.get<User>(`user:${userId}`);
      if (cached) {
        return cached;
      }
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      return null;
    }

    // Cache simple lookups
    if (!hasOptions) {
      this.cache.set(`user:${userId}`, user);
    }

    // Enhance with domain data if requested
    if (options?.includeProfile) {
      const profileData = await this.profileService.getProfileActivity(userId);
      // @ts-expect-error - Dynamic property assignment for enhanced user data
      user.profileData = profileData;
    }

    if (options?.includePreferences) {
      const preferences = await this.preferencesService.getUserPreferences(userId);
      user.preferences = preferences;
    }

    if (options?.includeSocialStats) {
      const socialStats = await this.socialService.getSocialStats(userId);
      // @ts-expect-error - Dynamic property assignment for enhanced user data
      user.socialStats = socialStats;
    }

    return user;
  }

  /**
   * Get user by username
   * @param username Username
   * @returns User or null
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { username } });
    return user || null;
  }

  /**
   * Get user by email
   * @param email Email address
   * @returns User or null
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.profileService.getUserByEmail(email);
  }

  /**
   * Get user by Discord ID
   * @param discordId Discord ID
   * @returns User or null
   */
  async getUserByDiscordId(discordId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { discordId } });
    return user || null;
  }

  /**
   * Get user by Google ID
   * @param googleId Google account ID
   * @returns User or null
   */
  async getUserByGoogleId(googleId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { googleId } });
    return user || null;
  }

  /**
   * Get user by Twitch ID
   * @param twitchId Twitch account ID
   * @returns User or null
   */
  async getUserByTwitchId(twitchId: string): Promise<User | null> {
    const user = await this.userRepository.findOne({ where: { twitchId } });
    return user || null;
  }

  /**
   * Create a new user
   * @param userData User data
   * @returns Created user
   */
  async createUser(userData: Partial<User>): Promise<User> {
    logger.info('Creating user', {
      username: userData.username,
      email: userData.email,
    });

    // Create user
    const user = this.userRepository.create(userData);
    const savedUser = await this.userRepository.save(user);

    // Initialize user preferences with defaults
    await this.preferencesService.resetPreferences(savedUser.id);

    // Log user creation activity
    await this.socialService.logSocialActivity({
      userId: savedUser.id,
      activityType: SocialActivityType.PROFILE_VIEW,
      description: 'User account created',
      isPublic: false,
    });

    // Emit audit log
    auditService.log({
      category: AuditCategory.USER,
      action: 'USER_CREATED',
      message: `User account created: ${savedUser.username}`,
      userId: savedUser.id,
      resource: `user/${savedUser.id}`,
      metadata: {
        username: savedUser.username,
        email: savedUser.email,
      },
    });

    return savedUser;
  }

  /**
   * Create a sandbox user account for production-safe trial sessions.
   * Credentials are generated server-side to prevent caller-controlled identity injection.
   */
  async createSandboxUser(options?: {
    usernamePrefix?: string;
    emailDomain?: string;
    ipAddress?: string;
  }): Promise<User> {
    const usernamePrefix = this.normalizeSandboxUsernamePrefix(options?.usernamePrefix);
    const emailDomain = this.normalizeSandboxEmailDomain(options?.emailDomain);

    const suffix = crypto.randomUUID().split('-')[0];
    const username = `${usernamePrefix}-${suffix}`;
    const email = `${username}@${emailDomain}`;

    return this.createUser({
      id: crypto.randomUUID(),
      username,
      email,
      role: 'user',
      discordId: `sandbox-${suffix}`,
      displayName: 'Sandbox User',
      lastLoginAt: new Date(),
      lastLoginIp: options?.ipAddress,
      loginCount: 1,
    });
  }

  private normalizeSandboxUsernamePrefix(rawPrefix?: string): string {
    const prefix =
      (rawPrefix ?? UserService.SANDBOX_USERNAME_PREFIX)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '') || UserService.SANDBOX_USERNAME_PREFIX;

    return prefix;
  }

  private normalizeSandboxEmailDomain(rawDomain?: string): string {
    const domain =
      (rawDomain ?? UserService.SANDBOX_EMAIL_DOMAIN)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '') || UserService.SANDBOX_EMAIL_DOMAIN;

    return domain;
  }

  /**
   * Update user information
   * @param userId User ID
   * @param userData User data to update
   * @param updateType Type of update (profile, auth, preferences)
   * @returns Updated user
   */
  async updateUser(
    userId: string,
    userData: Partial<User>,
    updateType: 'profile' | 'auth' | 'general' = 'general'
  ): Promise<User> {
    logger.info('Updating user', {
      userId,
      updateType,
      updateFields: Object.keys(userData),
    });

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Route updates to appropriate domain services
    switch (updateType) {
      case 'profile':
        return this.profileService.updateProfile(userId, userData);
      case 'auth':
        // Auth updates should go through authentication service
        throw new Error('Use authentication service for auth-related updates');
      default: {
        // Use targeted update to avoid stale-cache overwrites.
        // Multiple UserService instances each hold an independent NodeCache;
        // Object.assign + save would persist stale field values read from
        // another instance's cache (e.g. resetting twoFactorEnabled).
        // Convert undefined values to null for TypeORM update()
        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(userData)) {
          updateData[key] = value ?? null;
        }
        await this.userRepository.update(userId, updateData);
        this.cache.del(`user:${userId}`);
        // Return fresh entity from DB
        const updated = await this.userRepository.findOne({ where: { id: userId } });
        if (!updated) {
          throw new Error('User not found after update');
        }
        this.cache.set(`user:${userId}`, updated);

        // Emit audit log
        auditService.log({
          category: AuditCategory.USER,
          action: 'USER_UPDATED',
          message: `User account updated`,
          userId,
          resource: `user/${userId}`,
          metadata: {
            updateType,
            updateFields: Object.keys(userData),
          },
        });

        return updated;
      }
    }
  }

  /**
   * Delete user account
   * @param userId User ID
   * @param performedBy User performing the deletion
   * @param reason Reason for deletion
   */
  async deleteUser(userId: string, performedBy: string, reason?: string): Promise<void> {
    logger.info('Deleting user account', {
      userId,
      performedBy,
      reason,
    });

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    this.cache.del(`user:${userId}`);

    // Log deletion activity before removing
    await this.socialService.logSocialActivity({
      userId: performedBy,
      targetUserId: userId,
      activityType: SocialActivityType.PROFILE_VIEW,
      description: `User account deleted. Reason: ${reason || 'Not specified'}`,
      isPublic: false,
      metadata: { deletedUserId: userId, reason },
    });

    // Remove user
    await this.userRepository.remove(user);

    // Emit audit log (GDPR critical)
    auditService.log({
      category: AuditCategory.USER,
      action: 'USER_DELETED',
      message: `User account deleted: ${user.username}`,
      userId: performedBy,
      resource: `user/${userId}`,
      metadata: {
        deletedUserId: userId,
        deletedUsername: user.username,
        deletedEmail: user.email,
        reason: reason || 'Not specified',
      },
    });
  }

  /**
   * List users with filtering and pagination
   * @param filters Search filters
   * @param pagination Pagination options
   * @param sort Sort options
   * @returns Paginated users
   */
  async listUsers(
    filters?: UserSearchFilters,
    pagination?: PaginationOptions,
    sort?: UserSortOptions
  ): Promise<PaginatedResponse<User>> {
    // @ts-expect-error - Type import mismatch between service files
    return this.searchService.searchUsers(undefined, filters, pagination, sort);
  }

  /**
   * Search users
   * @param query Search query
   * @param filters Search filters
   * @param pagination Pagination options
   * @returns Search results
   */
  async searchUsers(
    query?: string,
    filters?: UserSearchFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<User>> {
    return this.searchService.searchUsers(query, filters, pagination);
  }

  // ==================== AUTHENTICATION DELEGATION ====================

  /**
   * Validate user credentials
   * @param username Username
   * @param password Password
   * @returns User if valid, null otherwise
   */
  async validateCredentials(username: string, password: string): Promise<User | null> {
    return this.authenticationService.validateCredentials(username, password);
  }

  /**
   * Update user password
   * @param userId User ID
   * @param oldPassword Current password
   * @param newPassword New password
   */
  async updatePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    await this.authenticationService.updatePassword(userId, oldPassword, newPassword);
    await this.authenticationService.updatePasswordChangedAt(userId);
  }

  /**
   * Set user password (for new users or password reset)
   * @param userId User ID
   * @param password New password
   */
  async setPassword(userId: string, password: string): Promise<void> {
    await this.authenticationService.setPassword(userId, password);
    await this.authenticationService.updatePasswordChangedAt(userId);
  }

  /**
   * Record user login
   * @param userId User ID
   * @param ipAddress IP address
   * @param userAgent User agent
   */
  async recordLogin(userId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.authenticationService.recordLogin(userId, ipAddress, userAgent);
  }

  // ==================== PROFILE DELEGATION ====================

  /**
   * Get user profile
   * @param userId User ID
   * @returns User profile
   */
  async getUserProfile(userId: string): Promise<User | null> {
    return this.profileService.getUserProfile(userId);
  }

  /**
   * Update user profile
   * @param userId User ID
   * @param profileData Profile data
   * @returns Updated user
   */
  async updateProfile(userId: string, profileData: Partial<User>): Promise<User> {
    return this.profileService.updateProfile(userId, profileData);
  }

  /**
   * Update user email
   * @param userId User ID
   * @param newEmail New email
   * @returns Updated user
   */
  async updateEmail(userId: string, newEmail: string): Promise<User> {
    return this.profileService.updateEmail(userId, newEmail);
  }

  /**
   * Update username
   * @param userId User ID
   * @param newUsername New username
   * @returns Updated user
   */
  async updateUsername(userId: string, newUsername: string): Promise<User> {
    return this.profileService.updateUsername(userId, newUsername);
  }

  /**
   * Check if username is available
   * @param username Username to check
   * @param excludeUserId User ID to exclude
   * @returns True if available
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    return this.profileService.isUsernameAvailable(username, excludeUserId);
  }

  /**
   * Check if email is available
   * @param email Email to check
   * @param excludeUserId User ID to exclude
   * @returns True if available
   */
  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    return this.profileService.isEmailAvailable(email, excludeUserId);
  }

  // ==================== PREFERENCES DELEGATION ====================

  /**
   * Get user preferences
   * @param userId User ID
   * @returns User preferences
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    return this.preferencesService.getUserPreferences(userId);
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
  ): Promise<{ preferences: UserPreferences }> {
    // @ts-expect-error - Return type mismatch with service
    return this.preferencesService.updatePreferences(userId, preferences);
  }

  /**
   * Set active organization
   * @param userId User ID
   * @param organizationId Organization ID
   * @returns Updated user
   */
  async setActiveOrganization(userId: string, organizationId: string): Promise<User> {
    return this.preferencesService.setActiveOrganization(userId, organizationId);
  }

  // ==================== SOCIAL DELEGATION ====================

  /**
   * Get user's social statistics
   * @param userId User ID
   * @returns Social statistics
   */
  async getSocialStats(userId: string): Promise<SocialStats> {
    return this.socialService.getSocialStats(userId);
  }

  /**
   * Send friend request
   * @param userId User sending request
   * @param targetUserId Target user
   * @returns Connection result
   */
  async sendFriendRequest(
    userId: string,
    targetUserId: string
  ): Promise<{ success: boolean; message: string }> {
    // @ts-expect-error - Return type mismatch with service
    return this.socialService.sendFriendRequest(userId, targetUserId);
  }

  /**
   * Get relationship status between users
   * @param userId First user
   * @param targetUserId Second user
   * @returns Relationship status
   */
  async getRelationshipStatus(
    userId: string,
    targetUserId: string
  ): Promise<{ status: string; type?: string }> {
    // @ts-expect-error - Return type mismatch with service
    return this.socialService.getRelationshipStatus(userId, targetUserId);
  }

  // ==================== ADVANCED OPERATIONS ====================

  /**
   * Get comprehensive user dashboard data
   * @param userId User ID
   * @returns Dashboard data
   */
  async getUserDashboard(userId: string): Promise<{
    user: User;
    profileCompletion: number;
    preferences: UserPreferences;
    socialStats: SocialStats;
    recentActivity: TimelineEvent[];
    activityStreak: number;
    organizationContext: OrganizationContext | null;
  }> {
    const [user, profileActivity, preferences, socialStats, organizationContext, timeline] =
      await Promise.all([
        this.getUserById(userId),
        this.profileService.getProfileActivity(userId),
        this.preferencesService.getUserPreferences(userId),
        this.socialService.getSocialStats(userId),
        this.preferencesService.getActiveOrganizationContext(userId),
        this.activityService.getUserActivityTimeline(
          userId,
          DASHBOARD_TIMELINE_DAYS,
          DASHBOARD_TIMELINE_LIMIT
        ),
      ]);

    if (!user) {
      throw new Error('User not found');
    }

    return {
      user,
      profileCompletion: profileActivity.profileCompletion,
      preferences,
      socialStats,
      recentActivity: timeline.timeline,
      activityStreak: timeline.summary.streak,
      organizationContext,
    };
  }

  /**
   * Perform user data export (GDPR compliance)
   * @param userId User ID
   * @returns Exported user data
   */
  async exportUserData(userId: string): Promise<{
    user: User;
    profile: ProfileActivity;
    preferences: UserPreferences;
    socialData: SocialStats;
    activities: ActivityLogPayload[];
    exportedAt: Date;
  }> {
    const [user, profileActivity, preferences, socialStats] = await Promise.all([
      this.getUserById(userId),
      this.profileService.getProfileActivity(userId),
      this.preferencesService.exportPreferences(userId),
      this.socialService.getSocialStats(userId),
    ]);

    if (!user) {
      throw new Error('User not found');
    }

    return {
      user,
      profile: {
        profileCompletion: profileActivity.profileCompletion,
        lastProfileUpdate: profileActivity.lastProfileUpdate || undefined, // Convert null to undefined
        activityCount: 0, // NOT IMPLEMENTED: Requires ActivityService integration (pending future phase)
      },
      preferences: preferences.preferences,
      socialData: socialStats,
      activities: [], // Would get from activity logging
      exportedAt: new Date(),
    };
  }

  /**
   * Get user statistics for admin dashboard
   * @param userId User ID
   * @returns Comprehensive user statistics
   */
  async getUserStatistics(userId: string): Promise<{
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
  }> {
    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const [profileActivity, socialStats, organizationContext] = await Promise.all([
      this.profileService.getProfileActivity(userId),
      this.socialService.getSocialStats(userId),
      this.preferencesService.getActiveOrganizationContext(userId),
    ]);

    return {
      basicInfo: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        // Note: User model may not have updatedAt, but we include it for completeness
      },
      activityStats: {
        totalActivities: 0, // NOT IMPLEMENTED: Requires ActivityService integration (pending future phase)
        recentActivities: 0, // NOT IMPLEMENTED: Requires ActivityService integration (pending future phase)
        activityStreak: 0, // NOT IMPLEMENTED: Requires ActivityService integration (pending future phase)
        // Additional fields from profileActivity
        profileCompletion: profileActivity.profileCompletion,
        lastProfileUpdate: profileActivity.lastProfileUpdate,
        profileViews: profileActivity.profileViews,
      },
      socialStats,
      securityInfo: {
        lastLogin: undefined, // NOT IMPLEMENTED: Requires authentication event tracking (pending security dashboard feature)
        twoFactorEnabled: await this.authenticationService.hasTwoFactorAuth(userId),
        loginAttempts: 0, // NOT IMPLEMENTED: Requires authentication event tracking (pending security dashboard feature)
        // Additional fields
        hasPassword: await this.authenticationService.hasPassword(userId),
        emailVerified: profileActivity.emailVerified,
      },
      organizationInfo: organizationContext,
    };
  }

  // ==================== BULK OPERATIONS ====================

  /**
   * Bulk update user roles
   * @param userIds Array of user IDs
   * @param newRole New role to assign
   * @param performedBy User performing the operation
   * @returns Number of users updated
   */
  async bulkUpdateRoles(userIds: string[], newRole: string, performedBy: string): Promise<number> {
    let updatedCount = 0;

    for (const userId of userIds) {
      try {
        const user = await this.getUserById(userId);
        if (user) {
          user.role = newRole;
          await this.userRepository.save(user);
          updatedCount++;

          // Log the role change
          await this.socialService.logSocialActivity({
            userId: performedBy,
            targetUserId: userId,
            activityType: SocialActivityType.PROFILE_VIEW,
            description: `Role changed to ${newRole}`,
            isPublic: false,
            metadata: { oldRole: user.role, newRole, performedBy },
          });
        }
      } catch (error: unknown) {
        // Continue with other users if one fails
        logger.error(`Failed to update role for user ${userId}:`, error);
      }
    }

    return updatedCount;
  }

  /**
   * Get users by role
   * @param role Role or array of roles
   * @param pagination Pagination options
   * @returns Paginated users by role
   */
  async getUsersByRole(
    role: string | string[],
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<User>> {
    return this.searchService.getUsersByRole(role, undefined, pagination);
  }

  // ==================== SERVICE DELEGATION ====================

  /**
   * Get authentication service for advanced auth operations
   */
  getAuthenticationService(): UserAuthenticationService {
    return this.authenticationService;
  }

  /**
   * Get profile service for profile management
   */
  getProfileService(): UserProfileService {
    return this.profileService;
  }

  /**
   * Get preferences service for settings management
   */
  getPreferencesService(): UserPreferencesService {
    return this.preferencesService;
  }

  /**
   * Get search service for advanced search operations
   */
  getSearchService(): UserSearchService {
    return this.searchService;
  }

  /**
   * Get social service for social features
   */
  getSocialService(): UserSocialService {
    return this.socialService;
  }

  /**
   * Get activity service for activity tracking
   */
  getActivityService(): UserActivityService {
    return this.activityService;
  }

  // ==================== ACTIVITY TIMELINE OPERATIONS ====================

  /**
   * Get user activity timeline with enriched events
   * @param userId User ID
   * @param days Number of days to look back (default: 30)
   * @param limit Maximum number of events (default: 50)
   * @returns Enriched timeline with summary
   */
  async getUserActivityTimeline(
    userId: string,
    days: number = 30,
    limit: number = 50
  ): Promise<{
    timeline: TimelineEvent[];
    summary: {
      totalEvents: number;
      byCategory: Record<string, number>;
      firstActivity: Date | null;
      lastActivity: Date | null;
      streak: number;
    };
  }> {
    return this.activityService.getUserActivityTimeline(userId, days, limit);
  }

  /**
   * Get user activity heatmap for visualization
   * @param userId User ID
   * @param months Number of months to look back (default: 12)
   * @returns Daily activity counts
   */
  async getUserActivityHeatmap(
    userId: string,
    months: number = 12
  ): Promise<Array<{ date: string; count: number }>> {
    return this.activityService.getActivityHeatmap(userId, months);
  }

  // ==================== VALIDATION AND UTILITIES ====================

  /**
   * Validate user data before creation/update
   * @param userData User data to validate
   * @returns Validation result
   */
  validateUserData(userData: Partial<User>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (userData.username) {
      if (userData.username.length < 3) {
        errors.push('Username must be at least 3 characters long');
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(userData.username)) {
        errors.push('Username can only contain letters, numbers, underscores, and hyphens');
      }
    }

    if (userData.email) {
      // Simple email validation without backtracking-vulnerable regex
      const atIndex = userData.email.indexOf('@');
      const dotIndex = userData.email.lastIndexOf('.');
      const hasSpace = /\s/.test(userData.email);
      if (
        atIndex < 1 ||
        dotIndex <= atIndex + 1 ||
        dotIndex >= userData.email.length - 1 ||
        hasSpace
      ) {
        errors.push('Invalid email format');
      }
    }

    if (userData.role && !['user', 'admin', 'moderator'].includes(userData.role)) {
      errors.push('Invalid role specified');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if user exists
   * @param userId User ID
   * @returns True if user exists
   */
  async userExists(userId: string): Promise<boolean> {
    const user = await this.getUserById(userId);
    return user !== null;
  }

  /**
   * Get user count
   * @param filters Optional filters
   * @returns Total user count
   */
  async getUserCount(filters?: UserSearchFilters): Promise<number> {
    if (filters) {
      const result = await this.searchService.searchUsers(undefined, filters, {
        page: 1,
        limit: 1,
      });
      return result.pagination.total;
    }

    return this.userRepository.count();
  }
}
