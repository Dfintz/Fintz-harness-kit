import { Request, Response } from 'express';

import { scstatsController } from '../../controllers/scstatsController';

// ─── Mock dependencies ───────────────────────────────────────────────

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn((data: Record<string, unknown>) => ({
        ...data,
        scstatsImportCount: 0,
        combatSkill: 50,
        pilotingSkill: 50,
        tradingSkill: 50,
        miningSkill: 50,
      })),
      save: jest.fn((entity: Record<string, unknown>) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
        getRawOne: jest.fn().mockResolvedValue(null),
        getMany: jest.fn().mockResolvedValue([]),
        getOne: jest.fn().mockResolvedValue(null),
      }),
      metadata: { name: 'MockEntity', tableName: 'mock_entity', columns: [], relations: [] },
    }),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../utils/encryptionTransformer', () => ({
  encryptionTransformer: {
    to: jest.fn((v: string) => v),
    from: jest.fn((v: string) => v),
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────

const USER_ID = 'user-test-123';

const validSCStatsJSON = JSON.stringify({
  metadata: { version: '0.3', exportDate: '2026-02-12' },
  playtime: { totalHours: 100, sessionCount: 50, averageSessionLength: 120 },
  combat: {
    kills: { total: 200, player: 20, npc: 180 },
    deaths: { total: 100 },
    kd: 2.0,
  },
  missions: { totalCompleted: 75, byType: { Bounty: 30, Mining: 20 } },
  vehicles: { favoriteByFlightTime: { name: 'Gladius', hours: 50 } },
});

function buildAuthRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    params: {},
    query: {},
    body: {},
    user: {
      id: USER_ID,
      username: 'testuser',
      role: 'user',
    },
    ...overrides,
  } as Partial<Request>;
}

function buildResponse(): { res: Partial<Response>; statusSpy: jest.Mock; jsonSpy: jest.Mock } {
  const jsonSpy = jest.fn().mockReturnThis();
  const statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
  return {
    res: { status: statusSpy, json: jsonSpy } as Partial<Response>,
    statusSpy,
    jsonSpy,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('SCStatsController', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('importSCStats', () => {
    it('should import SCStats data successfully', async () => {
      const { AppDataSource } = jest.requireMock('../../data-source');
      const mockRepo = AppDataSource.getRepository();
      mockRepo.findOne.mockResolvedValue(null);

      const req = buildAuthRequest({
        params: { userId: USER_ID },
        body: { consent: 'true' },
        file: {
          buffer: Buffer.from(validSCStatsJSON),
          mimetype: 'application/json',
          originalname: 'scstats.json',
        },
      } as Partial<Request>);

      const { res, statusSpy, jsonSpy } = buildResponse();

      await scstatsController.importSCStats(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: 'SCStats data imported successfully',
          }),
        })
      );
    });

    it('should reject import for different user', async () => {
      const req = buildAuthRequest({
        params: { userId: 'different-user' },
        body: { consent: 'true' },
        file: {
          buffer: Buffer.from(validSCStatsJSON),
        },
      } as Partial<Request>);

      const { res, statusSpy, jsonSpy } = buildResponse();

      await scstatsController.importSCStats(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should reject import without file', async () => {
      const req = buildAuthRequest({
        params: { userId: USER_ID },
        body: { consent: 'true' },
      });

      const { res, statusSpy, jsonSpy } = buildResponse();

      await scstatsController.importSCStats(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should reject import without consent', async () => {
      const req = buildAuthRequest({
        params: { userId: USER_ID },
        body: { consent: 'false' },
        file: {
          buffer: Buffer.from(validSCStatsJSON),
        },
      } as Partial<Request>);

      const { res, statusSpy, jsonSpy } = buildResponse();

      await scstatsController.importSCStats(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });

  describe('getSCStats', () => {
    it('should return SCStats data for user', async () => {
      const { AppDataSource } = jest.requireMock('../../data-source');
      const mockRepo = AppDataSource.getRepository();
      mockRepo.findOne.mockResolvedValue({
        userId: USER_ID,
        scstatsVerified: true,
        scstatsLastImport: new Date(),
        scstatsImportCount: 1,
        scstatsConsentGranted: true,
        scstatsTotalHours: 100,
        scstatsKdRatio: 2.0,
        scstatsMissionsCompleted: 75,
        scstatsFavoriteVehicle: 'Gladius',
      });

      const req = buildAuthRequest({
        params: { userId: USER_ID },
      });

      const { res, statusSpy, jsonSpy } = buildResponse();

      await scstatsController.getSCStats(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            hasData: true,
            metrics: expect.objectContaining({
              totalHours: 100,
              kdRatio: 2.0,
            }),
          }),
        })
      );
    });

    it('should return no data when user has no SCStats', async () => {
      const { AppDataSource } = jest.requireMock('../../data-source');
      const mockRepo = AppDataSource.getRepository();
      mockRepo.findOne.mockResolvedValue(null);

      const req = buildAuthRequest({
        params: { userId: USER_ID },
      });

      const { res, statusSpy, jsonSpy } = buildResponse();

      await scstatsController.getSCStats(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            hasData: false,
          }),
        })
      );
    });
  });

  describe('deleteSCStats', () => {
    it('should delete SCStats data for own user', async () => {
      const { AppDataSource } = jest.requireMock('../../data-source');
      const mockRepo = AppDataSource.getRepository();
      mockRepo.findOne.mockResolvedValue({
        userId: USER_ID,
        scstatsVerified: true,
        scstatsRawData: '{}',
      });

      const req = buildAuthRequest({
        params: { userId: USER_ID },
      });

      const { res, statusSpy, jsonSpy } = buildResponse();

      await scstatsController.deleteSCStats(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            message: 'SCStats data deleted successfully',
          }),
        })
      );
    });

    it('should reject delete for different user', async () => {
      const req = buildAuthRequest({
        params: { userId: 'different-user' },
      });

      const { res, statusSpy, jsonSpy } = buildResponse();

      await scstatsController.deleteSCStats(req as Request, res as Response);

      expect(statusSpy).toHaveBeenCalledWith(401);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });
  });
});
