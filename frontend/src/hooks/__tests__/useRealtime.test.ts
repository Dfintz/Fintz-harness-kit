import {
    useRealtimeActivities,
    useRealtimeFleets,
    useRealtimeNotifications,
    useRealtimeTrading,
    useWebSocketConnection,
} from '@/hooks/useRealtime';
import { ConnectionStatus, webSocketClient } from '@/services/webSocketClient';
import {
    ActivityEvent,
    FleetEvent,
    Notification,
    NotificationEvent,
    TradingEvent,
} from '@/types/apiV2';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';

jest.mock('../../config/env', () => ({
  getBackendUrl: jest.fn(() => 'http://localhost:3000'),
}));

// Mock webSocketClient
jest.mock('../../services/webSocketClient', () => ({
  webSocketClient: {
    connect: jest.fn(),
    getStatus: jest.fn(),
    onStatusChange: jest.fn(),
    isConnected: jest.fn(),
    subscribeToRoom: jest.fn(),
    unsubscribeFromRoom: jest.fn(),
    on: jest.fn(),
  },
}));

// Mock notification queries used by useRealtimeNotifications
jest.mock('../../hooks/queries/useNotificationQueries', () => ({
  useNotifications: jest.fn(() => ({ data: [], isLoading: false })),
  useMarkNotificationsAsRead: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
  useMarkAllNotificationsAsRead: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
  useDeleteNotification: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
  })),
}));

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useWebSocketConnection', () => {
  const mockStatus: ConnectionStatus = {
    connected: false,
    reconnecting: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (webSocketClient.getStatus as jest.Mock).mockReturnValue(mockStatus);
    (webSocketClient.onStatusChange as jest.Mock).mockReturnValue(jest.fn());
  });

  it('should initialize with disconnected status', () => {
    const { result } = renderHook(() => useWebSocketConnection());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('should connect with token', () => {
    const token = 'test-token';
    renderHook(() => useWebSocketConnection(token));

    expect(webSocketClient.connect).toHaveBeenCalledWith({
      url: 'http://localhost:3000',
      token,
      autoConnect: true,
    });
  });

  it('should not connect without token', () => {
    renderHook(() => useWebSocketConnection());

    expect(webSocketClient.connect).not.toHaveBeenCalled();
  });

  it('should subscribe to status changes', () => {
    renderHook(() => useWebSocketConnection('test-token'));

    expect(webSocketClient.onStatusChange).toHaveBeenCalled();
  });

  it('should unsubscribe on unmount', () => {
    const unsubscribe = jest.fn();
    (webSocketClient.onStatusChange as jest.Mock).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useWebSocketConnection('test-token'));

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should update status when connected', () => {
    const connectedStatus: ConnectionStatus = {
      connected: true,
      reconnecting: false,
    };

    let statusCallback: (status: ConnectionStatus) => void = () => {};
    (webSocketClient.onStatusChange as jest.Mock).mockImplementation(callback => {
      statusCallback = callback;
      return jest.fn();
    });

    const { result } = renderHook(() => useWebSocketConnection('test-token'));

    act(() => {
      statusCallback(connectedStatus);
    });

    expect(result.current.isConnected).toBe(true);
  });
});

describe('useRealtimeFleets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (webSocketClient.isConnected as jest.Mock).mockReturnValue(true);
    (webSocketClient.on as jest.Mock).mockReturnValue(jest.fn());
  });

  it('should subscribe to organization room', () => {
    renderHook(() =>
      useRealtimeFleets({
        organizationId: 'org-123',
      })
    );

    expect(webSocketClient.subscribeToRoom).toHaveBeenCalledWith('org:org-123');
  });

  it('should register fleet event handlers', () => {
    renderHook(() =>
      useRealtimeFleets({
        organizationId: 'org-123',
      })
    );

    expect(webSocketClient.on).toHaveBeenCalledWith('fleet:created', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('fleet:updated', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('fleet:deleted', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('fleet:ship_added', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('fleet:ship_removed', expect.any(Function));
  });

  it('should handle fleet created event', () => {
    const onFleetCreated = jest.fn();
    const mockEvent: FleetEvent = {
      type: 'fleet:created',
      fleetId: 'fleet-1',
      organizationId: 'org-123',
      data: {},
      timestamp: Date.now(),
    };

    let eventHandler: (event: FleetEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'fleet:created') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() =>
      useRealtimeFleets({
        organizationId: 'org-123',
        onFleetCreated,
      })
    );

    act(() => {
      eventHandler(mockEvent);
    });

    expect(onFleetCreated).toHaveBeenCalledWith(mockEvent);
    expect(result.current.events).toContainEqual(mockEvent);
  });

  it('should keep only last 50 events', () => {
    let eventHandler: (event: FleetEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'fleet:created') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() =>
      useRealtimeFleets({
        organizationId: 'org-123',
      })
    );

    act(() => {
      for (let i = 0; i < 60; i++) {
        eventHandler({
          type: 'fleet:created',
          fleetId: `fleet-${i}`,
          organizationId: 'org-123',
          data: {},
          timestamp: Date.now(),
        });
      }
    });

    expect(result.current.events).toHaveLength(50);
  });

  it('should unsubscribe on unmount', () => {
    const unsubscribe = jest.fn();
    (webSocketClient.on as jest.Mock).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() =>
      useRealtimeFleets({
        organizationId: 'org-123',
      })
    );

    unmount();

    expect(webSocketClient.unsubscribeFromRoom).toHaveBeenCalledWith('org:org-123');
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should not subscribe when not connected', () => {
    (webSocketClient.isConnected as jest.Mock).mockReturnValue(false);

    renderHook(() =>
      useRealtimeFleets({
        organizationId: 'org-123',
      })
    );

    expect(webSocketClient.subscribeToRoom).not.toHaveBeenCalled();
  });
});

describe('useRealtimeActivities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (webSocketClient.isConnected as jest.Mock).mockReturnValue(true);
    (webSocketClient.on as jest.Mock).mockReturnValue(jest.fn());
  });

  it('should register activity event handlers', () => {
    renderHook(() =>
      useRealtimeActivities({
        organizationId: 'org-123',
      })
    );

    expect(webSocketClient.on).toHaveBeenCalledWith('activity:created', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('activity:updated', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('activity:deleted', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith(
      'activity:participant_joined',
      expect.any(Function)
    );
    expect(webSocketClient.on).toHaveBeenCalledWith(
      'activity:participant_left',
      expect.any(Function)
    );
    expect(webSocketClient.on).toHaveBeenCalledWith(
      'activity:status_changed',
      expect.any(Function)
    );
    expect(webSocketClient.on).toHaveBeenCalledWith('activity:reminder', expect.any(Function));
  });

  it('should handle activity created event', () => {
    const onActivityCreated = jest.fn();
    const mockEvent: ActivityEvent = {
      type: 'activity:created',
      activityId: 'activity-1',
      organizationId: 'org-123',
      data: {},
      timestamp: Date.now(),
    };

    let eventHandler: (event: ActivityEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'activity:created') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    renderHook(() =>
      useRealtimeActivities({
        organizationId: 'org-123',
        onActivityCreated,
      })
    );

    act(() => {
      eventHandler(mockEvent);
    });

    expect(onActivityCreated).toHaveBeenCalledWith(mockEvent);
  });
});

describe('useRealtimeTrading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (webSocketClient.isConnected as jest.Mock).mockReturnValue(true);
    (webSocketClient.on as jest.Mock).mockReturnValue(jest.fn());
  });

  it('should register trading event handlers', () => {
    renderHook(() =>
      useRealtimeTrading({
        organizationId: 'org-123',
      })
    );

    expect(webSocketClient.on).toHaveBeenCalledWith('trading:route_created', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('trading:route_updated', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('trading:route_deleted', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith(
      'trading:route_status_changed',
      expect.any(Function)
    );
    expect(webSocketClient.on).toHaveBeenCalledWith(
      'trading:opportunity_discovered',
      expect.any(Function)
    );
    expect(webSocketClient.on).toHaveBeenCalledWith('trading:market_updated', expect.any(Function));
    expect(webSocketClient.on).toHaveBeenCalledWith('trading:price_changed', expect.any(Function));
  });

  it('should handle opportunity discovered event', () => {
    const onOpportunityDiscovered = jest.fn();
    const mockEvent: TradingEvent = {
      type: 'trading:opportunity_discovered',
      routeId: 'route-1',
      organizationId: 'org-123',
      data: {},
      timestamp: Date.now(),
    };

    let eventHandler: (event: TradingEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'trading:opportunity_discovered') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    renderHook(() =>
      useRealtimeTrading({
        organizationId: 'org-123',
        onOpportunityDiscovered,
      })
    );

    act(() => {
      eventHandler(mockEvent);
    });

    expect(onOpportunityDiscovered).toHaveBeenCalledWith(mockEvent);
  });

  it('should work without organizationId', () => {
    renderHook(() => useRealtimeTrading({}));

    expect(webSocketClient.subscribeToRoom).not.toHaveBeenCalled();
    expect(webSocketClient.on).toHaveBeenCalledWith('trading:route_created', expect.any(Function));
  });
});

describe('useRealtimeNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (webSocketClient.isConnected as jest.Mock).mockReturnValue(true);
    (webSocketClient.on as jest.Mock).mockReturnValue(jest.fn());
  });

  it('should register notification event handler', () => {
    renderHook(() => useRealtimeNotifications(), { wrapper: createQueryWrapper() });

    expect(webSocketClient.on).toHaveBeenCalledWith('notification:new', expect.any(Function));
  });

  it('should handle new notification', () => {
    const onNotification = jest.fn();
    const mockNotification: Notification = {
      id: 'notif-1',
      type: 'info',
      title: 'Test',
      message: 'Test notification',
      read: false,
      timestamp: Date.now(),
    };

    const mockEvent: NotificationEvent = {
      type: 'notification:new',
      notification: mockNotification,
    };

    let eventHandler: (event: NotificationEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() =>
      useRealtimeNotifications({
        onNotification,
      }),
      { wrapper: createQueryWrapper() }
    );

    act(() => {
      eventHandler(mockEvent);
    });

    expect(onNotification).toHaveBeenCalledWith(mockNotification);
    expect(result.current.notifications).toContainEqual(mockNotification);
    expect(result.current.unreadCount).toBe(1);
  });

  it('should not increment unread count for read notifications', () => {
    const mockNotification: Notification = {
      id: 'notif-1',
      type: 'info',
      title: 'Test',
      message: 'Test',
      read: true,
      timestamp: Date.now(),
    };

    let eventHandler: (event: NotificationEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useRealtimeNotifications(), { wrapper: createQueryWrapper() });

    act(() => {
      eventHandler({
        type: 'notification:new',
        notification: mockNotification,
      });
    });

    expect(result.current.unreadCount).toBe(0);
  });

  it('should mark notification as read', () => {
    const mockNotification: Notification = {
      id: 'notif-1',
      type: 'info',
      title: 'Test',
      message: 'Test',
      read: false,
      timestamp: Date.now(),
    };

    let eventHandler: (event: NotificationEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useRealtimeNotifications(), { wrapper: createQueryWrapper() });

    act(() => {
      eventHandler({
        type: 'notification:new',
        notification: mockNotification,
      });
    });

    act(() => {
      result.current.markAsRead('notif-1');
    });

    expect(result.current.notifications[0].read).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should mark all notifications as read', () => {
    let eventHandler: (event: NotificationEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useRealtimeNotifications(), { wrapper: createQueryWrapper() });

    act(() => {
      eventHandler({
        type: 'notification:new',
        notification: {
          id: 'notif-1',
          type: 'info',
          title: 'Test 1',
          message: 'Test',
          read: false,
          timestamp: Date.now(),
        },
      });
      eventHandler({
        type: 'notification:new',
        notification: {
          id: 'notif-2',
          type: 'info',
          title: 'Test 2',
          message: 'Test',
          read: false,
          timestamp: Date.now(),
        },
      });
    });

    act(() => {
      result.current.markAllAsRead();
    });

    expect(result.current.notifications.every(n => n.read)).toBe(true);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should clear specific notification', () => {
    let eventHandler: (event: NotificationEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useRealtimeNotifications(), { wrapper: createQueryWrapper() });

    act(() => {
      eventHandler({
        type: 'notification:new',
        notification: {
          id: 'notif-1',
          type: 'info',
          title: 'Test',
          message: 'Test',
          read: false,
          timestamp: Date.now(),
        },
      });
    });

    act(() => {
      result.current.clearNotification('notif-1');
    });

    expect(result.current.notifications).toHaveLength(0);
  });

  it('should clear all notifications', () => {
    let eventHandler: (event: NotificationEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() => useRealtimeNotifications(), { wrapper: createQueryWrapper() });

    act(() => {
      eventHandler({
        type: 'notification:new',
        notification: {
          id: 'notif-1',
          type: 'info',
          title: 'Test',
          message: 'Test',
          read: false,
          timestamp: Date.now(),
        },
      });
    });

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.notifications).toHaveLength(0);
    expect(result.current.unreadCount).toBe(0);
  });

  it('should respect maxNotifications limit', () => {
    let eventHandler: (event: NotificationEvent) => void = () => {};
    (webSocketClient.on as jest.Mock).mockImplementation((event, handler) => {
      if (event === 'notification:new') {
        eventHandler = handler;
      }
      return jest.fn();
    });

    const { result } = renderHook(() =>
      useRealtimeNotifications({
        maxNotifications: 5,
      }),
      { wrapper: createQueryWrapper() }
    );

    act(() => {
      for (let i = 0; i < 10; i++) {
        eventHandler({
          type: 'notification:new',
          notification: {
            id: `notif-${i}`,
            type: 'info',
            title: `Test ${i}`,
            message: 'Test',
            read: false,
            timestamp: Date.now(),
          },
        });
      }
    });

    expect(result.current.notifications).toHaveLength(5);
  });
});
