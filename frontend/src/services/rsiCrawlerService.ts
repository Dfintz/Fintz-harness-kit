/**
 * RSI Crawler Service
 *
 * API client for fetching RSI organization and member data from the crawler cache.
 */
import { apiClient } from './apiClient';
import { BaseService } from './baseService';

export interface RsiCrawledOrg {
  sid: string;
  name: string;
  archetype?: string;
  memberCount: number;
  affiliateCount: number;
  commitment?: string;
  roleplay?: string;
  language?: string;
  recruiting?: string;
  focus?: { primary?: string; secondary?: string };
  links?: { website?: string; discord?: string; youtube?: string; twitch?: string };
  logo?: string;
  lastCrawledAt?: string;
}

export interface MemberCountDataPoint {
  date: string;
  memberCount: number;
}

class RsiCrawlerService extends BaseService {
  protected basePath = '/api/v2/rsi-crawler';

  async getOrganization(sid: string): Promise<RsiCrawledOrg> {
    try {
      this.log('getOrganization', { sid });
      const response = await apiClient.get<RsiCrawledOrg>(
        `${this.basePath}/organizations/${encodeURIComponent(sid)}`
      );
      return (response.data ?? response) as unknown as RsiCrawledOrg;
    } catch (error) {
      return this.handleError(error, 'getOrganization');
    }
  }

  async getMemberCountHistory(sid: string): Promise<MemberCountDataPoint[]> {
    try {
      this.log('getMemberCountHistory', { sid });
      const response = await apiClient.get<{ data: MemberCountDataPoint[] }>(
        `${this.basePath}/organizations/${encodeURIComponent(sid)}/member-count-history`
      );
      return (response as unknown as { data: MemberCountDataPoint[] }).data ?? [];
    } catch (error) {
      return this.handleError(error, 'getMemberCountHistory');
    }
  }
}

export const rsiCrawlerService = new RsiCrawlerService();
