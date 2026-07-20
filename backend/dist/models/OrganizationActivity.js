"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationActivity = exports.ActivitySeverity = exports.OrgActivityAction = void 0;
const typeorm_1 = require("typeorm");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var OrgActivityAction;
(function (OrgActivityAction) {
    OrgActivityAction["ORG_CREATED"] = "org.created";
    OrgActivityAction["ORG_UPDATED"] = "org.updated";
    OrgActivityAction["ORG_DELETED"] = "org.deleted";
    OrgActivityAction["ORG_ARCHIVED"] = "org.archived";
    OrgActivityAction["ORG_ACTIVATED"] = "org.activated";
    OrgActivityAction["SUB_ORG_CREATED"] = "hierarchy.sub_org_created";
    OrgActivityAction["ORG_MOVED"] = "hierarchy.org_moved";
    OrgActivityAction["ORG_DETACHED"] = "hierarchy.org_detached";
    OrgActivityAction["HIERARCHY_RESTRUCTURED"] = "hierarchy.restructured";
    OrgActivityAction["MEMBER_ADDED"] = "member.added";
    OrgActivityAction["MEMBER_REMOVED"] = "member.removed";
    OrgActivityAction["MEMBER_ROLE_CHANGED"] = "member.role_changed";
    OrgActivityAction["MEMBER_PROMOTED"] = "member.promoted";
    OrgActivityAction["MEMBER_DEMOTED"] = "member.demoted";
    OrgActivityAction["MEMBER_TRANSFERRED"] = "member.transferred";
    OrgActivityAction["PERMISSION_GRANTED"] = "permission.granted";
    OrgActivityAction["PERMISSION_REVOKED"] = "permission.revoked";
    OrgActivityAction["PERMISSION_UPDATED"] = "permission.updated";
    OrgActivityAction["ROLE_CREATED"] = "permission.role_created";
    OrgActivityAction["ROLE_DELETED"] = "permission.role_deleted";
    OrgActivityAction["SETTINGS_UPDATED"] = "settings.updated";
    OrgActivityAction["METADATA_UPDATED"] = "metadata.updated";
    OrgActivityAction["ACCESS_DENIED"] = "security.access_denied";
    OrgActivityAction["SECURITY_ALERT"] = "security.alert";
    OrgActivityAction["INTEGRATION_ENABLED"] = "integration.enabled";
    OrgActivityAction["INTEGRATION_DISABLED"] = "integration.disabled";
})(OrgActivityAction || (exports.OrgActivityAction = OrgActivityAction = {}));
var ActivitySeverity;
(function (ActivitySeverity) {
    ActivitySeverity["INFO"] = "info";
    ActivitySeverity["WARNING"] = "warning";
    ActivitySeverity["ERROR"] = "error";
    ActivitySeverity["CRITICAL"] = "critical";
})(ActivitySeverity || (exports.ActivitySeverity = ActivitySeverity = {}));
let OrganizationActivity = class OrganizationActivity {
    id;
    organizationId;
    organization;
    action;
    actorId;
    actor;
    actorType;
    actorName;
    targetUserId;
    targetUserName;
    targetOrgId;
    targetOrgName;
    resourceType;
    resourceId;
    description;
    before;
    after;
    metadata;
    severity;
    tags;
    requiresReview;
    reviewed;
    reviewedBy;
    reviewedAt;
    ipAddress;
    userAgent;
    method;
    endpoint;
    statusCode;
    timestamp;
    getSeverityLevel() {
        const levels = {
            [ActivitySeverity.INFO]: 1,
            [ActivitySeverity.WARNING]: 2,
            [ActivitySeverity.ERROR]: 3,
            [ActivitySeverity.CRITICAL]: 4
        };
        return levels[this.severity] || 1;
    }
    needsAttention() {
        return this.requiresReview && !this.reviewed;
    }
    getChangedFields() {
        if (!this.before || !this.after) {
            return [];
        }
        const changed = [];
        const allKeys = new Set([
            ...Object.keys(this.before),
            ...Object.keys(this.after)
        ]);
        for (const key of allKeys) {
            if (JSON.stringify(this.before[key]) !== JSON.stringify(this.after[key])) {
                changed.push(key);
            }
        }
        return changed;
    }
    getSummary() {
        if (this.description) {
            return this.description;
        }
        const actor = this.actorName || 'System';
        const target = this.targetUserName || this.targetOrgName || 'resource';
        switch (this.action) {
            case OrgActivityAction.MEMBER_ADDED:
                return `${actor} added ${target} to the organization`;
            case OrgActivityAction.MEMBER_REMOVED:
                return `${actor} removed ${target} from the organization`;
            case OrgActivityAction.PERMISSION_GRANTED:
                return `${actor} granted permissions to ${target}`;
            case OrgActivityAction.ORG_UPDATED:
                return `${actor} updated organization settings`;
            case OrgActivityAction.SUB_ORG_CREATED:
                return `${actor} created sub-organization: ${target}`;
            default:
                return `${actor} performed ${this.action}`;
        }
    }
};
exports.OrganizationActivity = OrganizationActivity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], OrganizationActivity.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OrgActivityAction
    }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'actorId' }),
    __metadata("design:type", User_1.User)
], OrganizationActivity.prototype, "actor", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "actorType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "actorName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "targetUserId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "targetUserName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "targetOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "targetOrgName", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "resourceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationActivity.prototype, "before", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationActivity.prototype, "after", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationActivity.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ActivitySeverity,
        default: ActivitySeverity.INFO
    }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "severity", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], OrganizationActivity.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationActivity.prototype, "requiresReview", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationActivity.prototype, "reviewed", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "reviewedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], OrganizationActivity.prototype, "reviewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "userAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "method", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], OrganizationActivity.prototype, "endpoint", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Number)
], OrganizationActivity.prototype, "statusCode", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationActivity.prototype, "timestamp", void 0);
exports.OrganizationActivity = OrganizationActivity = __decorate([
    (0, typeorm_1.Entity)('organization_activities'),
    (0, typeorm_1.Index)(['organizationId', 'timestamp']),
    (0, typeorm_1.Index)(['action']),
    (0, typeorm_1.Index)(['actorId']),
    (0, typeorm_1.Index)(['severity']),
    (0, typeorm_1.Index)(['targetOrgId'])
], OrganizationActivity);
//# sourceMappingURL=OrganizationActivity.js.map