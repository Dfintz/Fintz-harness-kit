/**
 * Example Frontend Integration with @sc-fleet-manager/shared-types
 *
 * This file demonstrates how to use shared types in React components
 * and services to maintain type consistency with the backend.
 *
 * Updated to use TanStack Query for data fetching instead of manual
 * useEffect/useState patterns.
 */

import { useCreateFleet, useFleets } from '@/hooks/queries';
import { logger } from '@/utils/logger';
import {
  ActivityEvent,
  ApiError,
  // API response types
  ApiResponse,
  // API request types
  CreateFleetRequest,
  ErrorCodes,
  // Model types
  Fleet,
  // WebSocket event types
  FleetEvent,
  // Query parameter types
  FleetListParams,
  FleetV2,
  Notification,
  PaginatedResponse,
  PresenceEvent,
  UpdateFleetRequest,
} from '@sc-fleet-manager/shared-types';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Example: API service using shared types
 *
 * Note: In production, use TanStack Query hooks instead of direct API calls.
 * This service is kept for demonstration purposes only.
 */
export class ExampleFleetApiService {
  private baseURL = '/api/v2';

  /**
   * Fetch fleets with typed response
   *
   * @deprecated Use useFleets() hook instead
   */
  async getFleets(orgId: string, params?: FleetListParams): Promise<FleetV2[]> {
    try {
      const response = await axios.get<PaginatedResponse<FleetV2>>(
        `${this.baseURL}/organizations/${orgId}/fleets`,
        { params }
      );

      return response.data.data;
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  /**
   * Create fleet with typed request and response
   *
   * @deprecated Use useCreateFleet() hook instead
   */
  async createFleet(orgId: string, data: CreateFleetRequest): Promise<Fleet | null> {
    try {
      const response = await axios.post<ApiResponse<Fleet>>(
        `${this.baseURL}/organizations/${orgId}/fleets`,
        data
      );

      return response.data.data;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Update fleet with typed request and response
   *
   * @deprecated Use useUpdateFleet() hook instead
   */
  async updateFleet(fleetId: string, data: UpdateFleetRequest): Promise<Fleet | null> {
    try {
      const response = await axios.put<ApiResponse<Fleet>>(
        `${this.baseURL}/fleets/${fleetId}`,
        data
      );

      return response.data.data;
    } catch (error) {
      this.handleError(error);
      return null;
    }
  }

  /**
   * Handle errors with typed error responses
   */
  private handleError(error: unknown): void {
    if (axios.isAxiosError(error) && error.response) {
      const apiError = error.response.data as ApiError;

      // Handle specific error codes
      switch (apiError.error.code) {
        case ErrorCodes.FLEET_NOT_FOUND:
          logger.error('Fleet not found', new Error('Fleet not found'));
          break;
        case ErrorCodes.FLEET_CAPACITY_EXCEEDED:
          logger.error('Fleet capacity exceeded', new Error('Fleet capacity exceeded'));
          break;
        case ErrorCodes.UNAUTHORIZED:
          logger.error('Unauthorized access', new Error('Unauthorized access'));
          break;
        default:
          logger.error('API error:', new Error(`API error: ${apiError.error.message}`));
      }
    } else {
      logger.error('Unknown error:', error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Example: React component using TanStack Query hooks and shared types
 *
 * This demonstrates the modern approach to data fetching with automatic
 * caching, background updates, and optimistic updates.
 */
export function ExampleFleetListComponent({ organizationId }: { organizationId: string }) {
  const [error, setError] = useState<string | null>(null);

  // Fetch fleets using TanStack Query hook
  const { data: fleetsResult, isLoading } = useFleets(organizationId);
  const fleets = fleetsResult?.items ?? [];

  // Create fleet mutation
  const createFleetMutation = useCreateFleet();

  async function handleCreateFleet(name: string) {
    setError(null);

    const createData: CreateFleetRequest = {
      name,
      description: 'New fleet',
    };

    try {
      await createFleetMutation.mutateAsync({
        organizationId,
        data: createData,
      });
      // No need to reload - TanStack Query automatically updates the cache
    } catch (err) {
      setError('Failed to create fleet');
    }
  }

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Fleets</h2>
      <ul>
        {fleets.map(fleet => (
          <li key={fleet.id}>
            {fleet.name} - {fleet.memberCount} members, {fleet.shipCount} ships
          </li>
        ))}
      </ul>
      <button
        onClick={() => handleCreateFleet('New Fleet')}
        disabled={createFleetMutation.isPending}
      >
        {createFleetMutation.isPending ? 'Creating...' : 'Create Fleet'}
      </button>
    </div>
  );
}

/**
 * Example: WebSocket hook using shared types
 */
export function useWebSocketEvents(organizationId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3000', {
      query: { organizationId },
    });

    // Fleet events
    newSocket.on('fleet:created', (_event: FleetEvent) => {
      // Debug log removed
      // Update UI with new fleet
    });

    newSocket.on('fleet:updated', (_event: FleetEvent) => {
      // Debug log removed
      // Update UI with updated fleet
    });

    // Activity events
    newSocket.on('activity:created', (_event: ActivityEvent) => {
      // Debug log removed
      // Update UI with new activity
    });

    newSocket.on('activity:participant_joined', (_event: ActivityEvent) => {
      // Debug log removed
      // Update UI with participant info
    });

    // Presence events
    newSocket.on('user:online', (_event: PresenceEvent) => {
      // Debug log removed
      // Update user presence UI
    });

    newSocket.on('user:offline', (_event: PresenceEvent) => {
      // Debug log removed
      // Update user presence UI
    });

    // Notification events
    newSocket.on('notification:new', (data: { notification: Notification }) => {
      setNotifications(prev => [...prev, data.notification]);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, [organizationId]);

  return { socket, notifications };
}

/**
 * Example: Custom hook for fleet management using TanStack Query
 *
 * @deprecated This pattern is no longer needed. Use the individual TanStack Query
 * hooks directly (useFleets, useCreateFleet, useUpdateFleet, etc.) instead.
 *
 * This is kept for backward compatibility demonstration only.
 */
export function useFleetManagement(organizationId: string) {
  // Use TanStack Query hooks directly
  const { data: fleets = [], isLoading } = useFleets(organizationId);
  const createMutation = useCreateFleet();

  // Create fleet wrapper
  const createFleet = async (data: CreateFleetRequest) => {
    const result = await createMutation.mutateAsync({
      organizationId,
      data,
    });
    return result;
  };

  // Note: Update fleet should use useUpdateFleet() hook directly
  const updateFleet = async (fleetId: string, data: UpdateFleetRequest) => {
    // In production, use useUpdateFleet() hook at component level
    const apiService = new ExampleFleetApiService();
    return await apiService.updateFleet(fleetId, data);
  };

  return {
    fleets,
    loading: isLoading,
    loadFleets: () => {}, // No-op: TanStack Query handles this automatically
    createFleet,
    updateFleet,
  };
}
