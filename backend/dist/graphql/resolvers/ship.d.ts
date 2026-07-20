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
export declare const shipResolvers: {
    Query: {
        myShips: (_: unknown, args: {
            pagination?: PaginationInput;
            filter?: ShipFilterInput;
            sort?: ShipSortInput;
        }, context: GraphQLContext) => Promise<{
            nodes: never[];
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
        organizationShips: (_: unknown, args: {
            organizationId: string;
            pagination?: PaginationInput;
            filter?: ShipFilterInput;
            sort?: ShipSortInput;
        }, _context: GraphQLContext) => Promise<{
            nodes: never[];
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
        ship: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<import("../../models/Ship").Ship | null>;
        shipModels: (_: unknown, _args: {
            manufacturer?: string;
            role?: string;
        }, _context: GraphQLContext) => Promise<never[]>;
    };
    Mutation: {
        createShip: (_: unknown, args: {
            input: CreateShipInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            ship: {
                status: string;
                isInsured: boolean;
                createdAt: Date;
                updatedAt: Date;
                name?: string;
                modelName: string;
                role: string;
                value?: number;
                insuranceType?: string;
                notes?: string;
                fleetId?: string;
                id: string;
            };
        } | {
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            ship: null;
        }>;
        updateShip: (_: unknown, args: {
            id: string;
            input: UpdateShipInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            ship: null;
        }>;
        deleteShip: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        bulkCreateShips: (_: unknown, args: {
            ships: CreateShipInput[];
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            ship: {
                status: string;
                isInsured: boolean;
                createdAt: Date;
                updatedAt: Date;
                name?: string;
                modelName: string;
                role: string;
                value?: number;
                insuranceType?: string;
                notes?: string;
                fleetId?: string;
                id: string;
            };
        }[]>;
    };
    Ship: {
        owner: (parent: {
            ownerId?: string;
        }, _: unknown, context: GraphQLContext) => Promise<import("../../models/User").User | null>;
        fleet: (parent: {
            fleetId?: string;
        }, _: unknown, context: GraphQLContext) => Promise<import("../../models/Fleet").Fleet | null>;
        manufacturer: (parent: {
            manufacturerCode?: string;
        }, _: unknown, _context: GraphQLContext) => Promise<{
            code: string;
            name: string;
        }>;
    };
};
//# sourceMappingURL=ship.d.ts.map