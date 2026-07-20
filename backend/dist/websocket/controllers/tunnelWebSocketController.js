"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTunnelHistory = exports.handleTunnelMessage = exports.handleTunnelLeave = exports.handleTunnelJoin = exports.emitTunnelReactionRemoved = exports.emitTunnelReactionAdded = exports.emitTunnelUserBanned = exports.emitTunnelUserLeft = exports.emitTunnelUserJoined = exports.emitTunnelMessage = exports.emitTunnelDeleted = exports.emitTunnelUpdated = exports.emitTunnelCreated = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const contentFilter_1 = require("../../bot/utils/contentFilter");
const tunnelRateLimiter_1 = require("../../bot/utils/tunnelRateLimiter");
const TunnelService_1 = require("../../services/discord/TunnelService");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../websocketServer");
const emitTunnelCreated = (tunnelId, tunnelData, userId) => {
    const event = {
        type: 'tunnel:created',
        tunnelId,
        data: tunnelData,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:created', event);
    logger_1.logger.debug(`Emitted tunnel:created for tunnel ${tunnelId}`);
};
exports.emitTunnelCreated = emitTunnelCreated;
const emitTunnelUpdated = (tunnelId, tunnelData, userId) => {
    const event = {
        type: 'tunnel:updated',
        tunnelId,
        data: tunnelData,
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:updated', event);
    logger_1.logger.debug(`Emitted tunnel:updated for tunnel ${tunnelId}`);
};
exports.emitTunnelUpdated = emitTunnelUpdated;
const emitTunnelDeleted = (tunnelId, userId) => {
    const event = {
        type: 'tunnel:deleted',
        tunnelId,
        data: { tunnelId },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:deleted', event);
    logger_1.logger.debug(`Emitted tunnel:deleted for tunnel ${tunnelId}`);
};
exports.emitTunnelDeleted = emitTunnelDeleted;
const emitTunnelMessage = (tunnelId, message) => {
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:message', message);
    logger_1.logger.debug(`Emitted tunnel:message for tunnel ${tunnelId}`);
};
exports.emitTunnelMessage = emitTunnelMessage;
const emitTunnelUserJoined = (tunnelId, userId, username) => {
    const event = {
        type: 'tunnel:user_joined',
        tunnelId,
        data: { userId, username },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:user_joined', event);
    logger_1.logger.debug(`Emitted tunnel:user_joined for user ${username} in tunnel ${tunnelId}`);
};
exports.emitTunnelUserJoined = emitTunnelUserJoined;
const emitTunnelUserLeft = (tunnelId, userId, username) => {
    const event = {
        type: 'tunnel:user_left',
        tunnelId,
        data: { userId, username },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:user_left', event);
    logger_1.logger.debug(`Emitted tunnel:user_left for user ${username} in tunnel ${tunnelId}`);
};
exports.emitTunnelUserLeft = emitTunnelUserLeft;
const emitTunnelUserBanned = (tunnelId, userId, reason) => {
    const event = {
        type: 'tunnel:user_banned',
        tunnelId,
        data: { userId, reason },
        timestamp: Date.now(),
        userId,
    };
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:user_banned', event);
    logger_1.logger.debug(`Emitted tunnel:user_banned for user ${userId} in tunnel ${tunnelId}`);
};
exports.emitTunnelUserBanned = emitTunnelUserBanned;
const emitTunnelReactionAdded = (tunnelId, messageId, userId, emoji) => {
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:reaction_added', {
        tunnelId,
        messageId,
        userId,
        emoji,
        timestamp: Date.now(),
    });
};
exports.emitTunnelReactionAdded = emitTunnelReactionAdded;
const emitTunnelReactionRemoved = (tunnelId, messageId, userId, emoji) => {
    (0, websocketServer_1.emitToRoom)(`tunnel:${tunnelId}`, 'tunnel:reaction_removed', {
        tunnelId,
        messageId,
        userId,
        emoji,
        timestamp: Date.now(),
    });
};
exports.emitTunnelReactionRemoved = emitTunnelReactionRemoved;
const handleTunnelJoin = async (socket, tunnelId) => {
    try {
        if (!socket.userId) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        const tunnelService = TunnelService_1.TunnelService.getInstance();
        const tunnel = await tunnelService.getTunnel(tunnelId);
        if (!tunnel) {
            socket.emit('error', { message: 'Tunnel not found' });
            return;
        }
        socket.join(`tunnel:${tunnelId}`);
        logger_1.logger.info(`User ${socket.username} joined tunnel room: tunnel:${tunnelId}`);
        (0, exports.emitTunnelUserJoined)(tunnelId, socket.userId, socket.username || 'Unknown');
        socket.emit('tunnel:joined', {
            tunnelId,
            name: tunnel.name,
            connectedChannels: tunnel.connectedChannels.length,
            contentFilterEnabled: tunnel.contentFilterEnabled,
        });
    }
    catch (error) {
        logger_1.logger.error(`Error handling tunnel:join for tunnel ${tunnelId}:`, error);
        socket.emit('error', { message: 'Failed to join tunnel' });
    }
};
exports.handleTunnelJoin = handleTunnelJoin;
const handleTunnelLeave = (socket, tunnelId) => {
    socket.leave(`tunnel:${tunnelId}`);
    logger_1.logger.info(`User ${socket.username} left tunnel room: tunnel:${tunnelId}`);
    if (socket.userId) {
        (0, exports.emitTunnelUserLeft)(tunnelId, socket.userId, socket.username || 'Unknown');
    }
};
exports.handleTunnelLeave = handleTunnelLeave;
const handleTunnelMessage = async (socket, data) => {
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
        const tunnelService = TunnelService_1.TunnelService.getInstance();
        const tunnel = await tunnelService.getTunnel(tunnelId);
        if (!tunnel) {
            socket.emit('error', { message: 'Tunnel not found' });
            return;
        }
        const isBanned = await tunnelService.isUserBanned(tunnelId, socket.userId);
        if (isBanned) {
            socket.emit('message:blocked', {
                reason: 'You are banned from this tunnel',
                severity: 'high',
            });
            return;
        }
        const isMuted = await tunnelService.isUserMuted(tunnelId, socket.userId);
        if (isMuted) {
            socket.emit('message:blocked', {
                reason: 'You are muted in this tunnel',
                severity: 'medium',
            });
            return;
        }
        let blockReason;
        if (tunnel.contentFilterEnabled) {
            const contentFilter = contentFilter_1.ContentFilter.getInstance();
            const filterResult = contentFilter.filterMessage(content, socket.userId);
            if (!filterResult.allowed) {
                blockReason = filterResult.reason || 'Message blocked by content filter';
                socket.emit('message:blocked', {
                    reason: blockReason,
                    severity: filterResult.severity || 'medium',
                });
                void tunnelService.saveMessage({
                    id: node_crypto_1.default.randomUUID(),
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
        const rateLimiter = tunnelRateLimiter_1.TunnelRateLimiter.getInstance();
        const rateLimitResult = rateLimiter.checkRateLimit(tunnelId, socket.userId);
        if (!rateLimitResult.allowed) {
            socket.emit('message:ratelimited', {
                resetAt: rateLimitResult.resetAt,
                remaining: rateLimitResult.remaining,
                blockedUntil: rateLimitResult.blockedUntil,
            });
            return;
        }
        rateLimiter.recordMessage(tunnelId, socket.userId);
        const message = {
            id: node_crypto_1.default.randomUUID(),
            tunnelId,
            authorId: socket.userId,
            authorName: socket.username,
            authorAvatar,
            content: content.trim(),
            isBot: false,
            timestamp: Date.now(),
        };
        (0, exports.emitTunnelMessage)(tunnelId, message);
        void tunnelService.saveMessage({
            ...message,
            isBot: false,
            timestamp: new Date(message.timestamp),
        });
        tunnelService.recordMessageRelay(tunnelId, false, socket.userId);
    }
    catch (error) {
        logger_1.logger.error('Error handling tunnel:message:', error);
        socket.emit('error', { message: 'Failed to send message' });
    }
};
exports.handleTunnelMessage = handleTunnelMessage;
const handleTunnelHistory = async (socket, data) => {
    try {
        if (!socket.userId) {
            socket.emit('error', { message: 'Authentication required' });
            return;
        }
        const tunnelId = typeof data === 'string' ? data : data.tunnelId;
        const limit = typeof data === 'object' ? data.limit : undefined;
        const before = typeof data === 'object' && data.before ? new Date(data.before) : undefined;
        const tunnelService = TunnelService_1.TunnelService.getInstance();
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
    }
    catch (error) {
        logger_1.logger.error('Error handling tunnel:history:', error);
        socket.emit('error', { message: 'Failed to fetch message history' });
    }
};
exports.handleTunnelHistory = handleTunnelHistory;
//# sourceMappingURL=tunnelWebSocketController.js.map