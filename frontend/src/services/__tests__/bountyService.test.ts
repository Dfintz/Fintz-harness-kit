/**
 * Bounty Service Tests
 *
 * Tests for claim management and evidence submission APIs
 */

import { apiClient } from '@/services/apiClient';
import { BountyClaimStatus, bountyService, EvidenceType } from '@/services/bountyService';

// Mock the API client
jest.mock('../apiClient', () => {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class MockApiClientError extends Error {
    code: string;
    statusCode?: number;
    constructor(errorCode: string, message: string, statusCode?: number) {
      super(message);
      this.name = 'ApiClientError';
      this.code = errorCode;
      this.statusCode = statusCode;
    }
  }

  return {
    apiClient: {
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
    },
    ApiClientError: MockApiClientError,
    getErrorMessage: jest.fn((err: Error) => err.message),
  };
});

describe('BountyService - Claim Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getMyClaims', () => {
    it('should fetch claims with statistics', async () => {
      const mockResponse = {
        data: {
          claims: [
            {
              id: 'claim-1',
              bountyId: 'bounty-1',
              hunterId: 'user-1',
              status: BountyClaimStatus.ACTIVE,
              claimedAt: '2024-01-01',
              evidence: [],
            },
          ],
          stats: {
            totalClaims: 5,
            activeClaims: 2,
            completedClaims: 2,
            abandonedClaims: 1,
            rejectedClaims: 0,
          },
        },
      };
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await bountyService.getMyClaims();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v2/bounties/claims/my-claims');
      expect(result.claims).toHaveLength(1);
      expect(result.stats.totalClaims).toBe(5);
      expect(result.stats.activeClaims).toBe(2);
    });

    it('should fetch claims with status filter', async () => {
      const mockResponse = {
        data: {
          claims: [],
          stats: {
            totalClaims: 0,
            activeClaims: 0,
            completedClaims: 0,
            abandonedClaims: 0,
            rejectedClaims: 0,
          },
        },
      };
      (apiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await bountyService.getMyClaims(BountyClaimStatus.ACTIVE);

      expect(apiClient.get).toHaveBeenCalledWith('/api/v2/bounties/claims/my-claims?status=active');
    });
  });

  describe('submitClaim', () => {
    it('should submit claim for review without notes', async () => {
      const mockClaim = {
        id: 'claim-1',
        bountyId: 'bounty-1',
        hunterId: 'user-1',
        status: BountyClaimStatus.SUBMITTED,
        claimedAt: '2024-01-01',
        submittedAt: '2024-01-02',
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockClaim });

      const result = await bountyService.submitClaim('bounty-1', 'claim-1');

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v2/bounties/bounty-1/claims/claim-1/submit',
        {}
      );
      expect(result.status).toBe(BountyClaimStatus.SUBMITTED);
    });

    it('should submit claim for review with completion notes', async () => {
      const mockClaim = {
        id: 'claim-1',
        bountyId: 'bounty-1',
        status: BountyClaimStatus.SUBMITTED,
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockClaim });

      await bountyService.submitClaim('bounty-1', 'claim-1', {
        completionNotes: 'Target eliminated successfully',
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v2/bounties/bounty-1/claims/claim-1/submit',
        { completionNotes: 'Target eliminated successfully' }
      );
    });
  });

  describe('submitEvidence', () => {
    it('should submit text evidence', async () => {
      const mockEvidence = {
        id: 'evidence-1',
        claimId: 'claim-1',
        evidenceType: EvidenceType.TEXT,
        content: 'Target location confirmed',
        submittedAt: '2024-01-01',
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockEvidence });

      const result = await bountyService.submitEvidence('bounty-1', 'claim-1', {
        evidenceType: EvidenceType.TEXT,
        content: 'Target location confirmed',
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v2/bounties/bounty-1/claims/claim-1/evidence',
        {
          evidenceType: EvidenceType.TEXT,
          content: 'Target location confirmed',
        }
      );
      expect(result.evidenceType).toBe(EvidenceType.TEXT);
    });

    it('should submit screenshot evidence with URL', async () => {
      const mockEvidence = {
        id: 'evidence-2',
        claimId: 'claim-1',
        evidenceType: EvidenceType.SCREENSHOT,
        fileUrl: 'https://example.com/screenshot.png',
        fileName: 'screenshot.png',
        submittedAt: '2024-01-01',
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockEvidence });

      const result = await bountyService.submitEvidence('bounty-1', 'claim-1', {
        evidenceType: EvidenceType.SCREENSHOT,
        fileUrl: 'https://example.com/screenshot.png',
        fileName: 'screenshot.png',
        fileSize: 1024000,
        mimeType: 'image/png',
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v2/bounties/bounty-1/claims/claim-1/evidence',
        {
          evidenceType: EvidenceType.SCREENSHOT,
          fileUrl: 'https://example.com/screenshot.png',
          fileName: 'screenshot.png',
          fileSize: 1024000,
          mimeType: 'image/png',
        }
      );
      expect(result.evidenceType).toBe(EvidenceType.SCREENSHOT);
    });

    it('should submit video evidence', async () => {
      const mockEvidence = {
        id: 'evidence-3',
        claimId: 'claim-1',
        evidenceType: EvidenceType.VIDEO,
        fileUrl: 'https://example.com/video.mp4',
        content: 'Video proof of completion',
        submittedAt: '2024-01-01',
      };
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockEvidence });

      await bountyService.submitEvidence('bounty-1', 'claim-1', {
        evidenceType: EvidenceType.VIDEO,
        fileUrl: 'https://example.com/video.mp4',
        content: 'Video proof of completion',
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v2/bounties/bounty-1/claims/claim-1/evidence',
        {
          evidenceType: EvidenceType.VIDEO,
          fileUrl: 'https://example.com/video.mp4',
          content: 'Video proof of completion',
        }
      );
    });
  });

  describe('getClaimEvidence', () => {
    it('should fetch evidence for a claim', async () => {
      const mockEvidence = [
        {
          id: 'evidence-1',
          evidenceType: EvidenceType.TEXT,
          content: 'First piece of evidence',
          submittedAt: '2024-01-01',
        },
        {
          id: 'evidence-2',
          evidenceType: EvidenceType.SCREENSHOT,
          fileUrl: 'https://example.com/screenshot.png',
          submittedAt: '2024-01-02',
        },
      ];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockEvidence });

      const result = await bountyService.getClaimEvidence('bounty-1', 'claim-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v2/bounties/bounty-1/claims/claim-1/evidence'
      );
      expect(result).toHaveLength(2);
      expect(result[0].evidenceType).toBe(EvidenceType.TEXT);
    });

    it('should return empty array when no evidence exists', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const result = await bountyService.getClaimEvidence('bounty-1', 'claim-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('deleteEvidence', () => {
    it('should delete evidence by ID', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });

      await bountyService.deleteEvidence('bounty-1', 'claim-1', 'evidence-1');

      expect(apiClient.delete).toHaveBeenCalledWith(
        '/api/v2/bounties/bounty-1/claims/claim-1/evidence/evidence-1'
      );
    });
  });

  describe('deleteClaim (abandon)', () => {
    it('should abandon a claim', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });

      await bountyService.deleteClaim('bounty-1', 'claim-1');

      expect(apiClient.delete).toHaveBeenCalledWith('/api/v2/bounties/bounty-1/claims/claim-1', {
        data: { reason: undefined },
      });
    });

    it('should abandon a claim with reason', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: {} });

      await bountyService.deleteClaim('bounty-1', 'claim-1', 'Changed my mind');

      expect(apiClient.delete).toHaveBeenCalledWith('/api/v2/bounties/bounty-1/claims/claim-1', {
        data: { reason: 'Changed my mind' },
      });
    });
  });

  describe('updateClaim (approve/reject)', () => {
    it('should approve a claim', async () => {
      const mockClaim = {
        id: 'claim-1',
        status: BountyClaimStatus.COMPLETED,
        completedAt: '2024-01-02',
      };
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockClaim });

      const result = await bountyService.updateClaim('bounty-1', 'claim-1', {
        action: 'approve',
        notes: 'Well done!',
      });

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v2/bounties/bounty-1/claims/claim-1', {
        action: 'approve',
        notes: 'Well done!',
      });
      expect(result.status).toBe(BountyClaimStatus.COMPLETED);
    });

    it('should reject a claim', async () => {
      const mockClaim = {
        id: 'claim-1',
        status: BountyClaimStatus.REJECTED,
      };
      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockClaim });

      const result = await bountyService.updateClaim('bounty-1', 'claim-1', {
        action: 'reject',
        reason: 'Insufficient evidence',
      });

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v2/bounties/bounty-1/claims/claim-1', {
        action: 'reject',
        reason: 'Insufficient evidence',
      });
      expect(result.status).toBe(BountyClaimStatus.REJECTED);
    });
  });

  describe('error handling', () => {
    it('should handle API errors when fetching claims', async () => {
      const error = new Error('Network error');
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      await expect(bountyService.getMyClaims()).rejects.toThrow('Network error');
    });

    it('should handle API errors when submitting evidence', async () => {
      const error = new Error('Validation error');
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      await expect(
        bountyService.submitEvidence('bounty-1', 'claim-1', {
          evidenceType: EvidenceType.TEXT,
          content: 'Test',
        })
      ).rejects.toThrow('Validation error');
    });
  });
});
