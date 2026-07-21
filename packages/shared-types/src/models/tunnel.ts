/**
 * Tunnel / Jump Point types for cross-server Discord channel bridging
 * Inspired by tunnels.gg — supports rich content relay, moderation, analytics
 */

/**
 * Rate limit configuration for a tunnel
 */
export interface TunnelRateLimitConfig {
  maxMessages: number;
  windowMs: number;
  blockDurationMs: number;
}

/**
 * A single channel connection within a tunnel
 */
export interface TunnelConnection {
  guildId: string;
  channelId: string;
  guildName?: string;
  channelName?: string;
  webhookUrl?: string;
  webhookId?: string;
  connectedAt: Date;
}

/**
 * Attachment metadata for tunnel messages
 */
export interface TunnelAttachment {
  url: string;
  filename: string;
  contentType?: string;
  size?: number;
}

/**
 * Core tunnel (jump point) model
 */
export interface Tunnel {
  id: string;
  name: string;
  inviteCode: string;
  creatorGuildId: string;
  creatorChannelId: string;
  isPublic: boolean;
  password?: string;
  createdAt: Date;
  connectedChannels: TunnelConnection[];
  rateLimitConfig?: TunnelRateLimitConfig;
  contentFilterEnabled: boolean;
  allowBotMessages: boolean;
  maxConnectedServers: number;
  organizationId?: string;
}

/**
 * Tunnel message for persistence and real-time relay
 * Supports text, attachments, embeds, GIFs, stickers, replies
 */
export interface TunnelMessage {
  id: string;
  tunnelId: string;
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
  wasBlocked?: boolean;
  blockReason?: string;
  isEdited?: boolean;
  editedAt?: Date;
  timestamp: Date;
}

/**
 * Moderation ban/mute record
 */
export type TunnelBanType = 'ban' | 'mute';

export interface TunnelBan {
  id: string;
  tunnelId: string;
  userId: string;
  username?: string;
  type: TunnelBanType;
  reason?: string;
  issuedBy: string;
  expiresAt?: Date;
  createdAt: Date;
}

/**
 * Tunnel analytics data (per-tunnel)
 */
export interface TunnelAnalytics {
  tunnelId: string;
  messagesRelayed: number;
  messagesBlocked: number;
  lastActivity: Date | null;
  peakConnectionCount: number;
  totalUniqueGuilds: number;
  attachmentsRelayed: number;
  reactionsRelayed: number;
  hourlyBreakdown?: Array<{
    periodStart: Date;
    messagesRelayed: number;
    messagesBlocked: number;
    uniqueUsers: number;
    peakConnections: number;
  }>;
}

/**
 * System-wide tunnel statistics
 */
export interface TunnelSystemStats {
  totalTunnels: number;
  activeTunnels: number;
  totalConnections: number;
  totalMessagesRelayed: number;
  totalMessagesBlocked: number;
  mostActiveHour: number;
  tunnelsByVisibility: {
    public: number;
    private: number;
  };
  topTunnels: Array<{
    id: string;
    name: string;
    messagesRelayed: number;
    connectionCount: number;
  }>;
}

/**
 * WebSocket tunnel event types
 */
export type TunnelEventType =
  | 'tunnel:created'
  | 'tunnel:updated'
  | 'tunnel:deleted'
  | 'tunnel:message'
  | 'tunnel:user_joined'
  | 'tunnel:user_left'
  | 'tunnel:user_banned'
  | 'tunnel:user_muted'
  | 'tunnel:reaction_added'
  | 'tunnel:reaction_removed';

/**
 * WebSocket tunnel event envelope
 */
export interface TunnelEvent {
  type: TunnelEventType;
  tunnelId: string;
  data: Partial<Tunnel> | TunnelMessage | Record<string, unknown>;
  timestamp: number;
  userId?: string;
}
