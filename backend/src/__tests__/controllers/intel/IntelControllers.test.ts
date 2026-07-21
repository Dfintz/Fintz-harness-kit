/**
 * Intel Controllers — Integration Tests
 *
 * Tests for MemberAuditController, OrgWatchlistController, and
 * MemberProfileController.   Validates request → service delegation,
 * response codes, and error handling through BaseController.executeAndReturn.
 *
 * Wave 2.1 — Membership Audit & Intel (Gap T4)
 */
import { Response } from 'express';

import { AuthRequest } from '../../../middleware/auth';

/* ────────────────────────────────────────────────────────────────── */
/*  Service mocks (before imports)                                    */
/* ────────────────────────────────────────────────────────────────── */

const mockListFlags = jest.fn();
const mockGetFlagById = jest.fn();
const mockCreateManualFlag = jest.fn();
const mockResolveFlag = jest.fn();
const mockGetUserFlagStats = jest.fn();
const mockToSummary = jest.fn();

jest.mock('../../../services/intel/MemberAuditService', () => ({
  MemberAuditService: jest.fn().mockImplementation(() => ({
    listFlags: mockListFlags,
    getFlagById: mockGetFlagById,
    createManualFlag: mockCreateManualFlag,
    resolveFlag: mockResolveFlag,
    getUserFlagStats: mockGetUserFlagStats,
    toSummary: mockToSummary,
  })),
}));

const mockListEntries = jest.fn();
const mockGetEntryById = jest.fn();
const mockCreateEntry = jest.fn();
const mockUpdateEntry = jest.fn();
const mockDeleteEntry = jest.fn();

jest.mock('../../../services/intel/OrgWatchlistService', () => ({
  OrgWatchlistService: jest.fn().mockImplementation(() => ({
    listEntries: mockListEntries,
    getEntryById: mockGetEntryById,
    createEntry: mockCreateEntry,
    updateEntry: mockUpdateEntry,
    deleteEntry: mockDeleteEntry,
  })),
}));

const mockGetProfile = jest.fn();

jest.mock('../../../services/intel/MemberProfileService', () => ({
  MemberProfileService: jest.fn().mockImplementation(() => ({
    getProfile: mockGetProfile,
  })),
}));

/* ────────────────────────────────────────────────────────────────── */
/*  Imports (after mocks)                                             */
/* ────────────────────────────────────────────────────────────────── */

import { MemberAuditController } from '../../../controllers/intel/MemberAuditController';
import { MemberProfileController } from '../../../controllers/intel/MemberProfileController';
import { OrgWatchlistController } from '../../../controllers/intel/OrgWatchlistController';

/* ────────────────────────────────────────────────────────────────── */
/*  Test Helpers                                                      */
/* ────────────────────────────────────────────────────────────────── */

function mockReq(overrides: Partial<AuthRequest> = {}): AuthRequest {
  return {
    params: { orgId: 'org-1' },
    query: {},
    body: {},
    user: { id: 'user-1', role: 'admin' },
    ...overrides,
  } as unknown as AuthRequest;
}

function mockRes(): Response {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

/* ═══════════════════════════════════════════════════════════════════ */
/*  MemberAuditController                                             */
/* ═══════════════════════════════════════════════════════════════════ */

describe('MemberAuditController', () => {
  let controller: MemberAuditController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MemberAuditController();
  });

  /* ─── listFlags ──────────────────────────────────────────────── */

  describe('listFlags', () => {
    it('should return paginated flags with 200', async () => {
      const flags = { data: [{ id: 'f1' }], total: 1 };
      mockListFlags.mockResolvedValue(flags);

      const req = mockReq({ query: { page: '1', pageSize: '10' } as any });
      const res = mockRes();

      await controller.listFlags(req, res);

      expect(mockListFlags).toHaveBeenCalledWith('org-1', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(flags);
    });

    it('should normalise single flagTypes to array', async () => {
      mockListFlags.mockResolvedValue({ data: [] });

      const req = mockReq({
        query: { flagTypes: 'manual' } as any,
      });
      const res = mockRes();

      await controller.listFlags(req, res);

      expect(mockListFlags).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ flagTypes: ['manual'] })
      );
    });

    it('should handle service errors with 500', async () => {
      mockListFlags.mockRejectedValue(new Error('DB error'));

      const res = mockRes();
      await controller.listFlags(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /* ─── getFlagById ────────────────────────────────────────────── */

  describe('getFlagById', () => {
    it('should return flag with 200', async () => {
      const flag = { id: 'f1', organizationId: 'org-1' };
      mockGetFlagById.mockResolvedValue(flag);

      const req = mockReq({ params: { orgId: 'org-1', flagId: 'f1' } });
      const res = mockRes();

      await controller.getFlagById(req, res);

      expect(mockGetFlagById).toHaveBeenCalledWith('org-1', 'f1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(flag);
    });

    it('should return 404 when flag not found', async () => {
      mockGetFlagById.mockResolvedValue(null);

      const req = mockReq({ params: { orgId: 'org-1', flagId: 'missing' } });
      const res = mockRes();

      await controller.getFlagById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  /* ─── createManualFlag ───────────────────────────────────────── */

  describe('createManualFlag', () => {
    it('should create flag and return 201 with summary', async () => {
      const flag = { id: 'f2', userId: 'target-1', flagType: 'manual' };
      const summary = { id: 'f2', flagType: 'manual' };
      mockCreateManualFlag.mockResolvedValue(flag);
      mockToSummary.mockReturnValue(summary);

      const req = mockReq({
        body: { userId: 'target-1', description: 'Suspicious activity', severity: 'medium' },
      });
      const res = mockRes();

      await controller.createManualFlag(req, res);

      expect(mockCreateManualFlag).toHaveBeenCalledWith(
        'org-1',
        'target-1',
        'user-1',
        expect.objectContaining({ userId: 'target-1' })
      );
      expect(mockToSummary).toHaveBeenCalledWith(flag);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(summary);
    });

    it('should handle creation errors', async () => {
      mockCreateManualFlag.mockRejectedValue(new Error('Validation failed'));

      const req = mockReq({ body: { userId: 'x' } });
      const res = mockRes();

      await controller.createManualFlag(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  /* ─── resolveFlag ────────────────────────────────────────────── */

  describe('resolveFlag', () => {
    it('should resolve flag and return summary', async () => {
      const resolved = { id: 'f1', status: 'resolved' };
      const summary = { id: 'f1', status: 'resolved' };
      mockResolveFlag.mockResolvedValue(resolved);
      mockToSummary.mockReturnValue(summary);

      const req = mockReq({
        params: { orgId: 'org-1', flagId: 'f1' },
        body: { status: 'resolved', resolutionNote: 'Cleared' },
      });
      const res = mockRes();

      await controller.resolveFlag(req, res);

      expect(mockResolveFlag).toHaveBeenCalledWith('org-1', 'f1', 'user-1', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(summary);
    });
  });

  /* ─── getUserFlagStats ───────────────────────────────────────── */

  describe('getUserFlagStats', () => {
    it('should return stats for a user', async () => {
      const stats = { userId: 'u1', totalFlags: 3, openFlags: 1 };
      mockGetUserFlagStats.mockResolvedValue(stats);

      const req = mockReq({ params: { orgId: 'org-1', userId: 'u1' } });
      const res = mockRes();

      await controller.getUserFlagStats(req, res);

      expect(mockGetUserFlagStats).toHaveBeenCalledWith('org-1', 'u1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(stats);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  OrgWatchlistController                                            */
/* ═══════════════════════════════════════════════════════════════════ */

describe('OrgWatchlistController', () => {
  let controller: OrgWatchlistController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OrgWatchlistController();
  });

  /* ─── listEntries ────────────────────────────────────────────── */

  describe('listEntries', () => {
    it('should return entries with 200', async () => {
      const entries = { data: [{ id: 'w1' }], total: 1 };
      mockListEntries.mockResolvedValue(entries);

      const req = mockReq();
      const res = mockRes();

      await controller.listEntries(req, res);

      expect(mockListEntries).toHaveBeenCalledWith('org-1', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should normalise single reasons to array', async () => {
      mockListEntries.mockResolvedValue({ data: [] });

      const req = mockReq({ query: { reasons: 'scam' } as any });
      const res = mockRes();

      await controller.listEntries(req, res);

      expect(mockListEntries).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({ reasons: ['scam'] })
      );
    });
  });

  /* ─── getEntryById ───────────────────────────────────────────── */

  describe('getEntryById', () => {
    it('should return entry with 200', async () => {
      const entry = { id: 'w1', rsiHandle: 'EVIL' };
      mockGetEntryById.mockResolvedValue(entry);

      const req = mockReq({ params: { orgId: 'org-1', entryId: 'w1' } });
      const res = mockRes();

      await controller.getEntryById(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(entry);
    });

    it('should return 404 when entry not found', async () => {
      mockGetEntryById.mockResolvedValue(null);

      const req = mockReq({ params: { orgId: 'org-1', entryId: 'missing' } });
      const res = mockRes();

      await controller.getEntryById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  /* ─── createEntry ────────────────────────────────────────────── */

  describe('createEntry', () => {
    it('should create entry and return 201', async () => {
      const entry = { id: 'w2', rsiHandle: 'BAD' };
      mockCreateEntry.mockResolvedValue(entry);

      const req = mockReq({
        body: { rsiHandle: 'BAD', reason: 'scam', threatLevel: 'high' },
      });
      const res = mockRes();

      await controller.createEntry(req, res);

      expect(mockCreateEntry).toHaveBeenCalledWith('org-1', 'user-1', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(entry);
    });
  });

  /* ─── updateEntry ────────────────────────────────────────────── */

  describe('updateEntry', () => {
    it('should update and return 200', async () => {
      const updated = { id: 'w1', notes: 'Updated' };
      mockUpdateEntry.mockResolvedValue(updated);

      const req = mockReq({
        params: { orgId: 'org-1', entryId: 'w1' },
        body: { notes: 'Updated' },
      });
      const res = mockRes();

      await controller.updateEntry(req, res);

      expect(mockUpdateEntry).toHaveBeenCalledWith('org-1', 'w1', { notes: 'Updated' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  /* ─── deleteEntry ────────────────────────────────────────────── */

  describe('deleteEntry', () => {
    it('should delete and return success', async () => {
      mockDeleteEntry.mockResolvedValue(true);

      const req = mockReq({ params: { orgId: 'org-1', entryId: 'w1' } });
      const res = mockRes();

      await controller.deleteEntry(req, res);

      expect(mockDeleteEntry).toHaveBeenCalledWith('org-1', 'w1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should return 404 when entry not found', async () => {
      mockDeleteEntry.mockResolvedValue(false);

      const req = mockReq({ params: { orgId: 'org-1', entryId: 'ghost' } });
      const res = mockRes();

      await controller.deleteEntry(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════ */
/*  MemberProfileController                                           */
/* ═══════════════════════════════════════════════════════════════════ */

describe('MemberProfileController', () => {
  let controller: MemberProfileController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MemberProfileController();
  });

  describe('getProfile', () => {
    it('should return profile with viewer context', async () => {
      const profile = { userId: 'u1', username: 'TestUser', flagStats: { totalFlags: 2 } };
      mockGetProfile.mockResolvedValue(profile);

      const req = mockReq({
        params: { orgId: 'org-1', userId: 'u1' },
        user: { id: 'viewer-1', role: 'admin' } as any,
      });
      const res = mockRes();

      await controller.getProfile(req, res);

      expect(mockGetProfile).toHaveBeenCalledWith('org-1', 'u1', 'viewer-1', true);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(profile);
    });

    it('should pass isPlatformAdmin=false for regular users', async () => {
      mockGetProfile.mockResolvedValue({});

      const req = mockReq({
        params: { orgId: 'org-1', userId: 'u1' },
        user: { id: 'viewer-2', role: 'member' } as any,
      });
      const res = mockRes();

      await controller.getProfile(req, res);

      expect(mockGetProfile).toHaveBeenCalledWith('org-1', 'u1', 'viewer-2', false);
    });

    it('should pass isPlatformAdmin=true for super_admin', async () => {
      mockGetProfile.mockResolvedValue({});

      const req = mockReq({
        params: { orgId: 'org-1', userId: 'u1' },
        user: { id: 'viewer-3', role: 'super_admin' } as any,
      });
      const res = mockRes();

      await controller.getProfile(req, res);

      expect(mockGetProfile).toHaveBeenCalledWith('org-1', 'u1', 'viewer-3', true);
    });

    it('should handle service errors', async () => {
      mockGetProfile.mockRejectedValue(new Error('Profile fetch failed'));

      const req = mockReq({ params: { orgId: 'org-1', userId: 'u1' } });
      const res = mockRes();

      await controller.getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
