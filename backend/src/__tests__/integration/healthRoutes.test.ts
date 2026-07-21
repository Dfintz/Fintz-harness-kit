// Import the mock BEFORE importing anything that uses AppDataSource
import { mockAppDataSource, mockDataSourceState } from '../helpers/database-mock';

// Mock database config to use our global mock
jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

// Mock data-source as well
jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

const mockGetWebSocketTransportReadinessSnapshot = jest.fn();
jest.mock('../../websocket/websocketServer', () => ({
  getWebSocketTransportReadinessSnapshot: () => mockGetWebSocketTransportReadinessSnapshot(),
}));

// NOW import the routes (this will trigger controller/service creation with mocked database)
import express from 'express';
import request from 'supertest';

import { setHealthRoutes } from '../../routes/healthRoutes';
import { realtimeResilienceDiagnosticsService } from '../../services/monitoring/RealtimeResilienceDiagnosticsService';

describe('Health Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    setHealthRoutes(app);
    // Clear query mock if it exists
    if (mockAppDataSource.query && typeof mockAppDataSource.query === 'function') {
      (mockAppDataSource.query as jest.Mock).mockClear?.();
    }
    mockDataSourceState.isInitialized = true; // Reset to default via mockDataSourceState
    mockGetWebSocketTransportReadinessSnapshot.mockReset();
    mockGetWebSocketTransportReadinessSnapshot.mockReturnValue(null);
  });

  describe('GET /health', () => {
    it('should return 200 when service is healthy', async () => {
      // Mock query for health check
      mockAppDataSource.query = jest.fn().mockResolvedValue([{ result: 1 }]);
      process.env.DISCORD_BOT_TOKEN = 'test-token';

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('discordBot');
    });

    it('should return 200 when database is initialized and connected', async () => {
      // Explicitly set isInitialized to true and mock successful query
      mockDataSourceState.isInitialized = true;
      mockAppDataSource.query = jest.fn().mockResolvedValue([{ result: 1 }]);
      process.env.DISCORD_BOT_TOKEN = 'test-token';

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body.database).toBe('connected');
    });

    it('should return 503 when database is not initialized', async () => {
      // Set isInitialized to false via the mock state
      mockDataSourceState.isInitialized = false;

      const response = await request(app).get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toHaveProperty('status', 'DEGRADED');
      expect(response.body.database).toBe('not initialized');
    });

    it('should return valid JSON with all required fields', async () => {
      mockAppDataSource.query = jest.fn().mockResolvedValue([{ result: 1 }]);

      const response = await request(app).get('/health');

      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('database');
      expect(response.body).toHaveProperty('discordBot');
    });
  });

  describe('GET /health/realtime', () => {
    it('should return realtime diagnostics payload contract with new resilience fields', async () => {
      realtimeResilienceDiagnosticsService.resetForTests();
      realtimeResilienceDiagnosticsService.recordIpcRequest('guild:member_lookup', 0);
      realtimeResilienceDiagnosticsService.recordIpcFallbackResolution('guild:member_lookup');
      realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt('org');
      realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionRejected(
        'organization_room_mismatch',
        'org'
      );
      realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAttempt('tunnel');
      realtimeResilienceDiagnosticsService.recordWebSocketRoomSubscriptionAccepted('tunnel');

      const response = await request(app)
        .get('/health/realtime')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/json/);

      expect(response.body).toEqual(
        expect.objectContaining({
          timestamp: expect.any(String),
          uptimeMs: expect.any(Number),
          ipc: expect.objectContaining({
            requestsTotal: expect.any(Number),
            fallbackResolutionsTotal: expect.any(Number),
            fallbackRateByAction: expect.arrayContaining([
              expect.objectContaining({
                action: 'guild:member_lookup',
                requests: expect.any(Number),
                fallbackResolutions: expect.any(Number),
                fallbackRatePercent: expect.any(Number),
              }),
            ]),
          }),
          websocket: expect.objectContaining({
            roomSubscriptions: expect.objectContaining({
              attemptsTotal: expect.any(Number),
              acceptedTotal: expect.any(Number),
              rejectedTotal: expect.any(Number),
              rejectionRatePercent: expect.any(Number),
              scopeBreakdown: expect.objectContaining({
                org: expect.objectContaining({
                  attemptsTotal: expect.any(Number),
                  acceptedTotal: expect.any(Number),
                  rejectedTotal: expect.any(Number),
                  acceptanceRatePercent: expect.any(Number),
                  rejectionRatePercent: expect.any(Number),
                }),
                fleet: expect.any(Object),
                activity: expect.any(Object),
                trading: expect.any(Object),
                tunnel: expect.objectContaining({
                  attemptsTotal: expect.any(Number),
                  acceptedTotal: expect.any(Number),
                  rejectedTotal: expect.any(Number),
                  acceptanceRatePercent: expect.any(Number),
                  rejectionRatePercent: expect.any(Number),
                }),
              }),
            }),
          }),
        })
      );
    });

    it('should redact token-like content in realtime diagnostics errors', async () => {
      realtimeResilienceDiagnosticsService.resetForTests();
      realtimeResilienceDiagnosticsService.recordIpcPublishFailure(
        'guild:member_lookup',
        'publish failed with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abcdefghijklmnop.qrstuvwxyz'
      );

      const response = await request(app)
        .get('/health/realtime')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      const serializedErrors = JSON.stringify(response.body.ipc.recentErrors);
      expect(serializedErrors).not.toContain('eyJhbGciOiJIUzI1Ni');
      expect(serializedErrors).toContain('[REDACTED_TOKEN]');
    });
  });

  describe('GET /ready', () => {
    it('should return compact not_ready contract when transport readiness is unavailable', async () => {
      mockDataSourceState.isInitialized = true;
      mockAppDataSource.query = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockGetWebSocketTransportReadinessSnapshot.mockReturnValue(null);

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'not_ready',
          timestamp: expect.any(String),
          checks: expect.objectContaining({
            database: 'ready',
            transport: expect.objectContaining({
              status: 'not_ready',
              mode: 'unknown',
              reason: 'not_initialized',
              timedOut: false,
              latencyMs: null,
            }),
          }),
        })
      );
    });

    it('should return ready when database and websocket transport are ready', async () => {
      mockDataSourceState.isInitialized = true;
      mockAppDataSource.query = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockGetWebSocketTransportReadinessSnapshot.mockReturnValue({
        mode: 'redis',
        reason: 'adapter_attached',
        latencyMs: 42,
        attachAttempted: true,
        timedOut: false,
        waitedMs: 42,
      });

      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'ready',
          checks: expect.objectContaining({
            database: 'ready',
            transport: expect.objectContaining({
              status: 'ready',
              mode: 'redis',
              reason: 'adapter_attached',
              timedOut: false,
              latencyMs: 42,
            }),
          }),
        })
      );
    });

    it('should return not_ready when transport readiness timed out', async () => {
      mockDataSourceState.isInitialized = true;
      mockAppDataSource.query = jest.fn().mockResolvedValue([{ result: 1 }]);
      mockGetWebSocketTransportReadinessSnapshot.mockReturnValue({
        mode: 'unknown',
        reason: 'adapter_attach_timeout',
        latencyMs: null,
        attachAttempted: true,
        timedOut: true,
        waitedMs: 5000,
      });

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toEqual(
        expect.objectContaining({
          status: 'not_ready',
          checks: expect.objectContaining({
            transport: expect.objectContaining({
              status: 'not_ready',
              mode: 'unknown',
              reason: 'adapter_attach_timeout',
              timedOut: true,
            }),
          }),
        })
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
