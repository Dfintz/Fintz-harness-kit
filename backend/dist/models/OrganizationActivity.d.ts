import { Organization } from './Organization';
import { User } from './User';
export declare enum OrgActivityAction {
    ORG_CREATED = "org.created",
    ORG_UPDATED = "org.updated",
    ORG_DELETED = "org.deleted",
    ORG_ARCHIVED = "org.archived",
    ORG_ACTIVATED = "org.activated",
    SUB_ORG_CREATED = "hierarchy.sub_org_created",
    ORG_MOVED = "hierarchy.org_moved",
    ORG_DETACHED = "hierarchy.org_detached",
    HIERARCHY_RESTRUCTURED = "hierarchy.restructured",
    MEMBER_ADDED = "member.added",
    MEMBER_REMOVED = "member.removed",
    MEMBER_ROLE_CHANGED = "member.role_changed",
    MEMBER_PROMOTED = "member.promoted",
    MEMBER_DEMOTED = "member.demoted",
    MEMBER_TRANSFERRED = "member.transferred",
    PERMISSION_GRANTED = "permission.granted",
    PERMISSION_REVOKED = "permission.revoked",
    PERMISSION_UPDATED = "permission.updated",
    ROLE_CREATED = "permission.role_created",
    ROLE_DELETED = "permission.role_deleted",
    SETTINGS_UPDATED = "settings.updated",
    METADATA_UPDATED = "metadata.updated",
    ACCESS_DENIED = "security.access_denied",
    SECURITY_ALERT = "security.alert",
    INTEGRATION_ENABLED = "integration.enabled",
    INTEGRATION_DISABLED = "integration.disabled"
}
export declare enum ActivitySeverity {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
    CRITICAL = "critical"
}
export declare class OrganizationActivity {
    id: string;
    organizationId: string;
    organization: Organization;
    action: OrgActivityAction;
    actorId?: string;
    actor?: User;
    actorType?: 'user' | 'system' | 'api';
    actorName?: string;
    targetUserId?: string;
    targetUserName?: string;
    targetOrgId?: string;
    targetOrgName?: string;
    resourceType?: string;
    resourceId?: string;
    description?: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    severity: ActivitySeverity;
    tags?: string[];
    requiresReview: boolean;
    reviewed: boolean;
    reviewedBy?: string;
    reviewedAt?: Date;
    ipAddress?: string;
    userAgent?: string;
    method?: string;
    endpoint?: string;
    statusCode?: number;
    timestamp: Date;
    getSeverityLevel(): number;
    needsAttention(): boolean;
    getChangedFields(): string[];
    getSummary(): string;
}
export interface ActivityFilter {
    actions?: OrgActivityAction[];
    actorIds?: string[];
    severity?: ActivitySeverity[];
    startDate?: Date;
    endDate?: Date;
    targetUserId?: string;
    targetOrgId?: string;
    resourceType?: string;
    requiresReview?: boolean;
    reviewed?: boolean;
    tags?: string[];
}
//# sourceMappingURL=OrganizationActivity.d.ts.map