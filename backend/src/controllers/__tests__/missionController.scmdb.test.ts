import type { Request, Response } from 'express';

import type { MissionService } from '../../services/content/MissionService';
import { MissionController } from '../missionController';

describe.skip('MissionController SCMDB endpoints', () => {
  const missionService = {
    getScmdbAvailableFilters: jest.fn(),
    importScmdbMissionByUrl: jest.fn(),
  } as unknown as MissionService;

  const createResponse = () => {
    const res = {} as Response & {
      success: jest.Mock;
      status: jest.Mock;
    };

    res.success = jest.fn().mockReturnValue(res);
    res.status = jest.fn().mockReturnValue(res);

    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns SCMDB filters via success envelope', async () => {
    const controller = new MissionController(missionService);
    const req = { body: {} } as Request;
    const res = createResponse();

    missionService.getScmdbAvailableFilters = jest
      .fn()
      .mockResolvedValue({ categories: [{ name: 'combat', count: 1 }] });

    await controller.getScmdbFilters(req, res);

    expect(missionService.getScmdbAvailableFilters).toHaveBeenCalledTimes(1);
    expect(res.success).toHaveBeenCalledWith({ categories: [{ name: 'combat', count: 1 }] });
  });

  it('imports a SCMDB mission by URL and returns 201', async () => {
    const controller = new MissionController(missionService);
    const req = {
      body: {
        url: 'https://scmdb.net/contracts/ABC123',
        priority: 'high',
        notes: 'urgent import',
      },
      user: {
        id: 'user-1',
        currentOrganizationId: 'org-1',
      },
    } as unknown as Request;
    const res = createResponse();

    missionService.importScmdbMissionByUrl = jest.fn().mockResolvedValue({ id: 'mission-1' });

    await controller.importScmdbByUrl(req, res);

    expect(missionService.importScmdbMissionByUrl).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'https://scmdb.net/contracts/ABC123',
      expect.objectContaining({ priority: 'high', notes: 'urgent import' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.success).toHaveBeenCalledWith({ mission: { id: 'mission-1' } });
  });
});
