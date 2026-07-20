import type { RouteWaypoint } from '@/types/activity';
import type {
  ActivityAnalytics,
  ActivityListParams,
  ActivityV2,
  PaginationParams,
  RecommendedActivities,
} from '@/types/apiV2';
import type { ActivityCrewPosition } from '@sc-fleet-manager/shared-types';
import { apiClient } from './apiClient';
import { BaseService, extractData, extractPaginatedData } from './baseService';

/**
 * Activity Service V2
 * Handles all activity-related API calls using v2 endpoints
 */
class ActivityServiceV2 extends BaseService {
  protected basePath = '/api/v2/activities';

  // ============================================================================
  // Discovery Endpoints
  // ============================================================================

  /**
   * Get recommended activities
   * GET /api/v2/activities/recommended
   */
  async getRecommendedActivities(limit: number = 10) {
    try {
      this.log('getRecommendedActivities', { limit });

      const response = await apiClient.get<RecommendedActivities>(`${this.basePath}/recommended`, {
        params: { limit },
      });

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getRecommendedActivities');
    }
  }

  /**
   * Get upcoming activities
   * GET /api/v2/activities/upcoming
   */
  async getUpcomingActivities(params?: { organizationId?: string; limit?: number }) {
    try {
      this.log('getUpcomingActivities', params);

      const response = await apiClient.get<{ activities: ActivityV2[]; count: number }>(
        `${this.basePath}/upcoming`,
        { params: { orgId: params?.organizationId, limit: params?.limit || 10 } }
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getUpcomingActivities');
    }
  }

  // ============================================================================
  // Personal Activity Operations
  // ============================================================================

  /**
   * Get current user's activities (no org required)
   * GET /api/v2/users/me/activities
   */
  async getMyActivities(params?: ActivityListParams) {
    try {
      this.log('getMyActivities', { params });

      const url = `${this.basePath}/../users/me/activities`;
      const queryParams = {
        ...this.getPaginationParams(params),
        status: params?.status,
        type: params?.type,
        search: params?.search,
      };

      const response = await apiClient.getPaginated<ActivityV2>(url, {
        params: queryParams,
      });

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getMyActivities');
    }
  }

  // ============================================================================
  // Organization-Scoped Activity Operations
  // ============================================================================

  /**
   * Get all activities for an organization with filtering
   * GET /api/v2/organizations/:orgId/activities
   */
  async getActivities(organizationId: string, params?: ActivityListParams) {
    try {
      this.log('getActivities', { organizationId, params });

      const url = `/api/v2/organizations/${organizationId}/activities`;
      const queryParams = {
        ...this.getPaginationParams(params),
        status: params?.status,
        type: params?.type,
        search: params?.search,
      };

      const response = await apiClient.getPaginated<ActivityV2>(url, {
        params: queryParams,
      });

      return extractPaginatedData(response);
    } catch (error) {
      return this.handleError(error, 'getActivities');
    }
  }

  /**
   * Create a new activity for an organization
   * POST /api/v2/organizations/:orgId/activities
   */
  async createActivity(
    organizationId: string,
    data: {
      title: string;
      description?: string;
      type: string;
      status?: string;
      maxParticipants?: number;
      startDate?: string;
      endDate?: string;
      location?: string;
      visibility?: string;
      isRecurring?: boolean;
      recurringSchedule?: string;
      metadata?: Record<string, unknown>;
      shipRequirementType?: string;
      requiredShips?: Array<{
        requirementType: 'specific' | 'role';
        shipName?: string;
        shipId?: string;
        role?: string;
        count: number;
        crewPerShip?: number;
        avgCrewPerShip?: number;
      }>;
      crewSpotsTotal?: number;
    }
  ) {
    try {
      this.log('createActivity', { organizationId, data });

      const url = `/api/v2/organizations/${organizationId}/activities`;
      const response = await apiClient.post<ActivityV2>(url, data);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'createActivity');
    }
  }

  /**
   * Get activity analytics for an organization
   * GET /api/v2/organizations/:orgId/activities/analytics
   */
  async getActivityAnalytics(organizationId: string) {
    try {
      this.log('getActivityAnalytics', { organizationId });

      const url = `/api/v2/organizations/${organizationId}/activities/analytics`;
      const response = await apiClient.get<ActivityAnalytics>(url);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getActivityAnalytics');
    }
  }

  // ============================================================================
  // Individual Activity Operations
  // ============================================================================

  /**
   * Get activity by ID
   * GET /api/v2/activities/:id
   */
  async getActivityById(id: string) {
    try {
      this.log('getActivityById', { id });

      const response = await apiClient.get<ActivityV2>(`${this.basePath}/${id}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getActivityById');
    }
  }

  /**
   * Update activity
   * PUT /api/v2/activities/:id
   */
  async updateActivity(
    id: string,
    data: {
      title?: string;
      description?: string;
      type?: string;
      status?: string;
      maxParticipants?: number;
      startDate?: string;
      endDate?: string;
      location?: string;
      visibility?: string;
    }
  ) {
    try {
      this.log('updateActivity', { id, data });

      const response = await apiClient.put<ActivityV2>(`${this.basePath}/${id}`, data);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateActivity');
    }
  }

  /**
   * Delete activity
   * DELETE /api/v2/activities/:id
   */
  async deleteActivity(id: string) {
    try {
      this.log('deleteActivity', { id });

      await apiClient.delete(`${this.basePath}/${id}`);
    } catch (error) {
      return this.handleError(error, 'deleteActivity');
    }
  }

  // ============================================================================
  // Convenience Methods
  // ============================================================================

  /**
   * Search activities within an organization
   */
  async searchActivities(organizationId: string, searchTerm: string, params?: ActivityListParams) {
    return this.getActivities(organizationId, {
      ...params,
      search: searchTerm,
    });
  }

  /**
   * Get activities by status
   */
  async getActivitiesByStatus(organizationId: string, status: string, params?: PaginationParams) {
    return this.getActivities(organizationId, {
      ...params,
      status,
    });
  }

  /**
   * Get activities by type
   */
  async getActivitiesByType(organizationId: string, type: string, params?: PaginationParams) {
    return this.getActivities(organizationId, {
      ...params,
      type,
    });
  }

  /**
   * Get open activities (convenience method)
   */
  async getOpenActivities(organizationId: string, params?: PaginationParams) {
    return this.getActivitiesByStatus(organizationId, 'open', params);
  }

  /**
   * Get recruiting activities (convenience method)
   */
  async getRecruitingActivities(organizationId: string, params?: PaginationParams) {
    return this.getActivitiesByStatus(organizationId, 'recruiting', params);
  }

  /**
   * Join an activity
   * POST /api/v2/activities/:id/join
   */
  async joinActivity(
    activityId: string,
    data?: {
      role?: string;
      shipId?: string;
      shipType?: string;
      shipName?: string;
      crewPosition?: string;
      crewShipId?: string;
      notes?: string;
    }
  ) {
    try {
      this.log('joinActivity', { activityId, ...data });

      const response = await apiClient.post(`${this.basePath}/${activityId}/join`, data ?? {});

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'joinActivity');
    }
  }

  /**
   * Leave an activity
   * POST /api/v2/activities/:id/leave
   */
  async leaveActivity(activityId: string) {
    try {
      this.log('leaveActivity', { activityId });

      const response = await apiClient.post(`${this.basePath}/${activityId}/leave`);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'leaveActivity');
    }
  }

  /**
   * Cancel an activity
   * POST /api/v2/activities/:id/cancel
   */
  async cancelActivity(activityId: string) {
    try {
      this.log('cancelActivity', { activityId });

      const response = await apiClient.post(`${this.basePath}/${activityId}/cancel`);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'cancelActivity');
    }
  }

  // ============================================================================
  // Ship & Crew Management
  // ============================================================================

  /**
   * Add ship to activity
   * POST /api/v2/activities/:id/ships
   */
  async addShip(
    activityId: string,
    shipData: {
      shipId?: string;
      shipType: string;
      shipName?: string;
      role: string;
      crewCapacity: number;
      capabilities?: string[];
      parentShipId?: string;
      transportType?: 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar';
    }
  ) {
    try {
      this.log('addShip', { activityId, shipData });

      const response = await apiClient.post(`${this.basePath}/${activityId}/ships`, shipData);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'addShip');
    }
  }

  /**
   * Loan multiple ships to an activity
   * POST /api/v2/activities/:id/ships/loan
   */
  async loanShips(
    activityId: string,
    ships: Array<{
      shipId?: string;
      shipType: string;
      shipName?: string;
      crewCapacity?: number;
    }>
  ) {
    try {
      this.log('loanShips', { activityId, shipCount: ships.length });

      const response = await apiClient.post(`${this.basePath}/${activityId}/ships/loan`, {
        ships,
      });

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'loanShips');
    }
  }

  /**
   * Join ship as crew member
   * POST /api/v2/activities/:id/ships/:ownerId/crew
   */
  async joinShipCrew(activityId: string, ownerId: string, crewPosition: string) {
    try {
      this.log('joinShipCrew', { activityId, ownerId, crewPosition });

      const response = await apiClient.post(
        `${this.basePath}/${activityId}/ships/${ownerId}/crew`,
        { crewPosition }
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'joinShipCrew');
    }
  }

  /**
   * Leave ship crew
   * DELETE /api/v2/activities/:id/ships/crew
   */
  async leaveShipCrew(activityId: string) {
    try {
      this.log('leaveShipCrew', { activityId });

      const response = await apiClient.delete(`${this.basePath}/${activityId}/ships/crew`);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'leaveShipCrew');
    }
  }

  /**
   * Get available crew positions
   * GET /api/v2/activities/:id/ships/available-crew
   */
  async getAvailableCrewPositions(activityId: string) {
    try {
      this.log('getAvailableCrewPositions', { activityId });

      const response = await apiClient.get(`${this.basePath}/${activityId}/ships/available-crew`);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getAvailableCrewPositions');
    }
  }

  /**
   * Set/move a participant's crew position on a ship.
   * PATCH /api/v2/activities/:id/crew
   */
  async setCrewPosition(
    activityId: string,
    body: { targetUserId: string; shipAssignmentId: string; crewPosition: ActivityCrewPosition }
  ) {
    try {
      this.log('setCrewPosition', { activityId, ...body });

      const response = await apiClient.patch<ActivityV2>(
        `${this.basePath}/${activityId}/crew`,
        body
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'setCrewPosition');
    }
  }

  /**
   * Nest a ship inside a parent ship's hangar/cargo. Pass parentShipId=null to un-nest.
   * PATCH /api/v2/activities/:id/ships/:shipAssignmentId/nest
   */
  async setShipNesting(
    activityId: string,
    shipAssignmentId: string,
    body: {
      parentShipId: string | null;
      transportType: 'hangar' | 'cargo' | 'tractor_beam' | 'docking_collar' | null;
    }
  ) {
    try {
      this.log('setShipNesting', { activityId, shipAssignmentId, ...body });

      const response = await apiClient.patch<ActivityV2>(
        `${this.basePath}/${activityId}/ships/${shipAssignmentId}/nest`,
        body
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'setShipNesting');
    }
  }

  // ============================================================================
  // Passenger (non-crew) Slots
  // ============================================================================

  /**
   * Define or edit the passenger slots (e.g. marines) on a ship.
   * PATCH /api/v2/activities/:id/ships/:shipId/passengers
   */
  async setPassengerSlots(
    activityId: string,
    shipId: string,
    slots: Array<{ role: string; capacity: number }>
  ) {
    try {
      this.log('setPassengerSlots', { activityId, shipId, slotCount: slots.length });

      const response = await apiClient.patch<ActivityV2>(
        `${this.basePath}/${activityId}/ships/${shipId}/passengers`,
        { slots }
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'setPassengerSlots');
    }
  }

  /**
   * Join a ship as a passenger (non-crew) in a slot of the given role.
   * POST /api/v2/activities/:id/ships/:shipId/passengers/join
   */
  async joinShipPassenger(activityId: string, shipId: string, passengerRole: string) {
    try {
      this.log('joinShipPassenger', { activityId, shipId, passengerRole });

      const response = await apiClient.post<ActivityV2>(
        `${this.basePath}/${activityId}/ships/${shipId}/passengers/join`,
        { passengerRole }
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'joinShipPassenger');
    }
  }

  /**
   * Leave whichever passenger slot the current user occupies.
   * DELETE /api/v2/activities/:id/ships/passengers
   */
  async leaveShipPassenger(activityId: string) {
    try {
      this.log('leaveShipPassenger', { activityId });

      const response = await apiClient.delete<ActivityV2>(
        `${this.basePath}/${activityId}/ships/passengers`
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'leaveShipPassenger');
    }
  }

  /**
   * List ships with open passenger slots (one entry per ship+role).
   * GET /api/v2/activities/:id/ships/available-passengers
   */
  async getAvailablePassengerSlots(activityId: string) {
    try {
      this.log('getAvailablePassengerSlots', { activityId });

      const response = await apiClient.get<{
        slots: Array<{
          shipId?: string;
          shipType: string;
          shipName?: string;
          ownerName: string;
          role: string;
          availableSlots: number;
        }>;
        count: number;
      }>(`${this.basePath}/${activityId}/ships/available-passengers`);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getAvailablePassengerSlots');
    }
  }

  // ============================================================================
  // Typed Crew Slots (seats per role)
  // ============================================================================

  /**
   * Define or edit the typed crew slots (seats per role) on a ship.
   * PATCH /api/v2/activities/:id/ships/:shipId/crew-slots
   */
  async setCrewSlots(
    activityId: string,
    shipId: string,
    slots: Array<{ role: ActivityCrewPosition; capacity: number }>
  ) {
    try {
      this.log('setCrewSlots', { activityId, shipId, slotCount: slots.length });

      const response = await apiClient.patch<ActivityV2>(
        `${this.basePath}/${activityId}/ships/${shipId}/crew-slots`,
        { slots }
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'setCrewSlots');
    }
  }

  /**
   * List per-role crew-slot availability for each ship.
   * GET /api/v2/activities/:id/ships/crew-slots
   */
  async getCrewSlotAvailability(activityId: string) {
    try {
      this.log('getCrewSlotAvailability', { activityId });

      const response = await apiClient.get<{
        ships: Array<{
          shipId?: string;
          shipType: string;
          shipName?: string;
          ownerName: string;
          slots: Array<{ role: string; capacity: number; filled: number; available: number }>;
        }>;
        count: number;
      }>(`${this.basePath}/${activityId}/ships/crew-slots`);

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getCrewSlotAvailability');
    }
  }

  // ============================================================================
  // Fleet Operations
  // ============================================================================

  /**
   * Bring some or all of a fleet's ships into the activity (as loaners).
   * POST /api/v2/activities/:id/fleet/bring
   */
  async bringFleetToActivity(activityId: string, fleetId: string, shipIds?: string[]) {
    try {
      this.log('bringFleetToActivity', { activityId, fleetId, shipCount: shipIds?.length });

      const response = await apiClient.post<ActivityV2>(
        `${this.basePath}/${activityId}/fleet/bring`,
        { fleetId, shipIds }
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'bringFleetToActivity');
    }
  }

  /**
   * Invite some or all of a fleet's members to the activity (status INVITED).
   * POST /api/v2/activities/:id/fleet/invite
   */
  async inviteFleetMembers(activityId: string, fleetId: string, userIds?: string[]) {
    try {
      this.log('inviteFleetMembers', { activityId, fleetId, userCount: userIds?.length });

      const response = await apiClient.post<{ invited: string[]; skipped: string[] }>(
        `${this.basePath}/${activityId}/fleet/invite`,
        { fleetId, userIds }
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'inviteFleetMembers');
    }
  }

  /**
   * Bring fleet ships and invite members in one orchestrated backend call.
   * POST /api/v2/activities/:id/fleet/bring-and-invite
   */
  async bringFleetAndInviteMembers(
    activityId: string,
    fleetId: string,
    options?: { shipIds?: string[]; userIds?: string[] }
  ) {
    try {
      this.log('bringFleetAndInviteMembers', {
        activityId,
        fleetId,
        shipCount: options?.shipIds?.length,
        userCount: options?.userIds?.length,
      });

      const response = await apiClient.post<{
        activity: ActivityV2;
        invited: string[];
        skipped: string[];
        status: 'full' | 'ships_only';
        inviteError?: string;
      }>(`${this.basePath}/${activityId}/fleet/bring-and-invite`, {
        fleetId,
        shipIds: options?.shipIds,
        userIds: options?.userIds,
      });

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'bringFleetAndInviteMembers');
    }
  }

  // ============================================================================
  // Route Planning
  // ============================================================================

  /**
   * Add route plan to activity
   * POST /api/v2/activities/:id/route
   */
  async addRoutePlan(activityId: string, waypoints: RouteWaypoint[]) {
    try {
      this.log('addRoutePlan', { activityId, waypoints });

      const response = await apiClient.post(`${this.basePath}/${activityId}/route`, {
        waypoints,
      });

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'addRoutePlan');
    }
  }

  /**
   * Update route waypoint
   * PUT /api/v2/activities/:id/route/:order
   */
  async updateWaypoint(activityId: string, waypointOrder: number, updates: Partial<RouteWaypoint>) {
    try {
      this.log('updateWaypoint', { activityId, waypointOrder, updates });

      const response = await apiClient.put(
        `${this.basePath}/${activityId}/route/${waypointOrder}`,
        updates
      );

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'updateWaypoint');
    }
  }

  // ============================================================================
  // Mining Data
  // ============================================================================

  /**
   * Enrich activity with mining data
   * POST /api/v2/activities/:id/enrich-mining
   */
  async enrichWithMiningData(activityId: string) {
    try {
      this.log('enrichWithMiningData', { activityId });

      const response = await apiClient.post(`${this.basePath}/${activityId}/enrich-mining`, {});

      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'enrichWithMiningData');
    }
  }

  // =========================================================================
  // Quick Join Links
  // =========================================================================

  /**
   * Generate a quick-join link for an activity
   * POST /api/v2/activities/:id/join-link
   */
  async generateJoinLink(activityId: string): Promise<{ token: string; expiresAt: string }> {
    try {
      this.log('generateJoinLink', { activityId });
      const response = await apiClient.post<{ token: string; expiresAt: string }>(
        `${this.basePath}/${activityId}/join-link`,
        {}
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'generateJoinLink');
    }
  }

  /**
   * Preview an activity via quick-join token (public, no auth required)
   * GET /api/v2/activities/join/:token
   */
  async getActivityByToken(token: string): Promise<ActivityV2> {
    try {
      this.log('getActivityByToken', { token });
      const response = await apiClient.get<ActivityV2>(`${this.basePath}/join/${token}`);
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'getActivityByToken');
    }
  }

  /**
   * Join an activity via quick-join token
   * POST /api/v2/activities/join/:token
   */
  async joinByToken(
    token: string,
    data?: { role?: string; shipId?: string; notes?: string }
  ): Promise<ActivityV2> {
    try {
      this.log('joinByToken', { token });
      const response = await apiClient.post<ActivityV2>(
        `${this.basePath}/join/${token}`,
        data ?? {}
      );
      return extractData(response);
    } catch (error) {
      return this.handleError(error, 'joinByToken');
    }
  }
}

export const activityServiceV2 = new ActivityServiceV2();
