/**
 * Fleet Resolvers
 */

import { GraphQLError } from 'graphql';
import { withFilter } from 'graphql-subscriptions';

import { FleetAuditAction, fleetAuditLogger } from '../../services/fleet/FleetAuditLogger';
import { FleetService } from '../../services/fleet/FleetService';
import {
  ConflictError,
  FleetNotFoundError,
  ShipNotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { GraphQLContext } from '../context';
import { pubsub, SUBSCRIPTION_EVENTS } from '../subscriptions';

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface ShipFilterInput {
  role?: string;
  status?: string;
  manufacturer?: string;
  minSize?: number;
  maxSize?: number;
  search?: string;
}

export interface FleetSortInput {
  field: string;
  order?: 'ASC' | 'DESC';
}

export interface CreateFleetInput {
  name: string;
  description?: string;
  visibility?: string;
  maxCapacity?: number;
}

export interface UpdateFleetInput {
  name?: string;
  description?: string;
  visibility?: string;
  maxCapacity?: number;
}

export const fleetResolvers = {
  Query: {
    /**
     * Get fleets for an organization
     */
    fleets: async (
      _: unknown,
      args: {
        organizationId: string;
        pagination?: PaginationInput;
        sort?: FleetSortInput;
      },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Tenant authorization: caller must be a member of the requested organization.
      // organizationIds is populated from the JWT by getUserFromRequest in context.ts.
      const userOrgs = context.user.organizationIds ?? [];
      if (!userOrgs.includes(args.organizationId)) {
        throw new GraphQLError('Forbidden', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const fleetService = context.container.resolve(FleetService);
      const page = args.pagination?.page ?? 1;
      const limit = args.pagination?.limit ?? 20;
      const sortBy = args.sort?.field;
      const sortOrder = args.sort?.order;

      const result = await fleetService.getFleets(args.organizationId, {
        page,
        limit,
        ...(sortBy ? { sortBy } : {}),
        ...(sortOrder ? { sortOrder } : {}),
      });

      return {
        nodes: result.data,
        pageInfo: {
          page: result.pagination.page,
          limit: result.pagination.limit,
          total: result.pagination.total,
          totalPages: result.pagination.totalPages,
          hasNextPage: result.pagination.hasNext,
          hasPreviousPage: result.pagination.hasPrev,
        },
        totalCount: result.pagination.total,
      };
    },

    /**
     * Get a fleet by ID
     * Uses DataLoader to batch and cache fleet queries
     */
    fleet: async (_: unknown, args: { id: string }, context: GraphQLContext) =>
      // Use DataLoader to batch fleet queries - prevents N+1
      context.loaders.fleetById.load(args.id),
  },

  Mutation: {
    /**
     * Create a new fleet
     */
    createFleet: async (
      _: unknown,
      args: { organizationId: string; input: CreateFleetInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      // Tenant authorization
      const userOrgs = context.user.organizationIds ?? [];
      if (!userOrgs.includes(args.organizationId)) {
        throw new GraphQLError('Forbidden', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const fleetService = context.container.resolve(FleetService);

      try {
        // Note: `maxCapacity` is a GraphQL-schema-only field with no
        // corresponding column on the Fleet entity, so it is ignored here.
        const created = await fleetService.createFleet(args.organizationId, {
          name: args.input.name,
          ...(args.input.description === undefined ? {} : { description: args.input.description }),
          ...(args.input.visibility ? { visibility: args.input.visibility } : {}),
        });

        // postCreateFleet emits FLEET_CREATED audit log and provisions the team
        const fleet = await fleetService.postCreateFleet(args.organizationId, created);

        void pubsub.publish(SUBSCRIPTION_EVENTS.FLEET_UPDATED, {
          fleetUpdated: fleet,
          organizationId: args.organizationId,
        });

        return {
          success: true,
          errors: null,
          fleet,
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            success: false,
            errors: [{ code: 'VALIDATION_ERROR', message: error.message }],
            fleet: null,
          };
        }
        if (error instanceof ConflictError) {
          return {
            success: false,
            errors: [{ code: 'CONFLICT', message: error.message }],
            fleet: null,
          };
        }
        logger.error('GraphQL createFleet failed', {
          organizationId: args.organizationId,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          errors: [{ code: 'CREATE_FAILED', message: 'Failed to create fleet' }],
          fleet: null,
        };
      }
    },

    /**
     * Update a fleet
     */
    updateFleet: async (
      _: unknown,
      args: { id: string; input: UpdateFleetInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const fleetService = context.container.resolve(FleetService);

      // Resolve fleet and authorize tenant access
      const existing = await context.loaders.fleetById.load(args.id);
      if (!existing) {
        return {
          success: false,
          errors: [{ code: 'NOT_FOUND', message: 'Fleet not found' }],
          fleet: null,
        };
      }
      const userOrgs = context.user.organizationIds ?? [];
      if (!userOrgs.includes(existing.organizationId)) {
        throw new GraphQLError('Forbidden', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      try {
        // maxCapacity is GraphQL-schema-only and is omitted from persistence.
        const updates: Record<string, unknown> = {};
        if (args.input.name !== undefined) {
          updates.name = args.input.name;
        }
        if (args.input.description !== undefined) {
          updates.description = args.input.description;
        }
        if (args.input.visibility !== undefined) {
          updates.visibility = args.input.visibility;
        }

        const updated = await fleetService.updateFleet(existing.organizationId, args.id, updates);

        if (!updated) {
          return {
            success: false,
            errors: [{ code: 'NOT_FOUND', message: 'Fleet not found' }],
            fleet: null,
          };
        }

        fleetAuditLogger.log({
          action: FleetAuditAction.FLEET_UPDATED,
          fleetId: updated.id,
          fleetName: updated.name,
          organizationId: updated.organizationId,
          performedById: context.user.id,
          details: { changes: updates },
        });

        void pubsub.publish(SUBSCRIPTION_EVENTS.FLEET_UPDATED, {
          fleetUpdated: updated,
          organizationId: updated.organizationId,
        });

        return {
          success: true,
          errors: null,
          fleet: updated,
        };
      } catch (error) {
        if (error instanceof ValidationError) {
          return {
            success: false,
            errors: [{ code: 'VALIDATION_ERROR', message: error.message }],
            fleet: null,
          };
        }
        logger.error('GraphQL updateFleet failed', {
          fleetId: args.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          errors: [{ code: 'UPDATE_FAILED', message: 'Failed to update fleet' }],
          fleet: null,
        };
      }
    },

    /**
     * Delete a fleet
     */
    deleteFleet: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const fleetService = context.container.resolve(FleetService);

      const existing = await context.loaders.fleetById.load(args.id);
      if (!existing) {
        return {
          success: false,
          errors: [{ code: 'NOT_FOUND', message: 'Fleet not found' }],
        };
      }
      const userOrgs = context.user.organizationIds ?? [];
      if (!userOrgs.includes(existing.organizationId)) {
        throw new GraphQLError('Forbidden', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      try {
        // FleetService.deleteFleet emits the FLEET_DELETED audit log internally.
        await fleetService.deleteFleet(existing.organizationId, args.id);
        return {
          success: true,
          errors: null,
        };
      } catch (error) {
        logger.error('GraphQL deleteFleet failed', {
          fleetId: args.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          errors: [{ code: 'DELETE_FAILED', message: 'Failed to delete fleet' }],
        };
      }
    },

    /**
     * Add a ship to a fleet
     */
    addShipToFleet: async (
      _: unknown,
      args: { fleetId: string; shipId: string },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const existing = await context.loaders.fleetById.load(args.fleetId);
      if (!existing) {
        return {
          success: false,
          errors: [{ code: 'NOT_FOUND', message: 'Fleet not found' }],
          fleet: null,
        };
      }
      const userOrgs = context.user.organizationIds ?? [];
      if (!userOrgs.includes(existing.organizationId)) {
        throw new GraphQLError('Forbidden', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const fleetService = context.container.resolve(FleetService);

      try {
        const { fleet } = await fleetService.addShipToFleet(
          existing.organizationId,
          args.fleetId,
          args.shipId,
          { performedById: context.user.id }
        );

        void pubsub.publish(SUBSCRIPTION_EVENTS.FLEET_SHIP_CHANGED, {
          fleetShipChanged: {
            type: 'ADDED',
            ship: { id: args.shipId },
            fleet: { id: args.fleetId },
          },
        });
        void pubsub.publish(SUBSCRIPTION_EVENTS.FLEET_UPDATED, {
          fleetUpdated: fleet,
          organizationId: fleet.organizationId,
        });

        return {
          success: true,
          errors: null,
          fleet,
        };
      } catch (error) {
        if (error instanceof FleetNotFoundError || error instanceof ShipNotFoundError) {
          return {
            success: false,
            errors: [{ code: 'NOT_FOUND', message: error.message }],
            fleet: null,
          };
        }
        if (error instanceof ValidationError) {
          return {
            success: false,
            errors: [{ code: 'VALIDATION_ERROR', message: error.message }],
            fleet: null,
          };
        }
        if (error instanceof ConflictError) {
          return {
            success: false,
            errors: [{ code: 'CONFLICT', message: error.message }],
            fleet: null,
          };
        }
        logger.error('GraphQL addShipToFleet failed', {
          fleetId: args.fleetId,
          shipId: args.shipId,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          errors: [{ code: 'ADD_SHIP_FAILED', message: 'Failed to add ship to fleet' }],
          fleet: null,
        };
      }
    },

    /**
     * Remove a ship from a fleet
     */
    removeShipFromFleet: async (
      _: unknown,
      args: { fleetId: string; shipId: string },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const existing = await context.loaders.fleetById.load(args.fleetId);
      if (!existing) {
        return {
          success: false,
          errors: [{ code: 'NOT_FOUND', message: 'Fleet not found' }],
          fleet: null,
        };
      }
      const userOrgs = context.user.organizationIds ?? [];
      if (!userOrgs.includes(existing.organizationId)) {
        throw new GraphQLError('Forbidden', {
          extensions: { code: 'FORBIDDEN' },
        });
      }

      const fleetService = context.container.resolve(FleetService);

      try {
        const { fleet } = await fleetService.removeShipFromFleet(
          existing.organizationId,
          args.fleetId,
          args.shipId,
          { performedById: context.user.id }
        );

        void pubsub.publish(SUBSCRIPTION_EVENTS.FLEET_SHIP_CHANGED, {
          fleetShipChanged: {
            type: 'REMOVED',
            ship: { id: args.shipId },
            fleet: { id: args.fleetId },
          },
        });
        void pubsub.publish(SUBSCRIPTION_EVENTS.FLEET_UPDATED, {
          fleetUpdated: fleet,
          organizationId: fleet.organizationId,
        });

        return {
          success: true,
          errors: null,
          fleet,
        };
      } catch (error) {
        if (error instanceof FleetNotFoundError || error instanceof ShipNotFoundError) {
          return {
            success: false,
            errors: [{ code: 'NOT_FOUND', message: error.message }],
            fleet: null,
          };
        }
        logger.error('GraphQL removeShipFromFleet failed', {
          fleetId: args.fleetId,
          shipId: args.shipId,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          errors: [{ code: 'REMOVE_SHIP_FAILED', message: 'Failed to remove ship from fleet' }],
          fleet: null,
        };
      }
    },
  },

  Subscription: {
    /**
     * Subscribe to fleet updates
     */
    fleetUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.FLEET_UPDATED]),
        (payload, variables) => payload.organizationId === variables.organizationId
      ),
    },

    /**
     * Subscribe to ship changes in a fleet
     */
    fleetShipChanged: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.FLEET_SHIP_CHANGED]),
        (payload, variables) => payload.fleetShipChanged.fleet.id === variables.fleetId
      ),
    },
  },

  Fleet: {
    /**
     * Get organization for a fleet
     * Uses DataLoader to batch and cache organization queries
     */
    organization: async (parent: { organizationId: string }, _: unknown, context: GraphQLContext) =>
      // Use DataLoader to batch organization queries - prevents N+1
      context.loaders.organizationById.load(parent.organizationId),
    /**
     * Get ships in a fleet
     * Uses DataLoader to batch and cache ship queries
     */
    ships: async (
      parent: { id: string },
      args: { pagination?: PaginationInput; filter?: ShipFilterInput },
      context: GraphQLContext
    ) => {
      // Use DataLoader to batch ship queries
      let ships = await context.loaders.shipsByFleetId.load(parent.id);

      // Apply filters if provided
      if (args.filter) {
        if (args.filter.role) {
          ships = ships.filter((s: { role?: string }) => s.role === args.filter?.role);
        }
        if (args.filter.status) {
          ships = ships.filter((s: { status?: string }) => s.status === args.filter?.status);
        }
        if (args.filter.manufacturer) {
          ships = ships.filter(
            (s: { manufacturer?: string }) => s.manufacturer === args.filter?.manufacturer
          );
        }
      }

      // Apply pagination
      const page = args.pagination?.page || 1;
      const limit = args.pagination?.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedShips = ships.slice(startIndex, endIndex);
      const totalPages = Math.ceil(ships.length / limit);

      return {
        nodes: paginatedShips,
        pageInfo: {
          page,
          limit,
          total: ships.length,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        totalCount: ships.length,
      };
    },

    /**
     * Get fleet statistics
     */
    statistics: async (_parent: { id: string }, _: unknown, _context: GraphQLContext) => ({
      shipCount: 0,
      totalCargoCapacity: 0,
      totalCrewCapacity: 0,
      totalValue: 0,
      averageShipSize: 0,
    }),

    /**
     * Get fleet composition
     */
    composition: async (_parent: { id: string }, _: unknown, _context: GraphQLContext) => ({
      combat: 0,
      mining: 0,
      cargo: 0,
      exploration: 0,
      salvage: 0,
      medical: 0,
      support: 0,
      multiRole: 0,
      other: 0,
    }),
  },
};
