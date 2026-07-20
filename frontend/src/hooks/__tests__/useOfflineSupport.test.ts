import { renderHook, act, waitFor } from '@testing-library/react';
import { useOnlineStatus, useOfflineQueue } from '@/hooks/useOfflineSupport';

describe('useOnlineStatus', () => {
  it('initializes with navigator.onLine status', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(navigator.onLine);
  });

  it('updates status when going offline', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.lastOffline).toBeInstanceOf(Date);
  });

  it('updates status when coming back online', () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.isOnline).toBe(false);

    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(true);
    expect(result.current.lastOnline).toBeInstanceOf(Date);
  });

  it('tracks last offline timestamp', () => {
    const { result } = renderHook(() => useOnlineStatus());

    const beforeOffline = new Date();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(result.current.lastOffline).toBeInstanceOf(Date);
    expect(result.current.lastOffline!.getTime()).toBeGreaterThanOrEqual(beforeOffline.getTime());
  });

  it('cleans up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useOnlineStatus());
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function));
  });
});

describe('useOfflineQueue', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes with empty queue', () => {
    const { result } = renderHook(() => useOfflineQueue());
    expect(result.current.queue).toEqual([]);
  });

  it('loads queue from localStorage', () => {
    const savedQueue = [
      {
        id: '1',
        type: 'api_call',
        payload: { data: 'test' },
        timestamp: new Date().toISOString(),
        retryCount: 0,
        maxRetries: 3,
      },
    ];

    localStorage.setItem('sc-fleet-manager-offline-queue', JSON.stringify(savedQueue));

    const { result } = renderHook(() => useOfflineQueue());
    expect(result.current.queue).toHaveLength(1);
  });

  it('persists queue to localStorage', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.queueAction('api_call', { data: 'test' });
    });

    const stored = localStorage.getItem('sc-fleet-manager-offline-queue');
    expect(stored).toBeTruthy();
    
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].type).toBe('api_call');
  });

  it('adds action to queue', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.queueAction('create_fleet', { name: 'Test Fleet' });
    });

    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].type).toBe('create_fleet');
    expect(result.current.queue[0].payload).toEqual({ name: 'Test Fleet' });
  });

  it('removes action from queue', () => {
    const { result } = renderHook(() => useOfflineQueue());

    let actionId: string;

    act(() => {
      actionId = result.current.queueAction('test_action', {});
    });

    expect(result.current.queue).toHaveLength(1);

    act(() => {
      result.current.removeAction(actionId);
    });

    expect(result.current.queue).toHaveLength(0);
  });

  it('clears entire queue', () => {
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.queueAction('action1', {});
      result.current.queueAction('action2', {});
      result.current.queueAction('action3', {});
    });

    expect(result.current.queue).toHaveLength(3);

    act(() => {
      result.current.clearQueue();
    });

    expect(result.current.queue).toHaveLength(0);
  });

  it('processes queue when action is processed', async () => {
    const mockProcessor = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useOfflineQueue());

    let actionId: string;
    act(() => {
      actionId = result.current.queueAction('test_action', { data: 'test' });
    });

    expect(result.current.queue).toHaveLength(1);

    await act(async () => {
      await result.current.processAction(result.current.queue[0], mockProcessor);
    });

    await waitFor(() => {
      expect(mockProcessor).toHaveBeenCalled();
      expect(result.current.queue).toHaveLength(0);
    });
  });

  it('handles processor errors gracefully', async () => {
    const mockProcessor = jest.fn().mockResolvedValue(false);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.queueAction('test_action', {});
    });

    await act(async () => {
      await result.current.processAction(result.current.queue[0], mockProcessor);
    });

    // Queue should still have the item since processor returned false
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].retryCount).toBe(1);
    
    consoleSpy.mockRestore();
  });

  it('increments retry count on failure', async () => {
    const mockProcessor = jest.fn().mockResolvedValue(false);
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const { result } = renderHook(() => useOfflineQueue());

    act(() => {
      result.current.queueAction('test_action', {}, 3);
    });

    const initialRetryCount = result.current.queue[0].retryCount;

    await act(async () => {
      await result.current.processAction(result.current.queue[0], mockProcessor);
    });

    // After failure, retry count should increment
    expect(result.current.queue).toHaveLength(1);
    expect(result.current.queue[0].retryCount).toBe(initialRetryCount + 1);
    
    consoleSpy.mockRestore();
  });
});
