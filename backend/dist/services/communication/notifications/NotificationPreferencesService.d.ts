import { NotificationCategories, NotificationChannels, NotificationPreferences } from '../../../models/NotificationPreferences';
export interface UpdateNotificationPreferencesDto {
    muteAll?: boolean;
    channels?: Partial<NotificationChannels>;
    categories?: Partial<NotificationCategories>;
    digestFrequency?: 'daily' | 'weekly' | 'none';
}
export declare class NotificationPreferencesService {
    private readonly repo;
    constructor();
    getOrCreate(userId: string): Promise<NotificationPreferences>;
    update(userId: string, dto: UpdateNotificationPreferencesDto): Promise<NotificationPreferences>;
    shouldDeliver(userId: string, channel: keyof NotificationChannels, category: keyof NotificationCategories): Promise<boolean>;
    deleteForUser(userId: string): Promise<number>;
}
//# sourceMappingURL=NotificationPreferencesService.d.ts.map