jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.user = {
      id: 'user-test-123',
      username: 'testuser',
      role: 'user',
    };
    next();
  },
}));

jest.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../../utils/encryptionTransformer', () => ({
  encryptionTransformer: {
    to: jest.fn((v: string) => v),
    from: jest.fn((v: string) => v),
  },
}));

jest.mock('../../services/ship/ShipService', () => ({
  ShipService: jest.fn().mockImplementation(() => ({
    batchGetShipCareersByNames: jest.fn().mockResolvedValue(new Map()),
  })),
}));

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockReturnValue({
      create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
      save: jest.fn(async (entity: Record<string, unknown>) => entity),
      findOne: jest.fn().mockResolvedValue(null),
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

import express, { type Application } from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { router as scstatsRouter } from '../../routes/v2/scstats';

function buildApp(): Application {
  const app = express();
  app.use(helmet());
  app.use(express.json());
  app.use('/api/v2/scstats', scstatsRouter);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : 'Upload failed';
    res.status(400).json({ success: false, error: message });
  });
  return app;
}

describe('SCStats log import route multipart integration', () => {
  let app: Application;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  it('returns 400 when no log files are provided', async () => {
    const response = await request(app)
      .post('/api/v2/scstats/users/user-test-123/log-import')
      .field('consent', 'true');

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
      })
    );
  });

  it('rejects invalid multipart file type for logs', async () => {
    const response = await request(app)
      .post('/api/v2/scstats/users/user-test-123/log-import')
      .field('consent', 'true')
      .attach('logs', Buffer.from('bad file'), {
        filename: 'bad.csv',
        contentType: 'text/csv',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('.log');
  });

  it('rejects requests that exceed max log file count', async () => {
    let req = request(app)
      .post('/api/v2/scstats/users/user-test-123/log-import')
      .field('consent', 'true');

    for (let i = 0; i < 31; i += 1) {
      req = req.attach('logs', Buffer.from(`<2026-06-18T06:47:${String(i).padStart(2, '0')}.000Z> line`), {
        filename: `Game_${i}.log`,
        contentType: 'text/plain',
      });
    }

    const response = await req;

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('imports valid multipart logs and returns parse-quality metadata', async () => {
    const logContent = [
      "<2026-06-18T06:47:40.268Z> [Trace] @env_session:  'pub-sc-alpha-480-11825000'",
      "<2026-06-18T06:48:10.000Z> granted control token for 'MISC_Prospector_1' [123]",
      "<2026-06-18T06:58:10.000Z> releasing control token for 'MISC_Prospector_1' [123]",
      "<2026-06-18T07:01:10.000Z> equipped item 'Arclight Pistol' port Weapon",
      "<2026-06-18T07:02:10.000Z> purchased item 'MedPen' for 450 aUEC",
      '<2026-06-18T07:17:40.268Z> session end',
    ].join('\n');

    const response = await request(app)
      .post('/api/v2/scstats/users/user-test-123/log-import')
      .field('consent', 'true')
      .attach('logs', Buffer.from(logContent), {
        filename: 'Game.log',
        contentType: 'text/plain',
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          logMeta: expect.objectContaining({
            parseQuality: expect.arrayContaining([
              expect.objectContaining({
                fileName: 'Game.log',
                sessionDetected: true,
              }),
            ]),
          }),
        }),
      })
    );
  });
});
