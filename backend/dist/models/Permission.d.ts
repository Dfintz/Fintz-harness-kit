export declare class Permission {
    id: string;
    userId: string;
    organizationId: string;
    resource: string;
    action: string;
    granted: boolean;
    grantedBy?: string;
    expiresAt?: Date;
    conditions?: Record<string, unknown>;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Permission.d.ts.map