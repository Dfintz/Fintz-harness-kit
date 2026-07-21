/**
 * Tests for Participation Controller V2
 * Sprint 20-E: Unified Participation Hook (backend endpoint)
 */

import { Request, Response } from 'express';

import { SystemRole } from '@sc-fleet-manager/shared-types';

import { ParticipationControllerV2 } from '../../controllers/v2/participationController';

// Mock the UnifiedParticipantService module
jest.mock('../../services/aggregators/UnifiedParticipantService');

import { UnifiedParticipantService } from '../../services/aggregators/UnifiedParticipantService';

const MockedService = UnifiedParticipantService as jest.MockedClass<
  typeof UnifiedParticipantService
>;

describe('ParticipationControllerV2', () => {
  let controller: ParticipationControllerV2;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockSuccess: jest.Mock;

  const testUserId = 'user-123';
  const testOrgId = 'org-456';

  const mockSummary = {
    userId: testUserId,
    totalParticipations: 5,
    systems: [
      {
        system: 'team' as const,
        participants: [
          {
            userId: testUserId,
            username: 'TestUser',
            roles: [SystemRole.ORG_MEMBER],
            status: 'active' as const,
            joinedAt: new Date(),
          },
        ],
      },
      {
        system: 'activity' as const,
        participants: [
          {
            userId: testUserId,
            username: 'TestUser',
            roles: [SystemRole.ACTIVITY_PARTICIPANT],
            status: 'active' as const,
            joinedAt: new Date(),
          },
        ],
      },
    ],
    activeCount: 4,
    pendingCount: 1,
    allRoles: [SystemRole.ORG_MEMBER, SystemRole.ACTIVITY_PARTICIPANT],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    controller = new ParticipationControllerV2();

    mockSuccess = jest.fn();
    mockReq = {
      user: { id: testUserId, username: 'TestUser' } as any,
      query: {},
      params: {},
    };
    mockRes = {
      success: mockSuccess,
    } as Partial<Response>;

    MockedService.prototype.getUserParticipationSummary = jest.fn().mockResolvedValue(mockSummary);
  });

  // ── getSummary (authenticated user) ─────────────────────────────────

  describe('getSummary', () => {
    it('should return participation summary for authenticated user', async () => {
      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith({
        userId: testUserId,
        organizationId: undefined,
        systems: undefined,
      });
      expect(mockSuccess).toHaveBeenCalledWith(mockSummary);
    });

    it('should pass organizationId filter', async () => {
      mockReq.query = { organizationId: testOrgId };

      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith({
        userId: testUserId,
        organizationId: testOrgId,
        systems: undefined,
      });
    });

    it('should parse systems filter from comma-separated string', async () => {
      mockReq.query = { systems: 'team,activity' };

      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith({
        userId: testUserId,
        organizationId: undefined,
        systems: ['team', 'activity'],
      });
    });

    it('should accept all four valid systems', async () => {
      mockReq.query = { systems: 'team,activity,job,lfg' };

      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          systems: ['team', 'activity', 'job', 'lfg'],
        })
      );
    });

    it('should throw on invalid system value', async () => {
      mockReq.query = { systems: 'team,invalid' };

      await expect(
        controller.getSummary(mockReq as Request, mockRes as Response)
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should throw when user is not authenticated', async () => {
      mockReq.user = undefined;

      await expect(
        controller.getSummary(mockReq as Request, mockRes as Response)
      ).rejects.toMatchObject({
        statusCode: 401,
      });
    });

    it('should throw 500 on unexpected service error', async () => {
      MockedService.prototype.getUserParticipationSummary = jest
        .fn()
        .mockRejectedValue(new Error('DB connection lost'));

      await expect(
        controller.getSummary(mockReq as Request, mockRes as Response)
      ).rejects.toMatchObject({
        statusCode: 500,
      });
    });

    it('should combine organizationId and systems filters', async () => {
      mockReq.query = { organizationId: testOrgId, systems: 'job,lfg' };

      await controller.getSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith({
        userId: testUserId,
        organizationId: testOrgId,
        systems: ['job', 'lfg'],
      });
    });
  });

  // ── getUserSummary (specific user) ──────────────────────────────────

  describe('getUserSummary', () => {
    const targetUserId = 'target-user-789';

    beforeEach(() => {
      mockReq.params = { userId: targetUserId };
    });

    it('should return participation summary for the requested user', async () => {
      await controller.getUserSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith({
        userId: targetUserId,
        organizationId: undefined,
        systems: undefined,
      });
      expect(mockSuccess).toHaveBeenCalled();
    });

    it('should pass organizationId filter for target user', async () => {
      mockReq.query = { organizationId: testOrgId };

      await controller.getUserSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith({
        userId: targetUserId,
        organizationId: testOrgId,
        systems: undefined,
      });
    });

    it('should parse systems filter for target user', async () => {
      mockReq.query = { systems: 'activity' };

      await controller.getUserSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith({
        userId: targetUserId,
        organizationId: undefined,
        systems: ['activity'],
      });
    });

    it('should throw on invalid system value for target user', async () => {
      mockReq.query = { systems: 'bogus' };

      await expect(
        controller.getUserSummary(mockReq as Request, mockRes as Response)
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should handle missing userId param', async () => {
      mockReq.params = {};

      await expect(
        controller.getUserSummary(mockReq as Request, mockRes as Response)
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('should trim and lowercase system values', async () => {
      mockReq.query = { systems: ' Team , Activity ' };

      await controller.getUserSummary(mockReq as Request, mockRes as Response);

      expect(MockedService.prototype.getUserParticipationSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          systems: ['team', 'activity'],
        })
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
