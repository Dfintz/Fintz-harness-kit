/**
 * Example Backend Integration with @sc-fleet-manager/shared-types
 * 
 * This file demonstrates how to use shared types in backend controllers
 * and services to maintain type consistency with the frontend.
 */

import {
  // Model types
  Fleet,
  FleetV2,
  Ship as _Ship,
  Activity,
  Organization as _Organization,
  User,
  
  // API request types
  CreateFleetRequest,
  UpdateFleetRequest,
  CreateShipRequest as _CreateShipRequest,
  CreateActivityRequest as _CreateActivityRequest,
  
  // API response types
  ApiResponse,
  PaginatedResponse,
  ApiError,
  Pagination,
  ErrorCodes,
  
  // Query parameter types
  FleetListParams,
  ActivityListParams as _ActivityListParams,
  ShipListParams as _ShipListParams,
  
  // WebSocket event types
  FleetEvent,
  ActivityEvent,
  PresenceEvent,
} from '@sc-fleet-manager/shared-types';
import { Request, Response } from 'express';

/**
 * Fleet service interface
 */
interface IFleetService {
  create(orgId: string, data: CreateFleetRequest): Promise<Fleet>;
  update(fleetId: string, data: UpdateFleetRequest): Promise<Fleet>;
  list(params: FleetListParams): Promise<FleetV2[]>;
  count(params: FleetListParams): Promise<number>;
  findById(fleetId: string): Promise<Fleet | null>;
}

// Example: Controller using shared types
export class ExampleFleetController {
  constructor(private fleetService: IFleetService) {}
  /**
   * Create a new fleet
   * POST /api/v2/organizations/:orgId/fleets
   */
  async createFleet(req: Request, res: Response): Promise<void> {
    // Request body is typed
    const createData: CreateFleetRequest = req.body;
    const { orgId } = req.params;
    
    // Service call returns typed fleet
    const fleet: Fleet = await this.fleetService.create(orgId, createData);
    
    // Response is typed
    const response: ApiResponse<Fleet> = {
      success: true,
      data: fleet,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
    
    res.json(response);
  }
  
  /**
   * List fleets with pagination
   * GET /api/v2/organizations/:orgId/fleets
   */
  async listFleets(req: Request, res: Response): Promise<void> {
    const { orgId } = req.params;
    
    // Query params are typed
    const params: FleetListParams = {
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      sortBy: req.query.sortBy as string,
      sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      organizationId: orgId,
      isActive: req.query.isActive === 'true',
    };
    
    const fleets: FleetV2[] = await this.fleetService.list(params);
    const total = await this.fleetService.count(params);
    
    // Calculate pagination
    const pagination: Pagination = {
      page: params.page || 1,
      limit: params.limit || 20,
      total,
      totalPages: Math.ceil(total / (params.limit || 20)),
      hasNext: (params.page || 1) * (params.limit || 20) < total,
      hasPrev: (params.page || 1) > 1,
    };
    
    // Paginated response is typed
    const response: PaginatedResponse<FleetV2> = {
      success: true,
      data: fleets,
      pagination,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
    
    res.json(response);
  }
  
  /**
   * Handle errors with typed error responses
   */
  async getFleet(req: Request, res: Response): Promise<void> {
    const { fleetId } = req.params;
    
    const fleet = await this.fleetService.findById(fleetId);
    
    if (!fleet) {
      // Error response is typed
      const error: ApiError = {
        success: false,
        error: {
          code: ErrorCodes.FLEET_NOT_FOUND,
          message: 'Fleet not found',
          details: [
            {
              field: 'fleetId',
              message: `Fleet with ID ${fleetId} does not exist`,
            },
          ],
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      
      res.status(404).json(error);
      return;
    }
    
    const response: ApiResponse<Fleet> = {
      success: true,
      data: fleet,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
    
    res.json(response);
  }
  
  // Private service instance
  // constructor(private fleetService: IFleetService) {}
}

// Example: WebSocket integration with shared types
export class ExampleWebSocketController {
  /**
   * Emit fleet created event
   */
  emitFleetCreated(socket: any, fleet: Fleet, userId: string): void {
    const event: FleetEvent = {
      type: 'fleet:created',
      fleetId: fleet.id,
      organizationId: fleet.organizationId,
      data: fleet,
      timestamp: Date.now(),
      userId,
    };
    
    socket.emit('fleet:created', event);
  }
  
  /**
   * Emit activity updated event
   */
  emitActivityUpdated(socket: any, activity: Activity, userId: string): void {
    const event: ActivityEvent = {
      type: 'activity:updated',
      activityId: activity.id,
      organizationId: activity.organizationId,
      data: activity,
      timestamp: Date.now(),
      userId,
    };
    
    socket.emit('activity:updated', event);
  }
  
  /**
   * Emit user presence event
   */
  emitUserOnline(socket: any, user: User): void {
    const event: PresenceEvent = {
      type: 'user:online',
      userId: user.id,
      status: 'online',
      timestamp: Date.now(),
      data: {
        lastSeen: Date.now(),
      },
    };
    
    socket.emit('user:online', event);
  }
}

/**
 * Example: Service layer using shared types
 */
export class ExampleFleetService implements IFleetService {
  /**
   * Create fleet with typed parameters
   */
  async create(_orgId: string, _data: CreateFleetRequest): Promise<Fleet> {
    // Implementation
    throw new Error('Not implemented');
  }
  
  /**
   * Update fleet with typed parameters
   */
  async update(_fleetId: string, _data: UpdateFleetRequest): Promise<Fleet> {
    // Implementation
    throw new Error('Not implemented');
  }
  
  /**
   * List fleets with typed parameters
   */
  async list(_params: FleetListParams): Promise<FleetV2[]> {
    // Implementation
    throw new Error('Not implemented');
  }
  
  /**
   * Count fleets with typed parameters
   */
  async count(_params: FleetListParams): Promise<number> {
    // Implementation
    throw new Error('Not implemented');
  }
  
  /**
   * Find fleet by ID
   */
  async findById(_fleetId: string): Promise<Fleet | null> {
    // Implementation
    throw new Error('Not implemented');
  }
}
