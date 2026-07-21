/**
 * Activity Resolvers
 */

import { GraphQLError } from 'graphql';
import { withFilter } from 'graphql-subscriptions';

import { activitySchemas } from '../../schemas/activitySchemas';
import { GraphQLContext } from '../context';
import { pubsub, SUBSCRIPTION_EVENTS } from '../subscriptions';
import { validateGraphQLInput } from '../validation';

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface ActivityFilterInput {
  type?: string;
  status?: string;
  startTimeAfter?: Date;
  startTimeBefore?: Date;
  upcoming?: boolean;
  search?: string;
}

export interface ActivitySortInput {
  field: string;
  order?: 'ASC' | 'DESC';
}

export interface CreateActivityInput {
  title: string;
  description?: string;
  type: string;
  startTime: Date;
  endTime?: Date;
  durationMinutes?: number;
  location?: string;
  maxParticipants?: number;
  requiresConfirmation?: boolean;
  notes?: string;
}

export interface UpdateActivityInput {
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  maxParticipants?: number;
  notes?: string;
}

export interface JoinActivityInput {
  status?: string;
  role?: string;
  shipId?: string;
  notes?: string;
}

type ValidatedCreateActivityData = CreateActivityInput & {
  organizationId: string;
  status?: string;
};

type ValidatedUpdateActivityData = UpdateActivityInput;

export const activityResolvers = {
  Query: {
    /**
     * Get activities for an organization
     */
    activities: async (
      _: unknown,
      args: {
        organizationId: string;
        pagination?: PaginationInput;
        filter?: ActivityFilterInput;
        sort?: ActivitySortInput;
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
     * Get upcoming activities
     */
    upcomingActivities: async (
      _: unknown,
      args: { pagination?: PaginationInput },
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
     * Get an activity by ID
     * Uses DataLoader to batch and cache activity queries
     */
    activity: async (_: unknown, args: { id: string }, context: GraphQLContext) =>
      // Use DataLoader to batch activity queries - prevents N+1
      context.loaders.activityById.load(args.id),
    /**
     * Get activities the current user is participating in
     */
    myActivities: async (
      _: unknown,
      args: { pagination?: PaginationInput; filter?: ActivityFilterInput },
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
  },

  Mutation: {
    /**
     * Create a new activity
     * Validates input against activity schema before creating
     */
    createActivity: async (
      _: unknown,
      args: { organizationId: string; input: CreateActivityInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Validate input against activity schema
        const validatedData = validateGraphQLInput<ValidatedCreateActivityData>(
          {
            organizationId: args.organizationId,
            ...args.input,
          },
          activitySchemas.createV2,
          { context: 'createActivity' }
        );

        const activity = {
          id: 'new-activity-id',
          ...validatedData,
          status: validatedData.status || 'draft',
          requiresConfirmation: args.input.requiresConfirmation || false,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Publish activity updated event
        void pubsub.publish(SUBSCRIPTION_EVENTS.ACTIVITY_UPDATED, {
          activityUpdated: activity,
          organizationId: args.organizationId,
        });

        return {
          success: true,
          errors: null,
          activity,
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        return {
          success: false,
          errors: [{ code: 'CREATE_FAILED', message: 'Failed to create activity' }],
          activity: null,
        };
      }
    },

    /**
     * Update an activity
     * Validates input against activity schema before updating
     */
    updateActivity: async (
      _: unknown,
      args: { id: string; input: UpdateActivityInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      try {
        // Validate update input against schema
        const validatedData = validateGraphQLInput<ValidatedUpdateActivityData>(
          args.input,
          activitySchemas.updateV2,
          {
            context: 'updateActivity',
          }
        );

        return {
          success: true,
          errors: null,
          activity: {
            id: args.id,
            ...validatedData,
            updatedAt: new Date(),
          },
        };
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error;
        }
        return {
          success: false,
          errors: [{ code: 'UPDATE_FAILED', message: 'Failed to update activity' }],
          activity: null,
        };
      }
    },

    /**
     * Delete an activity
     */
    deleteActivity: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
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
     * Cancel an activity
     */
    cancelActivity: async (_: unknown, args: { id: string }, context: GraphQLContext) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      return {
        success: true,
        errors: null,
        activity: null,
      };
    },

    /**
     * Join an activity
     */
    joinActivity: async (
      _: unknown,
      args: { activityId: string; input?: JoinActivityInput },
      context: GraphQLContext
    ) => {
      if (!context.user) {
        throw new GraphQLError('Authentication required', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const participant = {
        user: { id: context.user.id, username: context.user.username },
        status: args.input?.status || 'CONFIRMED',
        role: args.input?.role,
        notes: args.input?.notes,
        joinedAt: new Date(),
        updatedAt: new Date(),
      };

      // Publish participant updated event
      void pubsub.publish(SUBSCRIPTION_EVENTS.PARTICIPANT_UPDATED, {
        participantUpdated: participant,
        activityId: args.activityId,
      });

      return {
        success: true,
        errors: null,
        participant,
      };
    },

    /**
     * Leave an activity
     */
    leaveActivity: async (_: unknown, args: { activityId: string }, context: GraphQLContext) => {
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
     * Update participation status
     */
    updateParticipation: async (
      _: unknown,
      args: { activityId: string; status: string },
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
        participant: null,
      };
    },
  },

  Subscription: {
    /**
     * Subscribe to activity updates
     */
    activityUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.ACTIVITY_UPDATED]),
        (payload, variables) => payload.organizationId === variables.organizationId
      ),
    },

    /**
     * Subscribe to participant updates
     */
    participantUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterator([SUBSCRIPTION_EVENTS.PARTICIPANT_UPDATED]),
        (payload, variables) => payload.activityId === variables.activityId
      ),
    },
  },

  Activity: {
    /**
     * Get organization for an activity
     * Uses DataLoader to batch and cache organization queries
     */
    organization: async (parent: { organizationId: string }, _: unknown, context: GraphQLContext) =>
      // Use DataLoader to batch organization queries - prevents N+1
      context.loaders.organizationById.load(parent.organizationId),
    /**
     * Get creator/organizer for an activity
     * Uses DataLoader to batch and cache user queries
     */
    organizer: async (parent: { creatorId: string }, _: unknown, context: GraphQLContext) =>
      // Use DataLoader to batch user queries - prevents N+1
      context.loaders.userById.load(parent.creatorId),
    /**
     * Get participants for an activity
     */
    participants: async (
      parent: { id: string },
      args: { pagination?: PaginationInput; status?: string },
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
     * Get activity statistics
     */
    statistics: async (_parent: { id: string }, _: unknown, _context: GraphQLContext) => ({
      totalParticipants: 0,
      confirmedParticipants: 0,
      declinedParticipants: 0,
      tentativeParticipants: 0,
      remainingSpots: null,
    }),
  },
};
