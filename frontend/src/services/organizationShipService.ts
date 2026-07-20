import { apiClient as api } from './apiClient';

/**
 * Organization Ship Service - API client for org fleet management
 *
 * Handles API calls for organization-owned ships:
 * - Fleet CRUD operations
 * - Crew assignments
 * - Capital ship management
 * - Maintenance tracking
 * - Role-based filtering
 */

// ─── Types ──────────────────────────────────────────────────────

/** Ship roles available for org-owned vessels */
export type OrgShipRole =
  | 'command'
  | 'combat'
  | 'logistics'
  | 'mining'
  | 'exploration'
  | 'medical'
  | 'transport'
  | 'support'
  | 'reserve';

/** Ownership / lifecycle status */
export type ShipOwnershipStatus =
  | 'owned'
  | 'loaned'
  | 'leased'
  | 'captured'
  | 'destroyed'
  | 'lost'
  | 'sold';

/** Physical condition */
export type ShipCondition = 'excellent' | 'good' | 'fair' | 'damaged' | 'critical';

/** Sharing visibility */
export type ShipSharingLevel = 'private' | 'shared_users' | 'organization' | 'alliance' | 'public';

/** Filter parameters accepted by the list endpoint */
export interface OrgShipFilters {
  role?: OrgShipRole;
  status?: ShipOwnershipStatus;
  condition?: ShipCondition;
  isAvailable?: boolean;
  isCapital?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

/** Core org ship returned by the API */
export interface OrgShip {
  id: string;
  shipId: string;
  shipName: string;
  customName?: string;
  role: OrgShipRole;
  status: ShipOwnershipStatus;
  condition: ShipCondition;
  sharingLevel: ShipSharingLevel;
  acquisitionMethod?: string;
  acquiredBy?: string;
  acquiredDate?: string;
  acquisitionCost?: number;
  assignedCaptain?: string;
  assignedCrew?: string[];
  maxCrew?: number;
  location?: string;
  homeBase?: string;
  insuranceLevel?: string;
  insuranceExpires?: string;
  lastMaintenance?: string;
  nextMaintenance?: string;
  flightHours?: number;
  missionsCompleted?: number;
  totalEarnings?: number;
  maintenanceCosts?: number;
  modifications?: {
    components?: string[];
    weapons?: string[];
    upgrades?: string[];
    cargo?: Record<string, unknown>;
  };
  isAvailable: boolean;
  isCapital?: boolean;
  requiresPermission?: boolean;
  minimumRank?: string;
  notes?: string;
  tags?: string[];
  isActive: boolean;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

/** Paginated list response for org ships */
export interface OrgShipListResponse {
  data: OrgShip[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/** Summary statistics for org fleet */
export interface OrgFleetSummary {
  totalShips: number;
  operational: number;
  needsRepair: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
}

/** DTO for creating a new org ship */
export interface CreateOrgShipInput {
  shipId: string;
  shipName: string;
  customName?: string;
  role?: OrgShipRole;
  status?: ShipOwnershipStatus;
  condition?: ShipCondition;
  acquisitionMethod?: string;
  acquiredBy?: string;
  acquiredDate?: string;
  acquisitionCost?: number;
  maxCrew?: number;
  location?: string;
  homeBase?: string;
  sharingLevel?: ShipSharingLevel;
  notes?: string;
  tags?: string[];
  isCapital?: boolean;
}

/** DTO for updating an org ship */
export interface UpdateOrgShipInput {
  customName?: string;
  role?: OrgShipRole;
  status?: ShipOwnershipStatus;
  condition?: ShipCondition;
  location?: string;
  homeBase?: string;
  notes?: string;
  tags?: string[];
  isAvailable?: boolean;
  sharingLevel?: ShipSharingLevel;
  assignedCaptain?: string | null;
  maxCrew?: number;
  isCapital?: boolean;
}

// ─── Service ────────────────────────────────────────────────────

export const organizationShipService = {
  /**
   * Get organization ships with filters
   */
  async getOrgShips(orgId: string, filters: OrgShipFilters = {}): Promise<OrgShipListResponse> {
    const params = new URLSearchParams();
    if (filters.role) params.append('role', String(filters.role));
    if (filters.status) params.append('status', String(filters.status));
    if (filters.condition) params.append('condition', String(filters.condition));
    if (filters.isAvailable !== undefined)
      params.append('isAvailable', String(filters.isAvailable));
    if (filters.isCapital !== undefined) params.append('isCapital', String(filters.isCapital));
    if (filters.search) params.append('search', String(filters.search));
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const queryString = params.toString();
    const url = queryString
      ? `/api/v2/organizations/${orgId}/ships?${queryString}`
      : `/api/v2/organizations/${orgId}/ships`;
    const response = await api.get<OrgShipListResponse>(url);
    return response.data;
  },

  /**
   * Get fleet summary statistics
   */
  async getFleetSummary(orgId: string): Promise<OrgFleetSummary> {
    const response = await api.get<OrgFleetSummary>(`/api/v2/organizations/${orgId}/ships/summary`);
    return response.data;
  },

  /**
   * Get specific org ship by ID
   */
  async getOrgShipById(orgId: string, shipId: string): Promise<OrgShip> {
    const response = await api.get<OrgShip>(`/api/v2/organizations/${orgId}/ships/${shipId}`);
    return response.data;
  },

  /**
   * Create new org ship
   */
  async createOrgShip(orgId: string, shipData: CreateOrgShipInput): Promise<OrgShip> {
    const response = await api.post<OrgShip>(`/api/v2/organizations/${orgId}/ships`, shipData);
    return response.data;
  },

  /**
   * Update org ship
   */
  async updateOrgShip(orgId: string, shipId: string, updates: UpdateOrgShipInput): Promise<OrgShip> {
    const response = await api.patch<OrgShip>(`/api/v2/organizations/${orgId}/ships/${shipId}`, updates);
    return response.data;
  },

  /**
   * Delete org ship
   */
  async deleteOrgShip(orgId: string, shipId: string): Promise<void> {
    await api.delete(`/api/v2/organizations/${orgId}/ships/${shipId}`);
  },

  /**
   * Assign captain to ship
   */
  async assignCaptain(orgId: string, shipId: string, captainId: string): Promise<OrgShip> {
    const response = await api.post<OrgShip>(`/api/v2/organizations/${orgId}/ships/${shipId}/captain`, {
      captainId,
    });
    return response.data;
  },

  /**
   * Assign crew to ship (full replacement)
   */
  async assignCrew(orgId: string, shipId: string, crewIds: string[]): Promise<OrgShip> {
    const response = await api.post<OrgShip>(`/api/v2/organizations/${orgId}/ships/${shipId}/crew`, {
      crewIds,
    });
    return response.data;
  },

  /**
   * Add crew member to ship
   */
  async addCrewMember(orgId: string, shipId: string, userId: string, role?: string): Promise<OrgShip> {
    const response = await api.post<OrgShip>(
      `/api/v2/organizations/${orgId}/ships/${shipId}/crew/${userId}`,
      role ? { role } : undefined
    );
    return response.data;
  },

  /**
   * Remove crew member from ship
   */
  async removeCrewMember(orgId: string, shipId: string, userId: string): Promise<void> {
    await api.delete(
      `/api/v2/organizations/${orgId}/ships/${shipId}/crew/${userId}`
    );
  },

  /**
   * Get ships needing maintenance
   */
  async getShipsNeedingMaintenance(orgId = 'current'): Promise<OrgShip[]> {
    const response = await api.get<OrgShip[]>(`/api/v2/organizations/${orgId}/ships/maintenance/due`);
    return response.data;
  },

  /**
   * Get capital ships
   */
  async getCapitalShips(orgId = 'current'): Promise<OrgShip[]> {
    const response = await api.get<OrgShip[]>(`/api/v2/organizations/${orgId}/ships/capital`);
    return response.data;
  },

  /**
   * Get ships by role
   */
  async getShipsByRole(orgId: string, role: string): Promise<OrgShip[]> {
    const response = await api.get<OrgShip[]>(`/api/v2/organizations/${orgId}/ships/role/${role}`);
    return response.data;
  },

  /**
   * Get available ships
   */
  async getAvailableShips(orgId = 'current'): Promise<OrgShip[]> {
    const response = await api.get<OrgShip[]>(`/api/v2/organizations/${orgId}/ships/available`);
    return response.data;
  },

  /**
   * Loan an org ship to a user
   */
  async loanOrgShip(orgId: string, shipId: string, data: { borrowerId: string; purpose?: string }): Promise<OrgShip> {
    const response = await api.post<OrgShip>(`/api/v2/organizations/${orgId}/ships/${shipId}/loan`, data);
    return response.data;
  },

  /**
   * Return a loaned org ship
   */
  async returnOrgShipLoan(orgId: string, shipId: string): Promise<OrgShip> {
    const response = await api.post<OrgShip>(`/api/v2/organizations/${orgId}/ships/${shipId}/return`);
    return response.data;
  },
};
