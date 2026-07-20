"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetResolvers = void 0;
const graphql_1 = require("graphql");
const graphql_subscriptions_1 = require("graphql-subscriptions");
const FleetAuditLogger_1 = require("../../services/fleet/FleetAuditLogger");
const FleetService_1 = require("../../services/fleet/FleetService");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const subscriptions_1 = require("../subscriptions");
exports.fleetResolvers = {
    Query: {
        fleets: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const userOrgs = context.user.organizationIds ?? [];
            if (!userOrgs.includes(args.organizationId)) {
                throw new graphql_1.GraphQLError('Forbidden', {
                    extensions: { code: 'FORBIDDEN' },
                });
            }
            const fleetService = context.container.resolve(FleetService_1.FleetService);
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
        fleet: async (_, args, context) => context.loaders.fleetById.load(args.id),
    },
    Mutation: {
        createFleet: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const userOrgs = context.user.organizationIds ?? [];
            if (!userOrgs.includes(args.organizationId)) {
                throw new graphql_1.GraphQLError('Forbidden', {
                    extensions: { code: 'FORBIDDEN' },
                });
            }
            const fleetService = context.container.resolve(FleetService_1.FleetService);
            try {
                const created = await fleetService.createFleet(args.organizationId, {
                    name: args.input.name,
                    ...(args.input.description === undefined ? {} : { description: args.input.description }),
                    ...(args.input.visibility ? { visibility: args.input.visibility } : {}),
                });
                const fleet = await fleetService.postCreateFleet(args.organizationId, created);
                void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.FLEET_UPDATED, {
                    fleetUpdated: fleet,
                    organizationId: args.organizationId,
                });
                return {
                    success: true,
                    errors: null,
                    fleet,
                };
            }
            catch (error) {
                if (error instanceof apiErrors_1.ValidationError) {
                    return {
                        success: false,
                        errors: [{ code: 'VALIDATION_ERROR', message: error.message }],
                        fleet: null,
                    };
                }
                if (error instanceof apiErrors_1.ConflictError) {
                    return {
                        success: false,
                        errors: [{ code: 'CONFLICT', message: error.message }],
                        fleet: null,
                    };
                }
                logger_1.logger.error('GraphQL createFleet failed', {
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
        updateFleet: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const fleetService = context.container.resolve(FleetService_1.FleetService);
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
                throw new graphql_1.GraphQLError('Forbidden', {
                    extensions: { code: 'FORBIDDEN' },
                });
            }
            try {
                const updates = {};
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
                FleetAuditLogger_1.fleetAuditLogger.log({
                    action: FleetAuditLogger_1.FleetAuditAction.FLEET_UPDATED,
                    fleetId: updated.id,
                    fleetName: updated.name,
                    organizationId: updated.organizationId,
                    performedById: context.user.id,
                    details: { changes: updates },
                });
                void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.FLEET_UPDATED, {
                    fleetUpdated: updated,
                    organizationId: updated.organizationId,
                });
                return {
                    success: true,
                    errors: null,
                    fleet: updated,
                };
            }
            catch (error) {
                if (error instanceof apiErrors_1.ValidationError) {
                    return {
                        success: false,
                        errors: [{ code: 'VALIDATION_ERROR', message: error.message }],
                        fleet: null,
                    };
                }
                logger_1.logger.error('GraphQL updateFleet failed', {
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
        deleteFleet: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
                    extensions: { code: 'UNAUTHENTICATED' },
                });
            }
            const fleetService = context.container.resolve(FleetService_1.FleetService);
            const existing = await context.loaders.fleetById.load(args.id);
            if (!existing) {
                return {
                    success: false,
                    errors: [{ code: 'NOT_FOUND', message: 'Fleet not found' }],
                };
            }
            const userOrgs = context.user.organizationIds ?? [];
            if (!userOrgs.includes(existing.organizationId)) {
                throw new graphql_1.GraphQLError('Forbidden', {
                    extensions: { code: 'FORBIDDEN' },
                });
            }
            try {
                await fleetService.deleteFleet(existing.organizationId, args.id);
                return {
                    success: true,
                    errors: null,
                };
            }
            catch (error) {
                logger_1.logger.error('GraphQL deleteFleet failed', {
                    fleetId: args.id,
                    error: error instanceof Error ? error.message : String(error),
                });
                return {
                    success: false,
                    errors: [{ code: 'DELETE_FAILED', message: 'Failed to delete fleet' }],
                };
            }
        },
        addShipToFleet: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
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
                throw new graphql_1.GraphQLError('Forbidden', {
                    extensions: { code: 'FORBIDDEN' },
                });
            }
            const fleetService = context.container.resolve(FleetService_1.FleetService);
            try {
                const { fleet } = await fleetService.addShipToFleet(existing.organizationId, args.fleetId, args.shipId, { performedById: context.user.id });
                void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.FLEET_SHIP_CHANGED, {
                    fleetShipChanged: {
                        type: 'ADDED',
                        ship: { id: args.shipId },
                        fleet: { id: args.fleetId },
                    },
                });
                void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.FLEET_UPDATED, {
                    fleetUpdated: fleet,
                    organizationId: fleet.organizationId,
                });
                return {
                    success: true,
                    errors: null,
                    fleet,
                };
            }
            catch (error) {
                if (error instanceof apiErrors_1.FleetNotFoundError || error instanceof apiErrors_1.ShipNotFoundError) {
                    return {
                        success: false,
                        errors: [{ code: 'NOT_FOUND', message: error.message }],
                        fleet: null,
                    };
                }
                if (error instanceof apiErrors_1.ValidationError) {
                    return {
                        success: false,
                        errors: [{ code: 'VALIDATION_ERROR', message: error.message }],
                        fleet: null,
                    };
                }
                if (error instanceof apiErrors_1.ConflictError) {
                    return {
                        success: false,
                        errors: [{ code: 'CONFLICT', message: error.message }],
                        fleet: null,
                    };
                }
                logger_1.logger.error('GraphQL addShipToFleet failed', {
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
        removeShipFromFleet: async (_, args, context) => {
            if (!context.user) {
                throw new graphql_1.GraphQLError('Authentication required', {
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
                throw new graphql_1.GraphQLError('Forbidden', {
                    extensions: { code: 'FORBIDDEN' },
                });
            }
            const fleetService = context.container.resolve(FleetService_1.FleetService);
            try {
                const { fleet } = await fleetService.removeShipFromFleet(existing.organizationId, args.fleetId, args.shipId, { performedById: context.user.id });
                void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.FLEET_SHIP_CHANGED, {
                    fleetShipChanged: {
                        type: 'REMOVED',
                        ship: { id: args.shipId },
                        fleet: { id: args.fleetId },
                    },
                });
                void subscriptions_1.pubsub.publish(subscriptions_1.SUBSCRIPTION_EVENTS.FLEET_UPDATED, {
                    fleetUpdated: fleet,
                    organizationId: fleet.organizationId,
                });
                return {
                    success: true,
                    errors: null,
                    fleet,
                };
            }
            catch (error) {
                if (error instanceof apiErrors_1.FleetNotFoundError || error instanceof apiErrors_1.ShipNotFoundError) {
                    return {
                        success: false,
                        errors: [{ code: 'NOT_FOUND', message: error.message }],
                        fleet: null,
                    };
                }
                logger_1.logger.error('GraphQL removeShipFromFleet failed', {
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
        fleetUpdated: {
            subscribe: (0, graphql_subscriptions_1.withFilter)(() => subscriptions_1.pubsub.asyncIterator([subscriptions_1.SUBSCRIPTION_EVENTS.FLEET_UPDATED]), (payload, variables) => payload.organizationId === variables.organizationId),
        },
        fleetShipChanged: {
            subscribe: (0, graphql_subscriptions_1.withFilter)(() => subscriptions_1.pubsub.asyncIterator([subscriptions_1.SUBSCRIPTION_EVENTS.FLEET_SHIP_CHANGED]), (payload, variables) => payload.fleetShipChanged.fleet.id === variables.fleetId),
        },
    },
    Fleet: {
        organization: async (parent, _, context) => context.loaders.organizationById.load(parent.organizationId),
        ships: async (parent, args, context) => {
            let ships = await context.loaders.shipsByFleetId.load(parent.id);
            if (args.filter) {
                if (args.filter.role) {
                    ships = ships.filter((s) => s.role === args.filter?.role);
                }
                if (args.filter.status) {
                    ships = ships.filter((s) => s.status === args.filter?.status);
                }
                if (args.filter.manufacturer) {
                    ships = ships.filter((s) => s.manufacturer === args.filter?.manufacturer);
                }
            }
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
        statistics: async (_parent, _, _context) => ({
            shipCount: 0,
            totalCargoCapacity: 0,
            totalCrewCapacity: 0,
            totalValue: 0,
            averageShipSize: 0,
        }),
        composition: async (_parent, _, _context) => ({
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
//# sourceMappingURL=fleet.js.map