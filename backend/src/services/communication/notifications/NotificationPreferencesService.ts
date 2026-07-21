import { Repository } from 'typeorm';

import { AppDataSource } from '../../../config/database';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CHANNELS,
  NotificationCategories,
  NotificationChannels,
  NotificationPreferences,
} from '../../../models/NotificationPreferences';
import { logger } from '../../../utils/logger';

/**
 * DTO accepted by the update endpoint.
 * Every field is optional — only provided fields are merged.
 */
export interface UpdateNotificationPreferencesDto {
  muteAll?: boolean;
  channels?: Partial<NotificationChannels>;
  categories?: Partial<NotificationCategories>;
  digestFrequency?: 'daily' | 'weekly' | 'none';
}

/**
 * NotificationPreferencesService — CRUD for per-user notification preferences.
 *
 * - Lazy-creates a row on first GET with sensible defaults.
 * - Partial-merge updates: consumers only send changed fields.
 * - Exposes a lightweight `shouldDeliver(userId, channel, category)` check
 *   that the main NotificationService can call before dispatching.
 */
export class NotificationPreferencesService {
  private readonly repo: Repository<NotificationPreferences>;

  constructor() {
    this.repo = AppDataSource.getRepository(NotificationPreferences);
  }

  // ── Read / Create-on-demand ──────────────────────────────────────────

  /**
   * Get or create notification preferences for a user.
   * Returns full preferences with defaults merged in for missing keys.
   */
  async getOrCreate(userId: string): Promise<NotificationPreferences> {
    let prefs = await this.repo.findOne({ where: { userId } });

    if (!prefs) {
      prefs = this.repo.create({
        userId,
        muteAll: false,
        channels: { ...DEFAULT_CHANNELS },
        categories: { ...DEFAULT_CATEGORIES },
        digestFrequency: 'daily',
      });
      prefs = await this.repo.save(prefs);
      logger.info('Created default notification preferences', { userId });
    }

    // Ensure all keys exist (defensive against schema evolution)
    prefs.channels = { ...DEFAULT_CHANNELS, ...prefs.channels };
    prefs.categories = { ...DEFAULT_CATEGORIES, ...prefs.categories };

    return prefs;
  }

  // ── Update ───────────────────────────────────────────────────────────

  /**
   * Partial-merge update. Only the fields present in `dto` are changed.
   * Channels and categories are shallow-merged independently so the client
   * can toggle a single channel without re-sending the full object.
   */
  async update(
    userId: string,
    dto: UpdateNotificationPreferencesDto
  ): Promise<NotificationPreferences> {
    const prefs = await this.getOrCreate(userId);

    if (dto.muteAll !== undefined) {
      prefs.muteAll = dto.muteAll;
    }

    if (dto.channels) {
      prefs.channels = { ...prefs.channels, ...dto.channels };
    }

    if (dto.categories) {
      prefs.categories = { ...prefs.categories, ...dto.categories };
    }

    if (dto.digestFrequency) {
      prefs.digestFrequency = dto.digestFrequency;
    }

    const saved = await this.repo.save(prefs);
    logger.info('Updated notification preferences', { userId, changes: dto });
    return saved;
  }

  // ── Delivery check ──────────────────────────────────────────────────

  /**
   * Returns `true` if a notification should be delivered to the given user
   * through the specified channel for the given category.
   *
   * System-category notifications always bypass `muteAll`.
   */
  async shouldDeliver(
    userId: string,
    channel: keyof NotificationChannels,
    category: keyof NotificationCategories
  ): Promise<boolean> {
    const prefs = await this.getOrCreate(userId);

    // System notifications are always delivered
    if (category === 'system') {return true;}

    // Master mute kills everything except system
    if (prefs.muteAll) {return false;}

    // Channel + category must both be enabled
    return prefs.channels[channel] !== false && prefs.categories[category] !== false;
  }

  // ── Deletion (GDPR) ─────────────────────────────────────────────────

  /**
   * Delete all notification preferences for a user (GDPR Article 17).
   */
  async deleteForUser(userId: string): Promise<number> {
    const result = await this.repo.delete({ userId });
    return result.affected ?? 0;
  }
}

