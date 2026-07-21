/**
 * Ship Resolvers
 */

import { GraphQLError } from 'graphql';

import { GraphQLContext } from '../context';

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

export interface ShipSortInput {
  field: string;
  order?: 'ASC' | 'DESC';
}

export interface CreateShipInput {
  name?: string;
  modelName: string;
  role: string;
  status?: string;
  value?: number;
  isInsured?: boolean;
  insuranceType?: string;
  notes?: string;
  fleetId?: string;
}

export interface UpdateShipInput {
  name?: string;
  role?: string;
  status?: string;
  value?: number;
  isInsured?: boolean;
  insuranceType?: string;
  notes?: string;
  fleetId?: string;
}

export const shipResolvers = {
  Query: {
    /**
     * Get ships for the current user
     */
    myShips: async (
      _: unknown,
      args: {
        pagination?: PaginationInput;
        filter?: ShipFilterInput;
        sort?: ShipSortInput;
      },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      
      return {
        nodes: [],
        pageInfo: {
          page: args.pagination?.page || 1,
          limit: args.pagination?.limit || 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        totalCount: 0,
      };
    },
    
    /**
     * Get ships for an organization
     */
    organizationShips: async (
      _: unknown,
      args: {
        organizationId: string;
        pagination?: PaginationInput;
        filter?: ShipFilterInput;
        sort?: ShipSortInput;
      },
      _context: GraphQLContext
    ) => ({
        nodes: [],
        pageInfo: {
          page: args.pagination?.page || 1,
          limit: args.pagination?.limit || 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        totalCount: 0,
      }),
    
    /**
     * Get a ship by ID
     * Uses DataLoader to batch and cache ship queries
     */
    ship: async (_: unknown, args: { id: string }, context: GraphQLContext) => 
      // Use DataLoader to batch ship queries - prevents N+1
       context.loaders.shipById.load(args.id)
    ,
    
    /**
     * Get available ship models
     */
    shipModels: async (
      _: unknown,
      _args: { manufacturer?: string; role?: string },
      _context: GraphQLContext
    ) => 
      // In a real implementation, this would fetch from ship database
       []
    ,
  },
  
  Mutation: {
    /**
     * Create a new ship
     */
    createShip: async (
      _: unknown,
      args: { input: CreateShipInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      
      try {
        const ship = {
          id: 'new-ship-id',
          ...args.input,
          status: args.input.status || 'OWNED',
          isInsured: args.input.isInsured || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        return {
          success: true,
          errors: null,
          ship,
        };
      } catch (_error) {
        return {
          success: false,
          errors: [{ code: 'CREATE_FAILED', message: 'Failed to create ship' }],
          ship: null,
        };
      }
    },
    
    /**
     * Update a ship
     */
    updateShip: async (
      _: unknown,
      args: { id: string; input: UpdateShipInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      
      return {
        success: true,
        errors: null,
        ship: null,
      };
    },
    
    /**
     * Delete a ship
     */
    deleteShip: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      
      return {
        success: true,
        errors: null,
      };
    },
    
    /**
     * Bulk create ships
     */
    bulkCreateShips: async (
      _: unknown,
      args: { ships: CreateShipInput[] },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      
      return args.ships.map((ship, index) => ({
        success: true,
        errors: null,
        ship: {
          id: `new-ship-${index}`,
          ...ship,
          status: ship.status || 'OWNED',
          isInsured: ship.isInsured || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }));
    },
  },
  
  Ship: {
    /**
     * Get ship owner
     * Uses DataLoader to batch and cache user queries
     */
    owner: async (parent: { ownerId?: string }, _: unknown, context: GraphQLContext) => {
      if (!parent.ownerId) {return null;}
      // Use DataLoader to batch user queries - prevents N+1
      return context.loaders.userById.load(parent.ownerId);
    },
    
    /**
     * Get ship's fleet
     * Uses DataLoader to batch and cache fleet queries
     */
    fleet: async (parent: { fleetId?: string }, _: unknown, context: GraphQLContext) => {
      if (!parent.fleetId) {return null;}
      // Use DataLoader to batch fleet queries - prevents N+1
      return context.loaders.fleetById.load(parent.fleetId);
    },
    
    /**
     * Get ship manufacturer
     */
    manufacturer: async (parent: { manufacturerCode?: string }, _: unknown, _context: GraphQLContext) => ({
        code: parent.manufacturerCode || 'UNKNOWN',
        name: 'Unknown Manufacturer',
      }),
  },
};
