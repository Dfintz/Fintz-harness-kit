/**
 * Micro-Segmentation Service
 * 
 * Implements Zero Trust micro-segmentation for organization isolation:
 * - Organization boundary enforcement
 * - Resource access control
 * - Cross-organization data protection
 * - Tenant isolation verification
 */

import { logger } from '../../../utils/logger';

/**
 * Resource types that can be segmented
 */
export enum ResourceType {
    FLEET = 'fleet',
    SHIP = 'ship',
    ACTIVITY = 'activity',
    USER = 'user',
    ORGANIZATION = 'organization',
    INTEL = 'intel',
    TRADE_ROUTE = 'trade_route',
    TICKET = 'ticket',
    WEBHOOK = 'webhook',
    ANNOUNCEMENT = 'announcement',
}

/**
 * Access level for cross-organization resources
 */
export enum CrossOrgAccessLevel {
    NONE = 'none',
    READ = 'read',
    WRITE = 'write',
    FULL = 'full',
}

/**
 * Segment definition
 */
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

/**
 * Resource within a segment
 */
export interface SegmentResource {
    resourceType: ResourceType;
    resourceId?: string; // Optional - if not set, applies to all resources of this type
    accessLevel: CrossOrgAccessLevel;
    conditions?: AccessCondition[];
}

/**
 * Cross-organization access configuration
 */
export interface CrossOrgAccessConfig {
    targetOrganizationId: string;
    resourceType: ResourceType;
    accessLevel: CrossOrgAccessLevel;
    expiresAt?: Date;
    approvedBy?: string;
    reason?: string;
}

/**
 * Access condition for fine-grained control
 */
export interface AccessCondition {
    type: 'time_range' | 'ip_whitelist' | 'role_required' | 'mfa_required';
    value: string | string[] | boolean;
}

/**
 * Access check result
 */
export interface AccessCheckResult {
    allowed: boolean;
    reason?: string;
    segment?: string;
    accessLevel?: CrossOrgAccessLevel;
    conditions?: AccessCondition[];
}

/**
 * Isolation violation
 */
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

/**
 * Micro-Segmentation Service
 * 
 * Enforces organization boundaries and manages cross-organization access
 */
export class MicroSegmentationService {
    private segments: Map<string, Segment> = new Map();
    private violations: IsolationViolation[] = [];
    private segmentIdCounter: number = 1;
    private violationIdCounter: number = 1;
    private maxViolationHistory: number = 1000;
    
    // Rate limiting for violation recording to prevent log flooding
    private violationRateLimiter: Map<string, { count: number; firstSeen: Date }> = new Map();
    private readonly violationRateLimitWindow: number = 60000; // 1 minute
    private readonly violationRateLimitMax: number = 10; // max violations per source per window

    constructor() {
        // Initialize default segments for core resources
        this.initializeDefaultSegments();
    }

    /**
     * Initialize default segmentation rules
     */
    private initializeDefaultSegments(): void {
        // Default rules are organization-scoped - no cross-org access by default
        logger.info('Micro-segmentation service initialized with default isolation rules');
    }

    /**
     * Create a segment for an organization
     */
    createSegment(
        organizationId: string,
        name: string,
        resources: SegmentResource[],
        description?: string
    ): Segment {
        const segment: Segment = {
            id: `seg-${this.segmentIdCounter++}`,
            organizationId,
            name,
            description,
            resources,
            allowedCrossOrgAccess: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        this.segments.set(segment.id, segment);

        logger.info('Segment created', {
            segmentId: segment.id,
            organizationId,
            name,
            resourceCount: resources.length,
        });

        return segment;
    }

    /**
     * Update a segment
     */
    updateSegment(
        segmentId: string,
        updates: Partial<Pick<Segment, 'name' | 'description' | 'resources'>>
    ): Segment | null {
        const segment = this.segments.get(segmentId);
        if (!segment) {return null;}

        if (updates.name) {segment.name = updates.name;}
        if (updates.description !== undefined) {segment.description = updates.description;}
        if (updates.resources) {segment.resources = updates.resources;}
        segment.updatedAt = new Date();

        logger.info('Segment updated', { segmentId });

        return segment;
    }

    /**
     * Delete a segment
     */
    deleteSegment(segmentId: string): boolean {
        const deleted = this.segments.delete(segmentId);
        if (deleted) {
            logger.info('Segment deleted', { segmentId });
        }
        return deleted;
    }

    /**
     * Grant cross-organization access
     */
    grantCrossOrgAccess(
        segmentId: string,
        config: CrossOrgAccessConfig
    ): boolean {
        const segment = this.segments.get(segmentId);
        if (!segment) {return false;}

        // Check for existing grant
        const existingIndex = segment.allowedCrossOrgAccess.findIndex(
            a => a.targetOrganizationId === config.targetOrganizationId &&
                 a.resourceType === config.resourceType
        );

        if (existingIndex >= 0) {
            // Update existing
            segment.allowedCrossOrgAccess[existingIndex] = config;
        } else {
            // Add new
            segment.allowedCrossOrgAccess.push(config);
        }

        segment.updatedAt = new Date();

        logger.info('Cross-organization access granted', {
            segmentId,
            targetOrganizationId: config.targetOrganizationId,
            resourceType: config.resourceType,
            accessLevel: config.accessLevel,
        });

        return true;
    }

    /**
     * Revoke cross-organization access
     */
    revokeCrossOrgAccess(
        segmentId: string,
        targetOrganizationId: string,
        resourceType: ResourceType
    ): boolean {
        const segment = this.segments.get(segmentId);
        if (!segment) {return false;}

        const initialLength = segment.allowedCrossOrgAccess.length;
        segment.allowedCrossOrgAccess = segment.allowedCrossOrgAccess.filter(
            a => !(a.targetOrganizationId === targetOrganizationId && 
                   a.resourceType === resourceType)
        );

        if (segment.allowedCrossOrgAccess.length < initialLength) {
            segment.updatedAt = new Date();
            
            logger.info('Cross-organization access revoked', {
                segmentId,
                targetOrganizationId,
                resourceType,
            });

            return true;
        }

        return false;
    }

    /**
     * Check if access is allowed
     */
    checkAccess(
        requestingOrganizationId: string,
        resourceOrganizationId: string,
        resourceType: ResourceType,
        resourceId: string,
        requestedAccessLevel: CrossOrgAccessLevel,
        context?: {
            userId?: string;
            ipAddress?: string;
            timestamp?: Date;
        }
    ): AccessCheckResult {
        // Same organization - always allowed
        if (requestingOrganizationId === resourceOrganizationId) {
            return { allowed: true, accessLevel: CrossOrgAccessLevel.FULL };
        }

        // Find applicable segments for the resource organization
        const orgSegments = this.getOrganizationSegments(resourceOrganizationId);

        for (const segment of orgSegments) {
            // Check if there's a cross-org access grant
            const grant = segment.allowedCrossOrgAccess.find(
                a => a.targetOrganizationId === requestingOrganizationId &&
                     a.resourceType === resourceType
            );

            if (grant) {
                // Check expiration
                if (grant.expiresAt && grant.expiresAt < new Date()) {
                    continue; // Grant expired
                }

                // Check access level
                if (this.accessLevelSufficient(grant.accessLevel, requestedAccessLevel)) {
                    // Check resource-specific conditions
                    const resource = segment.resources.find(
                        r => r.resourceType === resourceType &&
                             (!r.resourceId || r.resourceId === resourceId)
                    );

                    if (resource) {
                        // Check conditions
                        const conditionsResult = this.checkConditions(
                            resource.conditions,
                            context
                        );

                        if (conditionsResult.allowed) {
                            return {
                                allowed: true,
                                segment: segment.id,
                                accessLevel: grant.accessLevel,
                                conditions: resource.conditions,
                            };
                        } else {
                            return {
                                allowed: false,
                                reason: conditionsResult.reason,
                            };
                        }
                    }
                }
            }
        }

        // No matching grant found - record violation and deny
        this.recordViolation({
            sourceOrganizationId: requestingOrganizationId,
            targetOrganizationId: resourceOrganizationId,
            resourceType,
            resourceId,
            attemptedAction: `${requestedAccessLevel} access`,
            userId: context?.userId,
            ipAddress: context?.ipAddress,
            blocked: true,
            severity: this.determineSeverity(resourceType),
        });

        return {
            allowed: false,
            reason: 'Cross-organization access not granted',
        };
    }

    /**
     * Verify organization isolation
     */
    verifyIsolation(
        organizationId: string,
        resourceType: ResourceType,
        resourceId: string,
        resourceOrganizationId: string
    ): { isolated: boolean; violations?: string[] } {
        // Check if the resource belongs to the expected organization
        if (resourceOrganizationId !== organizationId) {
            // Check if cross-org access is allowed
            const accessResult = this.checkAccess(
                organizationId,
                resourceOrganizationId,
                resourceType,
                resourceId,
                CrossOrgAccessLevel.READ
            );

            if (!accessResult.allowed) {
                return {
                    isolated: false,
                    violations: [`Resource ${resourceId} belongs to organization ${resourceOrganizationId}, not ${organizationId}`],
                };
            }
        }

        return { isolated: true };
    }

    /**
     * Get segments for an organization
     */
    getOrganizationSegments(organizationId: string): Segment[] {
        return Array.from(this.segments.values())
            .filter(s => s.organizationId === organizationId);
    }

    /**
     * Get cross-organization access grants for an organization
     */
    getCrossOrgAccessGrants(organizationId: string): CrossOrgAccessConfig[] {
        const grants: CrossOrgAccessConfig[] = [];

        for (const segment of this.segments.values()) {
            if (segment.organizationId === organizationId) {
                grants.push(...segment.allowedCrossOrgAccess);
            }
        }

        return grants;
    }

    /**
     * Get cross-organization access received by an organization
     */
    getCrossOrgAccessReceived(organizationId: string): Array<{
        fromOrganizationId: string;
        segmentId: string;
        config: CrossOrgAccessConfig;
    }> {
        const received: Array<{
            fromOrganizationId: string;
            segmentId: string;
            config: CrossOrgAccessConfig;
        }> = [];

        for (const segment of this.segments.values()) {
            for (const access of segment.allowedCrossOrgAccess) {
                if (access.targetOrganizationId === organizationId) {
                    received.push({
                        fromOrganizationId: segment.organizationId,
                        segmentId: segment.id,
                        config: access,
                    });
                }
            }
        }

        return received;
    }

    /**
     * Get isolation violations
     */
    getViolations(
        filters?: {
            organizationId?: string;
            resourceType?: ResourceType;
            severity?: IsolationViolation['severity'];
            since?: Date;
        }
    ): IsolationViolation[] {
        let violations = [...this.violations];

        if (filters?.organizationId) {
            violations = violations.filter(
                v => v.sourceOrganizationId === filters.organizationId ||
                     v.targetOrganizationId === filters.organizationId
            );
        }

        if (filters?.resourceType) {
            violations = violations.filter(v => v.resourceType === filters.resourceType);
        }

        if (filters?.severity) {
            violations = violations.filter(v => v.severity === filters.severity);
        }

        if (filters?.since) {
            // @ts-expect-error - Strict mode compatibility
            violations = violations.filter(v => v.timestamp >= filters.since);
        }

        return violations;
    }

    /**
     * Get violation statistics
     */
    getViolationStats(): {
        total: number;
        byResourceType: Record<string, number>;
        bySeverity: Record<string, number>;
        last24Hours: number;
        blocked: number;
    } {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const byResourceType: Record<string, number> = {};
        const bySeverity: Record<string, number> = {};
        let last24Hours = 0;
        let blocked = 0;

        for (const v of this.violations) {
            byResourceType[v.resourceType] = (byResourceType[v.resourceType] || 0) + 1;
            bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;

            if (v.timestamp >= oneDayAgo) {last24Hours++;}
            if (v.blocked) {blocked++;}
        }

        return {
            total: this.violations.length,
            byResourceType,
            bySeverity,
            last24Hours,
            blocked,
        };
    }

    /**
     * Check if access level is sufficient
     */
    private accessLevelSufficient(
        granted: CrossOrgAccessLevel,
        requested: CrossOrgAccessLevel
    ): boolean {
        const levels = [
            CrossOrgAccessLevel.NONE,
            CrossOrgAccessLevel.READ,
            CrossOrgAccessLevel.WRITE,
            CrossOrgAccessLevel.FULL,
        ];

        return levels.indexOf(granted) >= levels.indexOf(requested);
    }

    /**
     * Check access conditions
     */
    private checkConditions(
        conditions?: AccessCondition[],
        context?: { userId?: string; ipAddress?: string; timestamp?: Date }
    ): { allowed: boolean; reason?: string } {
        if (!conditions || conditions.length === 0) {
            return { allowed: true };
        }

        for (const condition of conditions) {
            switch (condition.type) {
                case 'time_range': {
                    // Check if current time is within range
                    // Format: "09:00-17:00" or "2024-01-01/2024-12-31"
                    const now = context?.timestamp || new Date();
                    if (!this.isWithinTimeRange(condition.value as string, now)) {
                        return { allowed: false, reason: 'Access not allowed at this time' };
                    }
                    break;
                }

                case 'ip_whitelist':
                    if (context?.ipAddress) {
                        const allowedIps = condition.value as string[];
                        if (!allowedIps.includes(context.ipAddress)) {
                            return { allowed: false, reason: 'IP address not whitelisted' };
                        }
                    }
                    break;

                case 'mfa_required':
                    // Would need to check MFA status in auth context
                    if (condition.value === true) {
                        // Assume MFA check would happen here
                    }
                    break;
            }
        }

        return { allowed: true };
    }

    /**
     * Check if time is within range
     */
    private isWithinTimeRange(range: string, time: Date): boolean {
        // Simple time range check - format: "HH:MM-HH:MM"
        if (range.includes(':')) {
            const [start, end] = range.split('-');
            const [startHour, startMin] = start.split(':').map(Number);
            const [endHour, endMin] = end.split(':').map(Number);

            const currentMinutes = time.getHours() * 60 + time.getMinutes();
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        }

        return true;
    }

    /**
     * Determine violation severity based on resource type
     */
    private determineSeverity(resourceType: ResourceType): IsolationViolation['severity'] {
        switch (resourceType) {
            case ResourceType.INTEL:
                return 'critical';
            case ResourceType.USER:
            case ResourceType.ORGANIZATION:
                return 'high';
            case ResourceType.FLEET:
            case ResourceType.TRADE_ROUTE:
                return 'medium';
            default:
                return 'low';
        }
    }

    /**
     * Record an isolation violation with rate limiting
     */
    private recordViolation(
        violation: Omit<IsolationViolation, 'id' | 'timestamp'>
    ): IsolationViolation | null {
        // Rate limiting key based on source organization and resource type
        const rateLimitKey = `${violation.sourceOrganizationId}:${violation.resourceType}`;
        const now = Date.now();
        
        // Check rate limit
        const rateLimitInfo = this.violationRateLimiter.get(rateLimitKey);
        
        if (rateLimitInfo) {
            const windowElapsed = now - rateLimitInfo.firstSeen.getTime();
            
            if (windowElapsed < this.violationRateLimitWindow) {
                // Within rate limit window
                if (rateLimitInfo.count >= this.violationRateLimitMax) {
                    // Rate limit exceeded - skip logging but still count
                    logger.debug('Violation rate limit exceeded, skipping detailed log', {
                        sourceOrg: violation.sourceOrganizationId,
                        resourceType: violation.resourceType,
                        count: rateLimitInfo.count,
                    });
                    return null;
                }
                rateLimitInfo.count++;
            } else {
                // Window expired, reset counter
                rateLimitInfo.count = 1;
                rateLimitInfo.firstSeen = new Date();
            }
        } else {
            // First violation from this source
            this.violationRateLimiter.set(rateLimitKey, {
                count: 1,
                firstSeen: new Date(),
            });
        }
        
        const record: IsolationViolation = {
            ...violation,
            id: `viol-${this.violationIdCounter++}`,
            timestamp: new Date(),
        };

        this.violations.push(record);

        // Trim history
        if (this.violations.length > this.maxViolationHistory) {
            this.violations.shift();
        }

        logger.warn('Isolation violation recorded', {
            id: record.id,
            sourceOrg: record.sourceOrganizationId,
            targetOrg: record.targetOrganizationId,
            resourceType: record.resourceType,
            severity: record.severity,
        });

        return record;
    }
}

// Export singleton instance
export const microSegmentation = new MicroSegmentationService();

