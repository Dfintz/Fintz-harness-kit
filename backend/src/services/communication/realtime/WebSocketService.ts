import crypto from 'crypto';
import { Server as HttpServer } from 'http';

import { verify } from 'jsonwebtoken';
import { Socket, Server as SocketIOServer } from 'socket.io';

import { ContentFilter } from '../../../bot/utils/contentFilter';
import { TunnelRateLimiter } from '../../../bot/utils/tunnelRateLimiter';
import { logger } from '../../../utils/logger';
import { TunnelService } from '../../discord/TunnelService';
import { SecretsManagerService } from '../../infrastructure';

const secretsManager = SecretsManagerService.getInstance();

// Development-only: dynamically generated secret (regenerated on each server start)
let devWsJwtSecret: string | null = null;

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

interface AuthenticatedSocket extends Socket {
    userId?: string;
    username?: string;
}

/**
 * WebSocket Service for Real-time Tunnel Chat
 * Provides instant message delivery without polling
 */
export class WebSocketService {
    private static instance: WebSocketService;
    private io: SocketIOServer | null = null;
    private tunnelService: TunnelService;
    private contentFilter: ContentFilter;
    private rateLimiter: TunnelRateLimiter;
    private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs

    private constructor() {
        this.tunnelService = TunnelService.getInstance();
        this.contentFilter = ContentFilter.getInstance();
        this.rateLimiter = TunnelRateLimiter.getInstance();
    }

    public static getInstance(): WebSocketService {
        if (!WebSocketService.instance) {
            WebSocketService.instance = new WebSocketService();
        }
        return WebSocketService.instance;
    }

    /**
     * Initialize WebSocket server
     */
    public initialize(httpServer: HttpServer): void {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
                credentials: true,
            },
            path: '/socket.io/',
        });

        // Authentication middleware
        this.io.use(this.authenticateSocket.bind(this));

        // Connection handler
        this.io.on('connection', this.handleConnection.bind(this));

        logger.info('WebSocket service initialized');
    }

    /**
     * Authenticate socket connection using JWT
     */
    private async authenticateSocket(socket: AuthenticatedSocket, next: (err?: Error) => void): Promise<void> {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

            if (!token) {
                return next(new Error('Authentication token required'));
            }

            // Use secrets manager for JWT secret
            let jwtSecret: string;
            try {
                jwtSecret = secretsManager.getJwtSecret();
            } catch (_error: unknown) {
                if (process.env.NODE_ENV === 'production') {
                    logger.error('JWT_SECRET not configured for WebSocket authentication');
                    return next(new Error('Server configuration error'));
                }
                const envSecret = process.env.JWT_SECRET;
                if (envSecret) {
                    jwtSecret = envSecret;
                } else {
                    // Generate a random secret for this dev session (not hardcoded)
                    if (!devWsJwtSecret) {
                        devWsJwtSecret = crypto.randomBytes(32).toString('hex');
                        logger.warn('JWT_SECRET not set for WebSocket - generated random development key (INSECURE, not persistent)');
                    }
                    jwtSecret = devWsJwtSecret;
                }
            }
            
            const decoded = verify(token, jwtSecret) as { id: string; username: string };

            socket.userId = decoded.id;
            socket.username = decoded.username;

            next();
        } catch (error: unknown) {
            logger.error('Socket authentication failed:', error);
            next(new Error('Authentication failed'));
        }
    }

    /**
     * Handle new socket connection
     */
    private handleConnection(socket: AuthenticatedSocket): void {
        const userId = socket.userId;
        const username = socket.username;

        logger.info(`User ${username} (${userId}) connected via WebSocket`);

        // Track user's sockets
        if (userId) {
            if (!this.userSockets.has(userId)) {
                this.userSockets.set(userId, new Set());
            }
            this.userSockets.get(userId)!.add(socket.id);
        }

        // Join tunnel rooms
        socket.on('tunnel:join', (tunnelId: string) => {
            if (tunnelId) {this.handleJoinTunnel(socket, tunnelId);}
        });

        // Leave tunnel rooms
        socket.on('tunnel:leave', (tunnelId: string) => {
            if (tunnelId) {this.handleLeaveTunnel(socket, tunnelId);}
        });

        // Send message to tunnel
        socket.on('tunnel:message', (data: { tunnelId: string; content: string; authorAvatar?: string }) => 
            this.handleSendMessage(socket, data)
        );

        // Request message history
        socket.on('tunnel:history', (tunnelId: string) => this.handleMessageHistory(socket, tunnelId));

        // Handle disconnect
        socket.on('disconnect', () => this.handleDisconnect(socket));
    }

    /**
     * Handle joining a tunnel
     */
    private handleJoinTunnel(socket: AuthenticatedSocket, tunnelId: string): void {
        const userId = socket.userId;
        const tunnel = this.tunnelService.getTunnelSync(tunnelId);

        if (!tunnel) {
            socket.emit('error', { message: 'Tunnel not found' });
            return;
        }

        // Check if user is connected to this tunnel
        const guildId = `user-${userId}`;
        const isConnected = tunnel.connectedChannels.some((c: { guildId?: string }) => c.guildId === guildId);

        if (!isConnected) {
            socket.emit('error', { message: 'Not connected to this tunnel' });
            return;
        }

        // Join the socket room
        void socket.join(`tunnel:${tunnelId}`);
        logger.info(`User ${socket.username} joined tunnel ${tunnel.name}`);

        socket.emit('tunnel:joined', { tunnelId, tunnelName: tunnel.name });
    }

    /**
     * Handle leaving a tunnel
     */
    private handleLeaveTunnel(socket: AuthenticatedSocket, tunnelId: string): void {
        void socket.leave(`tunnel:${tunnelId}`);
        logger.info(`User ${socket.username} left tunnel ${tunnelId}`);

        socket.emit('tunnel:left', { tunnelId });
    }

    /**
     * Handle sending a message to a tunnel
     */
    private async handleSendMessage(
        socket: AuthenticatedSocket,
        data: { tunnelId: string; content: string; authorAvatar?: string }
    ): Promise<void> {
        const userId = socket.userId || '';
        const username = socket.username || '';
        const { tunnelId, content, authorAvatar } = data;

        try {
            const tunnel = this.tunnelService.getTunnelSync(tunnelId);

            if (!tunnel) {
                socket.emit('error', { message: 'Tunnel not found' });
                return;
            }

            // Check content filter
            if (tunnel.contentFilterEnabled) {
                const filterResult = this.contentFilter.filterMessage(content, userId);
                if (!filterResult.allowed) {
                    socket.emit('message:blocked', {
                        reason: filterResult.reason,
                        severity: filterResult.severity,
                    });
                    logger.warn(`Message from ${username} blocked by content filter: ${filterResult.reason}`);
                    return;
                }
            }

            // Check rate limit
            const rateLimitResult = this.rateLimiter.checkRateLimit(tunnelId, userId);
            if (!rateLimitResult.allowed) {
                socket.emit('message:ratelimited', {
                    remaining: rateLimitResult.remaining,
                    resetAt: rateLimitResult.resetAt,
                    blockedUntil: rateLimitResult.blockedUntil,
                });
                logger.warn(`Message from ${username} rate limited`);
                return;
            }

            // Record message for rate limiting
            this.rateLimiter.recordMessage(tunnelId, userId);

            // Create message object
            const message: TunnelMessage = {
                id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                tunnelId,
                authorId: userId,
                authorName: username,
                authorAvatar,
                content,
                timestamp: new Date(),
                guildId: `user-${userId}`,
            };

            // Broadcast to all users in the tunnel room
            if (this.io) {
                this.io.to(`tunnel:${tunnelId}`).emit('tunnel:message', message);
            }

            logger.info(`Message sent to tunnel ${tunnel.name} by ${username}`);
        } catch (error: unknown) {
            logger.error('Error sending message:', error);
            socket.emit('error', { message: error instanceof Error ? error.message : 'Failed to send message' });
        }
    }

    /**
     * Handle message history request (placeholder - would fetch from database)
     */
    private handleMessageHistory(socket: AuthenticatedSocket, tunnelId: string): void {
        // In a real implementation, fetch messages from database
        // For now, send empty array
        socket.emit('tunnel:history', { tunnelId, messages: [] });
    }

    /**
     * Handle socket disconnect
     */
    private handleDisconnect(socket: AuthenticatedSocket): void {
        const userId = socket.userId;
        const username = socket.username;

        logger.info(`User ${username} (${userId}) disconnected from WebSocket`);

        // Remove socket from user's socket set
        if (userId && this.userSockets.has(userId)) {
            this.userSockets.get(userId)!.delete(socket.id);
            if (this.userSockets.get(userId)!.size === 0) {
                this.userSockets.delete(userId);
            }
        }
    }

    /**
     * Broadcast tunnel creation to all connected users
     */
    public broadcastTunnelCreated(tunnel: Record<string, unknown>): void {
        if (this.io) {
            this.io.emit('tunnel:created', tunnel);
            logger.info(`Broadcasted tunnel creation: ${tunnel.name}`);
        }
    }

    /**
     * Broadcast tunnel deletion to all connected users
     */
    public broadcastTunnelDeleted(tunnelId: string): void {
        if (this.io) {
            this.io.emit('tunnel:deleted', { tunnelId });
            logger.info(`Broadcasted tunnel deletion: ${tunnelId}`);
        }
    }

    /**
     * Broadcast tunnel update to all connected users
     */
    public broadcastTunnelUpdated(tunnel: Record<string, unknown>): void {
        if (this.io) {
            this.io.emit('tunnel:updated', tunnel);
            logger.info(`Broadcasted tunnel update: ${tunnel.name}`);
        }
    }

    /**
     * Send message to specific user (all their connected sockets)
     */
    public sendToUser(userId: string, event: string, data: unknown): void {
        const socketIds = this.userSockets.get(userId);
        if (socketIds && this.io) {
            socketIds.forEach(socketId => {
                this.io!.to(socketId).emit(event, data);
            });
        }
    }

    /**
     * Get online user count for a tunnel
     */
    public getOnlineUsersInTunnel(tunnelId: string): number {
        if (!this.io) {return 0;}
        const room = this.io.sockets.adapter.rooms.get(`tunnel:${tunnelId}`);
        return room ? room.size : 0;
    }

    /**
     * Get total connected users
     */
    public getConnectedUserCount(): number {
        return this.userSockets.size;
    }
}


