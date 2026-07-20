"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TitleBadgeService = void 0;
const database_1 = require("../../config/database");
const Achievement_1 = require("../../models/Achievement");
const UserAchievement_1 = require("../../models/UserAchievement");
const apiErrors_1 = require("../../utils/apiErrors");
const GamificationAuditLogger_1 = require("./GamificationAuditLogger");
class TitleBadgeService {
    achievementRepo = database_1.AppDataSource.getRepository(Achievement_1.Achievement);
    userAchievementRepo = database_1.AppDataSource.getRepository(UserAchievement_1.UserAchievement);
    async list(organizationId, filters) {
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
    async getById(achievementId, organizationId) {
        return this.achievementRepo.findOne({
            where: { id: achievementId, organizationId },
        });
    }
    async create(organizationId, createdBy, data) {
        const existing = await this.achievementRepo.findOne({
            where: { organizationId, name: data.name },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('A title or badge with this name already exists');
        }
        const achievement = this.achievementRepo.create({
            ...data,
            type: data.type ?? Achievement_1.AchievementType.BADGE,
            organizationId,
            createdBy,
        });
        const saved = await this.achievementRepo.save(achievement);
        GamificationAuditLogger_1.gamificationAuditLogger.logBadgeCreated(organizationId, saved.id, saved.name, createdBy);
        return saved;
    }
    async update(achievementId, organizationId, data) {
        const achievement = await this.achievementRepo.findOne({
            where: { id: achievementId, organizationId },
        });
        if (!achievement) {
            throw new apiErrors_1.NotFoundError('Title or badge not found');
        }
        const { icon, ...rest } = data;
        const updates = { ...rest };
        if (icon !== undefined) {
            updates.icon = icon || undefined;
        }
        Object.assign(achievement, updates);
        const saved = await this.achievementRepo.save(achievement);
        GamificationAuditLogger_1.gamificationAuditLogger.logBadgeUpdated(organizationId, saved.id, saved.name, saved.createdBy, data);
        return saved;
    }
    async delete(achievementId, organizationId) {
        const achievement = await this.achievementRepo.findOne({
            where: { id: achievementId, organizationId },
        });
        if (!achievement) {
            throw new apiErrors_1.NotFoundError('Title or badge not found');
        }
        GamificationAuditLogger_1.gamificationAuditLogger.logBadgeDeleted(organizationId, achievement.id, achievement.name, achievement.createdBy);
        await this.achievementRepo.remove(achievement);
    }
    async listByFederation(federationId, filters) {
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
    async getByIdFederation(achievementId, federationId) {
        return this.achievementRepo.findOne({
            where: { id: achievementId, federationId },
        });
    }
    async createForFederation(federationId, createdBy, data) {
        const existing = await this.achievementRepo.findOne({
            where: { federationId, name: data.name },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('A title or badge with this name already exists in this federation');
        }
        const achievement = this.achievementRepo.create({
            ...data,
            type: data.type ?? Achievement_1.AchievementType.BADGE,
            federationId,
            createdBy,
        });
        return this.achievementRepo.save(achievement);
    }
    async updateForFederation(achievementId, federationId, data) {
        const achievement = await this.achievementRepo.findOne({
            where: { id: achievementId, federationId },
        });
        if (!achievement) {
            throw new apiErrors_1.NotFoundError('Title or badge not found');
        }
        Object.assign(achievement, data);
        return this.achievementRepo.save(achievement);
    }
    async deleteForFederation(achievementId, federationId) {
        const achievement = await this.achievementRepo.findOne({
            where: { id: achievementId, federationId },
        });
        if (!achievement) {
            throw new apiErrors_1.NotFoundError('Title or badge not found');
        }
        await this.achievementRepo.remove(achievement);
    }
    async award(achievementId, organizationId, userId, awardedBy) {
        const achievement = await this.achievementRepo.findOne({
            where: { id: achievementId, organizationId },
        });
        if (!achievement) {
            throw new apiErrors_1.NotFoundError('Title or badge not found');
        }
        const existing = await this.userAchievementRepo.findOne({
            where: { achievementId, userId, organizationId },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('User already has this title or badge');
        }
        const ua = this.userAchievementRepo.create({
            achievementId,
            userId,
            organizationId,
            awardedBy,
        });
        const saved = await this.userAchievementRepo.save(ua);
        GamificationAuditLogger_1.gamificationAuditLogger.logBadgeAwarded(organizationId, achievementId, achievement.name, userId, awardedBy);
        return saved;
    }
    async revoke(achievementId, organizationId, userId, revokedBy) {
        const ua = await this.userAchievementRepo.findOne({
            where: { achievementId, userId, organizationId },
            relations: ['achievement'],
        });
        if (!ua) {
            throw new apiErrors_1.NotFoundError('User does not have this title or badge');
        }
        GamificationAuditLogger_1.gamificationAuditLogger.logBadgeRevoked(organizationId, achievementId, ua.achievement?.name ?? 'Unknown', userId, revokedBy ?? userId);
        await this.userAchievementRepo.remove(ua);
    }
    async getRecipients(achievementId, organizationId) {
        const achievement = await this.achievementRepo.findOne({
            where: { id: achievementId, organizationId },
        });
        if (!achievement) {
            throw new apiErrors_1.NotFoundError('Title or badge not found');
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
    async getUserItems(organizationId, userId) {
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
    async getUserPublicItems(userId) {
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
    async getUserDisplayItems(organizationId, userId) {
        return this.userAchievementRepo.find({
            where: { organizationId, userId, isDisplayed: true },
            relations: ['achievement'],
            order: { displaySlot: 'ASC', awardedAt: 'DESC' },
        });
    }
    async toggleDisplay(userAchievementId, userId, isDisplayed) {
        const ua = await this.userAchievementRepo.findOne({
            where: { id: userAchievementId, userId },
        });
        if (!ua) {
            throw new apiErrors_1.NotFoundError('Title or badge assignment not found');
        }
        ua.isDisplayed = isDisplayed;
        return this.userAchievementRepo.save(ua);
    }
    async updateDisplaySlot(userAchievementId, userId, displaySlot) {
        const ua = await this.userAchievementRepo.findOne({
            where: { id: userAchievementId, userId },
        });
        if (!ua) {
            throw new apiErrors_1.NotFoundError('Title or badge assignment not found');
        }
        ua.displaySlot = displaySlot;
        return this.userAchievementRepo.save(ua);
    }
}
exports.TitleBadgeService = TitleBadgeService;
//# sourceMappingURL=TitleBadgeService.js.map