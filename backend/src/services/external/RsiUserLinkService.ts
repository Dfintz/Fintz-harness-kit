import { FlagSeverity, MemberFlagType } from '@sc-fleet-manager/shared-types';
import { IsNull, Not, Repository, UpdateResult } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { RsiRoleMapping } from '../../models/RsiRoleMapping';
import { RsiUserLink, SyncStatus, VerificationMethod } from '../../models/RsiUserLink';
import { TeamMember } from '../../models/TeamMember';
import { logger } from '../../utils/logger';
import { isVerifiedCitizenRecordConflict } from '../../utils/rsiVerificationDbConflict';
import {
  buildRsiVerificationUrl,
  containsRsiVerificationToken,
} from '../../utils/rsiVerificationToken';
import { domainEvents } from '../shared/DomainEventBus';
import { TeamService } from '../team/TeamService';

import { createRoleSyncRateLimiter, wrapWithRoleSyncBackpressure } from './roleSyncBackpressure';
import { rsiApiService } from './RSIApiService';
import { rsiCrawlerService } from './RsiCrawlerService';
import { rsiRoleMappingService } from './RsiRoleMappingService';
import { rsiRoleSyncService } from './RsiRoleSyncService';
// Input/result/config types + the AffiliateHandling enum live in a sibling module
// (E5 decomposition); imported back (the enum as a value — used at runtime) and
// re-exported so importers, incl. the `services/rsi` barrel + `rsiSyncScheduler`,
// are unchanged.
import type {
  CreateUserLinkInput,
  OrgSyncConfig,
  OrgSyncResult,
  UserSyncResult,
  VerificationResult,
} from './RsiUserLinkService.types';
import { AffiliateHandling } from './RsiUserLinkService.types';

export { AffiliateHandling } from './RsiUserLinkService.types';
export type {
  CreateUserLinkInput,
  OrgSyncConfig,
  OrgSyncResult,
  UserSyncResult,
  VerificationResult,
} from './RsiUserLinkService.types';

/**
 * RSI User Link Service
 *
 * Manages user links between platform users and RSI handles.
 * Provides verification methods and role synchronization.
 *
 * Phase 3: RSI Role Sync System - User Verification & Synchronization
 *
 * Features:
 * - Link/unlink RSI handles to users
 * - Multiple verification methods (manual, bio_code, discord_match)
 * - Automatic role synchronization
 * - Departed member handling
 * - Affiliate handling options
 */
export class RsiUserLinkService {
  private userLinkRepository: Repository<RsiUserLink>;
  private roleMappingRepository: Repository<RsiRoleMapping>;
  private _teamService?: TeamService;

  private get teamService(): TeamService {
    this._teamService ??= new TeamService();
    return this._teamService;
  }

  constructor() {
    this.userLinkRepository = AppDataSource.getRepository(RsiUserLink);
    this.roleMappingRepository = AppDataSource.getRepository(RsiRoleMapping);
    logger.info('RsiUserLinkService initialized');
  }

  // ==================== LINK MANAGEMENT ====================

  /**
   * Create a new user link
   */
  public async createLink(input: CreateUserLinkInput): Promise<RsiUserLink> {
    try {
      // Check for existing link
      const existing = await this.userLinkRepository.findOne({
        where: {
          userId: input.userId,
          organizationId: input.organizationId,
        },
      });

      if (existing) {
        throw new Error('User already has a link for this organization');
      }

      // Generate verification code for bio_code method
      let verificationCode: string | undefined;
      if (input.verificationMethod === VerificationMethod.BIO_CODE) {
        verificationCode = RsiUserLink.generateVerificationCode();
      }

      const link = this.userLinkRepository.create({
        userId: input.userId,
        organizationId: input.organizationId,
        rsiHandle: input.rsiHandle,
        verificationMethod: input.verificationMethod,
        verificationCode,
        discordUserId: input.discordUserId,
        syncStatus: SyncStatus.PENDING,
      });

      const saved = await this.userLinkRepository.save(link);
      logger.info(`Created user link for ${input.rsiHandle}`, {
        userId: input.userId,
        organizationId: input.organizationId,
      });

      return saved;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to create user link', { error: errorMessage, input });
      throw error;
    }
  }

  /**
   * Get a user link by ID
   */
  public async getLinkById(id: string): Promise<RsiUserLink | null> {
    return this.userLinkRepository.findOne({ where: { id } });
  }

  /**
   * Get a user link for a specific user and organization
   */
  public async getLinkByUserAndOrg(
    userId: string,
    organizationId: string
  ): Promise<RsiUserLink | null> {
    return this.userLinkRepository.findOne({
      where: { userId, organizationId },
    });
  }

  /**
   * Get all links for a user
   */
  public async getLinksByUser(userId: string): Promise<RsiUserLink[]> {
    return this.userLinkRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get all links for an organization
   */
  public async getLinksByOrganization(
    organizationId: string,
    includeRemoved: boolean = false
  ): Promise<RsiUserLink[]> {
    const queryBuilder = this.userLinkRepository
      .createQueryBuilder('link')
      .where('link.organizationId = :organizationId', { organizationId });

    if (!includeRemoved) {
      queryBuilder.andWhere('link.syncStatus != :removed', { removed: SyncStatus.REMOVED });
    }

    return queryBuilder.orderBy('link.createdAt', 'DESC').getMany();
  }

  /**
   * Get link by RSI handle and organization
   */
  public async getLinkByHandleAndOrg(
    rsiHandle: string,
    organizationId: string
  ): Promise<RsiUserLink | null> {
    return this.userLinkRepository.findOne({
      where: { rsiHandle, organizationId },
    });
  }

  /**
   * Get link by Discord user ID and organization
   */
  public async getLinkByDiscordAndOrg(
    discordUserId: string,
    organizationId: string
  ): Promise<RsiUserLink | null> {
    return this.userLinkRepository.findOne({
      where: { discordUserId, organizationId },
    });
  }

  /**
   * Update a user link
   */
  public async updateLink(
    id: string,
    updates: Partial<
      Pick<RsiUserLink, 'rsiHandle' | 'discordUserId' | 'metadata' | 'lastKnownRank'>
    >
  ): Promise<RsiUserLink | null> {
    const link = await this.userLinkRepository.findOne({ where: { id } });
    if (!link) {
      return null;
    }

    if (updates.rsiHandle !== undefined) {
      const oldHandle = link.rsiHandle;
      link.rsiHandle = updates.rsiHandle;
      // Reset verification if handle changes
      link.verifiedAt = undefined;
      link.syncStatus = SyncStatus.PENDING;

      // P0 — Emit handle-changed event for audit trail
      if (oldHandle !== updates.rsiHandle) {
        domainEvents.emit('member:rsi_handle_changed', {
          timestamp: new Date().toISOString(),
          userId: link.userId,
          organizationId: link.organizationId,
          oldHandle,
          newHandle: updates.rsiHandle,
          rsiOrgSid: ((link.metadata as Record<string, unknown>)?.rsiOrgSid as string) ?? '',
        });
      }
    }
    if (updates.discordUserId !== undefined) {
      // P2 — Detect Discord unlink (had a value → cleared)
      const oldDiscordId = link.discordUserId;
      if (oldDiscordId && !updates.discordUserId) {
        domainEvents.emit('member:discord_unlinked', {
          timestamp: new Date().toISOString(),
          userId: link.userId,
          organizationId: link.organizationId,
          discordId: oldDiscordId,
        });
      }
      link.discordUserId = updates.discordUserId;
    }
    if (updates.metadata !== undefined) {
      link.metadata = updates.metadata;
    }
    if (updates.lastKnownRank !== undefined) {
      link.lastKnownRank = updates.lastKnownRank;
    }

    return this.userLinkRepository.save(link);
  }

  /**
   * Delete a user link
   */
  public async deleteLink(id: string): Promise<boolean> {
    // Capture userId before deletion for cross-sync
    const link = await this.getLinkById(id);
    const result = await this.userLinkRepository.delete(id);
    const deleted = (result.affected ?? 0) > 0;
    if (deleted && link) {
      await this.clearVerificationFromUser(link.userId);
    }
    return deleted;
  }

  /**
   * Unlink a user from an organization
   */
  public async unlinkUser(userId: string, organizationId: string): Promise<boolean> {
    const result = await this.userLinkRepository.delete({
      userId,
      organizationId,
    });

    if ((result.affected ?? 0) > 0) {
      logger.info(`Unlinked user ${userId} from organization ${organizationId}`);
      await this.clearVerificationFromUser(userId);
      return true;
    }
    return false;
  }

  /**
   * Ensure verified link projections exist for all organization memberships.
   *
   * This keeps bot-facing link data aligned with successful web verification
   * while preserving ownership in the RSI link domain.
   */
  public async syncVerifiedUserAcrossOrganizations(
    userId: string,
    rsiHandle: string,
    organizationIds: string[],
    discordUserId?: string
  ): Promise<void> {
    if (organizationIds.length === 0) {
      return;
    }

    for (const organizationId of organizationIds) {
      const existing = await this.userLinkRepository.findOne({
        where: { userId, organizationId },
      });

      if (existing) {
        existing.rsiHandle = rsiHandle;
        if (!existing.isVerified()) {
          existing.markVerified();
        }
        if (discordUserId) {
          existing.discordUserId = discordUserId;
        }
        await this.userLinkRepository.save(existing);
        continue;
      }

      const link = this.userLinkRepository.create({
        userId,
        organizationId,
        rsiHandle,
        verificationMethod: VerificationMethod.BIO_CODE,
        verifiedAt: new Date(),
        syncStatus: SyncStatus.PENDING,
        discordUserId,
      });
      await this.userLinkRepository.save(link);
    }

    logger.debug(`Synced RSI verification to ${organizationIds.length} RsiUserLink entries`, {
      userId,
    });
  }

  /**
   * Remove all link projections for a user.
   */
  public async removeAllLinksForUser(userId: string): Promise<void> {
    const result = await this.userLinkRepository.delete({ userId });
    if ((result.affected ?? 0) > 0) {
      await this.clearVerificationFromUser(userId);
    }

    logger.debug(`Cleared RsiUserLink entries for user ${userId}`, {
      userId,
      removed: result.affected ?? 0,
    });
  }

  // ==================== VERIFICATION ====================

  /**
   * Verify a user link using the configured verification method
   */
  public async verifyLink(linkId: string, rsiOrgSid: string): Promise<VerificationResult> {
    try {
      const link = await this.getLinkById(linkId);
      if (!link) {
        return { success: false, verified: false, error: 'Link not found' };
      }

      let result: VerificationResult;

      switch (link.verificationMethod) {
        case VerificationMethod.MANUAL:
          // Manual verification is handled by admins
          result = { success: true, verified: true };
          break;

        case VerificationMethod.BIO_CODE:
          result = await this.verifyBioCode(link, rsiOrgSid);
          break;

        case VerificationMethod.DISCORD_MATCH:
          result = await this.verifyDiscordMatch(link, rsiOrgSid);
          break;

        default:
          result = { success: false, verified: false, error: 'Unknown verification method' };
      }

      if (result.verified) {
        // P1 — Impersonation check: ensure no OTHER verified user owns this handle
        const existingConflict = await this.userLinkRepository.findOne({
          where: {
            rsiHandle: link.rsiHandle,
            organizationId: link.organizationId,
            verifiedAt: Not(IsNull()),
          },
        });
        if (existingConflict && existingConflict.userId !== link.userId) {
          logger.warn('Impersonation suspected: RSI handle conflict', {
            rsiHandle: link.rsiHandle,
            existingUserId: existingConflict.userId,
            newUserId: link.userId,
            organizationId: link.organizationId,
          });
          // Flag BOTH users — await to ensure flags are created before returning
          const { MemberAuditService } = await import('../intel/MemberAuditService');
          const auditService = new MemberAuditService();
          const flagDto = {
            flagType: MemberFlagType.IMPERSONATION_SUSPECTED,
            severity: FlagSeverity.CRITICAL,
            description: `RSI handle \"${link.rsiHandle}\" is claimed by multiple users`,
            metadata: {
              rsiHandle: link.rsiHandle,
              conflictingUserId: existingConflict.userId,
              newUserId: link.userId,
            },
          };
          try {
            await auditService.createFlag({
              ...flagDto,
              userId: link.userId,
              organizationId: link.organizationId,
            });
            await auditService.createFlag({
              ...flagDto,
              userId: existingConflict.userId,
              organizationId: link.organizationId,
              description: `RSI handle \"${link.rsiHandle}\" is being claimed by another user`,
            });
          } catch (e: unknown) {
            logger.error('Failed to create impersonation flags', { error: e });
          }

          return {
            success: false,
            verified: false,
            error: 'RSI handle is already verified by another user',
          };
        }

        link.markVerified();
        if (result.rank) {
          link.lastKnownRank = result.rank;
        }
        if (result.isAffiliate !== undefined) {
          link.isAffiliate = result.isAffiliate;
        }
        await this.userLinkRepository.save(link);
        logger.info(`Verified link for ${link.rsiHandle}`, {
          linkId,
          method: link.verificationMethod,
        });

        // Cross-sync: update User.rsiHandle/rsiVerified
        const syncResult = await this.syncVerificationToUser(link);
        if (!syncResult.success) {
          logger.warn('Link verified but user projection sync failed', {
            linkId,
            userId: link.userId,
            error: syncResult.error,
          });
        }

        // Wave 2.1 — emit domain event for audit service
        domainEvents.emit('member:rsi_org_joined', {
          timestamp: new Date().toISOString(),
          userId: link.userId,
          organizationId: link.organizationId,
          rsiHandle: link.rsiHandle,
          rsiOrgSid,
          rsiOrgName: rsiOrgSid, // OrgSyncConfig lacks display name
          isHostile: false,
          isRedacted: false,
        });
      }

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Verification failed', { error: errorMessage, linkId });
      return { success: false, verified: false, error: errorMessage };
    }
  }

  /**
   * Manually verify a link (admin action)
   * @returns The verified link, or null if not found
   */
  public async manuallyVerify(linkId: string): Promise<RsiUserLink | null> {
    const link = await this.getLinkById(linkId);
    if (!link) {
      return null;
    }

    link.markVerified();
    await this.userLinkRepository.save(link);
    logger.info(`Manually verified link for ${link.rsiHandle}`, { linkId });
    return link;
  }

  /**
   * Bulk manually verify multiple links (admin action)
   * @param linkIds - Array of link IDs to verify
   * @returns Results per link
   */
  public async bulkManuallyVerify(linkIds: string[]): Promise<{
    verified: number;
    failed: number;
    results: { linkId: string; success: boolean; rsiHandle?: string; error?: string }[];
  }> {
    const results: { linkId: string; success: boolean; rsiHandle?: string; error?: string }[] = [];
    let verified = 0;
    let failed = 0;

    for (const linkId of linkIds) {
      try {
        const link = await this.getLinkById(linkId);
        if (!link) {
          results.push({ linkId, success: false, error: 'Link not found' });
          failed++;
          continue;
        }

        if (link.isVerified()) {
          results.push({
            linkId,
            success: true,
            rsiHandle: link.rsiHandle,
            error: 'Already verified',
          });
          verified++;
          continue;
        }

        link.markVerified();
        await this.userLinkRepository.save(link);
        results.push({ linkId, success: true, rsiHandle: link.rsiHandle });
        verified++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ linkId, success: false, error: errorMessage });
        failed++;
      }
    }

    logger.info(
      `Bulk verification: ${verified} verified, ${failed} failed out of ${linkIds.length}`
    );
    return { verified, failed, results };
  }

  /**
   * Bulk create and verify links for multiple users (admin action)
   * @param organizationId - Organization ID
   * @param entries - Array of user-handle pairs to link and verify
   * @returns Results per entry
   */
  public async bulkCreateAndVerify(
    organizationId: string,
    entries: { userId: string; rsiHandle: string; discordUserId?: string }[]
  ): Promise<{
    created: number;
    skipped: number;
    failed: number;
    results: {
      userId: string;
      rsiHandle: string;
      success: boolean;
      linkId?: string;
      error?: string;
    }[];
  }> {
    const results: {
      userId: string;
      rsiHandle: string;
      success: boolean;
      linkId?: string;
      error?: string;
    }[] = [];
    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        // Check if link already exists
        const existing = await this.getLinkByUserAndOrg(entry.userId, organizationId);
        if (existing) {
          results.push({
            userId: entry.userId,
            rsiHandle: entry.rsiHandle,
            success: true,
            linkId: existing.id,
            error: 'Link already exists',
          });
          skipped++;
          continue;
        }

        // Create and verify
        const link = await this.createLink({
          userId: entry.userId,
          organizationId,
          rsiHandle: entry.rsiHandle,
          verificationMethod: VerificationMethod.MANUAL,
          discordUserId: entry.discordUserId,
        });

        link.markVerified();
        await this.userLinkRepository.save(link);

        // Wave 2.1 — emit domain event for audit service
        domainEvents.emit('member:rsi_org_joined', {
          timestamp: new Date().toISOString(),
          userId: entry.userId,
          organizationId,
          rsiHandle: entry.rsiHandle,
          rsiOrgSid: organizationId, // bulk verify doesn't have RSI SID context
          rsiOrgName: entry.rsiHandle,
          isHostile: false,
          isRedacted: false,
        });

        results.push({
          userId: entry.userId,
          rsiHandle: entry.rsiHandle,
          success: true,
          linkId: link.id,
        });
        created++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          userId: entry.userId,
          rsiHandle: entry.rsiHandle,
          success: false,
          error: errorMessage,
        });
        failed++;
      }
    }

    logger.info(`Bulk create+verify: ${created} created, ${skipped} skipped, ${failed} failed`);
    return { created, skipped, failed, results };
  }

  /**
   * Verify using bio code method
   */
  private async verifyBioCode(link: RsiUserLink, rsiOrgSid: string): Promise<VerificationResult> {
    if (!link.verificationCode) {
      return { success: false, verified: false, error: 'No verification code generated' };
    }

    try {
      // Invalidate crawler cache to ensure fresh data for verification
      rsiCrawlerService.invalidateCitizenCache(link.rsiHandle);
      // Fetch user profile from RSI
      const profileData = await rsiApiService.fetchUserData(link.rsiHandle);

      if (!profileData) {
        return { success: false, verified: false, error: 'Could not fetch RSI profile' };
      }

      // Check if verification code is in the bio
      const bio = profileData.bio || '';
      if (!containsRsiVerificationToken(bio, link.verificationCode)) {
        return {
          success: true,
          verified: false,
          error: `Verification link not found in bio. Please add: ${buildRsiVerificationUrl(
            link.verificationCode
          )}`,
        };
      }

      // Verify organization membership
      const memberResult = await rsiApiService.verifyOrganizationMembership(
        link.rsiHandle,
        rsiOrgSid
      );

      if (!memberResult.verified) {
        return {
          success: true,
          verified: false,
          error: `User is not a member of organization ${rsiOrgSid}`,
        };
      }

      return {
        success: true,
        verified: true,
        rank: memberResult.rank,
        isAffiliate: memberResult.rank?.toLowerCase().includes('affiliate'),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, verified: false, error: errorMessage };
    }
  }

  /**
   * Verify bio code only — checks that the user's RSI bio contains
   * the verification code. Does NOT check org membership.
   * Used for user identity verification (bot + web app unification).
   */
  public async verifyBioCodeOnly(link: RsiUserLink): Promise<VerificationResult> {
    if (!link.verificationCode) {
      return { success: false, verified: false, error: 'No verification code generated' };
    }

    try {
      // Invalidate crawler cache to ensure fresh bio data for verification
      rsiCrawlerService.invalidateCitizenCache(link.rsiHandle);
      const profileData = await rsiApiService.fetchUserData(link.rsiHandle);

      if (!profileData) {
        return { success: false, verified: false, error: 'Could not fetch RSI profile' };
      }

      const bio = profileData.bio || '';
      if (!containsRsiVerificationToken(bio, link.verificationCode)) {
        return {
          success: true,
          verified: false,
          error: `Verification link not found in bio. Please add: ${buildRsiVerificationUrl(
            link.verificationCode
          )}`,
        };
      }

      const citizenRecord =
        typeof profileData.citizenRecord === 'string' ? profileData.citizenRecord.trim() : '';

      if (citizenRecord) {
        const hasConflict = await this.hasCitizenRecordConflict(link.userId, citizenRecord);
        if (hasConflict) {
          return {
            success: false,
            verified: false,
            error: 'This RSI account is already verified by another user.',
          };
        }
      }

      // Bio code found — check for impersonation before marking verified
      const existingConflict = await this.userLinkRepository.findOne({
        where: {
          rsiHandle: link.rsiHandle,
          organizationId: link.organizationId,
          verifiedAt: Not(IsNull()),
        },
      });
      if (existingConflict && existingConflict.userId !== link.userId) {
        logger.warn('Impersonation suspected during bio-only verify', {
          rsiHandle: link.rsiHandle,
          existingUserId: existingConflict.userId,
          newUserId: link.userId,
          organizationId: link.organizationId,
        });
        return {
          success: false,
          verified: false,
          error: 'RSI handle is already verified by another user',
        };
      }

      // Cross-sync first in strict mode to prevent marking the link verified
      // when immutable identity dedupe fails at the User table layer.
      const syncResult = await this.syncVerificationToUser(link, citizenRecord || undefined, true);
      if (!syncResult.success) {
        return {
          success: false,
          verified: false,
          error: syncResult.error ?? 'Failed to sync RSI verification to user profile',
        };
      }

      // Bio code found — mark verified after user sync succeeds
      link.markVerified();
      await this.userLinkRepository.save(link);
      logger.info(`Bio-verified link for ${link.rsiHandle}`, {
        linkId: link.id,
        method: link.verificationMethod,
      });

      return { success: true, verified: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, verified: false, error: errorMessage };
    }
  }

  /**
   * Check if an immutable RSI citizen record is already owned by another verified user.
   */
  private async hasCitizenRecordConflict(userId: string, citizenRecord: string): Promise<boolean> {
    const { User: UserEntity } = await import('../../models/User');
    const userRepo = AppDataSource.getRepository(UserEntity);
    const existing = await userRepo.findOne({
      where: { rsiCitizenRecord: citizenRecord, rsiVerified: true },
    });
    return !!(existing && existing.id !== userId);
  }

  /**
   * Cross-sync: propagate RSI verification status to the User table.
   * Keeps User.rsiHandle/rsiVerified/rsiVerifiedAt in sync with RsiUserLink.
   */
  private async syncVerificationToUser(
    link: RsiUserLink,
    citizenRecord?: string,
    strict: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { User: UserEntity } = await import('../../models/User');
      const userRepo = AppDataSource.getRepository(UserEntity);

      const updatePayload: {
        rsiHandle: string;
        rsiVerified: true;
        rsiVerifiedAt: Date;
        rsiCitizenRecord?: string;
      } = {
        rsiHandle: link.rsiHandle,
        rsiVerified: true,
        rsiVerifiedAt: new Date(),
      };

      if (citizenRecord) {
        updatePayload.rsiCitizenRecord = citizenRecord;
      }

      const updateResult: UpdateResult = await userRepo.update(link.userId, updatePayload);
      if ((updateResult.affected ?? 0) === 0) {
        const notFoundError = 'User profile not found for RSI verification sync';
        logger.warn('User projection sync skipped because user was not found', {
          userId: link.userId,
          linkId: link.id,
        });
        return { success: false, error: notFoundError };
      }

      logger.debug(`Synced RSI verification to User table for user ${link.userId}`);
      return { success: true };
    } catch (err: unknown) {
      if (isVerifiedCitizenRecordConflict(err)) {
        const conflictMessage = 'This RSI account is already verified by another user.';
        logger.warn('RSI citizen record uniqueness conflict during user sync', {
          userId: link.userId,
          rsiHandle: link.rsiHandle,
        });
        return { success: false, error: conflictMessage };
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to sync RSI verification to User table', {
        userId: link.userId,
        error: errorMessage,
      });

      if (strict) {
        return { success: false, error: errorMessage };
      }

      return { success: false, error: 'Failed to sync RSI verification to user profile' };
    }
  }

  /**
   * Cross-sync: clear RSI verification on User table if no other verified links remain.
   */
  private async clearVerificationFromUser(userId: string): Promise<void> {
    try {
      // Check if ANY remaining link for this user is verified
      const remainingLinks = await this.userLinkRepository.find({
        where: { userId },
      });
      const hasVerified = remainingLinks.some(l => l.isVerified());
      if (!hasVerified) {
        const { User: UserEntity } = await import('../../models/User');
        const userRepo = AppDataSource.getRepository(UserEntity);
        await userRepo.update(userId, {
          rsiVerified: false,
          rsiVerifiedAt: null as unknown as Date,
        });
        logger.debug(`Cleared RSI verification from User table for user ${userId}`);
      }
    } catch (err: unknown) {
      logger.warn('Failed to clear RSI verification from User table', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Verify using Discord name match method
   */
  private async verifyDiscordMatch(
    link: RsiUserLink,
    rsiOrgSid: string
  ): Promise<VerificationResult> {
    if (!link.discordUserId) {
      return { success: false, verified: false, error: 'No Discord user ID linked' };
    }

    try {
      // Verify organization membership first
      const memberResult = await rsiApiService.verifyOrganizationMembership(
        link.rsiHandle,
        rsiOrgSid
      );

      if (!memberResult.verified) {
        return {
          success: true,
          verified: false,
          error: `User is not a member of organization ${rsiOrgSid}`,
        };
      }

      // For Discord match, we trust that if the user authenticated with Discord
      // and the RSI handle exists and is a member, they are verified
      // Additional Discord username matching can be done by the bot

      return {
        success: true,
        verified: true,
        rank: memberResult.rank,
        isAffiliate: memberResult.rank?.toLowerCase().includes('affiliate'),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, verified: false, error: errorMessage };
    }
  }

  /**
   * Regenerate verification code for a link
   */
  public async regenerateVerificationCode(linkId: string): Promise<string | null> {
    const link = await this.getLinkById(linkId);
    if (link?.verificationMethod !== VerificationMethod.BIO_CODE) {
      return null;
    }

    link.verificationCode = RsiUserLink.generateVerificationCode();
    link.verifiedAt = undefined;
    link.syncStatus = SyncStatus.PENDING;
    await this.userLinkRepository.save(link);

    return link.verificationCode;
  }

  // ==================== ROLE SYNCHRONIZATION ====================

  /**
   * Sync roles for a single user
   */
  public async syncUserRoles(
    linkId: string,
    config: OrgSyncConfig,
    discordService?: {
      assignRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
      removeRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
    }
  ): Promise<UserSyncResult> {
    const link = await this.getLinkById(linkId);
    if (!link) {
      return {
        userId: '',
        rsiHandle: '',
        success: false,
        rolesAdded: [],
        rolesRemoved: [],
        error: 'Link not found',
      };
    }

    const result: UserSyncResult = {
      userId: link.userId,
      rsiHandle: link.rsiHandle,
      success: false,
      rolesAdded: [],
      rolesRemoved: [],
      previousRank: link.lastKnownRank || undefined,
    };

    try {
      if (!link.isVerified()) {
        result.error = 'Link not verified';
        return result;
      }

      if (!link.discordUserId) {
        result.error = 'No Discord user ID configured';
        return result;
      }

      // Verify and cache member data from RSI
      const verifyResult = await rsiRoleSyncService.verifyAndCacheMember(
        link.organizationId,
        config.rsiOrgSid,
        link.rsiHandle
      );

      if (verifyResult.status === 'api_error') {
        // API unavailable — check crawled data as fallback, don't mark as departed
        const { RsiCrawledMember } = await import('../../models/RsiCrawledMember');
        const crawledRepo = AppDataSource.getRepository(RsiCrawledMember);
        const crawled = await crawledRepo.findOne({
          where: { organizationSid: config.rsiOrgSid, handle: link.rsiHandle },
        });

        if (crawled) {
          logger.info(
            `Skipping sync for ${link.rsiHandle}: API unavailable but member exists in crawled data`,
            { organizationId: link.organizationId }
          );
          result.success = true;
          result.newRank = crawled.rank ?? link.lastKnownRank;
          return result;
        }

        // API down AND no crawled data — skip this user, don't mark as departed
        result.error = 'API unavailable and no cached data';
        return result;
      }

      if (verifyResult.status === 'departed') {
        // Member confirmed departed by API
        result.rolesRemoved = await this.handleDepartedMember(link, config, discordService);
        link.markRemoved();
        await this.userLinkRepository.save(link);

        domainEvents.emit('member:rsi_org_left', {
          timestamp: new Date().toISOString(),
          userId: link.userId,
          organizationId: link.organizationId,
          rsiHandle: link.rsiHandle,
          rsiOrgSid: config.rsiOrgSid,
          rsiOrgName: config.rsiOrgSid,
        });

        result.success = true;
        result.isRemoved = true;
        return result;
      }

      const member = verifyResult.member!;

      // Check affiliate handling
      if (member.isAffiliate && config.affiliateHandling === AffiliateHandling.EXCLUDE) {
        link.markSynced(member.rsiRank, true);
        await this.userLinkRepository.save(link);
        result.success = true;
        result.newRank = member.rsiRank;
        return result;
      }

      // Get role mapping for this rank
      const mapping = await rsiRoleMappingService.getMappingByRank(
        link.organizationId,
        member.rsiRank
      );

      // Apply roles
      if (discordService && config.guildId) {
        // Handle affiliate special role
        if (
          member.isAffiliate &&
          config.affiliateHandling === AffiliateHandling.SPECIAL_ROLE &&
          config.affiliateRoleId
        ) {
          try {
            await discordService.assignRole(
              config.guildId,
              link.discordUserId,
              config.affiliateRoleId
            );
            result.rolesAdded.push(config.affiliateRoleId);
          } catch (err: unknown) {
            logger.error('Failed to assign affiliate role', { err, linkId });
          }
        }

        // Handle rank-based role
        if (mapping?.discordRoleId) {
          // Check if rank changed and we need to remove old role
          if (link.lastKnownRank && link.lastKnownRank !== member.rsiRank) {
            // Wave 2.1 — emit rank change domain event
            domainEvents.emit('member:rsi_rank_changed', {
              timestamp: new Date().toISOString(),
              userId: link.userId,
              organizationId: link.organizationId,
              rsiHandle: link.rsiHandle,
              rsiOrgSid: config.rsiOrgSid,
              oldRank: link.lastKnownRank,
              newRank: member.rsiRank,
            });

            const oldMapping = await rsiRoleMappingService.getMappingByRank(
              link.organizationId,
              link.lastKnownRank
            );
            if (oldMapping?.discordRoleId && oldMapping.discordRoleId !== mapping.discordRoleId) {
              try {
                await discordService.removeRole(
                  config.guildId,
                  link.discordUserId,
                  oldMapping.discordRoleId
                );
                result.rolesRemoved.push(oldMapping.discordRoleId);
              } catch (err: unknown) {
                logger.error('Failed to remove old role', { err, linkId });
              }
            }
          }

          // Assign new role
          try {
            await discordService.assignRole(
              config.guildId,
              link.discordUserId,
              mapping.discordRoleId
            );
            result.rolesAdded.push(mapping.discordRoleId);
          } catch (err: unknown) {
            logger.error('Failed to assign role', { err, linkId });
          }
        }
      }

      // Sync internal role (OrganizationMembership.roleId)
      if (mapping?.hasInternalRole()) {
        try {
          await this.syncInternalRole(link.organizationId, link.userId, mapping.internalRoleId!);
        } catch (err: unknown) {
          logger.error('Failed to sync internal role', {
            err: err instanceof Error ? err.message : String(err),
            linkId,
            internalRoleId: mapping.internalRoleId,
          });
        }
      }

      // Auto-assign to teams
      if (mapping?.hasAutoAssignTeams()) {
        try {
          await this.syncTeamAssignments(
            link.organizationId,
            link.userId,
            mapping.autoAssignTeamIds!,
            member.rsiRank
          );
        } catch (err: unknown) {
          logger.error('Failed to sync team assignments', {
            err: err instanceof Error ? err.message : String(err),
            linkId,
            teamIds: mapping.autoAssignTeamIds,
          });
        }
      }

      // Update link
      link.markSynced(member.rsiRank, member.isAffiliate);
      // Reset consecutive failure counter on success
      if ((link.metadata as Record<string, unknown>)?.failedSyncCount) {
        link.metadata = { ...link.metadata, failedSyncCount: 0 };
      }
      await this.userLinkRepository.save(link);

      result.success = true;
      result.newRank = member.rsiRank;
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      link.markFailed(errorMessage);

      // Track consecutive failure count in metadata
      const prevCount = (link.metadata as Record<string, unknown>)?.failedSyncCount;
      const consecutiveFailures = (typeof prevCount === 'number' ? prevCount : 0) + 1;
      link.metadata = {
        ...link.metadata,
        failedSyncCount: consecutiveFailures,
      };

      await this.userLinkRepository.save(link);

      // P0 — Emit sync-failed event for audit service
      const isAccountGone = errorMessage.includes('404') || errorMessage.includes('not found');
      domainEvents.emit('member:rsi_sync_failed', {
        timestamp: new Date().toISOString(),
        userId: link.userId,
        organizationId: link.organizationId,
        rsiHandle: link.rsiHandle,
        failureReason: isAccountGone ? 'account_not_found' : errorMessage,
        consecutiveFailures,
      });

      result.error = errorMessage;
      return result;
    }
  }

  // ==================== INTERNAL ROLE & TEAM SYNC ====================

  /**
   * Update the user's OrganizationMembership.roleId to match the RSI mapping.
   * Only updates if the role differs from the current assignment.
   * Skips the update if the current role has higher priority (prevents demoting admins).
   */
  private async syncInternalRole(
    organizationId: string,
    userId: string,
    internalRoleId: string
  ): Promise<void> {
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const membership = await membershipRepo.findOne({
      where: { organizationId, userId, isActive: true },
    });

    if (!membership) {
      logger.warn('syncInternalRole: No active membership found', {
        organizationId,
        userId,
      });
      return;
    }

    if (membership.roleId === internalRoleId) {
      return; // Already correct
    }

    // Guard: never downgrade a role with higher priority (e.g. owner/admin)
    const currentPriority = membership.role?.priority ?? 0;
    const { Role } = await import('../../models/Role');
    const targetRole = await AppDataSource.getRepository(Role).findOne({
      where: { id: internalRoleId },
    });
    const targetPriority = targetRole?.priority ?? 0;

    if (currentPriority > targetPriority) {
      logger.info('syncInternalRole: Skipping — current role has higher priority', {
        organizationId,
        userId,
        currentRoleId: membership.roleId,
        currentPriority,
        targetRoleId: internalRoleId,
        targetPriority,
      });
      return;
    }

    membership.roleId = internalRoleId;
    await membershipRepo.save(membership);
    logger.info('syncInternalRole: Updated membership role', {
      organizationId,
      userId,
      internalRoleId,
    });
  }

  /**
   * Auto-assign user to teams specified in the RSI mapping.
   * Idempotent — skips teams the user is already a member of.
   * Members can be in multiple teams (generic divisions + specialized squads).
   */
  private async syncTeamAssignments(
    organizationId: string,
    userId: string,
    teamIds: string[],
    rsiRank: string
  ): Promise<void> {
    const teamService = this.teamService;

    for (const teamId of teamIds) {
      try {
        // Check if already a member of this team
        const memberRepo = AppDataSource.getRepository(TeamMember);
        const existing = await memberRepo.findOne({
          where: { organizationId, teamId, userId },
        });

        if (existing && existing.status !== 'removed') {
          // Update rank if changed
          if (existing.rank !== rsiRank) {
            existing.rank = rsiRank;
            await memberRepo.save(existing);
          }
          continue; // Already in team
        }

        await teamService.addMember(organizationId, teamId, userId, 'member', {
          rank: rsiRank,
        });
        logger.info('syncTeamAssignments: Added user to team', {
          organizationId,
          userId,
          teamId,
          rsiRank,
        });
      } catch (err: unknown) {
        // Non-fatal per team — log and continue
        logger.warn('syncTeamAssignments: Failed to assign team', {
          organizationId,
          userId,
          teamId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Handle a member who has left the organization
   */
  private async handleDepartedMember(
    link: RsiUserLink,
    config: OrgSyncConfig,
    discordService?: {
      removeRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
    }
  ): Promise<string[]> {
    const removedRoles: string[] = [];

    if (!config.removeRolesOnLeave || !discordService || !link.discordUserId) {
      return removedRoles;
    }

    try {
      // Get all role mappings for this org
      const mappings = await rsiRoleMappingService.getMappingsByOrganization(link.organizationId);

      // Remove all mapped roles
      for (const mapping of mappings) {
        if (mapping.discordRoleId) {
          try {
            await discordService.removeRole(
              config.guildId,
              link.discordUserId,
              mapping.discordRoleId
            );
            removedRoles.push(mapping.discordRoleId);
          } catch (err: unknown) {
            // Role might not be assigned, ignore error
            logger.debug('Could not remove role (may not be assigned)', { err });
          }
        }
      }

      // Also remove affiliate role if configured
      if (config.affiliateRoleId) {
        try {
          await discordService.removeRole(
            config.guildId,
            link.discordUserId,
            config.affiliateRoleId
          );
          removedRoles.push(config.affiliateRoleId);
        } catch (err: unknown) {
          logger.debug('Could not remove affiliate role', { err });
        }
      }
    } catch (error: unknown) {
      logger.error('Error handling departed member', { error, linkId: link.id });
    }

    return removedRoles;
  }

  /**
   * Run full organization sync
   */
  public async runOrganizationSync(
    organizationId: string,
    config: OrgSyncConfig,
    discordService?: {
      assignRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
      removeRole: (guildId: string, userId: string, roleId: string) => Promise<string>;
    }
  ): Promise<OrgSyncResult> {
    const startTime = Date.now();
    const result: OrgSyncResult = {
      organizationId,
      totalUsers: 0,
      synced: 0,
      failed: 0,
      removed: 0,
      errors: [],
      duration: 0,
      userResults: [],
    };

    // BOT-03 — pace bulk role mutations so a large sync does not continuously
    // hammer Discord's shared rate limit; rate-limit failures that surface feed
    // adaptive backpressure (spacing ramps up, retry-after hints are honored)
    // before the next op. Pacing scales with actual role ops, not member count,
    // so already-in-sync members incur no delay.
    const roleSyncLimiter = discordService ? createRoleSyncRateLimiter() : undefined;
    const pacedDiscordService =
      discordService && roleSyncLimiter
        ? wrapWithRoleSyncBackpressure(discordService, roleSyncLimiter)
        : discordService;

    try {
      // Get all verified links for the organization
      const links = await this.getLinksByOrganization(organizationId);
      const verifiedLinks = links.filter(l => l.isVerified());
      result.totalUsers = verifiedLinks.length;

      logger.info(`Starting org sync for ${organizationId}`, {
        totalLinks: links.length,
        verifiedLinks: verifiedLinks.length,
      });

      // P1 — Pre-flight: verify the RSI org still exists
      let orgStillExists = true;
      let rsiOrgName: string | undefined;
      try {
        const orgData = await rsiApiService.fetchOrganizationData(config.rsiOrgSid);
        if (!orgData?.sid) {
          orgStillExists = false;
        } else {
          rsiOrgName = orgData.name;
        }
      } catch (orgCheckError: unknown) {
        const msg = orgCheckError instanceof Error ? orgCheckError.message : '';
        if (msg.includes('404') || msg.includes('not found')) {
          orgStillExists = false;
        }
        // Other errors (rate limit, network) are NOT treated as dissolution
      }

      if (!orgStillExists) {
        logger.warn(
          `RSI organization ${config.rsiOrgSid} appears dissolved — flagging all members`,
          {
            organizationId,
            affectedUsers: verifiedLinks.length,
          }
        );
        domainEvents.emit('member:rsi_org_dissolved', {
          timestamp: new Date().toISOString(),
          organizationId,
          rsiOrgSid: config.rsiOrgSid,
          rsiOrgName: rsiOrgName ?? config.rsiOrgSid,
          affectedUserIds: verifiedLinks.map(l => l.userId),
        });
        // Mark all links as needing review instead of blindly removing
        for (const link of verifiedLinks) {
          link.markNeedsReview('RSI organization dissolved');
          await this.userLinkRepository.save(link);
          result.failed++;
        }
        result.errors.push(`RSI organization ${config.rsiOrgSid} no longer exists`);
        result.duration = Date.now() - startTime;
        return result;
      }

      // Sync each user
      for (const link of verifiedLinks) {
        const userResult = await this.syncUserRoles(link.id, config, pacedDiscordService);
        result.userResults.push(userResult);

        if (userResult.success) {
          if (userResult.isRemoved) {
            result.removed++;
          } else {
            result.synced++;
          }
        } else {
          result.failed++;
          if (userResult.error) {
            result.errors.push(`${link.rsiHandle}: ${userResult.error}`);
          }
        }
      }

      result.duration = Date.now() - startTime;
      const completionContext: Record<string, unknown> = {
        synced: result.synced,
        failed: result.failed,
        removed: result.removed,
        duration: result.duration,
      };
      if (roleSyncLimiter) {
        const pacing = roleSyncLimiter.getStats();
        completionContext.roleOps = pacing.acquisitions;
        completionContext.backpressureEvents = pacing.backpressureEvents;
        completionContext.pacingWaitMs = pacing.totalWaitMs;
        completionContext.peakIntervalMs = pacing.peakIntervalMs;
      }
      logger.info(`Org sync completed for ${organizationId}`, completionContext);

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Sync failed: ${errorMessage}`);
      result.duration = Date.now() - startTime;
      logger.error('Org sync failed', { error: errorMessage, organizationId });
      return result;
    }
  }

  // ==================== USER INFO ====================

  /**
   * Get user link status summary for a user
   */
  public async getUserLinkStatus(
    userId: string,
    organizationId: string
  ): Promise<{
    linked: boolean;
    rsiHandle?: string;
    verified: boolean;
    syncStatus: SyncStatus;
    lastSynced?: Date;
    rank?: string;
    isAffiliate: boolean;
    verificationCode?: string;
  }> {
    const link = await this.getLinkByUserAndOrg(userId, organizationId);

    if (!link) {
      return {
        linked: false,
        verified: false,
        syncStatus: SyncStatus.PENDING,
        isAffiliate: false,
      };
    }

    return {
      linked: true,
      rsiHandle: link.rsiHandle,
      verified: link.isVerified(),
      syncStatus: link.syncStatus,
      lastSynced: link.lastSyncedAt || undefined,
      rank: link.lastKnownRank || undefined,
      isAffiliate: link.isAffiliate,
      verificationCode:
        link.verificationMethod === VerificationMethod.BIO_CODE ? link.verificationCode : undefined,
    };
  }

  /**
   * Get sync statistics for an organization
   */
  public async getOrgSyncStats(organizationId: string): Promise<{
    totalLinks: number;
    verified: number;
    pending: number;
    synced: number;
    failed: number;
    removed: number;
    needsReview: number;
    affiliates: number;
  }> {
    const links = await this.getLinksByOrganization(organizationId, true);

    return {
      totalLinks: links.length,
      verified: links.filter(l => l.isVerified()).length,
      pending: links.filter(l => l.syncStatus === SyncStatus.PENDING).length,
      synced: links.filter(l => l.syncStatus === SyncStatus.SYNCED).length,
      failed: links.filter(l => l.syncStatus === SyncStatus.FAILED).length,
      removed: links.filter(l => l.syncStatus === SyncStatus.REMOVED).length,
      needsReview: links.filter(l => l.syncStatus === SyncStatus.NEEDS_REVIEW).length,
      affiliates: links.filter(l => l.isAffiliate).length,
    };
  }
}

// Export singleton instance
export const rsiUserLinkService = new RsiUserLinkService();

