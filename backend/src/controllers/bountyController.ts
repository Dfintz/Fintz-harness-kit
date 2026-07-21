import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import {
  BountyClaimService,
  CreateClaimDTO,
  SubmitEvidenceDTO,
} from '../services/bounty/BountyClaimService';
import { BountyService, CreateBountyDTO, UpdateBountyDTO } from '../services/bounty/BountyService';
import { HunterProfileService } from '../services/bounty/HunterProfileService';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';
import { parsePaginationQuery } from '../utils/pagination';

import { BaseController } from './BaseController';

/**
 * Helper function to check if user is org admin
 */
function isUserOrgAdmin(user: AuthRequest['user']): boolean {
  return user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'superadmin';
}

/**
 * Bounty Controller
 *
 * Provides /api/bounties endpoints for managing bounties and claims.
 */
export class BountyController extends BaseController {
  private bountyService: BountyService;
  private claimService: BountyClaimService;
  private hunterProfileService: HunterProfileService;

  constructor() {
    super();
    this.bountyService = new BountyService();
    this.claimService = new BountyClaimService();
    this.hunterProfileService = new HunterProfileService();
  }

  // ==================== BOUNTY CRUD OPERATIONS ====================

  /**
   * GET /api/bounties
   * List all bounties for the organization
   */
  listBounties = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const { page, limit } = parsePaginationQuery(req.query);

      const filters: Record<string, unknown> = {};

      if (req.query.bountyType) {
        filters.bountyType = req.query.bountyType;
      }

      if (req.query.status) {
        filters.status = req.query.status;
      }

      if (req.query.difficulty) {
        filters.difficulty = req.query.difficulty;
      }

      if (req.query.targetType) {
        filters.targetType = req.query.targetType;
      }

      if (req.query.createdBy) {
        filters.createdBy = req.query.createdBy;
      }

      if (req.query.claimedBy) {
        filters.claimedBy = req.query.claimedBy;
      }

      if (req.query.searchTerm) {
        filters.searchTerm = req.query.searchTerm;
      }

      if (req.query.minReward) {
        filters.minReward = parseInt(req.query.minReward as string);
      }

      if (req.query.maxReward) {
        filters.maxReward = parseInt(req.query.maxReward as string);
      }

      if (req.query.sortBy) {
        filters.sortBy = req.query.sortBy;
      }

      if (req.query.sortOrder) {
        filters.sortOrder = req.query.sortOrder;
      }

      const result = await this.bountyService.searchBounties(organizationId, filters, page, limit);

      res.json({
        data: result.bounties,
        total: result.total,
        page: result.page,
        limit,
        totalPages: result.totalPages,
      });
    });
  };

  /**
   * GET /api/bounties/:id
   * Get a specific bounty by ID
   */
  getBounty = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const bountyId = req.params.id;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const bounty = await this.bountyService.getBountyById(organizationId, bountyId);

      if (!bounty) {
        throw new NotFoundError('Bounty');
      }

      res.json({ data: bounty });
    });
  };

  /**
   * POST /api/bounties
   * Create a new bounty
   */
  createBounty = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username || 'Unknown';

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const bountyData: CreateBountyDTO = req.body;

      const bounty = await this.bountyService.createBounty(
        organizationId,
        userId,
        username,
        bountyData
      );

      res.status(201).json({ data: bounty });
    });
  };

  /**
   * PATCH /api/bounties/:id
   * Update an existing bounty
   */
  updateBounty = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username || 'Unknown';
      const bountyId = req.params.id;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const updateData: UpdateBountyDTO = req.body;
      const isAdmin = isUserOrgAdmin(req.user);

      const updatedBounty = await this.bountyService.updateBounty(
        organizationId,
        bountyId,
        userId,
        username,
        updateData,
        { isAdmin }
      );

      if (!updatedBounty) {
        throw new NotFoundError('Bounty');
      }

      res.json({ data: updatedBounty });
    });
  };

  /**
   * DELETE /api/bounties/:id
   * Delete a bounty
   */
  deleteBounty = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username || 'Unknown';
      const bountyId = req.params.id;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const bounty = await this.bountyService.getBountyById(organizationId, bountyId);

      if (!bounty) {
        throw new NotFoundError('Bounty');
      }

      // Only creator or admins can delete
      if (bounty.createdBy !== userId && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('You do not have permission to delete this bounty');
      }

      await this.bountyService.deleteBounty(organizationId, bountyId, userId, username, {
        isAdmin: isUserOrgAdmin(req.user),
      });

      res.status(204).send();
    });
  };

  // ==================== CLAIM OPERATIONS ====================

  /**
   * POST /api/bounties/:id/claim
   * Claim a bounty
   */
  claimBounty = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username || 'Unknown';
      const bountyId = req.params.id;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const bounty = await this.bountyService.getBountyById(organizationId, bountyId);

      if (!bounty) {
        throw new NotFoundError('Bounty');
      }

      // Cannot claim own bounty
      if (bounty.createdBy === userId) {
        throw new ForbiddenError('You cannot claim your own bounty');
      }

      const claimData: CreateClaimDTO = {
        bountyId,
        hunterId: userId,
        hunterName: username,
        notes: req.body.notes,
      };

      const claim = await this.claimService.createClaim(organizationId, claimData);

      res.status(201).json({ data: claim });
    });
  };

  /**
   * GET /api/bounties/:id/claims
   * Get all claims for a bounty
   */
  getBountyClaims = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const bountyId = req.params.id;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const claims = await this.claimService.getClaimsForBounty(bountyId, organizationId);

      res.json({ data: claims });
    });
  };

  /**
   * PATCH /api/bounties/:bountyId/claims/:claimId
   * Update a claim (approve/reject)
   */
  updateClaim = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username || 'Unknown';
      const claimId = req.params.claimId;
      const { action, notes, reason } = req.body;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const claim = await this.claimService.getClaimById(claimId, organizationId);

      if (!claim) {
        throw new NotFoundError('Claim');
      }

      // Get the bounty to check ownership
      const bounty = await this.bountyService.getBountyById(organizationId, claim.bountyId);

      if (!bounty) {
        throw new NotFoundError('Associated bounty');
      }

      // Only bounty creator or admins can update claims
      if (bounty.createdBy !== userId && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('You do not have permission to update this claim');
      }

      let updatedClaim;

      if (action === 'approve') {
        updatedClaim = await this.claimService.approveClaim(claimId, userId, username, notes);
      } else if (action === 'reject') {
        if (!reason) {
          throw new ValidationError('Rejection reason is required');
        }
        updatedClaim = await this.claimService.rejectClaim(claimId, userId, username, reason);
      } else {
        throw new ValidationError('Invalid action. Must be "approve" or "reject"');
      }

      res.json({ data: updatedClaim });
    });
  };

  /**
   * DELETE /api/bounties/:bountyId/claims/:claimId
   * Delete/abandon a claim
   */
  deleteClaim = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username || 'Unknown';
      const claimId = req.params.claimId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const claim = await this.claimService.getClaimById(claimId, organizationId);

      if (!claim) {
        throw new NotFoundError('Claim');
      }

      // Only claim owner or admins can delete
      if (claim.hunterId !== userId && !isUserOrgAdmin(req.user)) {
        throw new ForbiddenError('You do not have permission to delete this claim');
      }

      await this.claimService.abandonClaim(claimId, userId, username);

      res.status(204).send();
    });
  };

  /**
   * GET /api/bounties/claims/pending
   * Get pending claims for the current user (as bounty creator)
   */
  getPendingClaims = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      // TODO: Add pagination support when service layer supports it
      const claims = await this.claimService.getPendingApprovalsForCreator(organizationId, userId);

      res.json({ data: claims });
    });
  };

  /**
   * GET /api/bounties/claims/my-claims
   * Get claims by the current hunter with optional status filter and statistics
   */
  getMyClaimsWithStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const status = req.query.status as string | undefined;

      // Get claims with optional status filter
      const claims = await this.claimService.getClaimsByHunter(
        userId,
        status as unknown as Parameters<typeof this.claimService.getClaimsByHunter>[1],
        organizationId
      );

      // Get statistics
      const stats = await this.claimService.getHunterStats(userId);

      res.json({
        data: {
          claims,
          stats,
        },
      });
    });
  };

  /**
   * POST /api/bounties/:bountyId/claims/:claimId/submit
   * Submit a claim for review
   */
  submitClaim = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username || 'Unknown';
      const claimId = req.params.claimId;
      const { completionNotes } = req.body;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const claim = await this.claimService.getClaimById(claimId, organizationId);

      if (!claim) {
        throw new NotFoundError('Claim');
      }

      // Only claim owner can submit
      if (claim.hunterId !== userId) {
        throw new ForbiddenError('You can only submit your own claims');
      }

      const updatedClaim = await this.claimService.submitClaimForReview(
        claimId,
        userId,
        username,
        completionNotes
      );

      res.json({ data: updatedClaim });
    });
  };

  // ==================== EVIDENCE OPERATIONS ====================

  /**
   * POST /api/bounties/:bountyId/claims/:claimId/evidence
   * Submit evidence for a claim
   */
  submitEvidence = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const claimId = req.params.claimId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const claim = await this.claimService.getClaimById(claimId, organizationId);

      if (!claim) {
        throw new NotFoundError('Claim');
      }

      // Only claim owner can submit evidence
      if (claim.hunterId !== userId) {
        throw new ForbiddenError('You can only submit evidence for your own claims');
      }

      const evidenceData: SubmitEvidenceDTO = req.body;

      const evidence = await this.claimService.submitEvidence(claimId, userId, evidenceData);

      res.status(201).json({ data: evidence });
    });
  };

  /**
   * GET /api/bounties/:bountyId/claims/:claimId/evidence
   * Get evidence for a claim
   */
  getClaimEvidence = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const claimId = req.params.claimId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const claim = await this.claimService.getClaimById(claimId, organizationId);

      if (!claim) {
        throw new NotFoundError('Claim');
      }

      const evidence = await this.claimService.getEvidenceForClaim(claimId);

      res.json({ data: evidence });
    });
  };

  /**
   * DELETE /api/bounties/:bountyId/claims/:claimId/evidence/:evidenceId
   * Delete evidence
   */
  deleteEvidence = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const evidenceId = req.params.evidenceId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      await this.claimService.deleteEvidence(evidenceId, userId);

      res.status(204).send();
    });
  };

  // ==================== HUNTER PROFILE OPERATIONS ====================

  /**
   * GET /api/bounties/hunter/profile
   * Get or create hunter profile for the current user (or specified userId)
   */
  getHunterProfile = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const currentUserId = req.user?.id;
      const currentUserName = req.user?.username;

      if (!organizationId || !currentUserId) {
        throw new ValidationError('Organization context and authentication required');
      }

      // Allow viewing another user's profile via query param
      const targetUserId = typeof req.query.userId === 'string' ? req.query.userId : currentUserId;

      const profile = await this.hunterProfileService.getOrCreateProfile(
        organizationId,
        targetUserId,
        targetUserId === currentUserId ? currentUserName : undefined
      );

      res.json({ data: profile });
    });
  };

  /**
   * GET /api/bounties/hunter/leaderboard
   * Get hunter leaderboard for the organization
   */
  getHunterLeaderboard = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const sortBy =
        typeof req.query.sortBy === 'string'
          ? (req.query.sortBy as 'completed' | 'rewards' | 'successRate' | 'reputation')
          : 'completed';
      const { limit } = parsePaginationQuery(req.query, { page: 1, limit: 10 });

      const leaderboard = await this.hunterProfileService.getLeaderboard(
        organizationId,
        sortBy,
        limit
      );

      res.json({ data: leaderboard });
    });
  };

  /**
   * GET /api/bounties/hunter/history
   * Get bounty history for the current user (or specified userId)
   */
  getHunterHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const currentUserId = req.user?.id;

      if (!organizationId || !currentUserId) {
        throw new ValidationError('Organization context and authentication required');
      }

      const targetUserId = typeof req.query.userId === 'string' ? req.query.userId : currentUserId;
      const { page, limit } = parsePaginationQuery(req.query, { page: 1, limit: 10 });

      const result = await this.hunterProfileService.getHunterHistory(
        organizationId,
        targetUserId,
        page,
        limit
      );

      res.json({ data: result });
    });
  };

  /**
   * GET /api/bounties/hunter/analytics
   * Get hunter analytics summary for the organization
   */
  getHunterAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const analytics = await this.hunterProfileService.getAnalyticsSummary(organizationId);

      res.json({ data: analytics });
    });
  };
}
