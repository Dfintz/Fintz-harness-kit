export interface FeatureFlagUpdate {
    flagId: string;
    action: 'created' | 'updated' | 'deleted';
    status?: string;
    scope?: string;
    percentage?: number;
    targetOrganizations?: string[];
    targetUsers?: string[];
    timestamp: number;
}
export interface FeatureFlagEvent {
    type: 'feature-flag:updated' | 'feature-flag:created' | 'feature-flag:deleted';
    update: FeatureFlagUpdate;
    userId?: string;
    organizationId?: string;
}
export declare const broadcastFeatureFlagUpdate: (update: Omit<FeatureFlagUpdate, "timestamp">) => void;
export declare const sendFeatureFlagUpdateToUser: (userId: string, update: Omit<FeatureFlagUpdate, "timestamp">) => void;
export declare const sendFeatureFlagUpdateToOrganization: (organizationId: string, update: Omit<FeatureFlagUpdate, "timestamp">) => void;
export declare const notifyFeatureFlagChange: (flagId: string, action: "created" | "updated" | "deleted", scope: string, status?: string, percentage?: number, targetOrganizations?: string[], targetUsers?: string[]) => Promise<void>;
//# sourceMappingURL=featureFlagWebSocketController.d.ts.map