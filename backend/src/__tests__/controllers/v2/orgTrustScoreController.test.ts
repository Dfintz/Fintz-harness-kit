import type { Request, Response } from 'express';

const mockGetTrustScore = jest.fn();

// OrgTrustScoreService is lazily constructed inside the controller module; mock
// the module so importing the controller never touches the DB.
jest.mock('../../../services/organization/OrgTrustScoreService', () => ({
  OrgTrustScoreService: jest.fn().mockImplementation(() => ({
    getTrustScore: (...args: unknown[]) => mockGetTrustScore(...args),
  })),
}));

import { OrgTrustScoreController } from '../../../controllers/v2/orgTrustScoreController';

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

function createRequest(id?: string): Request {
  return { params: id === undefined ? {} : { id } } as unknown as Request;
}

describe('OrgTrustScoreController (E3 — BaseController migration)', () => {
  const controller = new OrgTrustScoreController();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with the raw service result (success shape preserved)', async () => {
    const score = { organizationId: 'org-1', score: 87, breakdown: { activity: 40 } };
    mockGetTrustScore.mockResolvedValueOnce(score);
    const req = createRequest('org-1');
    const res = createResponse();

    await controller.getTrustScore(req, res);

    expect(mockGetTrustScore).toHaveBeenCalledWith('org-1');
    expect(res.statusCode).toBe(200);
    // executeAndReturn serializes the service payload verbatim (no envelope).
    expect(res.body).toEqual(score);
  });

  it('returns 400 with the standardized error envelope when the org id is missing', async () => {
    const req = createRequest();
    const res = createResponse();

    await controller.getTrustScore(req, res);

    expect(mockGetTrustScore).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Organization ID is required',
      error: { code: 'VALIDATION_ERROR', message: 'Organization ID is required' },
    });
  });

  it('returns an opaque 500 when the service throws (message not leaked)', async () => {
    mockGetTrustScore.mockRejectedValueOnce(new Error('pg: connection reset by peer'));
    const req = createRequest('org-1');
    const res = createResponse();

    await controller.getTrustScore(req, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Failed to compute trust score',
      error: { code: 'DATABASE_ERROR' },
    });
    // The raw driver message must not reach the response body.
    expect(JSON.stringify(res.body)).not.toContain('connection reset');
  });
});
