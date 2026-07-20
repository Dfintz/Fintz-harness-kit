export declare class AccountAccessLog {
    id: string;
    accountId: string;
    userId: string;
    organizationId?: string;
    action: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    createdAt: Date;
}
//# sourceMappingURL=AccountAccessLog.d.ts.map