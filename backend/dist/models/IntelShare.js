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
exports.IntelShare = exports.IntelShareStatus = exports.IntelSharePermission = void 0;
const typeorm_1 = require("typeorm");
const IntelEntry_1 = require("./IntelEntry");
const Organization_1 = require("./Organization");
const User_1 = require("./User");
var IntelSharePermission;
(function (IntelSharePermission) {
    IntelSharePermission["VIEW"] = "view";
    IntelSharePermission["COMMENT"] = "comment";
    IntelSharePermission["CONTRIBUTE"] = "contribute";
    IntelSharePermission["FULL"] = "full";
})(IntelSharePermission || (exports.IntelSharePermission = IntelSharePermission = {}));
var IntelShareStatus;
(function (IntelShareStatus) {
    IntelShareStatus["PENDING"] = "pending";
    IntelShareStatus["ACTIVE"] = "active";
    IntelShareStatus["REVOKED"] = "revoked";
    IntelShareStatus["DECLINED"] = "declined";
    IntelShareStatus["EXPIRED"] = "expired";
})(IntelShareStatus || (exports.IntelShareStatus = IntelShareStatus = {}));
let IntelShare = class IntelShare {
    id;
    intelEntryId;
    intelEntry;
    sourceOrganizationId;
    sourceOrganization;
    targetOrganizationId;
    targetOrganization;
    permission;
    status;
    maxClassification;
    sharedBy;
    sharer;
    acceptedBy;
    accepter;
    revokedBy;
    revoker;
    shareReason;
    revokeReason;
    expiresAt;
    acceptedAt;
    revokedAt;
    viewCount;
    lastViewedAt;
    metadata;
    createdAt;
    updatedAt;
    isActive() {
        if (this.status !== IntelShareStatus.ACTIVE) {
            return false;
        }
        if (this.expiresAt && this.expiresAt < new Date()) {
            return false;
        }
        return true;
    }
    isExpired() {
        if (!this.expiresAt) {
            return false;
        }
        return this.expiresAt < new Date();
    }
};
exports.IntelShare = IntelShare;
__decorate([
    (0, typeorm_1.PrimaryColumn)(),
    __metadata("design:type", String)
], IntelShare.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelShare.prototype, "intelEntryId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => IntelEntry_1.IntelEntry, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'intelEntryId' }),
    __metadata("design:type", IntelEntry_1.IntelEntry)
], IntelShare.prototype, "intelEntry", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelShare.prototype, "sourceOrganizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'sourceOrganizationId' }),
    __metadata("design:type", Organization_1.Organization)
], IntelShare.prototype, "sourceOrganization", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelShare.prototype, "targetOrganizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Organization_1.Organization, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'targetOrganizationId' }),
    __metadata("design:type", Organization_1.Organization)
], IntelShare.prototype, "targetOrganization", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelSharePermission,
        default: IntelSharePermission.VIEW,
    }),
    __metadata("design:type", String)
], IntelShare.prototype, "permission", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelShareStatus,
        default: IntelShareStatus.PENDING,
    }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", String)
], IntelShare.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'varchar',
        enum: IntelEntry_1.IntelClassification,
        default: IntelEntry_1.IntelClassification.RESTRICTED,
    }),
    __metadata("design:type", String)
], IntelShare.prototype, "maxClassification", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], IntelShare.prototype, "sharedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'sharedBy' }),
    __metadata("design:type", User_1.User)
], IntelShare.prototype, "sharer", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelShare.prototype, "acceptedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'acceptedBy' }),
    __metadata("design:type", User_1.User)
], IntelShare.prototype, "accepter", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], IntelShare.prototype, "revokedBy", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { onDelete: 'SET NULL' }),
    (0, typeorm_1.JoinColumn)({ name: 'revokedBy' }),
    __metadata("design:type", User_1.User)
], IntelShare.prototype, "revoker", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], IntelShare.prototype, "shareReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], IntelShare.prototype, "revokeReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], IntelShare.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelShare.prototype, "acceptedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelShare.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], IntelShare.prototype, "viewCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], IntelShare.prototype, "lastViewedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], IntelShare.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    (0, typeorm_1.Index)(),
    __metadata("design:type", Date)
], IntelShare.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], IntelShare.prototype, "updatedAt", void 0);
exports.IntelShare = IntelShare = __decorate([
    (0, typeorm_1.Entity)('intel_shares')
], IntelShare);
//# sourceMappingURL=IntelShare.js.map