"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.organizationResolvers = void 0;
const graphql_1 = require("graphql");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const subscriptions_1 = require("../subscriptions");
exports.organizationResolvers = {
    Query: {
        myOrganizations: async (_, __, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return [];
        },
        organization: async (_, args, context) => context.loaders.organizationById.load(args.id),
        organizationBySlug: async (_, _args, _context) => null,
        searchOrganizations: async (_, _args, _context) => [],
    },
    Mutation: {
        createOrganization: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            try {
                const organization = {
                    id: 'new-org-id',
                    ...args.input,
                    isVerified: false,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };
                return {
                    success: true,
                    errors: null,
                    organization,
                };
            }
            catch (_error) {
                return {
                    success: false,
                    errors: [{ code: 'CREATE_FAILED', message: 'Failed to create organization' }],
                    organization: null,
                };
            }
        },
        updateOrganization: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return {
                success: true,
                errors: null,
                organization: null,
            };
        },
        deleteOrganization: async (_, args, context) => {
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
        inviteMember: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return {
                success: true,
                errors: null,
                member: null,
            };
        },
        updateMemberRole: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.MEMBER_CHANGED, {
                memberChanged: {
                    type: 'UPDATED',
                    member: { user: { id: args.input.userId }, role: args.input.role },
                    organization: { id: args.organizationId },
                },
            });
            return {
                success: true,
                errors: null,
                member: null,
            };
        },
        removeMember: async (_, args, context) => {
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
        leaveOrganization: async (_, args, context) => {
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
    },
    Subscription: {
        memberChanged: {
            subscribe: (0, graphql_subscriptions_1.withFilter)(() => subscriptions_1.pubsub.asyncIterator([subscriptions_1.SUBSCRIPTION_EVENTS.MEMBER_CHANGED]), (payload, variables) => payload.memberChanged.organization.id === variables.organizationId),
        },
    },
    Organization: {
        statistics: async (_parent, _, _context) => ({
            memberCount: 0,
            shipCount: 0,
            fleetCount: 0,
            activityCount: 0,
            totalShipValue: 0,
        }),
        members: async (parent, args, _context) => ({
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
        fleets: async (parent, args, context) => {
            const fleets = await context.loaders.fleetsByOrganizationId.load(parent.id);
            const page = args.pagination?.page || 1;
            const limit = args.pagination?.limit || 20;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedFleets = fleets.slice(startIndex, endIndex);
            const totalPages = Math.ceil(fleets.length / limit);
            return {
                nodes: paginatedFleets,
                pageInfo: {
                    page,
                    limit,
                    total: fleets.length,
                    totalPages,
                    hasNextPage: page < totalPages,
                    hasPreviousPage: page > 1,
                },
                totalCount: fleets.length,
            };
        },
        activities: async (parent, args, context) => {
            let activities = await context.loaders.activitiesByOrganizationId.load(parent.id);
            if (args.upcoming) {
                const now = new Date();
                activities = activities.filter((a) => a.scheduledStartDate && new Date(a.scheduledStartDate) > now);
            }
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
//# sourceMappingURL=organization.js.map