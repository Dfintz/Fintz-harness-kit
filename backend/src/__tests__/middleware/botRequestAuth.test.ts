/**
 * Tests for Bot Request Authentication Middleware
 */

import { NextFunction, Request, Response } from 'express';

import { validateBotRequest, validateBotToken } from '../../middleware/botRequestAuth';

jest.mock('../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: jest.fn().mockReturnValue({
      resolveOrganization: jest.fn().mockResolvedValue('org-abc'),
    }),
  },
}));

const mockReq = (headers: Record<string, string> = {}, params: Record<string, string> = {}) =>
  ({
    headers,
    params,
  }) as unknown as Request;

const mockRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

const mockNext = jest.fn() as NextFunction;

describe('botRequestAuth middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, NODE_ENV: 'production' };
    // Re-establish the GuildOrganizationService mock after resetAllMocks clears it
    const { GuildOrganizationService } = jest.requireMock(
      '../../services/discord/GuildOrganizationService'
    ) as { GuildOrganizationService: { getInstance: jest.Mock } };
    GuildOrganizationService.getInstance.mockReturnValue({
      resolveOrganization: jest.fn().mockResolvedValue('org-abc'),
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('validateBotToken', () => {
    it('should reject requests missing the x-bot-internal-token header', () => {
      process.env.BOT_INTERNAL_SECRET = 'test-secret-value';
      const req = mockReq({});
      const res = mockRes();

      validateBotToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests with an incorrect token', () => {
      process.env.BOT_INTERNAL_SECRET = 'test-secret-value';
      const req = mockReq({ 'x-bot-internal-token': 'wrong-secret' });
      const res = mockRes();

      validateBotToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow requests with the correct token', () => {
      process.env.BOT_INTERNAL_SECRET = 'test-secret-value';
      const req = mockReq({ 'x-bot-internal-token': 'test-secret-value' });
      const res = mockRes();

      validateBotToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should reject requests when BOT_INTERNAL_SECRET is not configured (production)', () => {
      delete process.env.BOT_INTERNAL_SECRET;
      const req = mockReq({ 'x-bot-internal-token': 'any-value' });
      const res = mockRes();

      validateBotToken(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow requests in test environment when BOT_INTERNAL_SECRET is not set', () => {
      delete process.env.BOT_INTERNAL_SECRET;
      process.env.NODE_ENV = 'test';
      const req = mockReq({});
      const res = mockRes();

      validateBotToken(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateBotRequest', () => {
    it('should reject requests missing x-bot-internal-token', async () => {
      process.env.BOT_INTERNAL_SECRET = 'test-secret-value';
      const req = mockReq({}, { orgId: 'org-abc' });
      const res = mockRes();

      await validateBotRequest(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests missing x-discord-guild-id when orgId is present', async () => {
      process.env.BOT_INTERNAL_SECRET = 'test-secret-value';
      const req = mockReq({ 'x-bot-internal-token': 'test-secret-value' }, { orgId: 'org-abc' });
      const res = mockRes();

      await validateBotRequest(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject requests when resolved org does not match orgId param', async () => {
      const { GuildOrganizationService } = jest.requireMock(
        '../../services/discord/GuildOrganizationService'
      ) as { GuildOrganizationService: { getInstance: jest.Mock } };
      (GuildOrganizationService.getInstance() as { resolveOrganization: jest.Mock })
        .resolveOrganization.mockResolvedValueOnce('different-org');

      process.env.BOT_INTERNAL_SECRET = 'test-secret-value';
      const req = mockReq(
        { 'x-bot-internal-token': 'test-secret-value', 'x-discord-guild-id': 'guild-123' },
        { orgId: 'org-abc' }
      );
      const res = mockRes();

      await validateBotRequest(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow requests with valid token and matching guild/org', async () => {
      process.env.BOT_INTERNAL_SECRET = 'test-secret-value';
      const req = mockReq(
        { 'x-bot-internal-token': 'test-secret-value', 'x-discord-guild-id': 'guild-123' },
        { orgId: 'org-abc' }
      );
      const res = mockRes();

      await validateBotRequest(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should proceed when no orgId param is present (token-only route)', async () => {
      process.env.BOT_INTERNAL_SECRET = 'test-secret-value';
      const req = mockReq({ 'x-bot-internal-token': 'test-secret-value' }, {});
      const res = mockRes();

      await validateBotRequest(req, res, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
