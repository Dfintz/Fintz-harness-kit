"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userResolvers = void 0;
const graphql_1 = require("graphql");
exports.userResolvers = {
    Query: {
        me: async (_, __, context) => {
            if (!context.user) {
                return null;
            }
            return {
                id: context.user.id,
                username: context.user.username,
                email: context.user.email,
            };
        },
        user: async (_, args, context) => context.loaders.userById.load(args.id),
        searchUsers: async (_, _args, _context) => [],
    },
    Mutation: {
        updateProfile: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            try {
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
            }
            catch (_error) {
                return {
                    success: false,
                    errors: [{ code: 'UPDATE_FAILED', message: 'Failed to update profile' }],
                    user: null,
                };
            }
        },
    },
    User: {
        ships: async (parent, args, context) => {
            const ships = await context.loaders.shipsByUserId.load(parent.id);
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
        organizations: async (parent, _, context) => context.loaders.organizationsByUserId.load(parent.id),
        activities: async (parent, args, context) => {
            const activities = await context.loaders.activitiesByUserId.load(parent.id);
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
//# sourceMappingURL=user.js.map