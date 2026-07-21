import express, { Request, Response } from 'express';
import request from 'supertest';

const getScmdbFilters = jest.fn((_req: Request, res: Response) => {
  res.status(200).json({ data: [{ name: 'combat', count: 1 }] });
});

const importScmdbByUrl = jest.fn((_req: Request, res: Response) => {
  res.status(201).json({ data: { id: 'mission-1' } });
});

jest.mock('../../middleware/auth', () => ({
  authenticate: (req: Request, _res: Response, next: () => void) => {
    (req as Request & { user?: { id: string; currentOrganizationId: string } }).user = {
      id: 'user-1',
      currentOrganizationId: 'org-1',
    };
    next();
  },
}));

jest.mock('../../middleware/tenantContext', () => ({
  tenantContextMiddleware: (_req: Request, _res: Response, next: () => void) => next(),
}));

jest.mock('../../middleware/schemaValidation', () => ({
  validateSchema: () => (_req: Request, _res: Response, next: () => void) => next(),
}));

jest.mock('../../controllers/missionController', () => ({
  MissionController: jest.fn().mockImplementation(() => ({
    getScmdbFilters,
    importScmdbByUrl,
    searchScmdbMissionCards: jest.fn(),
    importScmdbMissions: jest.fn(),
  })),
}));

import { router as missionsRouter } from '../v2/missions';

describe('SCMDB mission routes integration', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v2/missions', missionsRouter);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns SCMDB filters', async () => {
    const response = await request(app).get('/api/v2/missions/scmdb/filters').expect(200);

    expect(getScmdbFilters).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ data: [{ name: 'combat', count: 1 }] });
  });

  it('imports mission by URL', async () => {
    const payload = { url: 'https://scmdb.net/contracts/ABC123' };

    const response = await request(app)
      .post('/api/v2/missions/scmdb/import-url')
      .send(payload)
      .expect(201);

    expect(importScmdbByUrl).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ data: { id: 'mission-1' } });
  });
});
