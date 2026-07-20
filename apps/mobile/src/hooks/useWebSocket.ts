/**
 * WebSocket React hooks for real-time features.
 *
 * useWebSocketConnection — initialize the singleton connection.
 * useRealtimeRoom — subscribe to a room and listen for events.
 */

import { webSocketClient, type ConnectionStatus } from '@/services/webSocketClient';
import { useAuthStore } from '@/store/authStore';
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';

/**
 * Initialize the WebSocket singleton and track connection status.
 * Call once near the top of the app (e.g. in a layout or provider).
 */
export function useWebSocketConnection() {
  const token = useAuthStore(state => state.token);
  const [status, setStatus] = useState<ConnectionStatus>(webSocketClient.getStatus());

  useEffect(() => {
    if (!token) return;

    const url = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

    webSocketClient.connect({ url, token });

    const unsubscribe = webSocketClient.onStatusChange(setStatus);

    return () => {
      unsubscribe();
      webSocketClient.disconnect();
    };
  }, [token]);

  return {
    status,
    isConnected: status.connected,
    isReconnecting: status.reconnecting,
    error: status.error,
  };
}

/**
 * Subscribe to a WebSocket room and listen for specific events.
 * Cleans up on unmount.
 *
 * @example
 * useRealtimeRoom({
 *   room: `org:${orgId}`,
 *   events: {
 *     'fleet:created': (data) => queryClient.invalidateQueries({ queryKey: fleetKeys.lists() }),
 *     'fleet:updated': (data) => queryClient.invalidateQueries({ queryKey: fleetKeys.lists() }),
 *   },
 *   enabled: !!orgId,
 * });
 */
export function useRealtimeRoom(options: {
  room: string;
  events: Record<string, (data: unknown) => void>;
  enabled?: boolean;
}) {
  const { room, events, enabled = true } = options;
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!enabled || !webSocketClient.isConnected()) return;

    webSocketClient.subscribeToRoom(room);

    const cleanups: (() => void)[] = [];
    for (const [event, handler] of Object.entries(eventsRef.current)) {
      const unsub = webSocketClient.on(event, handler);
      cleanups.push(unsub);
    }

    return () => {
      cleanups.forEach(fn => fn());
      webSocketClient.unsubscribeFromRoom(room);
    };
  }, [room, enabled]);
}
