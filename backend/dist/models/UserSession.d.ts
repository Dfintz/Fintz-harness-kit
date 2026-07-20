import { User } from './User';
export declare class UserSession {
    id: number;
    userId: number;
    user: User;
    sessionToken: string;
    discordAccessToken: string;
    discordRefreshToken: string;
    discordTokenExpiry: Date;
    isActive: boolean;
    createdAt: Date;
    lastActivity: Date;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
}
//# sourceMappingURL=UserSession.d.ts.map