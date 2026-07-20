import type {
  CommissaryItem,
  CommissaryPurchase,
  CommissaryQueryParams,
  CreateCommissaryItemInput,
  CreateDuesInput,
  CreditPool,
  CreditTransaction,
  DuesQueryParams,
  EarnCreditsInput,
  LeaderboardEntry,
  OrgDues,
  PurchaseInput,
  PurchaseQueryParams,
  SpendCreditsInput,
  TransactionQueryParams,
  TransferCreditsInput,
  TreasuryPeriod,
  TreasuryStatistics,
  UpdateCommissaryItemInput,
  UpdateDuesInput,
} from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, unwrapArrayResponse, unwrapResponse } from './baseService';

/**
 * Treasury Service
 * Handles all treasury, dues, and commissary API calls.
 */
class TreasuryService extends BaseService {
  protected basePath = '/api/v2/credits';

  // ============================================================================
  // Credit Pool
  // ============================================================================

  async getBalance(): Promise<CreditPool> {
    try {
      this.log('getBalance');
      const response = await apiClient.get(`${this.basePath}/balance`);
      return unwrapResponse<CreditPool>(response.data);
    } catch (error) {
      this.handleError(error, 'getBalance');
    }
  }

  async getTransactions(
    params?: TransactionQueryParams
  ): Promise<{ items: CreditTransaction[]; total: number }> {
    try {
      this.log('getTransactions', params);
      const response = await apiClient.get(`${this.basePath}/transactions`, { params });
      const data = response.data as Record<string, unknown>;
      return {
        items: unwrapArrayResponse<CreditTransaction>(data),
        total: ((data?.pagination as Record<string, unknown>)?.total as number) ?? 0,
      };
    } catch (error) {
      this.handleError(error, 'getTransactions');
    }
  }

  async getStatistics(period?: TreasuryPeriod): Promise<TreasuryStatistics> {
    try {
      this.log('getStatistics', { period });
      const params = period ? { period } : undefined;
      const response = await apiClient.get(`${this.basePath}/statistics`, { params });
      return unwrapResponse<TreasuryStatistics>(response.data);
    } catch (error) {
      this.handleError(error, 'getStatistics');
    }
  }

  async getLeaderboard(limit?: number): Promise<LeaderboardEntry[]> {
    try {
      this.log('getLeaderboard', { limit });
      const params = limit ? { limit } : undefined;
      const response = await apiClient.get(`${this.basePath}/leaderboard`, { params });
      return unwrapArrayResponse<LeaderboardEntry>(response.data);
    } catch (error) {
      this.handleError(error, 'getLeaderboard');
    }
  }

  // ============================================================================
  // Credit Operations
  // ============================================================================

  async earnCredits(data: EarnCreditsInput): Promise<CreditTransaction> {
    try {
      this.log('earnCredits', data);
      const response = await apiClient.post(`${this.basePath}/earn`, data);
      return unwrapResponse<CreditTransaction>(response.data);
    } catch (error) {
      this.handleError(error, 'earnCredits');
    }
  }

  async spendCredits(data: SpendCreditsInput): Promise<CreditTransaction> {
    try {
      this.log('spendCredits', data);
      const response = await apiClient.post(`${this.basePath}/spend`, data);
      return unwrapResponse<CreditTransaction>(response.data);
    } catch (error) {
      this.handleError(error, 'spendCredits');
    }
  }

  async transferCredits(data: TransferCreditsInput): Promise<CreditTransaction> {
    try {
      this.log('transferCredits', data);
      const response = await apiClient.post(`${this.basePath}/transfer`, data);
      return unwrapResponse<CreditTransaction>(response.data);
    } catch (error) {
      this.handleError(error, 'transferCredits');
    }
  }

  // ============================================================================
  // Dues
  // ============================================================================

  async getDues(params?: DuesQueryParams): Promise<OrgDues[]> {
    try {
      this.log('getDues', params);
      const response = await apiClient.get(`${this.basePath}/dues`, { params });
      return unwrapArrayResponse<OrgDues>(response.data);
    } catch (error) {
      this.handleError(error, 'getDues');
    }
  }

  async createDues(data: CreateDuesInput): Promise<OrgDues> {
    try {
      this.log('createDues', data);
      const response = await apiClient.post(`${this.basePath}/dues`, data);
      return unwrapResponse<OrgDues>(response.data);
    } catch (error) {
      this.handleError(error, 'createDues');
    }
  }

  async updateDues(id: string, data: UpdateDuesInput): Promise<OrgDues> {
    try {
      this.log('updateDues', { id, data });
      const response = await apiClient.put(`${this.basePath}/dues/${id}`, data);
      return unwrapResponse<OrgDues>(response.data);
    } catch (error) {
      this.handleError(error, 'updateDues');
    }
  }

  async collectDues(id: string): Promise<void> {
    try {
      this.log('collectDues', { id });
      await apiClient.post(`${this.basePath}/dues/${id}/collect`);
    } catch (error) {
      this.handleError(error, 'collectDues');
    }
  }

  // ============================================================================
  // Commissary
  // ============================================================================

  async getCommissaryItems(params?: CommissaryQueryParams): Promise<CommissaryItem[]> {
    try {
      this.log('getCommissaryItems', params);
      const response = await apiClient.get(`${this.basePath}/commissary`, { params });
      return unwrapArrayResponse<CommissaryItem>(response.data);
    } catch (error) {
      this.handleError(error, 'getCommissaryItems');
    }
  }

  async createCommissaryItem(data: CreateCommissaryItemInput): Promise<CommissaryItem> {
    try {
      this.log('createCommissaryItem', data);
      const response = await apiClient.post(`${this.basePath}/commissary`, data);
      return unwrapResponse<CommissaryItem>(response.data);
    } catch (error) {
      this.handleError(error, 'createCommissaryItem');
    }
  }

  async updateCommissaryItem(id: string, data: UpdateCommissaryItemInput): Promise<CommissaryItem> {
    try {
      this.log('updateCommissaryItem', { id, data });
      const response = await apiClient.put(`${this.basePath}/commissary/${id}`, data);
      return unwrapResponse<CommissaryItem>(response.data);
    } catch (error) {
      this.handleError(error, 'updateCommissaryItem');
    }
  }

  async deleteCommissaryItem(id: string): Promise<void> {
    try {
      this.log('deleteCommissaryItem', { id });
      await apiClient.delete(`${this.basePath}/commissary/${id}`);
    } catch (error) {
      this.handleError(error, 'deleteCommissaryItem');
    }
  }

  async purchaseItem(id: string, data: PurchaseInput): Promise<CommissaryPurchase> {
    try {
      this.log('purchaseItem', { id, data });
      const response = await apiClient.post(`${this.basePath}/commissary/${id}/purchase`, data);
      return unwrapResponse<CommissaryPurchase>(response.data);
    } catch (error) {
      this.handleError(error, 'purchaseItem');
    }
  }

  async getPurchaseHistory(params?: PurchaseQueryParams): Promise<CommissaryPurchase[]> {
    try {
      this.log('getPurchaseHistory', params);
      const response = await apiClient.get(`${this.basePath}/commissary/purchases`, { params });
      return unwrapArrayResponse<CommissaryPurchase>(response.data);
    } catch (error) {
      this.handleError(error, 'getPurchaseHistory');
    }
  }
}

export const treasuryService = new TreasuryService();
