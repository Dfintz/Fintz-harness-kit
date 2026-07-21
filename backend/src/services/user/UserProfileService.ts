import crypto from 'node:crypto';

import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { ConflictError, NotFoundError } from '../../utils/apiErrors';

export interface PublicUserProfile {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string;
  joinedAt?: Date;
  createdAt?: Date;
  lastActiveAt?: Date;
  isPrivateProfile: boolean;
  showShips: boolean;
  showActivity: boolean;
  showRsiInfo?: boolean;
  showVerifiedBadge?: boolean;
  showOrganizations?: boolean;
  showScStats?: boolean;
  bio?: string;
  rsiHandle?: string;
  rsiVerified?: boolean;
  email?: string;
  role?: string;
  organizations?: Array<{
    orgId: string;
    orgName: string;
    orgLogo?: string;
    roleName: string;
  }>;
}

/**
 * User Profile Service
 * Handles user profile management, personal information, and email operations
 */
export class UserProfileService {
  private static readonly UUID_IDENTIFIER_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private readonly userRepository = AppDataSource.getRepository(User);

  private async findUserById(
    userId: string,
    selectFields?: ReadonlyArray<keyof User>
  ): Promise<User | null> {
    const query = this.userRepository.createQueryBuilder('user').where('user.id = :userId', {
      userId,
    });

    if (selectFields && selectFields.length > 0) {
      query.select(selectFields.map(field => `user.${String(field)}`));
    }

    return query.getOne();
  }

  // ==================== PROFILE MANAGEMENT ====================

  /**
   * Get user profile by ID
   * @param userId User ID
   * @returns User profile or null
   */
  async getUserProfile(userId: string): Promise<User | null> {
    return this.findUserById(userId, [
      'id',
      'username',
      'email',
      'role',
      'activeOrgId',
      'createdAt',
      'updatedAt',
    ]);
  }

  /**
   * Update user profile
   * @param userId User ID
   * @param profileData Profile data to update
   * @returns Updated user profile
   */
  async updateProfile(userId: string, profileData: Partial<User>): Promise<User> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Merge profile data (excluding sensitive fields)
    const allowedFields = [
      'username',
      'email',
      'firstName',
      'lastName',
      'displayName',
      'bio',
      'location',
      'website',
      'avatar',
      'timezone',
      'language',
    ];

    const updates: Partial<User> = {};
    for (const field of allowedFields) {
      if (profileData[field as keyof User] !== undefined) {
        (updates as unknown as Record<string, unknown>)[field] = (
          profileData as unknown as Record<string, unknown>
        )[field];
      }
    }

    Object.assign(user, updates);
    return this.userRepository.save(user);
  }

  /**
   * Update user avatar
   * @param userId User ID
   * @param avatarUrl Avatar URL
   * @returns Updated user
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<User> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    user.avatar = avatarUrl;
    return this.userRepository.save(user);
  }

  /**
   * Update user display name
   * @param userId User ID
   * @param displayName New display name
   * @returns Updated user
   */
  async updateDisplayName(userId: string, displayName: string): Promise<User> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    user.displayName = displayName;
    return this.userRepository.save(user);
  }

  // ==================== EMAIL MANAGEMENT ====================

  /**
   * Update user email
   * @param userId User ID
   * @param newEmail New email address
   * @returns Updated user
   * @throws Error if email is already in use
   */
  async updateEmail(userId: string, newEmail: string): Promise<User> {
    // Check if email is already in use
    const existingUser = await this.getUserByEmail(newEmail);
    if (existingUser && existingUser.id !== userId) {
      throw new ConflictError('Email address is already in use');
    }

    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    user.email = newEmail;
    (user as unknown as Record<string, unknown>).emailVerified = false; // Reset email verification
    (user as unknown as Record<string, unknown>).emailVerificationToken =
      this.generateVerificationToken();

    return this.userRepository.save(user);
  }

  /**
   * Get user by email
   * @param email Email address
   * @returns User or null
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();
    return user ?? null;
  }

  /**
   * Check if email is available
   * @param email Email to check
   * @param excludeUserId User ID to exclude from check
   * @returns True if email is available
   */
  async isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.email = :email', { email });

    if (excludeUserId) {
      queryBuilder.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    const user = await queryBuilder.getOne();
    return !user;
  }

  /**
   * Verify user email
   * @param userId User ID
   * @param verificationToken Verification token
   * @returns True if verification successful
   */
  async verifyEmail(userId: string, verificationToken: string): Promise<boolean> {
    const user = await this.findUserById(userId);
    if (!user) {
      return false;
    }

    if ((user as unknown as Record<string, unknown>).emailVerificationToken !== verificationToken) {
      return false;
    }

    (user as unknown as Record<string, unknown>).emailVerified = true;
    (user as unknown as Record<string, unknown>).emailVerificationToken = null;
    (user as unknown as Record<string, unknown>).emailVerifiedAt = new Date();

    await this.userRepository.save(user);
    return true;
  }

  /**
   * Request email verification
   * @param userId User ID
   * @returns Verification token
   */
  async requestEmailVerification(userId: string): Promise<string> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const verificationToken = this.generateVerificationToken();
    (user as unknown as Record<string, unknown>).emailVerificationToken = verificationToken;
    (user as unknown as Record<string, unknown>).emailVerificationRequestedAt = new Date();

    await this.userRepository.save(user);
    return verificationToken;
  }

  // ==================== USERNAME MANAGEMENT ====================

  /**
   * Update username
   * @param userId User ID
   * @param newUsername New username
   * @returns Updated user
   * @throws Error if username is taken
   */
  async updateUsername(userId: string, newUsername: string): Promise<User> {
    // Check if username is available
    const isAvailable = await this.isUsernameAvailable(newUsername, userId);
    if (!isAvailable) {
      throw new ConflictError('Username is already taken');
    }

    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const oldUsername = user.username;
    user.username = newUsername;
    user.previousUsernames = user.previousUsernames ?? [];
    (
      user as unknown as { previousUsernames: Array<{ username: string; changedAt: Date }> }
    ).previousUsernames.push({
      username: oldUsername,
      changedAt: new Date(),
    });

    return this.userRepository.save(user);
  }

  /**
   * Check if username is available
   * @param username Username to check
   * @param excludeUserId User ID to exclude from check
   * @returns True if username is available
   */
  async isUsernameAvailable(username: string, excludeUserId?: string): Promise<boolean> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .where('user.username = :username', { username });

    if (excludeUserId) {
      queryBuilder.andWhere('user.id != :excludeUserId', { excludeUserId });
    }

    const user = await queryBuilder.getOne();
    return !user;
  }

  /**
   * Get username history
   * @param userId User ID
   * @returns Array of previous usernames
   */
  async getUsernameHistory(userId: string): Promise<Array<{ username: string; changedAt: Date }>> {
    const user = await this.findUserById(userId, ['previousUsernames']);

    return (user?.previousUsernames ?? []) as unknown as Array<{
      username: string;
      changedAt: Date;
    }>;
  }

  // ==================== PROFILE STATISTICS ====================

  /**
   * Get profile completion percentage
   * @param userId User ID
   * @returns Completion percentage (0-100)
   */
  async getProfileCompletion(userId: string): Promise<number> {
    const user = await this.findUserById(userId);
    if (!user) {
      return 0;
    }

    const fields = [
      'username',
      'email',
      'firstName',
      'lastName',
      'bio',
      'location',
      'avatar',
      'emailVerified',
    ];

    let completedFields = 0;
    for (const field of fields) {
      if ((user as unknown as Record<string, unknown>)[field]) {
        completedFields++;
      }
    }

    return Math.round((completedFields / fields.length) * 100);
  }

  /**
   * Get profile activity summary
   * @param userId User ID
   * @returns Profile activity summary
   */
  async getProfileActivity(userId: string): Promise<{
    profileViews: number;
    lastProfileUpdate: Date | null;
    joinedDate: Date;
    emailVerified: boolean;
    profileCompletion: number;
  }> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    const profileCompletion = await this.getProfileCompletion(userId);

    return {
      profileViews: user.profileViews ?? 0,
      lastProfileUpdate: user.updatedAt,
      joinedDate: user.createdAt,
      emailVerified: ((user as unknown as Record<string, unknown>).emailVerified ??
        false) as boolean,
      profileCompletion,
    };
  }

  // ==================== PRIVACY SETTINGS ====================

  /**
   * Update profile visibility settings
   * @param userId User ID
   * @param visibilitySettings Visibility settings
   * @returns Updated user
   */
  async updateProfileVisibility(
    userId: string,
    visibilitySettings: {
      profilePublic?: boolean;
      showEmail?: boolean;
      showLocation?: boolean;
      showJoinDate?: boolean;
      allowDirectMessages?: boolean;
    }
  ): Promise<User> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    (user as unknown as Record<string, unknown>).profileSettings = {
      ...((user as unknown as Record<string, unknown>).profileSettings as
        | Record<string, unknown>
        | undefined),
      ...visibilitySettings,
    };

    return this.userRepository.save(user);
  }

  // ==================== HELPER METHODS ====================

  private async findUserByIdentifier(identifier: string): Promise<User | null> {
    const normalizedIdentifier = identifier.trim();
    const query = this.userRepository.createQueryBuilder('user');

    if (UserProfileService.UUID_IDENTIFIER_REGEX.test(normalizedIdentifier)) {
      query.where('user.id = :identifier', { identifier: normalizedIdentifier });
    } else {
      query.where('user.username = :identifier', { identifier: normalizedIdentifier });
    }

    return query.getOne();
  }

  /**
   * Generate email verification token
   * @returns Random verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Increment profile view count
   * @param userId User ID
   * @param viewerUserId ID of user viewing the profile
   */
  async incrementProfileViews(userId: string, viewerUserId?: string): Promise<void> {
    // Don't count self-views
    if (userId === viewerUserId) {
      return;
    }

    await this.userRepository
      .createQueryBuilder()
      .update(User)
      .set({
        profileViews: () => 'COALESCE("profileViews", 0) + 1',
        lastProfileViewAt: () => 'CURRENT_TIMESTAMP',
      })
      .where('id = :userId', { userId })
      .execute();
  }

  /**
   * Get public profile data
   * @param userId User ID
   * @returns Public profile data
   */
  async getPublicProfile(
    identifier: string,
    requestingUserId: string
  ): Promise<PublicUserProfile | null> {
    const targetUser = await this.findUserByIdentifier(identifier);

    if (!targetUser) {
      return null;
    }

    const isOwnProfile = requestingUserId === targetUser.id;
    const privacy = targetUser.preferences?.privacy ?? {};
    const visibility = privacy.profileVisibility ?? 'public';

    if (!isOwnProfile && visibility === 'private') {
      return {
        id: targetUser.id,
        username: targetUser.username,
        displayName: targetUser.displayName,
        avatar: targetUser.avatar,
        isPrivateProfile: true,
        showShips: false,
        showActivity: false,
      };
    }

    const publicProfile: PublicUserProfile = {
      id: targetUser.id,
      username: targetUser.username,
      displayName: targetUser.displayName,
      avatar: targetUser.avatar,
      joinedAt: targetUser.createdAt,
      createdAt: targetUser.createdAt,
      lastActiveAt: targetUser.lastLoginAt,
      isPrivateProfile: false,
      showShips: isOwnProfile || privacy.showPublicShips !== false,
      showActivity: isOwnProfile || privacy.showActivity !== false,
      showRsiInfo: isOwnProfile || privacy.showRsiInfo !== false,
      showVerifiedBadge: isOwnProfile || privacy.showVerifiedBadge !== false,
      showOrganizations: isOwnProfile || privacy.showOrganizations !== false,
      showScStats: isOwnProfile || privacy.showScStats === true,
    };

    if (isOwnProfile || privacy.showBio !== false) {
      publicProfile.bio = targetUser.bio;
    }

    if (publicProfile.showRsiInfo) {
      publicProfile.rsiHandle = targetUser.rsiHandle;
    }

    if (publicProfile.showVerifiedBadge) {
      publicProfile.rsiVerified = targetUser.rsiVerified;
    }

    if (isOwnProfile) {
      publicProfile.email = targetUser.email;
      publicProfile.role = targetUser.role;
      publicProfile.rsiHandle = targetUser.rsiHandle;
      publicProfile.rsiVerified = targetUser.rsiVerified;
    }

    if (publicProfile.showOrganizations) {
      const memQb = AppDataSource.getRepository(OrganizationMembership)
        .createQueryBuilder('mem')
        .innerJoinAndSelect('mem.organization', 'org')
        .innerJoinAndSelect('mem.role', 'role')
        .where('mem."userId" = :targetUserId', { targetUserId: targetUser.id })
        .andWhere('mem."isActive" = true')
        .andWhere('org."isArchived" = false');

      if (!isOwnProfile) {
        memQb.andWhere(`(
          org.settings IS NULL
          OR org.settings->>'visibility' IS NULL
          OR org.settings->>'visibility' = 'public'
        )`);
      }

      const memberships = await memQb.orderBy('role.priority', 'DESC').getMany();
      publicProfile.organizations = memberships.map(mem => ({
        orgId: mem.organizationId,
        orgName: mem.organization.name,
        orgLogo: mem.organization.logoUrl ?? undefined,
        roleName: mem.role?.name ?? 'Member',
      }));
    } else {
      publicProfile.organizations = [];
    }

    return publicProfile;
  }
}

