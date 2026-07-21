import { NextFunction, Request, Response } from 'express';

import { v1DeprecationMiddleware } from '../../middleware/v1Deprecation';

describe('v1DeprecationMiddleware', () => {
  function createReq(path: string): Request {
    return {
      path,
      method: 'GET',
      headers: {},
      ip: '127.0.0.1',
    } as Request;
  }

  function createRes(): Response {
    return {
      setHeader: jest.fn(),
    } as unknown as Response;
  }

  it('adds deprecation headers for mapped v1 endpoints', () => {
    const req = createReq('/api/auth/ping');
    const res = createRes();
    const next = jest.fn() as NextFunction;

    v1DeprecationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true');
    expect(res.setHeader).toHaveBeenCalledWith('Sunset', expect.any(String));
    expect(res.setHeader).toHaveBeenCalledWith(
      'Link',
      '</api/v2/auth/ping>; rel="successor-version"'
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-API-Warn',
      expect.stringContaining('/api/v2/auth/ping')
    );
  });

  it('does not add deprecation headers for unmapped v1 endpoints', () => {
    const req = createReq('/api/unknown/ping');
    const res = createRes();
    const next = jest.fn() as NextFunction;

    v1DeprecationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('does not add deprecation headers for v2 endpoints', () => {
    const req = createReq('/api/v2/auth/ping');
    const res = createRes();
    const next = jest.fn() as NextFunction;

    v1DeprecationMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).not.toHaveBeenCalled();
  });
});
