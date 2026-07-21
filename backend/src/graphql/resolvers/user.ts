/**
 * User Resolvers
 */

import { GraphQLError } from 'graphql';

import { GraphQLContext } from '../context';

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface UpdateUserInput {
  displayName?: string;
  rsiHandle?: string;
  playStyle?: string;
  timezone?: string;
  bio?: string;
}

export const userResolvers = {
  Query: {
    /**
     * Get the currently authenticated user
     */
    me: async (_: unknown, __: unknown, context: GraphQLContext) => {
      if (!context.user) {
        return null;
      }
      
      // In a real implementation, this would fetch from the database
      return {
        id: context.user.id,
        username: context.user.username,
        email: context.user.email,
        // ... other fields would be fetched
      };
    },
    
    /**
     * Get a user by ID
     * Uses DataLoader to batch and cache user queries
     */
    user: async (_: unknown, args: { id: string }, context: GraphQLContext) => 
      // Use DataLoader to batch user queries - prevents N+1 when resolving users
       context.loaders.userById.load(args.id)
    ,
    
    /**
     * Search users
     */
    searchUsers: async (
      _: unknown,
      _args: { query: string; pagination?: PaginationInput },
      _context: GraphQLContext
    ) => 
      // In a real implementation, this would search users
       []
    ,
  },
  
  Mutation: {
    /**
     * Update the current user's profile
     */
    updateProfile: async (
      _: unknown,
      args: { input: UpdateUserInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }
      
      try {
        // In a real implementation, this would update via UserService
        return {
          success: true,
          errors: null,
          user: {
            id: context.user.id,
            username: context.user.username,
            ...args.input,
            isVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        };
      } catch (_error) {
        return {
          success: false,
          errors: [{ code: 'UPDATE_FAILED', message: 'Failed to update profile' }],
          user: null,
        };
      }
    },
  },
  
  User: {
    /**
     * Get ships owned by the user
     * Uses DataLoader to batch and cache ship queries across the request
     */
    ships: async (
      parent: { id: string },
      args: { pagination?: PaginationInput },
      context: GraphQLContext
    ) => {
      // Use DataLoader to batch ship queries
      const ships = await context.loaders.shipsByUserId.load(parent.id);
      
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
     * Get organizations the user belongs to
     * Uses DataLoader to batch and cache organization queries
     */
    organizations: async (parent: { id: string }, _: unknown, context: GraphQLContext) => 
      // Use DataLoader to batch organization queries
       context.loaders.organizationsByUserId.load(parent.id)
    ,
    
    /**
     * Get activities the user is participating in
     * Uses DataLoader to batch and cache activity queries
     */
    activities: async (
      parent: { id: string },
      args: { pagination?: PaginationInput },
      context: GraphQLContext
    ) => {
      // Use DataLoader to batch activity queries
      const activities = await context.loaders.activitiesByUserId.load(parent.id);
      
      // Apply pagination
      const page = args.pagination?.page || 1;
      const limit = args.pagination?.limit || 20;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedActivities = activities.slice(startIndex, endIndex);
      const totalPages = Math.ceil(activities.length / limit);
      
      return {
        nodes: paginatedActivities,
        pageInfo: {
          page,
          limit,
          total: activities.length,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        totalCount: activities.length,
      };
    },
  },
};
