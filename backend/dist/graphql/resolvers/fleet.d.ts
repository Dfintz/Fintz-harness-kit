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
export declare const fleetResolvers: {
    Query: {
        fleets: (_: unknown, args: {
            organizationId: string;
            pagination?: PaginationInput;
            sort?: FleetSortInput;
        }, context: GraphQLContext) => Promise<{
            nodes: import("../../models/Fleet").Fleet[];
            pageInfo: {
                page: number;
                limit: number;
                total: number;
                totalPages: number;
                hasNextPage: boolean;
                hasPreviousPage: boolean;
            };
            totalCount: number;
        }>;
        fleet: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<import("../../models/Fleet").Fleet | null>;
    };
    Mutation: {
        createFleet: (_: unknown, args: {
            organizationId: string;
            input: CreateFleetInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            fleet: import("../../models/Fleet").Fleet;
        } | {
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            fleet: null;
        }>;
        updateFleet: (_: unknown, args: {
            id: string;
            input: UpdateFleetInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            fleet: null;
        } | {
            success: boolean;
            errors: null;
            fleet: import("../../models/Fleet").Fleet;
        }>;
        deleteFleet: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
        } | {
            success: boolean;
            errors: null;
        }>;
        addShipToFleet: (_: unknown, args: {
            fleetId: string;
            shipId: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            fleet: null;
        } | {
            success: boolean;
            errors: null;
            fleet: import("../../models/Fleet").Fleet;
        }>;
        removeShipFromFleet: (_: unknown, args: {
            fleetId: string;
            shipId: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            fleet: null;
        } | {
            success: boolean;
            errors: null;
            fleet: import("../../models/Fleet").Fleet;
        }>;
    };
    Subscription: {
        fleetUpdated: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
        fleetShipChanged: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
    };
    Fleet: {
        organization: (parent: {
            organizationId: string;
        }, _: unknown, context: GraphQLContext) => Promise<import("../../models/Organization").Organization | null>;
        ships: (parent: {
            id: string;
        }, args: {
            pagination?: PaginationInput;
            filter?: ShipFilterInput;
        }, context: GraphQLContext) => Promise<{
            nodes: import("../../models/Ship").Ship[];
            pageInfo: {
                page: number;
                limit: number;
                total: number;
                totalPages: number;
                hasNextPage: boolean;
                hasPreviousPage: boolean;
            };
            totalCount: number;
        }>;
        statistics: (_parent: {
            id: string;
        }, _: unknown, _context: GraphQLContext) => Promise<{
            shipCount: number;
            totalCargoCapacity: number;
            totalCrewCapacity: number;
            totalValue: number;
            averageShipSize: number;
        }>;
        composition: (_parent: {
            id: string;
        }, _: unknown, _context: GraphQLContext) => Promise<{
            combat: number;
            mining: number;
            cargo: number;
            exploration: number;
            salvage: number;
            medical: number;
            support: number;
            multiRole: number;
            other: number;
        }>;
    };
};
//# sourceMappingURL=fleet.d.ts.map