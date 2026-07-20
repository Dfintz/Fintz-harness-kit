import { FeatureFlag, FeatureFlagScope, FeatureFlagStatus } from '../../models/FeatureFlag';
export { FeatureFlagScope, FeatureFlagStatus };
export declare class FeatureFlagService {
    private static flagRepository;
    private static auditRepository;
    private static getRepositories;
    static initializeDefaultFlags(): Promise<void>;
    private static logEvaluation;
    static isEnabled(featureId: string, userId?: string, organizationId?: string): Promise<boolean>;
    private static checkBetaAccess;
    private static checkPercentageRollout;
    private static hashString;
    static getAllFlags(): Promise<FeatureFlag[]>;
    static getFlag(featureId: string): Promise<FeatureFlag | null>;
    static createFlag(flag: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>, adminUserId: string): Promise<FeatureFlag>;
    static updateFlag(featureId: string, updates: Partial<FeatureFlag>, adminUserId: string): Promise<FeatureFlag | null>;
    static deleteFlag(featureId: string, adminUserId: string): Promise<boolean>;
    static getEnabledFeatures(userId?: string, organizationId?: string): Promise<string[]>;
    static getStatistics(): Promise<{
        total: number;
        enabled: number;
        disabled: number;
        beta: number;
        percentageRollout: number;
    }>;
    static getAnalytics(featureFlagId: string, days?: number): Promise<{
        totalEvaluations: number;
        enabledCount: number;
        disabledCount: number;
        uniqueUsers: number;
        uniqueOrganizations: number;
        evaluationsByDay: Array<{
            date: string;
            enabled: number;
            disabled: number;
        }>;
    }>;
}
//# sourceMappingURL=FeatureFlagService.d.ts.map