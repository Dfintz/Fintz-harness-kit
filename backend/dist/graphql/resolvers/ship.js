"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shipResolvers = void 0;
const graphql_1 = require("graphql");
exports.shipResolvers = {
    Query: {
        myShips: async (_, args, context) => {
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
        organizationShips: async (_, args, _context) => ({
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
        ship: async (_, args, context) => context.loaders.shipById.load(args.id),
        shipModels: async (_, _args, _context) => [],
    },
    Mutation: {
        createShip: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
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
            }
            catch (_error) {
                return {
                    success: false,
                    errors: [{ code: 'CREATE_FAILED', message: 'Failed to create ship' }],
                    ship: null,
                };
            }
        },
        updateShip: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            return {
                success: true,
                errors: null,
                ship: null,
            };
        },
        deleteShip: async (_, args, context) => {
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
        bulkCreateShips: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
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
        owner: async (parent, _, context) => {
            if (!parent.ownerId) {
                return null;
            }
            return context.loaders.userById.load(parent.ownerId);
        },
        fleet: async (parent, _, context) => {
            if (!parent.fleetId) {
                return null;
            }
            return context.loaders.fleetById.load(parent.fleetId);
        },
        manufacturer: async (parent, _, _context) => ({
            code: parent.manufacturerCode || 'UNKNOWN',
            name: 'Unknown Manufacturer',
        }),
    },
};
//# sourceMappingURL=ship.js.map