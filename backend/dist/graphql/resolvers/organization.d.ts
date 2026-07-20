import { GraphQLContext } from '../context';
export interface PaginationInput {
    page?: number;
    limit?: number;
}
export interface CreateOrganizationInput {
    name: string;
    slug: string;
    description?: string;
    rsiOrgId?: string;
    isPublic?: boolean;
}
export interface UpdateOrganizationInput {
    name?: string;
    description?: string;
    isPublic?: boolean;
}
export interface UpdateMemberRoleInput {
    userId: string;
    role: string;
}
export declare const organizationResolvers: {
    Query: {
        myOrganizations: (_: unknown, __: unknown, context: GraphQLContext) => Promise<never[]>;
        organization: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<import("../../models/Organization").Organization | null>;
        organizationBySlug: (_: unknown, _args: {
            slug: string;
        }, _context: GraphQLContext) => Promise<null>;
        searchOrganizations: (_: unknown, _args: {
            query: string;
            pagination?: PaginationInput;
        }, _context: GraphQLContext) => Promise<never[]>;
    };
    Mutation: {
        createOrganization: (_: unknown, args: {
            input: CreateOrganizationInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            organization: {
                isVerified: boolean;
                createdAt: Date;
                updatedAt: Date;
                name: string;
                slug: string;
                description?: string;
                rsiOrgId?: string;
                isPublic?: boolean;
                id: string;
            };
        } | {
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            organization: null;
        }>;
        updateOrganization: (_: unknown, args: {
            id: string;
            input: UpdateOrganizationInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            organization: null;
        }>;
        deleteOrganization: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        inviteMember: (_: unknown, args: {
            organizationId: string;
            userId: string;
            role: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            member: null;
        }>;
        updateMemberRole: (_: unknown, args: {
            organizationId: string;
            input: UpdateMemberRoleInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            member: null;
        }>;
        removeMember: (_: unknown, args: {
            organizationId: string;
            userId: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        leaveOrganization: (_: unknown, args: {
            organizationId: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
    };
    Subscription: {
        memberChanged: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
    };
    Organization: {
        statistics: (_parent: {
            id: string;
        }, _: unknown, _context: GraphQLContext) => Promise<{
            memberCount: number;
            shipCount: number;
            fleetCount: number;
            activityCount: number;
            totalShipValue: number;
        }>;
        members: (parent: {
            id: string;
        }, args: {
            pagination?: PaginationInput;
            role?: string;
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
        fleets: (parent: {
            id: string;
        }, args: {
            pagination?: PaginationInput;
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
        activities: (parent: {
            id: string;
        }, args: {
            pagination?: PaginationInput;
            upcoming?: boolean;
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
//# sourceMappingURL=organization.d.ts.map