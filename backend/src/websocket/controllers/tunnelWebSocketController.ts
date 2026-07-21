import crypto from 'node:crypto';

import { ContentFilter } from '../../bot/utils/contentFilter';
import { TunnelRateLimiter } from '../../bot/utils/tunnelRateLimiter';
import { TunnelService } from '../../services/discord/TunnelService';
import { logger } from '../../utils/logger';
import { emitToRoom } from '../websocketServer';

/**
 * Tunnel WebSocket Controller
 *
 * Handles real-time events for tunnel (jump point) operations:
 * - Tunnel created, updated, deleted notifications
 * - Web-based tunnel chat (message send/receive)
 * - Message filtering and rate limiting for web clients
 * - Tunnel room join/leave
 */

export interface TunnelMessageData {
  id: string;
  tunnelId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content?: string;
  attachments?: Array<{ url: string; filename: string; contentType?: string; size?: number }>;
  embeds?: Record<string, unknown>[];
  stickerIds?: string[];
  replyToMessageId?: string;
  isBot?: boolean;
  timestamp: number;
  guildId?: string;
}

export interface TunnelEventData {
  type:
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
  tunnelId: string;
  data: Record<string, unknown>;
  timestamp: number;
  userId?: string;
}

// ==================== Emit functions (called from controllers/services) ====================

/**
 * Emit tunnel created event to all clients in the tunnel room
 */
export const emitTunnelCreated = (
  tunnelId: string,
  tunnelData: Record<string, unknown>,
  userId?: string
): void => {
  const event: TunnelEventData = {
    type: 'tunnel:created',
    tunnelId,
    data: tunnelData,
    timestamp: Date.now(),
    userId,
  };

  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:created', event);
  logger.debug(`Emitted tunnel:created for tunnel ${tunnelId}`);
};

/**
 * Emit tunnel updated event
 */
export const emitTunnelUpdated = (
  tunnelId: string,
  tunnelData: Record<string, unknown>,
  userId?: string
): void => {
  const event: TunnelEventData = {
    type: 'tunnel:updated',
    tunnelId,
    data: tunnelData,
    timestamp: Date.now(),
    userId,
  };

  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:updated', event);
  logger.debug(`Emitted tunnel:updated for tunnel ${tunnelId}`);
};

/**
 * Emit tunnel deleted event
 */
export const emitTunnelDeleted = (tunnelId: string, userId?: string): void => {
  const event: TunnelEventData = {
    type: 'tunnel:deleted',
    tunnelId,
    data: { tunnelId },
    timestamp: Date.now(),
    userId,
  };

  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:deleted', event);
  logger.debug(`Emitted tunnel:deleted for tunnel ${tunnelId}`);
};

/**
 * Emit a tunnel message to all clients in the tunnel room
 */
export const emitTunnelMessage = (tunnelId: string, message: TunnelMessageData): void => {
  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:message', message);
  logger.debug(`Emitted tunnel:message for tunnel ${tunnelId}`);
};

/**
 * Emit user joined tunnel event
 */
export const emitTunnelUserJoined = (tunnelId: string, userId: string, username: string): void => {
  const event: TunnelEventData = {
    type: 'tunnel:user_joined',
    tunnelId,
    data: { userId, username },
    timestamp: Date.now(),
    userId,
  };

  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:user_joined', event);
  logger.debug(`Emitted tunnel:user_joined for user ${username} in tunnel ${tunnelId}`);
};

/**
 * Emit user left tunnel event
 */
export const emitTunnelUserLeft = (tunnelId: string, userId: string, username: string): void => {
  const event: TunnelEventData = {
    type: 'tunnel:user_left',
    tunnelId,
    data: { userId, username },
    timestamp: Date.now(),
    userId,
  };

  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:user_left', event);
  logger.debug(`Emitted tunnel:user_left for user ${username} in tunnel ${tunnelId}`);
};

/**
 * Emit user banned from tunnel event
 */
export const emitTunnelUserBanned = (tunnelId: string, userId: string, reason: string): void => {
  const event: TunnelEventData = {
    type: 'tunnel:user_banned',
    tunnelId,
    data: { userId, reason },
    timestamp: Date.now(),
    userId,
  };

  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:user_banned', event);
  logger.debug(`Emitted tunnel:user_banned for user ${userId} in tunnel ${tunnelId}`);
};

/**
 * Emit reaction added event
 */
export const emitTunnelReactionAdded = (
  tunnelId: string,
  messageId: string,
  userId: string,
  emoji: string
): void => {
  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:reaction_added', {
    tunnelId,
    messageId,
    userId,
    emoji,
    timestamp: Date.now(),
  });
};

/**
 * Emit reaction removed event
 */
export const emitTunnelReactionRemoved = (
  tunnelId: string,
  messageId: string,
  userId: string,
  emoji: string
): void => {
  emitToRoom(`tunnel:${tunnelId}`, 'tunnel:reaction_removed', {
    tunnelId,
    messageId,
    userId,
    emoji,
    timestamp: Date.now(),
  });
};

// ==================== Socket event handlers (registered in websocketServer) ====================

/**
 * Handle tunnel:join event from a client socket
 */
export const handleTunnelJoin = async (
  socket: {
    userId?: string;
    username?: string;
    join: (room: string) => void;
    emit: (event: string, data: unknown) => void;
  },
  tunnelId: string
): Promise<void> => {
  try {
    if (!socket.userId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const tunnelService = TunnelService.getInstance();
    const tunnel = await tunnelService.getTunnel(tunnelId);

    if (!tunnel) {
      socket.emit('error', { message: 'Tunnel not found' });
      return;
    }

    // Join the tunnel room
    socket.join(`tunnel:${tunnelId}`);
    logger.info(`User ${socket.username} joined tunnel room: tunnel:${tunnelId}`);

    // Notify other users in the tunnel
    emitTunnelUserJoined(tunnelId, socket.userId, socket.username || 'Unknown');

    // Send tunnel info to the joining client
    socket.emit('tunnel:joined', {
      tunnelId,
      name: tunnel.name,
      connectedChannels: tunnel.connectedChannels.length,
      contentFilterEnabled: tunnel.contentFilterEnabled,
    });
  } catch (error) {
    logger.error(`Error handling tunnel:join for tunnel ${tunnelId}:`, error);
    socket.emit('error', { message: 'Failed to join tunnel' });
  }
};

/**
 * Handle tunnel:leave event from a client socket
 */
export const handleTunnelLeave = (
  socket: {
    userId?: string;
    username?: string;
    leave: (room: string) => void;
    emit: (event: string, data: unknown) => void;
  },
  tunnelId: string
): void => {
  socket.leave(`tunnel:${tunnelId}`);
  logger.info(`User ${socket.username} left tunnel room: tunnel:${tunnelId}`);

  if (socket.userId) {
    emitTunnelUserLeft(tunnelId, socket.userId, socket.username || 'Unknown');
  }
};

/**
 * Handle tunnel:message event from a web client
 */
export const handleTunnelMessage = async (
  socket: { userId?: string; username?: string; emit: (event: string, data: unknown) => void },
  data: { tunnelId: string; content: string; authorAvatar?: string }
): Promise<void> => {
  try {
    if (!socket.userId || !socket.username) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const { tunnelId, content, authorAvatar } = data;

    const MAX_CONTENT_LENGTH = 4000;
    if (!tunnelId || !content || content.trim().length === 0) {
      socket.emit('error', { message: 'Tunnel ID and content are required' });
      return;
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      socket.emit('error', {
        message: `Message exceeds maximum length of ${MAX_CONTENT_LENGTH} characters`,
      });
      return;
    }

    const tunnelService = TunnelService.getInstance();
    const tunnel = await tunnelService.getTunnel(tunnelId);

    if (!tunnel) {
      socket.emit('error', { message: 'Tunnel not found' });
      return;
    }

    // Check if user is banned
    const isBanned = await tunnelService.isUserBanned(tunnelId, socket.userId);
    if (isBanned) {
      socket.emit('message:blocked', {
        reason: 'You are banned from this tunnel',
        severity: 'high',
      });
      return;
    }

    // Check if user is muted
    const isMuted = await tunnelService.isUserMuted(tunnelId, socket.userId);
    if (isMuted) {
      socket.emit('message:blocked', {
        reason: 'You are muted in this tunnel',
        severity: 'medium',
      });
      return;
    }

    let blockReason: string | undefined;

    // Apply content filter if enabled
    if (tunnel.contentFilterEnabled) {
      const contentFilter = ContentFilter.getInstance();
      const filterResult = contentFilter.filterMessage(content, socket.userId);

      if (!filterResult.allowed) {
        blockReason = filterResult.reason || 'Message blocked by content filter';
        socket.emit('message:blocked', {
          reason: blockReason,
          severity: filterResult.severity || 'medium',
        });

        // Still persist blocked messages for audit
        void tunnelService.saveMessage({
          id: crypto.randomUUID(),
          tunnelId,
          authorId: socket.userId,
          authorName: socket.username,
          authorAvatar,
          content: content.trim(),
          isBot: false,
          wasBlocked: true,
          blockReason,
          timestamp: new Date(),
        });

        tunnelService.recordMessageRelay(tunnelId, true, socket.userId);
        return;
      }
    }

    // Check rate limit
    const rateLimiter = TunnelRateLimiter.getInstance();
    const rateLimitResult = rateLimiter.checkRateLimit(tunnelId, socket.userId);

    if (!rateLimitResult.allowed) {
      socket.emit('message:ratelimited', {
        resetAt: rateLimitResult.resetAt,
        remaining: rateLimitResult.remaining,
        blockedUntil: rateLimitResult.blockedUntil,
      });
      return;
    }

    // Record message for rate limiting
    rateLimiter.recordMessage(tunnelId, socket.userId);

    // Build message
    const message: TunnelMessageData = {
      id: crypto.randomUUID(),
      tunnelId,
      authorId: socket.userId,
      authorName: socket.username,
      authorAvatar,
      content: content.trim(),
      isBot: false,
      timestamp: Date.now(),
    };

    // Emit to all clients in the tunnel room
    emitTunnelMessage(tunnelId, message);

    // Persist message (non-blocking)
    void tunnelService.saveMessage({
      ...message,
      isBot: false,
      timestamp: new Date(message.timestamp),
    });

    // Record analytics
    tunnelService.recordMessageRelay(tunnelId, false, socket.userId);
  } catch (error) {
    logger.error('Error handling tunnel:message:', error);
    socket.emit('error', { message: 'Failed to send message' });
  }
};

/**
 * Handle tunnel:history request — returns persisted message history
 */
export const handleTunnelHistory = async (
  socket: { userId?: string; emit: (event: string, data: unknown) => void },
  data: { tunnelId: string; limit?: number; before?: string }
): Promise<void> => {
  try {
    if (!socket.userId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const tunnelId = typeof data === 'string' ? data : data.tunnelId;
    const limit = typeof data === 'object' ? data.limit : undefined;
    const before = typeof data === 'object' && data.before ? new Date(data.before) : undefined;

    const tunnelService = TunnelService.getInstance();
    const messages = await tunnelService.getMessageHistory(tunnelId, limit, before);

    socket.emit('tunnel:history', {
      tunnelId,
      messages: messages.map(m => ({
        id: m.id,
        tunnelId: m.tunnelId,
        authorId: m.authorId,
        authorName: m.authorName,
        authorAvatar: m.authorAvatar,
        content: m.content,
        attachments: m.attachments,
        embeds: m.embeds,
        stickerIds: m.stickerIds,
        replyToMessageId: m.replyToMessageId,
        isBot: m.isBot,
        timestamp: m.timestamp.getTime(),
      })),
    });
  } catch (error) {
    logger.error('Error handling tunnel:history:', error);
    socket.emit('error', { message: 'Failed to fetch message history' });
  }
};
