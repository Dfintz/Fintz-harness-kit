export declare enum ConsentType {
    MARKETING = "marketing",
    ANALYTICS = "analytics",
    FUNCTIONAL = "functional",
    NECESSARY = "necessary"
}
export interface ConsentRecord {
    userId: string;
    consentType: ConsentType;
    granted: boolean;
    timestamp: Date;
}
export interface DataExportRequest {
    userId: string;
    requestedAt: Date;
    status: 'pending' | 'completed' | 'failed';
}
export interface DataDeletionRequest {
    userId: string;
    requestedAt: Date;
    status: 'pending' | 'completed' | 'failed';
    deletedAt?: Date;
}
//# sourceMappingURL=gdpr.types.d.ts.map