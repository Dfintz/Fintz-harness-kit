import { apiClient } from './apiClient';
import { BaseService } from './baseService';

/**
 * Bounty Types
 */
export enum BountyType {
  KILL = 'kill',
  CAPTURE = 'capture',
  INTEL = 'intel',
  TRANSPORT = 'transport',
  RESCUE = 'rescue',
  CUSTOM = 'custom',
}

/**
 * Bounty Target Types
 */
export enum BountyTargetType {
  PLAYER = 'player',
  NPC = 'npc',
  SHIP = 'ship',
  LOCATION = 'location',
  ITEM = 'item',
  OTHER = 'other',
}

/**
 * Bounty Reward Types
 */
export enum BountyRewardType {
  CREDITS = 'credits',
  ITEM = 'item',
  REPUTATION = 'reputation',
  MIXED = 'mixed',
  OTHER = 'other',
}

/**
 * Bounty Status
 */
export enum BountyStatus {
  ACTIVE = 'active',
  CLAIMED = 'claimed',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

/**
 * Bounty Difficulty
 */
export enum BountyDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert',
}

/**
 * Bounty Visibility
 */
export enum BountyVisibility {
  PUBLIC = 'public',
  ORGANIZATION = 'organization',
  ALLIANCE = 'alliance',
  PRIVATE = 'private',
}

/**
 * Bounty Claim Status
 */
export enum BountyClaimStatus {
  ACTIVE = 'active',
  SUBMITTED = 'submitted',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  REJECTED = 'rejected',
}

/**
 * Evidence Type
 */
export enum EvidenceType {
  SCREENSHOT = 'screenshot',
  VIDEO = 'video',
  TEXT = 'text',
  LINK = 'link',
  FILE = 'file',
}

/**
 * Bounty Interface
 */
export interface Bounty {
  id: string;
  title: string;
  description?: string;
  bountyType: BountyType;
  targetType: BountyTargetType;
  targetName?: string;
  targetIdentifier?: string;
  targetDetails?: {
    lastKnownLocation?: string;
    shipType?: string;
    affiliations?: string[];
    threat_level?: string;
    notes?: string;
    imageUrl?: string;
    [key: string]: unknown;
  };
  rewardType: BountyRewardType;
  rewardAmount?: number;
  rewardDescription?: string;
  status: BountyStatus;
  difficulty?: BountyDifficulty;
  location?: string;
  systemLocation?: string;
  visibility?: BountyVisibility;
  createdBy: string;
  createdByName?: string;
  claimedBy?: string;
  claimedByName?: string;
  claimedAt?: string;
  completedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
  tags?: string[];
  metadata?: {
    evidence?: string[];
    completionNotes?: string;
    verificationNotes?: string;
    paymentReference?: string;
    [key: string]: unknown;
  };
}

/**
 * Bounty Evidence Interface
 */
export interface BountyEvidence {
  id: string;
  evidenceType: EvidenceType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  submittedAt: string;
}

/**
 * Bounty Claim Interface
 */
export interface BountyClaim {
  id: string;
  bountyId: string;
  hunterId: string;
  hunterName?: string;
  status: BountyClaimStatus;
  notes?: string;
  claimedAt: string;
  submittedAt?: string;
  completedAt?: string;
  evidence?: BountyEvidence[];
  bounty?: Bounty;
}

/**
 * Create Bounty DTO
 */
export interface CreateBountyDTO {
  title: string;
  description?: string;
  bountyType: BountyType;
  targetType: BountyTargetType;
  targetIdentifier?: string;
  targetName?: string;
  targetDetails?: {
    lastKnownLocation?: string;
    shipType?: string;
    affiliations?: string[];
    threat_level?: string;
    notes?: string;
    imageUrl?: string;
  };
  rewardType: BountyRewardType;
  rewardAmount?: number;
  rewardDescription?: string;
  difficulty?: BountyDifficulty;
  location?: string;
  systemLocation?: string;
  expiresAt?: Date | string;
  visibility?: BountyVisibility;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Update Bounty DTO
 */
export interface UpdateBountyDTO {
  title?: string;
  description?: string;
  targetIdentifier?: string;
  targetName?: string;
  targetDetails?: {
    lastKnownLocation?: string;
    shipType?: string;
    affiliations?: string[];
    threat_level?: string;
    notes?: string;
    imageUrl?: string;
  };
  rewardAmount?: number;
  rewardDescription?: string;
  difficulty?: BountyDifficulty;
  location?: string;
  systemLocation?: string;
  expiresAt?: Date | string;
  visibility?: BountyVisibility;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Bounty Search Filters
 */
export interface BountySearchFilters {
  bountyType?: BountyType;
  status?: BountyStatus;
  difficulty?: BountyDifficulty;
  visibility?: BountyVisibility;
  targetType?: BountyTargetType;
  createdBy?: string;
  claimedBy?: string;
  searchTerm?: string;
  tags?: string[];
  minReward?: number;
  maxReward?: number;
  includeExpired?: boolean;
  sortBy?: 'createdAt' | 'rewardAmount' | 'expiresAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

/**
 * Hunter Rank Enum
 */
export enum HunterRank {
  ROOKIE = 'rookie',
  APPRENTICE = 'apprentice',
  HUNTER = 'hunter',
  VETERAN = 'veteran',
  ELITE = 'elite',
  LEGENDARY = 'legendary',
}

/**
 * Hunter Profile Data
 */
export interface HunterProfileData {
  id: string;
  userId: string;
  userName?: string;
  organizationId: string;
  totalBountiesCompleted: number;
  totalBountiesClaimed: number;
  totalBountiesAbandoned: number;
  totalBountiesRejected: number;
  totalRewardsEarned: number;
  successRate: number;
  averageCompletionTimeMinutes: number;
  rank: HunterRank;
  reputationScore: number;
  killBountiesCompleted: number;
  captureBountiesCompleted: number;
  intelBountiesCompleted: number;
  transportBountiesCompleted: number;
  rescueBountiesCompleted: number;
  customBountiesCompleted: number;
  lastBountyCompletedAt?: string;
  currentStreak: number;
  longestStreak: number;
  createdAt: string;
}

/**
 * Hunter Leaderboard Entry Data
 */
export interface HunterLeaderboardEntryData {
  userId: string;
  userName?: string;
  totalBountiesCompleted: number;
  totalRewardsEarned: number;
  successRate: number;
  rank: HunterRank;
  reputationScore: number;
  primarySpecialization: string;
}

/**
 * Hunter Bounty History Entry Data
 */
export interface HunterBountyHistoryEntryData {
  bountyId: string;
  bountyTitle: string;
  bountyType: BountyType;
  status: BountyClaimStatus;
  rewardAmount?: number;
  claimedAt: string;
  completedAt?: string;
}

/**
 * Hunter History Response
 */
export interface HunterHistoryResponse {
  history: HunterBountyHistoryEntryData[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * Hunter Analytics Summary Data
 */
export interface HunterAnalyticsSummaryData {
  totalHunters: number;
  activeHunters: number;
  totalBountiesCompleted: number;
  totalRewardsPaid: number;
  averageSuccessRate: number;
  topHunters: HunterLeaderboardEntryData[];
  bountyTypeBreakdown: Record<string, number>;
}

/**
 * Bounty Search Result
 */
export interface BountySearchResult {
  data: Bounty[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Claim Bounty Request
 */
export interface ClaimBountyRequest {
  notes?: string;
}

/**
 * Update Claim Request
 */
export interface UpdateClaimRequest {
  action: 'approve' | 'reject';
  notes?: string;
  reason?: string;
}

/**
 * Submit Claim Request
 */
export interface SubmitClaimRequest {
  completionNotes?: string;
}

/**
 * Submit Evidence Request
 */
export interface SubmitEvidenceRequest {
  evidenceType: EvidenceType;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

/**
 * Claim Statistics
 */
export interface ClaimStats {
  totalClaims: number;
  activeClaims: number;
  completedClaims: number;
  abandonedClaims: number;
  rejectedClaims: number;
}

/**
 * My Claims Response
 */
export interface MyClaimsResponse {
  claims: BountyClaim[];
  stats: ClaimStats;
}

/**
 * Bounty Service
 *
 * Provides API methods for managing bounties and claims.
 */
export class BountyService extends BaseService {
  protected basePath = '/api/v2/bounties';

  // ==================== HUNTER PROFILE OPERATIONS ====================

  /**
   * Get or create hunter profile
   */
  async getHunterProfile(userId?: string): Promise<HunterProfileData> {
    try {
      this.log('getHunterProfile', { userId });
      const queryString = userId ? this.buildQueryString({ userId }) : '';
      const response = await apiClient.get<HunterProfileData>(
        `${this.basePath}/hunter/profile${queryString}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getHunterProfile');
    }
  }

  /**
   * Get hunter leaderboard
   */
  async getHunterLeaderboard(
    sortBy?: 'completed' | 'rewards' | 'successRate' | 'reputation',
    limit?: number
  ): Promise<HunterLeaderboardEntryData[]> {
    try {
      this.log('getHunterLeaderboard', { sortBy, limit });
      const queryString = this.buildQueryString({
        sortBy,
        limit,
      } as Record<string, unknown>);
      const response = await apiClient.get<HunterLeaderboardEntryData[]>(
        `${this.basePath}/hunter/leaderboard${queryString}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getHunterLeaderboard');
    }
  }

  /**
   * Get hunter bounty history
   */
  async getHunterHistory(
    userId?: string,
    page?: number,
    limit?: number
  ): Promise<HunterHistoryResponse> {
    try {
      this.log('getHunterHistory', { userId, page, limit });
      const queryString = this.buildQueryString({
        userId,
        page,
        limit,
      } as Record<string, unknown>);
      const response = await apiClient.get<HunterHistoryResponse>(
        `${this.basePath}/hunter/history${queryString}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getHunterHistory');
    }
  }

  /**
   * Get hunter analytics summary
   */
  async getHunterAnalytics(): Promise<HunterAnalyticsSummaryData> {
    try {
      this.log('getHunterAnalytics');
      const response = await apiClient.get<HunterAnalyticsSummaryData>(
        `${this.basePath}/hunter/analytics`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getHunterAnalytics');
    }
  }

  // ==================== BOUNTY OPERATIONS ====================

  /**
   * Search bounties with filters
   */
  async searchBounties(filters?: BountySearchFilters): Promise<BountySearchResult> {
    try {
      this.log('searchBounties', filters);
      const queryString = this.buildQueryString(filters as Record<string, unknown> | undefined);
      const response = await apiClient.get<BountySearchResult>(`${this.basePath}${queryString}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'searchBounties');
    }
  }

  /**
   * Get a specific bounty by ID
   */
  async getBountyById(id: string): Promise<Bounty> {
    try {
      this.log('getBountyById', id);
      const response = await apiClient.get<Bounty>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getBountyById');
    }
  }

  /**
   * Create a new bounty
   */
  async createBounty(data: CreateBountyDTO): Promise<Bounty> {
    try {
      this.log('createBounty', data);
      const response = await apiClient.post<Bounty>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createBounty');
    }
  }

  /**
   * Update an existing bounty
   */
  async updateBounty(id: string, data: UpdateBountyDTO): Promise<Bounty> {
    try {
      this.log('updateBounty', { id, data });
      const response = await apiClient.patch<Bounty>(`${this.basePath}/${id}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateBounty');
    }
  }

  /**
   * Delete a bounty
   */
  async deleteBounty(id: string): Promise<void> {
    try {
      this.log('deleteBounty', id);
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteBounty');
    }
  }

  /**
   * Claim a bounty
   */
  async claimBounty(id: string, data?: ClaimBountyRequest): Promise<BountyClaim> {
    try {
      this.log('claimBounty', { id, data });
      const response = await apiClient.post<BountyClaim>(
        `${this.basePath}/${id}/claim`,
        data || {}
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'claimBounty');
    }
  }

  /**
   * Get all claims for a bounty
   */
  async getBountyClaims(bountyId: string): Promise<BountyClaim[]> {
    try {
      this.log('getBountyClaims', bountyId);
      const response = await apiClient.get<BountyClaim[]>(`${this.basePath}/${bountyId}/claims`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getBountyClaims');
    }
  }

  /**
   * Update a claim (approve/reject)
   */
  async updateClaim(
    bountyId: string,
    claimId: string,
    data: UpdateClaimRequest
  ): Promise<BountyClaim> {
    try {
      this.log('updateClaim', { bountyId, claimId, data });
      const response = await apiClient.patch<BountyClaim>(
        `${this.basePath}/${bountyId}/claims/${claimId}`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateClaim');
    }
  }

  /**
   * Delete/abandon a claim
   */
  async deleteClaim(bountyId: string, claimId: string, reason?: string): Promise<void> {
    try {
      this.log('deleteClaim', { bountyId, claimId, reason });
      await apiClient.delete(`${this.basePath}/${bountyId}/claims/${claimId}`, {
        data: { reason },
      });
    } catch (error) {
      this.handleError(error, 'deleteClaim');
    }
  }

  /**
   * Get pending claims for the current user (as bounty creator)
   */
  async getPendingClaims(page = 1, limit = 20): Promise<BountyClaim[]> {
    try {
      this.log('getPendingClaims', { page, limit });
      const queryString = this.buildQueryString({ page, limit });
      const response = await apiClient.get<BountyClaim[]>(
        `${this.basePath}/claims/pending${queryString}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getPendingClaims');
    }
  }

  /**
   * Get my claims (as hunter) with optional status filter and statistics
   */
  async getMyClaims(status?: BountyClaimStatus): Promise<MyClaimsResponse> {
    try {
      this.log('getMyClaims', { status });
      const queryString = status ? this.buildQueryString({ status }) : '';
      const response = await apiClient.get<MyClaimsResponse>(
        `${this.basePath}/claims/my-claims${queryString}`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getMyClaims');
    }
  }

  /**
   * Submit a claim for review
   */
  async submitClaim(
    bountyId: string,
    claimId: string,
    data?: SubmitClaimRequest
  ): Promise<BountyClaim> {
    try {
      this.log('submitClaim', { bountyId, claimId, data });
      const response = await apiClient.post<BountyClaim>(
        `${this.basePath}/${bountyId}/claims/${claimId}/submit`,
        data || {}
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'submitClaim');
    }
  }

  /**
   * Submit evidence for a claim
   */
  async submitEvidence(
    bountyId: string,
    claimId: string,
    data: SubmitEvidenceRequest
  ): Promise<BountyEvidence> {
    try {
      this.log('submitEvidence', { bountyId, claimId, data });
      const response = await apiClient.post<BountyEvidence>(
        `${this.basePath}/${bountyId}/claims/${claimId}/evidence`,
        data
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'submitEvidence');
    }
  }

  /**
   * Get evidence for a claim
   */
  async getClaimEvidence(bountyId: string, claimId: string): Promise<BountyEvidence[]> {
    try {
      this.log('getClaimEvidence', { bountyId, claimId });
      const response = await apiClient.get<BountyEvidence[]>(
        `${this.basePath}/${bountyId}/claims/${claimId}/evidence`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getClaimEvidence');
    }
  }

  /**
   * Delete evidence
   */
  async deleteEvidence(bountyId: string, claimId: string, evidenceId: string): Promise<void> {
    try {
      this.log('deleteEvidence', { bountyId, claimId, evidenceId });
      await apiClient.delete(
        `${this.basePath}/${bountyId}/claims/${claimId}/evidence/${evidenceId}`
      );
    } catch (error) {
      this.handleError(error, 'deleteEvidence');
    }
  }
}

// Create singleton instance
export const bountyService = new BountyService();
