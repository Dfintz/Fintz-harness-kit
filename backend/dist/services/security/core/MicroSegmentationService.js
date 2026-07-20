"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.microSegmentation = exports.MicroSegmentationService = exports.CrossOrgAccessLevel = exports.ResourceType = void 0;
const logger_1 = require("../../../utils/logger");
var ResourceType;
(function (ResourceType) {
    ResourceType["FLEET"] = "fleet";
    ResourceType["SHIP"] = "ship";
    ResourceType["ACTIVITY"] = "activity";
    ResourceType["USER"] = "user";
    ResourceType["ORGANIZATION"] = "organization";
    ResourceType["INTEL"] = "intel";
    ResourceType["TRADE_ROUTE"] = "trade_route";
    ResourceType["TICKET"] = "ticket";
    ResourceType["WEBHOOK"] = "webhook";
    ResourceType["ANNOUNCEMENT"] = "announcement";
})(ResourceType || (exports.ResourceType = ResourceType = {}));
var CrossOrgAccessLevel;
(function (CrossOrgAccessLevel) {
    CrossOrgAccessLevel["NONE"] = "none";
    CrossOrgAccessLevel["READ"] = "read";
    CrossOrgAccessLevel["WRITE"] = "write";
    CrossOrgAccessLevel["FULL"] = "full";
})(CrossOrgAccessLevel || (exports.CrossOrgAccessLevel = CrossOrgAccessLevel = {}));
class MicroSegmentationService {
    segments = new Map();
    violations = [];
    segmentIdCounter = 1;
    violationIdCounter = 1;
    maxViolationHistory = 1000;
    violationRateLimiter = new Map();
    violationRateLimitWindow = 60000;
    violationRateLimitMax = 10;
    constructor() {
        this.initializeDefaultSegments();
    }
    initializeDefaultSegments() {
        logger_1.logger.info('Micro-segmentation service initialized with default isolation rules');
    }
    createSegment(organizationId, name, resources, description) {
        const segment = {
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
        logger_1.logger.info('Segment created', {
            segmentId: segment.id,
            organizationId,
            name,
            resourceCount: resources.length,
        });
        return segment;
    }
    updateSegment(segmentId, updates) {
        const segment = this.segments.get(segmentId);
        if (!segment) {
            return null;
        }
        if (updates.name) {
            segment.name = updates.name;
        }
        if (updates.description !== undefined) {
            segment.description = updates.description;
        }
        if (updates.resources) {
            segment.resources = updates.resources;
        }
        segment.updatedAt = new Date();
        logger_1.logger.info('Segment updated', { segmentId });
        return segment;
    }
    deleteSegment(segmentId) {
        const deleted = this.segments.delete(segmentId);
        if (deleted) {
            logger_1.logger.info('Segment deleted', { segmentId });
        }
        return deleted;
    }
    grantCrossOrgAccess(segmentId, config) {
        const segment = this.segments.get(segmentId);
        if (!segment) {
            return false;
        }
        const existingIndex = segment.allowedCrossOrgAccess.findIndex(a => a.targetOrganizationId === config.targetOrganizationId &&
            a.resourceType === config.resourceType);
        if (existingIndex >= 0) {
            segment.allowedCrossOrgAccess[existingIndex] = config;
        }
        else {
            segment.allowedCrossOrgAccess.push(config);
        }
        segment.updatedAt = new Date();
        logger_1.logger.info('Cross-organization access granted', {
            segmentId,
            targetOrganizationId: config.targetOrganizationId,
            resourceType: config.resourceType,
            accessLevel: config.accessLevel,
        });
        return true;
    }
    revokeCrossOrgAccess(segmentId, targetOrganizationId, resourceType) {
        const segment = this.segments.get(segmentId);
        if (!segment) {
            return false;
        }
        const initialLength = segment.allowedCrossOrgAccess.length;
        segment.allowedCrossOrgAccess = segment.allowedCrossOrgAccess.filter(a => !(a.targetOrganizationId === targetOrganizationId &&
            a.resourceType === resourceType));
        if (segment.allowedCrossOrgAccess.length < initialLength) {
            segment.updatedAt = new Date();
            logger_1.logger.info('Cross-organization access revoked', {
                segmentId,
                targetOrganizationId,
                resourceType,
            });
            return true;
        }
        return false;
    }
    checkAccess(requestingOrganizationId, resourceOrganizationId, resourceType, resourceId, requestedAccessLevel, context) {
        if (requestingOrganizationId === resourceOrganizationId) {
            return { allowed: true, accessLevel: CrossOrgAccessLevel.FULL };
        }
        const orgSegments = this.getOrganizationSegments(resourceOrganizationId);
        for (const segment of orgSegments) {
            const grant = segment.allowedCrossOrgAccess.find(a => a.targetOrganizationId === requestingOrganizationId &&
                a.resourceType === resourceType);
            if (grant) {
                if (grant.expiresAt && grant.expiresAt < new Date()) {
                    continue;
                }
                if (this.accessLevelSufficient(grant.accessLevel, requestedAccessLevel)) {
                    const resource = segment.resources.find(r => r.resourceType === resourceType &&
                        (!r.resourceId || r.resourceId === resourceId));
                    if (resource) {
                        const conditionsResult = this.checkConditions(resource.conditions, context);
                        if (conditionsResult.allowed) {
                            return {
                                allowed: true,
                                segment: segment.id,
                                accessLevel: grant.accessLevel,
                                conditions: resource.conditions,
                            };
                        }
                        else {
                            return {
                                allowed: false,
                                reason: conditionsResult.reason,
                            };
                        }
                    }
                }
            }
        }
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
    verifyIsolation(organizationId, resourceType, resourceId, resourceOrganizationId) {
        if (resourceOrganizationId !== organizationId) {
            const accessResult = this.checkAccess(organizationId, resourceOrganizationId, resourceType, resourceId, CrossOrgAccessLevel.READ);
            if (!accessResult.allowed) {
                return {
                    isolated: false,
                    violations: [`Resource ${resourceId} belongs to organization ${resourceOrganizationId}, not ${organizationId}`],
                };
            }
        }
        return { isolated: true };
    }
    getOrganizationSegments(organizationId) {
        return Array.from(this.segments.values())
            .filter(s => s.organizationId === organizationId);
    }
    getCrossOrgAccessGrants(organizationId) {
        const grants = [];
        for (const segment of this.segments.values()) {
            if (segment.organizationId === organizationId) {
                grants.push(...segment.allowedCrossOrgAccess);
            }
        }
        return grants;
    }
    getCrossOrgAccessReceived(organizationId) {
        const received = [];
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
    getViolations(filters) {
        let violations = [...this.violations];
        if (filters?.organizationId) {
            violations = violations.filter(v => v.sourceOrganizationId === filters.organizationId ||
                v.targetOrganizationId === filters.organizationId);
        }
        if (filters?.resourceType) {
            violations = violations.filter(v => v.resourceType === filters.resourceType);
        }
        if (filters?.severity) {
            violations = violations.filter(v => v.severity === filters.severity);
        }
        if (filters?.since) {
            violations = violations.filter(v => v.timestamp >= filters.since);
        }
        return violations;
    }
    getViolationStats() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const byResourceType = {};
        const bySeverity = {};
        let last24Hours = 0;
        let blocked = 0;
        for (const v of this.violations) {
            byResourceType[v.resourceType] = (byResourceType[v.resourceType] || 0) + 1;
            bySeverity[v.severity] = (bySeverity[v.severity] || 0) + 1;
            if (v.timestamp >= oneDayAgo) {
                last24Hours++;
            }
            if (v.blocked) {
                blocked++;
            }
        }
        return {
            total: this.violations.length,
            byResourceType,
            bySeverity,
            last24Hours,
            blocked,
        };
    }
    accessLevelSufficient(granted, requested) {
        const levels = [
            CrossOrgAccessLevel.NONE,
            CrossOrgAccessLevel.READ,
            CrossOrgAccessLevel.WRITE,
            CrossOrgAccessLevel.FULL,
        ];
        return levels.indexOf(granted) >= levels.indexOf(requested);
    }
    checkConditions(conditions, context) {
        if (!conditions || conditions.length === 0) {
            return { allowed: true };
        }
        for (const condition of conditions) {
            switch (condition.type) {
                case 'time_range': {
                    const now = context?.timestamp || new Date();
                    if (!this.isWithinTimeRange(condition.value, now)) {
                        return { allowed: false, reason: 'Access not allowed at this time' };
                    }
                    break;
                }
                case 'ip_whitelist':
                    if (context?.ipAddress) {
                        const allowedIps = condition.value;
                        if (!allowedIps.includes(context.ipAddress)) {
                            return { allowed: false, reason: 'IP address not whitelisted' };
                        }
                    }
                    break;
                case 'mfa_required':
                    if (condition.value === true) {
                    }
                    break;
            }
        }
        return { allowed: true };
    }
    isWithinTimeRange(range, time) {
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
    determineSeverity(resourceType) {
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
    recordViolation(violation) {
        const rateLimitKey = `${violation.sourceOrganizationId}:${violation.resourceType}`;
        const now = Date.now();
        const rateLimitInfo = this.violationRateLimiter.get(rateLimitKey);
        if (rateLimitInfo) {
            const windowElapsed = now - rateLimitInfo.firstSeen.getTime();
            if (windowElapsed < this.violationRateLimitWindow) {
                if (rateLimitInfo.count >= this.violationRateLimitMax) {
                    logger_1.logger.debug('Violation rate limit exceeded, skipping detailed log', {
                        sourceOrg: violation.sourceOrganizationId,
                        resourceType: violation.resourceType,
                        count: rateLimitInfo.count,
                    });
                    return null;
                }
                rateLimitInfo.count++;
            }
            else {
                rateLimitInfo.count = 1;
                rateLimitInfo.firstSeen = new Date();
            }
        }
        else {
            this.violationRateLimiter.set(rateLimitKey, {
                count: 1,
                firstSeen: new Date(),
            });
        }
        const record = {
            ...violation,
            id: `viol-${this.violationIdCounter++}`,
            timestamp: new Date(),
        };
        this.violations.push(record);
        if (this.violations.length > this.maxViolationHistory) {
            this.violations.shift();
        }
        logger_1.logger.warn('Isolation violation recorded', {
            id: record.id,
            sourceOrg: record.sourceOrganizationId,
            targetOrg: record.targetOrganizationId,
            resourceType: record.resourceType,
            severity: record.severity,
        });
        return record;
    }
}
exports.MicroSegmentationService = MicroSegmentationService;
exports.microSegmentation = new MicroSegmentationService();
//# sourceMappingURL=MicroSegmentationService.js.map