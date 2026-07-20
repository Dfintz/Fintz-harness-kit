import { FeatureFlag } from './FeatureFlag';
export declare enum FeatureFlagAction {
    CREATED = "created",
    UPDATED = "updated",
    DELETED = "deleted",
    EVALUATED = "evaluated"
}
export declare class FeatureFlagAuditLog {
    id: string;
    featureFlagId: string;
    featureFlag?: FeatureFlag;
    action: FeatureFlagAction;
    userId?: string;
    organizationId?: string;
    previousValue?: Record<string, unknown>;
    newValue?: Record<string, unknown>;
    evaluationResult?: boolean;
    metadata?: string;
    createdAt: Date;
}
//# sourceMappingURL=FeatureFlagAuditLog.d.ts.map