/**
 * WebSocket Client for React Native
 *
 * Manages Socket.IO connection with automatic reconnection,
 * room subscriptions, and event handling.
 * Adapted from frontend — token-based auth only, WebSocket transport only.
 */

import { logger } from '@/utils/logger';
import Constants from 'expo-constants';
import { io, Socket } from 'socket.io-client';

export interface WebSocketConfig {
  readonly url: string;
  readonly token: string;
  readonly autoConnect?: boolean;
  readonly reconnectionAttempts?: number;
  readonly reconnectionDelay?: number;
}

export interface ConnectionStatus {
  connected: boolean;
  reconnecting: boolean;
  error?: string;
}

class WebSocketClient {
  private socket: Socket | null = null;
  private config: WebSocketConfig | null = null;
  private readonly eventHandlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private readonly subscribedRooms: Set<string> = new Set();
  private connectionStatus: ConnectionStatus = {
    connected: false,
    reconnecting: false,
  };
  private readonly statusChangeCallbacks: Set<(status: ConnectionStatus) => void> = new Set();

  connect(config: WebSocketConfig): void {
    if (this.socket?.connected) {
      logger.warn('[WebSocket] Already connected');
      return;
    }

    this.config = config;

    const url = config.url || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

    this.socket = io(url, {
      path: '/api/socket.io',
      auth: config.token ? { token: config.token } : {},
      autoConnect: config.autoConnect ?? true,
      reconnectionAttempts: config.reconnectionAttempts ?? 10,
      reconnectionDelay: config.reconnectionDelay ?? 1000,
      transports: ['websocket'], // WebSocket only on mobile — no polling
    });

    this.setupEventListeners();

    if (!config.autoConnect) {
      this.socket.connect();
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      logger.debug('[WebSocket] Connected:', this.socket?.id);
      this.updateConnectionStatus({ connected: true, reconnecting: false });

      // Resubscribe to rooms after reconnection
      this.subscribedRooms.forEach(room => {
        this.socket?.emit('subscribe', { room });
      });
    });

    this.socket.on('connect_error', error => {
      logger.error('[WebSocket] Connection error:', error);
      this.updateConnectionStatus({
        connected: false,
        reconnecting: true,
        error: error.message,
      });
    });

    this.socket.on('disconnect', reason => {
      logger.debug('[WebSocket] Disconnected:', reason);
      this.updateConnectionStatus({
        connected: false,
        reconnecting: reason !== 'io server disconnect',
      });
    });

    this.socket.on('reconnect_attempt', attempt => {
      logger.debug(`[WebSocket] Reconnection attempt ${attempt}`);
    });

    this.socket.on('reconnect', attempt => {
      logger.info(`[WebSocket] Reconnected after ${attempt} attempts`);
    });

    this.socket.on('reconnect_failed', () => {
      logger.error('[WebSocket] Failed to reconnect', new Error('Reconnection failed'));
      this.updateConnectionStatus({
        connected: false,
        reconnecting: false,
        error: 'Failed to reconnect',
      });
    });

    this.socket.on('subscribed', (data: { room: string }) => {
      logger.debug('[WebSocket] Subscribed to room:', data.room);
    });

    this.socket.on('error', (data: { message: string }) => {
      logger.error('[WebSocket] Server error:', new Error(data.message));
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.subscribedRooms.clear();
      this.eventHandlers.clear();
      this.updateConnectionStatus({ connected: false, reconnecting: false });
    }
  }

  subscribeToRoom(room: string): void {
    if (!this.socket) {
      logger.warn('[WebSocket] Cannot subscribe: not connected');
      return;
    }
    this.socket.emit('subscribe', { room });
    this.subscribedRooms.add(room);
  }

  unsubscribeFromRoom(room: string): void {
    if (!this.socket) return;
    this.socket.emit('unsubscribe', { room });
    this.subscribedRooms.delete(room);
  }

  on(event: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());

      if (this.socket) {
        this.socket.on(event, (data: unknown) => {
          const handlers = this.eventHandlers.get(event);
          handlers?.forEach(h => h(data));
        });
      }
    }

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.add(handler);
    }

    return () => this.off(event, handler);
  }

  off(event: string, handler: (data: unknown) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(event);
        this.socket?.off(event);
      }
    }
  }

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

  getStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.statusChangeCallbacks.add(callback);
    return () => {
      this.statusChangeCallbacks.delete(callback);
    };
  }

  private updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.statusChangeCallbacks.forEach(callback => callback(status));
  }

  getSubscribedRooms(): string[] {
    return Array.from(this.subscribedRooms);
  }
}

export const webSocketClient = new WebSocketClient();
