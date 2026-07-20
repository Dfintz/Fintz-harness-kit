export declare enum FeatureFlagStatus {
    ENABLED = "enabled",
    DISABLED = "disabled",
    BETA = "beta",
    PERCENTAGE = "percentage"
}
export declare enum FeatureFlagScope {
    GLOBAL = "global",
    ORGANIZATION = "organization",
    USER = "user",
    BETA_USERS = "beta_users"
}
export declare class FeatureFlag {
    id: string;
    name: string;
    description: string;
    status: FeatureFlagStatus;
    scope: FeatureFlagScope;
    percentage?: number;
    targetOrganizations?: string[];
    targetUsers?: string[];
    metadata?: Record<string, unknown>;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=FeatureFlag.d.ts.map