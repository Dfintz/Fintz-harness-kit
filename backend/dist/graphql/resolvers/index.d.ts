export type { ActivityFilterInput, ActivitySortInput, CreateActivityInput, JoinActivityInput, PaginationInput, UpdateActivityInput, } from './activity';
export type { CreateFleetInput, FleetSortInput, ShipFilterInput, UpdateFleetInput } from './fleet';
export type { CreateOrganizationInput, UpdateMemberRoleInput, UpdateOrganizationInput, } from './organization';
export type { CreateShipInput, ShipSortInput, UpdateShipInput } from './ship';
export type { UpdateUserInput } from './user';
export declare const resolvers: {
    Query: {
        activities: (_: unknown, args: {
            organizationId: string;
            pagination?: import("./activity").PaginationInput;
            filter?: import("./activity").ActivityFilterInput;
            sort?: import("./activity").ActivitySortInput;
        }, _context: import("..").GraphQLContext) => Promise<{
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
            pagination?: import("./activity").PaginationInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, context: import("..").GraphQLContext) => Promise<import("../../models/Activity").Activity | null>;
        myActivities: (_: unknown, args: {
            pagination?: import("./activity").PaginationInput;
            filter?: import("./activity").ActivityFilterInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
        myShips: (_: unknown, args: {
            pagination?: import("./ship").PaginationInput;
            filter?: import("./ship").ShipFilterInput;
            sort?: import("./ship").ShipSortInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
            pagination?: import("./ship").PaginationInput;
            filter?: import("./ship").ShipFilterInput;
            sort?: import("./ship").ShipSortInput;
        }, _context: import("..").GraphQLContext) => Promise<{
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
        }, context: import("..").GraphQLContext) => Promise<import("../../models/Ship").Ship | null>;
        shipModels: (_: unknown, _args: {
            manufacturer?: string;
            role?: string;
        }, _context: import("..").GraphQLContext) => Promise<never[]>;
        fleets: (_: unknown, args: {
            organizationId: string;
            pagination?: import("./fleet").PaginationInput;
            sort?: import("./fleet").FleetSortInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, context: import("..").GraphQLContext) => Promise<import("../../models/Fleet").Fleet | null>;
        myOrganizations: (_: unknown, __: unknown, context: import("..").GraphQLContext) => Promise<never[]>;
        organization: (_: unknown, args: {
            id: string;
        }, context: import("..").GraphQLContext) => Promise<import("../../models/Organization").Organization | null>;
        organizationBySlug: (_: unknown, _args: {
            slug: string;
        }, _context: import("..").GraphQLContext) => Promise<null>;
        searchOrganizations: (_: unknown, _args: {
            query: string;
            pagination?: import("./organization").PaginationInput;
        }, _context: import("..").GraphQLContext) => Promise<never[]>;
        me: (_: unknown, __: unknown, context: import("..").GraphQLContext) => Promise<{
            id: string;
            username: string;
            email: string | undefined;
        } | null>;
        user: (_: unknown, args: {
            id: string;
        }, context: import("..").GraphQLContext) => Promise<import("../../models/User").User | null>;
        searchUsers: (_: unknown, _args: {
            query: string;
            pagination?: import("./user").PaginationInput;
        }, _context: import("..").GraphQLContext) => Promise<never[]>;
    };
    Mutation: {
        createActivity: (_: unknown, args: {
            organizationId: string;
            input: import("./activity").CreateActivityInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
            input: import("./activity").UpdateActivityInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        cancelActivity: (_: unknown, args: {
            id: string;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            activity: null;
        }>;
        joinActivity: (_: unknown, args: {
            activityId: string;
            input?: import("./activity").JoinActivityInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        updateParticipation: (_: unknown, args: {
            activityId: string;
            status: string;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            participant: null;
        }>;
        createShip: (_: unknown, args: {
            input: import("./ship").CreateShipInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
            input: import("./ship").UpdateShipInput;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            ship: null;
        }>;
        deleteShip: (_: unknown, args: {
            id: string;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        bulkCreateShips: (_: unknown, args: {
            ships: import("./ship").CreateShipInput[];
        }, context: import("..").GraphQLContext) => Promise<{
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
        createFleet: (_: unknown, args: {
            organizationId: string;
            input: import("./fleet").CreateFleetInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
            input: import("./fleet").UpdateFleetInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, context: import("..").GraphQLContext) => Promise<{
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
        createOrganization: (_: unknown, args: {
            input: import("./organization").CreateOrganizationInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
            input: import("./organization").UpdateOrganizationInput;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            organization: null;
        }>;
        deleteOrganization: (_: unknown, args: {
            id: string;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        inviteMember: (_: unknown, args: {
            organizationId: string;
            userId: string;
            role: string;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            member: null;
        }>;
        updateMemberRole: (_: unknown, args: {
            organizationId: string;
            input: import("./organization").UpdateMemberRoleInput;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
            member: null;
        }>;
        removeMember: (_: unknown, args: {
            organizationId: string;
            userId: string;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        leaveOrganization: (_: unknown, args: {
            organizationId: string;
        }, context: import("..").GraphQLContext) => Promise<{
            success: boolean;
            errors: null;
        }>;
        updateProfile: (_: unknown, args: {
            input: import("./user").UpdateUserInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
    Subscription: {
        memberChanged: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
        fleetUpdated: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
        fleetShipChanged: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
        activityUpdated: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
        participantUpdated: {
            subscribe: import("graphql-subscriptions").ResolverFn;
        };
    };
    User: {
        ships: (parent: {
            id: string;
        }, args: {
            pagination?: import("./user").PaginationInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, _: unknown, context: import("..").GraphQLContext) => Promise<import("../../models/Organization").Organization[]>;
        activities: (parent: {
            id: string;
        }, args: {
            pagination?: import("./user").PaginationInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
    Organization: {
        statistics: (_parent: {
            id: string;
        }, _: unknown, _context: import("..").GraphQLContext) => Promise<{
            memberCount: number;
            shipCount: number;
            fleetCount: number;
            activityCount: number;
            totalShipValue: number;
        }>;
        members: (parent: {
            id: string;
        }, args: {
            pagination?: import("./organization").PaginationInput;
            role?: string;
        }, _context: import("..").GraphQLContext) => Promise<{
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
            pagination?: import("./organization").PaginationInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
            pagination?: import("./organization").PaginationInput;
            upcoming?: boolean;
        }, context: import("..").GraphQLContext) => Promise<{
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
    Fleet: {
        organization: (parent: {
            organizationId: string;
        }, _: unknown, context: import("..").GraphQLContext) => Promise<import("../../models/Organization").Organization | null>;
        ships: (parent: {
            id: string;
        }, args: {
            pagination?: import("./fleet").PaginationInput;
            filter?: import("./fleet").ShipFilterInput;
        }, context: import("..").GraphQLContext) => Promise<{
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
        }, _: unknown, _context: import("..").GraphQLContext) => Promise<{
            shipCount: number;
            totalCargoCapacity: number;
            totalCrewCapacity: number;
            totalValue: number;
            averageShipSize: number;
        }>;
        composition: (_parent: {
            id: string;
        }, _: unknown, _context: import("..").GraphQLContext) => Promise<{
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
    Ship: {
        owner: (parent: {
            ownerId?: string;
        }, _: unknown, context: import("..").GraphQLContext) => Promise<import("../../models/User").User | null>;
        fleet: (parent: {
            fleetId?: string;
        }, _: unknown, context: import("..").GraphQLContext) => Promise<import("../../models/Fleet").Fleet | null>;
        manufacturer: (parent: {
            manufacturerCode?: string;
        }, _: unknown, _context: import("..").GraphQLContext) => Promise<{
            code: string;
            name: string;
        }>;
    };
    Activity: {
        organization: (parent: {
            organizationId: string;
        }, _: unknown, context: import("..").GraphQLContext) => Promise<import("../../models/Organization").Organization | null>;
        organizer: (parent: {
            creatorId: string;
        }, _: unknown, context: import("..").GraphQLContext) => Promise<import("../../models/User").User | null>;
        participants: (parent: {
            id: string;
        }, args: {
            pagination?: import("./activity").PaginationInput;
            status?: string;
        }, _context: import("..").GraphQLContext) => Promise<{
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
        }, _: unknown, _context: import("..").GraphQLContext) => Promise<{
            totalParticipants: number;
            confirmedParticipants: number;
            declinedParticipants: number;
            tentativeParticipants: number;
            remainingSpots: null;
        }>;
    };
};
//# sourceMappingURL=index.d.ts.map