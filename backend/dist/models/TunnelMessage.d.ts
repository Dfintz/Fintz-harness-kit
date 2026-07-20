import { Tunnel } from './Tunnel';
export interface TunnelAttachment {
    url: string;
    filename: string;
    contentType?: string;
    size?: number;
}
export declare class TunnelMessage {
    id: string;
    tunnelId: string;
    tunnel?: Tunnel;
    authorId: string;
    authorName: string;
    authorAvatar?: string;
    sourceGuildId?: string;
    sourceChannelId?: string;
    discordMessageId?: string;
    content?: string;
    attachments?: TunnelAttachment[];
    embeds?: Record<string, unknown>[];
    stickerIds?: string[];
    replyToMessageId?: string;
    isBot: boolean;
    wasBlocked: boolean;
    blockReason?: string;
    isEdited: boolean;
    editedAt?: Date;
    createdAt: Date;
}
//# sourceMappingURL=TunnelMessage.d.ts.map