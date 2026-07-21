/**
 * User Controller V2
 * Handles user-related endpoints with standardized responses
 */

import { Request, Response } from 'express';
import { In, Like } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { getBackendUrl } from '../../config/urls';
import { ApiError } from '../../middleware/errorHandlerV2';
import { buildHateoasLinks, selectFieldsFromArray } from '../../middleware/queryParser';
import { ExportRequestStatus } from '../../models/ExportRequest';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { UserAchievement } from '../../models/UserAchievement';
import { AuthenticationService } from '../../services/authentication/AuthenticationService';
import { PasswordResetService } from '../../services/authentication/PasswordResetService';
import { AccountAccessLogService } from '../../services/security/access/AccountAccessLogService';
import {
  getTrustedDeviceService,
  TrustedDeviceService,
} from '../../services/security/access/TrustedDeviceService';
import { UserShipService } from '../../services/ship/UserShipService';
import { friendshipService } from '../../services/social/FriendshipService';
import { getExportRequestService } from '../../services/user/ExportRequestService';
import { getGdprDataDeletionService } from '../../services/user/GdprDataDeletionService';
import { UserAuthenticationService } from '../../services/user/UserAuthenticationService';
import {
  type ProfilePrivacySettings,
  UserPreferencesService,
} from '../../services/user/UserPreferencesService';
import { UserProfileService } from '../../services/user/UserProfileService';
import { UserSearchService } from '../../services/user/UserSearchService';
import { ApiErrorCode, DEFAULT_QUERY_PARAMS } from '../../types/api';
import { getAuthenticatedUserId } from '../../utils/authHelpers';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';

export class UserControllerV2 {
  private static readonly UUID_IDENTIFIER_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  private readonly userAuthService: UserAuthenticationService;
  private readonly authService: AuthenticationService;
  private readonly passwordResetService: PasswordResetService;
  private readonly trustedDeviceService: TrustedDeviceService;
  private readonly accessLogService: AccountAccessLogService;
  private readonly userSearchService: UserSearchService;
  private readonly userShipService: UserShipService;
  private readonly userPreferencesService: UserPreferencesService;
  private readonly userProfileService: UserProfileService;

  // Time window for reusing completed export requests (1 hour in milliseconds)
  private readonly COMPLETED_EXPORT_REUSE_WINDOW_MS = 60 * 60 * 1000;

  /** Convert a file buffer to a truncated data URL safe for DB storage */
  private bufferToDataUrl(buffer: Buffer, mimetype: string): string {
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${mimetype};base64,${base64}`;
    // Data URLs can be very large — truncate to prevent DB column overflow
    if (dataUrl.length > 500_000) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Image is too large for local storage. Please use a smaller image or configure cloud storage.',
        400
      );
    }
    return dataUrl;
  }

  constructor() {
    this.userAuthService = new UserAuthenticationService();
    this.authService = new AuthenticationService();
    this.passwordResetService = new PasswordResetService();
    this.trustedDeviceService = getTrustedDeviceService();
    this.accessLogService = new AccountAccessLogService();
    this.userSearchService = new UserSearchService();
    this.userShipService = new UserShipService();
    this.userPreferencesService = new UserPreferencesService();
    this.userProfileService = new UserProfileService();
  }

  private async findUserByIdentifier(
    identifier: string,
    selectFields?: ReadonlyArray<keyof User>
  ): Promise<User | null> {
    const userRepo = AppDataSource.getRepository(User);
    const normalizedIdentifier = identifier.trim();
    const query = userRepo.createQueryBuilder('user');

    if (selectFields && selectFields.length > 0) {
      query.select(selectFields.map(field => `user.${String(field)}`));
    }

    if (UserControllerV2.UUID_IDENTIFIER_REGEX.test(normalizedIdentifier)) {
      query.where('user.id = :identifier', { identifier: normalizedIdentifier });
    } else {
      query.where('user.username = :identifier', { identifier: normalizedIdentifier });
    }

    return query.getOne();
  }

  private async findUserById(
    userId: string,
    selectFields?: ReadonlyArray<keyof User>
  ): Promise<User | null> {
    const userRepo = AppDataSource.getRepository(User);
    const query = userRepo.createQueryBuilder('user').where('user.id = :userId', { userId });

    if (selectFields && selectFields.length > 0) {
      query.select(selectFields.map(field => `user.${String(field)}`));
    }

    return query.getOne();
  }

  private async findOrganizationById(
    organizationId: string,
    selectFields?: ReadonlyArray<keyof Organization>
  ): Promise<Organization | null> {
    const organizationRepo = AppDataSource.getRepository(Organization);
    const query = organizationRepo
      .createQueryBuilder('organization')
      .where('organization.id = :organizationId', { organizationId });

    if (selectFields && selectFields.length > 0) {
      query.select(selectFields.map(field => `organization.${String(field)}`));
    }

    return query.getOne();
  }

  private async findActiveMembership(
    userId: string,
    organizationId: string,
    includeRole = false
  ): Promise<OrganizationMembership | null> {
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const query = membershipRepo
      .createQueryBuilder('membership')
      .where('membership.userId = :userId', { userId })
      .andWhere('membership.organizationId = :organizationId', { organizationId })
      .andWhere('membership.isActive = :isActive', { isActive: true });

    if (includeRole) {
      query.leftJoinAndSelect('membership.role', 'role');
    }

    return query.getOne();
  }

  /**
   * GET /api/v2/users/me/sessions
   * Get all active sessions for current user
   */
  async getSessions(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);

    // Get active refresh tokens (sessions) from authentication service
    const tokens = await this.authService.getUserRefreshTokens(userId);

    // Map to session format with device information
    const sessions = tokens.map(token => ({
      id: token.id,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt,
      lastUsedAt: token.lastUsedAt,
      ipAddress: token.ipAddress,
      userAgent: token.userAgent,
      deviceInfo: token.userAgent || 'Unknown device',
    }));

    res.success(sessions);
  }

  /**
   * DELETE /api/v2/users/me/sessions/:sessionId
   * Revoke a specific session
   */
  async revokeSession(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const { sessionId } = req.params;

    // sessionId is validated as UUID by middleware

    // Revoke the refresh token (session) with ownership validation
    const revoked = await this.authService.revokeRefreshTokenById(sessionId, userId);

    if (!revoked) {
      res.status(404).json({
        success: false,
        error: 'Session not found or already revoked',
      });
      return;
    }

    res.success({ message: 'Session revoked successfully' });
  }

  /**
   * GET /api/v2/users/me/trusted-devices
   * Get all trusted devices for current user
   */
  async getTrustedDevices(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const devices = await this.trustedDeviceService.getUserDevices(userId);
    res.success(devices);
  }

  /**
   * DELETE /api/v2/users/me/trusted-devices/:deviceId
   * Revoke a specific trusted device
   */
  async revokeTrustedDevice(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const { deviceId } = req.params;

    const revoked = await this.trustedDeviceService.revokeDevice(userId, deviceId);

    if (!revoked) {
      res.status(404).json({
        success: false,
        error: 'Device not found or already revoked',
      });
      return;
    }

    res.success({ message: 'Device revoked successfully' });
  }

  /**
   * GET /api/v2/users/me/access-logs
   * Get access logs for current user (paginated)
   */
  async getAccessLogs(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const logs = await this.accessLogService.getUserAccessLogs(userId, limit, offset);
    res.success(logs);
  }

  /**
   * GET /api/v2/users/me/privacy-settings
   * Get privacy settings for current user
   */
  async getPrivacySettings(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);

    const user = await this.findUserById(userId);

    if (!user) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
    }

    const privacy = user.preferences?.privacy ?? {};

    const settings = {
      profileVisibility: privacy.profileVisibility ?? 'public',
      showEmail: privacy.showEmail ?? false,
      showDiscord: privacy.showDiscord ?? false,
      showBio: privacy.showBio ?? true,
      showRsiInfo: privacy.showRsiInfo ?? true,
      showVerifiedBadge: privacy.showVerifiedBadge ?? true,
      showOrganizations: privacy.showOrganizations ?? true,
      showPublicShips: privacy.showPublicShips ?? true,
      showScStats: privacy.showScStats ?? false,
      showActivity: privacy.showActivity ?? true,
    };

    res.success(settings);
  }

  /**
   * PATCH /api/v2/users/me/privacy-settings
   * Update privacy settings for current user
   */
  async updatePrivacySettings(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);

    const allowedKeys = [
      'profileVisibility',
      'showEmail',
      'showDiscord',
      'showBio',
      'showRsiInfo',
      'showVerifiedBadge',
      'showOrganizations',
      'showPublicShips',
      'showScStats',
      'showActivity',
    ] as const satisfies readonly (keyof ProfilePrivacySettings)[];

    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Partial<ProfilePrivacySettings> = {};
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        (patch as Record<string, unknown>)[key] = body[key];
      }
    }

    try {
      const persistedPrivacy = await this.userPreferencesService.updateProfilePrivacy(
        userId,
        patch
      );
      res.success(persistedPrivacy);
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'User not found') {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }
      throw error;
    }
  }

  /**
   * GET /api/v2/users/me/export-data
   * Request GDPR data export (creates async job)
   */
  async exportData(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      // Check if there's already a pending or recent export request
      const exportService = getExportRequestService();
      const recentExports = await exportService.getUserExportRequests(userId, 1);

      if (recentExports.length > 0) {
        const recentExport = recentExports[0];

        // If there's a pending request, return that status
        if (
          recentExport.status === ExportRequestStatus.PENDING ||
          recentExport.status === ExportRequestStatus.PROCESSING
        ) {
          logger.info('Returning existing export request', {
            userId,
            requestId: recentExport.id,
          });

          return res.success({
            requestId: recentExport.id,
            status: recentExport.status,
            message: 'Data export is already in progress',
            requestedAt: recentExport.requestedAt,
            estimatedTime: '5-15 minutes',
          });
        }

        // If there's a completed export within the last hour, return download link
        const oneHourAgo = new Date(Date.now() - this.COMPLETED_EXPORT_REUSE_WINDOW_MS);
        if (
          recentExport.status === ExportRequestStatus.COMPLETED &&
          recentExport.completedAt &&
          recentExport.completedAt > oneHourAgo
        ) {
          logger.info('Returning existing completed export', {
            userId,
            requestId: recentExport.id,
          });

          return res.success({
            requestId: recentExport.id,
            status: recentExport.status,
            downloadToken: recentExport.downloadToken,
            expiresAt: recentExport.expiresAt,
            message: 'Your recent data export is still available',
            completedAt: recentExport.completedAt,
          });
        }
      }

      // Create new export request
      const exportRequest = await exportService.createExportRequest(userId, ipAddress, userAgent);

      logger.info('GDPR data export request created', {
        userId,
        requestId: exportRequest.id,
      });

      res.success({
        requestId: exportRequest.id,
        status: exportRequest.status,
        message: 'Data export request created. You will be notified via email when complete.',
        requestedAt: exportRequest.requestedAt,
        estimatedTime: '5-15 minutes',
      });
    } catch (error: unknown) {
      logger.error('Failed to create export request', {
        error: getErrorMessage(error),
      });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to create data export request'),
        undefined,
        500
      );
    }
  }

  /**
   * POST /api/v2/users/me/delete-account
   * Request account deletion (GDPR right to be forgotten)
   */
  async requestAccountDeletion(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { reason, password } = req.body as {
        reason?: string;
        password?: string;
      };

      if (typeof password !== 'string' || password.length === 0) {
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Password is required to request account deletion',
          undefined,
          400
        );
      }

      // Get user with password to verify
      const user = await this.userAuthService.getUserWithPassword(userId);

      if (!user) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      // Verify password for security
      if (!user.password) {
        logger.warn('Cannot request account deletion - user has no password set', { userId });
        return res.error(
          ApiErrorCode.INVALID_INPUT,
          'Cannot request account deletion - password is required',
          undefined,
          400
        );
      }

      const passwordValid = await this.userAuthService.verifyPassword(password, user.password);
      if (!passwordValid) {
        logger.warn('Failed account deletion attempt - invalid password', { userId });
        return res.error(ApiErrorCode.INVALID_CREDENTIALS, 'Invalid password', undefined, 401);
      }

      // Create deletion request
      const deletionService = getGdprDataDeletionService();
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      // Check for existing pending deletion request
      const existingRequest = await deletionService.getPendingDeletionRequest(userId);

      if (existingRequest) {
        logger.info('Returning existing deletion request', {
          userId,
          requestId: existingRequest.id,
        });

        return res.success({
          requestId: existingRequest.id,
          status: existingRequest.status,
          message: 'Account deletion request is already pending',
          requestedAt: existingRequest.requestedAt,
          scheduledFor: existingRequest.scheduledFor,
          cancellationDeadline: existingRequest.scheduledFor,
        });
      }

      const deletionRequest = await deletionService.createDeletionRequest(
        userId,
        ipAddress,
        userAgent
      );

      logger.info('Account deletion request created', {
        userId,
        requestId: deletionRequest.id,
        reason: typeof reason === 'string' ? reason : undefined,
      });

      res.success({
        requestId: deletionRequest.id,
        status: deletionRequest.status,
        message:
          'Account deletion request submitted. Review period: 30 days. You can cancel anytime before the deadline.',
        requestedAt: deletionRequest.requestedAt,
        scheduledFor: deletionRequest.scheduledFor,
        cancellationDeadline: deletionRequest.scheduledFor,
      });
    } catch (error: unknown) {
      logger.error('Failed to create deletion request', {
        error: getErrorMessage(error),
      });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to create account deletion request'),
        undefined,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/me/badges
   * Get user badges and achievements
   */
  async getBadges(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);

      const userAchievementRepo = AppDataSource.getRepository(UserAchievement);
      const userAchievements = await userAchievementRepo.find({
        where: { userId },
        relations: ['achievement'],
        order: { awardedAt: 'DESC' },
      });

      const badges = userAchievements
        .filter(ua => ua.achievement)
        .map(ua => ({
          id: ua.achievement!.id,
          name: ua.achievement!.name,
          description: ua.achievement!.description,
          type: ua.achievement!.type,
          rarity: ua.achievement!.rarity,
          icon: ua.achievement!.icon,
          category: ua.achievement!.category,
          isDisplayed: ua.isDisplayed,
          earnedAt: ua.awardedAt,
        }));

      res.success(badges);
    } catch (error: unknown) {
      logger.error('Failed to get badges', { error: getErrorMessage(error) });
      res.error(
        ApiErrorCode.INTERNAL_ERROR,
        getErrorMessage(error, 'Failed to get badges'),
        undefined,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/me
   * Get current user profile
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);

    const user = await this.findUserById(userId);

    if (!user) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
    }

    // Look up active organization name, logo, and membership role
    let activeOrgName: string | undefined;
    let activeOrgLogoUrl: string | undefined;
    let orgRole: string | undefined;
    let orgPermissions: string[] | undefined;
    if (user.activeOrgId) {
      const org = await this.findOrganizationById(user.activeOrgId, ['id', 'name', 'logoUrl']);
      if (org) {
        activeOrgName = org.name;
        activeOrgLogoUrl = org.logoUrl ?? undefined;
      }

      // Resolve the user's role and permissions within their active org
      const membership = await this.findActiveMembership(user.id, user.activeOrgId, true);
      if (membership) {
        orgRole = getRoleName(membership.role);
        orgPermissions = membership.permissions ?? [];
      }
    }

    // Apply field selection if requested
    const fields = req.queryParams?.fields;
    let userData: Record<string, unknown> = {
      id: user.id,
      username: user.username,
      email: user.email,
      discordId: user.discordId,
      role: user.role,
      activeOrgId: user.activeOrgId,
      organizationId: user.activeOrgId, // Alias for components that reference user.organizationId
      activeOrgName,
      activeOrgLogoUrl,
      orgRole,
      orgPermissions,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      rsiHandle: user.rsiHandle,
      rsiVerified: user.rsiVerified,
      twoFactorEnabled: user.twoFactorEnabled,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // ── Load all organization memberships for the current user ──
    const allMemberships = await AppDataSource.getRepository(OrganizationMembership)
      .createQueryBuilder('mem')
      .innerJoinAndSelect('mem.organization', 'org')
      .innerJoinAndSelect('mem.role', 'role')
      .where('mem."userId" = :userId', { userId })
      .andWhere('mem."isActive" = true')
      .andWhere('org."isArchived" = false')
      .orderBy('role.priority', 'DESC')
      .getMany();

    userData.organizations = allMemberships.map(mem => ({
      orgId: mem.organizationId,
      orgName: mem.organization.name,
      orgLogo: mem.organization.logoUrl ?? undefined,
      roleName: mem.role?.name ?? 'Member',
    }));

    if (fields && fields.length > 0) {
      const filtered: Record<string, unknown> = {};
      fields.forEach(field => {
        if (field in userData) {
          filtered[field] = userData[field];
        }
      });
      userData = filtered;
    }

    // Prevent caching of authenticated user data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.success(userData);
  }

  /**
   * PUT /api/v2/users/me
   * Update current user profile
   */
  async updateCurrentUser(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const updates = (req.body ?? {}) as Record<string, unknown>;

    if (Object.hasOwn(updates, 'activeOrgId')) {
      throw new ApiError(
        ApiErrorCode.INVALID_INPUT,
        'activeOrgId cannot be updated via this endpoint. Use /api/v2/users/me/active-organization instead',
        400
      );
    }

    // Whitelist fields the client may update via this endpoint and skip empty
    // strings so callers cannot accidentally clear existing data with `""`.
    const allowedFields = ['displayName', 'bio', 'avatar'] as const;
    const profilePatch: Partial<User> = {};
    for (const field of allowedFields) {
      const value = updates[field];
      if (value !== undefined && value !== '') {
        (profilePatch as Record<string, unknown>)[field] = value;
      }
    }

    try {
      const user = await this.userProfileService.updateProfile(userId, profilePatch);
      res.success({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatar: user.avatar,
        activeOrgId: user.activeOrgId,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'User not found') {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }
      throw error;
    }
  }

  /**
   * GET /api/v2/users/me/preferences
   * Get current user preferences
   */
  async getPreferences(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);

    const user = await this.findUserById(userId);

    if (!user) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
    }

    const preferences = user.preferences || {
      theme: 'dark',
      notifications: {
        email: true,
        push: true,
        discord: true,
      },
      privacy: {
        showOnlineStatus: true,
        showProfile: true,
      },
      display: {
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'YYYY-MM-DD',
      },
    };

    res.success(preferences);
  }

  /**
   * PUT /api/v2/users/me/preferences
   * Update current user preferences
   */
  async updatePreferences(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const updates = req.body as Record<string, unknown>;

    const userRepo = AppDataSource.getRepository(User);
    const user = await this.findUserById(userId);

    if (!user) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
    }

    // Merge preferences
    user.preferences = {
      ...user.preferences,
      ...updates,
    };

    await userRepo.save(user);

    res.success(user.preferences);
  }

  /**
   * GET /api/v2/users/me/organizations
   * Get organizations for current user
   */
  async getUserOrganizations(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const { limit, offset, fields } = req.queryParams || DEFAULT_QUERY_PARAMS;

    // Query user organizations with organization details via join
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);

    // Get active memberships with organization relation
    const [memberships, total] = await membershipRepo.findAndCount({
      where: { userId, isActive: true },
      relations: ['organization'],
      skip: offset,
      take: limit,
      order: { joinedAt: 'DESC' },
    });
    // Resolve from persisted user preferences to avoid relying on request-scoped auth fields.
    const currentUser = await this.findUserById(userId, ['id', 'activeOrgId']);
    const activeOrgId = currentUser?.activeOrgId;

    const organizations = memberships.map(m => ({
      id: m.organizationId,
      name:
        (m as unknown as Record<string, unknown> & { organization?: { name?: string } })
          .organization?.name || 'Unknown',
      role: getRoleName(m.role),
      joinedAt: m.joinedAt,
      isActive: m.organizationId === activeOrgId,
    }));

    // Apply field selection if requested
    const filteredOrgs = selectFieldsFromArray(organizations, fields);

    // Build HATEOAS links
    const links = buildHateoasLinks('/api/v2/users/me/organizations', offset, limit, total);

    res.paginated(
      filteredOrgs,
      {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      links
    );
  }

  /**
   * PUT /api/v2/users/me/active-organization
   * Switch the user's active organization
   */
  async switchActiveOrganization(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const { organizationId } = req.body as { organizationId?: string };

    if (!organizationId || typeof organizationId !== 'string') {
      throw new ApiError(ApiErrorCode.INVALID_INPUT, 'organizationId is required', 400);
    }

    const updatedUser = await this.userPreferencesService.setActiveOrganization(
      userId,
      organizationId
    );

    // Return refreshed user data (same as /auth/me)
    const org = await this.findOrganizationById(organizationId, ['id', 'name', 'logoUrl']);

    const membership = await this.findActiveMembership(userId, organizationId);

    res.success({
      activeOrgId: updatedUser.activeOrgId,
      activeOrgName: org?.name,
      activeOrgLogoUrl: org?.logoUrl ?? undefined,
      orgRole: membership ? getRoleName(membership.role) : undefined,
    });
  }

  /**
   * GET /api/v2/users/me/activity
   * Get activity summary for current user
   */
  async getUserActivity(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);

    // Return activity summary (placeholder for full implementation)
    const activity = {
      userId,
      recentActivities: [],
      stats: {
        activitiesJoined: 0,
        activitiesCreated: 0,
        missionsCompleted: 0,
        totalPlayTime: 0,
      },
      lastActive: new Date().toISOString(),
    };

    res.success(activity);
  }

  /**
   * GET /api/v2/users/me/ships
   * Get ships for current user
   *
   * Note: Ships belong to users, not organizations.
   * Organizations get a view of their members' ships through separate endpoints.
   */
  async getUserShips(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { limit, offset, sort, filters, fields, search } =
        req.queryParams || DEFAULT_QUERY_PARAMS;

      // Fall back to plain req.query for clients that don't use filter[xxx] format
      const q = req.query as Record<string, string | undefined>;

      const result = await this.userShipService.findMyShips(
        userId,
        {
          manufacturer: (filters.manufacturer ?? q['manufacturer']) as string | undefined,
          status: (filters.status ?? q['status']) as string | undefined,
          condition: (filters.condition ?? q['condition']) as string | undefined,
          sharingLevel: (filters.sharingLevel ?? q['sharingLevel']) as string | undefined,
          productionStatus: (filters.productionStatus ?? q['productionStatus']) as
            | string
            | undefined,
          search: search ?? q['search'] ?? undefined,
        },
        {
          limit,
          offset,
          sortField: sort?.field,
          sortOrder: sort?.order,
        }
      );

      const filteredShips = selectFieldsFromArray(result.data, fields);
      const links = buildHateoasLinks('/api/v2/users/me/ships', offset, limit, result.total);

      res.paginated(
        filteredShips,
        {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
        links
      );
    } catch (error) {
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to fetch user ships: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/:id/ships
   * Get ships for a specific user (respects privacy settings).
   * If the user is viewing their own profile they see everything;
   * otherwise only publicly-visible ships are returned.
   */
  async getUserShipsById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const requestingUserId = getAuthenticatedUserId(req);
      const { limit, offset, sort, fields } = req.queryParams || DEFAULT_QUERY_PARAMS;

      const targetUser = await this.findUserByIdentifier(id);
      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      const result = await this.userShipService.findPublicShips(targetUser.id, requestingUserId, {
        limit,
        offset,
        sortField: sort?.field,
        sortOrder: sort?.order,
      });

      const filteredShips = selectFieldsFromArray(result.data, fields);
      const links = buildHateoasLinks(
        `/api/v2/users/${targetUser.id}/ships`,
        offset,
        limit,
        result.total
      );

      res.paginated(
        filteredShips,
        { total: result.total, limit, offset, hasMore: offset + limit < result.total },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to fetch user ships: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/:id
   * Get public user profile by ID or username (slug).
   * Accepts a UUID or a username string.
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    const user = await this.findUserByIdentifier(id);

    if (!user) {
      throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
    }

    // Return only public profile information
    const publicProfile = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatar: user.avatar,
      createdAt: user.createdAt,
    };

    // Apply field selection if requested
    const fields = req.queryParams?.fields;
    if (fields && fields.length > 0) {
      const filtered: Record<string, unknown> = {};
      fields.forEach(field => {
        if (field in publicProfile) {
          filtered[field] = (publicProfile as Record<string, unknown>)[field];
        }
      });
      res.success(filtered);
    } else {
      res.success(publicProfile);
    }
  }

  /**
   * POST /api/v2/users/me/password
   * Change current user's password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const { oldPassword, newPassword } = req.body as { oldPassword: string; newPassword: string };

    if (!oldPassword || !newPassword) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Old password and new password are required',
        400
      );
    }

    try {
      await this.userAuthService.updatePassword(userId, oldPassword, newPassword);
      res.success({ message: 'Password changed successfully' });
    } catch (error: unknown) {
      res.error(
        ApiErrorCode.INVALID_CREDENTIALS,
        getErrorMessage(error, 'Password change failed'),
        undefined,
        400
      );
    }
  }

  /**
   * GET /api/v2/users/me/statistics
   * Get activity statistics for current user
   */
  async getUserStatistics(req: Request, res: Response): Promise<void> {
    const userId = getAuthenticatedUserId(req);
    const days = Number.parseInt(req.query.days as string, 10) || 30;

    try {
      const { UserActivityService } = await import('../../services/user');
      const activityService = new UserActivityService();
      const statistics = await activityService.getUserActivityStats(userId, days);

      res.success({
        userId,
        period: {
          days,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
        statistics,
      });
    } catch (error: unknown) {
      res.error(
        ApiErrorCode.RESOURCE_NOT_FOUND,
        getErrorMessage(error, 'Failed to fetch statistics'),
        undefined,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/:id/activity/stats
   * Get activity statistics for a specific user (public view)
   */
  async getUserActivityStatsById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const days = Number.parseInt(req.query.days as string, 10) || 30;

      const targetUser = await this.findUserByIdentifier(id);
      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      const targetUserId = targetUser.id;

      const { UserActivityService } = await import('../../services/user');
      const activityService = new UserActivityService();
      const statistics = await activityService.getUserActivityStats(targetUserId, days);

      res.success({
        userId: targetUserId,
        period: {
          days,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
        },
        statistics,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to fetch user activity stats: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  // ==================== ACTIVITY TRACKING ====================

  /**
   * GET /api/v2/users/me/activity/timeline
   * Get activity timeline for current user
   */
  async getActivityTimeline(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);

      // Parse query parameters
      const days = Math.min(Math.max(Number.parseInt(req.query.days as string) || 30, 1), 365);
      const limit = Math.min(Math.max(Number.parseInt(req.query.limit as string) || 50, 1), 200);

      // Import UserActivityService
      const { UserActivityService } = await import('../../services/user');
      const activityService = new UserActivityService();

      const timeline = await activityService.getUserActivityTimeline(userId, days, limit);

      res.success({
        timeline,
        parameters: { days, limit },
      });
    } catch (error) {
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get activity timeline: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/me/activity/heatmap
   * Get activity heatmap for current user
   */
  async getActivityHeatmap(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);

      // Parse query parameters
      const months = Math.min(
        Math.max(Number.parseInt(req.query.months as string, 10) || 12, 1),
        24
      );

      // Import UserActivityService
      const { UserActivityService } = await import('../../services/user');
      const activityService = new UserActivityService();

      const heatmap = await activityService.getActivityHeatmap(userId, months);

      res.success({
        heatmap,
        parameters: { months },
      });
    } catch (error) {
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get activity heatmap: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/:id/activity/timeline
   * Get activity timeline for a specific user (admin or own profile)
   */
  async getUserActivityTimeline(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = getAuthenticatedUserId(req);
      const { id } = req.params;

      const selectFields: (keyof User)[] = ['id', 'role', 'preferences'];
      const targetUser = await this.findUserByIdentifier(id, selectFields);

      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      const userId = targetUser.id;
      const isOwnProfile = requestingUserId === userId;

      // Check authorization - own profile, admin, or target has public activity enabled
      if (!isOwnProfile) {
        const requestingUser = await this.findUserById(requestingUserId, ['id', 'role']);
        if (!requestingUser) {
          throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not found', 401);
        }

        const isAdmin = requestingUser.role === 'admin';
        const privacy = targetUser.preferences?.privacy ?? {};
        const showActivity = privacy.showActivity !== false; // default true

        if (!isAdmin && !showActivity) {
          throw new ApiError(
            ApiErrorCode.FORBIDDEN,
            'User has not made their activity public',
            403
          );
        }
      }

      // Parse query parameters
      const days = Math.min(Math.max(Number.parseInt(req.query.days as string, 10) || 30, 1), 365);
      const limit = Math.min(
        Math.max(Number.parseInt(req.query.limit as string, 10) || 50, 1),
        200
      );

      // Import UserActivityService
      const { UserActivityService } = await import('../../services/user');
      const activityService = new UserActivityService();

      const timeline = await activityService.getUserActivityTimeline(userId, days, limit);

      res.success({
        timeline,
        parameters: { days, limit },
        userId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get activity timeline: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/:id/activity/heatmap
   * Get activity heatmap for a specific user (admin or own profile)
   */
  async getUserActivityHeatmap(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = getAuthenticatedUserId(req);
      const { id } = req.params;

      const heatmapSelectFields: (keyof User)[] = ['id', 'role', 'preferences'];
      const targetUser = await this.findUserByIdentifier(id, heatmapSelectFields);

      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      const userId = targetUser.id;
      const isOwnProfile = requestingUserId === userId;

      // Check authorization - own profile, admin, or target has public activity enabled
      if (!isOwnProfile) {
        const requestingUser = await this.findUserById(requestingUserId, ['id', 'role']);
        if (!requestingUser) {
          throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not found', 401);
        }

        const isAdmin = requestingUser.role === 'admin';
        const privacy = targetUser.preferences?.privacy ?? {};
        const showActivity = privacy.showActivity !== false; // default true

        if (!isAdmin && !showActivity) {
          throw new ApiError(
            ApiErrorCode.FORBIDDEN,
            'User has not made their activity public',
            403
          );
        }
      }

      // Parse query parameters
      const months = Math.min(
        Math.max(Number.parseInt(req.query.months as string, 10) || 12, 1),
        24
      );

      // Import UserActivityService
      const { UserActivityService } = await import('../../services/user');
      const activityService = new UserActivityService();

      const heatmap = await activityService.getActivityHeatmap(userId, months);

      res.success({
        heatmap,
        parameters: { months },
        userId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get activity heatmap: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  // ==================== USER ROLE MANAGEMENT ====================

  /**
   * PATCH /api/v2/users/:id/role
   * Update user role (admin only)
   */
  async updateUserRole(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = getAuthenticatedUserId(req);
      const { id: userId } = req.params;
      const { role } = req.body as { role?: string };

      if (typeof role !== 'string' || role.length === 0) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Role is required', 400);
      }

      // Check requesting user is admin
      const userRepo = AppDataSource.getRepository(User);
      const requestingUser = await this.findUserById(requestingUserId);

      if (requestingUser?.role !== 'admin') {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
      }

      // Update target user role
      const targetUser = await this.findUserById(userId);
      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      targetUser.role = role;
      await userRepo.save(targetUser);

      res.success({
        message: 'User role updated successfully',
        user: {
          id: targetUser.id,
          username: targetUser.username,
          role: targetUser.role,
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to update user role: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/search
   * Search users (admin only)
   */
  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = getAuthenticatedUserId(req);
      const { limit = 20, offset = 0, search } = req.queryParams || {};

      // Check requesting user is admin
      const userRepo = AppDataSource.getRepository(User);
      const requestingUser = await this.findUserById(requestingUserId);

      if (requestingUser?.role !== 'admin') {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
      }

      const queryBuilder = userRepo.createQueryBuilder('user');

      if (search) {
        queryBuilder.where(
          'user.username ILIKE :search OR user.email ILIKE :search OR user.displayName ILIKE :search',
          { search: `%${search}%` }
        );
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Get paginated results
      const users = await queryBuilder
        .skip(offset)
        .take(limit)
        .orderBy('user.createdAt', 'DESC')
        .getMany();

      // Remove sensitive data
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      }));

      // Build HATEOAS links
      const links = buildHateoasLinks('/api/v2/users/search', offset, limit, total);

      res.paginated(
        sanitizedUsers,
        {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
        links
      );
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to search users: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/users/:id/deactivate
   * Deactivate user account (admin only)
   */
  async deactivateUser(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = getAuthenticatedUserId(req);
      const { id: userId } = req.params;
      const { _reason } = req.body as { _reason?: string };

      // Check requesting user is admin
      const userRepo = AppDataSource.getRepository(User);
      const requestingUser = await this.findUserById(requestingUserId);

      if (requestingUser?.role !== 'admin') {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Admin access required', 403);
      }

      // Deactivate target user
      const targetUser = await this.findUserById(userId);
      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      // Mark as deactivated (assuming there's an isActive field)
      const targetUserRecord = targetUser as unknown as Record<string, unknown>;
      targetUserRecord.isActive = false;
      targetUserRecord.deactivationReason = typeof _reason === 'string' ? _reason : undefined;
      targetUserRecord.deactivatedAt = new Date();
      await userRepo.save(targetUser);

      res.success({
        message: 'User account deactivated successfully',
        userId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to deactivate user: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/me/notifications
   * List user notifications with pagination
   */
  async getUserNotifications(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const queryParams = (req.queryParams as unknown as Record<string, unknown>) || {};
      const { limit: rawLimit = 20, offset: rawOffset = 0, filter } = queryParams;
      const limit = Number(rawLimit) || 20;
      const offset = Number(rawOffset) || 0;

      // Parse filter for unread notifications
      const unreadOnly =
        (filter as Record<string, unknown>)?.unread === 'true' ||
        (filter as Record<string, unknown>)?.unread === true;

      // Mock notification data (would typically come from NotificationService)
      const notifications = [
        {
          id: '1',
          userId,
          type: 'activity_invite',
          title: 'Activity Invitation',
          message: 'You have been invited to an upcoming operation',
          read: false,
          createdAt: new Date(),
        },
        {
          id: '2',
          userId,
          type: 'org_announcement',
          title: 'Organization Announcement',
          message: 'New organization policy update',
          read: true,
          createdAt: new Date(Date.now() - 86400000),
        },
      ];

      const filtered = unreadOnly ? notifications.filter(n => !n.read) : notifications;
      const total = filtered.length;
      const items = filtered.slice(offset, offset + limit);

      const links = buildHateoasLinks(`/api/v2/users/me/notifications`, offset, limit, total);

      res.paginated(items, { total, limit, offset, hasMore: offset + limit < total }, links);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get notifications: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * PATCH /api/v2/users/me/notifications/:id
   * Mark notification as read
   */
  async markNotificationRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id: notificationId } = req.params;

      // Would typically use NotificationService here
      logger.info(`Marking notification ${notificationId} as read for user ${userId}`);

      res.success({
        message: 'Notification marked as read',
        notificationId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to mark notification as read: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/users/me/notifications/read-all
   * Mark all notifications as read
   */
  async markAllNotificationsRead(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);

      // Would typically use NotificationService here
      logger.info(`Marking all notifications as read for user ${userId}`);

      res.success({
        message: 'All notifications marked as read',
        count: 0, // Would return actual count
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to mark all notifications as read: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/users/me/notifications/:id
   * Delete a notification
   */
  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id: notificationId } = req.params;

      // Would typically use NotificationService here
      logger.info(`Deleting notification ${notificationId} for user ${userId}`);

      res.success({
        message: 'Notification deleted successfully',
        notificationId,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to delete notification: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/me/notification-settings
   * Get notification preferences
   */
  async getNotificationSettings(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);

      // Mock notification settings (would come from database)
      const settings = {
        userId,
        emailNotifications: true,
        pushNotifications: false,
        activityReminders: true,
        organizationAnnouncements: true,
        fleetUpdates: true,
        tradingAlerts: false,
      };

      res.success(settings);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get notification settings: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * PATCH /api/v2/users/me/avatar
   * Update user avatar via file upload or URL
   * Accepts multipart file upload (field: 'avatar') or JSON body { avatar: 'url' }
   */
  async updateAvatar(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const file = (req as Request & { file?: Express.Multer.File }).file;

      const avatarUrl = file
        ? await this.resolveAvatarFromUpload(file, userId)
        : this.resolveAvatarFromBody((req.body ?? {}) as Record<string, unknown>);

      const userRepo = AppDataSource.getRepository(User);
      const user = await this.findUserById(userId);

      if (!user) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      user.avatar = avatarUrl;
      await userRepo.save(user);

      logger.info(`User ${userId} updated avatar`);

      res.success({
        id: user.id,
        avatar: user.avatar,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to update avatar: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * Resolve avatar URL from an uploaded file buffer.
   * Tries Azure Blob Storage first, falls back to data URL.
   */
  private async resolveAvatarFromUpload(
    file: Express.Multer.File,
    userId: string
  ): Promise<string> {
    try {
      const { AzureBlobService } = await import('../../services/cloud/AzureBlobService');
      const blobService = new AzureBlobService();

      if (blobService.isConfigured()) {
        const fileName = `avatar-${userId}-${Date.now()}.${file.mimetype.split('/')[1] || 'png'}`;
        const blobUrl = await blobService.uploadImage(fileName, file.buffer, file.mimetype, {
          resize: { width: 256, height: 256, fit: 'cover' },
          quality: 85,
          format: 'webp',
        });

        // Convert raw blob URL to proxy download URL (storage has public access disabled)
        try {
          const blobFileName = new URL(blobUrl).pathname.split('/').pop();
          if (blobFileName) {
            const base = getBackendUrl();
            return `${base}/api/v2/images/download/${encodeURIComponent(blobFileName)}`;
          }
        } catch {
          // Not a valid URL — return as-is
        }
        return blobUrl;
      }
    } catch (blobError) {
      logger.warn('AzureBlobService unavailable, using data URL fallback', {
        error: blobError instanceof Error ? blobError.message : String(blobError),
      });
    }

    // Blob storage not configured or unavailable — store as data URL
    return this.bufferToDataUrl(file.buffer, file.mimetype);
  }

  /**
   * Extract and validate avatar URL from request body.
   * Allows https://, http:// (dev only), data:image/, and API proxy paths.
   * Blocks javascript:, vbscript:, data:text/html, and other dangerous protocols.
   */
  private resolveAvatarFromBody(body: Record<string, unknown>): string {
    const { avatar } = body;
    if (!avatar || typeof avatar !== 'string') {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Avatar file or URL is required', 400);
    }

    const trimmed = avatar.trim();
    const lower = trimmed.toLowerCase();

    // Allow data:image/* URLs (base64 avatars)
    if (lower.startsWith('data:image/')) {
      if (trimmed.length > 500_000) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Data URL is too large (max 500KB)', 400);
      }
      return trimmed;
    }

    // Allow API proxy download paths
    if (trimmed.startsWith('/api/v2/images/download/')) {
      return trimmed;
    }

    // Allow HTTPS URLs
    if (lower.startsWith('https://')) {
      return trimmed;
    }

    // Allow HTTP in development only
    if (lower.startsWith('http://') && process.env.NODE_ENV !== 'production') {
      return trimmed;
    }

    throw new ApiError(
      ApiErrorCode.VALIDATION_ERROR,
      'Avatar URL must be HTTPS, a data:image/ URL, or an API proxy path',
      400
    );
  }

  /**
   * POST /api/v2/users/me/avatar/reset
   * Reset avatar to Discord or RSI profile picture
   * Body: { source: 'discord' | 'rsi', rsiHandle?: string }
   */
  async resetAvatar(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { source, rsiHandle } = req.body as {
        source?: 'discord' | 'rsi';
        rsiHandle?: string;
      };

      if (source !== 'discord' && source !== 'rsi') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Source must be "discord" or "rsi"', 400);
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await this.findUserById(userId);
      if (!user) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      const resolvedRsiHandle =
        typeof rsiHandle === 'string' && rsiHandle.length > 0 ? rsiHandle : user.username;
      const avatarUrl =
        source === 'discord'
          ? await this.fetchDiscordAvatar(user)
          : await this.fetchRsiAvatar(resolvedRsiHandle);

      if (!avatarUrl) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Could not retrieve avatar from source',
          400
        );
      }

      user.avatar = avatarUrl;
      await userRepo.save(user);

      logger.info(`User ${userId} reset avatar from ${source}`);

      res.success({
        id: user.id,
        avatar: user.avatar,
        source,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to reset avatar: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * Fetch the user's Discord avatar URL via bot API, falling back to default embed avatar.
   */
  private async fetchDiscordAvatar(user: User): Promise<string> {
    if (!user.discordId) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'No Discord account linked', 400);
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (botToken) {
      try {
        const { default: axios } = await import('axios');
        const discordRes = await axios.get(`https://discord.com/api/v10/users/${user.discordId}`, {
          headers: { Authorization: `Bot ${botToken}` },
          timeout: 5000,
        });
        const discordUser = discordRes.data as { id: string; avatar?: string };
        if (discordUser.avatar) {
          const ext = discordUser.avatar.startsWith('a_') ? 'gif' : 'png';
          return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${ext}?size=256`;
        }
      } catch {
        // Fall back to default Discord avatar below
      }
    }

    // Default avatar fallback
    return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(user.discordId) >> 22n) % 6}.png`;
  }

  /**
   * Fetch the user's RSI profile avatar via the RSI crawler.
   */
  private async fetchRsiAvatar(handle: string | undefined): Promise<string | null> {
    if (!handle) {
      throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'RSI handle is required', 400);
    }

    try {
      const { RsiCrawlerService } = await import('../../services/external/RsiCrawlerService');
      const crawler = new RsiCrawlerService();
      const citizen = await crawler.crawlCitizen(handle);
      return citizen?.avatarUrl ?? null;
    } catch {
      throw new ApiError(ApiErrorCode.INTERNAL_ERROR, 'Failed to fetch RSI profile picture', 500);
    }
  }

  /**
   * GET /api/v2/users/:id/public-profile
   * Get user's public profile (privacy-aware)
   */
  async getPublicProfile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const requestingUserId = getAuthenticatedUserId(req);

      const publicProfile = await this.userProfileService.getPublicProfile(id, requestingUserId);
      if (!publicProfile) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      if (!publicProfile.isPrivateProfile) {
        await this.userProfileService.incrementProfileViews(publicProfile.id, requestingUserId);
      }

      res.success(publicProfile);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get public profile: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/me/linked-accounts
   * Get user's linked OAuth accounts
   */
  async getLinkedAccounts(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);

      const user = await this.findUserById(userId);

      if (!user) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      const linkedAccounts = [];

      // Check Discord
      if (
        user.discordId &&
        !user.discordId.startsWith('google:') &&
        !user.discordId.startsWith('twitch:')
      ) {
        linkedAccounts.push({
          provider: 'discord',
          providerId: user.discordId,
          username: user.username,
          linkedAt: user.createdAt,
        });
      }

      // Check Google
      if (user.googleId) {
        linkedAccounts.push({
          provider: 'google',
          providerId: user.googleId,
          linkedAt: user.createdAt,
        });
      }

      // Check Twitch
      if (user.twitchId) {
        linkedAccounts.push({
          provider: 'twitch',
          providerId: user.twitchId,
          linkedAt: user.createdAt,
        });
      }

      // Check Azure AD (would check AzureADUser table)
      // Check RSI (would check RSIUser table)

      res.success({
        userId,
        accounts: linkedAccounts,
        total: linkedAccounts.length,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get linked accounts: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/users/me/linked-accounts/:provider
   * Unlink an OAuth provider from the authenticated user's account.
   * Users must keep at least one linked provider (cannot unlink the last one).
   */
  async unlinkAccount(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { provider } = req.params;

      if (!['discord', 'google', 'twitch'].includes(provider)) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, `Invalid provider: ${provider}`, 400);
      }

      if (provider === 'discord') {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Discord is the primary identity provider and cannot be unlinked',
          400
        );
      }

      const userRepo = AppDataSource.getRepository(User);
      const user = await this.findUserById(userId);
      if (!user) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      // Verify the provider is actually linked
      const providerField = provider === 'google' ? 'googleId' : 'twitchId';
      if (!user[providerField]) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, `${provider} account is not linked`, 400);
      }

      // Count login methods to prevent unlinking the last one
      const hasRealDiscord =
        user.discordId &&
        !user.discordId.startsWith('google:') &&
        !user.discordId.startsWith('twitch:');
      const loginMethodCount =
        (hasRealDiscord ? 1 : 0) + (user.googleId ? 1 : 0) + (user.twitchId ? 1 : 0);

      if (loginMethodCount <= 1) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Cannot unlink your only login method. Link another account first.',
          400
        );
      }

      await userRepo.update(userId, { [providerField]: undefined });
      res.success({ message: `${provider} account unlinked successfully` });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to unlink account: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/auth/forgot-password
   * Request password reset via email
   */
  async requestPasswordReset(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body as { email?: string };

      if (typeof email !== 'string' || email.length === 0) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Email is required', 400);
      }

      // Use PasswordResetService to generate token and send email
      const result = await this.passwordResetService.requestPasswordReset(email);

      res.success(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to request password reset: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/auth/reset-password/:token
   * Verify password reset token
   */
  async verifyResetToken(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Reset token is required', 400);
      }

      // Verify token validity using PasswordResetService
      const result = await this.passwordResetService.verifyResetToken(token);

      res.success(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.TOKEN_EXPIRED,
        `Failed to verify reset token: ${getErrorMessage(error)}`,
        400
      );
    }
  }

  /**
   * POST /api/v2/auth/reset-password
   * Reset password with valid token
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { token, password } = req.body as {
        token?: string;
        password?: string;
      };

      if (typeof token !== 'string' || token.length === 0 || typeof password !== 'string') {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Token and new password are required',
          400
        );
      }

      if (password.length < 8) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Password must be at least 8 characters',
          400
        );
      }

      // Reset password using PasswordResetService
      const result = await this.passwordResetService.resetPassword(token, password);

      res.success(result);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to reset password: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users
   * List all users (admin only)
   */
  async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const userRepository = AppDataSource.getRepository(User);

      // Verify admin access
      const requestingUser = await this.findUserById(userId);
      if (requestingUser?.role !== 'admin') {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Only admins can list users', 403);
      }

      // Get query parameters
      const page = Number.parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(Number.parseInt(req.query.limit as string, 10) || 50, 100);
      const skip = (page - 1) * limit;

      // Fetch users
      const [users, total] = await userRepository.findAndCount({
        skip,
        take: limit,
        order: { createdAt: 'DESC' },
      });

      res.success({
        users: users.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to list users: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/users
   * Create new user (admin only)
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const userRepository = AppDataSource.getRepository(User);

      // Verify admin access
      const requestingUser = await this.findUserById(userId);
      if (requestingUser?.role !== 'admin') {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Only admins can create users', 403);
      }

      const { username, email, password, role } = req.body as {
        username?: string;
        email?: string;
        password?: string;
        role?: string;
      };

      // Validate required fields
      if (
        typeof username !== 'string' ||
        username.length === 0 ||
        typeof email !== 'string' ||
        email.length === 0 ||
        typeof password !== 'string' ||
        password.length === 0
      ) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Username, email, and password are required',
          400
        );
      }

      // Check if user exists
      const existingUsernameUser = await userRepository
        .createQueryBuilder('user')
        .where('user.username = :username', { username })
        .getOne();
      const existingEmailUser = await this.userProfileService.getUserByEmail(email);

      if (existingUsernameUser || existingEmailUser) {
        throw new ApiError(
          ApiErrorCode.RESOURCE_ALREADY_EXISTS,
          'User with this username or email already exists',
          409
        );
      }

      // Hash password
      const hashedPassword = await this.userAuthService.hashPassword(password);

      // Create user
      const newUser = userRepository.create({
        username,
        email,
        password: hashedPassword,
        role: typeof role === 'string' ? role : 'user',
      });

      await userRepository.save(newUser);

      res.success({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to create user: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * PATCH /api/v2/users/:id
   * Update user (admin or self)
   */
  async updateUserAdmin(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = req.params;
      const userRepository = AppDataSource.getRepository(User);

      // Get requesting user
      const requestingUser = await this.findUserById(userId);
      if (!requestingUser) {
        throw new ApiError(ApiErrorCode.UNAUTHORIZED, 'User not found', 401);
      }

      // Verify permissions (admin or self)
      if (requestingUser.id !== id && requestingUser.role !== 'admin') {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'You can only update your own profile', 403);
      }

      // Get target user
      const targetUser = await this.findUserById(id);
      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      // Update allowed fields
      const { email, role, username } = req.body as {
        email?: string;
        role?: string;
        username?: string;
      };
      if (typeof email === 'string' && email.length > 0) {
        targetUser.email = email;
      }
      if (typeof username === 'string' && username.length > 0) {
        targetUser.username = username;
      }

      // Only admins can update role
      if (typeof role === 'string' && role.length > 0 && requestingUser.role === 'admin') {
        targetUser.role = role;
      }

      await userRepository.save(targetUser);

      res.success({
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        role: targetUser.role,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to update user: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * DELETE /api/v2/users/:id
   * Delete user (admin only)
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = req.params;
      const userRepository = AppDataSource.getRepository(User);

      // Verify admin access
      const requestingUser = await this.findUserById(userId);
      if (requestingUser?.role !== 'admin') {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'Only admins can delete users', 403);
      }

      // Get target user
      const targetUser = await this.findUserById(id);
      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      // Prevent admin self-deletion
      if (targetUser.id === userId) {
        throw new ApiError(ApiErrorCode.FORBIDDEN, 'You cannot delete your own account', 403);
      }

      await userRepository.remove(targetUser);

      res.success({ deletedId: targetUser.id });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to delete user: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/users/search/advanced
   * Advanced user search with filters
   */
  async advancedSearch(req: Request, res: Response): Promise<void> {
    try {
      const userRepository = AppDataSource.getRepository(User);
      const {
        query,
        role,
        limit: rawLimit = 20,
        offset: rawOffset = 0,
      } = req.body as {
        query?: string;
        role?: string;
        limit?: number;
        offset?: number;
      };

      const limit = typeof rawLimit === 'number' && Number.isFinite(rawLimit) ? rawLimit : 20;
      const offset = typeof rawOffset === 'number' && Number.isFinite(rawOffset) ? rawOffset : 0;

      if (!query || typeof query !== 'string') {
        throw new ApiError(ApiErrorCode.VALIDATION_ERROR, 'Search query is required', 400);
      }

      // Build where clause
      const where: Record<string, unknown> = {};
      where.username = Like(`%${query}%`);

      if (typeof role === 'string' && role.length > 0) {
        where.role = role;
      }

      // Execute search
      const [results, total] = await userRepository.findAndCount({
        where,
        take: Math.min(limit, 100),
        skip: offset,
        order: { username: 'ASC' },
      });

      res.success({
        results: results.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
        })),
        total,
        query,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Search failed: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/suggestions/username/:partial
   * Get username suggestions based on partial input
   */
  async getUsernameSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const { partial } = req.params;
      const userRepository = AppDataSource.getRepository(User);

      if (!partial || partial.length < 2) {
        throw new ApiError(
          ApiErrorCode.VALIDATION_ERROR,
          'Partial username must be at least 2 characters',
          400
        );
      }

      const suggestions = await userRepository.find({
        where: {
          username: Like(`%${partial}%`),
        },
        take: 10,
        order: { username: 'ASC' },
      });

      res.success({
        partial,
        suggestions: suggestions.map(u => u.username),
        count: suggestions.length,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get suggestions: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * GET /api/v2/users/:id/similar
   * Get similar users ranked by shared organization memberships.
   *
   * Algorithm: collect organizations the target user belongs to, then count
   * other users who share those organizations. Excludes the target itself
   * and any users the requester is already friends with. Top 20 returned.
   */
  async getSimilarUsers(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userRepository = AppDataSource.getRepository(User);
      const membershipRepo = AppDataSource.getRepository(OrganizationMembership);

      const targetUser = await this.findUserById(id);
      if (!targetUser) {
        throw new ApiError(ApiErrorCode.RESOURCE_NOT_FOUND, 'User not found', 404);
      }

      // Organizations the target user is in
      const targetMemberships = await membershipRepo.find({
        where: { userId: id },
        select: ['organizationId'],
      });
      const orgIds = targetMemberships.map(m => m.organizationId).filter(Boolean);

      if (orgIds.length === 0) {
        res.success({ userId: id, similarUsers: [], total: 0 });
        return;
      }

      // Other members of those orgs
      const peerMemberships = await membershipRepo.find({
        where: { organizationId: In(orgIds) },
        select: ['userId', 'organizationId'],
      });

      // Exclude target + (when authenticated) existing friends of the requester
      const requesterId = (req as Request & { user?: { id?: string } }).user?.id;
      const friendIds = requesterId
        ? await friendshipService.getFriendUserIds(requesterId)
        : new Set<string>();

      const sharedCounts = new Map<string, number>();
      for (const m of peerMemberships) {
        if (!m.userId || m.userId === id || friendIds.has(m.userId)) {
          continue;
        }
        sharedCounts.set(m.userId, (sharedCounts.get(m.userId) ?? 0) + 1);
      }

      const ranked = [...sharedCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);

      const peerUserIds = ranked.map(([uid]) => uid);
      const peerUsers = peerUserIds.length
        ? await userRepository.find({
            where: { id: In(peerUserIds) },
            select: ['id', 'username', 'displayName', 'avatar'],
          })
        : [];

      const userById = new Map(peerUsers.map(u => [u.id, u]));
      const similarUsers = ranked
        .map(([uid, sharedOrgs]) => {
          const u = userById.get(uid);
          if (!u) {
            return null;
          }
          return {
            userId: u.id,
            username: u.username,
            displayName: u.displayName,
            avatar: u.avatar,
            sharedOrganizations: sharedOrgs,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

      res.success({
        userId: id,
        similarUsers,
        total: similarUsers.length,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to get similar users: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  /**
   * POST /api/v2/users/:id/social/friend-request
   * Send a persistent friend request to another user.
   */
  async sendFriendRequest(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { id } = req.params;

      const connection = await friendshipService.sendFriendRequest(userId, id);

      res.success({
        requestId: connection.id,
        targetUserId: connection.targetUserId,
        status: connection.status,
        createdAt: connection.createdAt,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        ApiErrorCode.INTERNAL_ERROR,
        `Failed to send friend request: ${getErrorMessage(error)}`,
        500
      );
    }
  }

  // ==================== COMMUNITY MEMBERS DIRECTORY ====================

  /**
   * GET /api/v2/users/community/browse
   * Browse community members with privacy-aware filtering.
   */
  async browseCommunityMembers(req: Request, res: Response): Promise<void> {
    try {
      const userId = getAuthenticatedUserId(req);
      const { search, page, limit, sortBy, sortOrder, rsiVerifiedOnly, hasOrganization } =
        req.query as Record<string, unknown>;

      const searchService = this.userSearchService;
      const result = await searchService.browseCommunityMembers(userId, {
        search: (search as string) ?? undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
        sortBy: sortBy as 'createdAt' | 'username' | 'displayName' | undefined,
        sortOrder: sortOrder as 'ASC' | 'DESC' | undefined,
        rsiVerifiedOnly: rsiVerifiedOnly === true || rsiVerifiedOnly === 'true',
        hasOrganization: hasOrganization === true || hasOrganization === 'true',
      });

      res.success(result);
    } catch (error) {
      if (error instanceof ApiError) {
        res.error(error.code as ApiErrorCode, error.message, error.details, error.statusCode);
        return;
      }
      const message = getErrorMessage(error);
      logger.error('Failed to browse community members', {
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query,
      });
      res.error(ApiErrorCode.INTERNAL_ERROR, 'Failed to browse community members', undefined, 500);
    }
  }
}
