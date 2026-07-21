import type { Request, Response } from 'express';

const mockGetCurrentScore = jest.fn();
const mockGetScoreHistory = jest.fn();
const mockGetScoreBreakdown = jest.fn();
const mockGetHeatmap = jest.fn();
const mockGetOrgRanking = jest.fn();

// CASQueryService is constructed in the controller's field initializer; mock the
// module so importing the controller never touches the DB.
jest.mock('../../../services/analytics/CASQueryService', () => ({
  CASQueryService: jest.fn().mockImplementation(() => ({
    getCurrentScore: (...args: unknown[]) => mockGetCurrentScore(...args),
    getScoreHistory: (...args: unknown[]) => mockGetScoreHistory(...args),
    getScoreBreakdown: (...args: unknown[]) => mockGetScoreBreakdown(...args),
    getHeatmap: (...args: unknown[]) => mockGetHeatmap(...args),
    getOrgRanking: (...args: unknown[]) => mockGetOrgRanking(...args),
  })),
}));

import { CASController } from '../../../controllers/v2/CASController';

/** Minimal Express Response stub capturing status + json. */
function createResponse(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

function createRequest(
  params: Record<string, string> = {},
  query: Record<string, unknown> = {}
): Request {
  return { params, query } as unknown as Request;
}

describe('CASController (E3 — BaseController migration)', () => {
  const controller = new CASController();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getScore returns the raw score (success shape preserved)', async () => {
    const score = { organizationId: 'org-1', score: 72, computedAt: '2026-06-11' };
    mockGetCurrentScore.mockResolvedValueOnce(score);
    const res = createResponse();

    await controller.getScore(createRequest({ orgId: 'org-1' }), res);

    expect(mockGetCurrentScore).toHaveBeenCalledWith('org-1');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(score);
  });

  it('getScore returns a 404 (standardized envelope) when no score exists', async () => {
    mockGetCurrentScore.mockResolvedValueOnce(null);
    const res = createResponse();

    await controller.getScore(createRequest({ orgId: 'org-1' }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: 'No CAS score available for this organization yet',
      error: { message: 'No CAS score available for this organization yet' },
    });
  });

  it('getHistory preserves the { data, days } shape', async () => {
    const history = [{ date: '2026-06-10', score: 50 }];
    mockGetScoreHistory.mockResolvedValueOnce(history);
    const res = createResponse();

    await controller.getHistory(createRequest({ orgId: 'org-1' }, { days: '14' }), res);

    expect(mockGetScoreHistory).toHaveBeenCalledWith('org-1', 14);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ data: history, days: 14 });
  });

  it('getBreakdown returns a 404 when no breakdown exists', async () => {
    mockGetScoreBreakdown.mockResolvedValueOnce(null);
    const res = createResponse();

    await controller.getBreakdown(createRequest({ orgId: 'org-1' }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: 'No CAS data available for this organization yet',
    });
  });

  it('getRanking preserves the { data } shape', async () => {
    const ranking = [{ organizationId: 'org-1', rank: 1 }];
    mockGetOrgRanking.mockResolvedValueOnce(ranking);
    const res = createResponse();

    await controller.getRanking(createRequest({}, { limit: '5' }), res);

    expect(mockGetOrgRanking).toHaveBeenCalledWith(5);
    expect(res.body).toEqual({ data: ranking });
  });

  it('getHeatmap passes parsed days + logScale through and returns the raw payload', async () => {
    const heatmap = { cells: [] };
    mockGetHeatmap.mockResolvedValueOnce(heatmap);
    const res = createResponse();

    await controller.getHeatmap(
      createRequest({ orgId: 'org-1' }, { days: '7', logScale: 'false' }),
      res
    );

    expect(mockGetHeatmap).toHaveBeenCalledWith('org-1', 7, false);
    expect(res.body).toEqual(heatmap);
  });
});
