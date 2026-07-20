import { Achievement } from './Achievement';
import { User } from './User';
export declare class UserAchievement {
    id: string;
    achievementId: string;
    achievement?: Achievement;
    userId: string;
    user?: User;
    organizationId: string;
    awardedBy: string;
    isDisplayed: boolean;
    displaySlot: number | null;
    awardedAt: Date;
}
//# sourceMappingURL=UserAchievement.d.ts.map