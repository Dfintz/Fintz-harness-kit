import type { PaginationParams, ShipV2 } from '@/types/apiV2';
import { apiClient } from './apiClient';
import { BaseService, extractData, extractPaginatedData } from './baseService';

/**
 * Ship Service V2
 * Handles all ship-related API calls using v2 endpoints
 * Ships are organization-scoped in V2
 */
class ShipServiceV2 extends BaseService {
  protected basePath = '/api/v2/ships';

  // ============================================================================
  // Organization-Scoped Ship Operations
  // ============================================================================

  /**
   * Get all ships for current organization with pagination
   * GET /api/v2/ships
   * Note: Requires tenant context middleware to be active
   */
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

  /**
   * Create a new ship
   * POST /api/v2/ships
   */
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

  /**
   * Get ship by ID
   * GET /api/v2/ships/:id
   */
  async getShipById(id: string) {
    try {
      this.log('getShipById', { id });

      const response = await apiClient.get<ShipV2>(`${this.basePath}/${id}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getShipById');
    }
  }

  /**
   * Update ship
   * PUT /api/v2/ships/:id
   */
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

  /**
   * Delete ship
   * DELETE /api/v2/ships/:id
   */
  async deleteShip(id: string) {
    try {
      this.log('deleteShip', { id });

      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      return this.handleError(error, 'deleteShip');
    }
  }

  /**
   * Get ship statistics
   * GET /api/v2/ships/statistics
   */
  async getStatistics() {
    try {
      this.log('getStatistics');

      const response = await apiClient.get(`${this.basePath}/statistics`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getStatistics');
    }
  }

  /**
   * Search ships
   * GET /api/v2/ships/search
   */
  async searchShips(searchTerm: string, params?: PaginationParams) {
    try {
      this.log('searchShips', { searchTerm, params });

      const queryParams = {
        ...this.getPaginationParams(params),
        search: searchTerm,
      };

      const response = await apiClient.getPaginated<ShipV2>(`${this.basePath}/search`, {
        params: queryParams,
      });

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'searchShips');
    }
  }

  // ============================================================================
  // Ship Catalogue (Public Data)
  // ============================================================================

  /**
   * Get ship catalogue
   * GET /api/v2/ships/catalogue
   */
  async getCatalogue() {
    try {
      this.log('getCatalogue');

      const response = await apiClient.get(`${this.basePath}/catalogue`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getCatalogue');
    }
  }

  /**
   * Get manufacturers
   * GET /api/v2/ships/catalogue/manufacturers
   */
  async getManufacturers() {
    try {
      this.log('getManufacturers');

      const response = await apiClient.get(`${this.basePath}/catalogue/manufacturers`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getManufacturers');
    }
  }

  /**
   * Get ship roles
   * GET /api/v2/ships/catalogue/roles
   */
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
