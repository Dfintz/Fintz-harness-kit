import { Federation } from './Federation';
import { Organization } from './Organization';
import { UserAchievement } from './UserAchievement';
export declare enum AchievementRarity {
    COMMON = "common",
    UNCOMMON = "uncommon",
    RARE = "rare",
    EPIC = "epic",
    LEGENDARY = "legendary"
}
export declare enum AchievementType {
    TITLE = "title",
    BADGE = "badge"
}
export declare class Achievement {
    id: string;
    type: string;
    organizationId?: string;
    organization?: Organization;
    federationId?: string;
    federation?: Federation;
    name: string;
    description?: string;
    category?: string;
    rarity: string;
    icon?: string;
    metadata?: Record<string, unknown>;
    createdBy: string;
    isActive: boolean;
    userAchievements?: UserAchievement[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Achievement.d.ts.map