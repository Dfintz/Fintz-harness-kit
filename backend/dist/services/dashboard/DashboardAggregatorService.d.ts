import type { Role } from '../../models/Role';
export interface DashboardSummary {
    fleets: {
        total: number;
        totalShips: number;
        totalMemberShips: number;
        personalShipCount: number;
    } | null;
    activities: {
        total: number;
        upcoming: number;
    } | null;
    teams: {
        total: number;
    } | null;
    notifications: {
        recent: unknown[];
        total: number;
        unreadCount: number;
    };
    organization: {
        id: string;
        name: string;
        role: string;
        rsiVerified: boolean;
        scale: {
            tier: string;
            memberCount: number;
            dashboardCacheTtlSeconds: number;
            recommendedPageSize: number;
        };
        members: {
            total: number;
            active: number;
            online: number;
            byRole: Record<string, number>;
        };
    } | null;
    trading: {
        activeRoutes: number;
        totalEstimatedProfit: number;
    } | null;
    inventory: {
        totalItems: number;
        totalValue: number;
    } | null;
    mining: {
        activeOperations: number;
    } | null;
    missions: {
        total: number;
    } | null;
    alliances: {
        total: number;
        mutual: number;
        averageHealth: number;
    } | null;
    bounties: {
        totalBounties: number;
        activeBounties: number;
        completedBounties: number;
    } | null;
    reputation: {
        combinedScore: number;
        reliability: string;
    } | null;
    scStats: {
        verificationRate: number;
        averageKD: number;
        averageTotalHours: number;
        averageMissionsCompleted: number;
        memberCount: number;
        verifiedCount: number;
    } | null;
    timestamp: string;
}
export declare class DashboardAggregatorService {
    private static instance;
    private readonly fleetService;
    private readonly activityService;
    private readonly teamService;
    private readonly notificationService;
    private readonly memberActivityService;
    private readonly scStatsService;
    private readonly allianceService;
    private readonly reputationService;
    private readonly bountyService;
    private readonly onlinePresenceService;
    static getInstance(): DashboardAggregatorService;
    getOrgSummary(userId: string, orgId: string, membershipRole?: Role | string | null): Promise<DashboardSummary>;
    getSoloSummary(userId: string): Promise<DashboardSummary>;
    private safeSCStats;
    private safeMembersByRole;
    private safeTradingStats;
    private safeInventoryStats;
    private safeMiningActiveCount;
    private safeAllianceStats;
    private safeBountyStats;
    private safeReputationStats;
    private countPersonalShips;
    private countAllMemberShips;
    private countMemberShipsSharedWithOrg;
}
//# sourceMappingURL=DashboardAggregatorService.d.ts.map