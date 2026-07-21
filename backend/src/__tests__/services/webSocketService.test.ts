import { Server as HttpServer } from 'http';

import { verify } from 'jsonwebtoken';
import { Server as SocketIOServer, Socket } from 'socket.io';

import { ContentFilter } from '../../bot/utils/contentFilter';
import { TunnelRateLimiter } from '../../bot/utils/tunnelRateLimiter';
import { WebSocketService } from '../../services/communication';
import { TunnelService } from '../../services/discord/TunnelService';

// Mock dependencies
jest.mock('socket.io');
jest.mock('jsonwebtoken');
jest.mock('../../services/discord/TunnelService');
jest.mock('../../bot/utils/contentFilter');
jest.mock('../../bot/utils/tunnelRateLimiter');

describe('WebSocketService', () => {
  let service: WebSocketService;
  let mockHttpServer: HttpServer;
  let mockIo: jest.Mocked<SocketIOServer>;
  let mockSocket: any;
  let mockTunnelService: jest.Mocked<TunnelService>;
  let mockContentFilter: jest.Mocked<ContentFilter>;
  let mockRateLimiter: jest.Mocked<TunnelRateLimiter>;

  afterAll(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    // Clean up singleton
    (WebSocketService as any).instance = undefined;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance
    (WebSocketService as any).instance = undefined;

    // Mock dependencies
    mockTunnelService = {
      getTunnel: jest.fn(),
      getTunnelSync: jest.fn(),
    } as any;

    mockContentFilter = {
      filterMessage: jest.fn(),
    } as any;

    mockRateLimiter = {
      checkRateLimit: jest.fn(),
      recordMessage: jest.fn(),
    } as any;

    (TunnelService.getInstance as jest.Mock).mockReturnValue(mockTunnelService);
    (ContentFilter.getInstance as jest.Mock).mockReturnValue(mockContentFilter);
    (TunnelRateLimiter.getInstance as jest.Mock).mockReturnValue(mockRateLimiter);

    // Mock Socket.IO server
    mockIo = {
      use: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn(() => ({
        emit: jest.fn(),
      })),
      sockets: {
        adapter: {
          rooms: new Map(),
        },
      },
    } as any;

    (SocketIOServer as unknown as jest.Mock).mockImplementation(() => mockIo);

    // Mock HTTP server
    mockHttpServer = {} as HttpServer;

    // Mock socket
    mockSocket = {
      id: 'socket-123',
      userId: 'user-123',
      username: 'testuser',
      handshake: {
        auth: { token: 'valid-token' },
        headers: {},
      },
      on: jest.fn(),
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn(),
    };

    service = WebSocketService.getInstance();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = WebSocketService.getInstance();
      const instance2 = WebSocketService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should initialize dependencies in constructor', () => {
      expect(TunnelService.getInstance).toHaveBeenCalled();
      expect(ContentFilter.getInstance).toHaveBeenCalled();
      expect(TunnelRateLimiter.getInstance).toHaveBeenCalled();
    });
  });

  describe('initialize', () => {
    it('should create Socket.IO server with correct configuration', () => {
      service.initialize(mockHttpServer);

      expect(SocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
        cors: {
          origin: 'http://localhost:3001',
          credentials: true,
        },
        path: '/socket.io/',
      });
    });

    it('should use custom CORS origin from environment', () => {
      process.env.CORS_ORIGIN = 'https://example.com';

      service.initialize(mockHttpServer);

      expect(SocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
        cors: {
          origin: 'https://example.com',
          credentials: true,
        },
        path: '/socket.io/',
      });

      delete process.env.CORS_ORIGIN;
    });

    it('should register authentication middleware', () => {
      service.initialize(mockHttpServer);

      expect(mockIo.use).toHaveBeenCalled();
    });

    it('should register connection handler', () => {
      service.initialize(mockHttpServer);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('authenticateSocket', () => {
    let authenticateSocket: any;
    let mockNext: jest.Mock;

    beforeEach(() => {
      service.initialize(mockHttpServer);
      authenticateSocket = (mockIo.use as jest.Mock).mock.calls[0][0];
      mockNext = jest.fn();
    });

    it('should authenticate with valid token in auth', async () => {
      (verify as jest.Mock).mockReturnValue({ id: 'user-123', username: 'testuser' });

      await authenticateSocket(mockSocket, mockNext);

      expect(verify).toHaveBeenCalledWith('valid-token', expect.any(String));
      expect(mockSocket.userId).toBe('user-123');
      expect(mockSocket.username).toBe('testuser');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should authenticate with token in authorization header', async () => {
      mockSocket.handshake.auth = {};
      mockSocket.handshake.headers.authorization = 'Bearer header-token';
      (verify as jest.Mock).mockReturnValue({ id: 'user-456', username: 'headeruser' });

      await authenticateSocket(mockSocket, mockNext);

      expect(verify).toHaveBeenCalledWith('header-token', expect.any(String));
      expect(mockSocket.userId).toBe('user-456');
      expect(mockSocket.username).toBe('headeruser');
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should use custom JWT secret from environment', async () => {
      process.env.JWT_SECRET = 'custom-secret';
      (verify as jest.Mock).mockReturnValue({ id: 'user-123', username: 'testuser' });

      await authenticateSocket(mockSocket, mockNext);

      expect(verify).toHaveBeenCalledWith('valid-token', 'custom-secret');
      expect(mockNext).toHaveBeenCalledWith();

      delete process.env.JWT_SECRET;
    });

    it('should reject connection without token', async () => {
      mockSocket.handshake.auth = {};
      mockSocket.handshake.headers = {};

      await authenticateSocket(mockSocket, mockNext);

      expect(verify).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication token required',
        })
      );
    });

    it('should reject connection with invalid token', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticateSocket(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication failed',
        })
      );
    });

    it('should reject connection with expired token', async () => {
      (verify as jest.Mock).mockImplementation(() => {
        throw new Error('TokenExpiredError');
      });

      await authenticateSocket(mockSocket, mockNext);

      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Authentication failed',
        })
      );
    });
  });

  describe('handleConnection', () => {
    let connectionHandler: any;

    beforeEach(() => {
      service.initialize(mockHttpServer);
      connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
    });

    it('should track user socket on connection', () => {
      connectionHandler(mockSocket);

      expect(mockSocket.on).toHaveBeenCalledWith('tunnel:join', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('tunnel:leave', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('tunnel:message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('tunnel:history', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should add socket to user socket map', () => {
      connectionHandler(mockSocket);

      const connectedUsers = service.getConnectedUserCount();
      expect(connectedUsers).toBe(1);
    });

    it('should track multiple sockets for same user', () => {
      const socket2 = { ...mockSocket, id: 'socket-456' };

      connectionHandler(mockSocket);
      connectionHandler(socket2);

      const connectedUsers = service.getConnectedUserCount();
      expect(connectedUsers).toBe(1); // Same user, multiple sockets
    });

    it('should track different users separately', () => {
      const socket2 = { ...mockSocket, id: 'socket-456', userId: 'user-456' };

      connectionHandler(mockSocket);
      connectionHandler(socket2);

      const connectedUsers = service.getConnectedUserCount();
      expect(connectedUsers).toBe(2);
    });
  });

  describe('handleJoinTunnel', () => {
    let joinHandler: any;

    beforeEach(() => {
      service.initialize(mockHttpServer);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(mockSocket);
      joinHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:join'
      )[1];
    });

    it('should allow user to join accessible tunnel', () => {
      const mockTunnel = {
        id: 'tunnel-123',
        name: 'Test Tunnel',
        connectedChannels: [{ guildId: 'user-user-123' }],
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);

      joinHandler('tunnel-123');

      expect(mockSocket.join).toHaveBeenCalledWith('tunnel:tunnel-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('tunnel:joined', {
        tunnelId: 'tunnel-123',
        tunnelName: 'Test Tunnel',
      });
    });

    it('should emit error if tunnel not found', () => {
      mockTunnelService.getTunnelSync.mockReturnValue(undefined);

      joinHandler('invalid-tunnel');

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Tunnel not found',
      });
    });

    it('should emit error if user not connected to tunnel', () => {
      const mockTunnel = {
        id: 'tunnel-123',
        name: 'Private Tunnel',
        connectedChannels: [{ guildId: 'other-guild' }],
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);

      joinHandler('tunnel-123');

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Not connected to this tunnel',
      });
    });

    it('should check user guild ID correctly', () => {
      const mockTunnel = {
        id: 'tunnel-123',
        name: 'Test Tunnel',
        connectedChannels: [
          { guildId: 'guild-1' },
          { guildId: 'user-user-123' },
          { guildId: 'guild-2' },
        ],
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);

      joinHandler('tunnel-123');

      expect(mockSocket.join).toHaveBeenCalledWith('tunnel:tunnel-123');
    });
  });

  describe('handleLeaveTunnel', () => {
    let leaveHandler: any;

    beforeEach(() => {
      service.initialize(mockHttpServer);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(mockSocket);
      leaveHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:leave'
      )[1];
    });

    it('should remove user from tunnel room', () => {
      leaveHandler('tunnel-123');

      expect(mockSocket.leave).toHaveBeenCalledWith('tunnel:tunnel-123');
      expect(mockSocket.emit).toHaveBeenCalledWith('tunnel:left', {
        tunnelId: 'tunnel-123',
      });
    });

    it('should handle leaving multiple tunnels', () => {
      leaveHandler('tunnel-123');
      leaveHandler('tunnel-456');

      expect(mockSocket.leave).toHaveBeenCalledWith('tunnel:tunnel-123');
      expect(mockSocket.leave).toHaveBeenCalledWith('tunnel:tunnel-456');
    });
  });

  describe('handleSendMessage', () => {
    let messageHandler: any;
    let mockToEmit: jest.Mock;

    beforeEach(() => {
      service.initialize(mockHttpServer);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(mockSocket);
      messageHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:message'
      )[1];

      mockToEmit = jest.fn();
      (mockIo.to as jest.Mock).mockReturnValue({ emit: mockToEmit });
    });

    it('should send message to tunnel room', async () => {
      const mockTunnel = {
        id: 'tunnel-123',
        name: 'Test Tunnel',
        contentFilterEnabled: false,
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);

      await messageHandler({
        tunnelId: 'tunnel-123',
        content: 'Hello, world!',
        authorAvatar: 'https://avatar.url',
      });

      expect(mockIo.to).toHaveBeenCalledWith('tunnel:tunnel-123');
      expect(mockToEmit).toHaveBeenCalledWith(
        'tunnel:message',
        expect.objectContaining({
          tunnelId: 'tunnel-123',
          authorId: 'user-123',
          authorName: 'testuser',
          authorAvatar: 'https://avatar.url',
          content: 'Hello, world!',
          guildId: 'user-user-123',
        })
      );
    });

    it('should generate unique message ID', async () => {
      const mockTunnel = { id: 'tunnel-123', contentFilterEnabled: false };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Test 1' });
      await messageHandler({ tunnelId: 'tunnel-123', content: 'Test 2' });

      const call1 = mockToEmit.mock.calls[0][1];
      const call2 = mockToEmit.mock.calls[1][1];

      expect(call1.id).toBeDefined();
      expect(call2.id).toBeDefined();
      expect(call1.id).not.toBe(call2.id);
    });

    it('should include timestamp in message', async () => {
      const mockTunnel = { id: 'tunnel-123', contentFilterEnabled: false };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Test' });

      expect(mockToEmit).toHaveBeenCalledWith(
        'tunnel:message',
        expect.objectContaining({
          timestamp: expect.any(Date),
        })
      );
    });

    it('should emit error if tunnel not found', async () => {
      mockTunnelService.getTunnelSync.mockReturnValue(undefined);

      await messageHandler({ tunnelId: 'invalid-tunnel', content: 'Test' });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Tunnel not found',
      });
      expect(mockToEmit).not.toHaveBeenCalled();
    });

    it('should check content filter when enabled', async () => {
      const mockTunnel = {
        id: 'tunnel-123',
        name: 'Filtered Tunnel',
        contentFilterEnabled: true,
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockContentFilter.filterMessage.mockReturnValue({
        allowed: true,
        reason: null,
        severity: null,
      } as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Clean message' });

      expect(mockContentFilter.filterMessage).toHaveBeenCalledWith('Clean message', 'user-123');
      expect(mockToEmit).toHaveBeenCalled();
    });

    it('should block message if content filter rejects', async () => {
      const mockTunnel = {
        id: 'tunnel-123',
        contentFilterEnabled: true,
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockContentFilter.filterMessage.mockReturnValue({
        allowed: false,
        reason: 'Profanity detected',
        severity: 'high',
      } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Bad word' });

      expect(mockSocket.emit).toHaveBeenCalledWith('message:blocked', {
        reason: 'Profanity detected',
        severity: 'high',
      });
      expect(mockToEmit).not.toHaveBeenCalled();
    });

    it('should skip content filter when disabled', async () => {
      const mockTunnel = {
        id: 'tunnel-123',
        contentFilterEnabled: false,
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Any content' });

      expect(mockContentFilter.filterMessage).not.toHaveBeenCalled();
      expect(mockToEmit).toHaveBeenCalled();
    });

    it('should check rate limit before sending', async () => {
      const mockTunnel = { id: 'tunnel-123', contentFilterEnabled: false };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Test' });

      expect(mockRateLimiter.checkRateLimit).toHaveBeenCalledWith('tunnel-123', 'user-123');
      expect(mockRateLimiter.recordMessage).toHaveBeenCalledWith('tunnel-123', 'user-123');
    });

    it('should block message if rate limited', async () => {
      const mockTunnel = { id: 'tunnel-123', contentFilterEnabled: false };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({
        allowed: false,
        remaining: 0,
        resetAt: new Date('2024-01-01T12:00:00Z'),
        blockedUntil: new Date('2024-01-01T12:05:00Z'),
      } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Spam' });

      expect(mockSocket.emit).toHaveBeenCalledWith('message:ratelimited', {
        remaining: 0,
        resetAt: new Date('2024-01-01T12:00:00Z'),
        blockedUntil: new Date('2024-01-01T12:05:00Z'),
      });
      expect(mockToEmit).not.toHaveBeenCalled();
    });

    it('should record message for rate limiting', async () => {
      const mockTunnel = { id: 'tunnel-123', contentFilterEnabled: false };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Test' });

      expect(mockRateLimiter.recordMessage).toHaveBeenCalledWith('tunnel-123', 'user-123');
    });

    it('should handle message without avatar', async () => {
      const mockTunnel = { id: 'tunnel-123', contentFilterEnabled: false };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);

      await messageHandler({ tunnelId: 'tunnel-123', content: 'No avatar' });

      expect(mockToEmit).toHaveBeenCalledWith(
        'tunnel:message',
        expect.objectContaining({
          authorAvatar: undefined,
        })
      );
    });

    it('should handle errors gracefully', async () => {
      mockTunnelService.getTunnelSync.mockImplementation(() => {
        throw new Error('Database error');
      });

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Test' });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Database error',
      });
    });

    it('should handle errors without message', async () => {
      mockTunnelService.getTunnelSync.mockImplementation(() => {
        throw 'Unknown error'; // Non-Error value to test fallback
      });

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Test' });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Failed to send message',
      });
    });
  });

  describe('handleMessageHistory', () => {
    let historyHandler: any;

    beforeEach(() => {
      service.initialize(mockHttpServer);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(mockSocket);
      historyHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:history'
      )[1];
    });

    it('should return empty message history', () => {
      historyHandler('tunnel-123');

      expect(mockSocket.emit).toHaveBeenCalledWith('tunnel:history', {
        tunnelId: 'tunnel-123',
        messages: [],
      });
    });

    it('should handle multiple history requests', () => {
      historyHandler('tunnel-123');
      historyHandler('tunnel-456');

      expect(mockSocket.emit).toHaveBeenCalledTimes(2);
      expect(mockSocket.emit).toHaveBeenNthCalledWith(1, 'tunnel:history', {
        tunnelId: 'tunnel-123',
        messages: [],
      });
      expect(mockSocket.emit).toHaveBeenNthCalledWith(2, 'tunnel:history', {
        tunnelId: 'tunnel-456',
        messages: [],
      });
    });
  });

  describe('handleDisconnect', () => {
    let disconnectHandler: any;

    beforeEach(() => {
      service.initialize(mockHttpServer);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(mockSocket);
      disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      )[1];
    });

    it('should remove socket from user tracking', () => {
      expect(service.getConnectedUserCount()).toBe(1);

      disconnectHandler();

      expect(service.getConnectedUserCount()).toBe(0);
    });

    it('should keep user if they have other sockets', () => {
      const socket2 = { ...mockSocket, id: 'socket-456' };
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(socket2);

      expect(service.getConnectedUserCount()).toBe(1);

      disconnectHandler();

      expect(service.getConnectedUserCount()).toBe(1);
    });

    it('should handle disconnect of non-existent socket', () => {
      disconnectHandler();
      disconnectHandler();

      expect(service.getConnectedUserCount()).toBe(0);
    });
  });

  describe('broadcastTunnelCreated', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    it('should broadcast tunnel creation to all users', () => {
      const mockTunnel = { id: 'tunnel-123', name: 'New Tunnel' };

      service.broadcastTunnelCreated(mockTunnel);

      expect(mockIo.emit).toHaveBeenCalledWith('tunnel:created', mockTunnel);
    });

    it('should not throw if io not initialized', () => {
      const uninitializedService = WebSocketService.getInstance();
      (uninitializedService as any).io = null;

      expect(() => {
        uninitializedService.broadcastTunnelCreated({ id: 'test' });
      }).not.toThrow();
    });
  });

  describe('broadcastTunnelDeleted', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    it('should broadcast tunnel deletion to all users', () => {
      service.broadcastTunnelDeleted('tunnel-123');

      expect(mockIo.emit).toHaveBeenCalledWith('tunnel:deleted', {
        tunnelId: 'tunnel-123',
      });
    });

    it('should not throw if io not initialized', () => {
      const uninitializedService = WebSocketService.getInstance();
      (uninitializedService as any).io = null;

      expect(() => {
        uninitializedService.broadcastTunnelDeleted('tunnel-123');
      }).not.toThrow();
    });
  });

  describe('broadcastTunnelUpdated', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    it('should broadcast tunnel update to all users', () => {
      const mockTunnel = { id: 'tunnel-123', name: 'Updated Tunnel' };

      service.broadcastTunnelUpdated(mockTunnel);

      expect(mockIo.emit).toHaveBeenCalledWith('tunnel:updated', mockTunnel);
    });

    it('should not throw if io not initialized', () => {
      const uninitializedService = WebSocketService.getInstance();
      (uninitializedService as any).io = null;

      expect(() => {
        uninitializedService.broadcastTunnelUpdated({ id: 'test' });
      }).not.toThrow();
    });
  });

  describe('sendToUser', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(mockSocket);
    });

    it('should send event to all user sockets', () => {
      const mockToEmit = jest.fn();
      (mockIo.to as jest.Mock).mockReturnValue({ emit: mockToEmit });

      service.sendToUser('user-123', 'custom:event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('socket-123');
      expect(mockToEmit).toHaveBeenCalledWith('custom:event', { data: 'test' });
    });

    it('should send to multiple sockets of same user', () => {
      const socket2 = { ...mockSocket, id: 'socket-456' };
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(socket2);

      const mockToEmit = jest.fn();
      (mockIo.to as jest.Mock).mockReturnValue({ emit: mockToEmit });

      service.sendToUser('user-123', 'custom:event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('socket-123');
      expect(mockIo.to).toHaveBeenCalledWith('socket-456');
      expect(mockToEmit).toHaveBeenCalledTimes(2);
    });

    it('should not throw if user not connected', () => {
      expect(() => {
        service.sendToUser('user-999', 'custom:event', { data: 'test' });
      }).not.toThrow();
    });

    it('should not throw if io not initialized', () => {
      (service as any).io = null;

      expect(() => {
        service.sendToUser('user-123', 'custom:event', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('getOnlineUsersInTunnel', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    it('should return user count in tunnel room', () => {
      const mockRoom = new Set(['socket-1', 'socket-2', 'socket-3']);
      mockIo.sockets.adapter.rooms.set('tunnel:tunnel-123', mockRoom);

      const count = service.getOnlineUsersInTunnel('tunnel-123');

      expect(count).toBe(3);
    });

    it('should return 0 if tunnel room not found', () => {
      const count = service.getOnlineUsersInTunnel('tunnel-999');

      expect(count).toBe(0);
    });

    it('should return 0 if io not initialized', () => {
      (service as any).io = null;

      const count = service.getOnlineUsersInTunnel('tunnel-123');

      expect(count).toBe(0);
    });

    it('should handle empty tunnel room', () => {
      mockIo.sockets.adapter.rooms.set('tunnel:tunnel-123', new Set());

      const count = service.getOnlineUsersInTunnel('tunnel-123');

      expect(count).toBe(0);
    });
  });

  describe('getConnectedUserCount', () => {
    beforeEach(() => {
      service.initialize(mockHttpServer);
    });

    it('should return 0 when no users connected', () => {
      const count = service.getConnectedUserCount();

      expect(count).toBe(0);
    });

    it('should return correct count with one user', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(mockSocket);

      const count = service.getConnectedUserCount();

      expect(count).toBe(1);
    });

    it('should return correct count with multiple users', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      const socket2 = { ...mockSocket, id: 'socket-456', userId: 'user-456' };
      const socket3 = { ...mockSocket, id: 'socket-789', userId: 'user-789' };

      connectionHandler(mockSocket);
      connectionHandler(socket2);
      connectionHandler(socket3);

      const count = service.getConnectedUserCount();

      expect(count).toBe(3);
    });

    it('should count users not sockets', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      const socket2 = { ...mockSocket, id: 'socket-456' }; // Same userId

      connectionHandler(mockSocket);
      connectionHandler(socket2);

      const count = service.getConnectedUserCount();

      expect(count).toBe(1); // Same user with 2 sockets
    });

    it('should update count after disconnect', () => {
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];
      connectionHandler(mockSocket);

      expect(service.getConnectedUserCount()).toBe(1);

      const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      )[1];
      disconnectHandler();

      expect(service.getConnectedUserCount()).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    it('should handle full user journey', async () => {
      service.initialize(mockHttpServer);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];

      // User connects
      connectionHandler(mockSocket);
      expect(service.getConnectedUserCount()).toBe(1);

      // User joins tunnel
      const joinHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:join'
      )[1];
      const mockTunnel = {
        id: 'tunnel-123',
        name: 'Test',
        connectedChannels: [{ guildId: 'user-user-123' }],
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);
      joinHandler('tunnel-123');

      expect(mockSocket.join).toHaveBeenCalledWith('tunnel:tunnel-123');

      // User sends message
      const messageHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:message'
      )[1];
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);
      await messageHandler({ tunnelId: 'tunnel-123', content: 'Hello!' });

      const mockToEmit = jest.fn();
      (mockIo.to as jest.Mock).mockReturnValue({ emit: mockToEmit });
      await messageHandler({ tunnelId: 'tunnel-123', content: 'Hello!' });
      expect(mockToEmit).toHaveBeenCalled();

      // User leaves tunnel
      const leaveHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:leave'
      )[1];
      leaveHandler('tunnel-123');
      expect(mockSocket.leave).toHaveBeenCalledWith('tunnel:tunnel-123');

      // User disconnects
      const disconnectHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'disconnect'
      )[1];
      disconnectHandler();
      expect(service.getConnectedUserCount()).toBe(0);
    });

    it('should handle multiple users in same tunnel', async () => {
      service.initialize(mockHttpServer);
      const connectionHandler = (mockIo.on as jest.Mock).mock.calls[0][1];

      // Two users connect
      const socket2 = { ...mockSocket, id: 'socket-456', userId: 'user-456', username: 'user2' };
      connectionHandler(mockSocket);
      connectionHandler(socket2);
      expect(service.getConnectedUserCount()).toBe(2);

      // Both join same tunnel
      const mockTunnel = {
        id: 'tunnel-123',
        name: 'Shared',
        connectedChannels: [{ guildId: 'user-user-123' }, { guildId: 'user-user-456' }],
      };
      mockTunnelService.getTunnelSync.mockReturnValue(mockTunnel as any);

      const joinHandler1 = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:join'
      )[1];
      const joinHandler2 = (socket2.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:join'
      )[1];

      joinHandler1('tunnel-123');
      joinHandler2('tunnel-123');

      expect(mockSocket.join).toHaveBeenCalledWith('tunnel:tunnel-123');
      expect(socket2.join).toHaveBeenCalledWith('tunnel:tunnel-123');

      // Messages broadcast to all
      mockRateLimiter.checkRateLimit.mockReturnValue({ allowed: true } as any);
      const messageHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: any) => call[0] === 'tunnel:message'
      )[1];

      const mockToEmit = jest.fn();
      (mockIo.to as jest.Mock).mockReturnValue({ emit: mockToEmit });

      await messageHandler({ tunnelId: 'tunnel-123', content: 'Broadcasting!' });

      expect(mockIo.to).toHaveBeenCalledWith('tunnel:tunnel-123');
      expect(mockToEmit).toHaveBeenCalled();
    });
  });
});
