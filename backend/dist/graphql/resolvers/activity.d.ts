import { GraphQLContext } from '../context';
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
export declare const activityResolvers: {
    Query: {
        activities: (_: unknown, args: {
            organizationId: string;
            pagination?: PaginationInput;
            filter?: ActivityFilterInput;
            sort?: ActivitySortInput;
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
        upcomingActivities: (_: unknown, args: {
            pagination?: PaginationInput;
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
        activity: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<import("../../models/Activity").Activity | null>;
        myActivities: (_: unknown, args: {
            pagination?: PaginationInput;
            filter?: ActivityFilterInput;
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
    };
    Mutation: {
        createActivity: (_: unknown, args: {
            organizationId: string;
            input: CreateActivityInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            activity: {
                status: string;
                requiresConfirmation: boolean;
                createdAt: Date;
                updatedAt: Date;
                title: string;
                description?: string;
                type: string;
                startTime: Date;
                endTime?: Date;
                durationMinutes?: number;
                location?: string;
                maxParticipants?: number;
                notes?: string;
                organizationId: string;
                id: string;
            };
        } | {
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            activity: null;
        }>;
        updateActivity: (_: unknown, args: {
            id: string;
            input: UpdateActivityInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            activity: {
                updatedAt: Date;
                title?: string;
                description?: string;
                type?: string;
                status?: string;
                startTime?: Date;
                endTime?: Date;
                location?: string;
                maxParticipants?: number;
                notes?: string;
                id: string;
            };
        } | {
            success: boolean;
            errors: {
                code: string;
                message: string;
            }[];
            activity: null;
        }>;
        deleteActivity: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        cancelActivity: (_: unknown, args: {
            id: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            activity: null;
        }>;
        joinActivity: (_: unknown, args: {
            activityId: string;
            input?: JoinActivityInput;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            participant: {
                user: {
                    id: string;
                    username: string;
                };
                status: string;
                role: string | undefined;
                notes: string | undefined;
                joinedAt: Date;
                updatedAt: Date;
            };
        }>;
        leaveActivity: (_: unknown, args: {
            activityId: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        updateParticipation: (_: unknown, args: {
            activityId: string;
            status: string;
        }, context: GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            participant: null;
        }>;
    };
    Subscription: {
        activityUpdated: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
        participantUpdated: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
    };
    Activity: {
        organization: (parent: {
            organizationId: string;
        }, _: unknown, context: GraphQLContext) => Promise<import("../../models/Organization").Organization | null>;
        organizer: (parent: {
            creatorId: string;
        }, _: unknown, context: GraphQLContext) => Promise<import("../../models/User").User | null>;
        participants: (parent: {
            id: string;
        }, args: {
            pagination?: PaginationInput;
            status?: string;
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
        statistics: (_parent: {
            id: string;
        }, _: unknown, _context: GraphQLContext) => Promise<{
            totalParticipants: number;
            confirmedParticipants: number;
            declinedParticipants: number;
            tentativeParticipants: number;
            remainingSpots: null;
        }>;
    };
};
//# sourceMappingURL=activity.d.ts.map