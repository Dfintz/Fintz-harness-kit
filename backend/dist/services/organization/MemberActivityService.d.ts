export declare class MemberActivityService {
    private userRepo;
    private userOrgRepo;
    private readonly ACTIVE_THRESHOLD_DAYS;
    getActiveMemberCount(organizationId: string): Promise<number>;
    getActivityTrends(organizationId: string, days?: number): Promise<{
        period: {
            start: Date;
            end: Date;
        };
        dailyActiveMembers: Array<{
            date: string;
            count: number;
        }>;
        averageActiveMembers: number;
        totalMembers: number;
        activeRate: number;
    }>;
    getActiveMembers(organizationId: string, limit?: number): Promise<Array<{
        userId: string;
        username: string;
        lastActiveAt: Date;
    }>>;
}
//# sourceMappingURL=MemberActivityService.d.ts.map