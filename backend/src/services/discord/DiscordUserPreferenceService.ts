import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { DiscordUserPreference } from '../../models/DiscordUserPreference';
import { logger } from '../../utils/logger';

/**
 * Service for managing per-user Discord notification preferences.
 *
 * User-level preferences override guild-level defaults set by admins.
 * When a preference record doesn't exist, all notifications are enabled (opt-in by default).
 */
export class DiscordUserPreferenceService {
  private static instance: DiscordUserPreferenceService;
  private readonly repo: Repository<DiscordUserPreference>;

  constructor() {
    this.repo = AppDataSource.getRepository(DiscordUserPreference);
  }

  static getInstance(): DiscordUserPreferenceService {
    DiscordUserPreferenceService.instance ??= new DiscordUserPreferenceService();
    return DiscordUserPreferenceService.instance;
  }

  /**
   * Get or create a user's preferences for a specific guild.
   */
  async getOrCreate(userId: string, guildId: string): Promise<DiscordUserPreference> {
    let pref = await this.repo.findOne({
      where: { userId, guildId },
    });

    if (!pref) {
      pref = this.repo.create({
        userId,
        guildId,
        dmEnabled: true,
        lfgPingOptIn: true,
        eventReminderOptIn: true,
        ticketDmOptIn: true,
        recruitmentDmOptIn: true,
        moderationAlertOptIn: true,
      });
      await this.repo.save(pref);
      logger.info(`Created Discord user preference for user:${userId} guild:${guildId}`);
    }

    return pref;
  }

  /**
   * Get a user's preferences (returns null if not set — caller uses guild defaults).
   */
  async get(userId: string, guildId: string): Promise<DiscordUserPreference | null> {
    return this.repo.findOne({ where: { userId, guildId } });
  }

  /**
   * Update a user's preferences for a specific guild.
   */
  async update(
    userId: string,
    guildId: string,
    updates: Partial<
      Pick<
        DiscordUserPreference,
        | 'dmEnabled'
        | 'lfgPingOptIn'
        | 'eventReminderOptIn'
        | 'ticketDmOptIn'
        | 'recruitmentDmOptIn'
        | 'moderationAlertOptIn'
        | 'botResponseViaDm'
        | 'timezone'
      >
    >
  ): Promise<DiscordUserPreference> {
    const pref = await this.getOrCreate(userId, guildId);

    Object.assign(pref, updates);
    await this.repo.save(pref);

    logger.info(`Updated Discord user preference for user:${userId} guild:${guildId}`);
    return pref;
  }

  /**
   * Check if a specific user has opted in to DMs for a given guild.
   * Returns true if no preference exists (opt-in by default).
   */
  async isDmEnabled(userId: string, guildId: string): Promise<boolean> {
    const pref = await this.get(userId, guildId);
    return pref?.dmEnabled ?? true;
  }

  /**
   * Bulk-check DM opt-in for multiple users in a guild.
   * Returns the set of userIds that have DMs enabled.
   */
  async filterDmEnabled(userIds: string[], guildId: string): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }

    const prefs = await this.repo
      .createQueryBuilder('pref')
      .where('pref.guildId = :guildId', { guildId })
      .andWhere('pref.userId IN (:...userIds)', { userIds })
      .andWhere('pref.dmEnabled = false')
      .getMany();

    const optedOut = new Set(prefs.map(p => p.userId));

    // Everyone not explicitly opted out is enabled
    return new Set(userIds.filter(id => !optedOut.has(id)));
  }

  /**
   * Get all preferences for a guild (for admin views).
   */
  async getGuildPreferences(guildId: string): Promise<DiscordUserPreference[]> {
    return this.repo.find({ where: { guildId } });
  }
}

export const discordUserPreferenceService = DiscordUserPreferenceService.getInstance();

