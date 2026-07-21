import { AppDataSource } from '../../data-source';
import { Activity } from '../../models/Activity';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { UserActivity } from '../../models/UserActivity';
import { ConsentType, UserConsent } from '../../models/UserConsent';
import { UserSession } from '../../models/UserSession';
import { UserShip } from '../../models/UserShip';
import { logger } from '../../utils/logger';

/**
 * Consent Service
 * Manages GDPR consent records and consent lifecycle
 */
export class ConsentService {
  private readonly consentRepository = AppDataSource.getRepository(UserConsent);
  private readonly userRepository = AppDataSource.getRepository(User);
  private readonly userActivityRepository = AppDataSource.getRepository(UserActivity);
  private readonly userShipRepository = AppDataSource.getRepository(UserShip);
  private readonly activityRepository = AppDataSource.getRepository(Activity);
  private readonly userOrganizationRepository = AppDataSource.getRepository(OrganizationMembership);
  private readonly userSessionRepository = AppDataSource.getRepository(UserSession);

  /**
   * Record or update user consent
   * @param userId User ID
   * @param consentType Type of consent
   * @param granted Whether consent is granted
   * @param metadata Additional metadata (IP, user agent, version)
   */
  public async recordConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    metadata?: {
      purpose?: string;
      version?: string;
      ipAddress?: string;
      userAgent?: string;
      expiresAt?: Date;
    }
  ): Promise<UserConsent> {
    try {
      // Check if consent already exists
      let consent = await this.consentRepository.findOne({
        where: { userId, consentType },
      });

      // Always default to current policy version when not explicitly provided
      const effectiveVersion = metadata?.version || this.getCurrentPolicyVersion();

      if (consent) {
        // Update existing consent
        consent.granted = granted;
        consent.purpose = metadata?.purpose || consent.purpose;
        consent.version = effectiveVersion;
        consent.ipAddress = metadata?.ipAddress || consent.ipAddress;
        consent.userAgent = metadata?.userAgent || consent.userAgent;
        consent.expiresAt = metadata?.expiresAt || consent.expiresAt;
      } else {
        // Create new consent record
        consent = this.consentRepository.create({
          userId,
          consentType,
          granted,
          ...metadata,
          version: effectiveVersion,
        });
      }

      await this.consentRepository.save(consent);

      logger.info(`Consent ${granted ? 'granted' : 'revoked'} for user ${userId}: ${consentType}`);

      return consent;
    } catch (error: unknown) {
      logger.error('Error recording consent:', error);
      throw new Error('Failed to record consent');
    }
  }

  /**
   * Get all consents for a user
   * @param userId User ID
   */
  public async getUserConsents(userId: string): Promise<UserConsent[]> {
    try {
      return await this.consentRepository.find({
        where: { userId },
        order: { consentType: 'ASC' },
      });
    } catch (error: unknown) {
      logger.error('Error fetching user consents:', error);
      throw new Error('Failed to fetch consents');
    }
  }

  /**
   * Check if user has granted specific consent
   * @param userId User ID
   * @param consentType Type of consent to check
   */
  public async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
    try {
      const consent = await this.consentRepository.findOne({
        where: { userId, consentType, granted: true },
      });

      // Check if consent exists and hasn't expired
      if (!consent) {
        return false;
      }

      if (consent.expiresAt && consent.expiresAt < new Date()) {
        logger.info(`Consent expired for user ${userId}: ${consentType}`);
        return false;
      }

      return true;
    } catch (error: unknown) {
      logger.error('Error checking consent:', error);
      return false;
    }
  }

  /**
   * Revoke all consents for a user (for data deletion requests)
   * @param userId User ID
   */
  public async revokeAllConsents(userId: string): Promise<void> {
    try {
      await this.consentRepository.update({ userId }, { granted: false });

      logger.info(`All consents revoked for user ${userId}`);
    } catch (error: unknown) {
      logger.error('Error revoking consents:', error);
      throw new Error('Failed to revoke consents');
    }
  }

  /**
   * Export all user data for GDPR data portability
   * Includes: user profile, consents, ships, activities, organizations, activity logs, and sessions
   * @param userId User ID
   */
  public async exportUserData(userId: string): Promise<Record<string, unknown>> {
    try {
      // Fetch user profile data
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: [
          'id',
          'username',
          'email',
          'role',
          'displayName',
          'bio',
          'avatar',
          'rsiHandle',
          'rsiVerified',
          'rsiVerifiedAt',
          'twoFactorEnabled',
          'loginCount',
          'lastLoginAt',
          'createdAt',
          'updatedAt',
        ],
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Fetch all consents
      const consents = await this.getUserConsents(userId);

      // Fetch user ships
      const userShips = await this.userShipRepository.find({
        where: { userId },
      });

      // Fetch user activities (created by user)
      const userCreatedActivities = await this.activityRepository.find({
        where: { creatorId: userId },
        select: [
          'id',
          'title',
          'description',
          'activityType',
          'status',
          'scheduledStartDate',
          'scheduledEndDate',
          'location',
          'currentParticipants',
          'maxParticipants',
          'createdAt',
          'updatedAt',
        ],
      });

      // Fetch user organization memberships
      const userOrganizations = await this.userOrganizationRepository.find({
        where: { userId, isActive: true },
      });

      // Fetch user activity logs (audit trail)
      const userActivityLogs = await this.userActivityRepository.find({
        where: { userId },
        select: [
          'id',
          'action',
          'resource',
          'method',
          'ipAddress',
          'statusCode',
          'duration',
          'timestamp',
        ],
        order: { timestamp: 'DESC' },
        take: 1000, // Limit to last 1000 activity logs
      });

      // Fetch user sessions (login history)
      // Note: UserSession.userId is a number, so we attempt to parse the string userId
      const numericUserId = parseInt(userId, 10);
      const userSessions = !isNaN(numericUserId)
        ? await this.userSessionRepository.find({
            where: { userId: numericUserId },
            select: [
              'id',
              'ipAddress',
              'userAgent',
              'isActive',
              'createdAt',
              'expiresAt',
              'lastActivity',
            ],
            order: { createdAt: 'DESC' },
            take: 100, // Limit to last 100 sessions
          })
        : [];

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          displayName: user.displayName,
          bio: user.bio,
          avatar: user.avatar,
          rsiHandle: user.rsiHandle,
          rsiVerified: user.rsiVerified,
          rsiVerifiedAt: user.rsiVerifiedAt,
          twoFactorEnabled: user.twoFactorEnabled,
          loginCount: user.loginCount,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        consents: consents.map(c => ({
          type: c.consentType,
          granted: c.granted,
          purpose: c.purpose,
          version: c.version,
          grantedAt: c.createdAt,
          updatedAt: c.updatedAt,
          expiresAt: c.expiresAt,
        })),
        ships: userShips.map(ship => ({
          id: ship.id,
          shipId: ship.shipId,
          shipName: ship.shipName,
          customName: ship.customName,
          status: ship.status,
          condition: ship.condition,
          acquiredDate: ship.acquiredDate,
          location: ship.location,
          insuranceLevel: ship.insuranceLevel,
          insuranceExpires: ship.insuranceExpires,
          isActive: ship.isActive,
          sharingLevel: ship.sharingLevel,
          sharedWithUsers: ship.sharedWithUsers,
          flightHours: ship.flightHours,
          missionsCompleted: ship.missionsCompleted,
          tags: ship.tags,
          notes: ship.notes,
          createdAt: ship.createdAt,
          updatedAt: ship.updatedAt,
        })),
        activities: userCreatedActivities.map(activity => ({
          id: activity.id,
          title: activity.title,
          description: activity.description,
          type: activity.activityType,
          status: activity.status,
          scheduledStartDate: activity.scheduledStartDate,
          scheduledEndDate: activity.scheduledEndDate,
          location: activity.location,
          currentParticipants: activity.currentParticipants,
          maxParticipants: activity.maxParticipants,
          createdAt: activity.createdAt,
          updatedAt: activity.updatedAt,
        })),
        organizations: userOrganizations.map(org => ({
          organizationId: org.organizationId,
          role: org.role,
          securityLevel: org.securityLevel,
          permissions: org.permissions || [],
          joinedAt: org.joinedAt,
        })),
        activityLogs: userActivityLogs.map(log => ({
          id: log.id,
          action: log.action,
          resource: log.resource,
          method: log.method,
          ipAddress: log.ipAddress,
          statusCode: log.statusCode,
          duration: log.duration,
          timestamp: log.timestamp,
        })),
        sessions: userSessions.map(session => ({
          id: session.id,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          isActive: session.isActive,
          createdAt: session.createdAt,
          expiresAt: session.expiresAt,
          lastActivity: session.lastActivity,
        })),
        exportedAt: new Date().toISOString(),
        dataExportVersion: '2.0',
      };
    } catch (error: unknown) {
      logger.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }

  /**
   * Delete user and all related data (GDPR right to be forgotten)
   * @param userId User ID
   * @returns Number of deleted consent records
   */
  public async deleteUserData(userId: string): Promise<number> {
    try {
      // Revoke all consents first
      await this.revokeAllConsents(userId);

      // Delete consent records and get count
      const result = await this.consentRepository.delete({ userId });
      const deletedCount = result.affected || 0;

      // Note: In a complete implementation, you would:
      // 1. Delete or anonymize all user-related data across all tables
      // 2. Preserve audit trails by anonymizing instead of deleting where required
      // 3. Check for legal hold requirements before deletion
      // 4. Handle cascading deletes properly

      // For now, we'll just mark the user for deletion
      // The actual user deletion should be handled carefully
      logger.info(`User data deletion initiated for user ${userId}`);

      return deletedCount;
    } catch (error: unknown) {
      logger.error('Error deleting user data:', error);
      throw new Error('Failed to delete user data');
    }
  }

  /**
   * Get consent statistics (admin function)
   */
  public async getConsentStatistics(): Promise<
    {
      type: ConsentType;
      granted: number;
      revoked: number;
      total: number;
    }[]
  > {
    try {
      // Use SQL GROUP BY instead of loading all rows into memory
      const rawStats = await this.consentRepository
        .createQueryBuilder('consent')
        .select('consent.consentType', 'consentType')
        .addSelect('consent.granted', 'granted')
        .addSelect('COUNT(*)', 'count')
        .groupBy('consent.consentType')
        .addGroupBy('consent.granted')
        .getRawMany<{ consentType: ConsentType; granted: boolean; count: string }>();

      const stats = new Map<ConsentType, { granted: number; revoked: number }>();

      // Initialize stats for all consent types
      Object.values(ConsentType).forEach(type => {
        stats.set(type, { granted: 0, revoked: 0 });
      });

      // Populate from query results
      for (const row of rawStats) {
        const stat = stats.get(row.consentType);
        if (stat) {
          if (row.granted) {
            stat.granted = parseInt(String(row.count), 10);
          } else {
            stat.revoked = parseInt(String(row.count), 10);
          }
        }
      }

      return Array.from(stats.entries()).map(([type, { granted, revoked }]) => ({
        type,
        granted,
        revoked,
        total: granted + revoked,
      }));
    } catch (error: unknown) {
      logger.error('Error getting consent statistics:', error);
      throw new Error('Failed to get consent statistics');
    }
  }

  /**
   * Get the current policy version
   * This should be updated when privacy/terms policy documents change
   * @returns Current policy version string
   */
  public getCurrentPolicyVersion(): string {
    // Policy version from environment or default
    // Format: YYYY.MM.REVISION (e.g., "2025.01.1")
    return process.env.POLICY_VERSION || '2025.01.1';
  }

  /**
   * Check if user has consented to the current policy version
   * @param userId User ID
   * @param consentType Type of consent to check
   * @returns Object with consent status and version info
   */
  public async checkConsentVersion(
    userId: string,
    consentType: ConsentType
  ): Promise<{
    hasConsent: boolean;
    isCurrentVersion: boolean;
    consentedVersion?: string;
    currentVersion: string;
    requiresRenewal: boolean;
  }> {
    try {
      const currentVersion = this.getCurrentPolicyVersion();
      const consent = await this.consentRepository.findOne({
        where: { userId, consentType, granted: true },
      });

      if (!consent) {
        return {
          hasConsent: false,
          isCurrentVersion: false,
          currentVersion,
          requiresRenewal: true,
        };
      }

      // Check if consent has expired
      if (consent.expiresAt && consent.expiresAt < new Date()) {
        return {
          hasConsent: false,
          isCurrentVersion: false,
          consentedVersion: consent.version,
          currentVersion,
          requiresRenewal: true,
        };
      }

      const isCurrentVersion = consent.version === currentVersion;

      return {
        hasConsent: true,
        isCurrentVersion,
        consentedVersion: consent.version,
        currentVersion,
        requiresRenewal: !isCurrentVersion,
      };
    } catch (error: unknown) {
      logger.error('Error checking consent version:', error);
      throw new Error('Failed to check consent version');
    }
  }

  /**
   * Get all users who need to renew consent for a specific consent type
   * (users whose consented version differs from current policy version)
   * @param consentType Type of consent to check
   * @returns Array of user IDs requiring consent renewal
   */
  public async getUsersRequiringConsentRenewal(consentType: ConsentType): Promise<string[]> {
    try {
      const currentVersion = this.getCurrentPolicyVersion();

      // Filter in SQL instead of loading all rows then filtering in JS
      const consents = await this.consentRepository
        .createQueryBuilder('consent')
        .select('consent.userId')
        .where('consent.consentType = :consentType', { consentType })
        .andWhere('consent.granted = :granted', { granted: true })
        .andWhere('consent.version != :currentVersion', { currentVersion })
        .getRawMany<{ consent_userId: string }>();

      const usersRequiringRenewal = consents.map(c => c.consent_userId);

      logger.info(
        `Found ${usersRequiringRenewal.length} users requiring consent renewal for ${consentType}`
      );

      return usersRequiringRenewal;
    } catch (error: unknown) {
      logger.error('Error getting users requiring consent renewal:', error);
      throw new Error('Failed to get users requiring consent renewal');
    }
  }

  /**
   * Record consent with automatic version tracking
   * @param userId User ID
   * @param consentType Type of consent
   * @param granted Whether consent is granted
   * @param metadata Additional metadata (IP, user agent)
   * @returns The created/updated consent record
   */
  public async recordConsentWithVersion(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    metadata?: {
      purpose?: string;
      ipAddress?: string;
      userAgent?: string;
      expiresAt?: Date;
    }
  ): Promise<UserConsent> {
    const currentVersion = this.getCurrentPolicyVersion();

    return this.recordConsent(userId, consentType, granted, {
      ...metadata,
      version: currentVersion,
    });
  }
}

