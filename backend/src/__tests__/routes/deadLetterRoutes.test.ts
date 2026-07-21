/**
 * Dead-letter queue admin routes — delegation, projection, and status-mapping tests.
 * Mounts the router directly with mocked auth/audit middleware and a mocked retry service.
 */

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../middleware/adminAuth', () => ({
  logAdminMutation: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockGetStats = jest.fn();
const mockGetDeadLetterQueue = jest.fn();
const mockRetryDeadLetter = jest.fn();

jest.mock('../../services/discord/RoleSyncRetryService', () => ({
  getRoleSyncRetryService: () => ({
    getStats: mockGetStats,
    getDeadLetterQueue: mockGetDeadLetterQueue,
    retryDeadLetter: mockRetryDeadLetter,
  }),
}));

import express, { Application } from 'express';
import request from 'supertest';

import { router as deadLetterRouter } from '../../routes/admin/deadLetterRoutes';

const VALID_ID = '11111111-1111-1111-1111-111111111111';

const STATS = { pending: 1, processing: 0, completed: 5, failed: 2, deadLetter: 1, total: 9 };

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: VALID_ID,
    guildId: 'g1',
    userId: 'u1',
    roleId: 'r1',
    operation: 'assign',
    retryCount: 3,
    maxRetries: 3,
    status: 'dead_letter',
    payload: { secret: 'should-not-leak' },
    lastError: 'x'.repeat(900),
    lastErrorCode: 'E_TIMEOUT',
    createdAt: new Date('2026-06-18T10:00:00Z'),
    deadLetteredAt: new Date('2026-06-18T11:00:00Z'),
    adminNotified: true,
    adminNotifiedAt: new Date('2026-06-18T11:00:00Z'),
    ...overrides,
  };
}

function buildApp(): Application {
  const app = express();
  app.use(express.json());
  app.use('/admin/role-sync', deadLetterRouter);
  return app;
}

describe('deadLetterRoutes', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('GET /dead-letter', () => {
    it('returns stats + projected entries, truncates lastError, and omits payload', async () => {
      mockGetStats.mockResolvedValue(STATS);
      mockGetDeadLetterQueue.mockResolvedValue([makeEntry()]);

      const res = await request(buildApp()).get('/admin/role-sync/dead-letter');

      expect(res.status).toBe(200);
      expect(res.body.stats).toEqual(STATS);
      expect(res.body.entries).toHaveLength(1);
      const entry = res.body.entries[0];
      expect(entry.id).toBe(VALID_ID);
      expect(entry.lastError).toHaveLength(500);
      expect(entry).not.toHaveProperty('payload');
      expect(res.body.hasMore).toBe(false);
    });

    it('caps entries at 100 and sets hasMore', async () => {
      mockGetStats.mockResolvedValue({ ...STATS, deadLetter: 150 });
      mockGetDeadLetterQueue.mockResolvedValue(
        Array.from({ length: 150 }, (_, i) => makeEntry({ id: `id-${i}` }))
      );

      const res = await request(buildApp()).get('/admin/role-sync/dead-letter');

      expect(res.body.entries).toHaveLength(100);
      expect(res.body.hasMore).toBe(true);
    });

    it('returns 500 when the service throws', async () => {
      mockGetStats.mockRejectedValue(new Error('db down'));
      mockGetDeadLetterQueue.mockResolvedValue([]);

      const res = await request(buildApp()).get('/admin/role-sync/dead-letter');

      expect(res.status).toBe(500);
    });
  });

  describe('POST /dead-letter/:id/retry', () => {
    it('retries an entry that is in the dead-letter queue', async () => {
      mockGetDeadLetterQueue.mockResolvedValue([makeEntry()]);
      mockRetryDeadLetter.mockResolvedValue(undefined);

      const res = await request(buildApp()).post(`/admin/role-sync/dead-letter/${VALID_ID}/retry`);

      expect(res.status).toBe(200);
      expect(mockRetryDeadLetter).toHaveBeenCalledWith(VALID_ID);
    });

    it('returns 404 when the entry is not in the dead-letter queue', async () => {
      mockGetDeadLetterQueue.mockResolvedValue([]);

      const res = await request(buildApp()).post(`/admin/role-sync/dead-letter/${VALID_ID}/retry`);

      expect(res.status).toBe(404);
      expect(mockRetryDeadLetter).not.toHaveBeenCalled();
    });

    it('returns 409 when the entry left the queue between check and retry', async () => {
      mockGetDeadLetterQueue.mockResolvedValue([makeEntry()]);
      mockRetryDeadLetter.mockRejectedValue(
        new Error(`Entry ${VALID_ID} is not in dead letter queue (status: pending)`)
      );

      const res = await request(buildApp()).post(`/admin/role-sync/dead-letter/${VALID_ID}/retry`);

      expect(res.status).toBe(409);
    });

    it('rejects a non-uuid id with 400', async () => {
      const res = await request(buildApp()).post('/admin/role-sync/dead-letter/not-a-uuid/retry');

      expect(res.status).toBe(400);
      expect(mockRetryDeadLetter).not.toHaveBeenCalled();
    });
  });
});
