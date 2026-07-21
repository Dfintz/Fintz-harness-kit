import { AppDataSource } from '../../config/database';
import { Achievement, AchievementType } from '../../models/Achievement';
import { UserAchievement } from '../../models/UserAchievement';
import { ConflictError, NotFoundError } from '../../utils/apiErrors';

import { gamificationAuditLogger } from './GamificationAuditLogger';

/**
 * Service for managing custom titles and badges.
 *
 * Titles are text-only honors; badges have visual icons and rarity tiers.
 * Scoped to either an organization or a federation (mutually exclusive).
 */
export class TitleBadgeService {
  private readonly achievementRepo = AppDataSource.getRepository(Achievement);
  private readonly userAchievementRepo = AppDataSource.getRepository(UserAchievement);

  // ==================== ORG-SCOPED CRUD ====================

  async list(
    organizationId: string,
    filters?: { category?: string; rarity?: string; type?: string }
  ): Promise<{ items: Achievement[]; total: number }> {
    const qb = this.achievementRepo
      .createQueryBuilder('a')
      .where('a.organizationId = :organizationId', { organizationId })
      .andWhere('a.isActive = :isActive', { isActive: true })
      .orderBy('a.name', 'ASC');

    if (filters?.type) {
      qb.andWhere('a.type = :type', { type: filters.type });
    }
    if (filters?.category) {
      qb.andWhere('a.category = :category', { category: filters.category });
    }
    if (filters?.rarity) {
      qb.andWhere('a.rarity = :rarity', { rarity: filters.rarity });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getById(achievementId: string, organizationId: string): Promise<Achievement | null> {
    return this.achievementRepo.findOne({
      where: { id: achievementId, organizationId },
    });
  }

  async create(
    organizationId: string,
    createdBy: string,
    data: {
      name: string;
      type?: string;
      description?: string;
      category?: string;
      rarity?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Achievement> {
    const existing = await this.achievementRepo.findOne({
      where: { organizationId, name: data.name },
    });
    if (existing) {
      throw new ConflictError('A title or badge with this name already exists');
    }
    const achievement = this.achievementRepo.create({
      ...data,
      type: data.type ?? AchievementType.BADGE,
      organizationId,
      createdBy,
    });
    const saved = await this.achievementRepo.save(achievement);
    gamificationAuditLogger.logBadgeCreated(organizationId, saved.id, saved.name, createdBy);
    return saved;
  }

  async update(
    achievementId: string,
    organizationId: string,
    data: Partial<
      Pick<
        Achievement,
        'name' | 'type' | 'description' | 'category' | 'rarity' | 'metadata' | 'isActive'
      >
    > & { icon?: string | null }
  ): Promise<Achievement> {
    const achievement = await this.achievementRepo.findOne({
      where: { id: achievementId, organizationId },
    });
    if (!achievement) {
      throw new NotFoundError('Title or badge not found');
    }
    // Handle icon clearing: convert null/empty to undefined for DB storage
    const { icon, ...rest } = data;
    const updates: Record<string, unknown> = { ...rest };
    if (icon !== undefined) {
      updates.icon = icon || undefined;
    }
    Object.assign(achievement, updates);
    const saved = await this.achievementRepo.save(achievement);
    gamificationAuditLogger.logBadgeUpdated(
      organizationId,
      saved.id,
      saved.name,
      saved.createdBy,
      data
    );
    return saved;
  }

  async delete(achievementId: string, organizationId: string): Promise<void> {
    const achievement = await this.achievementRepo.findOne({
      where: { id: achievementId, organizationId },
    });
    if (!achievement) {
      throw new NotFoundError('Title or badge not found');
    }
    gamificationAuditLogger.logBadgeDeleted(
      organizationId,
      achievement.id,
      achievement.name,
      achievement.createdBy
    );
    await this.achievementRepo.remove(achievement);
  }

  // ==================== FEDERATION-SCOPED CRUD ====================

  async listByFederation(
    federationId: string,
    filters?: { category?: string; rarity?: string; type?: string }
  ): Promise<{ items: Achievement[]; total: number }> {
    const qb = this.achievementRepo
      .createQueryBuilder('a')
      .where('a.federationId = :federationId', { federationId })
      .andWhere('a.isActive = :isActive', { isActive: true })
      .orderBy('a.name', 'ASC');

    if (filters?.type) {
      qb.andWhere('a.type = :type', { type: filters.type });
    }
    if (filters?.category) {
      qb.andWhere('a.category = :category', { category: filters.category });
    }
    if (filters?.rarity) {
      qb.andWhere('a.rarity = :rarity', { rarity: filters.rarity });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getByIdFederation(
    achievementId: string,
    federationId: string
  ): Promise<Achievement | null> {
    return this.achievementRepo.findOne({
      where: { id: achievementId, federationId },
    });
  }

  async createForFederation(
    federationId: string,
    createdBy: string,
    data: {
      name: string;
      type?: string;
      description?: string;
      category?: string;
      rarity?: string;
      icon?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Achievement> {
    const existing = await this.achievementRepo.findOne({
      where: { federationId, name: data.name },
    });
    if (existing) {
      throw new ConflictError('A title or badge with this name already exists in this federation');
    }
    const achievement = this.achievementRepo.create({
      ...data,
      type: data.type ?? AchievementType.BADGE,
      federationId,
      createdBy,
    });
    return this.achievementRepo.save(achievement);
  }

  async updateForFederation(
    achievementId: string,
    federationId: string,
    data: Partial<
      Pick<
        Achievement,
        'name' | 'type' | 'description' | 'category' | 'rarity' | 'icon' | 'metadata' | 'isActive'
      >
    >
  ): Promise<Achievement> {
    const achievement = await this.achievementRepo.findOne({
      where: { id: achievementId, federationId },
    });
    if (!achievement) {
      throw new NotFoundError('Title or badge not found');
    }
    Object.assign(achievement, data);
    return this.achievementRepo.save(achievement);
  }

  async deleteForFederation(achievementId: string, federationId: string): Promise<void> {
    const achievement = await this.achievementRepo.findOne({
      where: { id: achievementId, federationId },
    });
    if (!achievement) {
      throw new NotFoundError('Title or badge not found');
    }
    await this.achievementRepo.remove(achievement);
  }

  // ==================== AWARD / REVOKE ====================

  async award(
    achievementId: string,
    organizationId: string,
    userId: string,
    awardedBy: string
  ): Promise<UserAchievement> {
    const achievement = await this.achievementRepo.findOne({
      where: { id: achievementId, organizationId },
    });
    if (!achievement) {
      throw new NotFoundError('Title or badge not found');
    }

    const existing = await this.userAchievementRepo.findOne({
      where: { achievementId, userId, organizationId },
    });
    if (existing) {
      throw new ConflictError('User already has this title or badge');
    }

    const ua = this.userAchievementRepo.create({
      achievementId,
      userId,
      organizationId,
      awardedBy,
    });
    const saved = await this.userAchievementRepo.save(ua);
    gamificationAuditLogger.logBadgeAwarded(
      organizationId,
      achievementId,
      achievement.name,
      userId,
      awardedBy
    );
    return saved;
  }

  async revoke(
    achievementId: string,
    organizationId: string,
    userId: string,
    revokedBy?: string
  ): Promise<void> {
    const ua = await this.userAchievementRepo.findOne({
      where: { achievementId, userId, organizationId },
      relations: ['achievement'],
    });
    if (!ua) {
      throw new NotFoundError('User does not have this title or badge');
    }
    gamificationAuditLogger.logBadgeRevoked(
      organizationId,
      achievementId,
      ua.achievement?.name ?? 'Unknown',
      userId,
      revokedBy ?? userId
    );
    await this.userAchievementRepo.remove(ua);
  }

  // ==================== RECIPIENTS ====================

  async getRecipients(achievementId: string, organizationId: string): Promise<UserAchievement[]> {
    const achievement = await this.achievementRepo.findOne({
      where: { id: achievementId, organizationId },
    });
    if (!achievement) {
      throw new NotFoundError('Title or badge not found');
    }

    return this.userAchievementRepo
      .createQueryBuilder('ua')
      .leftJoin('ua.user', 'user')
      .addSelect(['user.id', 'user.username', 'user.displayName', 'user.avatar'])
      .where('ua.achievementId = :achievementId', { achievementId })
      .andWhere('ua.organizationId = :organizationId', { organizationId })
      .orderBy('ua.awardedAt', 'DESC')
      .getMany();
  }

  // ==================== USER DISPLAY ====================

  async getUserItems(organizationId: string, userId: string): Promise<UserAchievement[]> {
    return this.userAchievementRepo
      .createQueryBuilder('ua')
      .leftJoinAndSelect('ua.achievement', 'achievement')
      .leftJoin('achievement.organization', 'org')
      .addSelect(['org.id', 'org.name', 'org.logoUrl'])
      .where('ua.organizationId = :organizationId', { organizationId })
      .andWhere('ua.userId = :userId', { userId })
      .orderBy('ua.displaySlot', 'ASC')
      .addOrderBy('ua.awardedAt', 'DESC')
      .getMany();
  }

  /**
   * Get all displayed badges for a user across all organizations.
   * Used by the public profile view (no org context required).
   */
  async getUserPublicItems(userId: string): Promise<UserAchievement[]> {
    return this.userAchievementRepo
      .createQueryBuilder('ua')
      .leftJoinAndSelect('ua.achievement', 'achievement')
      .leftJoin('achievement.organization', 'org')
      .addSelect(['org.id', 'org.name', 'org.logoUrl'])
      .where('ua.userId = :userId', { userId })
      .andWhere('ua.isDisplayed = :isDisplayed', { isDisplayed: true })
      .orderBy('ua.displaySlot', 'ASC')
      .addOrderBy('ua.awardedAt', 'DESC')
      .take(50)
      .getMany();
  }

  async getUserDisplayItems(organizationId: string, userId: string): Promise<UserAchievement[]> {
    return this.userAchievementRepo.find({
      where: { organizationId, userId, isDisplayed: true },
      relations: ['achievement'],
      order: { displaySlot: 'ASC', awardedAt: 'DESC' },
    });
  }

  async toggleDisplay(
    userAchievementId: string,
    userId: string,
    isDisplayed: boolean
  ): Promise<UserAchievement> {
    const ua = await this.userAchievementRepo.findOne({
      where: { id: userAchievementId, userId },
    });
    if (!ua) {
      throw new NotFoundError('Title or badge assignment not found');
    }
    ua.isDisplayed = isDisplayed;
    return this.userAchievementRepo.save(ua);
  }

  async updateDisplaySlot(
    userAchievementId: string,
    userId: string,
    displaySlot: number | null
  ): Promise<UserAchievement> {
    const ua = await this.userAchievementRepo.findOne({
      where: { id: userAchievementId, userId },
    });
    if (!ua) {
      throw new NotFoundError('Title or badge assignment not found');
    }
    ua.displaySlot = displaySlot;
    return this.userAchievementRepo.save(ua);
  }
}

