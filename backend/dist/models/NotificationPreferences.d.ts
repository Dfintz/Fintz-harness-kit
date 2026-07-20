import { User } from './User';
export interface NotificationChannels {
    inApp: boolean;
    email: boolean;
    discord: boolean;
}
export interface NotificationCategories {
    fleet: boolean;
    activity: boolean;
    organization: boolean;
    trade: boolean;
    social: boolean;
    security: boolean;
    lfg: boolean;
    system: boolean;
}
export declare const DEFAULT_CHANNELS: NotificationChannels;
export declare const DEFAULT_CATEGORIES: NotificationCategories;
export declare class NotificationPreferences {
    id: string;
    userId: string;
    user?: User;
    muteAll: boolean;
    channels: NotificationChannels;
    categories: NotificationCategories;
    digestFrequency: 'daily' | 'weekly' | 'none';
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=NotificationPreferences.d.ts.map