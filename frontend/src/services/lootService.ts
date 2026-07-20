import type {
  LootClaimType,
  LootDistributionMethod,
  LootDistributionResult,
  LootItem,
  LootItemCategory,
  LootOcrResult,
  LootPool,
  LootPoolDetail,
  LootPoolRules,
  LootPoolStatus,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService, unwrapArrayResponse, unwrapResponse } from './baseService';

// ==================== Input shapes ====================

export interface CreateLootPoolInput {
  name: string;
  description?: string;
  activityId: string;
  missionId?: string;
  lfgSessionId?: string;
  distributionMethod?: LootDistributionMethod;
  rules?: LootPoolRules;
  assistantUserIds?: string[];
  currency?: string;
}

export interface UpdateLootPoolInput {
  name?: string;
  description?: string;
  distributionMethod?: LootDistributionMethod;
  rules?: LootPoolRules;
  assistantUserIds?: string[];
}

export interface LootItemInput {
  name: string;
  category?: LootItemCategory;
  quantity?: number;
  unitValue?: number;
  imageUrl?: string;
  source?: 'manual' | 'ocr';
}

export interface ClaimInput {
  claimType: LootClaimType;
  bidAmount?: number;
}

export interface LootPoolQueryParams {
  page?: number;
  limit?: number;
  activityId?: string;
  status?: LootPoolStatus;
}

export interface EligibleParticipant {
  userId: string;
  userName: string;
  role: string;
}

/**
 * Loot Service
 * Handles all commissary loot distribution API calls.
 */
class LootService extends BaseService {
  protected basePath = '/api/v2/loot';

  // ==================== Pools ====================

  async listPools(params?: LootPoolQueryParams): Promise<LootPool[]> {
    try {
      this.log('listPools', params);
      const response = await apiClient.get(`${this.basePath}/pools`, { params });
      return unwrapArrayResponse<LootPool>(response.data);
    } catch (error) {
      this.handleError(error, 'listPools');
    }
  }

  async getPool(poolId: string): Promise<LootPoolDetail> {
    try {
      this.log('getPool', { poolId });
      const response = await apiClient.get(`${this.basePath}/pools/${poolId}`);
      return unwrapResponse<LootPoolDetail>(response.data);
    } catch (error) {
      this.handleError(error, 'getPool');
    }
  }

  async createPool(data: CreateLootPoolInput): Promise<LootPool> {
    try {
      this.log('createPool', data);
      const response = await apiClient.post(`${this.basePath}/pools`, data);
      return unwrapResponse<LootPool>(response.data);
    } catch (error) {
      this.handleError(error, 'createPool');
    }
  }

  async updatePool(poolId: string, data: UpdateLootPoolInput): Promise<LootPool> {
    try {
      this.log('updatePool', { poolId, data });
      const response = await apiClient.patch(`${this.basePath}/pools/${poolId}`, data);
      return unwrapResponse<LootPool>(response.data);
    } catch (error) {
      this.handleError(error, 'updatePool');
    }
  }

  async lockPool(poolId: string): Promise<LootPool> {
    try {
      this.log('lockPool', { poolId });
      const response = await apiClient.post(`${this.basePath}/pools/${poolId}/lock`, {});
      return unwrapResponse<LootPool>(response.data);
    } catch (error) {
      this.handleError(error, 'lockPool');
    }
  }

  async cancelPool(poolId: string): Promise<LootPool> {
    try {
      this.log('cancelPool', { poolId });
      const response = await apiClient.post(`${this.basePath}/pools/${poolId}/cancel`, {});
      return unwrapResponse<LootPool>(response.data);
    } catch (error) {
      this.handleError(error, 'cancelPool');
    }
  }

  async distributePool(poolId: string): Promise<LootDistributionResult> {
    try {
      this.log('distributePool', { poolId });
      const response = await apiClient.post(`${this.basePath}/pools/${poolId}/distribute`, {});
      return unwrapResponse<LootDistributionResult>(response.data);
    } catch (error) {
      this.handleError(error, 'distributePool');
    }
  }

  async retryDistribution(poolId: string): Promise<LootDistributionResult> {
    try {
      this.log('retryDistribution', { poolId });
      const response = await apiClient.post(
        `${this.basePath}/pools/${poolId}/retry-distribution`,
        {}
      );
      return unwrapResponse<LootDistributionResult>(response.data);
    } catch (error) {
      this.handleError(error, 'retryDistribution');
    }
  }

  async getEligibleParticipants(poolId: string): Promise<EligibleParticipant[]> {
    try {
      this.log('getEligibleParticipants', { poolId });
      const response = await apiClient.get(`${this.basePath}/pools/${poolId}/participants`);
      return unwrapArrayResponse<EligibleParticipant>(response.data);
    } catch (error) {
      this.handleError(error, 'getEligibleParticipants');
    }
  }

  // ==================== Items ====================

  async addItem(poolId: string, data: LootItemInput): Promise<LootItem> {
    try {
      this.log('addItem', { poolId, data });
      const response = await apiClient.post(`${this.basePath}/pools/${poolId}/items`, data);
      return unwrapResponse<LootItem>(response.data);
    } catch (error) {
      this.handleError(error, 'addItem');
    }
  }

  async addItemsBulk(poolId: string, items: LootItemInput[]): Promise<LootItem[]> {
    try {
      this.log('addItemsBulk', { poolId, count: items.length });
      const response = await apiClient.post(`${this.basePath}/pools/${poolId}/items/bulk`, {
        items,
      });
      return unwrapArrayResponse<LootItem>(response.data);
    } catch (error) {
      this.handleError(error, 'addItemsBulk');
    }
  }

  async updateItem(
    poolId: string,
    itemId: string,
    data: Partial<LootItemInput>
  ): Promise<LootItem> {
    try {
      this.log('updateItem', { poolId, itemId, data });
      const response = await apiClient.patch(
        `${this.basePath}/pools/${poolId}/items/${itemId}`,
        data
      );
      return unwrapResponse<LootItem>(response.data);
    } catch (error) {
      this.handleError(error, 'updateItem');
    }
  }

  async removeItem(poolId: string, itemId: string): Promise<void> {
    try {
      this.log('removeItem', { poolId, itemId });
      await apiClient.delete(`${this.basePath}/pools/${poolId}/items/${itemId}`);
    } catch (error) {
      this.handleError(error, 'removeItem');
    }
  }

  async assignItem(poolId: string, itemId: string, userId: string): Promise<LootItem> {
    try {
      this.log('assignItem', { poolId, itemId, userId });
      const response = await apiClient.post(
        `${this.basePath}/pools/${poolId}/items/${itemId}/assign`,
        { userId }
      );
      return unwrapResponse<LootItem>(response.data);
    } catch (error) {
      this.handleError(error, 'assignItem');
    }
  }

  // ==================== Claims ====================

  async claimItem(poolId: string, itemId: string, data: ClaimInput): Promise<void> {
    try {
      this.log('claimItem', { poolId, itemId, data });
      await apiClient.post(`${this.basePath}/pools/${poolId}/items/${itemId}/claim`, data);
    } catch (error) {
      this.handleError(error, 'claimItem');
    }
  }

  async withdrawClaim(poolId: string, itemId: string): Promise<void> {
    try {
      this.log('withdrawClaim', { poolId, itemId });
      await apiClient.delete(`${this.basePath}/pools/${poolId}/items/${itemId}/claim`);
    } catch (error) {
      this.handleError(error, 'withdrawClaim');
    }
  }

  // ==================== OCR ====================

  async scanImage(file: File): Promise<LootOcrResult> {
    try {
      this.log('scanImage', { name: file.name });
      const form = new FormData();
      form.append('image', file);
      const response = await apiClient.post(`${this.basePath}/ocr/scan`, form);
      return unwrapResponse<LootOcrResult>(response.data);
    } catch (error) {
      this.handleError(error, 'scanImage');
    }
  }

  async scanPoolImage(poolId: string, file: File): Promise<LootOcrResult> {
    try {
      this.log('scanPoolImage', { poolId, name: file.name });
      const form = new FormData();
      form.append('image', file);
      const response = await apiClient.post(`${this.basePath}/pools/${poolId}/ocr/scan`, form);
      return unwrapResponse<LootOcrResult>(response.data);
    } catch (error) {
      this.handleError(error, 'scanPoolImage');
    }
  }
}

export const lootService = new LootService();
