import { TunnelMessage, useWebSocket } from '@/hooks/useWebSocket';
import { act, renderHook } from '@testing-library/react';
import { io, Socket } from 'socket.io-client';

// Mock socket.io-client
jest.mock('socket.io-client');

describe('useWebSocket', () => {
  let mockSocket: Partial<Socket>;
  let mockOn: jest.Mock;
  let mockEmit: jest.Mock;
  let mockDisconnect: jest.Mock;
  const mockIo = io as jest.MockedFunction<typeof io>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('token', 'test-token');

    mockOn = jest.fn();
    mockEmit = jest.fn();
    mockDisconnect = jest.fn();

    mockSocket = {
      connected: true,
      on: mockOn,
      emit: mockEmit,
      disconnect: mockDisconnect,
      off: jest.fn(),
      removeAllListeners: jest.fn(),
    };

    mockIo.mockReturnValue(mockSocket as Socket);
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('initialization', () => {
    it('should initialize WebSocket connection with token', () => {
      renderHook(() => useWebSocket({ token: 'test-token' }));

      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'test-token' },
          transports: ['websocket', 'polling'],
        })
      );
    });

    it('should use custom URL from options', () => {
      renderHook(() => useWebSocket({ url: 'https://custom-server.com', token: 'test-token' }));

      expect(mockIo).toHaveBeenCalledWith('https://custom-server.com', expect.any(Object));
    });

    it('should use custom token from options', () => {
      renderHook(() => useWebSocket({ token: 'custom-token' }));

      expect(mockIo).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          auth: { token: 'custom-token' },
        })
      );
    });

    it('should not connect when autoConnect is false', () => {
      renderHook(() => useWebSocket({ autoConnect: false }));

      expect(mockIo).not.toHaveBeenCalled();
    });

    it('should not connect when token is missing', () => {
      localStorage.removeItem('token');
      renderHook(() => useWebSocket({ token: undefined }));

      expect(mockIo).not.toHaveBeenCalled();
    });
  });

  describe('connection events', () => {
    it('should register connect event handler', () => {
      renderHook(() => useWebSocket({ token: 'test-token' }));

      const connectHandler = mockOn.mock.calls.find(call => call[0] === 'connect');
      expect(connectHandler).toBeDefined();
    });

    it('should register disconnect event handler', () => {
      renderHook(() => useWebSocket({ token: 'test-token' }));

      const disconnectHandler = mockOn.mock.calls.find(call => call[0] === 'disconnect');
      expect(disconnectHandler).toBeDefined();
    });

    it('should handle connect_error event', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));

      const errorHandler = mockOn.mock.calls.find(call => call[0] === 'connect_error')?.[1];

      const mockError = new Error('Connection failed');
      act(() => {
        result.current.onError(jest.fn());
      });

      act(() => {
        errorHandler(mockError);
      });

      expect(mockOn).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });
  });

  describe('tunnel operations', () => {
    it('should join tunnel when connected', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));

      act(() => {
        result.current.joinTunnel('tunnel-123');
      });

      expect(mockEmit).toHaveBeenCalledWith('tunnel:join', 'tunnel-123');
    });

    it('should leave tunnel when connected', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));

      act(() => {
        result.current.leaveTunnel('tunnel-123');
      });

      expect(mockEmit).toHaveBeenCalledWith('tunnel:leave', 'tunnel-123');
    });

    it('should send message with tunnel ID and content', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));

      act(() => {
        result.current.sendMessage('tunnel-123', 'Hello World');
      });

      expect(mockEmit).toHaveBeenCalledWith('tunnel:message', {
        tunnelId: 'tunnel-123',
        content: 'Hello World',
        authorAvatar: undefined,
      });
    });

    it('should send message with author avatar', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));

      act(() => {
        result.current.sendMessage('tunnel-123', 'Hello', 'avatar-url');
      });

      expect(mockEmit).toHaveBeenCalledWith('tunnel:message', {
        tunnelId: 'tunnel-123',
        content: 'Hello',
        authorAvatar: 'avatar-url',
      });
    });

    it('should request tunnel history', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));

      act(() => {
        result.current.requestHistory('tunnel-123');
      });

      expect(mockEmit).toHaveBeenCalledWith('tunnel:history', 'tunnel-123');
    });

    it('should not emit when socket is disconnected', () => {
      mockSocket.connected = false;
      const { result } = renderHook(() => useWebSocket());

      act(() => {
        result.current.joinTunnel('tunnel-123');
        result.current.leaveTunnel('tunnel-123');
        result.current.sendMessage('tunnel-123', 'test');
        result.current.requestHistory('tunnel-123');
      });

      expect(mockEmit).not.toHaveBeenCalled();
    });
  });

  describe('event callbacks', () => {
    it('should handle tunnel message event', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));
      const mockMessage: TunnelMessage = {
        id: 'msg-1',
        tunnelId: 'tunnel-123',
        authorId: 'user-1',
        authorName: 'Test User',
        content: 'Hello',
        timestamp: new Date(),
        guildId: 'guild-1',
      };

      const messageCallback = jest.fn();
      act(() => {
        result.current.onMessage(messageCallback);
      });

      const messageHandler = mockOn.mock.calls.find(call => call[0] === 'tunnel:message')?.[1];
      act(() => {
        messageHandler(mockMessage);
      });

      expect(messageCallback).toHaveBeenCalledWith(mockMessage);
    });

    it('should handle tunnel created event', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));
      const mockTunnel = { id: 'tunnel-1', name: 'Test Tunnel' };

      const createdCallback = jest.fn();
      act(() => {
        result.current.onTunnelCreated(createdCallback);
      });

      const createdHandler = mockOn.mock.calls.find(call => call[0] === 'tunnel:created')?.[1];
      act(() => {
        createdHandler(mockTunnel);
      });

      expect(createdCallback).toHaveBeenCalledWith(mockTunnel);
    });

    it('should handle tunnel deleted event', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));

      const deletedCallback = jest.fn();
      act(() => {
        result.current.onTunnelDeleted(deletedCallback);
      });

      const deletedHandler = mockOn.mock.calls.find(call => call[0] === 'tunnel:deleted')?.[1];
      act(() => {
        deletedHandler({ tunnelId: 'tunnel-123' });
      });

      expect(deletedCallback).toHaveBeenCalledWith('tunnel-123');
    });

    it('should handle tunnel updated event', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));
      const mockTunnel = { id: 'tunnel-1', name: 'Updated Tunnel' };

      const updatedCallback = jest.fn();
      act(() => {
        result.current.onTunnelUpdated(updatedCallback);
      });

      const updatedHandler = mockOn.mock.calls.find(call => call[0] === 'tunnel:updated')?.[1];
      act(() => {
        updatedHandler(mockTunnel);
      });

      expect(updatedCallback).toHaveBeenCalledWith(mockTunnel);
    });

    it('should handle message blocked event', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));
      const blockData = { reason: 'spam', severity: 'warning' };

      const blockedCallback = jest.fn();
      act(() => {
        result.current.onMessageBlocked(blockedCallback);
      });

      const blockedHandler = mockOn.mock.calls.find(call => call[0] === 'message:blocked')?.[1];
      act(() => {
        blockedHandler(blockData);
      });

      expect(blockedCallback).toHaveBeenCalledWith(blockData);
    });

    it('should handle rate limited event', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));
      const rateLimitData = { retryAfter: 60000 };

      const rateLimitCallback = jest.fn();
      act(() => {
        result.current.onRateLimited(rateLimitCallback);
      });

      const rateLimitHandler = mockOn.mock.calls.find(
        call => call[0] === 'message:ratelimited'
      )?.[1];
      act(() => {
        rateLimitHandler(rateLimitData);
      });

      expect(rateLimitCallback).toHaveBeenCalledWith(rateLimitData);
    });

    it('should handle error event', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));
      const errorData = { message: 'Connection error' };

      const errorCallback = jest.fn();
      act(() => {
        result.current.onError(errorCallback);
      });

      const errorHandler = mockOn.mock.calls.find(call => call[0] === 'error')?.[1];
      act(() => {
        errorHandler(errorData);
      });

      expect(errorCallback).toHaveBeenCalledWith(errorData);
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket', () => {
      const { result } = renderHook(() => useWebSocket({ token: 'test-token' }));

      act(() => {
        result.current.disconnect();
      });

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it('should disconnect on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket({ token: 'test-token' }));

      unmount();

      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  describe('hook return values', () => {
    it('should return socket instance', () => {
      renderHook(() => useWebSocket({ token: 'test-token' }));

      // Socket is created via io() call in useEffect
      // Verify that io was called with the correct parameters
      expect(mockIo).toHaveBeenCalledWith(
        'http://localhost:3000',
        expect.objectContaining({
          auth: { token: 'test-token' },
          transports: ['websocket', 'polling'],
        })
      );

      // Verify io returned our mock socket
      expect(mockIo).toHaveReturnedWith(mockSocket);
    });

    it('should return connected status', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.connected).toBe(false); // connectedRef starts false
    });

    it('should return all required methods', () => {
      const { result } = renderHook(() => useWebSocket());

      expect(result.current.joinTunnel).toBeDefined();
      expect(result.current.leaveTunnel).toBeDefined();
      expect(result.current.sendMessage).toBeDefined();
      expect(result.current.requestHistory).toBeDefined();
      expect(result.current.onMessage).toBeDefined();
      expect(result.current.onTunnelCreated).toBeDefined();
      expect(result.current.onTunnelDeleted).toBeDefined();
      expect(result.current.onTunnelUpdated).toBeDefined();
      expect(result.current.onMessageBlocked).toBeDefined();
      expect(result.current.onRateLimited).toBeDefined();
      expect(result.current.onError).toBeDefined();
      expect(result.current.disconnect).toBeDefined();
    });
  });
});
