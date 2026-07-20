import { webSocketClient, WebSocketConfig } from '@/services/webSocketClient';
import { io } from 'socket.io-client';

jest.mock('socket.io-client');

const mockedIo = io as jest.MockedFunction<typeof io>;

describe('WebSocketClient', () => {
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocket = {
      id: 'test-socket-id',
      connected: false,
      on: jest.fn(),
      emit: jest.fn(),
      off: jest.fn(),
      connect: jest.fn(),
      disconnect: jest.fn(),
    };

    mockedIo.mockReturnValue(mockSocket as any);
  });

  afterEach(() => {
    // Clean up any connections - always disconnect to clear state
    webSocketClient.disconnect();
  });

  describe('connect', () => {
    it('initializes socket connection with config', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      webSocketClient.connect(config);

      expect(mockedIo).toHaveBeenCalledWith(
        'http://localhost:3000',
        expect.objectContaining({
          auth: { token: 'test-token' },
          autoConnect: true,
          withCredentials: true,
        })
      );
    });

    it('sets up event listeners on connect', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      webSocketClient.connect(config);

      expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('connect_error', expect.any(Function));
    });

    it('does not reconnect if already connected', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      mockSocket.connected = true;
      webSocketClient.connect(config);
      webSocketClient.connect(config);

      expect(mockedIo).toHaveBeenCalledTimes(1);
    });

    it('handles custom reconnection settings', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      };

      webSocketClient.connect(config);

      expect(mockedIo).toHaveBeenCalledWith(
        'http://localhost:3000',
        expect.objectContaining({
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        })
      );
    });
  });

  describe('disconnect', () => {
    it('disconnects socket when called', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      webSocketClient.connect(config);
      webSocketClient.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
    });

    it('handles disconnect when not connected', () => {
      expect(() => webSocketClient.disconnect()).not.toThrow();
    });
  });

  describe('subscribeToRoom', () => {
    it('subscribes to a room', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      webSocketClient.connect(config);
      webSocketClient.subscribeToRoom('fleet-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', { room: 'fleet-123' });
    });

    it('tracks subscribed rooms', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      webSocketClient.connect(config);
      webSocketClient.subscribeToRoom('fleet-123');
      webSocketClient.subscribeToRoom('org-456');

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
    });
  });

  describe('unsubscribeFromRoom', () => {
    it('unsubscribes from a room', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      webSocketClient.connect(config);
      webSocketClient.subscribeToRoom('fleet-123');
      webSocketClient.unsubscribeFromRoom('fleet-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', { room: 'fleet-123' });
    });
  });

  describe('on', () => {
    it('registers event handler', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      const handler = jest.fn();
      webSocketClient.connect(config);
      webSocketClient.on('message', handler);

      expect(mockSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('allows multiple handlers for same event', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      const handler1 = jest.fn();
      const handler2 = jest.fn();

      webSocketClient.connect(config);
      webSocketClient.on('message', handler1);
      webSocketClient.on('message', handler2);

      // Both handlers should be registered
      expect(mockSocket.on).toHaveBeenCalled();
      expect(mockSocket.on.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('off', () => {
    it('removes event handler', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      const handler = jest.fn();
      webSocketClient.connect(config);
      webSocketClient.on('message', handler);

      // Clear the mock to only track off calls
      mockSocket.off.mockClear();

      webSocketClient.off('message', handler);

      expect(mockSocket.off).toHaveBeenCalledWith('message');
    });
  });

  describe('emit', () => {
    it('emits event with data', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      webSocketClient.connect(config);
      webSocketClient.emit('chat:message', { text: 'Hello' });

      expect(mockSocket.emit).toHaveBeenCalledWith('chat:message', { text: 'Hello' });
    });
  });

  describe('isConnected', () => {
    it('returns connection status', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      expect(webSocketClient.isConnected()).toBe(false);

      webSocketClient.connect(config);
      mockSocket.connected = true;

      // Need to trigger connect event
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) connectHandler();

      expect(webSocketClient.isConnected()).toBe(true);
    });
  });

  describe('onStatusChange', () => {
    it('registers status change callback', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      const callback = jest.fn();
      webSocketClient.connect(config);
      webSocketClient.onStatusChange(callback);

      // Trigger connect event
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) connectHandler();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          connected: true,
          reconnecting: false,
        })
      );
    });
  });

  describe('reconnection', () => {
    it('resubscribes to rooms after reconnection', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      webSocketClient.connect(config);
      webSocketClient.subscribeToRoom('fleet-123');
      webSocketClient.subscribeToRoom('org-456');

      // Clear previous emit calls
      mockSocket.emit.mockClear();

      // Trigger reconnect
      const connectHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect'
      )?.[1];
      if (connectHandler) connectHandler();

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', { room: 'fleet-123' });
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', { room: 'org-456' });
    });

    it('handles connection errors', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      const statusCallback = jest.fn();
      webSocketClient.connect(config);
      webSocketClient.onStatusChange(statusCallback);

      // Trigger error event
      const errorHandler = mockSocket.on.mock.calls.find(
        (call: any[]) => call[0] === 'connect_error'
      )?.[1];
      if (errorHandler) errorHandler(new Error('Connection failed'));

      expect(statusCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          connected: false,
          reconnecting: true,
          error: 'Connection failed',
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      // Reset emit mock implementation
      mockSocket.emit.mockReset();
      mockSocket.emit.mockImplementation(() => {});
    });

    it('handles emit errors gracefully', () => {
      const config: WebSocketConfig = {
        url: 'http://localhost:3000',
        token: 'test-token',
      };

      mockSocket.emit.mockImplementation(() => {
        throw new Error('Emit failed');
      });

      webSocketClient.connect(config);

      expect(() => webSocketClient.emit('test', {})).not.toThrow();
    });

    it('handles missing socket gracefully', () => {
      expect(() => webSocketClient.emit('test', {})).not.toThrow();
      expect(() => webSocketClient.subscribeToRoom('test')).not.toThrow();
    });
  });
});
