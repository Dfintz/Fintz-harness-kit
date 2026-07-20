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
export declare const userResolvers: {
    Query: {
        me: (_: unknown, __: unknown, context: GraphQLContext) => Promise<{
            id: string;
            username: string;
            email: string | undefined;
        } | null>;
        user: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<import("../../models/User").User | null>;
        searchUsers: (_: unknown, _args: {
            query: string;
            pagination?: PaginationInput;
        }, _context: GraphQLContext) => Promise<never[]>;
    };
    Mutation: {
        updateProfile: (_: unknown, args: {
            input: UpdateUserInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            user: {
                isVerified: boolean;
                createdAt: Date;
                updatedAt: Date;
                displayName?: string;
                rsiHandle?: string;
                playStyle?: string;
                timezone?: string;
                bio?: string;
                id: string;
                username: string;
            };
        } | {
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            user: null;
        }>;
    };
    User: {
        ships: (parent: {
            id: string;
        }, args: {
            pagination?: PaginationInput;
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
        organizations: (parent: {
            id: string;
        }, _: unknown, context: GraphQLContext) => Promise<import("../../models/Organization").Organization[]>;
        activities: (parent: {
            id: string;
        }, args: {
            pagination?: PaginationInput;
        }, context: GraphQLContext) => Promise<{
            nodes: import("../../models/Activity").Activity[];
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
    };
};
//# sourceMappingURL=user.d.ts.map