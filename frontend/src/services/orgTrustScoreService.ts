import { apiClient } from './apiClient';
import { BaseService } from './baseService';

/**
 * Category averages for reputation breakdown
 */
export interface CategoryAverages {
  communication: number;
  teamwork: number;
  skill: number;
  reliability: number;
  leadership: number;
}

/**
 * Breakdown of an org's trust score components
 */
export interface OrgTrustScoreBreakdown {
  verifiedMemberRate: number;
  verifiedMemberCount: number;
  totalMembers: number;
  avgMemberReputation: number;
  categoryAverages: CategoryAverages;
  orgRsiVerified: boolean;
  avgRelationshipTrust: number;
  activeRelationships: number;
}

/**
 * Full org trust score response
 */
export interface OrgTrustScore {
  organizationId: string;
  score: number;
  tier: string;
  breakdown: OrgTrustScoreBreakdown;
  computedAt: string;
}

class OrgTrustScoreService extends BaseService {
  protected basePath = '/api/v2/organizations';

  async getTrustScore(organizationId: string): Promise<OrgTrustScore> {
    try {
      this.log('getTrustScore', { organizationId });
      const response = await apiClient.get<OrgTrustScore>(
        `${this.basePath}/${encodeURIComponent(organizationId)}/trust-score`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getTrustScore');
    }
  }
}

export const orgTrustScoreService = new OrgTrustScoreService();
