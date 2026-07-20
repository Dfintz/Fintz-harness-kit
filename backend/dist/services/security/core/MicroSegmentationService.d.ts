export declare enum ResourceType {
    FLEET = "fleet",
    SHIP = "ship",
    ACTIVITY = "activity",
    USER = "user",
    ORGANIZATION = "organization",
    INTEL = "intel",
    TRADE_ROUTE = "trade_route",
    TICKET = "ticket",
    WEBHOOK = "webhook",
    ANNOUNCEMENT = "announcement"
}
export declare enum CrossOrgAccessLevel {
    NONE = "none",
    READ = "read",
    WRITE = "write",
    FULL = "full"
}
export interface Segment {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    resources: SegmentResource[];
    allowedCrossOrgAccess: CrossOrgAccessConfig[];
    createdAt: Date;
    updatedAt: Date;
}
export interface SegmentResource {
    resourceType: ResourceType;
    resourceId?: string;
    accessLevel: CrossOrgAccessLevel;
    conditions?: AccessCondition[];
}
export interface CrossOrgAccessConfig {
    targetOrganizationId: string;
    resourceType: ResourceType;
    accessLevel: CrossOrgAccessLevel;
    expiresAt?: Date;
    approvedBy?: string;
    reason?: string;
}
export interface AccessCondition {
    type: 'time_range' | 'ip_whitelist' | 'role_required' | 'mfa_required';
    value: string | string[] | boolean;
}
export interface AccessCheckResult {
    allowed: boolean;
    reason?: string;
    segment?: string;
    accessLevel?: CrossOrgAccessLevel;
    conditions?: AccessCondition[];
}
export interface IsolationViolation {
    id: string;
    timestamp: Date;
    sourceOrganizationId: string;
    targetOrganizationId?: string;
    resourceType: ResourceType;
    resourceId: string;
    attemptedAction: string;
    userId?: string;
    ipAddress?: string;
    blocked: boolean;
    severity: 'low' | 'medium' | 'high' | 'critical';
}
export declare class MicroSegmentationService {
    private segments;
    private violations;
    private segmentIdCounter;
    private violationIdCounter;
    private maxViolationHistory;
    private violationRateLimiter;
    private readonly violationRateLimitWindow;
    private readonly violationRateLimitMax;
    constructor();
    private initializeDefaultSegments;
    createSegment(organizationId: string, name: string, resources: SegmentResource[], description?: string): Segment;
    updateSegment(segmentId: string, updates: Partial<Pick<Segment, 'name' | 'description' | 'resources'>>): Segment | null;
    deleteSegment(segmentId: string): boolean;
    grantCrossOrgAccess(segmentId: string, config: CrossOrgAccessConfig): boolean;
    revokeCrossOrgAccess(segmentId: string, targetOrganizationId: string, resourceType: ResourceType): boolean;
    checkAccess(requestingOrganizationId: string, resourceOrganizationId: string, resourceType: ResourceType, resourceId: string, requestedAccessLevel: CrossOrgAccessLevel, context?: {
        userId?: string;
        ipAddress?: string;
        timestamp?: Date;
    }): AccessCheckResult;
    verifyIsolation(organizationId: string, resourceType: ResourceType, resourceId: string, resourceOrganizationId: string): {
        isolated: boolean;
        violations?: string[];
    };
    getOrganizationSegments(organizationId: string): Segment[];
    getCrossOrgAccessGrants(organizationId: string): CrossOrgAccessConfig[];
    getCrossOrgAccessReceived(organizationId: string): Array<{
        fromOrganizationId: string;
        segmentId: string;
        config: CrossOrgAccessConfig;
    }>;
    getViolations(filters?: {
        organizationId?: string;
        resourceType?: ResourceType;
        severity?: IsolationViolation['severity'];
        since?: Date;
    }): IsolationViolation[];
    getViolationStats(): {
        total: number;
        byResourceType: Record<string, number>;
        bySeverity: Record<string, number>;
        last24Hours: number;
        blocked: number;
    };
    private accessLevelSufficient;
    private checkConditions;
    private isWithinTimeRange;
    private determineSeverity;
    private recordViolation;
}
export declare const microSegmentation: MicroSegmentationService;
//# sourceMappingURL=MicroSegmentationService.d.ts.map