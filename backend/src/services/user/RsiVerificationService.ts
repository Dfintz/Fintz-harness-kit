/**
 * RSI Verification Service
 *
 * Handles RSI account ownership verification for users and organizations.
 * Uses the RSI Crawler (direct website scraping) as primary source,
 * with Sentry Wild Knight Squadron API as fallback.
 *
 * Verification Flow:
 * 1. User initiates verification with their RSI handle
 * 2. System generates a unique verification token and wraps it in a profile link
 *    (e.g. https://<frontend>/verify/rsi/SCFM-XXXX)
 * 3. User pastes the link into their RSI bio on robertsspaceindustries.com —
 *    long-form free text, so it's non-destructive and easy to remove afterward
 * 4. The backend auto-detect job crawls pending profiles and completes
 *    verification automatically; the user may also click "Verify Now" for an
 *    immediate check
 * 5. System crawls the RSI citizen page and checks the bio for the token
 * 6. If found, the RSI handle is linked and verified
 */

import crypto from 'node:crypto';

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import { isVerifiedCitizenRecordConflict } from '../../utils/rsiVerificationDbConflict';
import {
  buildRsiVerificationUrl,
  someRsiVerificationTokenMatches,
} from '../../utils/rsiVerificationToken';
import { RsiApiService, type RsiVerificationResult } from '../external/RSIApiService';
import { rsiCrawlerService } from '../external/RsiCrawlerService';
import { rsiUserLinkService } from '../external/RsiUserLinkService';

import { RsiNotificationService } from './RsiNotificationService';
import { rsiVerificationAnalytics } from './RsiVerificationAnalytics';

/**
 * Result of initiating RSI verification
 */
export interface InitiateVerificationResult {
  success: boolean;
  verificationCode?: string;
  /** Full profile link the user pastes into their RSI bio */
  verificationUrl?: string;
  expiresAt?: Date;
  rsiHandle?: string;
  error?: string;
  /** When true, the failure was caused by an external API issue, not user input */
  isExternalError?: boolean;
}

/**
 * Result of completing RSI verification
 */
export interface CompleteVerificationResult {
  success: boolean;
  verified: boolean;
  rsiHandle?: string;
  displayName?: string;
  error?: string;
}

/**
 * Result of checking RSI verification status
 */
export interface VerificationStatusResult {
  rsiHandle?: string;
  /** Immutable UEE Citizen Record number (stable across handle renames) */
  rsiCitizenRecord?: string;
  verified: boolean;
  verifiedAt?: Date;
  pendingVerification: boolean;
  verificationCodeExpiresAt?: Date;
}

/**
 * Result of organization ownership verification
 * Includes org data from RSI for auto-population
 */
export interface OrgOwnershipVerificationResult {
  success: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  orgSid?: string;
  orgName?: string;
  userRank?: string;
  error?: string;
  /** RSI org data for auto-populating org fields */
  rsiOrgData?: {
    description?: string;
    logo?: string;
    banner?: string;
    archetype?: string;
    commitment?: string;
    memberCount?: number;
    focus?: { primary?: string; secondary?: string };
    recruiting?: string;
    language?: string;
    links?: Record<string, string>;
  };
}

/**
 * TypeORM update helpers — avoids `null as unknown as T` casts when clearing nullable columns.
 * TypeORM's `update()` method types nullable columns as their non-null type, but accepts null at runtime.
 */

const NULL_STRING = null as unknown as string;

const NULL_DATE = null as unknown as Date;

/**
 * RSI Verification Service
 */
export class RsiVerificationService {
  private readonly userRepository: Repository<User>;
  private readonly organizationRepository: Repository<Organization>;
  private readonly membershipRepository: Repository<OrganizationMembership>;
  private readonly rsiApiService: RsiApiService;
  private readonly notificationService: RsiNotificationService;

  // Verification code validity period (24 hours)
  private readonly VERIFICATION_CODE_VALIDITY_HOURS = 24;

  // Minimum RSI star level (1–5) required for admin status when rank title doesn't match
  private static readonly MIN_ADMIN_STARS = 4;

  // Ranks considered owner-level on RSI organizations
  private static readonly OWNER_RANKS = ['founder', 'ceo', 'owner'];
  // Ranks (in addition to owner) considered admin-level on RSI organizations
  private static readonly ADMIN_RANKS = ['director', 'admin', 'board member', 'executive officer'];

  // Verification code prefix for easy identification in RSI bio
  private readonly VERIFICATION_CODE_PREFIX = 'SCFM-';

  constructor(
    userRepository?: Repository<User>,
    organizationRepository?: Repository<Organization>,
    rsiApiService?: RsiApiService,
    notificationService?: RsiNotificationService
  ) {
    this.userRepository = userRepository ?? AppDataSource.getRepository(User);
    this.organizationRepository =
      organizationRepository ?? AppDataSource.getRepository(Organization);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.rsiApiService = rsiApiService ?? new RsiApiService();
    this.notificationService = notificationService ?? new RsiNotificationService();
  }

  /**
   * Generate a unique verification code
   * @returns A verification code prefixed with SCFM-
   */
  private generateVerificationCode(): string {
    // Use 12 bytes (24 hex characters) for better entropy and security
    const randomPart = crypto.randomBytes(12).toString('hex').toUpperCase();
    return `${this.VERIFICATION_CODE_PREFIX}${randomPart}`;
  }

  /**
   * Hash a verification code using SHA-256 HMAC
   * This ensures codes are not stored in plain text in the database
   * @param code - The plain text verification code
   * @returns The HMAC hash of the code
   */
  private hashVerificationCode(code: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required for HMAC operations');
    }
    return crypto.createHmac('sha256', secret).update(code).digest('hex');
  }

  /**
   * Check if a candidate code matches the stored hash
   * @param candidate - A candidate verification code from RSI bio
   * @param storedHash - The stored HMAC hash
   * @returns true if the candidate matches
   */
  private verifyCodeHash(candidate: string, storedHash: string): boolean {
    const candidateHash = this.hashVerificationCode(candidate);
    // Use timing-safe comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(candidateHash, 'hex'),
        Buffer.from(storedHash, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Initiate RSI handle verification for a user
   * This generates a verification code that the user must add to their RSI bio
   *
   * @param userId - The user ID initiating verification
   * @param rsiHandle - The RSI handle to verify
   * @returns Result containing the verification code
   */
  public async initiateVerification(
    userId: string,
    rsiHandle: string
  ): Promise<InitiateVerificationResult> {
    try {
      // Normalize handle (RSI handles are case-insensitive)
      const normalizedHandle = rsiHandle.trim();

      if (!normalizedHandle) {
        return {
          success: false,
          error: 'RSI handle is required',
        };
      }

      // Check if the RSI handle exists — try crawler first, fall back to API
      let handleExists = false;
      let handleError: string | undefined;
      let isExternalError = false;

      try {
        const citizenData = await rsiCrawlerService.crawlCitizen(normalizedHandle);
        handleExists = citizenData !== null;
        if (!handleExists) {
          handleError = 'RSI handle not found on robertsspaceindustries.com';
        }
      } catch {
        // Crawler failed — fall back to third-party API
        try {
          const verifyResult = await this.rsiApiService.verifyHandle(normalizedHandle);
          handleExists = verifyResult.verified;
          if (!handleExists) {
            handleError = verifyResult.error ?? 'RSI handle not found';
          }
        } catch {
          handleError = 'Unable to reach RSI to verify your handle. Please try again later.';
          isExternalError = true;
        }
      }

      if (!handleExists) {
        return {
          success: false,
          error: handleError ?? 'RSI handle not found',
          isExternalError,
        };
      }

      // Check if handle is already verified by another user
      const existingUser = await this.userRepository.findOne({
        where: {
          rsiHandle: normalizedHandle,
          rsiVerified: true,
        },
      });

      if (existingUser && existingUser.id !== userId) {
        return {
          success: false,
          error: 'This RSI handle is already verified by another account',
        };
      }

      // Generate verification code and hash it before storage
      const verificationCode = this.generateVerificationCode();
      const verificationCodeHash = this.hashVerificationCode(verificationCode);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.VERIFICATION_CODE_VALIDITY_HOURS);

      // Store the hash, not the plain code
      await this.userRepository.update(userId, {
        rsiHandle: normalizedHandle,
        rsiVerified: false,
        rsiVerificationCode: verificationCodeHash,
        rsiVerificationCodeExpiresAt: expiresAt,
      });

      logger.info(`RSI verification initiated for user ${userId} with handle ${normalizedHandle}`);
      rsiVerificationAnalytics.recordInitiation(userId);

      // Return plain code + profile link to user (only time it's available)
      return {
        success: true,
        verificationCode,
        verificationUrl: buildRsiVerificationUrl(verificationCode),
        expiresAt,
        rsiHandle: normalizedHandle,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initiate RSI verification for user ${userId}: ${errorMessage}`);

      return {
        success: false,
        error: 'An unexpected error occurred during RSI verification. Please try again later.',
        isExternalError: true,
      };
    }
  }

  /**
   * Set isVerified on the public directory profile for an organization.
   * Delegates to the owning PublicOrgDirectoryService.
   * Non-critical — logs and swallows errors so verification still succeeds.
   */
  private async setPublicProfileVerified(orgId: string, isVerified: boolean): Promise<void> {
    try {
      // Dynamic import to avoid circular dependency between user and organization services
      const { PublicOrgDirectoryService } =
        await import('../organization/PublicOrgDirectoryService');
      const directoryService = new PublicOrgDirectoryService();
      await directoryService.setVerificationStatus(orgId, isVerified);
    } catch (err: unknown) {
      logger.warn(
        `Failed to update public profile isVerified for org ${orgId}: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send a failure notification (non-blocking, best-effort).
   */
  private sendFailureNotification(userId: string, errorMessage: string): void {
    this.userRepository
      .findOne({ where: { id: userId } })
      .then(user => {
        if (user?.rsiHandle) {
          this.notificationService
            .sendVerificationFailed({
              userEmail: user.email,
              username: user.username,
              rsiHandle: user.rsiHandle,
              reason: errorMessage,
            })
            .catch(() => {
              /* notification failure is non-critical */
            });
        }
      })
      .catch(() => {
        /* ignore lookup errors */
      });
  }

  private getCompletionContext(user: User | null):
    | {
        user: User & { rsiHandle: string; rsiVerificationCode: string };
        verificationHash: string;
      }
    | { error: CompleteVerificationResult } {
    if (!user) {
      return {
        error: {
          success: false,
          verified: false,
          error: 'User not found',
        },
      };
    }

    if (!user.rsiHandle || !user.rsiVerificationCode) {
      return {
        error: {
          success: false,
          verified: false,
          error: 'No pending RSI verification found. Please initiate verification first.',
        },
      };
    }

    if (user.rsiVerificationCodeExpiresAt && user.rsiVerificationCodeExpiresAt < new Date()) {
      return {
        error: {
          success: false,
          verified: false,
          error: 'Verification code has expired. Please initiate a new verification.',
        },
      };
    }

    return {
      user: user as User & { rsiHandle: string; rsiVerificationCode: string },
      verificationHash: user.rsiVerificationCode,
    };
  }

  private async fetchVerificationProfileData(
    rsiHandle: string
  ): Promise<{ bio?: string; displayName?: string; citizenRecord?: string }> {
    try {
      const citizenData = await rsiCrawlerService.crawlCitizen(rsiHandle);
      return {
        bio: citizenData?.bio,
        displayName: citizenData?.displayName,
        citizenRecord: citizenData?.citizenRecord,
      };
    } catch {
      // Crawler failed — fall back to third-party API
      const userData = await this.rsiApiService.fetchUserData(rsiHandle);
      return {
        bio: userData?.bio,
        displayName: userData?.displayName ?? userData?.moniker,
      };
    }
  }

  private getCitizenRecordToPersist(
    crawledCitizenRecord: string | undefined,
    currentCitizenRecord: unknown
  ): string {
    if (typeof crawledCitizenRecord === 'string' && crawledCitizenRecord.length > 0) {
      return crawledCitizenRecord;
    }

    if (typeof currentCitizenRecord === 'string' && currentCitizenRecord.length > 0) {
      return currentCitizenRecord;
    }

    return NULL_STRING;
  }

  private async isCitizenRecordAlreadyVerifiedByAnotherUser(
    citizenRecord: string | undefined,
    userId: string
  ): Promise<boolean> {
    if (!citizenRecord) {
      return false;
    }

    const existingByRecord = await this.userRepository.findOne({
      where: { rsiCitizenRecord: citizenRecord, rsiVerified: true },
    });

    return Boolean(existingByRecord && existingByRecord.id !== userId);
  }

  private toOptionalString(value: unknown): string | undefined {
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  /**
   * Complete RSI handle verification by checking the bio for the verification code
   *
   * @param userId - The user ID completing verification
   * @returns Result indicating whether verification was successful
   */
  public async completeVerification(userId: string): Promise<CompleteVerificationResult> {
    try {
      // Get user with verification details
      const userRecord = await this.userRepository.findOne({
        where: { id: userId },
      });

      const completionContext = this.getCompletionContext(userRecord);
      if ('error' in completionContext) {
        return completionContext.error;
      }

      const { user, verificationHash: storedVerificationHash } = completionContext;

      // Fetch RSI profile data — try crawler first, fall back to API.
      // The verification link lives in the bio: it's long-form free text, so
      // adding a line is non-destructive (unlike the single Website field).
      // Immutable UEE Citizen Record — captured so the verified link survives
      // RSI handle renames and anchors anti-impersonation checks.
      const { bio, displayName, citizenRecord } = await this.fetchVerificationProfileData(
        user.rsiHandle
      );

      if (!bio) {
        return {
          success: false,
          verified: false,
          error:
            'No bio found on your RSI profile. Please add the verification link to your RSI profile bio and try again.',
        };
      }

      // Extract all potential SCFM verification tokens from the bio
      const codeFound = someRsiVerificationTokenMatches(bio, token =>
        this.verifyCodeHash(token, storedVerificationHash)
      );

      if (!codeFound) {
        rsiVerificationAnalytics.recordCompletion(
          userId,
          false,
          'Verification code not found in bio'
        );
        return {
          success: false,
          verified: false,
          error:
            'Verification link not found in your RSI bio. Please add the link to your RSI profile bio and try again.',
        };
      }

      // Anti-impersonation: the immutable citizen record must not already be
      // claimed by a different verified account (handles can be renamed, so the
      // record is the reliable dedup key).
      if (await this.isCitizenRecordAlreadyVerifiedByAnotherUser(citizenRecord, userId)) {
        return {
          success: false,
          verified: false,
          error: 'This RSI account is already verified by another user.',
        };
      }

      const citizenRecordToPersist = this.getCitizenRecordToPersist(
        citizenRecord,
        user.rsiCitizenRecord
      );

      // Mark as verified and clear verification code. Persist the immutable
      // citizen record when we were able to read it (best-effort).
      try {
        await this.userRepository.update(userId, {
          rsiVerified: true,
          rsiVerifiedAt: new Date(),
          rsiCitizenRecord: citizenRecordToPersist,
          rsiVerificationCode: NULL_STRING,
          rsiVerificationCodeExpiresAt: NULL_DATE,
        });
      } catch (error: unknown) {
        if (isVerifiedCitizenRecordConflict(error)) {
          return {
            success: false,
            verified: false,
            error: 'This RSI account is already verified by another user.',
          };
        }
        throw error;
      }

      logger.info(`RSI verification completed for user ${userId} with handle ${user.rsiHandle}`);
      rsiVerificationAnalytics.recordCompletion(userId, true);

      // Cross-sync: create/update RsiUserLink entries for the user's org memberships
      this.syncVerificationToUserLinks(userId, user.rsiHandle, user.discordId).catch(err => {
        logger.warn('Failed to cross-sync RSI verification to RsiUserLink table', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      // Assign "Verified" Discord role across the user's org guilds (non-blocking)
      this.syncVerifiedDiscordRole(user.discordId, userId, user.rsiHandle).catch(() => {
        /* Discord role sync is non-critical */
      });

      // Send success notification (non-blocking)
      this.notificationService
        .sendVerificationSuccess({
          userEmail: user.email,
          username: user.username,
          rsiHandle: user.rsiHandle,
          displayName: displayName ?? user.rsiHandle,
        })
        .catch(() => {
          /* notification failure is non-critical */
        });

      return {
        success: true,
        verified: true,
        rsiHandle: user.rsiHandle,
        displayName: displayName ?? user.rsiHandle,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to complete RSI verification for user ${userId}: ${errorMessage}`);
      rsiVerificationAnalytics.recordCompletion(userId, false, errorMessage);

      // Send failure notification (non-blocking)
      this.sendFailureNotification(userId, errorMessage);

      return {
        success: false,
        verified: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Auto-detect and finalize pending USER verifications.
   *
   * Scans for users who initiated verification (have a non-expired token) but
   * have not completed it, re-crawls each RSI profile, and completes
   * verification automatically when the token is found in the bio. This removes
   * the need for the user to click "Verify Now" — they only have to paste the
   * link into their RSI bio.
   *
   * @param limit - Maximum number of pending users to process per run
   * @returns Counts of profiles checked and newly verified
   */
  public async autoDetectUserVerifications(
    limit = 50
  ): Promise<{ checked: number; verified: number }> {
    const now = new Date();
    const pendingUsers = await this.userRepository
      .createQueryBuilder('user')
      .where('user.rsiVerified = :verified', { verified: false })
      .andWhere('user.rsiVerificationCode IS NOT NULL')
      .andWhere('user.rsiVerificationCodeExpiresAt IS NOT NULL')
      .andWhere('user.rsiVerificationCodeExpiresAt > :now', { now })
      .orderBy('user.rsiVerificationCodeExpiresAt', 'ASC')
      .take(limit)
      .getMany();

    let verified = 0;
    for (const user of pendingUsers) {
      try {
        const result = await this.completeVerification(user.id);
        if (result.verified) {
          verified += 1;
          logger.info(`Auto-detected RSI verification for user ${user.id}`);
        }
      } catch (error: unknown) {
        logger.warn(
          `Auto-detect failed for user ${user.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return { checked: pendingUsers.length, verified };
  }

  /**
   * Auto-detect and finalize pending ORGANIZATION verifications.
   *
   * Mirror of {@link autoDetectUserVerifications} for organizations. The org
   * owner is used as the acting user so the ownership/permission check passes
   * without an interactive request.
   *
   * @param limit - Maximum number of pending organizations to process per run
   * @returns Counts of organizations checked and newly verified
   */
  public async autoDetectOrganizationVerifications(
    limit = 50
  ): Promise<{ checked: number; verified: number }> {
    const now = new Date();
    const pendingOrgs = await this.organizationRepository
      .createQueryBuilder('org')
      .where('org.rsiVerified = :verified', { verified: false })
      .andWhere('org.rsiVerificationCode IS NOT NULL')
      .andWhere('org.rsiVerificationCodeExpiresAt IS NOT NULL')
      .andWhere('org.rsiVerificationCodeExpiresAt > :now', { now })
      .orderBy('org.rsiVerificationCodeExpiresAt', 'ASC')
      .take(limit)
      .getMany();

    let verified = 0;
    for (const org of pendingOrgs) {
      // Use the org owner as the acting user so the permission check passes
      if (!org.ownerId) {
        continue;
      }
      try {
        const result = await this.completeOrganizationVerification(org.ownerId, org.id);
        if (result.verified) {
          verified += 1;
          logger.info(`Auto-detected RSI verification for org ${org.id}`);
        }
      } catch (error: unknown) {
        logger.warn(
          `Auto-detect failed for org ${org.id}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
    }

    return { checked: pendingOrgs.length, verified };
  }

  /**
   * Get RSI verification status for a user
   *
   * @param userId - The user ID to check
   * @returns Current verification status
   */
  public async getVerificationStatus(userId: string): Promise<VerificationStatusResult> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      return {
        verified: false,
        pendingVerification: false,
      };
    }

    const pendingVerification = !!(
      user.rsiVerificationCode &&
      user.rsiVerificationCodeExpiresAt &&
      user.rsiVerificationCodeExpiresAt > new Date()
    );

    return {
      rsiHandle: user.rsiHandle,
      rsiCitizenRecord: this.toOptionalString(user.rsiCitizenRecord),
      verified: user.rsiVerified,
      verifiedAt: user.rsiVerifiedAt,
      pendingVerification,
      verificationCodeExpiresAt: pendingVerification
        ? user.rsiVerificationCodeExpiresAt
        : undefined,
    };
  }

  /**
   * Remove RSI verification from a user account
   *
   * @param userId - The user ID to unlink
   * @returns Success status
   */
  public async removeVerification(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Fetch discordId before clearing verification (needed for role removal)
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['id', 'discordId'],
      });

      await this.userRepository.update(userId, {
        rsiHandle: NULL_STRING,
        rsiCitizenRecord: NULL_STRING,
        rsiVerified: false,
        rsiVerifiedAt: NULL_DATE,
        rsiVerificationCode: NULL_STRING,
        rsiVerificationCodeExpiresAt: NULL_DATE,
      });

      logger.info(`RSI verification removed for user ${userId}`);

      // Cross-sync: clear RsiUserLink entries (non-blocking)
      this.clearUserLinksOnRemoval(userId).catch(() => {
        /* cross-sync failure is non-critical */
      });

      // Remove "Verified" Discord role (non-blocking)
      if (user?.discordId) {
        this.removeVerifiedDiscordRole(user.discordId, userId).catch(() => {
          /* Discord role sync is non-critical */
        });
      }

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to remove RSI verification for user ${userId}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /** Resolve the canonical SID for an RSI org using crawler first, API fallback. */
  private async resolveRsiOrgSid(normalizedSid: string): Promise<{ sid?: string; error?: string }> {
    try {
      const crawledOrg = await rsiCrawlerService.crawlOrganization(normalizedSid);
      return { sid: crawledOrg.sid };
    } catch (crawlerError: unknown) {
      logger.debug(`Crawler unavailable for org ${normalizedSid}, using Sentry API fallback`, {
        error: crawlerError instanceof Error ? crawlerError.message : String(crawlerError),
      });
    }
    try {
      const orgData = await this.rsiApiService.fetchOrganizationData(normalizedSid);
      return { sid: orgData?.sid };
    } catch (apiError: unknown) {
      logger.warn(`Both crawler and API failed for org ${normalizedSid}`, {
        error: apiError instanceof Error ? apiError.message : String(apiError),
      });
      return {
        error:
          'Unable to verify RSI organization at this time. RSI services may be temporarily unavailable — please try again later.',
      };
    }
  }

  /** Check if a user is a member and admin/owner of a given RSI org. */
  private async verifyRsiOrgMembership(
    rsiHandle: string,
    normalizedSid: string
  ): Promise<{ verified: boolean; isAdmin: boolean; error?: string }> {
    try {
      const memberships = await rsiCrawlerService.crawlUserMemberships(rsiHandle);
      const membership = memberships.find(m => m.sid.toUpperCase() === normalizedSid);
      if (membership) {
        const rankLower = (membership.rank ?? '').toLowerCase();
        const isOwner = RsiVerificationService.OWNER_RANKS.some(r => rankLower.includes(r));
        const isAdmin =
          isOwner ||
          RsiVerificationService.ADMIN_RANKS.some(r => rankLower.includes(r)) ||
          membership.stars >= RsiVerificationService.MIN_ADMIN_STARS;
        logger.debug(
          `RSI membership check for ${rsiHandle} in ${normalizedSid}: rank="${membership.rank}", stars=${membership.stars}, isOwner=${isOwner}, isAdmin=${isAdmin}`
        );
        return { verified: true, isAdmin };
      }
      return { verified: false, isAdmin: false };
    } catch (crawlerError: unknown) {
      logger.debug(
        `Crawler unavailable for memberships of ${rsiHandle}, using Sentry API fallback`,
        {
          error: crawlerError instanceof Error ? crawlerError.message : String(crawlerError),
        }
      );
    }
    try {
      const result = await this.rsiApiService.verifyOrganizationMembership(
        rsiHandle,
        normalizedSid
      );
      return { verified: result.verified, isAdmin: result.isAdmin };
    } catch (apiError: unknown) {
      logger.warn(
        `Both crawler and API failed for membership check of ${rsiHandle} in ${normalizedSid}`,
        {
          error: apiError instanceof Error ? apiError.message : String(apiError),
        }
      );
      return {
        verified: false,
        isAdmin: false,
        error:
          'Unable to verify your RSI organization membership at this time. RSI services may be temporarily unavailable — please try again later.',
      };
    }
  }

  /** Fetch org page content from crawler, falling back to API (description only).
   *  @param rsiSid - The RSI organization SID
   *  @param skipCache - If true, invalidate cached data before fetching (used during verification)
   */
  private async fetchRsiOrgContent(
    rsiSid: string,
    skipCache: boolean = false
  ): Promise<{
    description?: string;
    history?: string;
    manifesto?: string;
    charter?: string;
    name?: string;
  }> {
    try {
      if (skipCache) {
        rsiCrawlerService.invalidateOrgCache(rsiSid);
      }
      const crawled = await rsiCrawlerService.crawlOrganization(rsiSid);
      return {
        description: crawled.description,
        history: crawled.history,
        manifesto: crawled.manifesto,
        charter: crawled.charter,
        name: crawled.name,
      };
    } catch (crawlerError: unknown) {
      logger.debug(`Crawler unavailable for org ${rsiSid}, using Sentry API fallback`, {
        error: crawlerError instanceof Error ? crawlerError.message : String(crawlerError),
      });
      const orgData = await this.rsiApiService.fetchOrganizationData(rsiSid);
      return { description: orgData?.description, name: orgData?.name };
    }
  }

  /** Return a user-facing error if the RSI membership check disqualifies the user, or null if OK. */
  private getRsiMembershipError(
    check: { verified: boolean; isAdmin: boolean },
    rsiHandle: string,
    sid: string
  ): string | null {
    if (!check.verified) {
      return `Your RSI handle "${rsiHandle}" was not found as a member of RSI organization "${sid}". Make sure you are a member of this organization on robertsspaceindustries.com.`;
    }
    if (!check.isAdmin) {
      return 'You must be an admin or owner of the RSI organization to verify it. Your detected RSI rank does not have sufficient privileges (4+ stars required). If you believe this is incorrect, ensure your RSI profile and organization membership are publicly visible.';
    }
    return null;
  }

  /** Check if user has web-app permission to verify the org (owner or admin role). */
  private async checkWebAppOrgPermission(
    userId: string,
    orgId: string,
    organization: Organization
  ): Promise<string | null> {
    const isOwner = organization.ownerId === userId;
    if (isOwner) {
      return null;
    }
    const membership = await this.membershipRepository.findOne({
      where: { userId, organizationId: orgId, isActive: true },
    });
    const roleName = getRoleName(membership?.role);
    const isAdmin = roleName === 'admin' || roleName === 'owner' || roleName === 'founder';
    if (!isAdmin) {
      return 'Only organization owners and admins can verify RSI organizations';
    }
    return null;
  }

  /**
   * Initiate RSI organization verification
   * This generates a verification code that must be added to the RSI organization description
   *
   * @param userId - The user ID initiating verification (must be org owner/admin)
   * @param orgId - The organization ID to verify
   * @param rsiOrgSid - The RSI organization SID to verify
   * @returns Result containing the verification code
   */
  public async initiateOrganizationVerification(
    userId: string,
    orgId: string,
    rsiOrgSid: string
  ): Promise<InitiateVerificationResult> {
    try {
      // Normalize SID (RSI organization SIDs are uppercase)
      const normalizedSid = rsiOrgSid.trim().toUpperCase();

      if (!normalizedSid) {
        return {
          success: false,
          error: 'RSI organization SID is required',
        };
      }

      // Get the organization
      const organization = await this.organizationRepository.findOne({
        where: { id: orgId },
      });

      if (!organization) {
        return {
          success: false,
          error: 'Organization not found',
        };
      }

      // Check if user has permission (owner or admin) via membership roles
      const permissionError = await this.checkWebAppOrgPermission(userId, orgId, organization);
      if (permissionError) {
        return { success: false, error: permissionError };
      }

      // Check if the RSI organization exists
      const orgLookup = await this.resolveRsiOrgSid(normalizedSid);
      if (orgLookup.error) {
        return { success: false, error: orgLookup.error };
      }
      const orgSid = orgLookup.sid;

      if (!orgSid) {
        return {
          success: false,
          error: 'RSI organization not found',
        };
      }

      // Check if RSI SID is already verified by another organization
      const existingOrg = await this.organizationRepository.findOne({
        where: {
          rsiSid: normalizedSid,
          rsiVerified: true,
        },
      });

      if (existingOrg && existingOrg.id !== orgId) {
        return {
          success: false,
          error: 'This RSI organization is already verified by another organization',
        };
      }

      // Get user's verified RSI handle to check membership
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user?.rsiHandle) {
        return {
          success: false,
          error: 'You must set an RSI handle before verifying an organization',
        };
      }

      // Verify user is owner/admin of the RSI organization
      const memberCheck = await this.verifyRsiOrgMembership(user.rsiHandle, normalizedSid);
      if (memberCheck.error) {
        return { success: false, error: memberCheck.error };
      }

      const rsiMemberError = this.getRsiMembershipError(memberCheck, user.rsiHandle, normalizedSid);
      if (rsiMemberError) {
        return { success: false, error: rsiMemberError };
      }

      // Generate verification code and hash it before storage
      const verificationCode = this.generateVerificationCode();
      const verificationCodeHash = this.hashVerificationCode(verificationCode);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.VERIFICATION_CODE_VALIDITY_HOURS);

      // Store the hash, not the plain code
      await this.organizationRepository.update(orgId, {
        rsiSid: normalizedSid,
        rsiVerified: false,
        rsiVerificationCode: verificationCodeHash,
        rsiVerificationCodeExpiresAt: expiresAt,
      });

      logger.info(
        `RSI organization verification initiated for org ${orgId} with SID ${normalizedSid}`
      );
      rsiVerificationAnalytics.recordOrgInitiation(orgId);

      // Return plain code + profile link to user (only time it's available)
      return {
        success: true,
        verificationCode,
        verificationUrl: buildRsiVerificationUrl(verificationCode),
        expiresAt,
        rsiHandle: normalizedSid,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to initiate RSI org verification for org ${orgId}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Complete RSI organization verification by checking the description for the verification code
   *
   * @param userId - The user ID completing verification
   * @param orgId - The organization ID to verify
   * @returns Result indicating whether verification was successful
   */
  public async completeOrganizationVerification(
    userId: string,
    orgId: string
  ): Promise<CompleteVerificationResult> {
    try {
      // Get organization with verification details
      const organization = await this.organizationRepository.findOne({
        where: { id: orgId },
      });

      if (!organization) {
        return {
          success: false,
          verified: false,
          error: 'Organization not found',
        };
      }

      // Check if user has permission (owner or admin) via membership roles
      const isOwner = organization.ownerId === userId;
      let isAdmin = false;
      if (!isOwner) {
        const membership = await this.membershipRepository.findOne({
          where: { userId, organizationId: orgId, isActive: true },
        });
        const roleName = getRoleName(membership?.role);
        isAdmin = roleName === 'admin' || roleName === 'owner' || roleName === 'founder';
      }

      if (!isOwner && !isAdmin) {
        return {
          success: false,
          verified: false,
          error: 'Only organization owners and admins can complete verification',
        };
      }

      if (!organization.rsiSid || !organization.rsiVerificationCode) {
        return {
          success: false,
          verified: false,
          error:
            'No pending RSI organization verification found. Please initiate verification first.',
        };
      }

      // Check if verification code has expired
      if (
        organization.rsiVerificationCodeExpiresAt &&
        organization.rsiVerificationCodeExpiresAt < new Date()
      ) {
        return {
          success: false,
          verified: false,
          error: 'Verification code has expired. Please initiate a new verification.',
        };
      }

      // Get organization data from RSI (skip cache to pick up freshly-added verification code)
      const orgContent = await this.fetchRsiOrgContent(organization.rsiSid, true);
      const {
        description: orgDescription,
        history: orgHistory,
        manifesto: orgManifesto,
        charter: orgCharter,
        name: orgDisplayName,
      } = orgContent;

      // Combine all org page sections where the verification code may appear
      const searchableSections = [orgDescription, orgHistory, orgManifesto, orgCharter].filter(
        Boolean
      );

      if (searchableSections.length === 0) {
        return {
          success: false,
          verified: false,
          error:
            'No content found on your RSI organization page. Please add the verification code to the Introduction, History, Manifesto, or Charter and try again.',
        };
      }

      // Search all org page sections for the verification code
      const combinedText = searchableSections.join(' ');
      const storedHash = organization.rsiVerificationCode;
      const codeFound = someRsiVerificationTokenMatches(combinedText, token =>
        this.verifyCodeHash(token, storedHash)
      );

      if (!codeFound) {
        return {
          success: false,
          verified: false,
          error:
            'Verification code not found on your RSI organization page. Please add the code to the Introduction, History, Manifesto, or Charter and try again.',
        };
      }

      // Mark as verified and clear verification code
      await this.organizationRepository.update(orgId, {
        rsiVerified: true,
        rsiVerifiedAt: new Date(),
        rsiVerificationCode: NULL_STRING,
        rsiVerificationCodeExpiresAt: NULL_DATE,
      });

      // Also set isVerified on the public directory profile
      await this.setPublicProfileVerified(orgId, true);

      logger.info(
        `RSI organization verification completed for org ${orgId} with SID ${organization.rsiSid}`
      );
      rsiVerificationAnalytics.recordOrgCompletion(orgId, true);

      return {
        success: true,
        verified: true,
        rsiHandle: organization.rsiSid,
        displayName: orgDisplayName,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to complete RSI org verification for org ${orgId}: ${errorMessage}`);
      rsiVerificationAnalytics.recordOrgCompletion(orgId, false, errorMessage);

      return {
        success: false,
        verified: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Verify an RSI organization by rank — no verification code required.
   * The user must hold a 5-star rank, Founder, or Officer-level role on the RSI org page.
   *
   * @param userId - The user completing verification
   * @param orgId - The web-app organization ID
   * @param rsiOrgSid - The RSI organization SID (spectrum ID)
   * @returns Verification result
   */
  public async verifyOrganizationByRank(
    userId: string,
    orgId: string,
    rsiOrgSid: string
  ): Promise<CompleteVerificationResult> {
    try {
      const normalizedSid = rsiOrgSid.trim().toUpperCase();

      if (!normalizedSid) {
        return { success: false, verified: false, error: 'RSI organization SID is required' };
      }

      // Get the organization
      const organization = await this.organizationRepository.findOne({
        where: { id: orgId },
      });

      if (!organization) {
        return { success: false, verified: false, error: 'Organization not found' };
      }

      // Check if user has permission (owner or admin) via web-app membership roles
      const permissionError = await this.checkWebAppOrgPermission(userId, orgId, organization);
      if (permissionError) {
        return { success: false, verified: false, error: permissionError };
      }

      // Check if the RSI organization exists
      const orgLookup = await this.resolveRsiOrgSid(normalizedSid);
      if (orgLookup.error) {
        return { success: false, verified: false, error: orgLookup.error };
      }
      if (!orgLookup.sid) {
        return { success: false, verified: false, error: 'RSI organization not found' };
      }

      // Check if RSI SID is already verified by another organization
      const existingOrg = await this.organizationRepository.findOne({
        where: { rsiSid: normalizedSid, rsiVerified: true },
      });
      if (existingOrg && existingOrg.id !== orgId) {
        return {
          success: false,
          verified: false,
          error: 'This RSI organization is already verified by another organization',
        };
      }

      // Get user's verified RSI handle
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user?.rsiHandle) {
        return {
          success: false,
          verified: false,
          error: 'You must set an RSI handle before verifying an organization',
        };
      }

      // Verify user is owner/admin of the RSI organization via rank/stars
      const memberCheck = await this.verifyRsiOrgMembership(user.rsiHandle, normalizedSid);
      if (memberCheck.error) {
        return { success: false, verified: false, error: memberCheck.error };
      }
      if (!memberCheck.verified) {
        return {
          success: false,
          verified: false,
          error: `Your RSI handle "${user.rsiHandle}" was not found as a member of RSI organization "${normalizedSid}". Make sure you are a member of this organization on robertsspaceindustries.com.`,
        };
      }
      if (!memberCheck.isAdmin) {
        return {
          success: false,
          verified: false,
          error:
            'Rank-based verification requires Founder, Officer, or 5-star rank on the RSI organization. Your current rank does not meet this requirement. You can use the verification code method instead.',
        };
      }

      // Fetch org display name
      let orgDisplayName: string | undefined;
      try {
        const orgContent = await this.fetchRsiOrgContent(normalizedSid);
        orgDisplayName = orgContent.name;
      } catch {
        // Non-critical — verification still succeeds
      }

      // Mark as verified — clear any pending code-based verification
      await this.organizationRepository.update(orgId, {
        rsiSid: normalizedSid,
        rsiVerified: true,
        rsiVerifiedAt: new Date(),
        rsiVerificationCode: NULL_STRING,
        rsiVerificationCodeExpiresAt: NULL_DATE,
      });

      // Also set isVerified on the public directory profile
      await this.setPublicProfileVerified(orgId, true);

      logger.info(
        `RSI organization verification by rank completed for org ${orgId} with SID ${normalizedSid}`
      );
      rsiVerificationAnalytics.recordOrgCompletion(orgId, true);

      return {
        success: true,
        verified: true,
        rsiHandle: normalizedSid,
        displayName: orgDisplayName,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to verify RSI org by rank for org ${orgId}: ${errorMessage}`);
      rsiVerificationAnalytics.recordOrgCompletion(orgId, false, errorMessage);

      return { success: false, verified: false, error: errorMessage };
    }
  }

  /**
   * Verify organization ownership/admin status through RSI
   * This checks if the user is a founder or admin of the specified RSI organization
   *
   * @param userId - The user ID to verify
   * @param orgSid - The RSI organization SID to check
   * @returns Organization ownership verification result
   */
  public async verifyOrganizationOwnership(
    userId: string,
    orgSid: string
  ): Promise<OrgOwnershipVerificationResult> {
    try {
      // Get user's verified RSI handle
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          isOwner: false,
          isAdmin: false,
          error: 'User not found',
        };
      }

      if (!user.rsiHandle) {
        return {
          success: false,
          isOwner: false,
          isAdmin: false,
          error: 'RSI handle not set. Please add your RSI handle to your profile.',
        };
      }

      // Check organization membership — try crawler first, fall back to API
      let isOwner = false;
      let isAdmin = false;
      let orgName: string | undefined;
      let userRank: string | undefined;

      try {
        // Use crawler to check user's memberships on RSI
        const memberships = await rsiCrawlerService.crawlUserMemberships(user.rsiHandle);
        const membership = memberships.find(m => m.sid.toUpperCase() === orgSid.toUpperCase());

        if (!membership) {
          return {
            success: false,
            isOwner: false,
            isAdmin: false,
            error: `User ${user.rsiHandle} is not a member of RSI organization ${orgSid}`,
          };
        }

        orgName = membership.name;
        userRank = membership.rank;
        const rankLower = (membership.rank ?? '').toLowerCase();
        isOwner = RsiVerificationService.OWNER_RANKS.some(r => rankLower.includes(r));
        // Admin = owner rank, known admin rank, OR sufficient RSI star level
        isAdmin =
          isOwner ||
          RsiVerificationService.ADMIN_RANKS.some(r => rankLower.includes(r)) ||
          membership.stars >= RsiVerificationService.MIN_ADMIN_STARS;
      } catch {
        // Crawler failed — fall back to third-party API
        const membershipResult = await this.rsiApiService.verifyOrganizationMembership(
          user.rsiHandle,
          orgSid
        );

        if (!membershipResult.verified) {
          return {
            success: false,
            isOwner: false,
            isAdmin: false,
            error: membershipResult.error,
          };
        }

        isOwner = membershipResult.isOwner;
        isAdmin = membershipResult.isAdmin;
        orgName = membershipResult.name;
        userRank = membershipResult.rank;
      }

      // Crawl full org data for auto-population
      let rsiOrgData: OrgOwnershipVerificationResult['rsiOrgData'];
      try {
        const orgData = await rsiCrawlerService.crawlOrganization(orgSid);
        rsiOrgData = {
          description: orgData.description,
          logo: orgData.logo,
          banner: orgData.banner,
          archetype: orgData.archetype,
          commitment: orgData.commitment,
          memberCount: orgData.memberCount,
          focus: orgData.focus,
          recruiting: orgData.recruiting,
          language: orgData.language,
          links: orgData.links,
        };
        // Use org name from crawler if available (more accurate)
        if (orgData.name) {
          orgName = orgData.name;
        }
      } catch {
        // Org data fetch failed — non-critical, verification still works
        logger.warn(
          `Failed to fetch RSI org data for ${orgSid}, verification continues without auto-population`
        );
      }

      return {
        success: true,
        isOwner,
        isAdmin,
        orgSid,
        orgName,
        userRank,
        rsiOrgData,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        `Failed to verify organization ownership for user ${userId}/${orgSid}: ${errorMessage}`
      );

      return {
        success: false,
        isOwner: false,
        isAdmin: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Lookup RSI user profile without verification
   * This is a public lookup that doesn't require authentication
   *
   * @param handle - RSI handle to lookup
   * @returns RSI user data if found
   */
  public async lookupRsiUser(handle: string): Promise<RsiVerificationResult> {
    // Try crawler first — it scrapes RSI directly and does not depend on the Sentry API
    try {
      const citizenData = await rsiCrawlerService.crawlCitizen(handle);
      if (citizenData) {
        return {
          verified: true,
          handle: citizenData.handle,
          displayName: citizenData.displayName,
          bio: citizenData.bio,
        };
      }
      return { verified: false, error: 'RSI handle not found' };
    } catch (crawlerError: unknown) {
      // Crawler failed — fall back to third-party API
      logger.debug(`Crawler unavailable for citizen ${handle}, using Sentry API fallback`, {
        error: crawlerError instanceof Error ? crawlerError.message : String(crawlerError),
      });
      return this.rsiApiService.verifyHandle(handle);
    }
  }

  /**
   * Lookup RSI organization — try crawler first, fall back to API
   * Returns full org data including logo, banner, description for auto-population
   */
  public async lookupRsiOrganization(sid: string): Promise<{
    found: boolean;
    data?: {
      sid?: string;
      name?: string;
      description?: string;
      logo?: string;
      banner?: string;
      memberCount?: number;
      focus?: { primary?: string; secondary?: string };
      archetype?: string;
      commitment?: string;
      recruiting?: string;
      language?: string;
      links?: Record<string, string>;
      [key: string]: unknown;
    };
    error?: string;
  }> {
    // Try crawler first for richer data
    try {
      const crawled = await rsiCrawlerService.crawlOrganization(sid);
      return {
        found: true,
        data: {
          sid: crawled.sid,
          name: crawled.name,
          description: crawled.description,
          logo: crawled.logo,
          banner: crawled.banner,
          memberCount: crawled.memberCount,
          focus: crawled.focus,
          archetype: crawled.archetype,
          commitment: crawled.commitment,
          recruiting: crawled.recruiting,
          language: crawled.language,
          links: crawled.links,
        },
      };
    } catch {
      // Crawler failed — fall back to API
      try {
        const orgData = await this.rsiApiService.fetchOrganizationData(sid);
        if (orgData?.sid) {
          return { found: true, data: orgData };
        }
        return { found: false, error: 'Organization not found' };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { found: false, error: errorMessage };
      }
    }
  }

  /**
   * Request manual admin verification when RSI API is unavailable
   * This is a fallback method that creates a pending manual verification request
   * that an admin can approve
   *
   * @param userId - The user ID requesting manual verification
   * @param rsiHandle - The RSI handle to verify
   * @param reason - Optional reason for requesting manual verification
   * @returns Result indicating the request was submitted
   */
  public async requestManualVerification(
    userId: string,
    rsiHandle: string,
    reason?: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      const normalizedHandle = rsiHandle.trim();

      if (!normalizedHandle) {
        return {
          success: false,
          error: 'RSI handle is required',
        };
      }

      // Generate a unique request ID
      const requestId = `MANUAL-${Date.now()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

      // Update user with pending manual verification
      await this.userRepository.update(userId, {
        rsiHandle: normalizedHandle,
        rsiVerified: false,
        rsiVerificationCode: requestId,
        rsiVerificationCodeExpiresAt: NULL_DATE, // Manual requests don't expire
        manualVerificationRequested: true,
        manualVerificationReason: reason ?? 'RSI API unavailable',
      });

      logger.info(
        `Manual RSI verification requested for user ${userId} with handle ${normalizedHandle}, requestId: ${requestId}`
      );

      return {
        success: true,
        requestId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to request manual RSI verification for user ${userId}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Admin approval for manual verification request
   * Only admins should call this method
   *
   * @param userId - The user ID to approve
   * @param adminId - The admin approving the verification
   * @param approved - Whether to approve or reject
   * @param notes - Optional admin notes
   * @returns Result indicating approval status
   */
  public async processManualVerification(
    userId: string,
    adminId: string,
    approved: boolean,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
      });

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      if (!user.rsiHandle) {
        return {
          success: false,
          error: 'No RSI handle found for this user',
        };
      }

      if (approved) {
        // Approve the manual verification
        await this.userRepository.update(userId, {
          rsiVerified: true,
          rsiVerifiedAt: new Date(),
          rsiVerificationCode: NULL_STRING,
          rsiVerificationCodeExpiresAt: NULL_DATE,
          manualVerificationRequested: false,
          manualVerificationApprovedBy: adminId,
          manualVerificationApprovedAt: new Date(),
          manualVerificationNotes: notes,
        });

        logger.info(`Manual RSI verification approved for user ${userId} by admin ${adminId}`);

        // Assign "Verified" Discord role (non-blocking)
        if (user.discordId) {
          this.syncVerifiedDiscordRole(user.discordId, userId, user.rsiHandle).catch(() => {
            /* Discord role sync is non-critical */
          });
        }
      } else {
        // Reject the manual verification
        await this.userRepository.update(userId, {
          rsiVerificationCode: NULL_STRING,
          manualVerificationRequested: false,
          manualVerificationRejectedBy: adminId,
          manualVerificationRejectedAt: new Date(),
          manualVerificationNotes: notes,
        });

        logger.info(`Manual RSI verification rejected for user ${userId} by admin ${adminId}`);
      }

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to process manual verification for user ${userId}: ${errorMessage}`);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get list of pending manual verification requests
   * Only admins should call this method
   *
   * @returns List of users with pending manual verification requests
   */
  public async getPendingManualVerifications(): Promise<{
    users: { id: string; rsiHandle: string; requestedAt: Date; reason?: string }[];
    error?: string;
  }> {
    try {
      const users = await this.userRepository.find({
        where: { manualVerificationRequested: true },
        select: ['id', 'rsiHandle', 'createdAt', 'manualVerificationReason'],
      });

      return {
        users: users.map(u => ({
          id: u.id,
          rsiHandle: u.rsiHandle ?? '',
          requestedAt: u.createdAt,
          reason: u.manualVerificationReason,
        })),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to get pending manual verifications: ${errorMessage}`);

      return {
        users: [],
        error: errorMessage,
      };
    }
  }

  /* ════════════════════════════════════════════════════════════════ */
  /*  RsiUserLink cross-sync helpers                                 */
  /* ════════════════════════════════════════════════════════════════ */

  /**
   * Cross-sync: when web app verification succeeds, create/update
   * RsiUserLink entries for each org the user belongs to.
   * This ensures bot-side systems (sync, audit) see the verification.
   */
  private async syncVerificationToUserLinks(
    userId: string,
    rsiHandle: string,
    discordId?: string
  ): Promise<void> {
    const orgIds = await this.getUserOrgIds(userId);
    if (orgIds.length === 0) {
      return;
    }

    await rsiUserLinkService.syncVerifiedUserAcrossOrganizations(
      userId,
      rsiHandle,
      orgIds,
      discordId
    );
  }

  /**
   * Cross-sync: when web app removes verification, clear related
   * RsiUserLink entries so bot-side systems are consistent.
   */
  private async clearUserLinksOnRemoval(userId: string): Promise<void> {
    try {
      await rsiUserLinkService.removeAllLinksForUser(userId);
    } catch (err: unknown) {
      logger.warn('Failed to clear RsiUserLink entries on removal', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /* ════════════════════════════════════════════════════════════════ */
  /*  Discord verified-role sync helpers                             */
  /* ════════════════════════════════════════════════════════════════ */

  /**
   * Assign the "Verified" Discord role across the user's org guilds.
   */
  private async syncVerifiedDiscordRole(
    discordId: string,
    userId: string,
    rsiHandle?: string
  ): Promise<void> {
    if (!discordId) {
      return;
    }

    const orgIds = await this.getUserOrgIds(userId);
    if (orgIds.length === 0) {
      return;
    }

    const { VerifiedRoleSyncService } = await import('../discord/VerifiedRoleSyncService');
    await VerifiedRoleSyncService.getInstance().assignVerifiedRole(discordId, orgIds, rsiHandle);
  }

  /**
   * Remove the "Verified" Discord role across the user's org guilds.
   */
  private async removeVerifiedDiscordRole(discordId: string, userId: string): Promise<void> {
    if (!discordId) {
      return;
    }

    const orgIds = await this.getUserOrgIds(userId);
    if (orgIds.length === 0) {
      return;
    }

    const { VerifiedRoleSyncService } = await import('../discord/VerifiedRoleSyncService');
    await VerifiedRoleSyncService.getInstance().removeVerifiedRole(discordId, orgIds);
  }

  /**
   * Get all organization IDs a user is a member of.
   */
  private async getUserOrgIds(userId: string): Promise<string[]> {
    const memberships = await this.membershipRepository.find({
      where: { userId, isActive: true },
      select: ['organizationId'],
    });
    return memberships.map(m => m.organizationId);
  }
}

