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
exports.PermissionTemplates = exports.OrganizationPermission = exports.PermissionAction = exports.ResourceType = exports.PermissionScope = void 0;
const typeorm_1 = require("typeorm");
const ipWhitelist_1 = require("../utils/ipWhitelist");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var PermissionScope;
(function (PermissionScope) {
    PermissionScope["ORGANIZATION"] = "organization";
    PermissionScope["DIVISION"] = "division";
    PermissionScope["DEPARTMENT"] = "department";
    PermissionScope["TEAM"] = "team";
    PermissionScope["CUSTOM"] = "custom";
})(PermissionScope || (exports.PermissionScope = PermissionScope = {}));
var ResourceType;
(function (ResourceType) {
    ResourceType["FLEET"] = "fleet";
    ResourceType["SHIP"] = "ship";
    ResourceType["MEMBER"] = "member";
    ResourceType["MEMBERS"] = "members";
    ResourceType["EVENT"] = "event";
    ResourceType["FINANCE"] = "finance";
    ResourceType["TREASURY"] = "treasury";
    ResourceType["COMMISSARY"] = "commissary";
    ResourceType["LOOT"] = "loot";
    ResourceType["CONTRACT"] = "contract";
    ResourceType["RECRUITMENT"] = "recruitment";
    ResourceType["LOGISTICS"] = "logistics";
    ResourceType["SETTINGS"] = "settings";
    ResourceType["PERMISSIONS"] = "permissions";
    ResourceType["HIERARCHY"] = "hierarchy";
    ResourceType["ANALYTICS"] = "analytics";
    ResourceType["INTEL"] = "intel";
    ResourceType["CUSTOM"] = "custom";
})(ResourceType || (exports.ResourceType = ResourceType = {}));
var PermissionAction;
(function (PermissionAction) {
    PermissionAction["VIEW"] = "view";
    PermissionAction["CREATE"] = "create";
    PermissionAction["EDIT"] = "edit";
    PermissionAction["DELETE"] = "delete";
    PermissionAction["APPROVE"] = "approve";
    PermissionAction["MANAGE"] = "manage";
    PermissionAction["ADMIN"] = "admin";
    PermissionAction["ALL"] = "all";
})(PermissionAction || (exports.PermissionAction = PermissionAction = {}));
let OrganizationPermission = class OrganizationPermission {
    id;
    organizationId;
    organization;
    userId;
    user;
    roleId;
    resource;
    resourceId;
    actions;
    scope;
    inheritable;
    inherited;
    inheritedFrom;
    priority;
    conditions;
    metadata;
    isActive;
    expiresAt;
    grantedBy;
    reason;
    createdAt;
    updatedAt;
    isExpired() {
        if (!this.expiresAt) {
            return false;
        }
        return new Date() > this.expiresAt;
    }
    isValid() {
        return this.isActive && !this.isExpired();
    }
    allowsAction(action) {
        return this.actions.includes(action) || this.actions.includes(PermissionAction.ALL);
    }
    appliesToResource(resourceId) {
        if (!this.resourceId) {
            return true;
        }
        return this.resourceId === resourceId;
    }
    matchesTimeRestrictions() {
        if (!this.conditions?.timeRestriction) {
            return true;
        }
        const now = new Date();
        const restriction = this.conditions.timeRestriction;
        if (restriction.daysOfWeek && restriction.daysOfWeek.length > 0) {
            const currentDay = now.getDay();
            if (!restriction.daysOfWeek.includes(currentDay)) {
                return false;
            }
        }
        if (restriction.startTime && restriction.endTime) {
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            if (currentTime < restriction.startTime || currentTime > restriction.endTime) {
                return false;
            }
        }
        return true;
    }
    matchesIPRestrictions(requestIP) {
        if (!this.conditions?.ipRestriction) {
            return true;
        }
        const restriction = this.conditions.ipRestriction;
        const result = (0, ipWhitelist_1.isIPAllowed)(requestIP, restriction.allowedIPs, restriction.blockedIPs);
        return result.allowed;
    }
};
exports.OrganizationPermission = OrganizationPermission;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'organizationId' }),
    __metadata("design:type", Organization_1.Organization)
], OrganizationPermission.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE', nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'userId' }),
    __metadata("design:type", User_1.User)
], OrganizationPermission.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "roleId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ResourceType,
    }),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "resource", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array'),
    __metadata("design:type", Array)
], OrganizationPermission.prototype, "actions", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: PermissionScope,
        default: PermissionScope.ORGANIZATION,
    }),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "scope", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], OrganizationPermission.prototype, "inheritable", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], OrganizationPermission.prototype, "inherited", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "inheritedFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], OrganizationPermission.prototype, "priority", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationPermission.prototype, "conditions", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], OrganizationPermission.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], OrganizationPermission.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", Date)
], OrganizationPermission.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "grantedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], OrganizationPermission.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationPermission.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], OrganizationPermission.prototype, "updatedAt", void 0);
exports.OrganizationPermission = OrganizationPermission = __decorate([
    (0, typeorm_1.Entity)('organization_permissions'),
    (0, typeorm_1.Index)(['organizationId', 'userId']),
    (0, typeorm_1.Index)(['organizationId', 'resource']),
    (0, typeorm_1.Index)(['scope']),
    (0, typeorm_1.Index)(['isActive'])
], OrganizationPermission);
exports.PermissionTemplates = {
    OWNER: {
        name: 'Owner',
        description: 'Full access to all resources',
        permissions: [
            {
                resource: ResourceType.CUSTOM,
                actions: [PermissionAction.ALL],
                scope: PermissionScope.ORGANIZATION,
            },
        ],
    },
    ADMIN: {
        name: 'Administrator',
        description: 'Administrative access to most resources',
        permissions: [
            {
                resource: ResourceType.FLEET,
                actions: [PermissionAction.ALL],
                scope: PermissionScope.ORGANIZATION,
            },
            {
                resource: ResourceType.MEMBER,
                actions: [PermissionAction.ALL],
                scope: PermissionScope.ORGANIZATION,
            },
            {
                resource: ResourceType.EVENT,
                actions: [PermissionAction.ALL],
                scope: PermissionScope.ORGANIZATION,
            },
            {
                resource: ResourceType.SETTINGS,
                actions: [PermissionAction.VIEW, PermissionAction.EDIT],
                scope: PermissionScope.ORGANIZATION,
            },
        ],
    },
    MANAGER: {
        name: 'Manager',
        description: 'Department-level management access',
        permissions: [
            {
                resource: ResourceType.FLEET,
                actions: [PermissionAction.VIEW, PermissionAction.EDIT],
                scope: PermissionScope.DEPARTMENT,
            },
            {
                resource: ResourceType.MEMBER,
                actions: [PermissionAction.VIEW, PermissionAction.EDIT],
                scope: PermissionScope.DEPARTMENT,
            },
            {
                resource: ResourceType.EVENT,
                actions: [PermissionAction.ALL],
                scope: PermissionScope.DEPARTMENT,
            },
        ],
    },
    MEMBER: {
        name: 'Member',
        description: 'Basic member access',
        permissions: [
            {
                resource: ResourceType.FLEET,
                actions: [PermissionAction.VIEW],
                scope: PermissionScope.ORGANIZATION,
            },
            {
                resource: ResourceType.EVENT,
                actions: [PermissionAction.VIEW],
                scope: PermissionScope.ORGANIZATION,
            },
        ],
    },
    VIEWER: {
        name: 'Viewer',
        description: 'Read-only access',
        permissions: [
            {
                resource: ResourceType.FLEET,
                actions: [PermissionAction.VIEW],
                scope: PermissionScope.ORGANIZATION,
            },
            {
                resource: ResourceType.MEMBER,
                actions: [PermissionAction.VIEW],
                scope: PermissionScope.ORGANIZATION,
            },
        ],
    },
};
//# sourceMappingURL=OrganizationPermission.js.map