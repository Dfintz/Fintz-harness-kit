import crypto from 'node:crypto';

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Activity } from '../../models/Activity';
import { DiscordGuildSettings } from '../../models/DiscordGuildSettings';
import { MirroredActivity, MirroredActivityStatus } from '../../models/MirroredActivity';
import { logger } from '../../utils/logger';
import { TenantService } from '../base/TenantService';

/** Default mirror limit when no per-org setting is configured */
const DEFAULT_MIRRORS_PER_ACTIVITY = 5;

/** Absolute upper bound — no org can exceed this regardless of settings */
const ABSOLUTE_MAX_MIRRORS = 10;

/** IPC channel for mirror RSVP sync */
export const MIRROR_SYNC_CHANNEL = 'mirror:rsvp:sync';

/**
 * DTO for creating a new event mirror
 */
export interface CreateMirrorDTO {
  sourceActivityId: string;
  sourceGuildId: string;
  sourceOrganizationId: string;
  mirrorGuildId: string;
  mirrorChannelId: string;
  mirrorKey?: string;
  /** Organization ID of the target (mirror) server */
  targetOrganizationId: string;
}

/**
 * Result of a mirror operation
 */
export interface MirrorResult {
  success: boolean;
  mirror?: MirroredActivity;
  message: string;
}

/**
 * EventMirrorService — Manages activity mirroring across Discord servers.
 *
 * Wave 1.8 — Activity Mirroring (all types: events, operations, missions, etc.)
 *
 * Handles:
 * - Creating mirror links between source and target guilds
 * - Mirror key authentication for cross-org mirroring
 * - RSVP sync coordination (publishes IPC events)
 * - Per-org configurable mirror limit (default 5, max 10)
 * - Mirror lifecycle (activate, pause, cancel, expire)
 */
export class EventMirrorService extends TenantService<MirroredActivity> {
  private readonly activityRepository: Repository<Activity>;
  private static instance: EventMirrorService | null = null;

  constructor() {
    super(AppDataSource.getRepository(MirroredActivity), {
      enableCache: true,
      cacheTTL: 300,
      cacheCheckPeriod: 60,
    });
    this.activityRepository = AppDataSource.getRepository(Activity);
  }

  /**
   * Get the singleton instance.
   */
  public static getInstance(): EventMirrorService {
    EventMirrorService.instance ??= new EventMirrorService();
    return EventMirrorService.instance;
  }

  // ==================== MIRROR CREATION ====================

  /**
   * Create a new event mirror.
   *
   * @param dto - Mirror creation parameters
   * @returns Result with the created mirror or error message
   */
  async createMirror(dto: CreateMirrorDTO): Promise<MirrorResult> {
    // 1. Validate source activity exists
    const sourceActivity = await this.activityRepository.findOne({
      where: { id: dto.sourceActivityId },
    });

    if (!sourceActivity) {
      return { success: false, message: 'Source activity not found.' };
    }

    // 2. Check for existing mirror (same source → same target guild).
    // If one exists, reuse it so the caller can repost a fresh embed
    // (the mirrorMessageId will be overwritten by the caller after posting).
    // This is checked before the limit so reposting never trips the cap.
    const existingMirror = await this.repository.findOne({
      where: {
        sourceActivityId: dto.sourceActivityId,
        mirrorGuildId: dto.mirrorGuildId,
        status: MirroredActivityStatus.ACTIVE,
      },
    });

    if (existingMirror) {
      // Update channel and (optionally) re-hash the mirror key in case either changed.
      existingMirror.mirrorChannelId = dto.mirrorChannelId;
      if (dto.mirrorKey) {
        existingMirror.mirrorKey = EventMirrorService.hashMirrorKey(dto.mirrorKey);
      }
      existingMirror.syncEnabled = true;
      const updated = await this.repository.save(existingMirror);

      logger.info(
        `Event mirror reposted: source=${dto.sourceActivityId} → target guild=${dto.mirrorGuildId} (mirror=${updated.id})`
      );

      return {
        success: true,
        mirror: updated,
        message: 'Event mirror reposted successfully.',
      };
    }

    // 3. Check mirror limit (per-org setting, capped at ABSOLUTE_MAX_MIRRORS)
    const maxMirrors = await this.resolveMaxMirrors(dto.sourceGuildId, dto.sourceOrganizationId);

    const existingMirrorCount = await this.repository.count({
      where: {
        sourceActivityId: dto.sourceActivityId,
        status: MirroredActivityStatus.ACTIVE,
      },
    });

    if (existingMirrorCount >= maxMirrors) {
      return {
        success: false,
        message: `This activity already has ${existingMirrorCount} active mirror${existingMirrorCount === 1 ? '' : 's'} (limit: ${maxMirrors}). Cancel an existing mirror first.`,
      };
    }

    // 4. Validate mirror key if required (non-allied servers)
    let hashedMirrorKey: string | undefined;
    if (dto.mirrorKey) {
      hashedMirrorKey = EventMirrorService.hashMirrorKey(dto.mirrorKey);
    }

    // 5. Create the mirror record
    const mirror = this.repository.create({
      sourceActivityId: dto.sourceActivityId,
      sourceGuildId: dto.sourceGuildId,
      sourceOrganizationId: dto.sourceOrganizationId,
      mirrorGuildId: dto.mirrorGuildId,
      mirrorChannelId: dto.mirrorChannelId,
      mirrorKey: hashedMirrorKey,
      organizationId: dto.targetOrganizationId,
      status: MirroredActivityStatus.ACTIVE,
      syncEnabled: true,
    });

    const saved = await this.repository.save(mirror);

    logger.info(
      `Event mirror created: source=${dto.sourceActivityId} → target guild=${dto.mirrorGuildId} (mirror=${saved.id})`
    );

    return {
      success: true,
      mirror: saved,
      message: 'Event mirror created successfully.',
    };
  }

  // ==================== MIRROR LIMIT RESOLUTION ====================

  /**
   * Resolve the effective max-mirrors-per-activity for a guild/org.
   *
   * Lookup order:
   * 1. Guild-specific EventSettings.maxMirrorsPerActivity
   * 2. DEFAULT_MIRRORS_PER_ACTIVITY (5)
   *
   * The result is always clamped to [1, ABSOLUTE_MAX_MIRRORS].
   */
  async resolveMaxMirrors(guildId: string, organizationId: string): Promise<number> {
    try {
      const settingsRepo = AppDataSource.getRepository(DiscordGuildSettings);
      const settings = await settingsRepo.findOne({
        where: { guildId, organizationId },
      });

      const configured = settings?.eventSettings?.maxMirrorsPerActivity;
      if (configured !== null && configured !== undefined && Number.isFinite(configured)) {
        return Math.max(1, Math.min(configured, ABSOLUTE_MAX_MIRRORS));
      }
    } catch (err: unknown) {
      logger.warn('Failed to resolve max mirrors setting, using default', {
        guildId,
        error: String(err),
      });
    }

    return DEFAULT_MIRRORS_PER_ACTIVITY;
  }

  // ==================== MIRROR QUERIES ====================

  /**
   * Get all active mirrors for a source event.
   */
  async getMirrorsForEvent(sourceActivityId: string): Promise<MirroredActivity[]> {
    return this.repository.find({
      where: {
        sourceActivityId,
        status: MirroredActivityStatus.ACTIVE,
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get all active mirrors for a guild.
   */
  async getMirrorsForGuild(guildId: string): Promise<MirroredActivity[]> {
    return this.repository.find({
      where: {
        mirrorGuildId: guildId,
        status: MirroredActivityStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find a mirror by its source activity and target guild.
   */
  async findMirror(
    sourceActivityId: string,
    mirrorGuildId: string
  ): Promise<MirroredActivity | null> {
    return this.repository.findOne({
      where: {
        sourceActivityId,
        mirrorGuildId,
        status: MirroredActivityStatus.ACTIVE,
      },
    });
  }

  /**
   * Find all mirrors related to an activity (as source or mirror).
   * Uses a single OR query instead of two separate queries.
   */
  async findRelatedMirrors(activityId: string): Promise<MirroredActivity[]> {
    return this.repository.find({
      where: [
        { sourceActivityId: activityId, status: MirroredActivityStatus.ACTIVE },
        { mirrorActivityId: activityId, status: MirroredActivityStatus.ACTIVE },
      ],
    });
  }

  // ==================== MIRROR LIFECYCLE ====================

  /**
   * Update the Discord message ID for a mirror (after embed is posted).
   */
  async setMirrorMessageId(mirrorId: string, messageId: string): Promise<void> {
    await this.repository.update(mirrorId, {
      mirrorMessageId: messageId,
    });
  }

  /**
   * Update the mirror activity ID (the cloned activity in the target org).
   */
  async setMirrorActivityId(mirrorId: string, mirrorActivityId: string): Promise<void> {
    await this.repository.update(mirrorId, {
      mirrorActivityId,
    });
  }

  /**
   * Record a successful sync.
   */
  async recordSync(mirrorId: string): Promise<void> {
    await this.repository.update(mirrorId, {
      lastSyncAt: new Date(),
    });
  }

  /**
   * Cancel a mirror (soft — sets status to CANCELLED).
   */
  async cancelMirror(mirrorId: string): Promise<MirrorResult> {
    const mirror = await this.repository.findOne({ where: { id: mirrorId } });
    if (!mirror) {
      return { success: false, message: 'Mirror not found.' };
    }

    mirror.status = MirroredActivityStatus.CANCELLED;
    mirror.syncEnabled = false;
    await this.repository.save(mirror);

    logger.info(`Event mirror cancelled: ${mirrorId}`);
    return { success: true, mirror, message: 'Mirror cancelled.' };
  }

  /**
   * Expire all mirrors for a source event (e.g., when event ends or is deleted).
   */
  async expireMirrorsForEvent(sourceActivityId: string): Promise<number> {
    const result = await this.repository.update(
      {
        sourceActivityId,
        status: MirroredActivityStatus.ACTIVE,
      },
      {
        status: MirroredActivityStatus.EXPIRED,
        syncEnabled: false,
      }
    );

    const affected = result.affected ?? 0;
    if (affected > 0) {
      logger.info(`Expired ${affected} mirrors for event ${sourceActivityId}`);
    }
    return affected;
  }

  // ==================== MIRROR KEY AUTH ====================

  /**
   * Set a mirror key on a source event (stored in activity metadata).
   */
  async setEventMirrorKey(
    activityId: string,
    rawKey: string
  ): Promise<{ success: boolean; message: string }> {
    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      return { success: false, message: 'Activity not found.' };
    }

    // Store the hashed key in activity metadata
    const hashedKey = EventMirrorService.hashMirrorKey(rawKey);
    activity.metadata = {
      ...activity.metadata,
      mirrorKeyHash: hashedKey,
    };

    await this.activityRepository.save(activity);

    logger.info(`Mirror key set for event ${activityId}`);
    return { success: true, message: 'Mirror key set successfully.' };
  }

  /**
   * Validate a mirror key against the stored hash.
   */
  async validateMirrorKey(activityId: string, rawKey: string): Promise<boolean> {
    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
    });

    if (!activity?.metadata) {
      return false;
    }

    const storedHash = activity.metadata.mirrorKeyHash;
    if (!storedHash) {
      // No key set → open for mirroring (or rely on alliance check)
      return true;
    }

    return storedHash === EventMirrorService.hashMirrorKey(rawKey);
  }

  // ==================== INVITE CODE ====================

  /**
   * Generate a short, human-friendly invite code for an activity and optionally
   * set (or update) the mirror key at the same time.
   *
   * The invite code is stored in `activity.metadata.mirrorInviteCode`.
   * Format: "FLEET-XXXX" where X is alphanumeric (uppercase).
   */
  async generateInviteCode(
    activityId: string,
    mirrorKey?: string
  ): Promise<{ success: boolean; inviteCode?: string; message: string }> {
    const activity = await this.activityRepository.findOne({
      where: { id: activityId },
    });

    if (!activity) {
      return { success: false, message: 'Activity not found.' };
    }

    // Generate a unique 8-char code: FLEET-XXXX
    const code = EventMirrorService.createInviteCode();

    // Check uniqueness (unlikely collision but be safe)
    const existing = await this.findActivityByInviteCode(code);
    if (existing) {
      // Retry once with a fresh code
      const retryCode = EventMirrorService.createInviteCode();
      activity.metadata = {
        ...activity.metadata,
        mirrorInviteCode: retryCode,
        ...(mirrorKey ? { mirrorKeyHash: EventMirrorService.hashMirrorKey(mirrorKey) } : {}),
      };
      await this.activityRepository.save(activity);
      logger.info(`Mirror invite code generated for event ${activityId}: ${retryCode}`);
      return { success: true, inviteCode: retryCode, message: 'Invite code created.' };
    }

    activity.metadata = {
      ...activity.metadata,
      mirrorInviteCode: code,
      ...(mirrorKey ? { mirrorKeyHash: EventMirrorService.hashMirrorKey(mirrorKey) } : {}),
    };
    await this.activityRepository.save(activity);

    logger.info(`Mirror invite code generated for event ${activityId}: ${code}`);
    return { success: true, inviteCode: code, message: 'Invite code created.' };
  }

  /**
   * Look up an activity by its mirror invite code.
   */
  async findActivityByInviteCode(inviteCode: string): Promise<Activity | null> {
    // activity.metadata is a simple-json (text) column, so cast to jsonb before using ->> operator
    return this.activityRepository
      .createQueryBuilder('activity')
      .where('activity.metadata IS NOT NULL')
      .andWhere("(activity.metadata::jsonb)->>'mirrorInviteCode' = :code", {
        code: inviteCode.toUpperCase().trim(),
      })
      .getOne();
  }

  // ==================== UTILITIES ====================

  /**
   * Generate a short alphanumeric invite code: FLEET-XXXX
   */
  static createInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // exclude confusable: 0/O, 1/I
    let suffix = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
      suffix += chars[bytes[i] % chars.length];
    }
    return `FLEET-${suffix}`;
  }

  /**
   * Hash a mirror key using SHA-256.
   */
  static hashMirrorKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  /**
   * Reset the singleton (for testing).
   */
  static resetInstance(): void {
    EventMirrorService.instance = null;
  }
}

