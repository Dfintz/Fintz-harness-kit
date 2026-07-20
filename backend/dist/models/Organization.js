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
exports.Organization = exports.MIN_GRACE_PERIOD_DAYS = exports.MAX_GRACE_PERIOD_DAYS = exports.MAX_EXPORT_EXPIRATION_DAYS = exports.MIN_EXPORT_EXPIRATION_DAYS = exports.DEFAULT_GDPR_SETTINGS = exports.OrganizationStatus = exports.OrganizationType = void 0;
const typeorm_1 = require("typeorm");
var OrganizationType;
(function (OrganizationType) {
    OrganizationType["ROOT"] = "root";
    OrganizationType["DIVISION"] = "division";
    OrganizationType["DEPARTMENT"] = "department";
    OrganizationType["TEAM"] = "team";
    OrganizationType["PROJECT"] = "project";
})(OrganizationType || (exports.OrganizationType = OrganizationType = {}));
var OrganizationStatus;
(function (OrganizationStatus) {
    OrganizationStatus["ACTIVE"] = "active";
    OrganizationStatus["INACTIVE"] = "inactive";
    OrganizationStatus["ARCHIVED"] = "archived";
    OrganizationStatus["SUSPENDED"] = "suspended";
})(OrganizationStatus || (exports.OrganizationStatus = OrganizationStatus = {}));
exports.DEFAULT_GDPR_SETTINGS = {
    deletionGracePeriodDays: 30,
    exportLinkExpirationDays: 7,
};
exports.MIN_EXPORT_EXPIRATION_DAYS = 1;
exports.MAX_EXPORT_EXPIRATION_DAYS = 90;
var gdpr_1 = require("../config/gdpr");
Object.defineProperty(exports, "MAX_GRACE_PERIOD_DAYS", { enumerable: true, get: function () { return gdpr_1.MAX_GRACE_PERIOD_DAYS; } });
Object.defineProperty(exports, "MIN_GRACE_PERIOD_DAYS", { enumerable: true, get: function () { return gdpr_1.MIN_GRACE_PERIOD_DAYS; } });
let Organization = class Organization {
    id;
    name;
    description;
    members;
    parentOrgId;
    parent;
    children;
    type;
    level;
    path;
    rootOrgId;
    status;
    ownerId;
    adminIds;
    settings;
    metadata;
    structure;
    tags;
    logoUrl;
    website;
    contactEmail;
    totalMembers;
    directMembers;
    childCount;
    rsiSid;
    rsiVerified;
    rsiVerifiedAt;
    rsiVerificationCode;
    rsiVerificationCodeExpiresAt;
    isArchived;
    archivedAt;
    archivedBy;
    archiveReason;
    restoredAt;
    restoredBy;
    createdAt;
    updatedAt;
    isRoot() {
        return !this.parentOrgId || this.level === 0;
    }
    isLeaf() {
        return this.childCount === 0;
    }
    getAncestorIds() {
        if (!this.path) {
            return [];
        }
        return this.path.split('.').filter(id => id !== this.id);
    }
    isAncestorOf(orgId) {
        return this.path ? this.path.includes(orgId) : false;
    }
    isDescendantOf(orgId) {
        return this.getAncestorIds().includes(orgId);
    }
    getPathArray() {
        return this.path ? this.path.split('.') : [this.id];
    }
    buildPath(parentPath) {
        if (!parentPath) {
            return this.id;
        }
        return `${parentPath}.${this.id}`;
    }
    getGdprSettings() {
        if (!this.settings?.gdpr) {
            return { ...exports.DEFAULT_GDPR_SETTINGS };
        }
        return {
            deletionGracePeriodDays: this.settings.gdpr.deletionGracePeriodDays ?? exports.DEFAULT_GDPR_SETTINGS.deletionGracePeriodDays,
            exportLinkExpirationDays: this.settings.gdpr.exportLinkExpirationDays ??
                exports.DEFAULT_GDPR_SETTINGS.exportLinkExpirationDays,
        };
    }
};
exports.Organization = Organization;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], Organization.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Organization.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Organization.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true, default: '' }),
    __metadata("design:type", Array)
], Organization.prototype, "members", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "parentOrgId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization, org => org.children, { nullable: true, onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'parentOrgId' }),
    __metadata("design:type", Organization)
], Organization.prototype, "parent", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Organization, org => org.parent),
    __metadata("design:type", Array)
], Organization.prototype, "children", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OrganizationType,
        default: OrganizationType.ROOT,
    }),
    __metadata("design:type", String)
], Organization.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Organization.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', default: '' }),
    __metadata("design:type", String)
], Organization.prototype, "path", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "rootOrgId", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: OrganizationStatus,
        default: OrganizationStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], Organization.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.Column)('simple-array', { nullable: true }),
    __metadata("design:type", Array)
], Organization.prototype, "adminIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Organization.prototype, "settings", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Organization.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], Organization.prototype, "structure", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'simple-array', nullable: true }),
    __metadata("design:type", Array)
], Organization.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "website", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "contactEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Organization.prototype, "totalMembers", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Organization.prototype, "directMembers", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], Organization.prototype, "childCount", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "rsiSid", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Organization.prototype, "rsiVerified", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Organization.prototype, "rsiVerifiedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "rsiVerificationCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Organization.prototype, "rsiVerificationCodeExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], Organization.prototype, "isArchived", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'timestamp' }),
    __metadata("design:type", Date)
], Organization.prototype, "archivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "archivedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'text' }),
    __metadata("design:type", String)
], Organization.prototype, "archiveReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, type: 'timestamp' }),
    __metadata("design:type", Date)
], Organization.prototype, "restoredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "restoredBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Organization.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Organization.prototype, "updatedAt", void 0);
exports.Organization = Organization = __decorate([
    (0, typeorm_1.Entity)('organizations'),
    (0, typeorm_1.Index)(['parentOrgId']),
    (0, typeorm_1.Index)(['type']),
    (0, typeorm_1.Index)(['status']),
    (0, typeorm_1.Index)(['path']),
    (0, typeorm_1.Index)(['level'])
], Organization);
//# sourceMappingURL=Organization.js.map