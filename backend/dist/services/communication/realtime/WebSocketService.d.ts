import { Server as HttpServer } from 'http';
export interface TunnelMessage {
    id: string;
    tunnelId: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    content: string;
    timestamp: Date;
    guildId: string;
}
export declare class WebSocketService {
    private static instance;
    private io;
    private tunnelService;
    private contentFilter;
    private rateLimiter;
    private userSockets;
    private constructor();
    static getInstance(): WebSocketService;
    initialize(httpServer: HttpServer): void;
    private authenticateSocket;
    private handleConnection;
    private handleJoinTunnel;
    private handleLeaveTunnel;
    private handleSendMessage;
    private handleMessageHistory;
    private handleDisconnect;
    broadcastTunnelCreated(tunnel: Record<string, unknown>): void;
    broadcastTunnelDeleted(tunnelId: string): void;
    broadcastTunnelUpdated(tunnel: Record<string, unknown>): void;
    sendToUser(userId: string, event: string, data: unknown): void;
    getOnlineUsersInTunnel(tunnelId: string): number;
    getConnectedUserCount(): number;
}
//# sourceMappingURL=WebSocketService.d.ts.map