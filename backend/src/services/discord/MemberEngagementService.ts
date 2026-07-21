import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { MemberEngagement } from '../../models/MemberEngagement';
import { logger } from '../../utils/logger';

export interface LeaderboardEntry {
  userId: string;
  total: number;
}

/**
 * MemberEngagementService
 * Tracks daily Discord engagement (messages, voice time) per member
 * and provides aggregation/leaderboard queries.
 */
export class MemberEngagementService {
  private static instance: MemberEngagementService;
  private readonly repo: Repository<MemberEngagement>;

  constructor() {
    this.repo = AppDataSource.getRepository(MemberEngagement);
  }

  static getInstance(): MemberEngagementService {
    if (!MemberEngagementService.instance) {
      MemberEngagementService.instance = new MemberEngagementService();
    }
    return MemberEngagementService.instance;
  }

  /** Today's date string in YYYY-MM-DD */
  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /**
   * Increment message count for a user today (upsert).
   */
  async incrementMessageCount(guildId: string, userId: string, count: number = 1): Promise<void> {
    const date = this.today();
    const sanitizedCount = Math.max(1, Math.min(Math.floor(count), 10000));
    try {
      // Use upsert pattern: try update first, then insert
      const result = await this.repo
        .createQueryBuilder()
        .update(MemberEngagement)
        .set({ messageCount: () => '"messageCount" + :increment' })
        .setParameter('increment', sanitizedCount)
        .where('guildId = :guildId AND userId = :userId AND date = :date', {
          guildId,
          userId,
          date,
        })
        .execute();

      if (result.affected === 0) {
        const engagement = this.repo.create({
          guildId,
          userId,
          date,
          messageCount: sanitizedCount,
          voiceMinutes: 0,
          reactionsGiven: 0,
          threadsCreated: 0,
        });
        await this.repo.save(engagement);
      }
    } catch (error: unknown) {
      // Handle race condition: unique constraint violation means another request created the row
      if (error instanceof Error && error.message.includes('duplicate key')) {
        await this.repo
          .createQueryBuilder()
          .update(MemberEngagement)
          .set({ messageCount: () => '"messageCount" + :increment' })
          .setParameter('increment', sanitizedCount)
          .where('guildId = :guildId AND userId = :userId AND date = :date', {
            guildId,
            userId,
            date,
          })
          .execute();
      } else {
        logger.error('Failed to increment message count', error);
      }
    }
  }

  /**
   * Add voice minutes for a user today (upsert).
   */
  async addVoiceMinutes(guildId: string, userId: string, minutes: number): Promise<void> {
    if (minutes <= 0) {
      return;
    }
    const date = this.today();
    try {
      const result = await this.repo
        .createQueryBuilder()
        .update(MemberEngagement)
        .set({ voiceMinutes: () => `"voiceMinutes" + ${Math.round(minutes)}` })
        .where('guildId = :guildId AND userId = :userId AND date = :date', {
          guildId,
          userId,
          date,
        })
        .execute();

      if (result.affected === 0) {
        const engagement = this.repo.create({
          guildId,
          userId,
          date,
          messageCount: 0,
          voiceMinutes: Math.round(minutes),
          reactionsGiven: 0,
          threadsCreated: 0,
        });
        await this.repo.save(engagement);
      }
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('duplicate key')) {
        await this.repo
          .createQueryBuilder()
          .update(MemberEngagement)
          .set({ voiceMinutes: () => `"voiceMinutes" + ${Math.round(minutes)}` })
          .where('guildId = :guildId AND userId = :userId AND date = :date', {
            guildId,
            userId,
            date,
          })
          .execute();
      } else {
        logger.error('Failed to add voice minutes', error);
      }
    }
  }

  /**
   * Get a user's aggregated stats over the last N days.
   */
  async getUserStats(
    guildId: string,
    userId: string,
    days: number = 30
  ): Promise<{ messageCount: number; voiceMinutes: number }> {
    const since = this.dateDaysAgo(days);

    const result: { messageCount: string; voiceMinutes: string } | undefined = await this.repo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.messageCount), 0)', 'messageCount')
      .addSelect('COALESCE(SUM(e.voiceMinutes), 0)', 'voiceMinutes')
      .where('e.guildId = :guildId AND e.userId = :userId AND e.date >= :since', {
        guildId,
        userId,
        since,
      })
      .getRawOne();

    return {
      messageCount: Number.parseInt(result?.messageCount ?? '0', 10),
      voiceMinutes: Number.parseInt(result?.voiceMinutes ?? '0', 10),
    };
  }

  /**
   * Get the top N users by a metric over the last N days.
   */
  async getLeaderboard(
    guildId: string,
    metric: 'messageCount' | 'voiceMinutes',
    days: number = 30,
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    const since = this.dateDaysAgo(days);

    const results = await this.repo
      .createQueryBuilder('e')
      .select('e.userId', 'userId')
      .addSelect(`SUM(e.${metric})`, 'total')
      .where('e.guildId = :guildId AND e.date >= :since', { guildId, since })
      .groupBy('e.userId')
      .orderBy('total', 'DESC')
      .limit(limit)
      .getRawMany();

    return results.map((r: { userId: string; total: string }) => ({
      userId: r.userId,
      total: Number.parseInt(r.total, 10),
    }));
  }

  /**
   * Get all users' aggregate stats for stat-role evaluation.
   */
  async getGuildAggregates(
    guildId: string,
    days: number
  ): Promise<{ userId: string; messageCount: number; voiceMinutes: number }[]> {
    const since = this.dateDaysAgo(days);

    const results = await this.repo
      .createQueryBuilder('e')
      .select('e.userId', 'userId')
      .addSelect('SUM(e.messageCount)', 'messageCount')
      .addSelect('SUM(e.voiceMinutes)', 'voiceMinutes')
      .where('e.guildId = :guildId AND e.date >= :since', { guildId, since })
      .groupBy('e.userId')
      .getRawMany();

    return results.map((r: { userId: string; messageCount: string; voiceMinutes: string }) => ({
      userId: r.userId,
      messageCount: Number.parseInt(r.messageCount, 10),
      voiceMinutes: Number.parseInt(r.voiceMinutes, 10),
    }));
  }

  /**
   * Delete engagement data older than retentionDays.
   */
  async cleanupOldData(retentionDays: number): Promise<number> {
    const cutoff = this.dateDaysAgo(retentionDays);
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(MemberEngagement)
      .where('date < :cutoff', { cutoff })
      .execute();
    return result.affected ?? 0;
  }

  private dateDaysAgo(days: number): string {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }
}

