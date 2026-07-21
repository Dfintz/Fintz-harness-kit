import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { InviteTracking } from '../../models/MemberEngagement';
import { logger } from '../../utils/logger';

/**
 * InviteTrackingService
 * Tracks server invites to determine who invited new members.
 * Works by snapshotting invite uses before/after a member joins.
 */
export class InviteTrackingService {
  private static instance: InviteTrackingService;
  private readonly repo: Repository<InviteTracking>;
  /** Per-guild snapshot of invite code → uses count */
  private readonly inviteCache = new Map<string, Map<string, number>>();

  constructor() {
    this.repo = AppDataSource.getRepository(InviteTracking);
  }

  static getInstance(): InviteTrackingService {
    if (!InviteTrackingService.instance) {
      InviteTrackingService.instance = new InviteTrackingService();
    }
    return InviteTrackingService.instance;
  }

  /**
   * Cache all invites for a guild. Call on ready and after invite changes.
   */
  async cacheGuildInvites(guild: import('discord.js').Guild): Promise<void> {
    try {
      const invites = await guild.invites.fetch();
      const inviteMap = new Map<string, number>();
      invites.forEach(invite => {
        if (invite.code) {
          inviteMap.set(invite.code, invite.uses ?? 0);
        }
      });
      this.inviteCache.set(guild.id, inviteMap);
    } catch (error: unknown) {
      logger.warn(`Failed to cache invites for guild ${guild.id}:`, error);
    }
  }

  /**
   * Handle a new member join. Determines which invite was used.
   */
  async handleMemberJoin(member: import('discord.js').GuildMember): Promise<void> {
    const guildId = member.guild.id;
    const oldInvites = this.inviteCache.get(guildId);

    try {
      const newInvites = await member.guild.invites.fetch();
      const newMap = new Map<string, number>();
      let usedCode: string | undefined;
      let inviterUserId: string | undefined;

      newInvites.forEach(invite => {
        if (!invite.code) {
          return;
        }
        newMap.set(invite.code, invite.uses ?? 0);

        const oldUses = oldInvites?.get(invite.code) ?? 0;
        const newUses = invite.uses ?? 0;
        if (newUses > oldUses) {
          usedCode = invite.code;
          inviterUserId = invite.inviter?.id;
        }
      });

      // Update cache
      this.inviteCache.set(guildId, newMap);

      // Record the tracking entry
      const tracking = this.repo.create({
        guildId,
        invitedUserId: member.id,
        inviterUserId,
        inviteCode: usedCode,
        joinedAt: new Date(),
      });

      await this.repo.save(tracking);

      if (usedCode) {
        logger.info(
          `📨 ${member.user.username} joined ${member.guild.name} via invite ${usedCode} (by ${inviterUserId ?? 'unknown'})`
        );
      }
    } catch (error: unknown) {
      logger.warn(`Failed to track invite for ${member.user.username}:`, error);
    }
  }

  /**
   * Get invite stats for a user (how many people they invited).
   */
  async getInviterStats(
    guildId: string,
    inviterUserId: string
  ): Promise<{ totalInvites: number }> {
    const count = await this.repo.count({
      where: { guildId, inviterUserId },
    });
    return { totalInvites: count };
  }

  /**
   * Get who invited a specific member.
   */
  async getInviterOf(
    guildId: string,
    invitedUserId: string
  ): Promise<InviteTracking | null> {
    return this.repo.findOne({
      where: { guildId, invitedUserId },
    });
  }

  /**
   * Get top inviters in a guild.
   */
  async getTopInviters(
    guildId: string,
    limit: number = 10
  ): Promise<{ inviterUserId: string; count: number }[]> {
    const results = await this.repo
      .createQueryBuilder('it')
      .select('it.inviterUserId', 'inviterUserId')
      .addSelect('COUNT(*)', 'count')
      .where('it.guildId = :guildId AND it.inviterUserId IS NOT NULL', { guildId })
      .groupBy('it.inviterUserId')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r: { inviterUserId: string; count: string }) => ({
      inviterUserId: r.inviterUserId,
      count: Number.parseInt(r.count, 10),
    }));
  }
}

