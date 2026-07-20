export type paths = Record<string, never>;
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
        };
        ApiError: {
            status: "error";
            code: string;
            message: string;
            details?: {
                field?: string;
                message?: string;
            }[];
            timestamp: string;
        };
        HealthStatus: "healthy" | "degraded" | "unhealthy";
        Fleet: {
            id: string;
            name: string;
            members: string[];
        };
        FleetV2: {
            id: string;
            name: string;
            description?: string;
            organizationId: string;
            createdAt: string;
            updatedAt: string;
            memberCount?: number;
            shipCount?: number;
            totalCrewCapacity?: number;
            totalCargoCapacity?: number;
            isActive?: boolean;
        };
        FleetStatistics: {
            totalFleets: number;
            totalMembers: number;
            totalShips: number;
            totalValue?: number;
            shipsByRole?: {
                [key: string]: number;
            };
            fleetsBySize?: {
                [key: string]: number;
            };
        };
        FleetComposition: {
            fleetId: string;
            totalShips: number;
            totalCrew?: number;
            totalCargo?: number;
            byManufacturer?: {
                manufacturer?: string;
                count?: number;
                percentage?: number;
            }[];
            byRole?: {
                role?: string;
                count?: number;
                percentage?: number;
            }[];
            bySize?: ({
                size?: "small" | "medium" | "large" | "capital";
                count?: number;
                percentage?: number;
            })[];
        };
        CreateFleetRequest: {
            name: string;
            description?: string;
            members?: string[];
        };
        UpdateFleetRequest: {
            name?: string;
            description?: string;
            members?: string[];
        };
        Organization: {
            id: string;
            name: string;
            members: string[];
        };
        OrganizationV2: {
            id: string;
            name: string;
            description?: string;
            spectrumId?: string;
            logo?: string;
            banner?: string;
            memberCount?: number;
            fleetCount?: number;
            shipCount?: number;
            isVerified?: boolean;
            createdAt: string;
            updatedAt: string;
            settings?: {
                isPublic?: boolean;
                requireApproval?: boolean;
                defaultRole?: string;
            };
        };
        OrganizationMember: {
            userId: string;
            username: string;
            displayName?: string;
            avatar?: string;
            role: string;
            permissions?: string[];
            joinedAt: string;
            lastActiveAt?: string;
            shipCount?: number;
        };
        OrganizationStatistics: {
            memberCount: number;
            activeMembers?: number;
            fleetCount: number;
            totalShips: number;
            totalShipValue?: number;
            activityCount?: number;
            memberGrowth?: number;
        };
        ActivityType: "MISSION" | "CONTRACT" | "BOUNTY" | "EVENT" | "LFG" | "OPERATION" | "RECRUITMENT" | "JOB_LISTING";
        ActivityStatus: "DRAFT" | "SCHEDULED" | "ACTIVE" | "COMPLETED" | "CANCELLED";
        Activity: {
            id: string;
            title: string;
            type: components["schemas"]["ActivityType"];
            status: components["schemas"]["ActivityStatus"];
        };
        ActivityV2: {
            id: string;
            title: string;
            description?: string;
            type: components["schemas"]["ActivityType"];
            status: components["schemas"]["ActivityStatus"];
            organizationId: string;
            creatorId: string;
            scheduledStartDate?: string;
            scheduledEndDate?: string;
            actualStartDate?: string;
            actualEndDate?: string;
            location?: string;
            maxParticipants?: number;
            participantCount?: number;
            requirements?: {
                minRank?: string;
                requiredShipTypes?: string[];
                requiredRoles?: string[];
            };
            rewards?: {
                aUEC?: number;
                reputation?: number;
                items?: string[];
            };
            tags?: string[];
            isPublic?: boolean;
            createdAt: string;
            updatedAt: string;
        };
        ParticipationStatus: "INVITED" | "CONFIRMED" | "DECLINED" | "TENTATIVE" | "ATTENDED" | "NO_SHOW";
        ActivityParticipant: {
            userId: string;
            username: string;
            displayName?: string;
            avatar?: string;
            role: string;
            status: components["schemas"]["ParticipationStatus"];
            shipType?: string;
            joinedAt: string;
            confirmedAt?: string;
        };
        CreateActivityRequest: {
            title: string;
            description?: string;
            type: components["schemas"]["ActivityType"];
            scheduledStartDate?: string;
            scheduledEndDate?: string;
            location?: string;
            maxParticipants?: number;
            isPublic?: boolean;
            tags?: string[];
        };
        ShipRole: "Combat" | "Transport" | "Mining" | "Exploration" | "Industrial" | "Support" | "Racing" | "Multi-role";
        ShipSize: "small" | "medium" | "large" | "capital";
        ShipStatus: "ACTIVE" | "MAINTENANCE" | "DESTROYED" | "LOANED" | "STORED";
        InsuranceType: "LTI" | "10Y" | "6M" | "3M" | "NONE";
        Ship: {
            id: string;
            name: string;
            manufacturer?: string;
            model?: string;
        };
        ShipV2: {
            id: string;
            name?: string;
            manufacturer: string;
            model: string;
            role?: components["schemas"]["ShipRole"];
            size?: components["schemas"]["ShipSize"];
            crewMin?: number;
            crewMax?: number;
            cargoCapacity?: number;
            ownerId: string;
            organizationId?: string;
            fleetId?: string;
            status?: components["schemas"]["ShipStatus"];
            location?: string;
            insurance?: {
                type?: components["schemas"]["InsuranceType"];
                expiresAt?: string;
            };
            loadout?: {
                weapons?: string[];
                shields?: string[];
                components?: string[];
            };
            purchaseDate?: string;
            value?: number;
            imageUrl?: string;
            createdAt: string;
            updatedAt: string;
        };
        CreateShipRequest: {
            name?: string;
            manufacturer: string;
            model: string;
            fleetId?: string;
            status?: components["schemas"]["ShipStatus"];
        };
        User: {
            id: string;
            username: string;
            email: string;
            discordId: string;
        };
        PlayStyle: "PVP" | "PVE" | "TRADING" | "MINING" | "EXPLORATION" | "BOUNTY_HUNTING" | "PIRACY" | "RACING" | "ROLEPLAY";
        UserV2: {
            id: string;
            username: string;
            displayName?: string;
            email: string;
            avatar?: string;
            discordId?: string;
            rsiHandle?: string;
            rsiVerified?: boolean;
            timezone?: string;
            language?: string;
            bio?: string;
            location?: string;
            playStyle?: components["schemas"]["PlayStyle"][];
            shipCount?: number;
            organizationCount?: number;
            activeOrgId?: string;
            twoFactorEnabled?: boolean;
            createdAt: string;
            updatedAt: string;
            lastLoginAt?: string;
        };
        UpdateUserRequest: {
            displayName?: string;
            bio?: string;
            timezone?: string;
            language?: string;
            location?: string;
            playStyle?: components["schemas"]["PlayStyle"][];
        };
        LoginRequest: {
            username: string;
            password: string;
        };
        LoginResponse: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
            user?: components["schemas"]["User"];
        };
        RefreshTokenRequest: {
            refreshToken: string;
        };
        RefreshTokenResponse: {
            accessToken: string;
            refreshToken: string;
            expiresIn: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type external = Record<string, never>;
export type operations = Record<string, never>;
//# sourceMappingURL=api.d.ts.map