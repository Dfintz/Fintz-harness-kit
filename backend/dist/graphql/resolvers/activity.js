"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityResolvers = void 0;
const graphql_1 = require("graphql");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const activitySchemas_1 = require("../../schemas/activitySchemas");
const subscriptions_1 = require("../subscriptions");
const validation_1 = require("../validation");
exports.activityResolvers = {
    Query: {
        activities: async (_, args, _context) => ({
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
        upcomingActivities: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
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
        activity: async (_, args, context) => context.loaders.activityById.load(args.id),
        myActivities: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
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
        createActivity: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            try {
                const validatedData = (0, validation_1.validateGraphQLInput)({
                    organizationId: args.organizationId,
                    ...args.input,
                }, activitySchemas_1.activitySchemas.createV2, { context: 'createActivity' });
                const activity = {
                    id: 'new-activity-id',
                    ...validatedData,
                    status: validatedData.status || 'draft',
                    requiresConfirmation: args.input.requiresConfirmation || false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.ACTIVITY_UPDATED, {
                    activityUpdated: activity,
                    organizationId: args.organizationId,
                });
                return {
                    success: true,
                    errors: null,
                    activity,
                };
            }
            catch (error) {
                if (error instanceof graphql_1.GraphQLError) {
                    throw error;
                }
                return {
                    success: false,
                    errors: [{ code: 'CREATE_FAILED', message: 'Failed to create activity' }],
                    activity: null,
                };
            }
        },
        updateActivity: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            try {
                const validatedData = (0, validation_1.validateGraphQLInput)(args.input, activitySchemas_1.activitySchemas.updateV2, {
                    context: 'updateActivity',
                });
                return {
                    success: true,
                    errors: null,
                    activity: {
                        id: args.id,
                        ...validatedData,
                        updatedAt: new Date(),
                    },
                };
            }
            catch (error) {
                if (error instanceof graphql_1.GraphQLError) {
                    throw error;
                }
                return {
                    success: false,
                    errors: [{ code: 'UPDATE_FAILED', message: 'Failed to update activity' }],
                    activity: null,
                };
            }
        },
        deleteActivity: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return {
                success: true,
                errors: null,
            };
        },
        cancelActivity: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return {
                success: true,
                errors: null,
                activity: null,
            };
        },
        joinActivity: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
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
            void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.PARTICIPANT_UPDATED, {
                participantUpdated: participant,
                activityId: args.activityId,
            });
            return {
                success: true,
                errors: null,
                participant,
            };
        },
        leaveActivity: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return {
                success: true,
                errors: null,
            };
        },
        updateParticipation: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
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
        activityUpdated: {
            subscribe: (0, graphql_subscriptions_1.withFilter)(() => subscriptions_1.pubsub.asyncIterator([subscriptions_1.SUBSCRIPTION_EVENTS.ACTIVITY_UPDATED]), (payload, variables) => payload.organizationId === variables.organizationId),
        },
        participantUpdated: {
            subscribe: (0, graphql_subscriptions_1.withFilter)(() => subscriptions_1.pubsub.asyncIterator([subscriptions_1.SUBSCRIPTION_EVENTS.PARTICIPANT_UPDATED]), (payload, variables) => payload.activityId === variables.activityId),
        },
    },
    Activity: {
        organization: async (parent, _, context) => context.loaders.organizationById.load(parent.organizationId),
        organizer: async (parent, _, context) => context.loaders.userById.load(parent.creatorId),
        participants: async (parent, args, _context) => ({
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
        statistics: async (_parent, _, _context) => ({
            totalParticipants: 0,
            confirmedParticipants: 0,
            declinedParticipants: 0,
            tentativeParticipants: 0,
            remainingSpots: null,
        }),
    },
};
//# sourceMappingURL=activity.js.map