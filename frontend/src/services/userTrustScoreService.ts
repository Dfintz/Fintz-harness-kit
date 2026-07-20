/**
 * User Trust Score Service
 * Fetches unified reputation/trust score for a user
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

export interface UnifiedReputationScore {
  userId: string;
  userReputation: {
    overallScore: number;
    tier: string;
    totalSessions: number;
    successRate: number;
    averageRating: number;
  };
  organizationTrust?: {
    organizationId: string;
    trustScore: number;
    trustLevel: string;
    interactionCount: number;
    sentiment: string;
  }[];
  combinedScore: number;
  reliability: string;
}

class UserTrustScoreService extends BaseService {
  protected basePath = '/api/v2/reputation';

  async getUnifiedScore(userId: string, organizationId?: string): Promise<UnifiedReputationScore> {
    try {
      this.log('getUnifiedScore', { userId });
      const params = organizationId ? { organizationId } : undefined;
      const response = await apiClient.get<UnifiedReputationScore>(
        `${this.basePath}/${userId}/unified`,
        { params }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getUnifiedScore');
    }
  }
}

export const userTrustScoreService = new UserTrustScoreService();
