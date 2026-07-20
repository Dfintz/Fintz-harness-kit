import { logger } from '@/utils/logger';
import { shouldSendToken } from '@/utils/tokenValidation';
import { io, Socket } from 'socket.io-client';

/**
 * WebSocket Client for Real-time Communication
 *
 * Manages Socket.IO connection with automatic reconnection,
 * room subscriptions, and event handling.
 */

export interface WebSocketConfig {
  readonly url: string;
  readonly token: string;
  readonly autoConnect?: boolean;
  readonly reconnectionAttempts?: number;
  readonly reconnectionDelay?: number;
}

export interface WebSocketEventHandler {
  event: string;
  handler: (data: unknown) => void;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  error?: string;
}

class WebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketConfig | null = null;
  private eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private subscribedRooms: Set<string> = new Set();
  private connectionStatus: ConnectionStatus = {
    connected: false,
    reconnecting: false,
  };
  private statusChangeCallbacks: Set<(status: ConnectionStatus) => void> = new Set();

  /**
   * Initialize WebSocket connection
   */
  connect(config: WebSocketConfig): void {
    if (this.socket?.connected) {
      logger.warn('[WebSocket] Already connected');
      return;
    }

    this.config = config;

    // Don't send placeholder or invalid tokens to WebSocket
    // For cookie-based auth, the httpOnly cookie will be sent automatically via withCredentials
    const sendToken = shouldSendToken(config.token);

    this.socket = io(config.url, {
      path: '/api/socket.io', // Match server-side path to receive cookies with /api path
      auth: sendToken ? { token: config.token } : {},
      autoConnect: config.autoConnect ?? true,
      reconnectionAttempts: config.reconnectionAttempts ?? 10,
      reconnectionDelay: config.reconnectionDelay ?? 1000,
      transports: ['websocket', 'polling'],
      withCredentials: true, // Enable sending cookies for cookie-based authentication
    });

    this.setupEventListeners();

    if (!config.autoConnect) {
      this.socket.connect();
    }
  }

  /**
   * Setup Socket.IO event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection established
    this.socket.on('connect', () => {
      logger.debug('[WebSocket] Connected:', this.socket?.id);
      this.updateConnectionStatus({ connected: true, reconnecting: false });

      // Resubscribe to rooms after reconnection
      this.subscribedRooms.forEach(room => {
        this.socket?.emit('subscribe', { room });
      });
    });

    // Connection error
    this.socket.on('connect_error', error => {
      logger.error('[WebSocket] Connection error:', error);
      this.updateConnectionStatus({
        connected: false,
        reconnecting: true,
        error: error.message,
      });
    });

    // Disconnected
    this.socket.on('disconnect', reason => {
      logger.debug('[WebSocket] Disconnected:', reason);
      this.updateConnectionStatus({
        connected: false,
        reconnecting: reason !== 'io server disconnect',
      });
    });

    // Reconnection attempts
    this.socket.on('reconnect_attempt', attempt => {
      logger.debug(`[WebSocket] Reconnection attempt ${attempt}`);
    });

    // Successfully reconnected
    this.socket.on('reconnect', attempt => {
      logger.info(`[WebSocket] Reconnected after ${attempt} attempts`);
    });

    // Failed to reconnect
    this.socket.on('reconnect_failed', () => {
      logger.error('[WebSocket] Failed to reconnect', new Error('Reconnection failed'));
      this.updateConnectionStatus({
        connected: false,
        reconnecting: false,
        error: 'Failed to reconnect',
      });
    });

    // Welcome message
    this.socket.on('connected', data => {
      logger.debug('[WebSocket] Welcome:', data);
    });

    // Room subscribed
    this.socket.on('subscribed', (data: { room: string }) => {
      logger.debug('[WebSocket] Subscribed to room:', data.room);
    });

    // Room unsubscribed
    this.socket.on('unsubscribed', (data: { room: string }) => {
      logger.debug('[WebSocket] Unsubscribed from room:', data.room);
    });

    // Error messages
    this.socket.on('error', (data: { message: string }) => {
      logger.error('[WebSocket] Server error:', new Error(data.message));
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscribedRooms.clear();
      this.eventHandlers.clear();
      this.updateConnectionStatus({ connected: false, reconnecting: false });
    }
  }

  /**
   * Subscribe to a room
   */
  subscribeToRoom(room: string): void {
    if (!this.socket) {
      logger.warn('[WebSocket] Cannot subscribe: not connected');
      return;
    }

    this.socket.emit('subscribe', { room });
    this.subscribedRooms.add(room);
  }

  /**
   * Unsubscribe from a room
   */
  unsubscribeFromRoom(room: string): void {
    if (!this.socket) return;

    this.socket.emit('unsubscribe', { room });
    this.subscribedRooms.delete(room);
  }

  /**
   * Add event listener
   */
  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());

      // Register with socket if connected
      if (this.socket) {
        this.socket.on(event, data => {
          const handlers = this.eventHandlers.get(event);
          handlers?.forEach(h => h(data));
        });
      }
    }

    this.eventHandlers.get(event)!.add(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Remove event listener
   */
  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);

      // If no more handlers, remove socket listener
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
        this.socket?.off(event);
      }
    }
  }

  /**
   * Remove all event listeners for an event
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.eventHandlers.delete(event);
      this.socket?.off(event);
    } else {
      this.eventHandlers.clear();
      this.socket?.removeAllListeners();
    }
  }

  /**
   * Emit event with data
   */
  emit(event: string, data: unknown): void {
    if (!this.socket) {
      logger.warn('[WebSocket] Cannot emit: not connected');
      return;
    }

    try {
      this.socket.emit(event, data);
    } catch (error) {
      logger.error('[WebSocket] Emit error:', error as Error);
    }
  }

  /**
   * Get connection status
   */
  getStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Subscribe to connection status changes
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusChangeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.statusChangeCallbacks.delete(callback);
    };
  }

  /**
   * Update connection status and notify subscribers
   */
  private updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.statusChangeCallbacks.forEach(callback => callback(status));
  }

  /**
   * Ping server to check connection
   */
  ping(): void {
    if (!this.socket) return;

    this.socket.emit('ping');
    this.socket.once('pong', (data: { timestamp: number }) => {
      const latency = Date.now() - data.timestamp;
      logger.debug(`[WebSocket] Ping: ${latency}ms`);
    });
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Get subscribed rooms
   */
  getSubscribedRooms(): string[] {
    return Array.from(this.subscribedRooms);
  }
}

// Singleton instance
export const webSocketClient = new WebSocketClient();
