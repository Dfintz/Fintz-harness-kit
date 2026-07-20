/**
 * Fleet Service V2 for Mobile
 * Handles all fleet-related API calls using v2 endpoints.
 * Ported from frontend/src/services/fleetServiceV2.ts
 */

import type {
  FleetComposition,
  FleetHealth,
  FleetListParams,
  FleetStatistics,
  FleetV2,
  PaginationParams,
  ShipV2,
} from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData, extractPaginatedData } from './baseService';

class FleetServiceV2 extends BaseService {
  protected basePath = '/api/v2/fleets';

  async getFleets(organizationId: string, params?: FleetListParams) {
    try {
      this.log('getFleets', { organizationId, params });
      const url = `/api/v2/organizations/${organizationId}/fleets`;
      const queryParams = {
        ...this.getPaginationParams(params),
        search: params?.search,
      };
      const response = await apiClient.getPaginated<FleetV2>(url, { params: queryParams });
      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getFleets');
    }
  }

  async createFleet(
    organizationId: string,
    data: { name: string; description?: string; type?: string; members?: string[] }
  ) {
    try {
      this.log('createFleet', { organizationId, data });
      const url = `/api/v2/organizations/${organizationId}/fleets`;
      const response = await apiClient.post<FleetV2>(url, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createFleet');
    }
  }

  async getFleetStatistics(organizationId: string) {
    try {
      this.log('getFleetStatistics', { organizationId });
      const url = `/api/v2/organizations/${organizationId}/fleets/statistics`;
      const response = await apiClient.get<FleetStatistics>(url);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetStatistics');
    }
  }

  async getFleetById(id: string) {
    try {
      this.log('getFleetById', { id });
      const response = await apiClient.get<FleetV2>(`${this.basePath}/${id}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetById');
    }
  }

  async updateFleet(
    id: string,
    data: { name?: string; description?: string; type?: string; members?: string[] }
  ) {
    try {
      this.log('updateFleet', { id, data });
      const response = await apiClient.put<FleetV2>(`${this.basePath}/${id}`, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateFleet');
    }
  }

  async deleteFleet(id: string) {
    try {
      this.log('deleteFleet', { id });
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      return this.handleError(error, 'deleteFleet');
    }
  }

  async getFleetShips(id: string, params?: PaginationParams) {
    try {
      this.log('getFleetShips', { id, params });
      const url = `${this.basePath}/${id}/ships`;
      const queryParams = this.getPaginationParams(params);
      const response = await apiClient.getPaginated<ShipV2>(url, { params: queryParams });
      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetShips');
    }
  }

  async getFleetComposition(id: string) {
    try {
      this.log('getFleetComposition', { id });
      const url = `${this.basePath}/${id}/composition`;
      const response = await apiClient.get<FleetComposition>(url);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetComposition');
    }
  }

  async getFleetHealth(id: string) {
    try {
      this.log('getFleetHealth', { id });
      const url = `${this.basePath}/${id}/health`;
      const response = await apiClient.get<FleetHealth>(url);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetHealth');
    }
  }
}

export const fleetServiceV2 = new FleetServiceV2();
