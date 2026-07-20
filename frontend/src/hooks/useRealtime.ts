import { getBackendUrl } from '@/config/env';
import {
  useDeleteNotification,
  useMarkAllNotificationsAsRead,
  useMarkNotificationsAsRead,
  useNotifications,
} from '@/hooks/queries/useNotificationQueries';
import { ConnectionStatus, webSocketClient } from '@/services/webSocketClient';
import {
  ActivityEvent,
  FleetEvent,
  Notification,
  NotificationEvent,
  TradingEvent,
} from '@/types/apiV2';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activityKeys,
  bountyKeys,
  fleetKeys,
  notificationKeys,
  organizationKeys,
  socialLfgKeys,
} from './queries/queryKeys';

/**
 * Custom React Hooks for Real-time Data
 *
 * Provides hooks for subscribing to WebSocket events and managing
 * real-time updates for fleets, activities, trading, and notifications.
 */

// ============================================================================
// Connection Status Hook
// ============================================================================

export function useWebSocketConnection(token?: string) {
  const [status, setStatus] = useState<ConnectionStatus>(webSocketClient.getStatus());
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (token && !isInitialized) {
      const apiUrl = getBackendUrl();
      webSocketClient.connect({
        url: apiUrl,
        token,
        autoConnect: true,
      });
      setIsInitialized(true);
    }

    const unsubscribe = webSocketClient.onStatusChange(setStatus);

    return () => {
      unsubscribe();
    };
  }, [token, isInitialized]);

  return {
    status,
    isConnected: status.connected,
    isReconnecting: status.reconnecting,
    error: status.error,
  };
}

// ============================================================================
// Fleet Real-time Hook
// ============================================================================

export interface UseRealtimeFleetsOptions {
  organizationId: string;
  onFleetCreated?: (event: FleetEvent) => void;
  onFleetUpdated?: (event: FleetEvent) => void;
  onFleetDeleted?: (event: FleetEvent) => void;
  onShipAdded?: (event: FleetEvent) => void;
  onShipRemoved?: (event: FleetEvent) => void;
}

export function useRealtimeFleets(options: UseRealtimeFleetsOptions) {
  const {
    organizationId,
    onFleetCreated,
    onFleetUpdated,
    onFleetDeleted,
    onShipAdded,
    onShipRemoved,
  } = options;
  const [events, setEvents] = useState<FleetEvent[]>([]);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!webSocketClient.isConnected() || isSubscribedRef.current) {
      return;
    }

    // Subscribe to organization room
    const room = `org:${organizationId}`;
    webSocketClient.subscribeToRoom(room);
    isSubscribedRef.current = true;

    // Setup event handlers
    const handleFleetCreated = (event: FleetEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50)); // Keep last 50 events
      onFleetCreated?.(event);
    };

    const handleFleetUpdated = (event: FleetEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onFleetUpdated?.(event);
    };

    const handleFleetDeleted = (event: FleetEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onFleetDeleted?.(event);
    };

    const handleShipAdded = (event: FleetEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onShipAdded?.(event);
    };

    const handleShipRemoved = (event: FleetEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onShipRemoved?.(event);
    };

    // Register event listeners
    const unsubCreated = webSocketClient.on(
      'fleet:created',
      handleFleetCreated as (data: unknown) => void
    );
    const unsubUpdated = webSocketClient.on(
      'fleet:updated',
      handleFleetUpdated as (data: unknown) => void
    );
    const unsubDeleted = webSocketClient.on(
      'fleet:deleted',
      handleFleetDeleted as (data: unknown) => void
    );
    const unsubShipAdded = webSocketClient.on(
      'fleet:ship_added',
      handleShipAdded as (data: unknown) => void
    );
    const unsubShipRemoved = webSocketClient.on(
      'fleet:ship_removed',
      handleShipRemoved as (data: unknown) => void
    );

    return () => {
      webSocketClient.unsubscribeFromRoom(room);
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubShipAdded();
      unsubShipRemoved();
      isSubscribedRef.current = false;
    };
  }, [organizationId, onFleetCreated, onFleetUpdated, onFleetDeleted, onShipAdded, onShipRemoved]);

  return { events };
}

// ============================================================================
// Activity Real-time Hook
// ============================================================================

export interface UseRealtimeActivitiesOptions {
  organizationId: string;
  onActivityCreated?: (event: ActivityEvent) => void;
  onActivityUpdated?: (event: ActivityEvent) => void;
  onActivityDeleted?: (event: ActivityEvent) => void;
  onParticipantJoined?: (event: ActivityEvent) => void;
  onParticipantLeft?: (event: ActivityEvent) => void;
  onStatusChanged?: (event: ActivityEvent) => void;
  onReminder?: (event: ActivityEvent) => void;
}

export function useRealtimeActivities(options: UseRealtimeActivitiesOptions) {
  const {
    organizationId,
    onActivityCreated,
    onActivityUpdated,
    onActivityDeleted,
    onParticipantJoined,
    onParticipantLeft,
    onStatusChanged,
    onReminder,
  } = options;
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!webSocketClient.isConnected() || isSubscribedRef.current) {
      return;
    }

    // Subscribe to organization room
    const room = `org:${organizationId}`;
    webSocketClient.subscribeToRoom(room);
    isSubscribedRef.current = true;

    // Setup event handlers
    const handleActivityCreated = (event: ActivityEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onActivityCreated?.(event);
    };

    const handleActivityUpdated = (event: ActivityEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onActivityUpdated?.(event);
    };

    const handleActivityDeleted = (event: ActivityEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onActivityDeleted?.(event);
    };

    const handleParticipantJoined = (event: ActivityEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onParticipantJoined?.(event);
    };

    const handleParticipantLeft = (event: ActivityEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onParticipantLeft?.(event);
    };

    const handleStatusChanged = (event: ActivityEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onStatusChanged?.(event);
    };

    const handleReminder = (event: ActivityEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onReminder?.(event);
    };

    // Register event listeners
    const unsubCreated = webSocketClient.on(
      'activity:created',
      handleActivityCreated as (data: unknown) => void
    );
    const unsubUpdated = webSocketClient.on(
      'activity:updated',
      handleActivityUpdated as (data: unknown) => void
    );
    const unsubDeleted = webSocketClient.on(
      'activity:deleted',
      handleActivityDeleted as (data: unknown) => void
    );
    const unsubJoined = webSocketClient.on(
      'activity:participant_joined',
      handleParticipantJoined as (data: unknown) => void
    );
    const unsubLeft = webSocketClient.on(
      'activity:participant_left',
      handleParticipantLeft as (data: unknown) => void
    );
    const unsubStatus = webSocketClient.on(
      'activity:status_changed',
      handleStatusChanged as (data: unknown) => void
    );
    const unsubReminder = webSocketClient.on(
      'activity:reminder',
      handleReminder as (data: unknown) => void
    );

    return () => {
      webSocketClient.unsubscribeFromRoom(room);
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubJoined();
      unsubLeft();
      unsubStatus();
      unsubReminder();
      isSubscribedRef.current = false;
    };
  }, [
    organizationId,
    onActivityCreated,
    onActivityUpdated,
    onActivityDeleted,
    onParticipantJoined,
    onParticipantLeft,
    onStatusChanged,
    onReminder,
  ]);

  return { events };
}

// ============================================================================
// Trading Real-time Hook
// ============================================================================

export interface UseRealtimeTradingOptions {
  organizationId?: string;
  onRouteCreated?: (event: TradingEvent) => void;
  onRouteUpdated?: (event: TradingEvent) => void;
  onRouteDeleted?: (event: TradingEvent) => void;
  onStatusChanged?: (event: TradingEvent) => void;
  onOpportunityDiscovered?: (event: TradingEvent) => void;
  onMarketUpdated?: (event: TradingEvent) => void;
  onPriceChanged?: (event: TradingEvent) => void;
}

export function useRealtimeTrading(options: UseRealtimeTradingOptions) {
  const {
    organizationId,
    onRouteCreated,
    onRouteUpdated,
    onRouteDeleted,
    onStatusChanged,
    onOpportunityDiscovered,
    onMarketUpdated,
    onPriceChanged,
  } = options;
  const [events, setEvents] = useState<TradingEvent[]>([]);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    if (!webSocketClient.isConnected() || isSubscribedRef.current) {
      return;
    }

    // Subscribe to organization room if specified
    if (organizationId) {
      const room = `org:${organizationId}`;
      webSocketClient.subscribeToRoom(room);
    }
    isSubscribedRef.current = true;

    // Setup event handlers
    const handleRouteCreated = (event: TradingEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onRouteCreated?.(event);
    };

    const handleRouteUpdated = (event: TradingEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onRouteUpdated?.(event);
    };

    const handleRouteDeleted = (event: TradingEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onRouteDeleted?.(event);
    };

    const handleStatusChanged = (event: TradingEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onStatusChanged?.(event);
    };

    const handleOpportunityDiscovered = (event: TradingEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onOpportunityDiscovered?.(event);
    };

    const handleMarketUpdated = (event: TradingEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onMarketUpdated?.(event);
    };

    const handlePriceChanged = (event: TradingEvent) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
      onPriceChanged?.(event);
    };

    // Register event listeners
    const unsubCreated = webSocketClient.on(
      'trading:route_created',
      handleRouteCreated as (data: unknown) => void
    );
    const unsubUpdated = webSocketClient.on(
      'trading:route_updated',
      handleRouteUpdated as (data: unknown) => void
    );
    const unsubDeleted = webSocketClient.on(
      'trading:route_deleted',
      handleRouteDeleted as (data: unknown) => void
    );
    const unsubStatus = webSocketClient.on(
      'trading:route_status_changed',
      handleStatusChanged as (data: unknown) => void
    );
    const unsubOpportunity = webSocketClient.on(
      'trading:opportunity_discovered',
      handleOpportunityDiscovered as (data: unknown) => void
    );
    const unsubMarket = webSocketClient.on(
      'trading:market_updated',
      handleMarketUpdated as (data: unknown) => void
    );
    const unsubPrice = webSocketClient.on(
      'trading:price_changed',
      handlePriceChanged as (data: unknown) => void
    );

    return () => {
      if (organizationId) {
        webSocketClient.unsubscribeFromRoom(`org:${organizationId}`);
      }
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
      unsubStatus();
      unsubOpportunity();
      unsubMarket();
      unsubPrice();
      isSubscribedRef.current = false;
    };
  }, [
    organizationId,
    onRouteCreated,
    onRouteUpdated,
    onRouteDeleted,
    onStatusChanged,
    onOpportunityDiscovered,
    onMarketUpdated,
    onPriceChanged,
  ]);

  return { events };
}

// ============================================================================
// Notifications Real-time Hook
// ============================================================================

export interface UseRealtimeNotificationsOptions {
  onNotification?: (notification: Notification) => void;
  maxNotifications?: number;
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const { onNotification, maxNotifications = 100 } = options;
  const queryClient = useQueryClient();
  const isSubscribedRef = useRef(false);

  // Fetch persisted notifications from the API (polls every 30s)
  const { data: apiNotifications = [] } = useNotifications();

  // Local state for real-time WebSocket notifications not yet in the API
  const [wsNotifications, setWsNotifications] = useState<Notification[]>([]);

  // Merge API + WebSocket notifications, deduplicate by ID, sort newest first
  const notifications = useMemo(() => {
    const merged = new Map<string, Notification>();
    for (const n of apiNotifications) {
      merged.set(n.id, n);
    }
    for (const n of wsNotifications) {
      if (!merged.has(n.id)) {
        merged.set(n.id, n);
      }
    }
    return Array.from(merged.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, maxNotifications);
  }, [apiNotifications, wsNotifications, maxNotifications]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  // Subscribe to real-time WebSocket notification events
  useEffect(() => {
    if (!webSocketClient.isConnected() || isSubscribedRef.current) {
      return;
    }

    isSubscribedRef.current = true;

    // Debounce React Query invalidation to prevent rapid re-fetches
    // when many notifications arrive in quick succession
    let invalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedInvalidate = () => {
      if (invalidateTimer) return;
      invalidateTimer = setTimeout(() => {
        invalidateTimer = null;
        queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      }, 1000);
    };

    const handleNotification = (event: NotificationEvent) => {
      const notification = event.notification;

      // Add to local WS state for immediate display
      setWsNotifications(prev => {
        const newNotifications = [notification, ...prev].slice(0, maxNotifications);
        return newNotifications;
      });

      // Debounced invalidation — batches rapid notifications into a single re-fetch
      debouncedInvalidate();

      onNotification?.(notification);
    };

    const unsubscribe = webSocketClient.on(
      'notification:new',
      handleNotification as (data: unknown) => void
    );

    return () => {
      if (invalidateTimer) clearTimeout(invalidateTimer);
      unsubscribe();
      isSubscribedRef.current = false;
    };
  }, [onNotification, maxNotifications, queryClient]);

  // Backend-backed mutations
  const markAsReadMutation = useMarkNotificationsAsRead();
  const markAllAsReadMutation = useMarkAllNotificationsAsRead();
  const deleteNotificationMutation = useDeleteNotification();

  const markAsRead = useCallback(
    (notificationId: string) => {
      // Optimistic local update
      setWsNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );
      // Persist to backend
      markAsReadMutation.mutate([notificationId]);
    },
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(() => {
    // Optimistic local update
    setWsNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // Persist to backend
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  const clearNotification = useCallback(
    (notificationId: string) => {
      setWsNotifications(prev => prev.filter(n => n.id !== notificationId));
      // Delete from backend and refresh cache
      deleteNotificationMutation.mutate(notificationId);
    },
    [deleteNotificationMutation]
  );

  const clearAll = useCallback(() => {
    setWsNotifications([]);
    queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
  }, [queryClient]);

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  };
}

// ============================================================================
// React Query Auto-Invalidation Hook (Phase 3.3)
// ============================================================================

/**
 * Subscribes to all standard organization-scoped realtime events and
 * invalidates the matching React Query caches so any consumer of those
 * queries automatically refetches.
 *
 * Mount once near the app root (after the user is authenticated and the
 * websocket is connected). Safe to mount multiple times — the underlying
 * webSocketClient.on registers/unregisters listener references.
 *
 * Events handled:
 *   - activity:created|updated|deleted|cancelled|status_changed|
 *     participant_joined|participant_left|attendance_confirmed
 *   - fleet:created|updated|deleted|ship_added|ship_removed
 *   - bounty:created|updated|cancelled
 *   - member:joined|left|role-changed
 */
export function useRealtimeQueryInvalidation(organizationId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!organizationId || !webSocketClient.isConnected()) {
      return;
    }

    const room = `org:${organizationId}`;
    webSocketClient.subscribeToRoom(room);

    const invalidateActivities = (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.lists() });
      const id = (data as { activityId?: string })?.activityId;
      if (id) {
        queryClient.invalidateQueries({ queryKey: activityKeys.detail(id) });
        queryClient.invalidateQueries({ queryKey: activityKeys.participants(id) });
      }
    };

    const invalidateFleets = (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: fleetKeys.lists() });
      const id = (data as { fleetId?: string })?.fleetId;
      if (id) {
        queryClient.invalidateQueries({ queryKey: fleetKeys.detail(id) });
      }
    };

    const invalidateBounties = (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: bountyKeys.lists() });
      const id = (data as { bountyId?: string })?.bountyId;
      if (id) {
        queryClient.invalidateQueries({ queryKey: bountyKeys.detail(id) });
      }
    };

    const invalidateMembers = () => {
      queryClient.invalidateQueries({
        queryKey: organizationKeys.members(organizationId),
      });
      queryClient.invalidateQueries({
        queryKey: organizationKeys.detail(organizationId),
      });
    };

    const invalidateLfg = (data: unknown) => {
      queryClient.invalidateQueries({ queryKey: socialLfgKeys.sessions.lists() });
      queryClient.invalidateQueries({ queryKey: socialLfgKeys.groups.lists() });
      const id = (data as { sessionId?: string })?.sessionId;
      if (id) {
        queryClient.invalidateQueries({ queryKey: socialLfgKeys.sessions.detail(id) });
      }
    };

    const activityEvents = [
      'activity:created',
      'activity:updated',
      'activity:deleted',
      'activity:cancelled',
      'activity:rescheduled',
      'activity:status_changed',
      'activity:participant_joined',
      'activity:participant_left',
      'activity:attendance_confirmed',
    ];
    const fleetEvents = [
      'fleet:created',
      'fleet:updated',
      'fleet:deleted',
      'fleet:ship_added',
      'fleet:ship_removed',
    ];
    const bountyEvents = ['bounty:created', 'bounty:updated', 'bounty:cancelled'];
    const memberEvents = ['member:joined', 'member:left', 'member:role-changed'];
    const lfgEvents = [
      'lfg:session-created',
      'lfg:session-updated',
      'lfg:session-cancelled',
      'lfg:member-joined',
      'lfg:member-left',
    ];

    const unsubscribers: Array<() => void> = [
      ...activityEvents.map(evt => webSocketClient.on(evt, invalidateActivities)),
      ...fleetEvents.map(evt => webSocketClient.on(evt, invalidateFleets)),
      ...bountyEvents.map(evt => webSocketClient.on(evt, invalidateBounties)),
      ...memberEvents.map(evt => webSocketClient.on(evt, invalidateMembers)),
      ...lfgEvents.map(evt => webSocketClient.on(evt, invalidateLfg)),
    ];

    return () => {
      webSocketClient.unsubscribeFromRoom(room);
      for (const unsub of unsubscribers) unsub();
    };
  }, [organizationId, queryClient]);
}
