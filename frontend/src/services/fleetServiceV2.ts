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

/**
 * Fleet Service V2
 * Handles all fleet and ship-related API calls using v2 endpoints
 */
class FleetServiceV2 extends BaseService {
  protected basePath = '/api/v2/fleets';

  // ============================================================================
  // Organization-Scoped Fleet Operations
  // ============================================================================

  /**
   * Get all fleets for an organization with pagination
   * GET /api/v2/organizations/:orgId/fleets
   */
  async getFleets(organizationId: string, params?: FleetListParams) {
    try {
      this.log('getFleets', { organizationId, params });

      const url = `/api/v2/organizations/${organizationId}/fleets`;
      const queryParams = {
        ...this.getPaginationParams(params),
        search: params?.search,
      };

      const response = await apiClient.getPaginated<FleetV2>(url, {
        params: queryParams,
      });

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getFleets');
    }
  }

  /**
   * Create a new fleet for an organization
   * POST /api/v2/organizations/:orgId/fleets
   */
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

  /**
   * Get fleet statistics for an organization
   * GET /api/v2/organizations/:orgId/fleets/statistics
   */
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

  // ============================================================================
  // Individual Fleet Operations
  // ============================================================================

  /**
   * Get fleet by ID
   * GET /api/v2/fleets/:id
   */
  async getFleetById(id: string) {
    try {
      this.log('getFleetById', { id });

      const response = await apiClient.get<FleetV2>(`${this.basePath}/${id}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetById');
    }
  }

  /**
   * Update fleet
   * PUT /api/v2/fleets/:id
   */
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

  /**
   * Delete fleet
   * DELETE /api/v2/fleets/:id
   */
  async deleteFleet(id: string) {
    try {
      this.log('deleteFleet', { id });

      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      return this.handleError(error, 'deleteFleet');
    }
  }

  /**
   * Get ships for a fleet with pagination
   * GET /api/v2/fleets/:id/ships
   */
  async getFleetShips(id: string, params?: PaginationParams) {
    try {
      this.log('getFleetShips', { id, params });

      const url = `${this.basePath}/${id}/ships`;
      const queryParams = this.getPaginationParams(params);

      const response = await apiClient.getPaginated<ShipV2>(url, {
        params: queryParams,
      });

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetShips');
    }
  }

  /**
   * Get detailed fleet composition analysis
   * GET /api/v2/fleets/:id/composition
   */
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

  /**
   * Get fleet health assessment
   * GET /api/v2/fleets/:id/health
   */
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

  // ============================================================================
  // Fleet Member (Ship Assignment) Operations
  // ============================================================================

  /**
   * Add a ship to a fleet
   * POST /api/v2/fleets/:id/members
   */
  async addShipToFleet(
    fleetId: string,
    shipId: string,
    role?: string,
    notes?: string
  ): Promise<unknown> {
    try {
      this.log('addShipToFleet', { fleetId, shipId, role });
      const response = await apiClient.post(`${this.basePath}/${fleetId}/members`, {
        shipId,
        role,
        notes,
      });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'addShipToFleet');
    }
  }

  /**
   * Remove a ship from a fleet
   * DELETE /api/v2/fleets/:id/members/:shipId
   */
  async removeShipFromFleet(fleetId: string, shipId: string): Promise<void> {
    try {
      this.log('removeShipFromFleet', { fleetId, shipId });
      await apiClient.delete(`${this.basePath}/${fleetId}/members/${shipId}`);
    } catch (error) {
      return this.handleError(error, 'removeShipFromFleet');
    }
  }

  /**
   * Bulk add ships to a fleet
   * POST /api/v2/fleets/:id/members/bulk
   */
  async bulkAddShipsToFleet(fleetId: string, shipIds: string[]): Promise<unknown> {
    try {
      this.log('bulkAddShipsToFleet', { fleetId, count: shipIds.length });
      const response = await apiClient.post(`${this.basePath}/${fleetId}/members/bulk`, {
        shipIds,
      });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'bulkAddShipsToFleet');
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Search fleets within an organization
   */
  async searchFleets(organizationId: string, searchTerm: string, params?: PaginationParams) {
    return this.getFleets(organizationId, {
      ...params,
      search: searchTerm,
    });
  }

  /**
   * Get all ships for a fleet (convenience method without pagination)
   */
  async getAllFleetShips(id: string): Promise<ShipV2[]> {
    const result = await this.getFleetShips(id, { page: 1, limit: 1000 });
    return result.items;
  }

  /**
   * Alias for getFleets (backward compatibility)
   * @deprecated Use getFleets instead
   */
  async getAllFleets(organizationId: string) {
    return this.getFleets(organizationId);
  }

  /**
   * Alias for getFleetShips (backward compatibility)
   * @deprecated Use getFleetShips instead
   */
  async getShips(fleetId: string) {
    return this.getFleetShips(fleetId);
  }

  /**
   * Search ships across fleets (backward compatibility)
   * @deprecated Use searchFleets and getFleetShips instead
   */
  async searchShips(_organizationId: string, _searchTerm: string) {
    // Mock implementation - return empty result
    return {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    };
  }

  // ============================================================================
  // Hierarchy Operations (Wave 2.2)
  // ============================================================================

  /**
   * Get fleet hierarchy tree for an organization
   * GET /api/v2/organizations/:orgId/fleets/tree
   */
  async getFleetTree(organizationId: string) {
    try {
      this.log('getFleetTree', { organizationId });
      const url = `/api/v2/organizations/${organizationId}/fleets/tree`;
      const response = await apiClient.get<{ tree: FleetV2[]; totalFleets: number }>(url);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetTree');
    }
  }

  /**
   * Move a fleet to a new parent
   * PUT /api/v2/fleets/:id/move
   */
  async moveFleet(fleetId: string, parentFleetId: string | null) {
    try {
      this.log('moveFleet', { fleetId, parentFleetId });
      const response = await apiClient.put<FleetV2>(`${this.basePath}/${fleetId}/move`, {
        parentFleetId,
      });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'moveFleet');
    }
  }

  /**
   * Reorder fleets within a parent
   * PUT /api/v2/organizations/:orgId/fleets/reorder
   */
  async reorderFleets(organizationId: string, orderedIds: string[], parentFleetId?: string | null) {
    try {
      this.log('reorderFleets', { organizationId, orderedIds, parentFleetId });
      const url = `/api/v2/organizations/${organizationId}/fleets/reorder`;
      const response = await apiClient.put(url, { orderedIds, parentFleetId });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'reorderFleets');
    }
  }

  // ============================================================================
  // Crew Position Self-Selection (Sprint 26)
  // ============================================================================

  /**
   * Get crew positions for all ships in a fleet
   * GET /api/v2/fleets/:id/crew/positions
   */
  async getCrewPositions(fleetId: string): Promise<CrewPositionsResponse> {
    try {
      this.log('getCrewPositions', { fleetId });
      const response = await apiClient.get<CrewPositionsResponse>(
        `${this.basePath}/${fleetId}/crew/positions`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getCrewPositions');
    }
  }

  /**
   * Get all crew members for a fleet with their assignments
   * GET /api/v2/fleets/:id/crew/members
   */
  async getFleetCrewMembers(fleetId: string): Promise<FleetCrewMembersResponse> {
    try {
      this.log('getFleetCrewMembers', { fleetId });
      const response = await apiClient.get<FleetCrewMembersResponse>(
        `${this.basePath}/${fleetId}/crew/members`
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetCrewMembers');
    }
  }

  /**
   * Select a crew position (ship + role) within a fleet
   * POST /api/v2/fleets/:id/crew/select
   */
  async selectCrewPosition(
    fleetId: string,
    shipId: string,
    role: string
  ): Promise<{ shipId: string; shipName: string; role: string; pending?: boolean }> {
    try {
      this.log('selectCrewPosition', { fleetId, shipId, role });
      const response = await apiClient.post<{
        shipId: string;
        shipName: string;
        role: string;
        pending?: boolean;
      }>(`${this.basePath}/${fleetId}/crew/select`, { shipId, role });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'selectCrewPosition');
    }
  }

  /**
   * Vacate (unselect) your crew position within a fleet
   * DELETE /api/v2/fleets/:id/crew/select
   */
  async unselectCrewPosition(fleetId: string): Promise<void> {
    try {
      this.log('unselectCrewPosition', { fleetId });
      await apiClient.delete(`${this.basePath}/${fleetId}/crew/select`);
    } catch (error) {
      return this.handleError(error, 'unselectCrewPosition');
    }
  }

  // ============================================================================
  // Audit Log (Sprint 26)
  // ============================================================================

  /**
   * Get audit log entries for a fleet
   * GET /api/v2/fleets/:id/audit
   */
  async getFleetAuditLog(
    fleetId: string,
    params?: { action?: string; limit?: number }
  ): Promise<FleetAuditEntry[]> {
    try {
      this.log('getFleetAuditLog', { fleetId, params });
      const response = await apiClient.get<FleetAuditEntry[]>(`${this.basePath}/${fleetId}/audit`, {
        params,
      });
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getFleetAuditLog');
    }
  }
}

/** Fleet audit log entry */
export interface FleetAuditEntry {
  action: string;
  fleetId: string;
  fleetName: string;
  organizationId: string;
  performedById?: string;
  performedByName?: string;
  timestamp: string;
  details: Record<string, unknown>;
}

/** Crew positions response including team metadata */
export interface CrewPositionsResponse {
  joinPolicy: 'open' | 'closed';
  pendingCount: number;
  ships: CrewPositionShip[];
}

/** Crew position data for a ship within a fleet */
export interface CrewPositionShip {
  shipId: string;
  shipName: string;
  maxCrew: number;
  crew: CrewPositionMember[];
}

export interface CrewPositionMember {
  userId: string;
  username: string;
  avatar?: string | null;
  role: string;
  assignedAt: string;
}

/** Fleet crew member with assignment info */
export interface FleetCrewMember {
  userId: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
  role: string;
  status: string;
  crewRole: string | null;
  assignedShipId: string | null;
  assignedShipName: string | null;
  joinedAt: string | null;
}

export interface FleetCrewMembersResponse {
  members: FleetCrewMember[];
}

export const fleetServiceV2 = new FleetServiceV2();
