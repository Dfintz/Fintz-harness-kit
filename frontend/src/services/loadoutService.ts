/**
 * Loadout Service
 * Handles loadout sharing and management API calls
 *
 * Created during Sprint 0.5 — raw-axios migration
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export interface Loadout {
  id: string;
  name: string;
  description?: string;
  userId: string;
  items?: unknown[];
  sharedWithOrgs?: string[];
  erkulGamesUrl?: string;
  spViewerUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateLoadoutInput {
  name: string;
  description?: string;
  shipName?: string;
  erkulGamesUrl?: string;
  spViewerUrl?: string;
  items?: unknown[];
}

export interface UpdateLoadoutInput {
  name?: string;
  description?: string;
  shipName?: string;
  erkulGamesUrl?: string;
  spViewerUrl?: string;
  sharedWithOrgs?: string[];
}

export interface ParsedErkulData {
  shipName: string;
  components: Array<{
    slot: string;
    name: string;
    type: string;
    size?: number;
    manufacturer?: string;
    grade?: string;
  }>;
  statistics?: Record<string, unknown>;
}

// ============================================================================
// Service
// ============================================================================

class LoadoutService extends BaseService {
  protected basePath = '/api/v2/loadouts';

  async createLoadout(data: CreateLoadoutInput): Promise<Loadout> {
    try {
      this.log('createLoadout', data);
      const response = await apiClient.post<Loadout>(this.basePath, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'createLoadout');
    }
  }

  async updateLoadout(loadoutId: string, data: UpdateLoadoutInput): Promise<Loadout> {
    try {
      this.log('updateLoadout', { loadoutId, data });
      const response = await apiClient.put<Loadout>(`${this.basePath}/${loadoutId}`, data);
      return response.data;
    } catch (error) {
      this.handleError(error, 'updateLoadout');
    }
  }

  async parseErkulUrl(url: string): Promise<ParsedErkulData> {
    try {
      this.log('parseErkulUrl', { url });
      const response = await apiClient.post<ParsedErkulData>(`${this.basePath}/parse-erkul`, {
        url,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'parseErkulUrl');
    }
  }

  async getUserLoadouts(userId: string, organizationIds?: string): Promise<Loadout[]> {
    try {
      this.log('getUserLoadouts', { userId, organizationIds });
      const params = organizationIds ? { organizationIds } : undefined;
      const response = await apiClient.get<Loadout[]>(`/api/v2/users/${userId}/loadouts`, {
        params,
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'getUserLoadouts');
    }
  }

  async shareWithOrg(loadoutId: string, orgId: string): Promise<void> {
    try {
      this.log('shareWithOrg', { loadoutId, orgId });
      await apiClient.post(`${this.basePath}/${loadoutId}/share-orgs`, {
        organizationIds: [orgId],
      });
    } catch (error) {
      this.handleError(error, 'shareWithOrg');
    }
  }

  async shareWithOrgs(loadoutId: string, organizationIds: string[]): Promise<void> {
    try {
      this.log('shareWithOrgs', { loadoutId, organizationIds });
      await apiClient.post(`${this.basePath}/${loadoutId}/share-orgs`, { organizationIds });
    } catch (error) {
      this.handleError(error, 'shareWithOrgs');
    }
  }

  async unshareWithOrg(loadoutId: string, orgId: string): Promise<void> {
    try {
      this.log('unshareWithOrg', { loadoutId, orgId });
      await apiClient.delete(`${this.basePath}/${loadoutId}/share-orgs`, {
        data: { organizationIds: [orgId] },
      });
    } catch (error) {
      this.handleError(error, 'unshareWithOrg');
    }
  }

  async unshareWithOrgs(loadoutId: string, organizationIds: string[]): Promise<void> {
    try {
      this.log('unshareWithOrgs', { loadoutId, organizationIds });
      await apiClient.delete(`${this.basePath}/${loadoutId}/share-orgs`, {
        data: { organizationIds },
      });
    } catch (error) {
      this.handleError(error, 'unshareWithOrgs');
    }
  }
}

export const loadoutService = new LoadoutService();
