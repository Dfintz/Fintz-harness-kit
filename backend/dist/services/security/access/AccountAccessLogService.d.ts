import { AccountAccessLog } from '../../../models/AccountAccessLog';
export declare class AccountAccessLogService {
    private accessLogRepository;
    logAccess(accountId: string, userId: string, organizationId: string | undefined, action: string, ipAddress?: string, userAgent?: string, metadata?: Record<string, unknown>): Promise<AccountAccessLog | null>;
    getAccountAccessLogs(accountId: string, limit?: number, offset?: number): Promise<AccountAccessLog[]>;
    getOrganizationAccessLogs(organizationId: string, limit?: number, offset?: number): Promise<AccountAccessLog[]>;
    getUserAccessLogs(userId: string, limit?: number, offset?: number): Promise<AccountAccessLog[]>;
    getAccountAnalytics(accountId: string): Promise<{
        totalAccesses: number;
        uniqueUsers: number;
        lastAccessed?: Date;
        actionCounts: Record<string, number>;
    }>;
}
//# sourceMappingURL=AccountAccessLogService.d.ts.map