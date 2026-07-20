import { Achievement } from '../../models/Achievement';
import { UserAchievement } from '../../models/UserAchievement';
export declare class TitleBadgeService {
    private readonly achievementRepo;
    private readonly userAchievementRepo;
    list(organizationId: string, filters?: {
        category?: string;
        rarity?: string;
        type?: string;
    }): Promise<{
        items: Achievement[];
        total: number;
    }>;
    getById(achievementId: string, organizationId: string): Promise<Achievement | null>;
    create(organizationId: string, createdBy: string, data: {
        name: string;
        type?: string;
        description?: string;
        category?: string;
        rarity?: string;
        icon?: string;
        metadata?: Record<string, unknown>;
    }): Promise<Achievement>;
    update(achievementId: string, organizationId: string, data: Partial<Pick<Achievement, 'name' | 'type' | 'description' | 'category' | 'rarity' | 'metadata' | 'isActive'>> & {
        icon?: string | null;
    }): Promise<Achievement>;
    delete(achievementId: string, organizationId: string): Promise<void>;
    listByFederation(federationId: string, filters?: {
        category?: string;
        rarity?: string;
        type?: string;
    }): Promise<{
        items: Achievement[];
        total: number;
    }>;
    getByIdFederation(achievementId: string, federationId: string): Promise<Achievement | null>;
    createForFederation(federationId: string, createdBy: string, data: {
        name: string;
        type?: string;
        description?: string;
        category?: string;
        rarity?: string;
        icon?: string;
        metadata?: Record<string, unknown>;
    }): Promise<Achievement>;
    updateForFederation(achievementId: string, federationId: string, data: Partial<Pick<Achievement, 'name' | 'type' | 'description' | 'category' | 'rarity' | 'icon' | 'metadata' | 'isActive'>>): Promise<Achievement>;
    deleteForFederation(achievementId: string, federationId: string): Promise<void>;
    award(achievementId: string, organizationId: string, userId: string, awardedBy: string): Promise<UserAchievement>;
    revoke(achievementId: string, organizationId: string, userId: string, revokedBy?: string): Promise<void>;
    getRecipients(achievementId: string, organizationId: string): Promise<UserAchievement[]>;
    getUserItems(organizationId: string, userId: string): Promise<UserAchievement[]>;
    getUserPublicItems(userId: string): Promise<UserAchievement[]>;
    getUserDisplayItems(organizationId: string, userId: string): Promise<UserAchievement[]>;
    toggleDisplay(userAchievementId: string, userId: string, isDisplayed: boolean): Promise<UserAchievement>;
    updateDisplaySlot(userAchievementId: string, userId: string, displaySlot: number | null): Promise<UserAchievement>;
}
//# sourceMappingURL=TitleBadgeService.d.ts.map