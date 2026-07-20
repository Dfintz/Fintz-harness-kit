export interface TunnelMessageData {
    id: string;
    tunnelId: string;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    content?: string;
    attachments?: Array<{
        url: string;
        filename: string;
        contentType?: string;
        size?: number;
    }>;
    embeds?: Record<string, unknown>[];
    stickerIds?: string[];
    replyToMessageId?: string;
    isBot?: boolean;
    timestamp: number;
    guildId?: string;
}
export interface TunnelEventData {
    type: 'tunnel:created' | 'tunnel:updated' | 'tunnel:deleted' | 'tunnel:message' | 'tunnel:user_joined' | 'tunnel:user_left' | 'tunnel:user_banned' | 'tunnel:user_muted' | 'tunnel:reaction_added' | 'tunnel:reaction_removed';
    tunnelId: string;
    data: Record<string, unknown>;
    timestamp: number;
    userId?: string;
}
export declare const emitTunnelCreated: (tunnelId: string, tunnelData: Record<string, unknown>, userId?: string) => void;
export declare const emitTunnelUpdated: (tunnelId: string, tunnelData: Record<string, unknown>, userId?: string) => void;
export declare const emitTunnelDeleted: (tunnelId: string, userId?: string) => void;
export declare const emitTunnelMessage: (tunnelId: string, message: TunnelMessageData) => void;
export declare const emitTunnelUserJoined: (tunnelId: string, userId: string, username: string) => void;
export declare const emitTunnelUserLeft: (tunnelId: string, userId: string, username: string) => void;
export declare const emitTunnelUserBanned: (tunnelId: string, userId: string, reason: string) => void;
export declare const emitTunnelReactionAdded: (tunnelId: string, messageId: string, userId: string, emoji: string) => void;
export declare const emitTunnelReactionRemoved: (tunnelId: string, messageId: string, userId: string, emoji: string) => void;
export declare const handleTunnelJoin: (socket: {
    userId?: string;
    username?: string;
    join: (room: string) => void;
    emit: (event: string, data: unknown) => void;
}, tunnelId: string) => Promise<void>;
export declare const handleTunnelLeave: (socket: {
    userId?: string;
    username?: string;
    leave: (room: string) => void;
    emit: (event: string, data: unknown) => void;
}, tunnelId: string) => void;
export declare const handleTunnelMessage: (socket: {
    userId?: string;
    username?: string;
    emit: (event: string, data: unknown) => void;
}, data: {
    tunnelId: string;
    content: string;
    authorAvatar?: string;
}) => Promise<void>;
export declare const handleTunnelHistory: (socket: {
    userId?: string;
    emit: (event: string, data: unknown) => void;
}, data: {
    tunnelId: string;
    limit?: number;
    before?: string;
}) => Promise<void>;
//# sourceMappingURL=tunnelWebSocketController.d.ts.map