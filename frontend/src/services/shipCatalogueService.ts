import { apiClient } from '@/services/apiClient';
import { BaseService } from '@/services/baseService';

export interface ShipCatalogueItem {
  id: string;
  name: string;
  manufacturer: string;
  size?: string;
  role?: string;
  status?: string;
  isVehicle?: boolean;
  crew?: number;
  minCrew?: number;
  maxCrew?: number;
  cargo?: number;
  maxSpeed?: number;
  price?: number;
}

export interface ShipCatalogueResponse {
  items: ShipCatalogueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class ShipCatalogueService extends BaseService {
  protected basePath = '/api/v2/ships/catalogue';

  /**
   * Get ships from the catalogue with optional filters
   */
  async getShips(params?: {
    manufacturer?: string;
    size?: string;
    role?: string;
    search?: string;
    isVehicle?: boolean;
    page?: number;
    limit?: number;
  }): Promise<ShipCatalogueResponse> {
    try {
      this.log('getShips', params);
      const response = await apiClient.get<Record<string, unknown>>(this.basePath, { params });
      // apiClient.get() returns the response body directly
      const body = response as unknown as Record<string, unknown>;
      const inner = (body.data ?? body) as Record<string, unknown>;

      // Backend returns { data: [...], pagination: {...} } — map to expected format
      if (inner && 'data' in inner && 'pagination' in inner) {
        const pagination = inner.pagination as {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
        return {
          items: inner.data as ShipCatalogueItem[],
          total: pagination.total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages: pagination.totalPages,
        };
      }
      // Fallback: raw array
      if (Array.isArray(inner)) {
        return { items: inner, total: inner.length, page: 1, limit: inner.length, totalPages: 1 };
      }
      // Already in expected ShipCatalogueResponse shape
      return inner as unknown as ShipCatalogueResponse;
    } catch (error) {
      this.handleError(error, 'getShips');
    }
  }

  /**
   * Get list of all manufacturers
   */
  async getManufacturers(): Promise<string[]> {
    try {
      this.log('getManufacturers');
      const response = await apiClient.get<string[]>(`${this.basePath}/manufacturers`);
      const body = response as unknown as Record<string, unknown>;
      const data = body.data ?? body;
      return Array.isArray(data) ? data : [];
    } catch (error) {
      this.handleError(error, 'getManufacturers');
    }
  }

  /**
   * Search ships by name or manufacturer
   */
  async searchShips(query: string): Promise<ShipCatalogueItem[]> {
    try {
      this.log('searchShips', { query });
      const response = await apiClient.get<ShipCatalogueItem[]>(`${this.basePath}/search`, {
        params: { q: query },
      });
      return response.data;
    } catch (error) {
      this.handleError(error, 'searchShips');
    }
  }

  /**
   * Get list of all ship roles from the catalogue
   */
  async getRoles(): Promise<string[]> {
    try {
      this.log('getRoles');
      const response = await apiClient.get<string[] | { data: string[] }>(`${this.basePath}/roles`);
      // Backend may wrap in { data: [...] } or return raw array
      const body = response.data;
      if (Array.isArray(body)) {
        return body;
      }
      return body.data ?? [];
    } catch (error) {
      this.handleError(error, 'getRoles');
    }
  }

  /**
   * Get ship details by ID
   */
  async getShipById(id: string): Promise<ShipCatalogueItem> {
    try {
      this.log('getShipById', { id });
      const response = await apiClient.get<ShipCatalogueItem>(`${this.basePath}/${id}`);
      return response.data;
    } catch (error) {
      this.handleError(error, 'getShipById');
    }
  }
}

export const shipCatalogueService = new ShipCatalogueService();
