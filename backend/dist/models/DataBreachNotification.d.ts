export declare const INCIDENT_STATUSES: readonly ["INVESTIGATING", "CONTAINED", "NOTIFIED", "RESOLVED"];
export type IncidentStatus = typeof INCIDENT_STATUSES[number];
export declare class DataBreachNotification {
    id: string;
    title: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    affectedUsers: string[];
    affectedDataTypes: string[];
    status: IncidentStatus;
    discoveredAt: Date;
    containedAt?: Date;
    notifiedAt?: Date;
    resolvedAt?: Date;
    notifiedUsers: Array<{
        userId: string;
        notifiedAt: Date;
        status: 'SENT' | 'BOUNCED' | 'FAILED';
    }>;
    notificationErrors: Array<{
        userId: string;
        error: string;
        retryCount: number;
    }>;
    remediationSteps: string[];
    recommendations: string[];
    internalNotes?: string;
    regulatoryReport?: {
        supervisoryAuthority: string;
        reportedDate: Date;
        reportNumber: string;
    };
}
//# sourceMappingURL=DataBreachNotification.d.ts.map