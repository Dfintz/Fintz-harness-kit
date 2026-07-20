"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BountyController = void 0;
const BountyClaimService_1 = require("../services/bounty/BountyClaimService");
const BountyService_1 = require("../services/bounty/BountyService");
const HunterProfileService_1 = require("../services/bounty/HunterProfileService");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
function isUserOrgAdmin(user) {
    return user?.role === 'admin' || user?.role === 'org_admin' || user?.role === 'superadmin';
}
class BountyController extends BaseController_1.BaseController {
    bountyService;
    claimService;
    hunterProfileService;
    constructor() {
        super();
        this.bountyService = new BountyService_1.BountyService();
        this.claimService = new BountyClaimService_1.BountyClaimService();
        this.hunterProfileService = new HunterProfileService_1.HunterProfileService();
    }
    listBounties = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { page, limit } = (0, pagination_1.parsePaginationQuery)(req.query);
            const filters = {};
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
                filters.minReward = parseInt(req.query.minReward);
            }
            if (req.query.maxReward) {
                filters.maxReward = parseInt(req.query.maxReward);
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
    getBounty = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const bountyId = req.params.id;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const bounty = await this.bountyService.getBountyById(organizationId, bountyId);
            if (!bounty) {
                throw new apiErrors_1.NotFoundError('Bounty');
            }
            res.json({ data: bounty });
        });
    };
    createBounty = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username || 'Unknown';
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const bountyData = req.body;
            const bounty = await this.bountyService.createBounty(organizationId, userId, username, bountyData);
            res.status(201).json({ data: bounty });
        });
    };
    updateBounty = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username || 'Unknown';
            const bountyId = req.params.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const updateData = req.body;
            const isAdmin = isUserOrgAdmin(req.user);
            const updatedBounty = await this.bountyService.updateBounty(organizationId, bountyId, userId, username, updateData, { isAdmin });
            if (!updatedBounty) {
                throw new apiErrors_1.NotFoundError('Bounty');
            }
            res.json({ data: updatedBounty });
        });
    };
    deleteBounty = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username || 'Unknown';
            const bountyId = req.params.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const bounty = await this.bountyService.getBountyById(organizationId, bountyId);
            if (!bounty) {
                throw new apiErrors_1.NotFoundError('Bounty');
            }
            if (bounty.createdBy !== userId && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('You do not have permission to delete this bounty');
            }
            await this.bountyService.deleteBounty(organizationId, bountyId, userId, username, {
                isAdmin: isUserOrgAdmin(req.user),
            });
            res.status(204).send();
        });
    };
    claimBounty = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username || 'Unknown';
            const bountyId = req.params.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const bounty = await this.bountyService.getBountyById(organizationId, bountyId);
            if (!bounty) {
                throw new apiErrors_1.NotFoundError('Bounty');
            }
            if (bounty.createdBy === userId) {
                throw new apiErrors_1.ForbiddenError('You cannot claim your own bounty');
            }
            const claimData = {
                bountyId,
                hunterId: userId,
                hunterName: username,
                notes: req.body.notes,
            };
            const claim = await this.claimService.createClaim(organizationId, claimData);
            res.status(201).json({ data: claim });
        });
    };
    getBountyClaims = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const bountyId = req.params.id;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const claims = await this.claimService.getClaimsForBounty(bountyId, organizationId);
            res.json({ data: claims });
        });
    };
    updateClaim = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username || 'Unknown';
            const claimId = req.params.claimId;
            const { action, notes, reason } = req.body;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const claim = await this.claimService.getClaimById(claimId, organizationId);
            if (!claim) {
                throw new apiErrors_1.NotFoundError('Claim');
            }
            const bounty = await this.bountyService.getBountyById(organizationId, claim.bountyId);
            if (!bounty) {
                throw new apiErrors_1.NotFoundError('Associated bounty');
            }
            if (bounty.createdBy !== userId && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('You do not have permission to update this claim');
            }
            let updatedClaim;
            if (action === 'approve') {
                updatedClaim = await this.claimService.approveClaim(claimId, userId, username, notes);
            }
            else if (action === 'reject') {
                if (!reason) {
                    throw new apiErrors_1.ValidationError('Rejection reason is required');
                }
                updatedClaim = await this.claimService.rejectClaim(claimId, userId, username, reason);
            }
            else {
                throw new apiErrors_1.ValidationError('Invalid action. Must be "approve" or "reject"');
            }
            res.json({ data: updatedClaim });
        });
    };
    deleteClaim = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username || 'Unknown';
            const claimId = req.params.claimId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const claim = await this.claimService.getClaimById(claimId, organizationId);
            if (!claim) {
                throw new apiErrors_1.NotFoundError('Claim');
            }
            if (claim.hunterId !== userId && !isUserOrgAdmin(req.user)) {
                throw new apiErrors_1.ForbiddenError('You do not have permission to delete this claim');
            }
            await this.claimService.abandonClaim(claimId, userId, username);
            res.status(204).send();
        });
    };
    getPendingClaims = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const claims = await this.claimService.getPendingApprovalsForCreator(organizationId, userId);
            res.json({ data: claims });
        });
    };
    getMyClaimsWithStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const status = req.query.status;
            const claims = await this.claimService.getClaimsByHunter(userId, status, organizationId);
            const stats = await this.claimService.getHunterStats(userId);
            res.json({
                data: {
                    claims,
                    stats,
                },
            });
        });
    };
    submitClaim = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username || 'Unknown';
            const claimId = req.params.claimId;
            const { completionNotes } = req.body;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const claim = await this.claimService.getClaimById(claimId, organizationId);
            if (!claim) {
                throw new apiErrors_1.NotFoundError('Claim');
            }
            if (claim.hunterId !== userId) {
                throw new apiErrors_1.ForbiddenError('You can only submit your own claims');
            }
            const updatedClaim = await this.claimService.submitClaimForReview(claimId, userId, username, completionNotes);
            res.json({ data: updatedClaim });
        });
    };
    submitEvidence = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const claimId = req.params.claimId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const claim = await this.claimService.getClaimById(claimId, organizationId);
            if (!claim) {
                throw new apiErrors_1.NotFoundError('Claim');
            }
            if (claim.hunterId !== userId) {
                throw new apiErrors_1.ForbiddenError('You can only submit evidence for your own claims');
            }
            const evidenceData = req.body;
            const evidence = await this.claimService.submitEvidence(claimId, userId, evidenceData);
            res.status(201).json({ data: evidence });
        });
    };
    getClaimEvidence = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const claimId = req.params.claimId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const claim = await this.claimService.getClaimById(claimId, organizationId);
            if (!claim) {
                throw new apiErrors_1.NotFoundError('Claim');
            }
            const evidence = await this.claimService.getEvidenceForClaim(claimId);
            res.json({ data: evidence });
        });
    };
    deleteEvidence = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const evidenceId = req.params.evidenceId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            await this.claimService.deleteEvidence(evidenceId, userId);
            res.status(204).send();
        });
    };
    getHunterProfile = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const currentUserId = req.user?.id;
            const currentUserName = req.user?.username;
            if (!organizationId || !currentUserId) {
                throw new apiErrors_1.ValidationError('Organization context and authentication required');
            }
            const targetUserId = typeof req.query.userId === 'string' ? req.query.userId : currentUserId;
            const profile = await this.hunterProfileService.getOrCreateProfile(organizationId, targetUserId, targetUserId === currentUserId ? currentUserName : undefined);
            res.json({ data: profile });
        });
    };
    getHunterLeaderboard = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const sortBy = typeof req.query.sortBy === 'string'
                ? req.query.sortBy
                : 'completed';
            const { limit } = (0, pagination_1.parsePaginationQuery)(req.query, { page: 1, limit: 10 });
            const leaderboard = await this.hunterProfileService.getLeaderboard(organizationId, sortBy, limit);
            res.json({ data: leaderboard });
        });
    };
    getHunterHistory = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const currentUserId = req.user?.id;
            if (!organizationId || !currentUserId) {
                throw new apiErrors_1.ValidationError('Organization context and authentication required');
            }
            const targetUserId = typeof req.query.userId === 'string' ? req.query.userId : currentUserId;
            const { page, limit } = (0, pagination_1.parsePaginationQuery)(req.query, { page: 1, limit: 10 });
            const result = await this.hunterProfileService.getHunterHistory(organizationId, targetUserId, page, limit);
            res.json({ data: result });
        });
    };
    getHunterAnalytics = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const analytics = await this.hunterProfileService.getAnalyticsSummary(organizationId);
            res.json({ data: analytics });
        });
    };
}
exports.BountyController = BountyController;
//# sourceMappingURL=bountyController.js.map