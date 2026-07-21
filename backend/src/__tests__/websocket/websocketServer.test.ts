import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { Server as HttpServer } from 'node:http';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';
import { COOKIE_NAMES } from '../../config/cookies';
import { realtimeResilienceDiagnosticsService } from '../../services/monitoring/RealtimeResilienceDiagnosticsService';
import {
  awaitWebSocketTransportReady,
  closeWebSocketServer,
  emitToOrganization,
  emitToRoom,
  getIO,
  initializeWebSocketServer,
} from '../../websocket/websocketServer';

const waitForCoalesceFlush = async (): Promise<void> => {
  await new Promise(resolve => {
    setTimeout(resolve, 180);
  });
};

describe('WebSocket Server - Cookie Authentication', () => {
  let httpServer: HttpServer;
  let clientSocket: ClientSocket;
  const TEST_PORT = 3333;
  const JWT_SECRET = crypto.randomBytes(48).toString('hex');

  beforeAll(() => {
    // Set JWT secret for tests
    process.env.JWT_SECRET = JWT_SECRET;
  });

  beforeEach(done => {
    realtimeResilienceDiagnosticsService.resetForTests();

    // Create HTTP server
    httpServer = new HttpServer();

    // Initialize WebSocket server
    initializeWebSocketServer(httpServer);

    // Start server
    httpServer.listen(TEST_PORT, () => {
      done();
    });
  });

  afterEach(async () => {
    if (clientSocket?.connected) {
      clientSocket.disconnect();
    }

    await closeWebSocketServer();

    await new Promise<void>(resolve => {
      if (httpServer?.listening) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  afterAll(() => {
    delete process.env.JWT_SECRET;
  });

  const createValidToken = (
    userId: string = 'test-user-123',
    username: string = 'testuser'
  ): string => {
    return jwt.sign(
      {
        userId,
        username,
        organizationId: 'test-org-123',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
  };

  describe('Token Authentication Priority', () => {
    it('should authenticate with token from auth parameter (highest priority)', done => {
      const token = createValidToken();

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    it('should authenticate with token from Authorization header (second priority)', done => {
      const token = createValidToken();

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transportOptions: {
          polling: {
            extraHeaders: {
              Authorization: `Bearer ${token}`,
            },
          },
        },
        transports: ['polling', 'websocket'],
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    it('should authenticate with token from httpOnly cookie (third priority)', done => {
      const token = createValidToken();
      const encodedToken = encodeURIComponent(token);

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transportOptions: {
          polling: {
            extraHeaders: {
              Cookie: `${COOKIE_NAMES.ACCESS_TOKEN}=${encodedToken}`,
            },
          },
        },
        // Start with polling to send the cookie, then upgrade to websocket
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    it('should prefer auth token over cookie when both are present', done => {
      const authToken = createValidToken('user-from-auth', 'authuser');
      const cookieToken = createValidToken('user-from-cookie', 'cookieuser');
      const encodedCookieToken = encodeURIComponent(cookieToken);

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token: authToken },
        transportOptions: {
          polling: {
            extraHeaders: {
              Cookie: `${COOKIE_NAMES.ACCESS_TOKEN}=${encodedCookieToken}`,
            },
          },
        },
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        // The connection should use the auth token (higher priority)
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });
  });

  describe('Cookie Parsing Edge Cases', () => {
    it('should handle cookies with equals signs in the value', done => {
      // Create a token that will have base64 padding (contains =)
      const token = createValidToken();
      const encodedToken = encodeURIComponent(token);

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transportOptions: {
          polling: {
            extraHeaders: {
              Cookie: `${COOKIE_NAMES.ACCESS_TOKEN}=${encodedToken}; other_cookie=value=with=equals`,
            },
          },
        },
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    it('should handle multiple cookies correctly', done => {
      const token = createValidToken();
      const encodedToken = encodeURIComponent(token);

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transportOptions: {
          polling: {
            extraHeaders: {
              Cookie: `session=abc123; ${COOKIE_NAMES.ACCESS_TOKEN}=${encodedToken}; theme=dark`,
            },
          },
        },
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    it('should handle missing cookie gracefully', done => {
      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transportOptions: {
          polling: {
            extraHeaders: {
              Cookie: 'other_cookie=value',
            },
          },
        },
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect without valid token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication');
        done();
      });
    });

    it('should handle malformed cookie header', done => {
      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transportOptions: {
          polling: {
            extraHeaders: {
              Cookie: ';;;invalid;;;',
            },
          },
        },
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with malformed cookies'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication');
        done();
      });
    });
  });

  describe('Authentication Failures', () => {
    it('should reject connection without any token', done => {
      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect without token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with placeholder cookie-auth token', done => {
      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token: 'cookie-auth' },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with placeholder token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with undefined string token', done => {
      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token: 'undefined' },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with undefined string token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with null string token', done => {
      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token: 'null' },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with null string token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with empty string token', done => {
      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token: '   ' },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with empty string token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with malformed JWT (only 2 parts)', done => {
      const malformedToken = 'header.payload'; // Missing signature

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token: malformedToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with malformed JWT'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with malformed JWT (too many parts)', done => {
      const malformedToken = 'part1.part2.part3.part4';

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token: malformedToken },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with malformed JWT'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication token required');
        done();
      });
    });

    it('should reject connection with invalid token in cookie', done => {
      const invalidToken = 'invalid.jwt.token';
      const encodedToken = encodeURIComponent(invalidToken);

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transportOptions: {
          polling: {
            extraHeaders: {
              Cookie: `${COOKIE_NAMES.ACCESS_TOKEN}=${encodedToken}`,
            },
          },
        },
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with invalid token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication failed');
        done();
      });
    });

    it('should reject connection with expired token in cookie', done => {
      const expiredToken = jwt.sign(
        {
          userId: 'test-user',
          username: 'testuser',
          organizationId: 'test-org',
        },
        JWT_SECRET,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );
      const encodedToken = encodeURIComponent(expiredToken);

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        transportOptions: {
          polling: {
            extraHeaders: {
              Cookie: `${COOKIE_NAMES.ACCESS_TOKEN}=${encodedToken}`,
            },
          },
        },
        transports: ['polling', 'websocket'],
        withCredentials: true,
      });

      clientSocket.on('connect', () => {
        done(new Error('Should not connect with expired token'));
      });

      clientSocket.on('connect_error', error => {
        expect(error.message).toContain('Authentication failed');
        done();
      });
    });
  });

  describe('Room Subscription Diagnostics', () => {
    it('should track invalid room format subscription rejections', done => {
      const token = createValidToken();
      let asserted = false;

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { room: 'invalid-room' });
      });

      clientSocket.on('error', payload => {
        if (asserted) {
          return;
        }

        if (payload?.message !== 'Invalid room format') {
          return;
        }

        asserted = true;
        const diagnostics = realtimeResilienceDiagnosticsService.getDiagnostics();
        expect(diagnostics.websocket.roomSubscriptions.attemptsTotal).toBe(1);
        expect(diagnostics.websocket.roomSubscriptions.acceptedTotal).toBe(0);
        expect(diagnostics.websocket.roomSubscriptions.rejectedTotal).toBe(1);
        expect(diagnostics.websocket.roomSubscriptions.rejectionRatePercent).toBe(100);
        expect(diagnostics.websocket.roomSubscriptions.topRejectionReasons[0]).toMatchObject({
          action: 'invalid_room_format',
          count: 1,
        });
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });

    it('should track per-scope accepted and rejected subscriptions', done => {
      const token = createValidToken();
      let gotOrgRejection = false;
      let asserted = false;

      clientSocket = ClientIO(`http://localhost:${TEST_PORT}`, {
        path: '/api/socket.io',
        auth: { token },
        transports: ['websocket'],
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe', { room: 'org:test-org-123' });
        clientSocket.emit('subscribe', { room: 'tunnel:test-tunnel-123' });
      });

      clientSocket.on('error', payload => {
        if (payload?.message === 'Unauthorized: no active organization') {
          gotOrgRejection = true;
        }
      });

      clientSocket.on('subscribed', payload => {
        if (asserted || payload?.room !== 'tunnel:test-tunnel-123' || !gotOrgRejection) {
          return;
        }

        asserted = true;
        const diagnostics = realtimeResilienceDiagnosticsService.getDiagnostics();
        expect(diagnostics.websocket.roomSubscriptions.attemptsTotal).toBe(2);
        expect(diagnostics.websocket.roomSubscriptions.acceptedTotal).toBe(1);
        expect(diagnostics.websocket.roomSubscriptions.rejectedTotal).toBe(1);
        expect(diagnostics.websocket.roomSubscriptions.scopeBreakdown.org).toMatchObject({
          attemptsTotal: 1,
          acceptedTotal: 0,
          rejectedTotal: 1,
        });
        expect(diagnostics.websocket.roomSubscriptions.scopeBreakdown.tunnel).toMatchObject({
          attemptsTotal: 1,
          acceptedTotal: 1,
          rejectedTotal: 0,
        });
        expect(diagnostics.websocket.roomSubscriptions.scopeBreakdown.fleet).toMatchObject({
          attemptsTotal: 0,
          acceptedTotal: 0,
          rejectedTotal: 0,
        });
        done();
      });

      clientSocket.on('connect_error', error => {
        done(new Error(`Connection failed: ${error.message}`));
      });
    });
  });

  describe('WebSocket Lifecycle', () => {
    it('should resolve transport readiness after initialization', async () => {
      const readiness = await awaitWebSocketTransportReady(1000);

      expect(readiness.timedOut).toBe(false);
      expect(readiness.mode === 'redis' || readiness.mode === 'in-memory').toBe(true);
      expect(typeof readiness.reason).toBe('string');
      expect(readiness.waitedMs).toBeGreaterThanOrEqual(0);
    });

    it('should clear io singleton after explicit close', async () => {
      expect(() => getIO()).not.toThrow();

      await closeWebSocketServer();

      expect(() => getIO()).toThrow(
        'Socket.IO not initialized. Call initializeWebSocketServer first.'
      );
    });

    it('should allow repeated close calls without throwing', async () => {
      await expect(closeWebSocketServer()).resolves.toBeUndefined();
      await expect(closeWebSocketServer()).resolves.toBeUndefined();
    });
  });

  describe('WebSocket Coalescing Contracts', () => {
    it('should preserve default org stream payload contract as individual events', async () => {
      const adapter = getIO().of('/').adapter;
      const adapterBroadcastSpy = jest.spyOn(adapter, 'broadcast');

      try {
        emitToOrganization('test-org-123', 'fleet:updated', { id: 'evt-1' });
        emitToOrganization('test-org-123', 'fleet:updated', { id: 'evt-2' });

        await waitForCoalesceFlush();

        expect(adapterBroadcastSpy).toHaveBeenCalledTimes(2);

        const firstPacket = adapterBroadcastSpy.mock.calls[0]?.[0] as { data?: unknown[] };
        const secondPacket = adapterBroadcastSpy.mock.calls[1]?.[0] as { data?: unknown[] };

        expect(firstPacket.data?.[0]).toBe('fleet:updated');
        expect(secondPacket.data?.[0]).toBe('fleet:updated');
        expect(Array.isArray(firstPacket.data?.[1])).toBe(false);
        expect(Array.isArray(secondPacket.data?.[1])).toBe(false);
      } finally {
        adapterBroadcastSpy.mockRestore();
      }
    });
  });

  describe('Optional Batch Payload Mode', () => {
    const previousBatchScopes = process.env.WEBSOCKET_BATCH_PAYLOAD_SCOPES;

    beforeAll(() => {
      process.env.WEBSOCKET_BATCH_PAYLOAD_SCOPES = 'org,tunnel';
    });

    afterAll(() => {
      if (previousBatchScopes === undefined) {
        delete process.env.WEBSOCKET_BATCH_PAYLOAD_SCOPES;
      } else {
        process.env.WEBSOCKET_BATCH_PAYLOAD_SCOPES = previousBatchScopes;
      }
    });

    it('should emit a single batched payload for org streams when enabled', async () => {
      const adapter = getIO().of('/').adapter;
      const adapterBroadcastSpy = jest.spyOn(adapter, 'broadcast');

      try {
        emitToOrganization('test-org-999', 'fleet:updated', { id: 'batch-1' });
        emitToOrganization('test-org-999', 'fleet:updated', { id: 'batch-2' });

        await waitForCoalesceFlush();

        expect(adapterBroadcastSpy).toHaveBeenCalledTimes(1);

        const packet = adapterBroadcastSpy.mock.calls[0]?.[0] as { data?: unknown[] };
        expect(packet.data?.[0]).toBe('fleet:updated');
        expect(Array.isArray(packet.data?.[1])).toBe(true);
        const payloadItems = packet.data?.[1] as unknown[];
        expect(payloadItems).toHaveLength(2);
      } finally {
        adapterBroadcastSpy.mockRestore();
      }
    });

    it('should emit a single batched payload for tunnel room streams when enabled', async () => {
      const adapter = getIO().of('/').adapter;
      const adapterBroadcastSpy = jest.spyOn(adapter, 'broadcast');

      try {
        emitToRoom('tunnel:test-tunnel-1', 'tunnel:message', { id: 'tm-1' });
        emitToRoom('tunnel:test-tunnel-1', 'tunnel:message', { id: 'tm-2' });

        await waitForCoalesceFlush();

        expect(adapterBroadcastSpy).toHaveBeenCalledTimes(1);

        const packet = adapterBroadcastSpy.mock.calls[0]?.[0] as { data?: unknown[] };
        expect(packet.data?.[0]).toBe('tunnel:message');
        expect(Array.isArray(packet.data?.[1])).toBe(true);
        const payloadItems = packet.data?.[1] as unknown[];
        expect(payloadItems).toHaveLength(2);
      } finally {
        adapterBroadcastSpy.mockRestore();
      }
    });
  });
});
