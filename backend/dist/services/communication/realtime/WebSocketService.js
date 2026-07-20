"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = require("jsonwebtoken");
const socket_io_1 = require("socket.io");
const contentFilter_1 = require("../../../bot/utils/contentFilter");
const tunnelRateLimiter_1 = require("../../../bot/utils/tunnelRateLimiter");
const logger_1 = require("../../../utils/logger");
const TunnelService_1 = require("../../discord/TunnelService");
const infrastructure_1 = require("../../infrastructure");
const secretsManager = infrastructure_1.SecretsManagerService.getInstance();
let devWsJwtSecret = null;
class WebSocketService {
    static instance;
    io = null;
    tunnelService;
    contentFilter;
    rateLimiter;
    userSockets = new Map();
    constructor() {
        this.tunnelService = TunnelService_1.TunnelService.getInstance();
        this.contentFilter = contentFilter_1.ContentFilter.getInstance();
        this.rateLimiter = tunnelRateLimiter_1.TunnelRateLimiter.getInstance();
    }
    static getInstance() {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }
    initialize(httpServer) {
        this.io = new socket_io_1.Server(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
                credentials: true,
            },
            path: '/socket.io/',
        });
        this.io.use(this.authenticateSocket.bind(this));
        this.io.on('connection', this.handleConnection.bind(this));
        logger_1.logger.info('WebSocket service initialized');
    }
    async authenticateSocket(socket, next) {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
            if (!token) {
                return next(new Error('Authentication token required'));
            }
            let jwtSecret;
            try {
                jwtSecret = secretsManager.getJwtSecret();
            }
            catch (_error) {
                if (process.env.NODE_ENV === 'production') {
                    logger_1.logger.error('JWT_SECRET not configured for WebSocket authentication');
                    return next(new Error('Server configuration error'));
                }
                const envSecret = process.env.JWT_SECRET;
                if (envSecret) {
                    jwtSecret = envSecret;
                }
                else {
                    if (!devWsJwtSecret) {
                        devWsJwtSecret = crypto_1.default.randomBytes(32).toString('hex');
                        logger_1.logger.warn('JWT_SECRET not set for WebSocket - generated random development key (INSECURE, not persistent)');
                    }
                    jwtSecret = devWsJwtSecret;
                }
            }
            const decoded = (0, jsonwebtoken_1.verify)(token, jwtSecret);
            socket.userId = decoded.id;
            socket.username = decoded.username;
            next();
        }
        catch (error) {
            logger_1.logger.error('Socket authentication failed:', error);
            next(new Error('Authentication failed'));
        }
    }
    handleConnection(socket) {
        const userId = socket.userId;
        const username = socket.username;
        logger_1.logger.info(`User ${username} (${userId}) connected via WebSocket`);
        if (userId) {
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }
            this.userSockets.get(userId).add(socket.id);
        }
        socket.on('tunnel:join', (tunnelId) => {
            if (tunnelId) {
                this.handleJoinTunnel(socket, tunnelId);
            }
        });
        socket.on('tunnel:leave', (tunnelId) => {
            if (tunnelId) {
                this.handleLeaveTunnel(socket, tunnelId);
            }
        });
        socket.on('tunnel:message', (data) => this.handleSendMessage(socket, data));
        socket.on('tunnel:history', (tunnelId) => this.handleMessageHistory(socket, tunnelId));
        socket.on('disconnect', () => this.handleDisconnect(socket));
    }
    handleJoinTunnel(socket, tunnelId) {
        const userId = socket.userId;
        const tunnel = this.tunnelService.getTunnelSync(tunnelId);
        if (!tunnel) {
            socket.emit('error', { message: 'Tunnel not found' });
            return;
        }
        const guildId = `user-${userId}`;
        const isConnected = tunnel.connectedChannels.some((c) => c.guildId === guildId);
        if (!isConnected) {
            socket.emit('error', { message: 'Not connected to this tunnel' });
            return;
        }
        void socket.join(`tunnel:${tunnelId}`);
        logger_1.logger.info(`User ${socket.username} joined tunnel ${tunnel.name}`);
        socket.emit('tunnel:joined', { tunnelId, tunnelName: tunnel.name });
    }
    handleLeaveTunnel(socket, tunnelId) {
        void socket.leave(`tunnel:${tunnelId}`);
        logger_1.logger.info(`User ${socket.username} left tunnel ${tunnelId}`);
        socket.emit('tunnel:left', { tunnelId });
    }
    async handleSendMessage(socket, data) {
        const userId = socket.userId || '';
        const username = socket.username || '';
        const { tunnelId, content, authorAvatar } = data;
        try {
            const tunnel = this.tunnelService.getTunnelSync(tunnelId);
            if (!tunnel) {
                socket.emit('error', { message: 'Tunnel not found' });
                return;
            }
            if (tunnel.contentFilterEnabled) {
                const filterResult = this.contentFilter.filterMessage(content, userId);
                if (!filterResult.allowed) {
                    socket.emit('message:blocked', {
                        reason: filterResult.reason,
                        severity: filterResult.severity,
                    });
                    logger_1.logger.warn(`Message from ${username} blocked by content filter: ${filterResult.reason}`);
                    return;
                }
            }
            const rateLimitResult = this.rateLimiter.checkRateLimit(tunnelId, userId);
            if (!rateLimitResult.allowed) {
                socket.emit('message:ratelimited', {
                    remaining: rateLimitResult.remaining,
                    resetAt: rateLimitResult.resetAt,
                    blockedUntil: rateLimitResult.blockedUntil,
                });
                logger_1.logger.warn(`Message from ${username} rate limited`);
                return;
            }
            this.rateLimiter.recordMessage(tunnelId, userId);
            const message = {
                id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                tunnelId,
                authorId: userId,
                authorName: username,
                authorAvatar,
                content,
                timestamp: new Date(),
                guildId: `user-${userId}`,
            };
            if (this.io) {
                this.io.to(`tunnel:${tunnelId}`).emit('tunnel:message', message);
            }
            logger_1.logger.info(`Message sent to tunnel ${tunnel.name} by ${username}`);
        }
        catch (error) {
            logger_1.logger.error('Error sending message:', error);
            socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to send message' });
        }
    }
    handleMessageHistory(socket, tunnelId) {
        socket.emit('tunnel:history', { tunnelId, messages: [] });
    }
    handleDisconnect(socket) {
        const userId = socket.userId;
        const username = socket.username;
        logger_1.logger.info(`User ${username} (${userId}) disconnected from WebSocket`);
        if (userId && this.userSockets.has(userId)) {
            this.userSockets.get(userId).delete(socket.id);
            if (this.userSockets.get(userId).size === 0) {
                this.userSockets.delete(userId);
            }
        }
    }
    broadcastTunnelCreated(tunnel) {
        if (this.io) {
            this.io.emit('tunnel:created', tunnel);
            logger_1.logger.info(`Broadcasted tunnel creation: ${tunnel.name}`);
        }
    }
    broadcastTunnelDeleted(tunnelId) {
        if (this.io) {
            this.io.emit('tunnel:deleted', { tunnelId });
            logger_1.logger.info(`Broadcasted tunnel deletion: ${tunnelId}`);
        }
    }
    broadcastTunnelUpdated(tunnel) {
        if (this.io) {
            this.io.emit('tunnel:updated', tunnel);
            logger_1.logger.info(`Broadcasted tunnel update: ${tunnel.name}`);
        }
    }
    sendToUser(userId, event, data) {
        const socketIds = this.userSockets.get(userId);
        if (socketIds && this.io) {
            socketIds.forEach(socketId => {
                this.io.to(socketId).emit(event, data);
            });
        }
    }
    getOnlineUsersInTunnel(tunnelId) {
        if (!this.io) {
            return 0;
        }
        const room = this.io.sockets.adapter.rooms.get(`tunnel:${tunnelId}`);
        return room ? room.size : 0;
    }
    getConnectedUserCount() {
        return this.userSockets.size;
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=WebSocketService.js.map