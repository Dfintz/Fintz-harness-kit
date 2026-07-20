import { apiClient as api } from './apiClient';

/**
 * User Ship Service - API client for personal ship management
 *
 * Handles API calls for user-owned ships:
 * - CRUD operations
 * - Loan management
 * - Insurance tracking
 * - Filtering and pagination
 */

/** Ship summary with breakdowns by career, size, role, and manufacturer */
export interface UserShipSummary {
  totalShips: number;
  byStatus: Record<string, number>;
  byCondition: Record<string, number>;
  bySharingLevel: Record<string, number>;
  bySize: Record<string, number>;
  byRole: Record<string, number>;
  byCareer: Record<string, number>;
  byManufacturer: Record<string, number>;
  totalValue: number;
  needsInsurance: number;
}

/** Shape of a ship available for loan within an organization */
export interface AvailableShipDto {
  id: string;
  shipName: string;
  name?: string;
  customName?: string;
  userId: string;
  ownerUsername?: string;
  ownerName?: string;
  sharingLevel: string;
  condition?: string;
  location?: string;
  /** Catalogue-derived primary role (e.g. "Bomber", "Heavy Fighter"). */
  shipRole?: string;
  /** Catalogue-derived size (e.g. "Small", "Large", "Capital"). */
  shipSize?: string;
  /** Catalogue-derived manufacturer (e.g. "Anvil", "Aegis"). */
  shipManufacturer?: string;
}

export const userShipService = {
  /**
   * Get user's ships with optional filters
   */
  async getUserShips(filters: Record<string, unknown> = {}) {
    const params = new URLSearchParams();
    // Use filter[xxx] format so v2 queryParserMiddleware populates req.queryParams.filters
    if (filters['filter[status]'])
      params.append('filter[status]', String(filters['filter[status]']));
    if (filters['filter[condition]'])
      params.append('filter[condition]', String(filters['filter[condition]']));
    if (filters['filter[sharingLevel]'])
      params.append('filter[sharingLevel]', String(filters['filter[sharingLevel]']));
    if (filters['filter[productionStatus]'])
      params.append('filter[productionStatus]', String(filters['filter[productionStatus]']));
    if (filters.sort) params.append('sort', String(filters.sort));
    if (filters.search) params.append('search', String(filters.search));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString ? `/api/v2/users/me/ships?${queryString}` : '/api/v2/users/me/ships';
    // api.get() already unwraps the Axios response — return the full envelope
    // so the hook can extract both .data (items) and .meta.pagination.
    return api.get(url);
  },

  /**
   * Get user ship summary/statistics
   * Backend wraps in ApiResponse envelope via res.success() — use getData() to unwrap.
   */
  async getUserShipSummary(userId = 'me'): Promise<UserShipSummary> {
    return api.getData<UserShipSummary>(`/api/v2/users/${userId}/ships/summary`);
  },

  /**
   * Get specific ship by ID
   */
  async getUserShipById(userId: string, shipId: string) {
    const response = await api.get(`/api/v2/users/${userId}/ships/${shipId}`);
    return response.data;
  },

  /**
   * Create new user ship
   */
  async createUserShip(userId: string, shipData: Record<string, unknown>) {
    const response = await api.post(`/api/v2/users/${userId}/ships`, shipData);
    return response.data;
  },

  /**
   * Bulk import ships (single request, avoids rate limiting)
   */
  async bulkImportShips(userId: string, ships: Record<string, unknown>[]) {
    const response = await api.post(`/api/v2/users/${userId}/ships/import`, { ships });
    return response.data;
  },

  /**
   * Update user ship
   */
  async updateUserShip(userId: string, shipId: string, updates: Record<string, unknown>) {
    const response = await api.patch(`/api/v2/users/${userId}/ships/${shipId}`, updates);
    return response.data;
  },

  /**
   * Delete user ship
   */
  async deleteUserShip(userId: string, shipId: string) {
    const response = await api.delete(`/api/v2/users/${userId}/ships/${shipId}`);
    return response.data;
  },

  /**
   * Clear all ships from the user's personal hangar (hard delete)
   */
  async clearAllUserShips(userId: string) {
    const response = await api.delete(`/api/v2/users/${userId}/ships`);
    return response.data;
  },

  /**
   * Loan ship to another user
   */
  async loanShip(userId: string, shipId: string, loanData: Record<string, unknown>) {
    const response = await api.post(`/api/v2/users/${userId}/ships/${shipId}/loan`, loanData);
    return response.data;
  },

  /**
   * Return loaned ship
   */
  async returnLoanedShip(userId: string, shipId: string) {
    const response = await api.post(`/api/v2/users/${userId}/ships/${shipId}/return`);
    return response.data;
  },

  /**
   * Get ships needing insurance renewal
   */
  async getShipsNeedingInsurance(userId = 'me') {
    const response = await api.get(`/api/v2/users/${userId}/ships/insurance/expiring`);
    return response.data;
  },

  /**
   * Get available user ships for organization
   */
  async getOrgAvailableShips(orgId: string): Promise<AvailableShipDto[] | Record<string, unknown>> {
    const response = await api.get<AvailableShipDto[] | Record<string, unknown>>(
      `/api/v2/organizations/${orgId}/available-user-ships`
    );
    return response.data;
  },
};
