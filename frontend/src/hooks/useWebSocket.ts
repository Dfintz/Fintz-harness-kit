import { WS_URL } from '@/config/env';
import type { Tunnel } from '@/services/discordService';
import { logger } from '@/utils/logger';
import { shouldSendToken } from '@/utils/tokenValidation';
import { useCallback, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

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

interface UseWebSocketOptions {
  url?: string;
  token?: string;
  autoConnect?: boolean;
}

interface WebSocketHook {
  socket: Socket | null;
  connected: boolean;
  joinTunnel: (tunnelId: string) => void;
  leaveTunnel: (tunnelId: string) => void;
  sendMessage: (tunnelId: string, content: string, authorAvatar?: string) => void;
  requestHistory: (tunnelId: string) => void;
  onMessage: (callback: (message: TunnelMessage) => void) => void;
  onTunnelCreated: (callback: (tunnel: Tunnel) => void) => void;
  onTunnelDeleted: (callback: (tunnelId: string) => void) => void;
  onTunnelUpdated: (callback: (tunnel: Tunnel) => void) => void;
  onMessageBlocked: (callback: (data: { reason: string; severity: string }) => void) => void;
  onRateLimited: (callback: (data: Record<string, unknown>) => void) => void;
  onError: (callback: (error: { message: string }) => void) => void;
  disconnect: () => void;
}

/**
 * React hook for WebSocket connection to tunnel chat
 * Provides real-time messaging capabilities
 */
export const useWebSocket = (options: UseWebSocketOptions = {}): WebSocketHook => {
  const {
    url = WS_URL || 'http://localhost:3000',
    token = undefined,
    autoConnect = true,
  } = options;

  const socketRef = useRef<Socket | null>(null);
  const connectedRef = useRef(false);
  const callbacksRef = useRef<{
    onMessage: ((message: TunnelMessage) => void) | null;
    onTunnelCreated: ((tunnel: Tunnel) => void) | null;
    onTunnelDeleted: ((tunnelId: string) => void) | null;
    onTunnelUpdated: ((tunnel: Tunnel) => void) | null;
    onMessageBlocked: ((data: { reason: string; severity: string }) => void) | null;
    onRateLimited: ((data: Record<string, unknown>) => void) | null;
    onError: ((error: { message: string }) => void) | null;
  }>({
    onMessage: null,
    onTunnelCreated: null,
    onTunnelDeleted: null,
    onTunnelUpdated: null,
    onMessageBlocked: null,
    onRateLimited: null,
    onError: null,
  });

  useEffect(() => {
    if (!autoConnect || !token) return;

    // Don't send placeholder or invalid tokens to WebSocket
    // For cookie-based auth, the httpOnly cookie will be sent automatically via withCredentials
    const sendToken = shouldSendToken(token);

    // Initialize socket connection
    const socket = io(url, {
      path: '/api/socket.io', // Match server-side path to receive cookies with /api path
      auth: sendToken ? { token } : {},
      transports: ['websocket', 'polling'],
      withCredentials: true, // Enable sending cookies for cookie-based authentication
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      connectedRef.current = true;
      logger.debug('WebSocket connected');
    });

    socket.on('disconnect', () => {
      connectedRef.current = false;
      logger.debug('WebSocket disconnected');
    });

    socket.on('connect_error', error => {
      logger.error('WebSocket connection error:', error);
      if (callbacksRef.current.onError) {
        callbacksRef.current.onError({ message: error.message });
      }
    });

    // Tunnel events
    socket.on('tunnel:message', (message: TunnelMessage) => {
      if (callbacksRef.current.onMessage) {
        callbacksRef.current.onMessage(message);
      }
    });

    socket.on('tunnel:created', (tunnel: Tunnel) => {
      if (callbacksRef.current.onTunnelCreated) {
        callbacksRef.current.onTunnelCreated(tunnel);
      }
    });

    socket.on('tunnel:deleted', (data: { tunnelId: string }) => {
      if (callbacksRef.current.onTunnelDeleted) {
        callbacksRef.current.onTunnelDeleted(data.tunnelId);
      }
    });

    socket.on('tunnel:updated', (tunnel: Tunnel) => {
      if (callbacksRef.current.onTunnelUpdated) {
        callbacksRef.current.onTunnelUpdated(tunnel);
      }
    });

    socket.on('message:blocked', (data: { reason: string; severity: string }) => {
      if (callbacksRef.current.onMessageBlocked) {
        callbacksRef.current.onMessageBlocked(data);
      }
    });

    socket.on('message:ratelimited', (data: Record<string, unknown>) => {
      if (callbacksRef.current.onRateLimited) {
        callbacksRef.current.onRateLimited(data);
      }
    });

    socket.on('error', (error: { message: string }) => {
      if (callbacksRef.current.onError) {
        callbacksRef.current.onError(error);
      }
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [url, token, autoConnect]);

  // Join tunnel
  const joinTunnel = useCallback((tunnelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('tunnel:join', tunnelId);
    }
  }, []);

  // Leave tunnel
  const leaveTunnel = useCallback((tunnelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('tunnel:leave', tunnelId);
    }
  }, []);

  // Send message
  const sendMessage = useCallback((tunnelId: string, content: string, authorAvatar?: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('tunnel:message', { tunnelId, content, authorAvatar });
    }
  }, []);

  // Request message history
  const requestHistory = useCallback((tunnelId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('tunnel:history', tunnelId);
    }
  }, []);

  // Register callbacks
  const onMessage = useCallback((callback: (message: TunnelMessage) => void) => {
    callbacksRef.current.onMessage = callback;
  }, []);

  const onTunnelCreated = useCallback((callback: (tunnel: Tunnel) => void) => {
    callbacksRef.current.onTunnelCreated = callback;
  }, []);

  const onTunnelDeleted = useCallback((callback: (tunnelId: string) => void) => {
    callbacksRef.current.onTunnelDeleted = callback;
  }, []);

  const onTunnelUpdated = useCallback((callback: (tunnel: Tunnel) => void) => {
    callbacksRef.current.onTunnelUpdated = callback;
  }, []);

  const onMessageBlocked = useCallback(
    (callback: (data: { reason: string; severity: string }) => void) => {
      callbacksRef.current.onMessageBlocked = callback;
    },
    []
  );

  const onRateLimited = useCallback((callback: (data: Record<string, unknown>) => void) => {
    callbacksRef.current.onRateLimited = callback;
  }, []);

  const onError = useCallback((callback: (error: { message: string }) => void) => {
    callbacksRef.current.onError = callback;
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect();
  }, []);

  return {
    socket: socketRef.current,
    connected: connectedRef.current,
    joinTunnel,
    leaveTunnel,
    sendMessage,
    requestHistory,
    onMessage,
    onTunnelCreated,
    onTunnelDeleted,
    onTunnelUpdated,
    onMessageBlocked,
    onRateLimited,
    onError,
    disconnect,
  };
};
