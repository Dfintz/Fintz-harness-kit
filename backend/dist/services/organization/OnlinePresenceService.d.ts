import { Server } from 'socket.io';
export declare class OnlinePresenceService {
    private userPreferencesService;
    private userOrgRepo;
    private io;
    constructor();
    setSocketServer(io: Server): void;
    private getIO;
    getOnlineMemberCount(organizationId: string): Promise<number>;
    private getWebSocketOnlineCount;
    private getDiscordOnlineCount;
    getOnlineMembers(organizationId: string): Promise<Array<{
        userId: string;
        username: string;
        connectedAt: number;
    }>>;
    isUserOnline(userId: string): Promise<boolean>;
    getOnlineCountsForOrganizations(organizationIds: string[]): Promise<Map<string, number>>;
    emitPresenceEvent(organizationId: string, event: 'user_online' | 'user_offline', userId: string, username: string): Promise<void>;
    getUserOrganizations(userId: string): Promise<string[]>;
}
//# sourceMappingURL=OnlinePresenceService.d.ts.map