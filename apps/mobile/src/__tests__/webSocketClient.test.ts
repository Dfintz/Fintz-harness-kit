import { webSocketClient } from '../services/webSocketClient';

// Mock socket.io-client
const mockSocket = {
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: false,
  id: 'mock-socket-id',
  removeAllListeners: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

jest.mock('../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

describe('WebSocketClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton state by disconnecting
    webSocketClient.disconnect();
  });

  describe('connect', () => {
    it('should create a socket connection with token auth', () => {
      const { io } = require('socket.io-client');

      webSocketClient.connect({
        url: 'http://localhost:3000',
        token: 'test-token',
      });

      expect(io).toHaveBeenCalledWith(
        'http://localhost:3000',
        expect.objectContaining({
          path: '/api/socket.io',
          auth: { token: 'test-token' },
          transports: ['websocket'],
        })
      );
    });

    it('should not include withCredentials (mobile has no cookies)', () => {
      const { io } = require('socket.io-client');

      webSocketClient.connect({
        url: 'http://localhost:3000',
        token: 'test-token',
      });

      const callArgs = io.mock.calls[0][1];
      expect(callArgs.withCredentials).toBeUndefined();
    });

    it('should pass empty auth when no token', () => {
      const { io } = require('socket.io-client');

      webSocketClient.connect({
        url: 'http://localhost:3000',
        token: '',
      });

      expect(io).toHaveBeenCalledWith(
        'http://localhost:3000',
        expect.objectContaining({
          auth: {},
        })
      );
    });
  });

  describe('subscribeToRoom', () => {
    it('should emit subscribe event', () => {
      webSocketClient.connect({ url: 'http://test', token: 'tok' });

      webSocketClient.subscribeToRoom('org:123');

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', { room: 'org:123' });
    });

    it('should track subscribed rooms', () => {
      webSocketClient.connect({ url: 'http://test', token: 'tok' });

      webSocketClient.subscribeToRoom('org:123');
      webSocketClient.subscribeToRoom('fleet:456');

      expect(webSocketClient.getSubscribedRooms()).toContain('org:123');
      expect(webSocketClient.getSubscribedRooms()).toContain('fleet:456');
    });
  });

  describe('unsubscribeFromRoom', () => {
    it('should emit unsubscribe event and remove from tracking', () => {
      webSocketClient.connect({ url: 'http://test', token: 'tok' });
      webSocketClient.subscribeToRoom('org:123');

      webSocketClient.unsubscribeFromRoom('org:123');

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', { room: 'org:123' });
      expect(webSocketClient.getSubscribedRooms()).not.toContain('org:123');
    });
  });

  describe('on/off', () => {
    it('should register event handler and return cleanup function', () => {
      webSocketClient.connect({ url: 'http://test', token: 'tok' });
      const handler = jest.fn();

      const unsubscribe = webSocketClient.on('fleet:updated', handler);

      expect(mockSocket.on).toHaveBeenCalledWith('fleet:updated', expect.any(Function));
      expect(typeof unsubscribe).toBe('function');
    });
  });

  describe('emit', () => {
    it('should emit event with data', () => {
      webSocketClient.connect({ url: 'http://test', token: 'tok' });

      webSocketClient.emit('tunnel:message', { content: 'hello' });

      expect(mockSocket.emit).toHaveBeenCalledWith('tunnel:message', { content: 'hello' });
    });
  });

  describe('disconnect', () => {
    it('should disconnect and clear state', () => {
      webSocketClient.connect({ url: 'http://test', token: 'tok' });
      webSocketClient.subscribeToRoom('org:123');

      webSocketClient.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(webSocketClient.getSubscribedRooms()).toHaveLength(0);
      expect(webSocketClient.isConnected()).toBe(false);
    });
  });

  describe('getStatus', () => {
    it('should return initial disconnected status', () => {
      const status = webSocketClient.getStatus();
      expect(status.connected).toBe(false);
      expect(status.reconnecting).toBe(false);
    });
  });

  describe('onStatusChange', () => {
    it('should return an unsubscribe function', () => {
      const callback = jest.fn();
      const unsub = webSocketClient.onStatusChange(callback);
      expect(typeof unsub).toBe('function');
    });
  });
});
