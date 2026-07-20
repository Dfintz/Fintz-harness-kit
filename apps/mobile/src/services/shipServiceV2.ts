/**
 * Ship Service V2 for Mobile
 * Handles all ship-related API calls using v2 endpoints.
 * Ported from frontend/src/services/shipServiceV2.ts
 */

import type { PaginationParams, ShipV2 } from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData, extractPaginatedData } from './baseService';

class ShipServiceV2 extends BaseService {
  protected basePath = '/api/v2/ships';

  async getShips(params?: PaginationParams) {
    try {
      this.log('getShips', { params });
      const queryParams = this.getPaginationParams(params);
      const response = await apiClient.getPaginated<ShipV2>(this.basePath, {
        params: queryParams,
      });
      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getShips');
    }
  }

  async createShip(data: {
    name: string;
    manufacturer: string;
    model: string;
    role: string;
    size: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
  }): Promise<ShipV2> {
    try {
      this.log('createShip', data);
      const response = await apiClient.post<ShipV2>(this.basePath, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createShip');
    }
  }

  async getShipById(id: string) {
    try {
      this.log('getShipById', { id });
      const response = await apiClient.get<ShipV2>(`${this.basePath}/${id}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getShipById');
    }
  }

  async updateShip(
    id: string,
    data: {
      name?: string;
      manufacturer?: string;
      model?: string;
      role?: string;
      size?: 'vehicle' | 'snub' | 'small' | 'medium' | 'large' | 'sub_capital' | 'capital';
    }
  ) {
    try {
      this.log('updateShip', { id, data });
      const response = await apiClient.put<ShipV2>(`${this.basePath}/${id}`, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateShip');
    }
  }

  async deleteShip(id: string) {
    try {
      this.log('deleteShip', { id });
      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      return this.handleError(error, 'deleteShip');
    }
  }

  async searchShips(searchTerm: string, params?: PaginationParams) {
    try {
      this.log('searchShips', { searchTerm, params });
      const queryParams = { ...this.getPaginationParams(params), search: searchTerm };
      const response = await apiClient.getPaginated<ShipV2>(`${this.basePath}/search`, {
        params: queryParams,
      });
      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'searchShips');
    }
  }

  async getCatalogue() {
    try {
      this.log('getCatalogue');
      const response = await apiClient.get(`${this.basePath}/catalogue`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getCatalogue');
    }
  }

  async getRoles() {
    try {
      this.log('getRoles');
      const response = await apiClient.get(`${this.basePath}/catalogue/roles`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getRoles');
    }
  }
}

export const shipServiceV2 = new ShipServiceV2();
